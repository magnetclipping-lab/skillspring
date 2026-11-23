import { expect, test } from "@playwright/test";

/** Public-site checks that work with or without backend credentials. */

test.describe("public website", () => {
  test("homepage has the hero, both CTAs and no fake statistics", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn skills.");
    await expect(page.getByRole("link", { name: /Explore programs/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /campus ambassador/i }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Excel" })).toBeVisible();
    await page.getByRole("tab", { name: "Excel" }).click();
    await expect(page.getByRole("tab", { name: "Excel" })).toHaveAttribute("aria-selected", "true");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\d[\d,]*\+?\s*(students|learners|placements)/i);
  });

  test("programs page lists the four programs with prices", async ({ page }) => {
    await page.goto("/programs");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Programs");
    for (const name of ["Stock Market", "Web Design", "Digital Marketing", "Excel"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
    }
    await expect(page.getByText("₹3,999").first()).toBeVisible();
    await expect(page.getByText("₹1,999").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compare programs" })).toBeVisible();
  });

  test("old course URLs redirect to programs", async ({ page }) => {
    await page.goto("/courses");
    await expect(page).toHaveURL(/\/programs$/);
    await page.goto("/courses/excel-program");
    await expect(page).toHaveURL(/\/programs\/excel-program$/);
  });

  test("program page shows details, FAQs and cannot be bought before launch", async ({ page }) => {
    await page.goto("/programs/excel-program");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Excel");
    await expect(page.getByRole("button", { name: "Enrolment opens soon" })).toBeDisabled();
    for (const h of ["About this program", "Curriculum", "Projects you'll build", "Your certificate", "Frequently asked questions"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test("campus ambassador page validates the free application", async ({ page }) => {
    await page.goto("/campus-ambassador");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Campus Ambassador Program");
    await expect(page.getByText("Free to join").first()).toBeVisible();
    await page.getByRole("button", { name: "Apply free" }).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();
  });

  test("internships are clearly labelled as educational, not jobs", async ({ page }) => {
    await page.goto("/internships");
    await expect(page.getByText("Educational simulation").first()).toBeVisible();
    await page.getByRole("link", { name: /Excel MIS Dashboard/ }).click();
    await expect(page.getByText("This is an educational experience, not a job")).toBeVisible();
  });

  test("certificate verification rejects unknown IDs", async ({ page }) => {
    await page.goto("/verify");
    await page.getByPlaceholder("SS-YYYY-XXXXXXXXXX").fill("SS-2026-NOTREAL000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { name: "No certificate found" })).toBeVisible();
  });

  test("legal and info pages render", async ({ page }) => {
    for (const [path, heading] of [["/privacy", "Privacy policy"], ["/terms", "Terms and conditions"], ["/refund-policy", "Refund policy"], ["/disclaimer", "Disclaimer"], ["/about", "Practical skills for every student"], ["/faq", "Frequently asked questions"], ["/contact", "We're here to help"], ["/become-instructor", "Share what you know"], ["/partners", "Partner with Proofwork"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    }
  });

  test("SEO endpoints", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/programs/excel-program");
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
    for (const path of ["/", "/programs", "/programs/web-development-program", "/campus-ambassador", "/internships", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("Journey 6 (signed out): protected areas deny access", () => {
  for (const path of ["/admin", "/admin/finance", "/instructor", "/dashboard", "/dashboard/payments", "/checkout/excel-program"]) {
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
