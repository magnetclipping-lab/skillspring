import { z } from "zod";

/** Server-side validation schemas. Every mutation parses its input through one of these. */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const httpsUrl = z.string().trim().url().refine((v) => v.startsWith("https://"), "Must be an https:// URL");
const optionalUrl = z.union([httpsUrl, z.literal("")]).optional().transform((v) => (v ? v : null));
const list = (max = 30, each = 200) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, max))
    .pipe(z.array(z.string().max(each)));
const csvList = (max = 30) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, max))
    .pipe(z.array(z.string().max(60)));
const checkbox = z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")]).optional().transform((v) => v === "on" || v === "true");
const rupeesToPaise = z.coerce.number().min(0).max(1_000_000).transform((r) => Math.round(r * 100));
const optionalRupeesToPaise = z
  .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
  .optional()
  .transform((r) => (r === "" || r === undefined ? null : Math.round(Number(r) * 100)));

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[a-z]/i, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const registerSchema = z.object({
  fullName: trimmed(120).min(2, "Enter your full name"),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal("on", { message: "Please accept the Terms and Privacy Policy" }),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(72) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const profileSchema = z.object({
  full_name: trimmed(120).min(2, "Enter your full name"),
  phone: z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/, "Enter a valid phone number")]).optional().transform((v) => (v ? v : null)),
  college: optionalText(200),
  degree: optionalText(120),
  graduation_year: z.union([z.literal(""), z.coerce.number().int().min(1980).max(2100)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  skills: csvList(25),
  bio: optionalText(2000),
});

export const contactSchema = z.object({
  topic: z.enum(["general", "support", "partner", "instructor", "employer", "refund"]),
  name: trimmed(120).min(1, "Enter your name"),
  email: emailSchema,
  organisation: optionalText(200),
  message: trimmed(5000).min(10, "Please write at least 10 characters"),
  website: z.string().max(0).optional(), // honeypot
});

export const instructorApplicationSchema = z.object({
  display_name: trimmed(120).min(2),
  headline: trimmed(200).min(5, "Add a short headline"),
  bio: trimmed(4000).min(50, "Tell us a little more (at least 50 characters)"),
  expertise: csvList(15),
  website: optionalUrl,
  linkedin_url: optionalUrl,
  rights_confirmation: z.literal("on", { message: "Please confirm you own or are licensed to teach your material" }),
});

export const courseSchema = z
  .object({
    title: trimmed(160).min(3),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").max(80),
    subtitle: optionalText(240),
    description: trimmed(10000).min(20, "Add a description of at least 20 characters"),
    category_id: z.string().uuid().or(z.literal("")).transform((v) => (v ? v : null)),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    language: trimmed(40).min(2),
    price: rupeesToPaise,
    discount_price: optionalRupeesToPaise,
    discount_ends_at: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
    duration_minutes: z.coerce.number().int().min(0).max(100000),
    learning_outcomes: list(20),
    requirements: list(15),
    thumbnail_url: z.union([z.literal(""), z.string().trim().max(500).refine((v) => v.startsWith("/") || v.startsWith("https://"), "Use a relative path or https URL")]).optional().transform((v) => (v ? v : null)),
    preview_video_url: z.union([z.literal(""), z.string().trim().max(800).regex(/^https:\/\//, "Use an https URL")]).optional().transform((v) => (v ? v : null)),
    preview_poster_url: z.union([z.literal(""), z.string().trim().max(800).regex(/^https:\/\//, "Use an https URL")]).optional().transform((v) => (v ? v : null)),
    preview_duration_seconds: z.union([z.literal(""), z.coerce.number().int().min(1).max(600)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    projects_count: z.coerce.number().int().min(0).max(50).optional().default(0),
    is_featured: checkbox,
    sort_order: z.coerce.number().int().min(0).max(10000).optional().default(0),
    completion_requires_all_lessons: checkbox,
    completion_requires_assignments: checkbox,
    completion_min_quiz_pct: z.union([z.literal(""), z.coerce.number().int().min(0).max(100)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    faqs: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(/\n\s*\n/)
          .map((block) => {
            const [question, ...rest] = block.split("\n");
            return { question: (question ?? "").replace(/^Q:\s*/i, "").trim(), answer: rest.join(" ").replace(/^A:\s*/i, "").trim() };
          })
          .filter((f) => f.question && f.answer)
          .slice(0, 20),
      ),
  })
  .refine((v) => v.discount_price === null || v.discount_price < v.price, { message: "Discount must be lower than the price", path: ["discount_price"] });

export const moduleSchema = z.object({ title: trimmed(160).min(1), description: optionalText(1000), position: z.coerce.number().int().min(0).max(1000) });

export const lessonSchema = z.object({
  module_id: z.string().uuid(),
  title: trimmed(160).min(1),
  type: z.enum(["video", "text", "pdf", "external", "assignment", "quiz"]),
  content_md: optionalText(50000),
  video_provider: z.enum(["mux", "cloudflare", ""]).optional().transform((v) => (v ? v : null)),
  video_asset_id: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z0-9_\-]{6,128}$/, "Invalid video ID")]).optional().transform((v) => (v ? v : null)),
  external_url: optionalUrl,
  duration_minutes: z.coerce.number().int().min(0).max(1000),
  position: z.coerce.number().int().min(0).max(1000),
  is_preview: checkbox,
  is_mandatory: checkbox,
});

export const quizSchema = z.object({
  title: trimmed(160).min(1),
  description: optionalText(1000),
  lesson_id: z.string().uuid().or(z.literal("")).transform((v) => (v ? v : null)),
  pass_pct: z.coerce.number().int().min(0).max(100),
  max_attempts: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  is_mandatory: checkbox,
});

/**
 * Quiz question authoring. Answers are entered in plain text and converted to the stored shape:
 *  single / scenario : options (one per line) + correct option number
 *  true_false        : correct = "true" | "false"
 *  multi             : options + correct option numbers, comma-separated (e.g. "1, 3")
 *  match             : pairs, one per line, "left => right" (right side is shuffled for learners)
 *  fill_blank        : prompt with ___ per blank; answers one line per blank, alternatives separated by |
 */
export const QUESTION_TYPES = ["single", "multi", "true_false", "match", "fill_blank", "scenario"] as const;
export type QuestionInput = {
  qtype: (typeof QUESTION_TYPES)[number]; prompt: string; context: string | null; explanation: string | null; points: number;
  options: string[] | { left: string[]; right: string[] } | null; correct_index: number | null; correct: unknown;
};
const lines = (v: unknown) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

export function parseQuestion(raw: Record<string, unknown>, shuffle: (n: number) => number[] = (n) => [...Array(n).keys()].sort(() => Math.random() - 0.5)):
  { ok: true; data: QuestionInput } | { ok: false; errors: Record<string, string[]> } {
  const qtype = String(raw.qtype ?? "single") as QuestionInput["qtype"];
  const errors: Record<string, string[]> = {};
  const fail = (k: string, m: string) => ((errors[k] ??= []).push(m), null);
  if (!QUESTION_TYPES.includes(qtype)) fail("qtype", "Choose a question type");
  const prompt = String(raw.prompt ?? "").trim().slice(0, 1000);
  if (prompt.length < 3) fail("prompt", "Write the question");
  const context = String(raw.context ?? "").trim().slice(0, 2000) || null;
  const explanation = String(raw.explanation ?? "").trim().slice(0, 1000) || null;
  const points = Math.min(20, Math.max(1, Number(raw.points ?? 1) || 1));
  let options: QuestionInput["options"] = null;
  let correct_index: number | null = null;
  let correct: unknown = null;
  const opts = lines(raw.options).slice(0, 10).map((o) => o.slice(0, 300));
  const answer = String(raw.answer ?? "").trim();
  if (qtype === "single" || qtype === "scenario") {
    if (opts.length < 2 || opts.length > 8) fail("options", "Add 2–8 options, one per line");
    const n = Number(answer);
    if (!Number.isInteger(n) || n < 1 || n > opts.length) fail("answer", "Enter the number of the correct option");
    options = opts; correct_index = n - 1;
    if (qtype === "scenario" && !context) fail("context", "Describe the scenario");
  } else if (qtype === "true_false") {
    if (!["true", "false"].includes(answer.toLowerCase())) fail("answer", "Enter true or false");
    options = ["True", "False"]; correct_index = answer.toLowerCase() === "true" ? 0 : 1;
  } else if (qtype === "multi") {
    if (opts.length < 2) fail("options", "Add at least 2 options, one per line");
    const nums = answer.split(/[,\s]+/).filter(Boolean).map(Number);
    if (!nums.length || nums.some((x) => !Number.isInteger(x) || x < 1 || x > opts.length)) fail("answer", "List the correct option numbers, e.g. 1, 3");
    options = opts; correct = [...new Set(nums.map((x) => x - 1))].sort((a, b) => a - b);
  } else if (qtype === "match") {
    const pairs = opts.map((l) => l.split("=>").map((x) => x.trim()));
    if (pairs.length < 2 || pairs.some((p) => p.length !== 2 || !p[0] || !p[1])) fail("options", "Write 2 or more pairs, one per line: left => right");
    const left = pairs.map((p) => p[0]);
    const rightOrdered = pairs.map((p) => p[1]);
    const order = shuffle(rightOrdered.length);
    const right = order.map((i) => rightOrdered[i]);
    options = { left, right }; correct = left.map((_, i) => order.indexOf(i));
  } else if (qtype === "fill_blank") {
    const blanks = (prompt.match(/_{3,}/g) ?? []).length;
    const accepted = lines(raw.answer).map((l) => l.split("|").map((x) => x.trim()).filter(Boolean));
    if (!blanks) fail("prompt", "Mark each blank with ___");
    if (accepted.length !== blanks || accepted.some((a) => !a.length)) fail("answer", `Give one line of accepted answers per blank (${blanks} blank${blanks === 1 ? "" : "s"})`);
    correct = accepted;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { qtype, prompt, context, explanation, points, options, correct_index, correct } };
}

const ASSIGNMENT_KINDS = ["file", "document", "practical", "scenario"] as const;
const ACCEPTED = ["xlsx", "csv", "docx", "pdf", "pptx", "png", "jpg", "zip", "txt"] as const;

/** Rubric lines: "Criterion | points | what good looks like". */
export function parseRubric(v: unknown) {
  return lines(v).slice(0, 12).map((l) => {
    const [criterion, points, ...desc] = l.split("|").map((x) => x.trim());
    return { criterion: (criterion ?? "").slice(0, 120), points: Number(points), description: desc.join(" | ").slice(0, 500) };
  });
}

export const assignmentSchema = z
  .object({
    title: trimmed(160).min(1),
    kind: z.enum(ASSIGNMENT_KINDS),
    summary: optionalText(600),
    scenario: optionalText(4000),
    instructions: trimmed(10000).min(5),
    deliverables: optionalText(1000),
    submission_requirements: optionalText(1000),
    rubric: z.string().optional().transform(parseRubric),
    max_score: z.coerce.number().int().min(1).max(1000),
    pass_pct: z.coerce.number().int().min(0).max(100),
    accepted_types: z.string().optional().transform((v) => (v ?? "").split(",").map((x) => x.trim()).filter((x): x is (typeof ACCEPTED)[number] => (ACCEPTED as readonly string[]).includes(x))),
    estimated_minutes: z.union([z.literal(""), z.coerce.number().int().min(1).max(10000)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    lesson_id: z.string().uuid().or(z.literal("")).transform((v) => (v ? v : null)),
    is_mandatory: checkbox,
    allow_file: checkbox,
    allow_text: checkbox,
    allow_links: checkbox,
    ai_evaluation: checkbox,
    answer_key: optionalText(20000),
    evaluator_notes: optionalText(4000),
  })
  .refine((v) => v.rubric.every((r) => r.criterion && Number.isInteger(r.points) && r.points > 0), { message: "Each rubric line needs: criterion | points | description", path: ["rubric"] })
  .refine((v) => !v.ai_evaluation || v.rubric.length > 0, { message: "Add a rubric (required for AI evaluation)", path: ["rubric"] })
  .refine((v) => v.allow_file || v.allow_text || v.allow_links, { message: "Allow at least one way to submit", path: ["allow_file"] })
  .refine((v) => !v.allow_file || v.accepted_types.length > 0, { message: "Choose at least one accepted file type", path: ["accepted_types"] });

export const reviewOverrideSchema = z.object({
  submission_id: z.string().uuid(),
  score: z.coerce.number().min(0).max(1000),
  feedback: trimmed(4000).min(5, "Add feedback for the learner"),
});

export const submissionSchema = z.object({
  assignment_id: z.string().uuid(),
  text_response: optionalText(20000),
  file_path: z.string().max(500).optional().transform((v) => (v ? v : null)),
  file_name: z.string().max(200).optional().transform((v) => (v ? v.replace(/[\\/\u0000-\u001f]/g, "_") : null)),
  links: z
    .string()
    .max(2500)
    .optional()
    .transform((v) => (v ? v.split(/\s+/).map((x) => x.trim()).filter(Boolean) : []))
    .pipe(z.array(z.string().url().regex(/^https:\/\//, "Links must start with https://").max(500)).max(5, "Add at most 5 links")),
});

/** Quiz answers: single/true-false/scenario → index; multi/match → indices; fill-in-the-blank → strings. */
export const quizAnswerSchema = z.union([
  z.number().int().min(0).max(9),
  z.array(z.number().int().min(0).max(9)).max(10),
  z.array(z.string().max(200)).max(10),
]);

export const reviewSchema = z.object({
  course_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: optionalText(2000),
});

export const refundSchema = z.object({
  payment_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(1_000_000).transform((r) => Math.round(r * 100)),
  reason: trimmed(300).min(3),
});

export const employerSchema = z.object({
  name: trimmed(160).min(2),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  website: optionalUrl,
  description: optionalText(4000),
  industry: optionalText(120),
  location: optionalText(120),
});

export const payoutSchema = z.object({
  instructor_id: z.string().uuid(),
  amount: z.coerce.number().positive().transform((r) => Math.round(r * 100)),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: optionalText(200),
  notes: optionalText(1000),
});

export type FieldErrors = Record<string, string[] | undefined>;

export function formDataToObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

export const ambassadorSchema = z.object({
  full_name: trimmed(120).min(2, "Enter your full name"),
  email: emailSchema,
  phone: z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/, "Enter a valid phone number"),
  college: trimmed(200).min(2, "Enter your college"),
  city: trimmed(120).min(2, "Enter your city"),
  course_and_year: trimmed(120).min(2, "For example, B.Com 2nd year"),
  social_url: z
    .union([z.string().trim().url("Enter a full link starting with https://").refine((v) => /^https?:\/\//.test(v), "Enter a full link starting with https://"), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  motivation: trimmed(2000).min(30, "Tell us a little more (at least 30 characters)"),
  consent: z.literal("on", { message: "Please confirm so we can contact you" }),
  website: z.string().max(0).optional(), // honeypot
});

export const ambassadorReviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["applied", "shortlisted", "active", "rejected", "inactive"]),
  admin_notes: optionalText(2000),
});
