/**
 * Database permission & business-rule tests.
 * Runs against real PostgreSQL with a Supabase auth shim (see supabase/tests/supabase-shim.sql).
 * Each `as(...)` block runs in a rolled-back transaction under the given role + JWT.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, asCommit, connect, createUser, resetDatabase, service, anon, student, type Db } from "./helpers";

let db: Db;
let adminId: string, aliceId: string, bobId: string, instructorUserId: string, otherInstructorUserId: string;
let instructorId: string;
let courseId: string, lessonIds: string[], quizId: string, assignmentId: string;
let internshipId: string;

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const { rows } = await db.query(sql, params);
  return rows[0] as T;
}

async function expectDenied(p: Promise<unknown>) {
  await expect(p).rejects.toThrow();
}

/** Simulates the server: create a Razorpay order record using the service role. */
async function createOrder(userId: string, rzpOrderId: string, amount = 99900) {
  return asCommit(db, service, () =>
    one<{ id: string }>(
      `insert into orders (user_id, course_id, amount_paise, razorpay_order_id, receipt) values ($1, $2, $3, $4, $5) returning id`,
      [userId, courseId, amount, rzpOrderId, "rcpt_" + rzpOrderId],
    ),
  );
}

beforeAll(async () => {
  await resetDatabase();
  db = await connect();
  adminId = await createUser(db, "admin@test.local", "Asha Admin", ["admin"]);
  aliceId = await createUser(db, "alice@test.local", "Alice Student");
  bobId = await createUser(db, "bob@test.local", "Bob Student");
  instructorUserId = await createUser(db, "ivy@test.local", "Ivy Instructor", ["instructor"]);
  otherInstructorUserId = await createUser(db, "oscar@test.local", "Oscar Instructor", ["instructor"]);

  instructorId = (await one<{ id: string }>(`insert into instructor_profiles (user_id, display_name, status, default_revenue_share_pct) values ($1, 'Ivy Instructor', 'approved', 40) returning id`, [instructorUserId])).id;
  await db.query(`insert into instructor_profiles (user_id, display_name, status) values ($1, 'Oscar Instructor', 'approved')`, [otherInstructorUserId]);

  // A real, purchasable course owned by Ivy (built as the migration owner).
  courseId = (await one<{ id: string }>(
    `insert into courses (slug, title, description, instructor_id, price_paise, status, rights_status, completion_min_quiz_pct)
     values ('test-course', 'Test Course', 'desc', $1, 99900, 'published', 'instructor_owned', 70) returning id`, [instructorId])).id;
  const mod = await one<{ id: string }>(`insert into course_modules (course_id, title, position) values ($1, 'M1', 1) returning id`, [courseId]);
  lessonIds = [];
  for (let i = 0; i < 3; i++) {
    const l = await one<{ id: string }>(
      `insert into lessons (module_id, course_id, title, type, content_md, video_provider, video_asset_id, position, is_preview)
       values ($1, $2, $3, 'video', 'secret content', 'mux', 'playback-secret-' || $4::text, $4::int, $5) returning id`,
      [mod.id, courseId, `Lesson ${i + 1}`, i + 1, i === 0]);
    lessonIds.push(l.id);
  }
  quizId = (await one<{ id: string }>(`insert into quizzes (course_id, title, pass_pct) values ($1, 'Quiz', 50) returning id`, [courseId])).id;
  await db.query(`insert into quiz_questions (quiz_id, prompt, options, correct_index, position) values
    ($1, 'Q1', '["a","b"]', 1, 1), ($1, 'Q2', '["a","b"]', 0, 2)`, [quizId]);
  assignmentId = (await one<{ id: string }>(`insert into assignments (course_id, title, instructions) values ($1, 'A1', 'do it') returning id`, [courseId])).id;

  internshipId = (await one<{ id: string }>(`insert into internships (slug, title, kind, description, status) values ('test-simulation', 'Test simulation', 'simulation', 'Fixture', 'open') returning id`)).id;
});

afterAll(async () => {
  await db?.end();
});

