import { supabase } from "@/lib/supabase";
import { Exam, QuestionItem } from "@/types/exam";
import { ApiError, ApiIdentity, resolveStudentProfile } from "@/lib/api-auth";
import {
  parseBangladeshDateTime,
  isAnswerTimeReached,
  LIVE_GRACE_MS,
} from "@/lib/bangladesh-time";
import { verifyStudentAccess } from "@/actions/student-actions";

/**
 * পরীক্ষা-সংক্রান্ত API-দের ভাগ করা লজিক (API কন্ট্রাক্ট v1 #9–#14)।
 *
 * ── নিরাপত্তার মূল নিয়মগুলো যেগুলো এখানে একবার লিখে সব রাউটে প্রয়োগ করা হয় ──
 *   ১. **জিরো অ্যানসার-লিক**: প্রশ্ন আনার সময় `correct`/`exp` কলাম কখনো
 *      `select`-ই করা হয় না। SELECT-এ না থাকলে লিক করার সুযোগই নেই — পরে
 *      ভুলে strip করার দরকার পড়ে না।
 *   ২. **এনরোলমেন্ট সার্ভারে**: পেইড পরীক্ষায় পরিচয় ছাত্রের সেশন থেকে আসে,
 *      ক্লায়েন্টের পাঠানো id থেকে নয় (গাইড §১.৩)।
 *   ৩. **সময় সার্ভারের**: উইন্ডো ও উত্তর-রিলিজের সব হিসাব সার্ভারে, ডিভাইস-ঘড়ি
 *      দিয়ে নয় (গাইড §২২.৪)।
 *   ৪. **স্কোরিং সার্ভারে**: এই ফাইলের কোনো ফাংশন স্কোর গণনা করে না — সেটা
 *      `submitExamAnswers`/`getExamSolutions`-এর কাজ।
 */

/** Supabase-এর `exams` সারি → ডোমেইন মডেল। কলাম নাম ম্যাপিং একজায়গায়। */
export function rowToExam(row: Record<string, unknown>): Exam {
  return {
    id: String(row.id ?? ""),
    course: String(row.course ?? ""),
    subject: String(row.subject ?? ""),
    title: String(row.title ?? ""),
    // SECURITY: `timerMinutes` মাস্ট — বাদ পড়লে isAnswerTimeReached-এর `|| 10`
    // ডিফল্ট জিতে যায় আর ৬০ মিনিটের পরীক্ষার উত্তর ১০ মিনিটেই খুলে যায়
    // (bangladesh-time.ts-এ বিস্তারিত নোট)।
    timerMinutes: Number(row.timer_minutes ?? 0) || 0,
    isFree: row.is_free !== false,
    passMark: Number(row.pass_mark ?? 0),
    startTime: (row.start_time as string) || undefined,
    endTime: (row.end_time as string) || undefined,
    isResultPublished: row.is_result_published === true,
    leaderboardStartTime: (row.leaderboard_start_time as string) || undefined,
    leaderboardEndTime: (row.leaderboard_end_time as string) || undefined,
  };
}

/** পরীক্ষা লোড — না থাকলে 404 (500 নয়)। */
export async function loadExam(examId: string): Promise<Exam> {
  const key = String(examId || "").trim();
  if (!key) throw new ApiError("BAD_REQUEST", "পরীক্ষার আইডি প্রয়োজন।", 400);

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("id", key)
    .maybeSingle();

  if (error) {
    console.error("[exam-api] loadExam error:", error);
    throw new ApiError("INTERNAL", "পরীক্ষার তথ্য আনতে সমস্যা হয়েছে।", 500);
  }
  if (!data) throw new ApiError("NOT_FOUND", "পরীক্ষাটি পাওয়া যায়নি।", 404);
  return rowToExam(data);
}

export interface ExamWindows {
  startMs: number | null;
  endMs: number | null;
  /** উত্তর-কী খোলার সময় (epoch ms) — `null` মানে সর্বদা খোলা (প্র্যাকটিস)। */
  answersReleaseAtMs: number | null;
}

/**
 * উইন্ডো + উত্তর-রিলিজের সময় — সবই সার্ভারে হিসাব করা।
 *
 * উত্তর-রিলিজ: `isAnswerTimeReached` অনুযায়ী endTime + **পুরো পরীক্ষার সময়**
 * (timerMinutes), শুধু ১০ সেকেন্ড গ্রেস নয়। গ্রেসটা (`LIVE_GRACE_MS`) শুধু
 * সাবমিশনকে "লাইভ" হিসেবে গণ্য করার সীমা।
 */
