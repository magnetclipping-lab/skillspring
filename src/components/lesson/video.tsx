import { VideoOff } from "lucide-react";
import { getPlayback } from "@/lib/video";

/** Server component: issues a signed, short-lived playback URL only after the caller has been authorised. */
export async function LessonVideo({ provider, assetId, title }: { provider: string | null; assetId: string | null; title: string }) {
  const playback = await getPlayback(provider, assetId);
  if (!playback.ok) {
    return (
      <div className="grid aspect-video place-items-center rounded-2xl bg-brand-950 text-center text-brand-100">
        <div className="px-6">
          <VideoOff className="mx-auto size-8 text-brand-300" />
          <p className="mt-3 font-semibold text-white">{playback.reason === "not_configured" ? "Video playback is not configured yet" : "Video coming soon"}</p>
          <p className="mt-1 text-sm text-brand-200/80">
            {playback.reason === "not_configured" ? "An administrator needs to add the video provider signing keys." : "The video for this lesson hasn't been uploaded yet."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-lift">
      <iframe
        src={playback.embedUrl}
        title={title}
        className="size-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
