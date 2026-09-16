import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUserFromToken, userIsTeacher } from "@/lib/teacher-auth";
import { withRequestToken } from "@/lib/request-context";

/**
 * Native অ্যাপের REST API-এর অথ ও রেসপন্স-লেয়ার
 * (NATIVE-ANDROID-GUIDE.md §৩.২ অথ মডেল, §৩.৩ API ডিজাইন নীতি)।
 *
 * ── কেন এই ফাইল ──
 * ওয়েব অ্যাপ কুকিতে (`sb_access_token`) চলে, কিন্তু Flutter অ্যাপ চলে
 * `Authorization: Bearer <supabase_access_token>` হেডারে। দুই জগতের মাঝে
 * সেতুটা এখানে: টোকেন যাচাই → পরিচয় তৈরি → ভেতরের action-গুলোকে টোকেন-প্রেক্ষাপটে
 * চালানো (`withRequestToken`)। ফলে বিদ্যমান ১০৪টি action **কোনো পরিবর্তন ছাড়াই**
 * অ্যাপ থেকেও কাজ করে।
 *
 * ── অপরিবর্তনীয় নিয়ম (গাইড §১৯) ──
 *   ১. পরিচয় সবসময় সার্ভারে যাচাই হয় (`supabase.auth.getUser`) — ক্লায়েন্টের
 *      পাঠানো uid/email কখনো বিশ্বাস করা হয় না।
 *   ২. সব রেসপন্সে সার্ভার-স্ট্যাম্পড সময় থাকে — অ্যাপ ডিভাইস-ঘড়ি ব্যবহার করবে না।
 *   ৩. এরর ফরম্যাট সবসময় `{ error: { code, message } }` (গাইড §৩.৩)।
 *   ৪. প্রশ্ন-সংক্রান্ত রেসপন্সে কখনো `correct`/`exp` থাকবে না — সেটা ভিন্ন রাউটের
 *      দায়িত্ব, তবে নিয়মটা এখান থেকে শুরু।
 */

// ─────────────────────────────────────────────────────────────────────────────
// পরিচয় (identity)
// ─────────────────────────────────────────────────────────────────────────────

/** ভবিষ্যতের teacher/admin API-র জন্য রোল-রেডি (গাইড §৩.২ — v1-এ শুধু student)। */
export type ApiRole = "student" | "teacher" | "admin";

export interface ApiIdentity {
  /** Supabase auth uid। */
  uid: string;
  email?: string;
  name?: string;
  role: ApiRole;
}

