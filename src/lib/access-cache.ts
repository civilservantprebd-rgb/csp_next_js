/**
 * এনরোলমেন্ট-চেকের ক্লায়েন্ট-সাইড ক্যাশ
 *
 * সেলফ-প্র্যাকটিস/প্রশ্ন-ব্যাংক/স্টাডি সেকশন খুললেই UI বারবার সার্ভার-অ্যাকশন
 * verifyStudentAccess দিয়ে “স্টুডেন্ট এনরোল আছে কিনা” চেক করত। এখন:
 *
 *   • একবার লগইন করা স্টুডেন্ট এনরোল প্রমাণিত হলে (allowed) ফলাফল ব্রাউজারে
 *     (localStorage) **লগআউট পর্যন্ত** ক্যাশ থাকে — লগআউট না করলে আর বারবার
 *     চেক হয় না, সাথে সাথে UI খোলে।
 *   • denied (এনরোল নেই) হলে মাত্র ৫ মিনিট ক্যাশ — শিক্ষক অনুমোদন দিলে দ্রুতই
 *     নতুন অবস্থা ধরা পড়ে।
 *   • লগআউট করলেই (student-auth-এর logout) ক্যাশ মুছে যায় — পরের লগইনে
 *     নতুন করে সার্ভার থেকে যাচাই হয়।
 *
 * SECURITY নোট: এটা শুধু UI-র দরজা (কী দেখাব) দ্রুত করে। আসল প্রশ্ন/ডেটা
 * সার্ভার-অ্যাকশনগুলো (practice-actions, exam fetch ইত্যাদি) প্রতিটি ফেচে
 * নিজেরাই সার্ভার-সাইডে verifyStudentAccess চালায় — সেটা অপরিবর্তিত।
 */

const PREFIX = "csp_access_";
/** denied ফলাফল কতক্ষণ ক্যাশ থাকবে (allowed লগআউট পর্যন্ত থাকে)। */
const DENIED_TTL_MS = 5 * 60 * 1000; // ৫ মিনিট

export interface EnrollmentSnapshot {
  allowed: boolean;
  courses: string[];
  ts: number;
}

function cacheKey(uid: string, email?: string): string {
  return String(uid || email || "anon");
}

function storageKey(uid: string, email?: string): string {
  return `${PREFIX}${cacheKey(uid, email)}`;
}

function isFresh(snap: EnrollmentSnapshot): boolean {
  // allowed → লগআউট পর্যন্ত বৈধ (কোনো মেয়াদ নেই); denied → ৫ মিনিট
  if (snap.allowed) return true;
  return Date.now() - snap.ts < DENIED_TTL_MS;
}

function readSnapshot(uid: string, email?: string): EnrollmentSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(uid, email));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.allowed !== "boolean") return null;
    return {
      allowed: parsed.allowed,
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      ts: Number(parsed.ts) || 0
    };
  } catch {
    return null;
  }
}

function writeSnapshot(uid: string, email: string | undefined, allowed: boolean, courses: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      storageKey(uid, email),
      JSON.stringify({ allowed, courses, ts: Date.now() } satisfies EnrollmentSnapshot)
    );
  } catch {
    // ignore (private mode) — শুধু গতি, কোর ফিচার নয়
  }
}

/** ক্যাশে ফ্রেশ রেকর্ড থাকলে তা দেয়; না থাকলে null। (কোনো নেটওয়ার্ক কল নেই) */
export function getCachedEnrollment(uid: string, email?: string): { allowed: boolean; courses: string[] } | null {
  const snap = readSnapshot(uid, email);
  if (!snap || !isFresh(snap)) return null;
  return { allowed: snap.allowed, courses: snap.courses };
}

/**
 * ফাস্ট-পাথ এনরোলমেন্ট চেক:
 * ১) localStorage-এ ফ্রেশ ফলাফল → সেটাই (নেটওয়ার্ক ছাড়া)।
 * ২) না থাকলে → সার্ভার verifyStudentAccess → ফলাফল ক্যাশ করে ফেরত দেয়।
 */
export async function checkEnrollmentCached(
  uid: string,
  email?: string,
  course = "ALL"
): Promise<{ allowed: boolean; courses: string[] }> {
  if (!uid) return { allowed: false, courses: [] };

  const cached = getCachedEnrollment(uid, email);
  if (cached) return cached;

  try {
    const { verifyStudentAccess } = await import("@/actions/student-actions");
    const res = await verifyStudentAccess(uid, course, email);
    const allowed = !!res.allowed;
    const courses = Array.isArray(res.courses) ? res.courses : [];
    writeSnapshot(uid, email, allowed, courses);
    return { allowed, courses };
  } catch {
    return { allowed: false, courses: [] };
  }
}

/** লগআউট/পরিচয় বদলালে পুরোনো ফলাফল মুছে দিতে (ঐচ্ছিক)। */
export function clearEnrollmentCache(uid: string, email?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(uid, email));
  } catch {
    // ignore
  }
}
