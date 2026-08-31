// Diagnostic: inspect exams, question links, and question_bank content
const fs = require("fs");
const path = require("path");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log("=== EXAMS ===");
  const { data: exams, error: e1 } = await supabase
    .from("exams")
    .select("id, title, course, subject, start_time, end_time, is_free")
    .order("id");
  if (e1) return console.log("EXAMS ERROR:", e1.message);
  for (const ex of exams || []) {
    const { count } = await supabase
      .from("exam_questions_link")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", ex.id);
    console.log(`- [${ex.id}] "${ex.title}" | course="${ex.course}" | subject="${ex.subject}" | free=${ex.is_free} | start=${ex.start_time} | end=${ex.end_time} | links=${count}`);
  }

  console.log("\n=== QUESTION BANK (sample 10, incl. empties) ===");
  const { data: bank, error: e2 } = await supabase
    .from("question_bank")
    .select("id, topic, q, opts")
    .limit(500);
  if (e2) return console.log("BANK ERROR:", e2.message);
  const empty = (bank || []).filter((b) => !b.q || !String(b.q).trim());
  const filled = (bank || []).filter((b) => b.q && String(b.q).trim());
  console.log(`total=${bank.length} | empty_q=${empty.length} | filled_q=${filled.length}`);
  (filled || []).slice(0, 5).forEach((b) => console.log(`- filled: id=${b.id} topic=${b.topic} q=${String(b.q).slice(0, 60)}`));
  (empty || []).slice(0, 5).forEach((b) => console.log(`- EMPTY: id=${b.id} topic=${b.topic} opts_len=${(b.opts || []).length}`));

  console.log("\n=== LINKS for exam_1788197505814 (with question content check) ===");
  const { data: links, error: e3 } = await supabase
    .from("exam_questions_link")
    .select("order_index, question_bank(id, q, opts, topic)")
    .eq("exam_id", "exam_1788197505814");
  if (e3) return console.log("LINKS ERROR:", e3.message);
  console.log(`link rows=${(links || []).length}`);
  const withQ = (links || []).filter((l) => l.question_bank?.q && String(l.question_bank.q).trim());
  const withoutQ = (links || []).filter((l) => !l.question_bank?.q || !String(l.question_bank.q).trim());
  console.log(`links with question text=${withQ.length} | links with EMPTY question=${withoutQ.length}`);
  (withoutQ || []).slice(0, 3).forEach((l) => console.log(`  EMPTY link: order=${l.order_index} bank_id=${l.question_bank?.id} topic=${l.question_bank?.topic}`));

  console.log("\n=== APP SETTINGS (courses/topics/pinned) ===");
  const { data: settings, error: e4 } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "main")
    .maybeSingle();
  if (e4) console.log("SETTINGS ERROR:", e4.message);
  else {
    console.log("courses:", JSON.stringify(settings?.courses));
    console.log("pinned_courses:", JSON.stringify(settings?.pinned_courses));
    console.log("topics:", JSON.stringify(settings?.topics));
  }
})();