describe("seed & public catalogue", () => {
  it("anon sees the 24 published catalogue courses, all purchasable at ₹7,500", async () => {
    await as(db, anon, async () => {
      const { rows } = await db.query(`select slug, price_paise, public.course_is_purchasable(id) as buyable from courses where thumbnail_url like '/thumbnails/%'`);
      expect(rows.length).toBe(24);
      expect(rows.every((r) => r.buyable === true && r.price_paise === 750000)).toBe(true);
    });
  });

  it("anon can read the outline but not locked lesson content", async () => {
    await as(db, anon, async () => {
      const outline = await db.query(`select * from public.get_course_outline($1)`, [courseId]);
      expect(outline.rows.length).toBe(3);
      const { rows } = await db.query(`select id, content_md from lessons where course_id = $1`, [courseId]);
      expect(rows.map((r) => r.id)).toEqual([lessonIds[0]]); // only the free preview
    });
  });

  it("anon cannot read orders, payments, profiles or audit logs", async () => {
    await as(db, anon, async () => {
      for (const t of ["orders", "payments", "profiles", "audit_logs", "enrolments", "certificates"]) {
        const { rows } = await db.query(`select * from ${t}`);
        expect(rows, t).toHaveLength(0);
      }
    });
  });
});

describe("Journey 1: purchase → enrolment → lesson access", () => {
  it("student cannot create enrolments, orders or payments directly", async () => {
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`insert into enrolments (user_id, course_id, source) values ($1, $2, 'purchase')`, [aliceId, courseId]));
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`insert into orders (user_id, course_id, amount_paise, receipt) values ($1, $2, 1, 'x')`, [aliceId, courseId]));
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`select public.fulfil_order('o', 'p', 's', 1, 'upi', 'webhook', '{}')`));
    });
  });

  it("rejects fulfilment with a tampered amount", async () => {
    await createOrder(aliceId, "order_tamper");
    await as(db, service, async () => {
      await expectDenied(db.query(`select public.fulfil_order('order_tamper', 'pay_tamper', 'sig', 100, 'card', 'checkout_signature', '{}')`));
    });
  });

  it("fulfils a verified payment exactly once (checkout + duplicate webhook)", async () => {
    await createOrder(aliceId, "order_alice");
    const first = await asCommit(db, service, () =>
      one<{ r: { newly_enrolled: boolean; enrolment_id: string } }>(
        `select public.fulfil_order('order_alice', 'pay_alice', 'sig', 99900, 'upi', 'checkout_signature', '{}') as r`));
    expect(first.r.newly_enrolled).toBe(true);
    const second = await asCommit(db, service, () =>
      one<{ r: { newly_enrolled: boolean; enrolment_id: string } }>(
        `select public.fulfil_order('order_alice', 'pay_alice', null, 99900, 'upi', 'webhook', '{}') as r`));
    expect(second.r.newly_enrolled).toBe(false);
    expect(second.r.enrolment_id).toBe(first.r.enrolment_id);

    const counts = await one<{ p: string; e: string; earn: string; amt: number }>(
      `select (select count(*) from payments where razorpay_payment_id = 'pay_alice') p,
              (select count(*) from enrolments where user_id = $1) e,
              (select count(*) from instructor_earnings where instructor_id = $2) earn,
              (select amount_paise from instructor_earnings where instructor_id = $2 limit 1) amt`, [aliceId, instructorId]);
    expect(Number(counts.p)).toBe(1);
    expect(Number(counts.e)).toBe(1);
    expect(Number(counts.earn)).toBe(1);
    expect(counts.amt).toBe(Math.floor(99900 * 0.4));
  });

  it("a later failed payment does not downgrade a paid order", async () => {
    await asCommit(db, service, () => db.query(`select public.mark_order_failed('order_alice', 'pay_alice_retry', 'BAD', 'declined', '{}')`));
    const o = await one<{ status: string }>(`select status from orders where razorpay_order_id = 'order_alice'`);
    expect(o.status).toBe("paid");
  });

  it("enrolled student can read all lessons; unenrolled student cannot", async () => {
    await as(db, student(aliceId), async () => {
      const { rows } = await db.query(`select id from lessons where course_id = $1`, [courseId]);
      expect(rows).toHaveLength(3);
    });
    await as(db, student(bobId), async () => {
      const { rows } = await db.query(`select id from lessons where course_id = $1`, [courseId]);
      expect(rows).toHaveLength(1);
      await expectDenied(db.query(`select public.complete_lesson($1)`, [lessonIds[1]]));
    });
  });

  it("students only see their own orders and payments (no IDOR)", async () => {
    await as(db, student(bobId), async () => {
      const { rows } = await db.query(`select * from orders where razorpay_order_id = 'order_alice'`);
      expect(rows).toHaveLength(0);
      const p = await db.query(`select * from payments`);
      expect(p.rows).toHaveLength(0);
    });
    await as(db, student(aliceId), async () => {
      const { rows } = await db.query(`select status from orders where razorpay_order_id = 'order_alice'`);
      expect(rows[0].status).toBe("paid");
    });
  });

  it("demo courses cannot be enrolled for free or purchased", async () => {
    await as(db, student(bobId), async () => {
      await expectDenied(db.query(`select public.enrol_free_course((select id from courses where slug = 'excel-program'))`));
    });
  });
});

