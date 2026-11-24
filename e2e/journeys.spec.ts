/**
 * The six critical journeys, end to end, against a real Supabase project and
 * Razorpay TEST mode. Run with:  E2E_FULL=1 npx playwright test e2e/journeys.spec.ts
 *
 * Requires .env.local (or env) with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID (rzp_test_…), RAZORPAY_KEY_SECRET and
 * RAZORPAY_WEBHOOK_SECRET. NEVER point this at production: it creates test users and
 * posts a signed TEST-mode webhook to stand in for Razorpay's capture notification.
 */
import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const FULL = process.env.E2E_FULL === "1";
test.skip(!FULL, "Full journeys need Supabase + Razorpay test credentials (set E2E_FULL=1).");
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const password = `Test-pass-${run}-9`;
const users = {
  admin: { email: `e2e-admin-${run}@example.test`, name: "E2E Admin" },
  instructor: { email: `e2e-instructor-${run}@example.test`, name: "E2E Instructor" },
  student: { email: `e2e-student-${run}@example.test`, name: "E2E Student" },
};
const ids: Record<string, string> = {};
const courseSlug = `e2e-course-${run}`;

function admin() {
  if ((process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_live_")) throw new Error("Refusing to run E2E against live Razorpay keys");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function logout(page: Page) {
  await page.context().clearCookies();
}

test.beforeAll(async () => {
  const db = admin();
  for (const [key, u] of Object.entries(users)) {
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password, email_confirm: true, user_metadata: { full_name: u.name } });
    if (error) throw error;
    ids[key] = data.user.id;
  }
  await db.from("user_roles").insert([{ user_id: ids.admin, role: "admin" }, { user_id: ids.instructor, role: "instructor" }]);
  const { data: ip } = await db.from("instructor_profiles").insert({ user_id: ids.instructor, display_name: users.instructor.name, status: "approved", default_revenue_share_pct: 30 }).select("id").single();
  ids.instructorProfile = ip!.id;

  // A real, purchasable test course (service role bypasses the column guards).
  const { data: course } = await db.from("courses").insert({ slug: courseSlug, title: `E2E Course ${run}`, description: "End-to-end test course", price_paise: 49900, status: "published", rights_status: "owned", instructor_id: ip!.id, completion_requires_assignments: false }).select("id").single();
  ids.course = course!.id;
  const { data: mod } = await db.from("course_modules").insert({ course_id: course!.id, title: "Module 1", position: 1 }).select("id").single();
  await db.from("lessons").insert([
    { module_id: mod!.id, course_id: course!.id, title: "Lesson A", type: "text", content_md: "Hello **world**", position: 1 },
    { module_id: mod!.id, course_id: course!.id, title: "Lesson B", type: "text", content_md: "Second lesson", position: 2 },
  ]);
});

test.afterAll(async () => {
  const db = admin();
  // Test data is left for inspection; remove the auth users so they can't sign in.
  for (const id of [ids.admin, ids.instructor, ids.student]) if (id) await db.auth.admin.deleteUser(id).catch(() => undefined);
});

test("registration form creates an account (email verification flow)", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Registrant");
  await page.getByLabel("Email").fill(`e2e-register-${run}@example.test`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/verification link|Check your inbox/).or(page.getByRole("heading", { name: /Welcome back/ }))).toBeVisible();
});

test("Journey 1: student logs in → buys a course in Razorpay test mode → enrolled → opens lessons", async ({ page }) => {
  await login(page, users.student.email);
  await page.goto(`/courses/${courseSlug}`);
  await page.getByRole("link", { name: "Enrol now" }).click();
  await expect(page).toHaveURL(new RegExp(`/checkout/${courseSlug}`));
  await expect(page.getByRole("button", { name: /Pay ₹499/ })).toBeVisible();

  // Server creates a real Razorpay TEST order with the server-side price.
  const order = await page.evaluate(async (slug) => {
    const r = await fetch("/api/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseSlug: slug }) });
    return { status: r.status, body: await r.json() };
  }, courseSlug);
  expect(order.status).toBe(200);
  expect(order.body.amount).toBe(49900);

  // Razorpay would now notify us; in test mode we send the equivalent signed webhook.
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: `pay_e2e${run}`, order_id: order.body.razorpayOrderId, amount: 49900, currency: "INR", status: "captured", method: "upi" } } } });
  const sig = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest("hex");
  const hook = await page.request.post("/api/webhooks/razorpay", { data: body, headers: { "content-type": "application/json", "x-razorpay-signature": sig, "x-razorpay-event-id": `evt_${run}` } });
  expect(hook.status()).toBe(200);

  // A tampered amount must be rejected.
  const bad = body.replace("49900", "100");
  const badHook = await page.request.post("/api/webhooks/razorpay", { data: bad, headers: { "content-type": "application/json", "x-razorpay-signature": sig, "x-razorpay-event-id": `evt_bad_${run}` } });
  expect(badHook.status()).toBe(401);

  await page.goto(`/dashboard/learning/${courseSlug}`);
  await expect(page.getByRole("heading", { name: `E2E Course ${run}` })).toBeVisible();
  await page.getByRole("link", { name: /Start course/ }).click();
  await expect(page.getByRole("heading", { name: "Lesson A" })).toBeVisible();
  await page.goto("/dashboard/payments");
  await expect(page.getByText("Paid")).toBeVisible();
});

