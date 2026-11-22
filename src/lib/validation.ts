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

export const questionSchema = z
  .object({
    prompt: trimmed(1000).min(3),
    options: list(8, 300),
    correct_index: z.coerce.number().int().min(0).max(7),
    explanation: optionalText(1000),
  })
  .refine((v) => v.options.length >= 2, { message: "Add at least two options (one per line)", path: ["options"] })
  .refine((v) => v.correct_index < v.options.length, { message: "Correct option number is out of range", path: ["correct_index"] });

export const assignmentSchema = z.object({
  title: trimmed(160).min(1),
  instructions: trimmed(10000).min(5),
  lesson_id: z.string().uuid().or(z.literal("")).transform((v) => (v ? v : null)),
  is_mandatory: checkbox,
  allow_file: checkbox,
});

export const submissionSchema = z.object({
  assignment_id: z.string().uuid(),
  text_response: optionalText(20000),
  file_path: z.string().max(500).optional().transform((v) => (v ? v : null)),
});

export const internshipSchema = z
  .object({
    title: trimmed(160).min(3),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
    kind: z.enum(["employer", "simulation", "project"]),
    employer_id: z.string().uuid().or(z.literal("")).transform((v) => (v ? v : null)),
    description: trimmed(10000).min(20),
    responsibilities: list(20),
    skills: csvList(20),
    eligibility: optionalText(1000),
    location: optionalText(120),
    work_mode: z.enum(["remote", "hybrid", "onsite"]),
    duration_weeks: z.union([z.literal(""), z.coerce.number().int().min(1).max(104)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    is_paid: checkbox,
    stipend_min_inr: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    stipend_max_inr: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    stipend_notes: optionalText(300),
    deadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => (v ? v : null)),
    positions: z.union([z.literal(""), z.coerce.number().int().min(1).max(10000)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    status: z.enum(["draft", "open", "closed", "archived"]),
  })
  .refine((v) => v.kind !== "employer" || v.employer_id, { message: "Employer internships must be linked to a verified employer", path: ["employer_id"] });

export const applicationSchema = z.object({
  internship_id: z.string().uuid(),
  cover_letter: trimmed(5000).min(30, "Write at least 30 characters about why you're a good fit"),
  phone: z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/, "Enter a valid phone number")]).optional().transform((v) => (v ? v : null)),
  portfolio_url: z.union([z.literal(""), z.string().trim().url().regex(/^https?:\/\//)]).optional().transform((v) => (v ? v : null)),
  resume_path: z.string().max(500).optional().transform((v) => (v ? v : null)),
});

export const applicationStatusSchema = z.object({
  application_id: z.string().uuid(),
  status: z.enum(["submitted", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected"]),
  note: optionalText(1000),
});

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
