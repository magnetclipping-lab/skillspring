"use client";
import { useActionState, useState } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { FileUpload } from "@/components/ui/file-upload";
import {
  addModuleAction, addQuestionAction, addResourceAction, saveAssignmentAction, saveCourseAction, saveLessonAction, saveQuizAction, updateModuleAction,
} from "@/lib/actions/course-content";
import type { Category, Course, Lesson } from "@/lib/types";

type Base = "/admin" | "/instructor";

export function CourseForm({ base, categories, course, readOnly }: { base: Base; categories: Category[]; course?: Course; readOnly?: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(saveCourseAction, null);
  const [thumb, setThumb] = useState(course?.thumbnail_url ?? "");
  const [preview, setPreview] = useState(course?.preview_video_url ?? "");
  const [poster, setPoster] = useState(course?.preview_poster_url ?? "");
  const e = state?.errors ?? {};
  const rupees = (p?: number | null) => (p == null ? "" : String(p / 100));
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      {course ? <input type="hidden" name="id" value={course.id} /> : null}
      <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" name="title" error={e.title} required><Input id="title" name="title" defaultValue={course?.title} /></Field>
          <Field label="URL slug" name="slug" error={e.slug} required help="Lowercase letters, numbers and hyphens"><Input id="slug" name="slug" defaultValue={course?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
        </div>
        <Field label="Subtitle" name="subtitle" error={e.subtitle}><Input id="subtitle" name="subtitle" defaultValue={course?.subtitle ?? ""} /></Field>
        <Field label="Description" name="description" error={e.description} required><Textarea id="description" name="description" rows={5} defaultValue={course?.description} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" name="category_id" error={e.category_id}>
            <Select id="category_id" name="category_id" defaultValue={course?.category_id ?? ""}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </Field>
          <Field label="Level" name="level"><Select id="level" name="level" defaultValue={course?.level ?? "beginner"}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></Select></Field>
          <Field label="Language" name="language" error={e.language}><Input id="language" name="language" defaultValue={course?.language ?? "English"} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Price (₹)" name="price" error={e.price} required help={base === "/instructor" ? "Final pricing is confirmed by Proofwork" : undefined}><Input id="price" name="price" type="number" min={0} step="1" defaultValue={rupees(course?.price_paise) || "0"} /></Field>
          <Field label="Discount price (₹)" name="discount_price" error={e.discount_price}><Input id="discount_price" name="discount_price" type="number" min={0} step="1" defaultValue={rupees(course?.discount_price_paise)} /></Field>
          <Field label="Discount ends" name="discount_ends_at"><Input id="discount_ends_at" name="discount_ends_at" type="datetime-local" defaultValue={course?.discount_ends_at?.slice(0, 16) ?? ""} /></Field>
          <Field label="Total duration (min)" name="duration_minutes" error={e.duration_minutes}><Input id="duration_minutes" name="duration_minutes" type="number" min={0} defaultValue={course?.duration_minutes ?? 0} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Learning outcomes" name="learning_outcomes" help="One per line"><Textarea id="learning_outcomes" name="learning_outcomes" rows={5} defaultValue={course?.learning_outcomes.join("\n")} /></Field>
          <Field label="Requirements" name="requirements" help="One per line"><Textarea id="requirements" name="requirements" rows={5} defaultValue={course?.requirements.join("\n")} /></Field>
        </div>
        <Field label="FAQs" name="faqs" help="Question on the first line, answer on the next; blank line between FAQs"><Textarea id="faqs" name="faqs" rows={5} defaultValue={course?.faqs.map((f) => `${f.question}\n${f.answer}`).join("\n\n")} /></Field>
        <div>
          <input type="hidden" name="thumbnail_url" value={thumb} />
          {course ? <FileUpload kind="thumbnail" name="thumbnail_path" courseId={course.id} accept="image/png,image/jpeg,image/webp" label="Thumbnail (16:9, max 3 MB)" help={thumb ? `Current: ${thumb.split("/").pop()}` : "Upload a course thumbnail"} onUploaded={(r) => r.url && setThumb(r.url)} /> : <p className="text-[13px] text-ink-muted">You can upload a thumbnail after creating the course.</p>}
        </div>
        <div className="space-y-4 rounded-lg border border-line p-4">
          <div>
            <p className="text-sm font-semibold">30-second preview video</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">MP4 (H.264) or WebM, 1080p recommended, up to 50 MB. Shown on course cards and the course page. If empty, learners see an honest &ldquo;preview coming soon&rdquo; message.</p>
          </div>
          <input type="hidden" name="preview_video_url" value={preview} />
          <input type="hidden" name="preview_poster_url" value={poster} />
          {course ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FileUpload kind="preview" name="preview_path" courseId={course.id} accept="video/mp4,video/webm,video/quicktime" label="Preview video" help={preview ? `Current: ${preview.split("/").pop()}` : "Upload or replace the preview"} onUploaded={(r) => setPreview(r.url ?? "")} />
              <FileUpload kind="poster" name="poster_path" courseId={course.id} accept="image/png,image/jpeg,image/webp" label="Poster frame (optional)" help={poster ? `Current: ${poster.split("/").pop()}` : "Defaults to the thumbnail"} onUploaded={(r) => setPoster(r.url ?? "")} />
            </div>
          ) : <p className="text-[13px] text-ink-muted">Upload a preview after creating the course.</p>}
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Preview length (seconds)" name="preview_duration_seconds"><Input id="preview_duration_seconds" name="preview_duration_seconds" type="number" min={1} max={600} defaultValue={course?.preview_duration_seconds ?? 30} className="w-40" /></Field>
            {preview ? <button type="button" className="h-10 text-[13px] font-semibold text-red-400 hover:underline" onClick={() => { setPreview(""); setPoster(""); }}>Remove preview</button> : null}
          </div>
          {preview ? <video src={preview} poster={poster || undefined} controls preload="metadata" className="aspect-video w-full max-w-md rounded-md border border-line bg-black" /> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Projects in course" name="projects_count"><Input id="projects_count" name="projects_count" type="number" min={0} max={50} defaultValue={course?.projects_count ?? 0} /></Field>
          {base === "/admin" ? (
            <>
              <Field label="Catalogue order" name="sort_order" help="Lower numbers appear first"><Input id="sort_order" name="sort_order" type="number" min={0} defaultValue={course?.sort_order ?? 0} /></Field>
              <div className="pt-7"><Checkbox name="is_featured" defaultChecked={course?.is_featured ?? false} label="Feature on the homepage" /></div>
            </>
          ) : null}
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-sm font-semibold">Completion rules</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Checkbox name="completion_requires_all_lessons" defaultChecked={course?.completion_requires_all_lessons ?? true} label="All mandatory lessons" />
            <Checkbox name="completion_requires_assignments" defaultChecked={course?.completion_requires_assignments ?? true} label="Required assignments passed" />
            <Field label="Minimum quiz score %" name="completion_min_quiz_pct"><Input id="completion_min_quiz_pct" name="completion_min_quiz_pct" type="number" min={0} max={100} defaultValue={course?.completion_min_quiz_pct ?? ""} /></Field>
          </div>
        </div>
      </fieldset>
      {!readOnly ? <SubmitButton>{course ? "Save course" : "Create course"}</SubmitButton> : null}
    </form>
  );
}

export function ModuleForm({ base, courseId, module, nextPosition }: { base: Base; courseId: string; module?: { id: string; title: string; position: number }; nextPosition?: number }) {
  const [state, action] = useActionState<ActionState, FormData>(module ? updateModuleAction : addModuleAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      {module ? <input type="hidden" name="id" value={module.id} /> : null}
      <label className="min-w-48 flex-1"><span className="sr-only">Module title</span><Input name="title" placeholder="Module title" defaultValue={module?.title} required /></label>
      <label className="w-20"><span className="sr-only">Position</span><Input name="position" type="number" min={0} defaultValue={module?.position ?? nextPosition ?? 1} title="Position" /></label>
      <SubmitButton variant={module ? "secondary" : "primary"} size="md">{module ? "Save" : "Add module"}</SubmitButton>
      {state?.message && !state.ok ? <p className="w-full text-[12.5px] text-red-400">{state.message}</p> : null}
    </form>
  );
}

export function NewLessonForm({ base, courseId, moduleId, nextPosition }: { base: Base; courseId: string; moduleId: string; nextPosition: number }) {
  const [state, action] = useActionState<ActionState, FormData>(saveLessonAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input type="hidden" name="position" value={nextPosition} />
      <input type="hidden" name="duration_minutes" value="0" />
      <input type="hidden" name="is_mandatory" value="on" />
      <label className="min-w-48 flex-1"><span className="sr-only">Lesson title</span><Input name="title" placeholder="New lesson title" required /></label>
      <label><span className="sr-only">Type</span><Select name="type" defaultValue="video" className="w-36">
        <option value="video">Video</option><option value="text">Text</option><option value="pdf">PDF</option><option value="external">External link</option><option value="quiz">Quiz</option><option value="assignment">Assignment</option>
      </Select></label>
      <SubmitButton variant="secondary">Add lesson</SubmitButton>
      {state?.message && !state.ok ? <p className="w-full text-[12.5px] text-red-400">{state.message}</p> : null}
    </form>
  );
}

export function LessonForm({ base, lesson, modules, readOnly }: { base: Base; lesson: Lesson; modules: { id: string; title: string }[]; readOnly?: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(saveLessonAction, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="id" value={lesson.id} />
      <input type="hidden" name="course_id" value={lesson.course_id} />
      <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Title" name="title" error={e.title} required><Input id="title" name="title" defaultValue={lesson.title} /></Field>
          <Field label="Type" name="type"><Select id="type" name="type" defaultValue={lesson.type}><option value="video">Video</option><option value="text">Text</option><option value="pdf">PDF</option><option value="external">External link</option><option value="quiz">Quiz</option><option value="assignment">Assignment</option></Select></Field>
          <Field label="Module" name="module_id"><Select id="module_id" name="module_id" defaultValue={lesson.module_id}>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</Select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Video provider" name="video_provider"><Select id="video_provider" name="video_provider" defaultValue={lesson.video_provider ?? ""}><option value="">None</option><option value="mux">Mux</option><option value="cloudflare">Cloudflare Stream</option></Select></Field>
          <Field label="Playback / video ID" name="video_asset_id" error={e.video_asset_id} help="Signed playback ID (never a public URL)"><Input id="video_asset_id" name="video_asset_id" defaultValue={lesson.video_asset_id ?? ""} /></Field>
          <Field label="Duration (min)" name="duration_minutes"><Input id="duration_minutes" name="duration_minutes" type="number" min={0} defaultValue={lesson.duration_minutes} /></Field>
          <Field label="Position" name="position"><Input id="position" name="position" type="number" min={0} defaultValue={lesson.position} /></Field>
        </div>
        <Field label="External URL" name="external_url" error={e.external_url} help="For “External link” lessons; https only"><Input id="external_url" name="external_url" type="url" defaultValue={lesson.external_url ?? ""} /></Field>
        <Field label="Lesson content (Markdown)" name="content_md" help="Supports headings (#), lists, **bold**, *italic*, `code`, > quotes and [links](https://…)"><Textarea id="content_md" name="content_md" rows={10} defaultValue={lesson.content_md ?? ""} className="font-mono text-[13px]" /></Field>
        <div className="flex flex-wrap gap-6">
          <Checkbox name="is_preview" defaultChecked={lesson.is_preview} label="Free preview (visible to everyone)" />
          <Checkbox name="is_mandatory" defaultChecked={lesson.is_mandatory} label="Mandatory for completion" />
        </div>
      </fieldset>
      {!readOnly ? <SubmitButton>Save lesson</SubmitButton> : null}
    </form>
  );
}

export function ResourceForm({ base, courseId, lessonId }: { base: Base; courseId: string; lessonId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addResourceAction, null);
  const [meta, setMeta] = useState<{ mime: string; size: number } | null>(null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <input type="hidden" name="mime_type" value={meta?.mime ?? ""} />
      <input type="hidden" name="file_size" value={meta?.size ?? ""} />
      <Input name="title" placeholder="Resource title, e.g. Workbook (PDF)" required />
      <FileUpload kind="resource" name="storage_path" courseId={courseId} accept=".pdf,.png,.jpg,.jpeg,.zip,.xlsx,.docx,.pptx" label="Upload file (max 25 MB) — stored privately" onUploaded={(r) => setMeta({ mime: r.mime, size: r.size })} />
      <Input name="external_url" type="url" placeholder="…or an authorised https:// link" />
      <SubmitButton variant="secondary">Add resource</SubmitButton>
    </form>
  );
}

export function QuizForm({ base, courseId, lessonId, quiz }: { base: Base; courseId: string; lessonId: string; quiz?: { id: string; title: string; description: string | null; pass_pct: number; max_attempts: number | null; is_mandatory: boolean } | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveQuizAction, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      {quiz ? <input type="hidden" name="id" value={quiz.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Quiz title" name="title"><Input id="title" name="title" defaultValue={quiz?.title ?? "Quiz"} required /></Field>
        <Field label="Pass mark %" name="pass_pct"><Input id="pass_pct" name="pass_pct" type="number" min={0} max={100} defaultValue={quiz?.pass_pct ?? 60} /></Field>
        <Field label="Max attempts" name="max_attempts" help="Blank = unlimited"><Input id="max_attempts" name="max_attempts" type="number" min={1} defaultValue={quiz?.max_attempts ?? ""} /></Field>
      </div>
      <Field label="Description" name="description"><Input id="description" name="description" defaultValue={quiz?.description ?? ""} /></Field>
      <Checkbox name="is_mandatory" defaultChecked={quiz?.is_mandatory ?? true} label="Must pass for course completion" />
      <SubmitButton variant="secondary">{quiz ? "Save quiz settings" : "Create quiz"}</SubmitButton>
    </form>
  );
}

const Q_HELP: Record<string, { options?: string; answer: string; prompt?: string }> = {
  single: { options: "One option per line (2–8)", answer: "Number of the correct option, e.g. 2" },
  scenario: { options: "One option per line (2–8)", answer: "Number of the correct option" },
  true_false: { answer: "true or false" },
  multi: { options: "One option per line", answer: "Correct option numbers, comma-separated, e.g. 1, 3" },
  match: { options: "One pair per line: left => right (the right side is shuffled for learners)", answer: "" },
  fill_blank: { prompt: "Mark each blank with ___", answer: "One line per blank; separate accepted alternatives with |, e.g. few-shot | few shot" },
};

export function QuestionForm({ base, courseId, quizId }: { base: Base; courseId: string; quizId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addQuestionAction, null);
  const [qtype, setQtype] = useState("single");
  const e = state?.errors ?? {};
  const h = Q_HELP[qtype];
  return (
    <form action={action} className="space-y-3 rounded-lg border border-dashed border-line p-4">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="quiz_id" value={quizId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="Question type" name="qtype" error={e.qtype}>
          <Select id="qtype" name="qtype" value={qtype} onChange={(ev) => setQtype(ev.target.value)}>
            <option value="single">Multiple choice (one answer)</option><option value="multi">Multiple select</option><option value="true_false">True / false</option>
            <option value="match">Match the pairs</option><option value="fill_blank">Fill in the blank</option><option value="scenario">Scenario-based</option>
          </Select>
        </Field>
        <Field label="Points" name="points"><Input id="points" name="points" type="number" min={1} max={20} defaultValue={qtype === "single" || qtype === "true_false" || qtype === "fill_blank" ? 1 : 2} key={qtype} /></Field>
      </div>
      {qtype === "scenario" ? <Field label="Scenario" name="context" error={e.context}><Textarea id="context" name="context" rows={3} required /></Field> : null}
      <Field label="Question" name="prompt" error={e.prompt} help={h.prompt}><Input id="prompt" name="prompt" required /></Field>
      {h.options ? <Field label={qtype === "match" ? "Pairs" : "Options"} name="options" error={e.options} help={h.options}><Textarea id="options" name="options" rows={4} required /></Field> : null}
      {qtype !== "match" ? <Field label="Correct answer" name="answer" error={e.answer} help={h.answer}>{qtype === "fill_blank" ? <Textarea id="answer" name="answer" rows={2} required /> : <Input id="answer" name="answer" required />}</Field> : null}
      <Field label="Explanation (shown after passing)" name="explanation"><Input id="explanation" name="explanation" /></Field>
      <SubmitButton variant="secondary">Add question</SubmitButton>
    </form>
  );
}

const ACCEPT_OPTIONS = ["xlsx", "csv", "docx", "pdf", "pptx", "png", "jpg", "zip", "txt"] as const;
const KIND_DEFAULTS: Record<string, string[]> = { file: ["xlsx", "csv"], document: ["docx", "pdf"], practical: ["pdf", "docx", "pptx", "xlsx", "png", "jpg", "zip"], scenario: ["docx", "pdf"] };

export type EditableAssignment = {
  id: string; title: string; kind: string; summary: string | null; scenario: string | null; instructions: string; deliverables: string | null; submission_requirements: string | null;
  rubric: { criterion: string; points: number; description?: string }[]; max_score: number; pass_pct: number; accepted_types: string[]; estimated_minutes: number | null;
  is_mandatory: boolean; allow_file: boolean; allow_text: boolean; allow_links: boolean; ai_evaluation: boolean; template_name: string | null; template_path: string | null;
};

export function AssignmentForm({ base, courseId, lessonId, assignment, answerKey }: { base: Base; courseId: string; lessonId: string; assignment?: EditableAssignment | null; answerKey?: { answer_key: string; evaluator_notes: string | null } | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveAssignmentAction, null);
  const [kind, setKind] = useState(assignment?.kind ?? "practical");
  const [accepted, setAccepted] = useState<string[]>(assignment?.accepted_types ?? KIND_DEFAULTS[assignment?.kind ?? "practical"]);
  const [tpl, setTpl] = useState<{ path: string; name: string } | null>(null);
  const e = state?.errors ?? {};
  const rubricText = (assignment?.rubric ?? []).map((r) => `${r.criterion} | ${r.points} | ${r.description ?? ""}`).join("\n");
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <input type="hidden" name="accepted_types" value={accepted.join(",")} />
      {assignment ? <input type="hidden" name="id" value={assignment.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Title" name="title" error={e.title}><Input id="title" name="title" defaultValue={assignment?.title ?? ""} required /></Field>
        <Field label="Format" name="kind">
          <Select id="kind" name="kind" value={kind} onChange={(ev) => { setKind(ev.target.value); if (!assignment) setAccepted(KIND_DEFAULTS[ev.target.value]); }}>
            <option value="file">Workbook (Excel/CSV)</option><option value="document">Written (Word)</option><option value="practical">Practical project</option><option value="scenario">Scenario challenge</option>
          </Select>
        </Field>
      </div>
      <Field label="Short summary (shown on the course page)" name="summary"><Input id="summary" name="summary" defaultValue={assignment?.summary ?? ""} /></Field>
      {kind === "scenario" ? <Field label="Scenario" name="scenario"><Textarea id="scenario" name="scenario" rows={4} defaultValue={assignment?.scenario ?? ""} /></Field> : null}
      <Field label="Instructions" name="instructions" error={e.instructions}><Textarea id="instructions" name="instructions" rows={6} defaultValue={assignment?.instructions ?? ""} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deliverable" name="deliverables"><Input id="deliverables" name="deliverables" defaultValue={assignment?.deliverables ?? ""} /></Field>
        <Field label="Submission requirements" name="submission_requirements"><Input id="submission_requirements" name="submission_requirements" defaultValue={assignment?.submission_requirements ?? ""} /></Field>
      </div>
      <Field label="Rubric" name="rubric" error={e.rubric} help="One criterion per line: Criterion | points | what good looks like"><Textarea id="rubric" name="rubric" rows={5} defaultValue={rubricText} className="font-mono text-[12.5px]" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Max score" name="max_score"><Input id="max_score" name="max_score" type="number" min={1} max={1000} defaultValue={assignment?.max_score ?? 100} /></Field>
        <Field label="Pass mark %" name="pass_pct"><Input id="pass_pct" name="pass_pct" type="number" min={0} max={100} defaultValue={assignment?.pass_pct ?? 50} /></Field>
        <Field label="Estimated minutes" name="estimated_minutes"><Input id="estimated_minutes" name="estimated_minutes" type="number" min={1} defaultValue={assignment?.estimated_minutes ?? ""} /></Field>
      </div>
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold">How learners submit</legend>
        <div className="flex flex-wrap gap-5">
          <Checkbox name="allow_file" defaultChecked={assignment?.allow_file ?? true} label="File upload" />
          <Checkbox name="allow_links" defaultChecked={assignment?.allow_links ?? kind === "practical"} label="Links" />
          <Checkbox name="allow_text" defaultChecked={assignment?.allow_text ?? (kind === "scenario" || kind === "practical")} label="Written response" />
        </div>
        <p className="mt-3 text-[13px] font-medium">Accepted file types</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {ACCEPT_OPTIONS.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-[13px] text-ink-soft">
              <input type="checkbox" className="accent-violet-500" checked={accepted.includes(t)} onChange={() => setAccepted((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))} />{t.toUpperCase()}
            </label>
          ))}
        </div>
        {e.accepted_types ? <p className="mt-1 text-[12.5px] text-red-400">{e.accepted_types[0]}</p> : null}
      </fieldset>
      <div className="rounded-lg border border-line p-4">
        <p className="text-sm font-semibold">Template file</p>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">{assignment?.template_name ? `Current: ${assignment.template_name}` : "No template — learners start from scratch."}</p>
        <input type="hidden" name="template_storage_path" value={tpl?.path ?? ""} />
        <input type="hidden" name="template_file_name" value={tpl?.name ?? ""} />
        <div className="mt-3"><FileUpload kind="resource" name="_tpl" courseId={courseId} accept=".xlsx,.docx,.pptx,.csv,.pdf" label="Upload or replace template (private; only enrolled learners can download)" onUploaded={(r) => setTpl(r.path ? { path: r.path, name: r.fileName } : null)} /></div>
        {assignment?.template_path ? <div className="mt-2"><Checkbox name="remove_template" label="Remove the current template" /></div> : null}
      </div>
      <div className="rounded-lg border border-line p-4">
        <p className="text-sm font-semibold">Evaluation</p>
        <div className="mt-2"><Checkbox name="ai_evaluation" defaultChecked={assignment?.ai_evaluation ?? true} label="Evaluate with AI about 60 minutes after submission (a reviewer can override)" /></div>
        <Field className="mt-3" label="Answer key (private)" name="answer_key" help="Expected results or the points a strong answer covers. Never shown to learners."><Textarea id="answer_key" name="answer_key" rows={5} defaultValue={answerKey?.answer_key ?? ""} className="font-mono text-[12.5px]" /></Field>
        <Field className="mt-3" label="Evaluator notes (private)" name="evaluator_notes"><Textarea id="evaluator_notes" name="evaluator_notes" rows={2} defaultValue={answerKey?.evaluator_notes ?? ""} /></Field>
      </div>
      <Checkbox name="is_mandatory" defaultChecked={assignment?.is_mandatory ?? true} label="Required for course completion" />
      <SubmitButton>{assignment ? "Save assignment" : "Create assignment"}</SubmitButton>
    </form>
  );
}
