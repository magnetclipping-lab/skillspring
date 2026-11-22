import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/lesson/markdown";
import { LessonVideo } from "@/components/lesson/video";
import { Badge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { Lesson } from "@/lib/types";

export const metadata: Metadata = { title: "Lesson preview", robots: { index: false } };

export default async function PreviewLessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/.test(lessonId)) notFound();
  const supabase = await createClient();
  // RLS only returns free-preview lessons of published courses (or lessons the viewer is entitled to).
  const { data: course } = await supabase.from("courses").select("id, title, slug").eq("slug", slug).maybeSingle();
  if (!course) notFound();
  const { data } = await supabase.from("lessons").select("*").eq("id", lessonId).eq("course_id", course.id).eq("is_preview", true).maybeSingle();
  const lesson = data as Lesson | null;
  if (!lesson) notFound();

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href={`/courses/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" />{course.title}</Link>
      <div className="mt-4 flex items-center gap-2"><Badge tone="brand">Free preview</Badge></div>
      <h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1>
      <div className="mt-6 space-y-6">
        {lesson.type === "video" ? <LessonVideo provider={lesson.video_provider} assetId={lesson.video_asset_id} title={lesson.title} /> : null}
        {lesson.content_md ? <Markdown source={lesson.content_md} /> : null}
      </div>
      <div className="mt-10 rounded-2xl border border-line bg-white p-6 text-center">
        <p className="font-semibold">Enjoyed the preview?</p>
        <p className="mt-1 text-sm text-ink-muted">Enrol to unlock every lesson, assignment and your certificate.</p>
        <ButtonLink href={`/courses/${slug}`} className="mt-4">View course</ButtonLink>
      </div>
    </div>
  );
}
