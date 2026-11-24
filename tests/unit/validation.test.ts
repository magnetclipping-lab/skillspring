import { describe, expect, it } from "vitest";
import { assignmentSchema, contactSchema, courseSchema, lessonSchema, parseQuestion, parseRubric, profileSchema, quizAnswerSchema, registerSchema, submissionSchema } from "@/lib/validation";
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

  it("parses every quiz question type into the stored shape", () => {
    const single = parseQuestion({ qtype: "single", prompt: "Which?", options: "A\nB\nC", answer: "2" });
    expect(single).toMatchObject({ ok: true, data: { options: ["A", "B", "C"], correct_index: 1 } });
    expect(parseQuestion({ qtype: "single", prompt: "Which?", options: "A", answer: "1" }).ok).toBe(false);
    expect(parseQuestion({ qtype: "single", prompt: "Which?", options: "A\nB", answer: "5" }).ok).toBe(false);
    expect(parseQuestion({ qtype: "true_false", prompt: "Sky is blue", answer: "false" })).toMatchObject({ ok: true, data: { options: ["True", "False"], correct_index: 1 } });
    expect(parseQuestion({ qtype: "multi", prompt: "Pick", options: "A\nB\nC", answer: "3, 1" })).toMatchObject({ ok: true, data: { correct: [0, 2] } });
    const match = parseQuestion({ qtype: "match", prompt: "Match", options: "CPC => Cost ÷ Clicks\nCTR => Clicks ÷ Impressions\nCPA => Cost ÷ Conversions" }, () => [2, 0, 1]);
    expect(match).toMatchObject({ ok: true, data: { options: { left: ["CPC", "CTR", "CPA"], right: ["Cost ÷ Conversions", "Cost ÷ Clicks", "Clicks ÷ Impressions"] }, correct: [1, 2, 0] } });
    expect(parseQuestion({ qtype: "fill_blank", prompt: "Assets = Liabilities + ___", answer: "Equity | Shareholders' equity" })).toMatchObject({ ok: true, data: { correct: [["Equity", "Shareholders' equity"]] } });
    expect(parseQuestion({ qtype: "fill_blank", prompt: "No blank here", answer: "x" }).ok).toBe(false);
    expect(parseQuestion({ qtype: "scenario", prompt: "What next?", options: "A\nB", answer: "1" }).ok).toBe(false); // needs a scenario
  });

  it("validates assignment authoring, rubrics and learner answers", () => {
    const base = { title: "Workbook", kind: "file", instructions: "Do the tasks", max_score: "100", pass_pct: "50", accepted_types: "xlsx,csv", allow_file: "on", ai_evaluation: "on", lesson_id: "" };
    expect(assignmentSchema.safeParse({ ...base, rubric: "Accuracy | 60 | Right numbers\nFormulas | 40 | Live" }).success).toBe(true);
    expect(assignmentSchema.safeParse({ ...base, rubric: "" }).success).toBe(false); // AI evaluation needs a rubric
    expect(assignmentSchema.safeParse({ ...base, rubric: "Accuracy | lots" }).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...base, rubric: "A | 10 | x", accepted_types: "exe" }).success).toBe(false);
    expect(parseRubric("A | 10 | good | very good")).toEqual([{ criterion: "A", points: 10, description: "good | very good" }]);
    expect(quizAnswerSchema.safeParse(2).success).toBe(true);
    expect(quizAnswerSchema.safeParse([0, 2]).success).toBe(true);
    expect(quizAnswerSchema.safeParse(["Equity"]).success).toBe(true);
    expect(quizAnswerSchema.safeParse({ $gt: 1 }).success).toBe(false);
    const sub = submissionSchema.safeParse({ assignment_id: "00000000-0000-4000-8000-000000000000", links: "https://a.example/x\nhttps://b.example" });
    expect(sub.success && sub.data.links).toEqual(["https://a.example/x", "https://b.example"]);
    expect(submissionSchema.safeParse({ assignment_id: "00000000-0000-4000-8000-000000000000", links: "javascript:alert(1)" }).success).toBe(false);
    expect(submissionSchema.safeParse({ assignment_id: "00000000-0000-4000-8000-000000000000", links: "http://insecure.example" }).success).toBe(false);
  });

  it("validates application and profile inputs", () => {
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
      expect(r.html).toContain("Proofwork");
    }
  });
});

describe("catalogue filtering", () => {
  const mk = (slug: string, order: number, level: string, category: string, enrolments = 0, days = 0) =>
    ({ slug, title: slug, subtitle: "", description: "", effective_price: 750000, price_paise: 750000, level, sort_order: order, category: { slug: category, name: category }, enrolment_count: enrolments, review_count: 0, published_at: new Date(Date.now() - days * 86400000).toISOString(), created_at: "" }) as never;
  const list = [mk("a", 2, "beginner", "ai", 5, 3), mk("b", 3, "advanced", "marketing", 9, 1), mk("c", 1, "beginner", "marketing", 0, 0)];
  it("filters by level, category and search", () => {
    expect(filterAndSort(list, { level: "advanced" }).map((c: { slug: string }) => c.slug)).toEqual(["b"]);
    expect(filterAndSort(list, { category: "marketing" }).map((c: { slug: string }) => c.slug)).toEqual(["c", "b"]);
    expect(filterAndSort(list, { q: "B" }).map((c: { slug: string }) => c.slug)).toEqual(["b"]);
  });
  it("sorts by curated order, popularity and newest", () => {
    expect(filterAndSort(list, {}).map((c: { slug: string }) => c.slug)).toEqual(["c", "a", "b"]);
    expect(filterAndSort(list, { sort: "popular" }).map((c: { slug: string }) => c.slug)).toEqual(["b", "a", "c"]);
    expect(filterAndSort(list, { sort: "newest" }).map((c: { slug: string }) => c.slug)).toEqual(["c", "b", "a"]);
  });
});
