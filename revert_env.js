/**
 * `.env.local`-এর Supabase কী দুটো "সঠিক" মানে ফিরিয়ে আনার হেল্পার।
 *
 * ⚠️ আগে এই ফাইলে **সার্ভিস-রোল কী হার্ডকোড করা ছিল** — এবং ফাইলটা গিটে
 * কমিট হয়ে গিয়েছিল (commit `e79c18f`)। সার্ভিস-রোল কী RLS বাইপাস করে, তাই
 * সেটা রিপোজিটরিতে থাকা মানে পুরো ডেটাবেজ (শিক্ষার্থীর তালিকা, প্রশ্নব্যাংক
 * সহ উত্তর, সাবমিশন) যে কেউ পড়তে ও লিখতে পারে। লিক হওয়া কী **বাতিল (rotate)
 * করা বাধ্যতামূলক** — শুধু এই ফাইল থেকে মুছে দিলে কী আর অচল হয় না।
 *
 * এখন কী দুটোই `.env.rotate.local` (git-ignored) থেকে পড়া হয়। নতুন কী:
 *   Supabase Dashboard → Project Settings → API → rotate/publishable keys
 *
 * ব্যবহার: `.env.rotate.local`-এ `ROTATE_ANON_KEY=` / `ROTATE_SERVICE_ROLE_KEY=`
 * বসিয়ে `node revert_env.js`।
 */
const fs = require("fs");
const path = require("path");

function readRotateEnv() {
  const p = path.join(__dirname, ".env.rotate.local");
  if (!fs.existsSync(p)) {
    console.error(
      "নেই: .env.rotate.local\n" +
        "ROTATE_ANON_KEY=... এবং ROTATE_SERVICE_ROLE_KEY=... লিখে আবার চালান।\n" +
        "(এই ফাইলে কী হার্ডকোড করা হয় না — .gitignore-এ .env*.local থেকে যায়।)"
    );
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const keys = readRotateEnv();
const anon = keys.ROTATE_ANON_KEY;
const service = keys.ROTATE_SERVICE_ROLE_KEY;

if (!anon || !service) {
  console.error("ROTATE_ANON_KEY ও ROTATE_SERVICE_ROLE_KEY দুটোই দরকার।");
  process.exit(1);
}

const envPath = path.join(__dirname, ".env.local");
let c = fs.readFileSync(envPath, "utf8");

c = c.replace(
  /NEXT_PUBLIC_SUPABASE_URL=.*/,
  `NEXT_PUBLIC_SUPABASE_URL=${keys.ROTATE_SUPABASE_URL || "https://braytjbujysjydxbuqhv.supabase.co"}`
);
c = c.replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
c = c.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/, `SUPABASE_SERVICE_ROLE_KEY=${service}`);

fs.writeFileSync(envPath, c);
console.log(".env.local আপডেট হয়েছে।");