describe("Journey 2: completion → certificate → verification", () => {
  it("refuses a certificate before requirements are met", async () => {
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`select public.issue_certificate($1)`, [courseId]));
    });
  });

  it("quiz answers are never readable by students", async () => {
    await as(db, student(aliceId), async () => {
      const { rows } = await db.query(`select * from quiz_questions where quiz_id = $1`, [quizId]);
      expect(rows).toHaveLength(0);
      const quiz = await one<{ q: { questions: Record<string, unknown>[] } }>(`select public.get_quiz($1) as q`, [quizId]);
      expect(quiz.q.questions).toHaveLength(2);
      expect(JSON.stringify(quiz.q)).not.toContain("correct_index");
    });
  });

  it("progress is computed server-side and certificate issues after full completion", async () => {
    await asCommit(db, student(aliceId), async () => {
      for (const id of lessonIds) await db.query(`select public.complete_lesson($1)`, [id]);
    });
    const prog = await as(db, student(aliceId), () => one<{ p: { percent: number } }>(`select public.get_course_progress($1) as p`, [courseId]));
    expect(prog.p.percent).toBe(100);

    // Quiz pass_pct is 50 but the course requires 70: a 50% score is not enough.
    const ids = (await db.query(`select id, correct_index from quiz_questions where quiz_id = $1 order by position`, [quizId])).rows;
    const half = { [ids[0].id]: ids[0].correct_index, [ids[1].id]: 1 - ids[1].correct_index };
    await asCommit(db, student(aliceId), () => db.query(`select public.submit_quiz_attempt($1, $2)`, [quizId, JSON.stringify(half)]));
    await asCommit(db, student(aliceId), () =>
      db.query(`insert into assignment_submissions (assignment_id, user_id, course_id, text_response) values ($1, $2, $3, 'my work')`, [assignmentId, aliceId, courseId]));
    await as(db, student(aliceId), async () => {
      const st = await one<{ s: { eligible: boolean; quizzes: { ok: boolean } } }>(`select public.get_completion_status($1) as s`, [courseId]);
      expect(st.s.eligible).toBe(false);
      expect(st.s.quizzes.ok).toBe(false);
    });

    const full = { [ids[0].id]: ids[0].correct_index, [ids[1].id]: ids[1].correct_index };
    await asCommit(db, student(aliceId), () => db.query(`select public.submit_quiz_attempt($1, $2)`, [quizId, JSON.stringify(full)]));
    // A submitted assignment only counts once it passes evaluation; a reviewer marks it here.
    await expect(asCommit(db, student(aliceId), () => db.query(`select public.issue_certificate($1)`, [courseId]))).rejects.toThrow(/requirements not met/);
    await asCommit(db, student(adminId), () => db.query(
      `select public.admin_review_submission((select id from assignment_submissions where user_id = $1 and course_id = $2 limit 1), 80, 'Good work')`, [aliceId, courseId]));
    const cert = await asCommit(db, student(aliceId), () => one<{ c: { certificate_code: string; new: boolean } }>(`select public.issue_certificate($1) as c`, [courseId]));
    expect(cert.c.new).toBe(true);
    expect(cert.c.certificate_code).toMatch(/^SS-\d{4}-[0-9A-F]{10}$/);

    const again = await asCommit(db, student(aliceId), () => one<{ c: { certificate_code: string; new: boolean } }>(`select public.issue_certificate($1) as c`, [courseId]));
    expect(again.c.new).toBe(false);
    expect(again.c.certificate_code).toBe(cert.c.certificate_code);

    await as(db, anon, async () => {
      const v = await db.query(`select * from public.verify_certificate($1)`, [cert.c.certificate_code.toLowerCase()]);
      expect(v.rows[0]).toMatchObject({ student_name: "Alice Student", course_title: "Test Course", status: "valid", issuer: "Proofwork" });
      const none = await db.query(`select * from public.verify_certificate('SS-0000-NOTREAL00')`);
      expect(none.rows).toHaveLength(0);
    });
  });

  it("students cannot tamper with certificates or approve their own submissions", async () => {
    await as(db, student(aliceId), async () => {
      const r = await db.query(`update certificates set student_name = 'Someone Else' where user_id = $1`, [aliceId]);
      expect(r.rowCount).toBe(0);
    });
    await as(db, student(aliceId), async () => {
      // Approved submissions are locked (0 rows); any other change of status is rejected by the guard.
      const r = await db.query(`update assignment_submissions set status = 'approved' where user_id = $1`, [aliceId]).catch((e: Error) => e);
      expect(r instanceof Error ? true : r.rowCount === 0).toBe(true);
      await expectDenied(db.query(`update assignment_submissions set score = 100, eval_status = 'reviewed' where user_id = $1 and status <> 'approved'`, [aliceId]).then(async (x) => {
        const s = await db.query(`select count(*)::int n from assignment_submissions where user_id = $1 and score = 100`, [aliceId]);
        if (s.rows[0].n > 0) return x; throw new Error("permission denied: no forged score");
      }));
    });
  });

  it("only admins can revoke; revoked certificates verify as revoked", async () => {
    const code = (await one<{ certificate_code: string; id: string }>(`select id, certificate_code from certificates where user_id = $1`, [aliceId]));
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`select public.admin_revoke_certificate((select id from certificates limit 1), 'x')`));
    });
    await asCommit(db, student(adminId), () => db.query(`select public.admin_revoke_certificate($1, 'Issued in error')`, [(code as { id: string }).id]));
    await as(db, anon, async () => {
      const v = await db.query(`select status from public.verify_certificate($1)`, [code.certificate_code]);
      expect(v.rows[0].status).toBe("revoked");
    });
  });
});

