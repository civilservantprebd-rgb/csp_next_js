/**
 * Supabase-এ সংযোগ ও `exam_questions_link` জয়েন ঠিক আছে কি না — দ্রুত পরীক্ষা।
 *
 * ⚠️ এখানে আগে **সার্ভিস-রোল কী হার্ডকোড করা ছিল** (public রেপোতে কমিট হয়ে
 * গিয়েছিল)। এখন কী `.env.local` থেকে পড়া হয়। লিক হওয়া কী অবশ্যই rotate
 * করতে হবে — কোড থেকে মুছে দিলে কী আর অচল হয় না।
 *
 * চালানো: node scripts/test-supabase.js
 */
const { createClient } = require("@supabase/supabase-js");
const { loadEnvLocal } = require("./_env");

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL ও SUPABASE_SERVICE_ROLE_KEY দরকার — .env.local-এ রাখুন (git-ignored)।"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

async function testFetch() {
  const { data: examData } = await supabase.from("exams").select("id").limit(1);
  if (!examData || examData.length === 0) return;
  const examId = examData[0].id;
  console.log("Exam ID:", examId);

  const { data: links, error } = await supabase
    .from("exam_questions_link")
    .select("order_index, question_bank(id, q, opts, correct, exp, topic)")
    .eq("exam_id", examId);

  console.log("Links error:", error);
  console.log("Links fetched:", links ? links.length : 0);
}

testFetch();
