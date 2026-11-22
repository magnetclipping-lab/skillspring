import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { demoCategories, demoCourses, demoInternships, courseDurationMinutes } from "@/lib/demo/seed-data";
import type { Category, CourseWithRelations, Internship, OutlineModule, OutlineRow } from "@/lib/types";

/**
 * Public catalogue reads. Uses Supabase (anon/user session, RLS applies).
 * When Supabase is not configured (local preview without credentials), the
 * same demo seed data is rendered so the public site can be reviewed.
 */

export type CatalogueQuery = { q?: string; category?: string; level?: string; price?: string; sort?: string };

export type CourseCardData = CourseWithRelations & { avg_rating: number | null; review_count: number; enrolment_count: number; effective_price: number };

const COURSE_SELECT = "*, category:categories(slug, name), instructor:instructor_profiles(id, display_name, headline, bio, avatar_url, expertise)";

function effectivePrice(c: { price_paise: number; discount_price_paise: number | null; discount_ends_at: string | null }) {
  if (c.discount_price_paise != null && (!c.discount_ends_at || new Date(c.discount_ends_at) > new Date())) return c.discount_price_paise;
  return c.price_paise;
}

// ---------------------------------------------------------------------------
// Preview-mode data
// ---------------------------------------------------------------------------
const previewCategories: Category[] = demoCategories.map((c, i) => ({ id: `preview-cat-${i}`, slug: c.slug, name: c.name, description: c.description, icon: c.icon, sort_order: c.sort }));

function previewCourses(): CourseCardData[] {
  const now = new Date().toISOString();
  return demoCourses.map((c, i) => {
    const cat = previewCategories.find((x) => x.slug === c.category)!;
    return {
      id: `preview-course-${i}`, slug: c.slug, title: c.title, subtitle: c.subtitle, description: c.description,
      category_id: cat.id, instructor_id: null, thumbnail_url: `/thumbnails/${c.slug}.svg`, price_paise: c.pricePaise,
      discount_price_paise: null, discount_ends_at: null, level: c.level, language: c.language,
      duration_minutes: courseDurationMinutes(c), learning_outcomes: c.outcomes, requirements: c.requirements,
      faqs: c.faqs.map((f) => ({ question: f.q, answer: f.a })), status: "published", rights_status: "pending",
      rights_notes: null, is_demo: true, completion_requires_all_lessons: true, completion_requires_assignments: true,
      completion_min_quiz_pct: null, review_notes: null, submitted_at: null, published_at: now, created_at: new Date(Date.now() - i * 86400000).toISOString(), updated_at: now,
      category: { slug: cat.slug, name: cat.name }, instructor: null, avg_rating: null, review_count: 0, enrolment_count: 0,
      effective_price: c.pricePaise,
    };
  });
}

function previewOutline(slug: string): OutlineModule[] {
  const c = demoCourses.find((x) => x.slug === slug);
  if (!c) return [];
  return c.modules.map((m, mi) => ({
    id: `pm-${mi}`,
    title: m.title,
    lessons: m.lessons.map((l, li) => ({ id: `pl-${mi}-${li}`, title: l.title, type: l.type, duration_minutes: l.minutes, is_preview: Boolean(l.preview), is_mandatory: true })),
  }));
}

function previewInternships(): Internship[] {
  return demoInternships.map((i, idx) => ({
    id: `preview-int-${idx}`, slug: i.slug, title: i.title, employer_id: null, kind: i.kind, description: i.description,
    responsibilities: i.responsibilities, skills: i.skills, eligibility: i.eligibility, location: i.location, work_mode: i.workMode,
    duration_weeks: i.durationWeeks, is_paid: false, stipend_min_inr: null, stipend_max_inr: null,
    stipend_notes: "Unpaid educational experience run by SkillSpring.",
    deadline: new Date(Date.now() + i.deadlineInDays * 86400000).toISOString().slice(0, 10), positions: i.positions,
    status: "open", is_demo: true, created_at: new Date().toISOString(), employer: null,
  }));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) return previewCategories;
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data ?? []) as Category[];
}

