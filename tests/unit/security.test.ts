import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createRazorpayClient, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/payments/razorpay";
import { precheckUpload, sniffMime, validateUpload } from "@/lib/security/uploads";
import { pathInFolder, uploadFolder } from "@/lib/uploads/folders";
import { csvCell, toCsv } from "@/lib/csv";
import { safeRedirectPath, formatINR, slugify } from "@/lib/utils";

const secret = "test_secret_123";

describe("Razorpay checkout signature", () => {
  const sig = createHmac("sha256", secret).update("order_ABC|pay_XYZ").digest("hex");
  it("accepts a valid signature", () => {
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: sig, secret })).toBe(true);
  });
  it("rejects tampered order, payment or signature", () => {
    expect(verifyCheckoutSignature({ orderId: "order_ABD", paymentId: "pay_XYZ", signature: sig, secret })).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYY", signature: sig, secret })).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: sig.replace(/.$/, "0"), secret })).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: "short", secret })).toBe(false);
  });
  it("rejects when the secret is missing", () => {
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: sig, secret: "" })).toBe(false);
  });
});

describe("Razorpay webhook signature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: {} });
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  it("verifies the raw body", () => {
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });
  it("fails if the body changes by one byte", () => {
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });
});

describe("Razorpay REST client", () => {
  it("creates orders with server-provided amount and basic auth", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "order_1", amount: 49900, currency: "INR", receipt: "r", status: "created" }), { status: 200 }));
    const client = createRazorpayClient("rzp_test_key", "secret", fetchMock as unknown as typeof fetch);
    const order = await client.createOrder({ amount: 49900, receipt: "r", notes: { a: "b" } });
    expect(order.id).toBe("order_1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect((init.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("rzp_test_key:secret").toString("base64"));
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 49900, currency: "INR" });
  });
  it("surfaces Razorpay errors", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { description: "Bad key" } }), { status: 401 }));
    const client = createRazorpayClient("k", "s", fetchMock as unknown as typeof fetch);
    await expect(client.fetchPayment("pay_1")).rejects.toThrow("Bad key");
  });
});

describe("upload validation", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 rest");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  it("detects real file types from magic bytes", () => {
    expect(sniffMime(pdf, "application/pdf")).toBe("application/pdf");
    expect(sniffMime(png, "image/png")).toBe("image/png");
    expect(sniffMime(exe, "application/pdf")).toBeNull();
  });
  it("rejects a renamed executable posing as a PDF resume", () => {
    const r = validateUpload("resume", { size: 1000, type: "application/pdf", name: "cv.pdf" }, exe);
    expect(r.ok).toBe(false);
  });
  it("rejects files above the size limit and wrong types for the bucket", () => {
    expect(validateUpload("resume", { size: 6 * 1024 * 1024, type: "application/pdf", name: "cv.pdf" }, pdf).ok).toBe(false);
    expect(validateUpload("resume", { size: 1000, type: "image/png", name: "cv.png" }, png).ok).toBe(false);
    expect(validateUpload("avatar", { size: 1000, type: "image/png", name: "me.png" }, png)).toEqual({ ok: true, mime: "image/png", ext: "png" });
  });
  it("accepts assignment workbooks, CSVs and preview videos by content, not by name", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const csv = new TextEncoder().encode("name,score\nAsha,8\n");
    const mp4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(validateUpload("assignment", { size: 2000, type: "", name: "work.xlsx" }, zip)).toMatchObject({ ok: true, ext: "xlsx" });
    expect(validateUpload("assignment", { size: 2000, type: "text/csv", name: "data.csv" }, csv)).toMatchObject({ ok: true, mime: "text/csv" });
    expect(validateUpload("assignment", { size: 2000, type: "text/csv", name: "data.csv" }, exe).ok).toBe(false);
    expect(validateUpload("assignment", { size: 21 * 1024 * 1024, type: "", name: "big.xlsx" }, zip).ok).toBe(false);
    expect(validateUpload("preview", { size: 5_000_000, type: "video/mp4", name: "p.mp4" }, mp4)).toMatchObject({ ok: true, mime: "video/mp4" });
    expect(validateUpload("preview", { size: 5_000_000, type: "video/mp4", name: "p.mp4" }, png).ok).toBe(false);
    expect(precheckUpload("assignment", { size: 1000, name: "evil.exe" }).ok).toBe(false);
  });
});

describe("upload folders", () => {
  it("scopes learners to their own folder and rejects foreign paths", () => {
    const u = "11111111-1111-4111-8111-111111111111";
    const c = "22222222-2222-4222-8222-222222222222";
    const f = uploadFolder("assignment", u, c);
    expect(f).toEqual({ ok: true, folder: `${u}/${c}` });
    expect(pathInFolder(`${u}/${c}/abc.xlsx`, `${u}/${c}`)).toBe(true);
    expect(pathInFolder(`${u}/${c}/../x/abc.xlsx`, `${u}/${c}`)).toBe(false);
    expect(pathInFolder(`other/${c}/abc.xlsx`, `${u}/${c}`)).toBe(false);
    expect(uploadFolder("preview", u, "not-a-uuid").ok).toBe(false);
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formula injection", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell("a,b")).toBe('"a,b"');
  });
  it("produces a header row and BOM", () => {
    const csv = toCsv([{ a: 1, b: "x" }]);
    expect(csv.startsWith("﻿a,b\r\n1,x")).toBe(true);
  });
});

describe("utils", () => {
  it("blocks open redirects", () => {
    expect(safeRedirectPath("/dashboard/learning")).toBe("/dashboard/learning");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard");
    expect(safeRedirectPath(null, "/x")).toBe("/x");
  });
  it("formats paise as rupees", () => {
    expect(formatINR(49900)).toBe("₹499");
    expect(formatINR(199950, true)).toBe("₹1,999.50");
  });
  it("slugifies titles", () => {
    expect(slugify("Advanced Excel for Finance!")).toBe("advanced-excel-for-finance");
  });
});