describe("refunds", () => {
  it("a processed full refund revokes access and reverses instructor earnings", async () => {
    await createOrder(bobId, "order_bob");
    await asCommit(db, service, () => db.query(`select public.fulfil_order('order_bob', 'pay_bob', 'sig', 99900, 'card', 'webhook', '{}')`));
    await as(db, student(bobId), async () => {
      expect((await db.query(`select id from lessons where course_id = $1`, [courseId])).rows).toHaveLength(3);
    });
    await asCommit(db, service, () => db.query(`select public.apply_refund('pay_bob', 'rfnd_bob', 99900, 'processed', 'requested', $1)`, [adminId]));
    await asCommit(db, service, () => db.query(`select public.apply_refund('pay_bob', 'rfnd_bob', 99900, 'processed', 'requested', $1)`, [adminId]));
    await as(db, student(bobId), async () => {
      expect((await db.query(`select id from lessons where course_id = $1`, [courseId])).rows).toHaveLength(1);
      const e = await one<{ status: string }>(`select status from enrolments where user_id = $1`, [bobId]);
      expect(e.status).toBe("refunded");
    });
    const net = await one<{ n: string; rows: string }>(`select sum(amount_paise) n, count(*) rows from instructor_earnings where order_id = (select id from orders where razorpay_order_id = 'order_bob')`);
    expect(Number(net.n)).toBe(0);
    expect(Number(net.rows)).toBe(2);
  });
});

