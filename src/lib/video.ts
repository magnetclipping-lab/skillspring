import "server-only";
import { importPKCS8, SignJWT } from "jose";
import { integrationStatus, serverEnv } from "@/lib/env.server";

/**
 * Secure video playback. Lessons store only a Mux playback ID or a Cloudflare
 * Stream video UID; the server issues a short-lived signed token after checking
 * the viewer's enrolment. Assets must be created with a *signed* playback policy.
 */
export type PlaybackResult =
  | { ok: true; provider: "mux" | "cloudflare"; embedUrl: string; expiresAt: number }
  | { ok: false; reason: "not_configured" | "no_video" };

const TTL_SECONDS = 2 * 60 * 60;

function decodeKey(value: string) {
  // Keys are stored base64-encoded in env vars to avoid newline issues.
  const raw = value.includes("BEGIN") ? value : Buffer.from(value, "base64").toString("utf8");
  return raw.replace(/\\n/g, "\n");
}

async function pkcs8(pem: string) {
  // Mux/Cloudflare may hand out PKCS#1 ("BEGIN RSA PRIVATE KEY"); convert to PKCS#8.
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    const { createPrivateKey } = await import("node:crypto");
    pem = createPrivateKey(pem).export({ type: "pkcs8", format: "pem" }).toString();
  }
  return importPKCS8(pem, "RS256");
}

export async function getPlayback(provider: string | null, assetId: string | null): Promise<PlaybackResult> {
  if (!provider || !assetId) return { ok: false, reason: "no_video" };
  const status = integrationStatus();
  const env = serverEnv();
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  if (provider === "mux") {
    if (!status.mux) return { ok: false, reason: "not_configured" };
    const key = await pkcs8(decodeKey(env.MUX_SIGNING_PRIVATE_KEY!));
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: env.MUX_SIGNING_KEY_ID! })
      .setSubject(assetId)
      .setAudience("v")
      .setExpirationTime(exp)
      .sign(key);
    return { ok: true, provider: "mux", embedUrl: `https://player.mux.com/${encodeURIComponent(assetId)}?playback-token=${token}`, expiresAt: exp };
  }

  if (provider === "cloudflare") {
    if (!status.cloudflareStream) return { ok: false, reason: "not_configured" };
    const key = await pkcs8(decodeKey(env.CLOUDFLARE_STREAM_PRIVATE_KEY!));
    const token = await new SignJWT({ kid: env.CLOUDFLARE_STREAM_KEY_ID! })
      .setProtectedHeader({ alg: "RS256", kid: env.CLOUDFLARE_STREAM_KEY_ID! })
      .setSubject(assetId)
      .setExpirationTime(exp)
      .setNotBefore(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    return { ok: true, provider: "cloudflare", embedUrl: `https://customer-${env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${token}/iframe`, expiresAt: exp };
  }
  return { ok: false, reason: "no_video" };
}

/** Creates a Mux direct-upload URL (signed playback policy) for admins/instructors. */
export async function createMuxDirectUpload(corsOrigin: string) {
  const env = serverEnv();
  if (!integrationStatus().muxUploads) return null;
  const res = await fetch("https://api.mux.com/video/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cors_origin: corsOrigin, new_asset_settings: { playback_policy: ["signed"], video_quality: "basic" } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Mux upload creation failed (${res.status})`);
  const json = (await res.json()) as { data: { id: string; url: string } };
  return json.data;
}