test("Journey 2: student completes the course → internal completion record", async ({ page }) => {
  await login(page, users.student.email);
  await page.goto(`/dashboard/learning/${courseSlug}`);
  await expect(page.getByRole("button", { name: /Complete the requirements first/ })).toBeDisabled();
  for (const title of ["Lesson A", "Lesson B"]) {
    await page.goto(`/dashboard/learning/${courseSlug}`);
    await page.getByRole("link", { name: title }).click();
    await page.getByRole("button", { name: "Mark as complete" }).click();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
  }
  await page.goto(`/dashboard/learning/${courseSlug}`);
  await page.getByRole("button", { name: "Record course completion" }).click();
  await expect(page.getByText("Course completion recorded.")).toBeVisible();
  await expect(page.getByText(/not an accredited qualification/)).toBeVisible();
});

test("Journey 3: student submits an assignment → pending evaluation → admin reviews → result visible", async ({ page }) => {
  const db = admin();
  const { data: lesson } = await db.from("lessons").select("id, module_id").eq("course_id", ids.course).eq("title", "Lesson B").single();
  const { data: asgLesson } = await db.from("lessons").insert({ module_id: lesson!.module_id, course_id: ids.course, title: "Scenario: pricing call", type: "assignment", position: 3 }).select("id").single();
  await db.from("assignments").insert({ course_id: ids.course, lesson_id: asgLesson!.id, title: "Pricing call", kind: "scenario", scenario: "A client says you are 30% too expensive.", instructions: "Write your response.", allow_text: true, allow_file: false, rubric: [{ criterion: "Diagnosis", points: 50 }, { criterion: "Actions", points: 50 }] });

  await login(page, users.student.email);
  await page.goto(`/learn/${courseSlug}/${asgLesson!.id}`);
  await page.getByLabel("Your response").fill("I would first understand what they are comparing, then quantify the value of what we include, and only then consider trading a concession for a longer commitment.");
  await page.getByRole("button", { name: "Submit assignment" }).click();
  await expect(page.getByText(/queued for evaluation/)).toBeVisible();
  await page.goto("/dashboard/assignments?f=waiting");
  await expect(page.getByText("Pricing call")).toBeVisible();
  await expect(page.getByText(/Pending evaluation|With a reviewer/).first()).toBeVisible();

  await logout(page);
  await login(page, users.admin.email);
  await page.goto("/admin/submissions?f=");
  const card = page.locator("div").filter({ hasText: "Pricing call" }).filter({ has: page.getByRole("button", { name: "Save human review" }) }).last();
  await card.getByLabel("Final score").fill("72");
  await card.getByPlaceholder("Feedback for the learner").fill("Good diagnosis; be specific about which concession you would trade.");
  await card.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByText("Review saved and the learner has been notified.")).toBeVisible();

  await logout(page);
  await login(page, users.student.email);
  await page.goto("/dashboard/results");
  await expect(page.getByText("72/100")).toBeVisible();
});

test("Journey 4: admin creates → approves → publishes → course appears in the catalogue", async ({ page }) => {
  await login(page, users.admin.email);
  await page.goto("/admin/courses/new");
  const slug = `admin-e2e-${run}`;
  await page.getByLabel("Title").fill(`Admin E2E ${run}`);
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Description").fill("A course created by the admin E2E test.");
  await page.getByLabel("Price (₹)").fill("299");
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page).toHaveURL(/\/admin\/courses\/[0-9a-f-]{36}/);
  await page.getByPlaceholder("Module title").last().fill("Intro");
  await page.getByRole("button", { name: "Add module" }).click();
  await page.getByPlaceholder("New lesson title").fill("Welcome");
  await page.getByRole("button", { name: "Add lesson" }).click();
  await expect(page).toHaveURL(/lessons\//);
  await page.getByRole("link", { name: "Back to course" }).click();
  await page.getByLabel("Commercial content rights").selectOption("owned");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Course approved.")).toBeVisible();
  await page.getByRole("button", { name: "Publish course" }).click();
  await expect(page.getByText("Course published.")).toBeVisible();
  await page.goto(`/courses/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Admin E2E ${run}`);
});

test("Journey 5: instructor submits a course → admin reviews → approved", async ({ page }) => {
  await login(page, users.instructor.email);
  await page.goto("/instructor/courses/new");
  await page.getByLabel("Title").fill(`Instructor E2E ${run}`);
  await page.getByLabel("URL slug").fill(`instructor-e2e-${run}`);
  await page.getByLabel("Description").fill("A course drafted by the instructor E2E test.");
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page).toHaveURL(/\/instructor\/courses\/[0-9a-f-]{36}/);
  const courseUrl = page.url();
  await page.getByPlaceholder("Module title").last().fill("Basics");
  await page.getByRole("button", { name: "Add module" }).click();
  await page.getByPlaceholder("New lesson title").fill("First steps");
  await page.getByRole("button", { name: "Add lesson" }).click();
  await page.goto(courseUrl);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submitted for review")).toBeVisible();
  const courseId = courseUrl.split("/").pop();

  await logout(page);
  await login(page, users.admin.email);
  await page.goto(`/admin/courses/${courseId}`);
  await page.getByPlaceholder(/Notes for the instructor/).fill("Looks good.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved").first()).toBeVisible();

  await logout(page);
  await login(page, users.instructor.email);
  await page.goto(courseUrl);
  await expect(page.getByText("Approved").first()).toBeVisible();
});

test("Journey 6: a signed-in student cannot reach admin functions", async ({ page }) => {
  await login(page, users.student.email);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/forbidden/);
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  await page.goto("/instructor");
  await expect(page).not.toHaveURL(/\/instructor$/);
  const res = await page.request.get("/api/admin/export/transactions");
  expect(res.status()).toBe(403);
});
