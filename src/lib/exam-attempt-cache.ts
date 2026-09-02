/**
 * "একবারই অংশগ্রহণ" চেকের ক্লায়েন্ট-সাইড ফাস্ট ক্যাশ
 *
 * সমস্যা: প্রতি বার "আবার অংশগ্রহণের" চেষ্টায় সার্ভার-অ্যাকশন চলে —
 * sessionOwnsStudent (Supabase auth verify) + submissions-এ SELECT — মানে
 * ২টা নেটওয়ার্ক রাউন্ড-ট্রিপ (বাংলাদেশ থেকে ~০.৫–১.৫ সেকেন্ড)। তাই ওয়ার্নিং
 * ধীর মনে হয়।
 *
 * সমাধান (বর্তমান লজিক অপরিবর্তিত): একবার সার্ভার নিশ্চিত করলে (সাবমিশন সফল
 * অথবা checkStudentAlreadySubmitted = true) সেই exam_key ব্রাউজারে (localStorage)
 * + মেমোরিতে ক্যাশ করা থাকে। পরের চেষ্টায় ক্যাশ মিললেই **সাথে সাথে** ওয়ার্নিং
 * দেখানো হয় — কোনো নেটওয়ার্ক কল ছাড়াই। সার্ভার চেকই চূড়ান্ত কর্তৃপক্ষ থাকে
 * (submit-এ unique index এখনো আছেই); ক্যাশ শুধু দ্রুত পথ।
 *
 * TTL (৬ ঘণ্টা): শিক্ষক কোনো কারণে সাবমিশন ডিলিট করে পুনরায় পরীক্ষা দিতে দিলে
 * ৬ ঘণ্টা পরে ক্যাশ মেয়াদোত্তীর্ণ হয়ে সার্ভার-চেক আবার চালু হয় — স্থায়ীভাবে
 * ভুল ব্লক হয় না।
 */

const CACHE_KEY_PREFIX = "csp_completed_exams_";
/** ক্যাশ কতক্ষণ "ফ্রেশ" ধরা হবে — এর পরে আবার সার্ভার চেক (নিরাপত্তা)। */
const FRESH_TTL_MS = 6 * 60 * 60 * 1000;
/** প্রতি স্টুডেন্টে সর্বোচ্চ ক্যাশ করা exam-key সংখ্যা (ছোট — কোনো বোঝা নয়)। */
const MAX_KEYS = 2000;

function storageKey(studentId: string): string {
  return `${CACHE_KEY_PREFIX}${studentId}`;
}

function readFromStorage(studentId: string): Map<string, number> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(storageKey(studentId));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const m = new Map<string, number>();
    if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === "number" && v > 0) m.set(k, v);
      });
    }
    return m;
  } catch {
    return new Map();
  }
}

/** মেমোরি ক্যাশ (পেজ-সেশনে দ্রুত পড়া; localStorage-এ write-through)। */
const memCache = new Map<string, Map<string, number>>();

function getMap(studentId: string): Map<string, number> {
  if (!studentId) return new Map();
  if (!memCache.has(studentId)) memCache.set(studentId, readFromStorage(studentId));
  return memCache.get(studentId)!;
}

function persist(studentId: string, m: Map<string, number>): void {
  if (typeof window === "undefined" || !studentId) return;
  try {
    localStorage.setItem(storageKey(studentId), JSON.stringify(Object.fromEntries(m)));
  } catch {
    // ignore (private mode / full) — মেমোরি ক্যাশই যথেষ্ট
  }
}

/** সার্ভার নিশ্চিত হওয়ার পর exam_key চিহ্নিত করে রাখে (সাবমিশন সফল / চেক true)। */
export function markExamAttempted(studentId: string, examKey: string): void {
  if (!studentId || !examKey) return;
  const m = getMap(studentId);
  m.set(examKey, Date.now());

  // বড় হলে সবচেয়ে পুরোনোটা বাদ
  if (m.size > MAX_KEYS) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    m.forEach((ts, k) => {
      if (ts < oldestTs) {
        oldestTs = ts;
        oldestKey = k;
      }
    });
    if (oldestKey) m.delete(oldestKey);
  }
  persist(studentId, m);
}

/** ক্যাশে আছে কি না (ফ্রেশ TTL-এর মধ্যে) — কোনো নেটওয়ার্ক কল নেই। */
export function isAttemptCached(studentId: string, examKey: string): boolean {
  if (!studentId || !examKey) return false;
  const ts = getMap(studentId).get(examKey);
  return !!ts && Date.now() - ts < FRESH_TTL_MS;
}

/**
 * ফাস্ট-পাথ চেক: ক্যাশে ফ্রেশ রেকর্ড থাকলে true (সাথে সাথে)।
 * নাহলে আগের মতোই সার্ভার-অ্যাকশন checkStudentAlreadySubmitted চলে
 * (লজিক অপরিবর্তিত); সার্ভার true বললে ক্যাশও লেখা হয় — পরের বার instant।
 */
export async function checkAttemptBlocked(examKey: string, studentId: string): Promise<boolean> {
  if (!studentId || !examKey) return false;
  if (isAttemptCached(studentId, examKey)) return true;
  try {
    const { checkStudentAlreadySubmitted } = await import("@/actions/exam-actions");
    const already = await checkStudentAlreadySubmitted(examKey, studentId);
    if (already) markExamAttempted(studentId, examKey);
    return already;
  } catch {
    return false; // ত্রুটি হলে ব্লক না করা — সার্ভার submit-এ আবার যাচাই করবেই
  }
}
