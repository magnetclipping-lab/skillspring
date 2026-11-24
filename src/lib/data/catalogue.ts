import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import catalogueJson from "@/lib/catalogue/catalogue.json";
import type { AssignmentKind, Category, CourseWithRelations, OutlineModule, OutlineRow } from "@/lib/types";

/**
 * Public catalogue reads. The database is the source of truth (RLS applies).
 * When Supabase is not configured (local preview without credentials), the
 * generated catalogue (src/lib/catalogue/catalogue.json, built by
 * scripts/catalogue/build.py from the same content as the seed migration) is used.
 */

export type CatalogueQuery = { q?: string; category?: string; level?: string; sort?: string };

export type CourseCardData = CourseWithRelations & {
  avg_rating: number | null;
  review_count: number;
  enrolment_count: number;
  effective_price: number;
  module_count: number;
};

export type AssignmentSummary = { id: string; title: string; kind: AssignmentKind; summary: string | null; estimated_minutes: number | null };

const COURSE_SELECT =
  "*, category:categories(slug, name, accent), instructor:instructor_profiles(id, display_name, headline, bio, avatar_url, expertise), modules:course_modules(count)";

export function effectivePrice(c: { price_paise: number; discount_price_paise: number | null; discount_ends_at: string | null }) {
  if (c.discount_price_paise != null && (!c.discount_ends_at || new Date(c.discount_ends_at) > new Date())) return c.discount_price_paise;
  return c.price_paise;
}

// ---------------------------------------------------------------------------
// Preview-mode data (generated catalogue)
// ---------------------------------------------------------------------------
type JsonCategory = { slug: string; name: string; description: string; tagline: string; accent: string; icon: string; sort_order: number; is_public?: boolean };
type JsonCourse = {
  id: string; slug: string; title: string; subtitle: string; description: string; level: CourseCardData["level"]; outcomes: string[]; requirements: string[];
  category: string; price_paise: number; duration_minutes: number; projects_count: number; is_featured: boolean; sort_order: number; thumbnail_url: string;
  faqs: { question: string; answer: string }[];
  modules: { title: string; lessons: { title: string; type: string; minutes: number; preview: boolean }[] }[];
  assignments: { title: string; kind: AssignmentKind; summary: string; module: number; minutes: number }[];
  quiz_questions: number;
};
const CATALOGUE = catalogueJson as unknown as { categories: JsonCategory[]; courses: JsonCourse[] };

const previewCategories: Category[] = CATALOGUE.categories.map((c) => ({
  id: `preview-cat-${c.slug}`, slug: c.slug, name: c.name, description: c.description, icon: c.icon, sort_order: c.sort_order,
  is_public: c.is_public !== false, tagline: c.tagline, accent: c.accent,
}));

function previewCourses(): CourseCardData[] {
  const now = new Date().toISOString();
  return CATALOGUE.courses.map((c) => {
    const cat = previewCategories.find((x) => x.slug === c.category)!;
    return {
      id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle, description: c.description, category_id: cat.id, instructor_id: null,
      thumbnail_url: c.thumbnail_url, price_paise: c.price_paise, discount_price_paise: null, discount_ends_at: null, level: c.level,
      language: "English", duration_minutes: c.duration_minutes, learning_outcomes: c.outcomes, requirements: c.requirements, faqs: c.faqs,
      status: "published", rights_status: "owned", rights_notes: null, is_demo: false, completion_requires_all_lessons: false,
      completion_requires_assignments: true, completion_min_quiz_pct: 60, review_notes: null, submitted_at: null, published_at: now,
      created_at: now, updated_at: now, preview_video_url: null, preview_poster_url: null, preview_duration_seconds: null,
      projects_count: c.projects_count, is_featured: c.is_featured, sort_order: c.sort_order,
      category: { slug: cat.slug, name: cat.name, accent: cat.accent ?? null }, instructor: null, avg_rating: null, review_count: 0,
      enrolment_count: 0, effective_price: c.price_paise, module_count: c.modules.length,
    };
  });
}