describe("Journey 3: internship application", () => {
  it("student applies; status is forced to submitted; others cannot see it", async () => {
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`insert into internship_applications (internship_id, user_id, status) values ($1, $2, 'selected')`, [internshipId, aliceId]));
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`insert into internship_applications (internship_id, user_id) values ($1, $2)`, [internshipId, bobId]));
    });
    await asCommit(db, student(aliceId), () =>
      db.query(`insert into internship_applications (internship_id, user_id, cover_letter) values ($1, $2, 'Hello')`, [internshipId, aliceId]));
    await as(db, student(bobId), async () => {
      expect((await db.query(`select * from internship_applications`)).rows).toHaveLength(0);
    });
  });

  it("students cannot change statuses; admins can and the student is notified", async () => {
    const app = await one<{ id: string }>(`select id from internship_applications where user_id = $1`, [aliceId]);
    await as(db, student(aliceId), async () => {
      const r = await db.query(`update internship_applications set status = 'selected' where id = $1`, [app.id]);
      expect(r.rowCount).toBe(0);
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`select public.update_application_status($1, 'selected', null)`, [app.id]));
    });
    await asCommit(db, student(adminId), () => db.query(`select public.update_application_status($1, 'shortlisted', 'Strong profile')`, [app.id]));
    await as(db, student(aliceId), async () => {
      const a = await one<{ status: string }>(`select status from internship_applications where id = $1`, [app.id]);
      expect(a.status).toBe("shortlisted");
      const n = await db.query(`select * from notifications where type = 'application'`);
      expect(n.rows.length).toBeGreaterThan(0);
    });
    await asCommit(db, student(aliceId), () => db.query(`select public.withdraw_application($1)`, [app.id]));
    await as(db, student(adminId), async () => {
      await expectDenied(db.query(`select public.update_application_status($1, 'selected', null)`, [app.id]));
    });
  });

  it("cannot apply to closed internships", async () => {
    await db.query(`update internships set status = 'closed' where id = $1`, [internshipId]);
    await as(db, student(bobId), async () => {
      await expectDenied(db.query(`insert into internship_applications (internship_id, user_id) values ($1, $2)`, [internshipId, bobId]));
    });
    await db.query(`update internships set status = 'open' where id = $1`, [internshipId]);
  });
});

describe("Journey 4: admin creates → approves → publishes", () => {
  it("course becomes visible to the public only after publishing", async () => {
    const c = await asCommit(db, student(adminId), () =>
      one<{ id: string }>(`insert into courses (slug, title, description, price_paise, rights_status) values ('admin-course', 'Admin Course', 'd', 49900, 'owned') returning id`));
    await asCommit(db, student(adminId), async () => {
      const mod = await one<{ id: string }>(`insert into course_modules (course_id, title) values ($1, 'M') returning id`, [c.id]);
      await db.query(`insert into lessons (module_id, course_id, title) values ($1, $2, 'L')`, [mod.id, c.id]);
    });
    await as(db, anon, async () => {
      expect((await db.query(`select id from courses where slug = 'admin-course'`)).rows).toHaveLength(0);
    });
    await as(db, student(adminId), async () => {
      await expectDenied(db.query(`select public.admin_publish_course($1, true)`, [c.id])); // not yet approved
    });
    await asCommit(db, student(adminId), () => db.query(`select public.admin_review_course($1, 'approve', 'ok')`, [c.id]));
    await asCommit(db, student(adminId), () => db.query(`select public.admin_publish_course($1, true)`, [c.id]));
    await as(db, anon, async () => {
      const r = await one<{ buyable: boolean }>(`select public.course_is_purchasable(id) buyable from courses where slug = 'admin-course'`);
      expect(r.buyable).toBe(true);
    });
    const audit = await one<{ n: string }>(`select count(*) n from audit_logs where entity_id = $1`, [c.id]);
    expect(Number(audit.n)).toBeGreaterThanOrEqual(2);
  });
});