async function decorate(rows: CourseWithRelations[]): Promise<CourseCardData[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const [{ data: stats }, { data: counts }] = await Promise.all([supabase.rpc("course_review_stats"), supabase.rpc("course_enrolment_counts")]);
  const s = new Map(((stats ?? []) as { course_id: string; review_count: number; avg_rating: number }[]).map((r) => [r.course_id, r]));
  const n = new Map(((counts ?? []) as { course_id: string; enrolment_count: number }[]).map((r) => [r.course_id, r.enrolment_count]));
  return rows.map((c) => ({
    ...c,
    avg_rating: s.get(c.id)?.avg_rating != null ? Number(s.get(c.id)!.avg_rating) : null,
    review_count: s.get(c.id)?.review_count ?? 0,
    enrolment_count: n.get(c.id) ?? 0,
    effective_price: effectivePrice(c),
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
  if (q.price === "under-500") list = list.filter((c) => c.effective_price < 50000);
  if (q.price === "500-1000") list = list.filter((c) => c.effective_price >= 50000 && c.effective_price <= 100000);
  if (q.price === "over-1000") list = list.filter((c) => c.effective_price > 100000);
  if (q.price === "free") list = list.filter((c) => c.effective_price === 0);
  const sorted = [...list];
  switch (q.sort) {
    case "price-asc": sorted.sort((a, b) => a.effective_price - b.effective_price); break;
    case "price-desc": sorted.sort((a, b) => b.effective_price - a.effective_price); break;
    case "newest": sorted.sort((a, b) => +new Date(b.published_at ?? b.created_at) - +new Date(a.published_at ?? a.created_at)); break;
    default: // popularity: real enrolments, then reviews, then newest
      sorted.sort((a, b) => b.enrolment_count - a.enrolment_count || b.review_count - a.review_count || +new Date(b.published_at ?? b.created_at) - +new Date(a.published_at ?? a.created_at));
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
  return filterAndSort(await decorate((data ?? []) as CourseWithRelations[]), { ...q, q: undefined });
}

export async function getCourseBySlug(slug: string): Promise<CourseCardData | null> {
  if (!isSupabaseConfigured()) return previewCourses().find((c) => c.slug === slug) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(COURSE_SELECT).eq("slug", slug).maybeSingle();
  if (!data) return null;
  return (await decorate([data as CourseWithRelations]))[0];
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

export type InternshipQuery = { q?: string; kind?: string; mode?: string; paid?: string };

export async function getInternships(q: InternshipQuery = {}): Promise<Internship[]> {
  let list: Internship[];
  if (!isSupabaseConfigured()) list = previewInternships();
  else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("internships")
      .select("*, employer:employers(name, slug, website, logo_url, status)")
      .in("status", ["open", "closed"])
      .order("status", { ascending: false })
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(200);
    list = (data ?? []) as Internship[];
  }
  if (q.q) {
    const n = q.q.toLowerCase();
    list = list.filter((i) => [i.title, i.description, i.skills.join(" "), i.employer?.name].join(" ").toLowerCase().includes(n));
  }
  if (q.kind === "employer") list = list.filter((i) => i.kind === "employer");
  if (q.kind === "educational") list = list.filter((i) => i.kind !== "employer");
  if (q.mode) list = list.filter((i) => i.work_mode === q.mode);
  if (q.paid === "paid") list = list.filter((i) => i.is_paid);
  if (q.paid === "unpaid") list = list.filter((i) => !i.is_paid);
  return list;
}

export async function getInternshipBySlug(slug: string): Promise<Internship | null> {
  if (!isSupabaseConfigured()) return previewInternships().find((i) => i.slug === slug) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("internships").select("*, employer:employers(name, slug, website, logo_url, status)").eq("slug", slug).maybeSingle();
  return (data as Internship) ?? null;
}

/** Whether a course can be bought right now (mirrors public.course_is_purchasable). */
export function isPurchasable(c: { status: string; is_demo: boolean; rights_status: string }) {
  return c.status === "published" && !c.is_demo && ["owned", "licensed", "instructor_owned"].includes(c.rights_status);
}
