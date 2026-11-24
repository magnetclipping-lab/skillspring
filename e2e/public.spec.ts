import { expect, test } from "@playwright/test";

/** Public-site checks that work with or without backend credentials. */

test.describe("public website", () => {
  test("homepage has the hero, featured courses and no fake statistics or claims", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Build skills that");
    await expect(page.getByRole("link", { name: /Browse courses/ }).first()).toBeVisible();
    for (const h of ["Start with one of these", "Four areas. One standard of work.", "Five formats, one clear rubric", "What you leave with", "Questions, answered"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\d[\d,]*\+?\s*(students|learners|placements|hired)/i);
    expect(text).not.toMatch(/accredited certificate|verifiable certificate|guaranteed (job|placement)|placement partner/i);
    expect(text).not.toMatch(/internship/i);
  });

  test("courses page lists 24 courses at ₹7,500 across four categories", async ({ page }) => {
    await page.goto("/courses?view=list");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Courses");
    for (const name of ["Artificial Intelligence & Automation", "Digital Marketing & Growth", "Professional & Productivity Skills", "Entrepreneurship & Business"]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.getByText("Showing 24 courses")).toBeVisible();
    expect(await page.getByText("₹7,500").count()).toBeGreaterThanOrEqual(24);
    await expect(page.getByText(/Financial Markets/)).toHaveCount(0);
  });

  test("category tabs filter the catalogue", async ({ page }) => {
    await page.goto("/courses");
    await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: /Entrepreneurship/ }).click();
    await expect(page).toHaveURL(/category=entrepreneurship-business/);
    await expect(page.getByText("Showing 4 courses")).toBeVisible();
  });

  test("retired URLs redirect", async ({ page }) => {
    await page.goto("/programs");
    await expect(page).toHaveURL(/\/courses$/);
    await page.goto("/programs/excel-program");
    await expect(page).toHaveURL(/\/courses\/advanced-excel-for-professionals$/);
    await page.goto("/internships");
    await expect(page).toHaveURL(/\/courses$/);
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/$/);
  });

  test("course page shows curriculum, assignments, FAQs, structured data and an honest preview", async ({ page }) => {
    await page.goto("/courses/mastering-claude-ai");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Mastering Claude AI");
    for (const h of ["About this course", "What you'll be able to do", "Curriculum", "Assignments you'll complete", "Questions"]) {
      await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    }
    await expect(page.getByText("₹7,500").first()).toBeVisible();
    await expect(page.getByText("Workbook", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Scenario challenge", { exact: true }).first()).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await page.getByRole("button", { name: /Watch the 30-second preview/ }).first().click();
    await expect(page.getByText("Preview video coming soon")).toBeVisible();
  });

  test("campus ambassador page validates the free application", async ({ page }) => {
    await page.goto("/campus-ambassador");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Campus Ambassador Program");
    await expect(page.getByText("Free to join").first()).toBeVisible();
    await page.getByRole("button", { name: "Apply free" }).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();
  });

  test("legal and info pages render", async ({ page }) => {
    for (const [path, heading] of [["/privacy", "Privacy policy"], ["/terms", "Terms and conditions"], ["/refund-policy", "Refund policy"], ["/disclaimer", "Disclaimer"], ["/about", "Skills you practise, not just watch"], ["/faq", "Frequently asked questions"], ["/contact", "We're here to help"], ["/become-instructor", "Share what you know"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    }
  });

  test("SEO endpoints", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/courses/advanced-excel-for-professionals");
    expect(sitemap).toContain("/campus-ambassador");
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("layout does not overflow horizontally", async ({ page }) => {
    for (const path of ["/", "/courses", "/courses?view=list", "/courses/financial-modelling-business-analysis", "/campus-ambassador", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("Journey 6 (signed out): protected areas deny access", () => {
  for (const path of ["/admin", "/admin/submissions", "/instructor", "/dashboard", "/dashboard/assignments", "/dashboard/results", "/checkout/mastering-claude-ai", "/learn/mastering-claude-ai/x"]) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("admin and payment APIs refuse unauthenticated calls", async ({ request }) => {
    expect((await request.get("/api/admin/export/transactions")).status()).toBe(403);
    expect((await request.post("/api/payments/create-order", { data: { courseSlug: "x" } })).status()).toBe(403); // no Origin → CSRF guard
    expect((await request.post("/api/payments/create-order", { data: { courseSlug: "x" }, headers: { origin: new URL(test.info().project.use.baseURL ?? "http://localhost:3100").origin } })).status()).toBe(401);
    expect((await request.post("/api/webhooks/razorpay", { data: "{}" })).status()).toBeGreaterThanOrEqual(401);
    expect((await request.get("/api/cron/evaluate")).status()).toBeGreaterThanOrEqual(401);
    expect((await request.get("/api/cron/evaluate", { headers: { authorization: "Bearer wrong" } })).status()).toBeGreaterThanOrEqual(401);
    expect((await request.get("/api/templates/00000000-0000-4000-8000-000000000000")).status()).toBe(401);
  });
});