function pickDisplayName(meta: Record<string, unknown>): string | undefined {
  const candidates = [meta.full_name, meta.name, meta.display_name];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function roleOf(user: {
  app_metadata?: Record<string, unknown>;
  email?: string;
}): ApiRole {
  // SECURITY: শুধু app_metadata বিশ্বাস করা হয় — user_metadata ব্যবহারকারী নিজেই
  // বদলাতে পারে (teacher-auth.ts-এর নিয়মের সাথে হুবহু সামঞ্জস্যপূর্ণ)।
  const role = user.app_metadata?.role;
  if (role === "admin") return "admin";
  if (role === "teacher") return "teacher";
  return userIsTeacher(user) ? "teacher" : "student";
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * হেডার থেকে Bearer টোকেন। `Headers.get` case-insensitive, তাই আলাদা করে
 * `Authorization` খোঁজার দরকার নেই।
 */
export function readBearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization");
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

/**
 * টোকেন → যাচাই করা পরিচয়। অবৈধ/মেয়াদোত্তীর্ণ টোকেনে null।
 * নেটওয়ার্ক সমস্যায় `getUserFromToken` নিজেই null ফেরে (UI আটকে থাকে না)।
 */
export async function identify(accessToken?: string | null): Promise<ApiIdentity | null> {
  const user = await getUserFromToken(accessToken);
  if (!user) return null;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  return {
    uid: user.id,
    email: user.email,
    name: pickDisplayName(meta),
    role: roleOf(user),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// রেসপন্স হেল্পার
// ─────────────────────────────────────────────────────────────────────────────

/** গাইড §৩.৩-এর নির্ধারিত এরর ফরম্যাট। */
export function apiFail(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: NO_STORE }
  );
}

/**
 * সফল রেসপন্স। সার্ভারের সময় **সবসময়** যোগ করা হয় (গাইড §৩.৩) — কারণ
 * ডিভাইস-ঘড়ি বদলে দিয়ে কেউ লাইভ পরীক্ষার উইন্ডো ভাঙতে পারবে না।
 * কলারের দেওয়া `serverTimeMs` উপেক্ষা করা হয় (আমাদের মানটাই শেষে বসে)।
 */
export function apiOk<T extends Record<string, unknown>>(
  data: T,
  status = 200
): NextResponse {
  return NextResponse.json(
    {
      ...data,
      serverTimeMs: Date.now(),
      ianaTimezone: "Asia/Dhaka",
      offsetFromUtcMinutes: 360,
    },
    { status, headers: NO_STORE }
  );
}

/** গাইড §৩.৩ — অজানা/ভুল কনটেন্টে 500 নয়, পরিষ্কার 400। */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** বডি পড়া — কখনো throw করে না (খালি/ভাঙা JSON = null)। */
export async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (!text.trim()) return null;
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// রাউট র্যাপার
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiContext {
  /** যাচাই করা পরিচয় — `auth: "none"`-এ null হতে পারে। */
  identity: ApiIdentity | null;
  /** যাচাই করা access token (হয়েছে); প্রমাণিত না হলে null। */
  token: string | null;
}

export type ApiAuthMode = "none" | "optional" | "student";

/**
 * এন্ডপয়েন্ট র্যাপার — টোকেন যাচাই, রোল-চেক, টোকেন-প্রেক্ষাপট, এরর-ফরম্যাট
 * একজায়গায়। ফলে প্রতিটি route handler শুধু ব্যবসায়িক লজিক লেখে।
 *
 * @param auth
 *  - `"none"`     → টোকেন থাকলে পড়া হয়, তবে দরকার নেই (যেমন `/api/time`, `/api/news`)
 *  - `"optional"` → টোকেন থাকলে যাচাই, না থাকলে অতিথি (যেমন `/api/home`)
 *  - `"student"`  → বাধ্যতামূলক, এবং শিক্ষক/admin অ্যাকাউন্ট প্রত্যাখ্যাত
 */
export function withApi<C = unknown>(
  auth: ApiAuthMode,
  handler: (ctx: ApiContext, req: Request, routeCtx: C) => Promise<NextResponse>
): (req: Request, routeCtx: C) => Promise<NextResponse> {
  return async (req: Request, routeCtx: C): Promise<NextResponse> => {
    try {
      const token = readBearerToken(req);
      const identity = token ? await identify(token) : null;

      if (auth === "student") {
        if (!identity) {
          // পার্থক্যটা অ্যাপের জন্য জরুরি: টোকেন **দেওয়াই ছিল কিন্তু অবৈধ** হলে
          // অ্যাপ চুপচাপ টোকেন রিফ্রেশ করে আবার চেষ্টা করবে; টোকেনই না থাকলে
          // লগইন স্ক্রিন দেখাবে। দুটোকে এক করে ফেললে অ্যাপ প্রতিবার নতুন করে
          // লগইন করাবে — নিজের কাস্টমারকেই বিরক্ত করা।
          if (token) {
            throw new ApiError(
              "TOKEN_INVALID",
              "টোকেনটি বৈধ নয় বা মেয়াদোত্তীর্ণ। অনুগ্রহ করে আবার লগইন করুন।",
              401
            );
          }
          throw new ApiError(
            "UNAUTHENTICATED",
            "লগইন প্রয়োজন। অনুগ্রহ করে Google দিয়ে লগইন করুন।",
            401
          );
        }
        if (identity.role !== "student") {
          // শিক্ষক/admin অ্যাকাউন্ট ভুল করে student অ্যাপে লগইন করলে পরিষ্কার বার্তা
          throw new ApiError(
            "FORBIDDEN",
            "এই অ্যাপটি শিক্ষার্থীদের জন্য। শিক্ষক প্যানেল ওয়েবসাইটে ব্যবহার করুন।",
            403
          );
        }
      }

      // SECURITY: শুধু **যাচাই করা** টোকেনই ভেতরের action-গুলোর কাছে পৌঁছায়।
      // অবৈধ টোকেন হলে context সেট করি না — action-গুলো তখন "লগইন নেই" দেখবে।
      const verifiedToken = identity ? token : null;
      return await withRequestToken(verifiedToken, () =>
        handler({ identity, token: verifiedToken }, req, routeCtx)
      );
    } catch (err) {
      if (err instanceof ApiError) {
        return apiFail(err.code, err.message, err.status);
      }
      console.error("[api] unhandled route error:", err);
      return apiFail("INTERNAL", "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।", 500);
    }
  };
}

/** `withApi`-এর ভেতরে ব্যবহারের জন্য — নিশ্চিত student পরিচয়। */
export function requireStudent(ctx: ApiContext): ApiIdentity {
  if (!ctx.identity) {
    throw new ApiError("UNAUTHENTICATED", "লগইন প্রয়োজন।", 401);
  }
  return ctx.identity;
}

// ─────────────────────────────────────────────────────────────────────────────
// রোস্টার প্রোফাইল (allowed_students)
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentProfile {
  /** রোস্টার-আইডি — submission/notebook এই id-তেই keyed হয়। */
  id: string;
  /** Supabase auth uid (লগইন পরিচয়)। */
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  courses: string[];
  /** অন্তত একটি কোর্সে এনরোল্ড কি না (গাইড §১.৩-এর "একটি কোর্সই যথেষ্ট" নিয়ম)। */
  isEnrolled: boolean;
  approvedAt: string;
  lastLoginAt: string;
}

/** পুরনো Supabase স্কিমায় এই কলামগুলো না থাকতে পারে → সংকীর্ণ সেটে ফলব্যাক। */
const ROSTER_COLS_FULL = "id, name, email, courses, photo_url, approved_at, last_login_at";
const ROSTER_COLS_LITE = "id, name, email, courses";

type RosterRow = Record<string, unknown>;

/**
 * রোস্টার-রো আনা — ডুপ্লিকেট-সহনশীল।
 *
 * কেন `.maybeSingle()` নয়: একই শিক্ষার্থীর একাধিক রো থাকতে পারে (শিক্ষক-হাতে-যোগ
 * করা ফোন-আইডি রো + Google-লগইনের uid রো)। তখন `.maybeSingle()` ব্যর্থ হয়ে খালি
 * ফেরে আর ভুল করে "এনরোল নেই" দেখায় — `verifyStudentAccess`-এ ঠিক এই বাগটার
 * জন্য আলাদা হ্যান্ডলিং আছে। এখানেও একই নীতি: তালিকা এনে **কোর্সসহ** রো-টা বাছি।
 */
async function fetchRosterRow(
  by: "id" | "email",
  value: string
): Promise<RosterRow | null> {
  for (const cols of [ROSTER_COLS_FULL, ROSTER_COLS_LITE]) {
    try {
      const { data, error } = await supabase
        .from("allowed_students")
        .select(cols)
        .eq(by, value)
        .limit(5);
      if (error) continue; // কলাম-সেট না মিললে সংকীর্ণ সেটে চেষ্টা
      // supabase-js: কলাম-তালিকা ভেরিয়েবলে দিলে টাইপ-ইনফারেন্স `GenericStringError`-এ
      // পড়ে (এই প্রজেক্টে Database জেনেরিক টাইপ-করা নয়) — তাই স্পষ্ট cast।
      const rows = ((data || []) as unknown) as RosterRow[];
      if (rows.length === 0) return null;
      return (
        rows.find((r) => Array.isArray(r.courses) && r.courses.length > 0) || rows[0]
      );
    } catch {
      // পরের কলাম-সেটে চেষ্টা
    }
  }
  return null;
}

function toProfile(row: RosterRow, identity: ApiIdentity): StudentProfile {
  const courses = Array.isArray(row.courses)
    ? (row.courses as unknown[]).map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  return {
    id: String(row.id || identity.uid),
    uid: identity.uid,
    name: String(row.name || identity.name || "শিক্ষার্থী"),
    email: String(row.email || identity.email || ""),
    photoURL: String(row.photo_url || ""),
    courses,
    isEnrolled: courses.length > 0,
    approvedAt: String(row.approved_at || ""),
    lastLoginAt: String(row.last_login_at || ""),
  };
}

/**
 * সেশন-পরিচয় → রোস্টার-প্রোফাইল। আগে uid দিয়ে (Google-লগইন করা নতুন ছাত্র),
 * না মিললে ইমেইল দিয়ে (শিক্ষক-হাতে-যোগ করা ছাত্ররা ফোন-আইডিতে keyed, ইমেইল দিয়ে
 * মেলে — `resolveStudyIdentity`-এর মতোই নীতি)। কোনো রো না থাকলে null।
 */
export async function resolveStudentProfile(
  identity: ApiIdentity
): Promise<StudentProfile | null> {
  const uid = String(identity.uid || "").trim();
  const email = String(identity.email || "").trim().toLowerCase();

  if (uid) {
    const byId = await fetchRosterRow("id", uid);
    if (byId) return toProfile(byId, identity);
  }
  if (email) {
    const byEmail = await fetchRosterRow("email", email);
    if (byEmail) return toProfile(byEmail, identity);
  }
  return null;
}

/** পরিষ্কার JSON-এ রূপান্তর (অ্যাপের DTO — অগভীর `row` কখনো লিক করি না)। */
export function profileToDto(profile: StudentProfile | null) {
  if (!profile) {
    return {
      registered: false,
      profile: null,
      enrollment: { isEnrolled: false, courses: [] as string[], courseCount: 0 },
    };
  }
  return {
    registered: true,
    profile: {
      id: profile.id,
      uid: profile.uid,
      name: profile.name,
      email: profile.email,
      photoURL: profile.photoURL,
      approvedAt: profile.approvedAt,
      lastLoginAt: profile.lastLoginAt,
    },
    enrollment: {
      isEnrolled: profile.isEnrolled,
      courses: profile.courses,
      courseCount: profile.courses.length,
    },
  };
}
