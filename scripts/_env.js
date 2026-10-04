/**
 * এই ফোল্ডারের স্ক্রিপ্টগুলোর জন্য `.env.local` পড়ার ছোট হেল্পার।
 *
 * কেন হাতে লেখা: এই রেপোতে `dotenv` ডিপেন্ডেন্সি নেই, আর শুধু একটা ফাইল
 * পড়ার জন্য নতুন প্যাকেজ যোগ করা বাহুল্য। Next.js নিজেই `.env.local` লোড করে,
 * কিন্তু `node script.js` চালালে সেটা হয় না — তাই স্ক্রিপ্টের জন্য এখানে।
 *
 * ── নিরাপত্তা নিয়ম (মেনে চলা বাধ্যতামূলক) ──
 * কী কখনো এই ফাইল বা কোনো স্ক্রিপ্টে হার্ডকোড করা যাবে না। একবার রিপোজিটরিতে
 * ঢুকে গেলে সেটা আর "মুছে ফেলা" যায় না — ইতিহাসে থেকে যায়, আর চুরি হয়ে গেলে
 * শুধু rotate করেই সমাধান হয়। (২০২৬-০৯-৩০: ঠিক এই ভুলটাই ধরা পড়েছে —
 * public রেপোতে `SUPABASE_SERVICE_ROLE_KEY` কমিট হয়ে গিয়েছিল।)
 */
const fs = require("fs");
const path = require("path");

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // ইচ্ছাকৃত কোট ছাড়ানো (Next.js-এর মতোই)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** `.env.local` (রেপো-রুট) — তারপর প্রসেস env দিয়ে ওভাররাইড। */
function loadEnvLocal(rootDir) {
  const file = path.join(rootDir || path.join(__dirname, ".."), ".env.local");
  const fileEnv = parseEnvFile(file);
  return { ...fileEnv, ...process.env };
}

module.exports = { loadEnvLocal, parseEnvFile };
