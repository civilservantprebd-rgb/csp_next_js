/**
 * Clear all CONTENT data from the BCS One Supabase database.
 *
 * Deletes (in FK-safe order):
 *   exam_questions_link, submissions, enroll_requests, topic_questions,
 *   question_bank, exams
 * Clears:
 *   app_settings.archived_questions
 * Keeps:
 *   allowed_students (student records), Supabase Auth users (student/admin
 *   login info), app_settings config (courses/topics/drive links).
 *
 * Usage:
 *   node scripts/clear-db.js          # dry run — prints the plan only
 *   node scripts/clear-db.js --yes    # actually deletes
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * This is DESTRUCTIVE and irreversible — run with --yes only after confirming.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(file) {
  const out = {};
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(path.join(__dirname, "..", ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const DRY = !process.argv.includes("--yes");

const supabase = createClient(url, key, { auth: { persistSession: false } });

// FK-safe order: links before question_bank/exams, submissions/enroll independent.
// exam_questions_link is a pure join table WITHOUT an id column, so it needs a
// filter on order_index; every other table has an id column.
const TABLES = [
  { name: "exam_questions_link", filterCol: "order_index", filterVal: -99999 },
  { name: "submissions", filterCol: "id", filterVal: "00000000-0000-0000-0000-000000000000" },
  { name: "enroll_requests", filterCol: "id", filterVal: "00000000-0000-0000-0000-000000000000" },
  { name: "topic_questions", filterCol: "id", filterVal: "00000000-0000-0000-0000-000000000000" },
  { name: "question_bank", filterCol: "id", filterVal: "00000000-0000-0000-0000-000000000000" },
  { name: "exams", filterCol: "id", filterVal: "00000000-0000-0000-0000-000000000000" }
];

async function countRows(t) {
  const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${t} count failed: ${error.message}`);
  return count ?? 0;
}

async function clearTable(table) {
  const t = table.name;
  const before = await countRows(t);
  console.log(`  ${t}: ${before} row(s) -> delete`);
  if (DRY) return;
  const { error } = await supabase.from(t).delete().neq(table.filterCol, table.filterVal);
  if (error) throw new Error(`${t} delete failed: ${error.message}`);
  const after = await countRows(t);
  console.log(`  ${t}: ${before} -> ${after} (cleared)`);
}

async function clearArchive() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("archived_questions")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw new Error(`app_settings read failed: ${error.message}`);
  const n = Array.isArray(data?.archived_questions) ? data.archived_questions.length : 0;
  console.log(`  app_settings.archived_questions: ${n} item(s) -> clear`);
  if (DRY) return;
  if (n > 0) {
    const { error: uerr } = await supabase
      .from("app_settings")
      .update({ archived_questions: [] })
      .eq("id", "main");
    if (uerr) throw new Error(`app_settings update failed: ${uerr.message}`);
    console.log("  app_settings.archived_questions: cleared");
  }
}

(async () => {
  console.log(DRY ? "=== DRY RUN (no changes) ===" : "=== DELETING CONTENT DATA ===");
  console.log("Tables to clear:");
  try {
    for (const t of TABLES) {
      await clearTable(t);
    }
    await clearArchive();
    console.log("---");
    if (DRY) {
      console.log("Dry run finished. Run with --yes to actually delete.");
    } else {
      console.log("Done. Kept: allowed_students, Supabase Auth users, app_settings config.");
    }
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exit(1);
  }
})();
