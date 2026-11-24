import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { processEvaluationJobs } from "@/lib/assessment/worker";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Accepts the CRON_SECRET env var (Vercel Cron sends it automatically) or the database's own secret (pg_cron + pg_net). */
async function authorised(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const envSecret = serverEnv().CRON_SECRET;
  if (envSecret && same(token, envSecret)) return true;
  const { data } = await createAdminClient().rpc("get_cron_secret");
  return typeof data === "string" && data.length > 0 && same(token, data);
}

async function run(request: Request) {
  if (!hasAdminClient()) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
  if (!(await authorised(request))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const outcomes = await processEvaluationJobs({ limit: 3, budgetMs: 240_000 });
    return NextResponse.json({ processed: outcomes.length, outcomes }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/evaluate]", e);
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
