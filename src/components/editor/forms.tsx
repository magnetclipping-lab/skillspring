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
          <Field label="Price (₹)" name="price" error={e.price} required help={base === "/instructor" ? "Final pricing is confirmed by SkillSpring" : undefined}><Input id="price" name="price" type="number" min={0} step="1" defaultValue={rupees(course?.price_paise) || "0"} /></Field>
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
        <div className="rounded-xl border border-line bg-slate-50/50 p-4">
          <p className="text-sm font-semibold">Completion rules</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Checkbox name="completion_requires_all_lessons" defaultChecked={course?.completion_requires_all_lessons ?? true} label="All mandatory lessons" />
            <Checkbox name="completion_requires_assignments" defaultChecked={course?.completion_requires_assignments ?? true} label="Required assignments submitted" />
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
      {state?.message && !state.ok ? <p className="w-full text-[12.5px] text-red-600">{state.message}</p> : null}
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
      {state?.message && !state.ok ? <p className="w-full text-[12.5px] text-red-600">{state.message}</p> : null}
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
      <Checkbox name="is_mandatory" defaultChecked={quiz?.is_mandatory ?? true} label="Must pass for certificate" />
      <SubmitButton variant="secondary">{quiz ? "Save quiz settings" : "Create quiz"}</SubmitButton>
    </form>
  );
}

export function QuestionForm({ base, courseId, quizId }: { base: Base; courseId: string; quizId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addQuestionAction, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3 rounded-xl border border-dashed border-line p-4">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="quiz_id" value={quizId} />
      <Field label="Question" name="prompt" error={e.prompt}><Input id="prompt" name="prompt" required /></Field>
      <Field label="Options" name="options" error={e.options} help="One option per line (2–8)"><Textarea id="options" name="options" rows={4} required /></Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Correct option #" name="correct_index" error={e.correct_index}><Input id="correct_index" name="correct_index" type="number" min={1} max={8} defaultValue={1} /></Field>
        <Field label="Explanation (shown after passing)" name="explanation"><Input id="explanation" name="explanation" /></Field>
      </div>
      <SubmitButton variant="secondary">Add question</SubmitButton>
    </form>
  );
}

export function AssignmentForm({ base, courseId, lessonId, assignment }: { base: Base; courseId: string; lessonId: string; assignment?: { id: string; title: string; instructions: string; is_mandatory: boolean; allow_file: boolean } | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveAssignmentAction, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      {assignment ? <input type="hidden" name="id" value={assignment.id} /> : null}
      <Field label="Assignment title" name="title"><Input id="title" name="title" defaultValue={assignment?.title ?? ""} required /></Field>
      <Field label="Instructions" name="instructions"><Textarea id="instructions" name="instructions" rows={5} defaultValue={assignment?.instructions ?? ""} required /></Field>
      <div className="flex flex-wrap gap-6">
        <Checkbox name="is_mandatory" defaultChecked={assignment?.is_mandatory ?? true} label="Required for certificate" />
        <Checkbox name="allow_file" defaultChecked={assignment?.allow_file ?? true} label="Allow file upload" />
      </div>
      <SubmitButton variant="secondary">{assignment ? "Save assignment" : "Create assignment"}</SubmitButton>
    </form>
  );
}
