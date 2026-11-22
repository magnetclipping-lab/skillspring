import { expect, test } from "@playwright/test";

/** Public-site checks that work with or without backend credentials. */

test.describe("public website", () => {
  test("homepage has the hero, both CTAs and no fake statistics", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn Skills.");
    await expect(page.getByRole("link", { name: /Explore Courses/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore Internships/ }).first()).toBeVisible();
    await expect(page.getByText("Demo placeholder").first()).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\d[\d,]*\+?\s*(students|learners|placements)/i);
  });

  test("catalogue search and filters work", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByText(/\d+ courses?/)).toBeVisible();
    await page.getByPlaceholder("Search courses…").fill("excel");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/q=excel/);
    await expect(page.getByRole("link", { name: /Advanced Excel for Finance/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Prompt Engineering/ })).toHaveCount(0);
    await page.goto("/courses?category=career-development");
    await expect(page.getByRole("link", { name: /Interview Preparation/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Stock Market Fundamentals/ })).toHaveCount(0);
  });

  test("demo course page shows curriculum and cannot be purchased", async ({ page }) => {
    await page.goto("/courses/financial-modelling-with-excel");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Financial Modelling with Excel");
    await expect(page.getByText("This is a demo course listing")).toBeVisible();
    await expect(page.getByRole("button", { name: "Not yet available for purchase" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Curriculum" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Certificate eligibility/ })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test("internships are clearly labelled as educational, not jobs", async ({ page }) => {
    await page.goto("/internships");
    await expect(page.getByText("Educational simulation").first()).toBeVisible();
    await page.getByRole("link", { name: /Equity Research Virtual Simulation/ }).click();
    await expect(page.getByText("This is an educational experience, not a job")).toBeVisible();
  });

  test("certificate verification rejects unknown IDs", async ({ page }) => {
    await page.goto("/verify");
    await page.getByPlaceholder("SS-YYYY-XXXXXXXXXX").fill("SS-2026-NOTREAL000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { name: "No certificate found" })).toBeVisible();
  });

  test("legal and info pages render", async ({ page }) => {
    for (const [path, heading] of [["/privacy", "Privacy policy"], ["/terms", "Terms and conditions"], ["/refund-policy", "Refund policy"], ["/disclaimer", "Disclaimer"], ["/about", "Practical skills for every student"], ["/faq", "Frequently asked questions"], ["/contact", "We're here to help"], ["/become-instructor", "Share what you know"], ["/partners", "Partner with SkillSpring"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    }
  });

  test("SEO endpoints", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/courses/stock-market-fundamentals");
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
    for (const path of ["/", "/courses", "/courses/stock-market-fundamentals", "/internships", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("Journey 6 (signed out): protected areas deny access", () => {
  for (const path of ["/admin", "/admin/finance", "/instructor", "/dashboard", "/dashboard/payments", "/checkout/stock-market-fundamentals"]) {
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
  });
});
