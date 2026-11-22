// Hand-maintained row types mirroring supabase/migrations. Regenerate with
// `supabase gen types typescript` once a project is linked, if preferred.

export type AppRole = "student" | "instructor" | "admin";
export type CourseStatus = "draft" | "pending_review" | "changes_requested" | "approved" | "published" | "archived";
export type RightsStatus = "pending" | "owned" | "licensed" | "instructor_owned" | "rejected";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type LessonType = "video" | "text" | "pdf" | "external" | "assignment" | "quiz";
export type ApplicationStatus = "submitted" | "under_review" | "shortlisted" | "interview_scheduled" | "selected" | "rejected" | "withdrawn";
export type InternshipKind = "employer" | "simulation" | "project";
export type WorkMode = "remote" | "hybrid" | "onsite";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  college: string | null;
  degree: string | null;
  graduation_year: number | null;
  skills: string[];
  bio: string | null;
  is_suspended: boolean;
  suspended_reason: string | null;
  created_at: string;
};

export type InstructorProfile = {
  id: string;
  user_id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  expertise: string[];
  website: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  default_revenue_share_pct: number;
  review_notes: string | null;
  created_at: string;
};

export type Category = { id: string; slug: string; name: string; description: string | null; icon: string | null; sort_order: number };

export type CourseFaq = { question: string; answer: string };

export type Course = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  category_id: string | null;
  instructor_id: string | null;
  thumbnail_url: string | null;
  price_paise: number;
  discount_price_paise: number | null;
  discount_ends_at: string | null;
  level: CourseLevel;
  language: string;
  duration_minutes: number;
  learning_outcomes: string[];
  requirements: string[];
  faqs: CourseFaq[];
  status: CourseStatus;
  rights_status: RightsStatus;
  rights_notes: string | null;
  is_demo: boolean;
  completion_requires_all_lessons: boolean;
  completion_requires_assignments: boolean;
  completion_min_quiz_pct: number | null;
  review_notes: string | null;
  submitted_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseWithRelations = Course & {
  category: Pick<Category, "slug" | "name"> | null;
  instructor: Pick<InstructorProfile, "id" | "display_name" | "headline" | "bio" | "avatar_url" | "expertise"> | null;
};

export type OutlineRow = {
  module_id: string;
  module_title: string;
  module_position: number;
  lesson_id: string | null;
  lesson_title: string | null;
  lesson_type: LessonType | null;
  duration_minutes: number | null;
  lesson_position: number | null;
  is_preview: boolean | null;
  is_mandatory: boolean | null;
};

export type OutlineModule = {
  id: string;
  title: string;
  lessons: { id: string; title: string; type: LessonType; duration_minutes: number; is_preview: boolean; is_mandatory: boolean }[];
};

export type Lesson = {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  type: LessonType;
  content_md: string | null;
  video_provider: "mux" | "cloudflare" | null;
  video_asset_id: string | null;
  external_url: string | null;
  duration_minutes: number;
  position: number;
  is_preview: boolean;
  is_mandatory: boolean;
};

export type Internship = {
  id: string;
  slug: string;
  title: string;
  employer_id: string | null;
  kind: InternshipKind;
  description: string;
  responsibilities: string[];
  skills: string[];
  eligibility: string | null;
  location: string | null;
  work_mode: WorkMode;
  duration_weeks: number | null;
  is_paid: boolean;
  stipend_min_inr: number | null;
  stipend_max_inr: number | null;
  stipend_notes: string | null;
  deadline: string | null;
  positions: number | null;
  status: "draft" | "open" | "closed" | "archived";
  is_demo: boolean;
  created_at: string;
  employer?: { name: string; slug: string; website: string | null; logo_url: string | null; status: string } | null;
};

export type ProgressSummary = { total: number; completed: number; mandatory_total: number; mandatory_completed: number; percent: number };

export type CompletionStatus = {
  eligible: boolean;
  lessons: { ok: boolean; done: number; required: number };
  assignments: { ok: boolean; done: number; required: number };
  quizzes: { ok: boolean; passed: number; required: number; min_pct: number | null };
};