function previewOutline(slug: string): OutlineModule[] {
  const c = CATALOGUE.courses.find((x) => x.slug === slug);
  if (!c) return [];
  return c.modules.map((m, mi) => ({
    id: `pm-${mi}`,
    title: m.title,
    lessons: [
      ...m.lessons.map((l, li) => ({ id: `pl-${mi}-${li}`, title: l.title, type: "text" as const, duration_minutes: l.minutes, is_preview: l.preview, is_mandatory: true })),
      ...c.assignments.filter((a) => a.module === mi).map((a, ai) => ({ id: `pa-${mi}-${ai}`, title: a.title, type: "assignment" as const, duration_minutes: a.minutes, is_preview: false, is_mandatory: true })),
      ...(mi === c.modules.length - 1 ? [{ id: `pq-${mi}`, title: "Course knowledge check", type: "quiz" as const, duration_minutes: 15, is_preview: false, is_mandatory: true }] : []),
    ],
  }));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
/** Public categories (roadmap categories such as Financial Markets are hidden). */
export async function getCategories(opts: { includeHidden?: boolean } = {}): Promise<Category[]> {
  let list: Category[];
  if (!isSupabaseConfigured()) list = previewCategories;
  else {
    const supabase = await createClient();
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    list = (data ?? []) as Category[];
  }
  return opts.includeHidden ? list : list.filter((c) => c.is_public !== false);
}

type CourseRow = CourseWithRelations & { modules?: { count: number }[] };

async function decorate(rows: CourseRow[]): Promise<CourseCardData[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const [{ data: stats }, { data: counts }] = await Promise.all([supabase.rpc("course_review_stats"), supabase.rpc("course_enrolment_counts")]);
  const s = new Map(((stats ?? []) as { course_id: string; review_count: number; avg_rating: number }[]).map((r) => [r.course_id, r]));
  const n = new Map(((counts ?? []) as { course_id: string; enrolment_count: number }[]).map((r) => [r.course_id, r.enrolment_count]));
  return rows.map(({ modules, ...c }) => ({
    ...c,
    avg_rating: s.get(c.id)?.avg_rating != null ? Number(s.get(c.id)!.avg_rating) : null,
    review_count: s.get(c.id)?.review_count ?? 0,
    enrolment_count: n.get(c.id) ?? 0,
    effective_price: effectivePrice(c),
    module_count: modules?.[0]?.count ?? 0,
  }));
}

export function filterAndSort(courses: CourseCardData[], q: CatalogueQuery) {
  let list = courses;
  if (q.q) {
    const needle = q.q.toLowerCase();
    list = list.filter((c) => [c.title, c.subtitle, c.description, c.category?.name].join(" ").toLowerCase().includes(needle));
  }
  if (q.category) list = list.filter((c) => c.category?.slug === q.category);
  if (q.level) list = list.filter((c) => c.level === q.level);
  const sorted = [...list];
  switch (q.sort) {
    case "popular":
      sorted.sort((a, b) => b.enrolment_count - a.enrolment_count || (a.sort_order ?? 0) - (b.sort_order ?? 0));
      break;
    case "newest":
      sorted.sort((a, b) => +new Date(b.published_at ?? b.created_at) - +new Date(a.published_at ?? a.created_at));
      break;
    default: // curated order set in Admin
      sorted.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.title.localeCompare(b.title));
  }
  return sorted;
}

export async function getPublishedCourses(q: CatalogueQuery = {}): Promise<CourseCardData[]> {
  if (!isSupabaseConfigured()) return filterAndSort(previewCourses(), q);
  const supabase = await createClient();
  let query = supabase.from("courses").select(COURSE_SELECT).eq("status", "published");
  if (q.q) {
    const terms = q.q.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean).slice(0, 8);
    if (terms.length) query = query.textSearch("search", terms.map((t) => `${t}:*`).join(" & "), { config: "simple" });
  }
  const { data } = await query.limit(200);
  return filterAndSort(await decorate((data ?? []) as CourseRow[]), { ...q, q: undefined });
}

export async function getFeaturedCourses(limit = 6) {
  const all = await getPublishedCourses();
  const featured = all.filter((c) => c.is_featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export async function getCourseBySlug(slug: string): Promise<CourseCardData | null> {
  if (!isSupabaseConfigured()) return previewCourses().find((c) => c.slug === slug) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(COURSE_SELECT).eq("slug", slug).maybeSingle();
  if (!data) return null;
  return (await decorate([data as CourseRow]))[0];
}

/** Assignment titles and types for the public course page (never instructions, rubrics or keys). */
export async function getCourseAssignmentSummaries(course: { id: string; slug: string }): Promise<AssignmentSummary[]> {
  if (!isSupabaseConfigured()) {
    const c = CATALOGUE.courses.find((x) => x.slug === course.slug);
    return (c?.assignments ?? []).map((a, i) => ({ id: `pa-${i}`, title: a.title, kind: a.kind, summary: a.summary, estimated_minutes: a.minutes }));
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_course_assignment_summaries", { p_course_id: course.id });
  return (data ?? []) as AssignmentSummary[];
}

export function groupOutline(rows: OutlineRow[]): OutlineModule[] {
  const map = new Map<string, OutlineModule>();
  for (const r of rows) {
    if (!map.has(r.module_id)) map.set(r.module_id, { id: r.module_id, title: r.module_title, lessons: [] });
    if (r.lesson_id) {
      map.get(r.module_id)!.lessons.push({
        id: r.lesson_id, title: r.lesson_title ?? "", type: r.lesson_type ?? "text",
        duration_minutes: r.duration_minutes ?? 0, is_preview: Boolean(r.is_preview), is_mandatory: r.is_mandatory ?? true,
      });
    }
  }
  return [...map.values()];
}

export async function getCourseOutline(course: { id: string; slug: string }): Promise<OutlineModule[]> {
  if (!isSupabaseConfigured()) return previewOutline(course.slug);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_course_outline", { p_course_id: course.id });
  return groupOutline((data ?? []) as OutlineRow[]);
}

export async function getCourseReviews(courseId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select("id, rating, comment, created_at, user_id").eq("course_id", courseId).eq("is_published", true).order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as { id: string; rating: number; comment: string | null; created_at: string; user_id: string }[];
}

/** Published, approved instructors. Empty until real people are added in Admin → Instructors. */
export async function getPublicInstructors() {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("instructor_profiles").select("id, display_name, headline, bio, avatar_url, expertise").eq("status", "approved").limit(12);
  return (data ?? []) as { id: string; display_name: string; headline: string | null; bio: string | null; avatar_url: string | null; expertise: string[] | null }[];
}

/** Whether a course can be bought right now (mirrors public.course_is_purchasable). */
export function isPurchasable(c: { status: string; is_demo: boolean; rights_status: string }) {
  return c.status === "published" && !c.is_demo && ["owned", "licensed", "instructor_owned"].includes(c.rights_status);
}

/** Real, published learner reviews with a written comment (rating ≥ 4). Empty until learners post them. */
export async function getTestimonials(limit = 6) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, course:courses(slug, title)")
    .eq("is_published", true)
    .gte("rating", 4)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as { id: string; rating: number; comment: string; created_at: string; course: { slug: string; title: string } | null }[])
    .filter((r) => r.comment.trim().length >= 40);
}
