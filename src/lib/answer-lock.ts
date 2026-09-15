import { supabase } from "@/lib/supabase";
import { isAnswerTimeReached } from "@/lib/bangladesh-time";
import type { Exam } from "@/types/exam";

/**
 * প্রশ্ন-পর্যায়ের উত্তর-লক (answer lock)।
 *
 * সমস্যা যা এটা বন্ধ করে:
 * আগে লক হতো **পরীক্ষার key** ধরে — শুধু যে পরীক্ষাটি এখনো রিলিজ হয়নি তার
 * প্রশ্ন বাদ যেত। কিন্তু শিক্ষকরা সাধারণত প্রশ্নব্যাংকের পুরোনো প্রশ্ন **লিংক**
 * করেই নতুন পেপার বানান (`admin-actions.ts` linkQuestionToExam — একই
 * `question_bank` সারি, নতুন কোনো কপি নয়)। ফলে সেই প্রশ্নটি আগের কোনো
 * রিলিজ-হয়ে-যাওয়া পরীক্ষার সূত্রেও পাওয়া যেত (`exam_questions_link` +
 * `topic_questions` মিরর রো) — আর লাইভ পরীক্ষা চলাকালীন পুরো সময় তার
 * `correct`/`exp` প্রশ্নব্যাংক/প্র্যাকটিস পুলে পড়ে থাকত।
 *
 * এখন লক হয় **প্রশ্নের পরিচয়** ধরে — id এবং নরমালাইজড টেক্সট দুটোই দিয়ে —
 * তাই প্রশ্নটি কোন পরীক্ষা থেকে এসেছে সেটা আর মায়নে রাখে না।
 */

/** প্রশ্নের লেখা তুলনা করার জন্য অভিন্ন রূপ (whitespace/zero-width/কেস)। */
export function normalizeQuestionText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface AnswerLockState {
  /** যে পরীক্ষাগুলোর উত্তর এখনো রিলিজ হয়নি। */
  lockedExamIds: Set<string>;
  /** উপরের পরীক্ষাগুলোতে থাকা প্রশ্নের `question_bank.id`। */
  lockedQuestionIds: Set<string>;
  /** একই প্রশ্নের নরমালাইজড টেক্সট (id না মিললেও ধরার জন্য)। */
  lockedQuestionTexts: Set<string>;
  /**
   * true হলে লক-তথ্য পড়া যায়নি (DB ত্রুটি)। তখন অজানা exam-linked প্রশ্ন
   * বাদ দেওয়া হয় — উত্তর ফাঁসের চেয়ে কনটেন্ট আটকে থাকা ভালো।
   */
  failClosed: boolean;
}

export function emptyAnswerLock(): AnswerLockState {
  return {
    lockedExamIds: new Set<string>(),
    lockedQuestionIds: new Set<string>(),
    lockedQuestionTexts: new Set<string>(),
    failClosed: false
  };
}

/** পরীক্ষার সারিতে কোনো সময়সীমা আছে কি না (always-open প্র্যাকটিস পরীক্ষা নয়)। */
function examRowHasWindow(row: Record<string, unknown>): boolean {
  return !!(row?.start_time || row?.end_time || row?.leaderboard_end_time);
}

/** DB সারি → Exam (timer_minutes অবশ্যই সহ, নাহলে রিলিজ-সময় ভুল হয়)। */
function rowToExam(row: Record<string, unknown>): Exam {
  return {
    id: String(row.id),
    startTime: (row.start_time as string) ?? null,
    endTime: (row.end_time as string) ?? null,
    leaderboardStartTime: (row.leaderboard_start_time as string) ?? null,
    leaderboardEndTime: (row.leaderboard_end_time as string) ?? null,
    isResultPublished: row.is_result_published === true,
    timerMinutes: Number(row.timer_minutes ?? 0) || undefined
  } as Exam;
}

/**
 * এই মুহূর্তের লক-অবস্থা একবার পড়ে আনে। শিক্ষকদের জন্য নয় — শিক্ষকরা
 * अन्রিলিজড কনটেন্ট দেখেন (তাঁরা কনটেন্টের মালিক), সেটা কলার নিজে হ্যান্ডল করে।
 */
export async function loadAnswerLockState(): Promise<AnswerLockState> {
  const state = emptyAnswerLock();

  try {
    const { data: examRows, error } = await supabase
      .from("exams")
      .select("id, start_time, end_time, leaderboard_end_time, leaderboard_start_time, is_result_published, timer_minutes");

    if (error) {
      state.failClosed = true;
      return state;
    }

    const lockedExamIds: string[] = [];
    (examRows || []).forEach((row: Record<string, unknown>) => {
      const id = String(row?.id ?? "").trim();
      if (!id) return;
      // সময়সীমা নেই → always-open প্র্যাকটিস পরীক্ষা; উত্তর প্রকাশ্য (ডিজাইন অনুযায়ী)
      if (!examRowHasWindow(row)) return;
      if (isAnswerTimeReached(rowToExam(row))) return;
      state.lockedExamIds.add(id);
      lockedExamIds.push(id);
    });

    if (lockedExamIds.length === 0) return state;

    // লকড পরীক্ষাগুলোর প্রশ্নের পরিচয় সংগ্রহ — id ও টেক্সট দুটোই
    const { data: links, error: linkError } = await supabase
      .from("exam_questions_link")
      .select("exam_id, question_id, question_bank(id, q)")
      .in("exam_id", lockedExamIds);

    if (linkError) {
      state.failClosed = true;
      return state;
    }

    (links || []).forEach((link: Record<string, unknown>) => {
      const questionId = String(link?.question_id ?? "").trim();
      if (questionId) state.lockedQuestionIds.add(questionId);

      const raw = link?.question_bank;
      const qb = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
      if (qb?.id) state.lockedQuestionIds.add(String(qb.id));
      const text = normalizeQuestionText(qb?.q);
      if (text) state.lockedQuestionTexts.add(text);
    });

    return state;
  } catch {
    state.failClosed = true;
    return state;
  }
}

/** কোনো নির্দিষ্ট প্রশ্ন এখন লকড কি না — id, টেক্সট বা exam_key যেকোনো সূত্রে। */
export function isQuestionLocked(
  state: AnswerLockState,
  args: { questionId?: string | null; examKey?: string | null; text?: string | null }
): boolean {
  const examKey = String(args.examKey ?? "").trim();
  if (examKey) {
    if (state.failClosed) return true;
    if (state.lockedExamIds.has(examKey)) return true;
  }

  const questionId = String(args.questionId ?? "").trim();
  if (questionId && state.lockedQuestionIds.has(questionId)) return true;

  const text = normalizeQuestionText(args.text);
  if (text && state.lockedQuestionTexts.has(text)) return true;

  return false;
}

/**
 * exam_key চিহ্নিত প্রশ্ন বাদ দেওয়ার সিদ্ধান্ত (মিরর রো-এর জন্য)।
 * failClosed অবস্থায় অজানা exam-linked প্রশ্নও বাদ পড়ে।
 */
export function isExamKeyLocked(state: AnswerLockState, examKey?: string | null): boolean {
  const key = String(examKey ?? "").trim();
  if (!key) return false;
  if (state.failClosed) return true;
  return state.lockedExamIds.has(key);
}
