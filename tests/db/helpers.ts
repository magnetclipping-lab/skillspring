import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const root = join(__dirname, "..", "..");
export const TEST_DB = process.env.TEST_DATABASE_NAME ?? "skillspring_vitest";
const base = {
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "postgres",
};

/** Drops and recreates the test DB, applies the Supabase shim, migrations and seed. */
export async function resetDatabase() {
  const admin = new Client({ ...base, database: "postgres" });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const db = new Client({ ...base, database: TEST_DB });
  await db.connect();
  await db.query(readFileSync(join(root, "supabase/tests/supabase-shim.sql"), "utf8"));
  const dir = join(root, "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(join(dir, f), "utf8"));
  }
  await db.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
  await db.end();
}

export async function connect() {
  const c = new Client({ ...base, database: TEST_DB });
  await c.connect();
  return c;
}

export type Db = Client;

/** Runs fn as a Supabase role inside a transaction that is always rolled back. */
export async function as<T>(db: Db, who: { role: "anon" | "authenticated" | "service_role"; sub?: string }, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who.sub ?? "", role: who.role })]);
    await db.query(`set local role ${who.role}`);
    return await fn();
  } finally {
    await db.query("rollback");
  }
}

/** Same as `as` but commits — used to build fixtures that later steps rely on. */
export async function asCommit<T>(db: Db, who: { role: "anon" | "authenticated" | "service_role"; sub?: string }, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who.sub ?? "", role: who.role })]);
    await db.query(`set local role ${who.role}`);
    const r = await fn();
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

export async function createUser(db: Db, email: string, fullName: string, roles: ("student" | "instructor" | "admin")[] = []) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [email, fullName],
  );
  const id = rows[0].id as string;
  for (const r of roles) await db.query(`insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing`, [id, r]);
  return id;
}

export const student = (sub: string) => ({ role: "authenticated" as const, sub });
export const anon = { role: "anon" as const };
export const service = { role: "service_role" as const };
