import { describe, expect, it } from "vitest";
import { applicationSchema, contactSchema, courseSchema, internshipSchema, lessonSchema, profileSchema, questionSchema, registerSchema } from "@/lib/validation";
import { renderTemplate } from "@/lib/email/templates";
import { filterAndSort } from "@/lib/data/catalogue";

describe("validation schemas", () => {
  it("enforces password strength and terms acceptance at registration", () => {
    expect(registerSchema.safeParse({ fullName: "Asha", email: "a@b.in", password: "short1", acceptTerms: "on" }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: "Asha", email: "a@b.in", password: "longpassword", acceptTerms: "on" }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: "Asha", email: "a@b.in", password: "longpassword1" }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: "Asha Rao", email: "A@B.IN", password: "longpassword1", acceptTerms: "on" }).data?.email).toBe("a@b.in");
  });

  it("converts course prices from rupees to paise and rejects bad discounts", () => {
    const base = { title: "Test course", slug: "test-course", description: "A long enough description", category_id: "", level: "beginner", language: "English", duration_minutes: "60" };
    const ok = courseSchema.safeParse({ ...base, price: "499", discount_price: "299" });
    expect(ok.success && ok.data.price).toBe(49900);
    expect(ok.success && ok.data.discount_price).toBe(29900);
    expect(courseSchema.safeParse({ ...base, price: "499", discount_price: "599" }).success).toBe(false);
    expect(courseSchema.safeParse({ ...base, slug: "Bad Slug", price: "1" }).success).toBe(false);
  });

  it("parses FAQs and lists from textareas", () => {
    const r = courseSchema.parse({ title: "Test course", slug: "t", description: "A long enough description", category_id: "", level: "beginner", language: "English", duration_minutes: "0", price: "0", learning_outcomes: "One\n\nTwo\n", faqs: "Q one?\nA one.\n\nQ two?\nA two." });
    expect(r.learning_outcomes).toEqual(["One", "Two"]);
    expect(r.faqs).toEqual([{ question: "Q one?", answer: "A one." }, { question: "Q two?", answer: "A two." }]);
  });

  it("only accepts https links and safe video IDs for lessons", () => {
    const base = { module_id: "00000000-0000-4000-8000-000000000000", title: "L", type: "video", duration_minutes: "1", position: "1" };
    expect(lessonSchema.safeParse({ ...base, external_url: "javascript:alert(1)" }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...base, external_url: "http://x.com" }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...base, video_asset_id: "../../etc" }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...base, video_provider: "mux", video_asset_id: "a1B2c3D4e5" }).success).toBe(true);
  });

  it("requires a verified employer reference for employer internships", () => {
    const base = { title: "Analyst intern", slug: "analyst-intern", description: "A sufficiently long description", work_mode: "remote", status: "open", employer_id: "" };
    expect(internshipSchema.safeParse({ ...base, kind: "employer" }).success).toBe(false);
    expect(internshipSchema.safeParse({ ...base, kind: "simulation" }).success).toBe(true);
  });

  it("validates quiz questions", () => {
    expect(questionSchema.safeParse({ prompt: "Which?", options: "A\nB\nC", correct_index: 2 }).success).toBe(true);
    expect(questionSchema.safeParse({ prompt: "Which?", options: "A", correct_index: 0 }).success).toBe(false);
    expect(questionSchema.safeParse({ prompt: "Which?", options: "A\nB", correct_index: 5 }).success).toBe(false);
  });

  it("validates application and profile inputs", () => {
    expect(applicationSchema.safeParse({ internship_id: "00000000-0000-4000-8000-000000000000", cover_letter: "too short" }).success).toBe(false);
    expect(profileSchema.safeParse({ full_name: "Asha", phone: "abc" }).success).toBe(false);
    expect(profileSchema.parse({ full_name: "Asha", skills: "Excel, SQL ,  " }).skills).toEqual(["Excel", "SQL"]);
    expect(contactSchema.safeParse({ topic: "general", name: "A", email: "a@b.in", message: "Hello there friend", website: "spam" }).success).toBe(false);
  });
});

describe("email templates", () => {
  it("escapes user-provided values", () => {
    const { html, subject } = renderTemplate("payment_success", { name: "<script>x</script>", courseTitle: "Excel", amount: "₹499.00", url: "https://skillspring.example/x" });
    expect(subject).toContain("Excel");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("renders every template", () => {
    for (const t of ["welcome", "payment_success", "course_completed", "certificate_issued", "application_received", "application_status", "instructor_application"] as const) {
      const r = renderTemplate(t, { name: "A", title: "T", courseTitle: "C", code: "SS-2026-X", url: "https://e.x", verifyUrl: "https://e.x/v", status: "Shortlisted", amount: "₹1" });
      expect(r.subject.length).toBeGreaterThan(5);
      expect(r.html).toContain("SkillSpring");
    }
  });
});

describe("catalogue filtering", () => {
  const mk = (slug: string, price: number, level: string, category: string, enrolments = 0, days = 0) =>
    ({ slug, title: slug, subtitle: "", description: "", effective_price: price, price_paise: price, level, category: { slug: category, name: category }, enrolment_count: enrolments, review_count: 0, published_at: new Date(Date.now() - days * 86400000).toISOString(), created_at: "" }) as never;
  const list = [mk("a", 49900, "beginner", "finance", 5, 3), mk("b", 149900, "advanced", "tech", 1, 1), mk("c", 0, "beginner", "tech", 0, 0)];
  it("filters by price, level, category and search", () => {
    expect(filterAndSort(list, { price: "under-500" }).map((c: { slug: string }) => c.slug)).toEqual(["a", "c"]);
    expect(filterAndSort(list, { level: "advanced" }).map((c: { slug: string }) => c.slug)).toEqual(["b"]);
    expect(filterAndSort(list, { category: "tech", price: "free" }).map((c: { slug: string }) => c.slug)).toEqual(["c"]);
    expect(filterAndSort(list, { q: "B" }).map((c: { slug: string }) => c.slug)).toEqual(["b"]);
  });
  it("sorts by popularity, price and newest", () => {
    expect(filterAndSort(list, {}).map((c: { slug: string }) => c.slug)).toEqual(["a", "b", "c"]);
    expect(filterAndSort(list, { sort: "price-asc" }).map((c: { slug: string }) => c.slug)).toEqual(["c", "a", "b"]);
    expect(filterAndSort(list, { sort: "newest" }).map((c: { slug: string }) => c.slug)).toEqual(["c", "b", "a"]);
  });
});