export function examWindows(exam: Exam, nowMs: number): ExamWindows {
  const start = exam.startTime ? parseBangladeshDateTime(exam.startTime) : null;
  const endRaw = exam.endTime || exam.leaderboardEndTime || null;
  const end = endRaw ? parseBangladeshDateTime(endRaw) : null;
  const durationMs = Math.max(1, exam.timerMinutes || 10) * 60 * 1000;

  const hasWindow = !!(exam.startTime || exam.endTime || exam.leaderboardEndTime);
  const answersReleaseAtMs = !hasWindow
    ? null // সর্বদা-খোলা প্র্যাকটিস পরীক্ষা — উত্তর প্রকাশ্য
    : end
      ? end.getTime() + durationMs
      : start
        ? start.getTime() + durationMs
        : null;

  return {
    startMs: start ? start.getTime() : null,
    endMs: end ? end.getTime() : null,
    answersReleaseAtMs,
  };
}

export function isExamLiveNow(exam: Exam, nowMs: number): boolean {
  const { startMs, endMs } = examWindows(exam, nowMs);
  if (startMs === null || endMs === null) return false;
  return nowMs >= startMs && nowMs <= endMs;
}

/** অ্যাপের DTO — কখনো কাঁচা DB সারি নয়। */
export function examToDto(exam: Exam, nowMs: number) {
  const w = examWindows(exam, nowMs);
  const live = isExamLiveNow(exam, nowMs);
  const released = isAnswerTimeReached(exam);

  return {
    examId: exam.id,
    title: exam.title,
    course: exam.course,
    subject: exam.subject,
    durationSeconds: Math.max(1, exam.timerMinutes || 60) * 60,
    isFree: exam.isFree !== false,
    passMark: exam.passMark ?? 0,
    startTimeMs: w.startMs,
    endTimeMs: w.endMs,
    answersReleaseAtMs: w.answersReleaseAtMs,
    /** লাইভ উইন্ডোতে চলছে কি না। */
    isLive: live,
    /** এখনো শুরু হয়নি / শেষ হয়ে গেছে / উত্তর প্রকাশ পেয়েছে — অ্যাপের স্ক্রিন বাছাইয়ের জন্য। */
    isUpcoming: w.startMs !== null && nowMs < w.startMs,
    isClosed: w.endMs !== null && nowMs > w.endMs,
    isAnswersReleased: released,
  };
}

export interface ExamAccess {
  studentId: string;
  studentName: string;
}

/**
 * এই শিক্ষার্থী পরীক্ষাটি দিতে/দেখতে পারবে কি না — আর তার submission-id।
 *
 * ফ্রি পরীক্ষা: যেকোনো লগইন করা শিক্ষার্থী (ওয়েবের `submitExamAnswers`-এর নিয়ম)।
 * পেইড পরীক্ষা: কোর্সে এনরোল্ড হতে হবে — পরিচয় **সেশন থেকে** আসে, ক্লায়েন্টের
 * পাঠানো id থেকে নয়।
 */
export async function assertExamAccess(
  exam: Exam,
  identity: ApiIdentity
): Promise<ExamAccess> {
  const { getSessionUserFromCookies } = await import("@/lib/teacher-auth");
  const sessionUser = await getSessionUserFromCookies();
  if (!sessionUser) {
    throw new ApiError("UNAUTHENTICATED", "লগইন প্রয়োজন।", 401);
  }

  if (exam.isFree !== false) {
    // ফ্রি: রোস্টারে থাকলে তার নাম/আইডি, নাহলে সেশনের uid
    let studentId = sessionUser.id;
    let studentName = sessionUser.name || identity.name || "শিক্ষার্থী";
    try {
      const access = await verifyStudentAccess(sessionUser.id, "ALL", sessionUser.email);
      if (access.allowed && access.studentName) studentName = access.studentName;
      if (access.normalizedId) studentId = access.normalizedId;
    } catch {
      // রোস্টার না মিললে সেশন-পরিচয়ই থাকল
    }
    return { studentId, studentName };
  }

  const access = await verifyStudentAccess(sessionUser.id, exam.course || "", sessionUser.email);
  if (!access.allowed) {
    throw new ApiError(
      "NOT_ENROLLED",
      access.message || "এই কোর্সের পরীক্ষা দেওয়ার অনুমতি নেই।",
      403
    );
  }
  return {
    studentId: access.normalizedId || sessionUser.id,
    studentName: access.studentName || sessionUser.name || "শিক্ষার্থী",
  };
}