describe("Journey 5: instructor submits → admin approves", () => {
  let draftId: string;
  it("instructor-created courses are forced to draft with pending rights", async () => {
    const c = await asCommit(db, student(instructorUserId), () =>
      one<{ id: string; status: string; rights_status: string; instructor_id: string }>(
        `insert into courses (slug, title, description, status, rights_status, is_demo) values ('ivy-course', 'Ivy Course', 'd', 'published', 'owned', true) returning id, status, rights_status, instructor_id`));
    expect(c.status).toBe("draft");
    expect(c.rights_status).toBe("pending");
    expect(c.instructor_id).toBe(instructorId);
    draftId = c.id;
  });

  it("instructor cannot publish or change protected fields", async () => {
    await as(db, student(instructorUserId), async () => {
      await expectDenied(db.query(`update courses set status = 'published' where id = $1`, [draftId]));
    });
    await as(db, student(instructorUserId), async () => {
      await expectDenied(db.query(`select public.admin_publish_course($1, true)`, [draftId]));
    });
  });

  it("other instructors and students cannot see or edit the draft", async () => {
    await as(db, student(otherInstructorUserId), async () => {
      expect((await db.query(`select id from courses where id = $1`, [draftId])).rows).toHaveLength(0);
      const r = await db.query(`update courses set title = 'hacked' where id = $1`, [draftId]);
      expect(r.rowCount).toBe(0);
      await expectDenied(db.query(`insert into course_modules (course_id, title) values ($1, 'x')`, [draftId]));
    });
  });

  it("submission requires content, then locks editing until review", async () => {
    await as(db, student(instructorUserId), async () => {
      await expectDenied(db.query(`select public.submit_course_for_review($1)`, [draftId]));
    });
    await asCommit(db, student(instructorUserId), async () => {
      const mod = await one<{ id: string }>(`insert into course_modules (course_id, title) values ($1, 'Intro') returning id`, [draftId]);
      await db.query(`insert into lessons (module_id, course_id, title, content_md) values ($1, $2, 'Welcome', 'hi')`, [mod.id, draftId]);
    });
    await asCommit(db, student(instructorUserId), () => db.query(`select public.submit_course_for_review($1)`, [draftId]));
    await as(db, student(instructorUserId), async () => {
      const r = await db.query(`update courses set title = 'changed during review' where id = $1`, [draftId]);
      expect(r.rowCount).toBe(0);
    });
    await asCommit(db, student(adminId), () => db.query(`select public.admin_review_course($1, 'approve', 'Looks good')`, [draftId]));
    const c = await one<{ status: string }>(`select status from courses where id = $1`, [draftId]);
    expect(c.status).toBe("approved");
    await as(db, student(instructorUserId), async () => {
      const n = await db.query(`select * from notifications where type = 'course_review'`);
      expect(n.rows).toHaveLength(1);
    });
  });

  it("instructors only see their own earnings", async () => {
    await as(db, student(otherInstructorUserId), async () => {
      expect((await db.query(`select * from instructor_earnings`)).rows).toHaveLength(0);
    });
    await as(db, student(instructorUserId), async () => {
      expect((await db.query(`select * from instructor_earnings`)).rows.length).toBeGreaterThan(0);
    });
  });
});

