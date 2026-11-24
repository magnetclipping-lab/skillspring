/**
 * Assessment platform: quiz question types, versioned submissions, the delayed
 * evaluation queue, answer-key secrecy and human override.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, asCommit, connect, createUser, resetDatabase, service, student, type Db } from "./helpers";

const DB = "proofwork_assessment_vitest";
let db: Db;
let adminId: string, aliceId: string, bobId: string;
let courseId: string, quizId: string, assignmentId: string, manualAssignmentId: string;
const q: Record<string, string> = {};

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const { rows } = await db.query(sql, params);
  return rows[0] as T;
}

beforeAll(async () => {
  await resetDatabase(DB);
  db = await connect(DB);
  adminId = await createUser(db, "admin@a.local", "Admin", ["admin"]);
  aliceId = await createUser(db, "alice@a.local", "Alice");
  bobId = await createUser(db, "bob@a.local", "Bob");
  courseId = (await one<{ id: string }>(
    `insert into courses (slug, title, description, price_paise, status, rights_status) values ('assess', 'Assess', 'd', 750000, 'published', 'owned') returning id`)).id;
  await db.query(`insert into enrolments (user_id, course_id, source) values ($1, $2, 'admin_grant')`, [aliceId, courseId]);
  quizId = (await one<{ id: string }>(`insert into quizzes (course_id, title, pass_pct) values ($1, 'Mixed', 60) returning id`, [courseId])).id;
  const ins = async (key: string, cols: string, vals: unknown[]) => {
    q[key] = (await one<{ id: string }>(`insert into quiz_questions (quiz_id, ${cols}) values (${vals.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, vals)).id;
  };
  await ins("single", "prompt, qtype, options, correct_index, position", [quizId, "Pick b", "single", JSON.stringify(["a", "b"]), 1, 1]);
  await ins("multi", "prompt, qtype, options, correct, position", [quizId, "Pick a and c", "multi", JSON.stringify(["a", "b", "c"]), JSON.stringify([0, 2]), 2]);
  await ins("tf", "prompt, qtype, options, correct_index, position", [quizId, "Sky is blue", "true_false", JSON.stringify(["True", "False"]), 0, 3]);
  await ins("match", "prompt, qtype, options, correct, position", [quizId, "Match", "match", JSON.stringify({ left: ["CTR", "CPC"], right: ["cost per click", "click-through rate"] }), JSON.stringify([1, 0]), 4]);
  await ins("fill", "prompt, qtype, correct, position", [quizId, "Excel function ___ looks up values", "fill_blank", JSON.stringify([["XLOOKUP", "VLOOKUP"]]), 5]);

  assignmentId = (await one<{ id: string }>(
    `insert into assignments (course_id, title, instructions, kind, max_score, pass_pct, rubric) values ($1, 'Dashboard', 'Build it', 'file', 100, 50, '[{"criterion":"Accuracy","points":100}]') returning id`, [courseId])).id;
  manualAssignmentId = (await one<{ id: string }>(
    `insert into assignments (course_id, title, instructions, kind, ai_evaluation) values ($1, 'Pitch', 'Record it', 'practical', false) returning id`, [courseId])).id;
  await db.query(`insert into assignment_answer_keys (assignment_id, answer_key) values ($1, 'Total revenue = 1,24,500')`, [assignmentId]);
});

afterAll(async () => {
  await db?.end();
});

describe("quiz question types", () => {
  it("never returns answers to learners", async () => {
    await as(db, student(aliceId), async () => {
      const r = await one<{ q: { questions: Record<string, unknown>[] } }>(`select public.get_quiz($1) as q`, [quizId]);
      expect(r.q.questions).toHaveLength(5);
      for (const x of r.q.questions) {
        expect(x).not.toHaveProperty("correct");
        expect(x).not.toHaveProperty("correct_index");
      }
      expect(r.q.questions.find((x) => x.qtype === "fill_blank")?.blanks).toBe(1);
      const direct = await db.query(`select * from quiz_questions where quiz_id = $1`, [quizId]);
      expect(direct.rows).toHaveLength(0);
    });
  });

  it("grades every type deterministically, case- and space-insensitive for blanks", async () => {
    const answers = { [q.single]: 1, [q.multi]: [2, 0], [q.tf]: 0, [q.match]: [1, 0], [q.fill]: ["  xlookup "] };
    const r = await as(db, student(aliceId), () => one<{ r: { score_pct: number; correct: number } }>(`select public.submit_quiz_attempt($1, $2) as r`, [quizId, JSON.stringify(answers)]));
    expect(r.r.correct).toBe(5);
    expect(r.r.score_pct).toBe(100);

    const wrong = { [q.single]: 0, [q.multi]: [0], [q.tf]: 0, [q.match]: [0, 1], [q.fill]: ["SUM"] };
    const w = await as(db, student(aliceId), () => one<{ r: { score_pct: number; passed: boolean } }>(`select public.submit_quiz_attempt($1, $2) as r`, [quizId, JSON.stringify(wrong)]));
    expect(w.r.score_pct).toBe(20);
    expect(w.r.passed).toBe(false);
  });

  it("rejects malformed questions", async () => {
    await expect(db.query(`insert into quiz_questions (quiz_id, prompt, qtype, options, correct) values ($1, 'bad', 'match', '{"left":["a"],"right":["b"]}', '[0,1]')`, [quizId])).rejects.toThrow();
  });
});

describe("submissions and the evaluation queue", () => {
  let subId: string;

  it("non-enrolled learners cannot submit", async () => {
    await as(db, student(bobId), async () => {
      await expect(db.query(`insert into assignment_submissions (assignment_id, user_id, course_id, text_response) values ($1, $2, $3, 'x')`, [assignmentId, bobId, courseId])).rejects.toThrow();
    });
  });

  it("answer keys are hidden from learners", async () => {
    await as(db, student(aliceId), async () => {
      const r = await db.query(`select * from assignment_answer_keys`);
      expect(r.rows).toHaveLength(0);
    });
    await as(db, student(adminId), async () => {
      const r = await db.query(`select * from assignment_answer_keys`);
      expect(r.rows).toHaveLength(1);
    });
  });

  it("a submission schedules one evaluation ~60 minutes later and learners cannot forge scores", async () => {
    subId = (await asCommit(db, student(aliceId), () => one<{ id: string }>(
      `insert into assignment_submissions (assignment_id, user_id, course_id, file_path, file_name, score, eval_status) values ($1, $2, $3, $4, 'a.xlsx', 100, 'reviewed') returning id`,
      [assignmentId, aliceId, courseId, `${aliceId}/${courseId}/a.xlsx`]))).id;
    const s = await one<{ eval_status: string; score: string | null; version: number; mins: number }>(
      `select eval_status, score, version, extract(epoch from evaluate_after - now()) / 60 as mins from assignment_submissions where id = $1`, [subId]);
    expect(s.eval_status).toBe("pending");
    expect(s.score).toBeNull();
    expect(s.version).toBe(1);
    expect(Number(s.mins)).toBeGreaterThan(58);
    const jobs = await db.query(`select status, version from evaluation_jobs where submission_id = $1`, [subId]);
    expect(jobs.rows).toEqual([{ status: "queued", version: 1 }]);
    const hist = await db.query(`select version from submission_history where submission_id = $1`, [subId]);
    expect(hist.rows).toHaveLength(1);
  });

  it("jobs are not claimable before they are due, and only by the service role", async () => {
    const early = await as(db, service, () => db.query(`select * from public.claim_evaluation_jobs(5)`));
    expect(early.rows).toHaveLength(0);
    await as(db, student(aliceId), async () => {
      await expect(db.query(`select * from public.claim_evaluation_jobs(5)`)).rejects.toThrow();
    });
  });

  it("resubmitting creates a new version and cancels the stale job", async () => {
    await asCommit(db, student(aliceId), () => db.query(`update assignment_submissions set text_response = 'Notes on my workbook' where id = $1`, [subId]));
    const jobs = await db.query(`select status, version from evaluation_jobs where submission_id = $1 order by version`, [subId]);
    expect(jobs.rows).toEqual([{ status: "cancelled", version: 1 }, { status: "queued", version: 2 }]);
  });

  it("a due job is claimed exactly once and a superseded result is discarded", async () => {
    await db.query(`update evaluation_jobs set run_at = now() - interval '1 minute' where submission_id = $1 and version = 2`, [subId]);
    const claimed = await asCommit(db, service, () => db.query(`select * from public.claim_evaluation_jobs(5)`));
    expect(claimed.rows).toHaveLength(1);
    const again = await asCommit(db, service, () => db.query(`select * from public.claim_evaluation_jobs(5)`));
    expect(again.rows).toHaveLength(0);
    const stale = await asCommit(db, service, () => one<{ r: { skipped?: boolean } }>(
      `select public.record_evaluation($1, 1, 'ai', null, 90, '[]', 'old', 'm', 'high', false) as r`, [subId]));
    expect(stale.r.skipped).toBe(true);
  });

  it("an AI evaluation updates the submission, approves on pass and notifies the learner", async () => {
    await asCommit(db, service, () => db.query(
      `select public.record_evaluation($1, 2, 'ai', null, 72, '[{"criterion":"Accuracy","score":72,"max":100}]', 'Solid work', 'claude', 'high', false)`, [subId]));
    const s = await one<{ eval_status: string; status: string; score: string; score_source: string }>(`select eval_status, status, score, score_source from assignment_submissions where id = $1`, [subId]);
    expect(s).toMatchObject({ eval_status: "evaluated", status: "approved", score: "72.00", score_source: "ai" });
    const n = await db.query(`select title from notifications where user_id = $1 and type = 'assignment_evaluated'`, [aliceId]);
    expect(n.rows.length).toBeGreaterThan(0);
  });

  it("learners cannot override; admins can, and the history is kept", async () => {
    await as(db, student(aliceId), async () => {
      await expect(db.query(`select public.admin_review_submission($1, 100, 'x')`, [subId])).rejects.toThrow();
    });
    await asCommit(db, student(adminId), () => db.query(`select public.admin_review_submission($1, 40, 'Formulas hard-coded')`, [subId]));
    const s = await one<{ eval_status: string; status: string; score_source: string }>(`select eval_status, status, score_source from assignment_submissions where id = $1`, [subId]);
    expect(s).toMatchObject({ eval_status: "reviewed", status: "needs_revision", score_source: "human" });
    const evals = await db.query(`select evaluator from assignment_evaluations where submission_id = $1 order by created_at`, [subId]);
    expect(evals.rows.map((r) => r.evaluator)).toEqual(["ai", "human"]);
  });

  it("assignments without AI evaluation go straight to human review with no job", async () => {
    const id = (await asCommit(db, student(aliceId), () => one<{ id: string }>(
      `insert into assignment_submissions (assignment_id, user_id, course_id, links) values ($1, $2, $3, '{https://example.com/pitch}') returning id`,
      [manualAssignmentId, aliceId, courseId]))).id;
    const s = await one<{ eval_status: string }>(`select eval_status from assignment_submissions where id = $1`, [id]);
    expect(s.eval_status).toBe("needs_review");
    const jobs = await db.query(`select 1 from evaluation_jobs where submission_id = $1`, [id]);
    expect(jobs.rows).toHaveLength(0);
  });
});