/**
 * পরীক্ষার প্রশ্ন — **উত্তর ছাড়া**।
 *
 * SECURITY: `select`-এ `correct`/`exp` নেই। কলাম আনাই হয় না, তাই ভুলে
 * strip করতে ভুলে যাওয়ার ঝুঁকি নেই — এটাই "zero answer-leak architecture"-এর
 * মূল চুক্তি (README, গাইড §১.৩)।
 *
 * ক্রম `order_index` দিয়েই — অ্যাপের প্রশ্ন-ক্রম ওয়েবের সাথে হুবহু মিলবে,
 * কারণ উত্তরপত্রের `answers[i]` এই একই ক্রমে সূচিত।
 */
export async function fetchExamQuestions(examId: string): Promise<QuestionItem[]> {
  const key = String(examId || "").trim();
  if (!key) return [];

  // ১) প্রশ্নব্যাংক-লিংক (মূল পথ)
  const { data: links, error } = await supabase
    .from("exam_questions_link")
    .select("order_index, question_bank(id, q, opts, topic, subject)")
    .eq("exam_id", key);

  if (!error && links && links.length > 0) {
    const sorted = [...links].sort(
      (a: { order_index?: number }, b: { order_index?: number }) =>
        Number(a.order_index ?? 0) - Number(b.order_index ?? 0)
    );
    // `map(...).filter(...)` এর বদলে সোজা লুপ — `satisfies` ব্যবহার করলে `id`
    // বাধ্যতামূলক হয়ে যায় আর type-predicate আর মেলে না (tsc ত্রুটি)।
    const out: QuestionItem[] = [];
    for (const l of sorted) {
      const raw = (l as { question_bank?: unknown }).question_bank;
      // supabase JOIN কখনো অবজেক্ট, কখনো এক-উপাদানের অ্যারে দেয়
      const q = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
      if (!q || !q.q) continue;
      out.push({
        id: q.id ? String(q.id) : undefined,
        q: String(q.q),
        opts: Array.isArray(q.opts) ? (q.opts as unknown[]).map(String) : [],
        topic: q.topic ? String(q.topic) : undefined,
        subject: q.subject ? String(q.subject) : undefined,
      });
    }
    return out;
  }

  // ২) ফলব্যাক: `exam_questions` ভিউ (পুরনো পরীক্ষাগুলোর জন্য)
  const { data, error: viewError } = await supabase
    .from("exam_questions")
    .select("id, q, opts, topic")
    .eq("exam_id", key)
    .order("created_at", { ascending: true });

  if (viewError) {
    console.error("[exam-api] fetchExamQuestions fallback error:", viewError);
    return [];
  }

  return (data || []).map((r: Record<string, unknown>) => ({
    id: r.id ? String(r.id) : undefined,
    q: String(r.q ?? ""),
    opts: Array.isArray(r.opts) ? (r.opts as unknown[]).map(String) : [],
    topic: r.topic ? String(r.topic) : undefined,
  }));
}

/** অ্যাপে পাঠানোর প্রশ্ন-DTO — `order` যোগ করা হয় যাতে উত্তর সূচিত করা যায়। */
export function questionsToDto(questions: QuestionItem[]) {
  return questions.map((q, idx) => ({
    order: idx,
    id: q.id ?? null,
    q: q.q,
    opts: q.opts,
    topic: q.topic ?? null,
    subject: q.subject ?? null,
  }));
}

/** শিক্ষার্থীর submission-id গুলো — uid + রোস্টার-আইডি, দুটোই। */
export async function submissionIdsFor(identity: ApiIdentity): Promise<string[]> {
  const profile = await resolveStudentProfile(identity);
  const ids = new Set<string>([identity.uid]);
  if (profile?.id) ids.add(profile.id);
  return Array.from(ids).filter(Boolean);
}

/** সময়-উইন্ডো চেক — না মিললে নির্দিষ্ট এরর-কোড (অ্যাপ কোড ধরে স্ক্রিন বাছবে)। */
export function assertExamWindow(exam: Exam, nowMs: number): void {
  const { startMs, endMs } = examWindows(exam, nowMs);

  if (startMs !== null && nowMs < startMs) {
    throw new ApiError(
      "EXAM_NOT_STARTED",
      `পরীক্ষাটি এখনো শুরু হয়নি। শুরু হবে ${new Date(startMs).toISOString()} (বাংলাদেশ সময়)।`,
      425
    );
  }
  if (endMs !== null && nowMs > endMs + LIVE_GRACE_MS) {
    throw new ApiError(
      "EXAM_CLOSED",
      "পরীক্ষার সময় শেষ হয়ে গেছে।",
      410
    );
  }
}
