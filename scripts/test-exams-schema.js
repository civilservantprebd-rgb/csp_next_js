/**
 * `exams` টেবিল থেকে একটি নমুনা সারি — স্কিমা বদলের পরে দ্রুত যাচাই।
 *
 * ⚠️ এখানে আগে **সার্ভিস-রোল কী হার্ডকোড করা ছিল** (public রেপোতে কমিট হয়ে
 * গিয়েছিল)। এখন কী `.env.local` থেকে পড়া হয়। লিক হওয়া কী rotate করা
 * বাধ্যতামূলক — কোড পরিষ্কার করলেই সমস্যা মিটে যায় না।
 *
 * চালানো: node scripts/test-exams-schema.js
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
  const { data, error } = await supabase.from("exams").select("*").limit(1);
  console.log(data, error);
}

testFetch();
