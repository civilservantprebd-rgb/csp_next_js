import { apiFail } from "@/lib/api-auth";
import type { NextResponse } from "next/server";

/**
 * সাধারণ (in-memory) রেট লিমিট — "ডিজিটাল বাউন্সার"।
 *
 * ── কেন দরকার ──
 * টোকেন যাচাই থাকলেও ব্রুট-ফোর্স (হাজারবার লগইন/সাবমিশন), বট-স্ক্র্যাপিং আর
 * সাধারণ স্প্যাম থেকে সার্ভার ও Supabase-কে বাঁচাতে রিকোয়েস্টের গতি সীমিত
 * করা হয়। সীমা ছাড়ালে `429 Too Many Requests`।
 *
 * ── সীমাবদ্ধতা (জেনে রাখা জরুরি) ──
 * ম্যাপটা প্রসেস-মেমোরিতে থাকে, তাই:
 *   • সার্ভার রিস্টার্টে খালি হয়ে যায় (দ্রুত আবার চেষ্টা করা যায় — ঠিক আছে,
 *     কারণ স্ক্রিপ্ট-আক্রমণ কয়েক সেকেন্ডেই সীমায় ধাক্কা খায়);
 *   • একাধিক ইনস্ট্যান্স/সার্ভারলেস ফাংশনে **প্রতি ইনস্ট্যান্সে আলাদা** গণনা হয়।
 * বড় স্কেলে (Vercel + অনেক ইনস্ট্যান্স) Redis/Upstash-ভিত্তিক লিমিটার লাগবে —
 * ইন্টারফেসটা (`enforceRateLimit`) একই রাখা হয়েছে, তাই শুধু ভেতরের অংশ বদলালেই হবে।
 */

interface Window {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, Window>();

/** ম্যাপ যাতে অনির্দিষ্টকাল বাড়তে না পারে — মেয়াদোত্তীর্ণ এন্ট্রি ফেলে দেওয়া হয়। */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number): void {
  // `for...of` নয়: এই প্রকল্পের tsconfig টার্গেট পুরোনো (ES5-সদৃশ), তাই Map
  // সরাসরি ইটারেট করলে `--downlevelIteration` ছাড়া কম্পাইল হয় না।
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetTime) rateLimitMap.delete(key);
  });
}

/**
 * `true` = অনুমোদিত, `false` = সীমা ছাড়িয়েছে।
 *
 * @param key      কোন "বালতিতে" গণনা হবে (সাধারণত IP)
 * @param limit    উইন্ডোতে সর্বোচ্চ কতটি রিকোয়েস্ট
 * @param windowMs উইন্ডোর দৈর্ঘ্য (মিলিসেকেন্ড)
 */
export function checkRateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  if (rateLimitMap.size > MAX_TRACKED_KEYS) sweep(now);

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count += 1;
  return true;
}

/**
 * ক্লায়েন্টের IP। প্রক্সি/লো-ব্যালেন্সারের পেছনে আসল IP প্রথম এন্ট্রিতে থাকে।
 *
 * ⚠️ `x-forwarded-for` ক্লায়েন্ট নিজেই বানাতে পারে, তাই এটা **নিরাপত্তার
 * একমাত্র ভিত্তি নয়** — শুধু অ্যাবিউজ-থ্রটলিংয়ের জন্য। তাই IP-এর পাশাপাশি
 * (যেখানে পরিচয় আছে) uid দিয়েও গণনা করা হয়: `enforceRateLimit` দুটো বালতি
 * একসাথে দেখে, ফলে হেডার ঘুরিয়ে দিলেও পরিচয়ভিত্তিক সীমা ফাঁকি দেওয়া যায় না।
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

/**
 * এক লাইনে সীমা প্রয়োগ — সীমা ছাড়ালে `NextResponse` (429) ফেরে, নাহলে `null`।
 *
 * ব্যবহার:
 * ```ts
 * const limited = enforceRateLimit(req, { limit: 10, windowMs: 60_000 });
 * if (limited) return limited;
 * ```
 *
 * `scope` দিলে বালতিগুলো আলাদা থাকে (যেমন `"auth"`, `"submit"`), যাতে এক
 * এন্ডপয়েন্টের ব্যস্ততা আরেকটার কোটা খেয়ে না ফেলে।
 */
export function enforceRateLimit(
  req: Request,
  opts: {
    limit: number;
    windowMs?: number;
    scope?: string;
    /** যাচাই করা uid — থাকলে IP বদলেও সীমা মানতে হবে (সুপারিশকৃত)। */
    uid?: string | null;
    code?: string;
    message?: string;
  }
): NextResponse | null {
  const windowMs = opts.windowMs ?? 60_000;
  const scope = opts.scope ? `${opts.scope}:` : "";

  // ১) IP-বালতি — বট/স্ক্রিপ্ট একই মেশিন থেকে যত বেশি চেষ্টা করবে, তত দ্রুত আটকাবে
  if (!checkRateLimit(`${scope}ip:${clientIp(req)}`, opts.limit, windowMs)) {
    return rateLimited(opts.code, opts.message);
  }

  // ২) ব্যবহারকারী-বালতি — IP ঘুরিয়ে দিলেও এক অ্যাকাউন্টে সীমা একই থাকে
  if (opts.uid && !checkRateLimit(`${scope}uid:${opts.uid}`, opts.limit, windowMs)) {
    return rateLimited(opts.code, opts.message);
  }

  return null;
}

function rateLimited(code?: string, message?: string): NextResponse {
  return apiFail(
    code ?? "RATE_LIMIT_EXCEEDED",
    message ??
      "খুব দ্রুত অনেকগুলো রিকোয়েস্ট পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।",
    429
  );
}
