/**
 * ডেটাবেজের কয়েকটি টেবিল থেকে এক-একটি নমুনা সারি দেখা — দ্রুত স্যানিটি চেক।
 *
 * ⚠️ এখানে আগে **সার্ভিস-রোল কী হার্ডকোড করা ছিল** (এবং এটা public রেপোজিটরিতে
 * কমিট হয়ে গিয়েছিল)। এখন কী শুধু `.env.local` থেকে পড়া হয় — কী কখনো কোডে
 * লেখা হবে না। লিক হওয়া কী বাতিল (rotate) করা ছাড়া এই ফাইল বদলালেও লাভ নেই।
 *
 * চালানো: node fetch_data.js
 */
const { createClient } = require("@supabase/supabase-js");
const { loadEnvLocal } = require("./scripts/_env");

const env = loadEnvLocal(__dirname);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL ও SUPABASE_SERVICE_ROLE_KEY দরকার — .env.local-এ রাখুন (git-ignored)।"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const tables = ["exams", "question_bank", "exam_questions_link", "submissions"];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*").limit(1);
    if (error) {
      console.log(`Table ${t}: error — ${error.message}`);
      continue;
    }
    // নমুনা সারিতে প্রশ্নের সঠিক উত্তর (`correct`) থাকতে পারে — পুরো সারি
    // ছাপানো শুধু ডেভ-টার্মিনালে, কিন্তু কী-কলাম থাকলে ট্রাঙ্কেট করা হয়।
    console.log(`Table ${t}:`, JSON.stringify(data?.[0])?.slice(0, 300));
  }
}

run();