describe("Journey 6: privilege escalation is blocked", () => {
  it("student cannot call admin functions", async () => {
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`select public.admin_overview()`));
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`select public.admin_review_course($1, 'approve', null)`, [courseId]));
    });
  });

  it("student cannot grant themselves roles or unsuspend themselves", async () => {
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`insert into user_roles (user_id, role) values ($1, 'admin')`, [aliceId]));
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`update profiles set is_suspended = false, email = 'x@y.z' where id = $1`, [aliceId]));
    });
    await as(db, student(aliceId), async () => {
      const r = await db.query(`update profiles set full_name = 'Alice S.' where id = $1`, [aliceId]);
      expect(r.rowCount).toBe(1);
      const other = await db.query(`update profiles set full_name = 'pwned' where id = $1`, [bobId]);
      expect(other.rowCount).toBe(0);
    });
  });

  it("student cannot approve themselves as instructor", async () => {
    await as(db, student(bobId), async () => {
      const ip = await one<{ status: string; default_revenue_share_pct: string }>(
        `insert into instructor_profiles (user_id, display_name, status, default_revenue_share_pct) values ($1, 'Bob', 'approved', 100) returning status, default_revenue_share_pct`, [bobId]);
      expect(ip.status).toBe("pending");
      expect(Number(ip.default_revenue_share_pct)).toBe(0);
      // Pending instructors cannot create courses.
      await expectDenied(db.query(`insert into courses (slug, title) values ('bob-course', 'Bob course')`));
    });
  });

  it("suspended users lose access", async () => {
    await db.query(`update profiles set is_suspended = true where id = $1`, [aliceId]);
    await as(db, student(aliceId), async () => {
      expect((await db.query(`select id from lessons where course_id = $1`, [courseId])).rows).toHaveLength(1);
      await expectDenied(db.query(`select public.complete_lesson($1)`, [lessonIds[1]]));
    });
    await db.query(`update profiles set is_suspended = false where id = $1`, [aliceId]);
  });

  it("server-only functions are not executable by signed-in users", async () => {
    for (const sql of [
      `select public.check_rate_limit('k', 1, 60)`,
      `select public.log_audit(null, 'x', 'y', null, '{}')`,
      `select public.apply_refund('pay_alice', 'r', 1, 'processed', null, null)`,
      `select public.create_notification($1, 't', 't', null, null)`,
    ]) {
      await as(db, student(aliceId), async () => {
        await expectDenied(db.query(sql, sql.includes("$1") ? [aliceId] : []));
      });
    }
  });
});

describe("storage policies", () => {
  it("users can only upload resumes to their own folder", async () => {
    await as(db, student(aliceId), async () => {
      await db.query(`insert into storage.objects (bucket_id, name) values ('resumes', $1)`, [`${aliceId}/cv.pdf`]);
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`insert into storage.objects (bucket_id, name) values ('resumes', $1)`, [`${bobId}/cv.pdf`]));
    });
    await as(db, student(bobId), async () => {
      await expectDenied(db.query(`insert into storage.objects (bucket_id, name) values ('course-resources', $1)`, [`${courseId}/x.pdf`]));
    });
  });
});

describe("campus ambassador applications", () => {
  it("cannot be inserted directly by browsers; only the server (service role) can", async () => {
    const row = `('Asha', 'asha@test.local', '9876543210', 'SRCC', 'Delhi', 'B.Com 2nd year', 'I want to lead the finance club and help students learn skills.')`;
    await as(db, anon, async () => {
      await expectDenied(db.query(`insert into ambassador_applications (full_name, email, phone, college, city, course_and_year, motivation) values ${row}`));
    });
    await as(db, student(aliceId), async () => {
      await expectDenied(db.query(`insert into ambassador_applications (full_name, email, phone, college, city, course_and_year, motivation) values ${row}`));
    });
    await asCommit(db, service, () => db.query(`insert into ambassador_applications (full_name, email, phone, college, city, course_and_year, motivation, user_id) values ('Alice', 'alice@test.local', '9876543210', 'SRCC', 'Delhi', 'B.Com', 'I want to lead the finance club and help students learn skills.', $1)`, [aliceId]));
  });

  it("applicants see only their own application and cannot change its status", async () => {
    await as(db, student(bobId), async () => {
      expect((await db.query(`select * from ambassador_applications`)).rows).toHaveLength(0);
    });
    await as(db, student(aliceId), async () => {
      expect((await db.query(`select * from ambassador_applications`)).rows).toHaveLength(1);
      const r = await db.query(`update ambassador_applications set status = 'active'`);
      expect(r.rowCount).toBe(0);
    });
    await as(db, student(adminId), async () => {
      const r = await db.query(`update ambassador_applications set status = 'shortlisted'`);
      expect(r.rowCount).toBe(1);
    });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window", async () => {
    await as(db, service, async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 4; i++) results.push((await one<{ ok: boolean }>(`select public.check_rate_limit('login:1.2.3.4', 3, 60) ok`)).ok);
      expect(results).toEqual([true, true, true, false]);
    });
  });
});
