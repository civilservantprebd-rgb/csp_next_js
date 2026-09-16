import { apiFail, apiOk, readJsonBody, requireStudent, withApi } from "@/lib/api-auth";
import {
  addMistakeItems,
  clearStudentMistakes,
  fetchStudentMistakeData,
  removeMistakeItem,
  type MistakeSyncItem,
} from "@/actions/mistake-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/mistakes — API কন্ট্রাক্ট v1 #22 (GET) ও #23 (PUT)
 * (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * ── SECURITY (দুটোতেই প্রযোজ্য) ──
 * অ্যাকশন নিজেই নিয়ম মানে (`candidateIds` — mistake-actions.ts): ক্লায়েন্টের
 * পাঠানো student id **কখনো নিজেকে অনুমোদন দেয় না**। id-সেট আসে শুধু প্রমাণিত
 * সেশন থেকে — তার uid, আর যে রোস্টার-সারির email সেশন-ইমেইলের সাথে মেলে।
 * আগে যেকোনো লগইন-করা ছাত্র সহপাঠীর id পাঠিয়ে তার পুরো নোটবুক (ভুল উত্তরের
 * সাথে সঠিক উত্তর ও ব্যাখ্যা) পড়ে নিতে পারত — সেই বাগ এখন বন্ধ।
 * রাউট থেকেও খালি স্ট্রিং পাঠানো হয়, অর্থাৎ url/session-এর বাইরে কিছুই যায় না।
 */

/**
 * GET — ভুল-নোটবুক (ক্রস-ডিভাইস সিংক)। সর্বশেষ ৫০০টি, নতুন আগে।
 *
 * `available: false` মানে টেবিল/মাইগ্রেশন নেই (ওয়েব তখন localStorage-এ চলে) —
 * অ্যাপেরও ভাঙা উচিত নয়, তাই 200 + খালি তালিকা, ত্রুটি নয়।
 */
export const GET = withApi("student", async (ctx) => {
  requireStudent(ctx);

  const data = await fetchStudentMistakeData("");

  if (!data) {
    return apiOk({
      available: false,
      total: 0,
      mistakes: [],
      message: "ভুল-নোটবুক সিঙ্ক এখন উপলব্ধ নয় — ডিভাইসেই সংরক্ষিত থাকবে।",
    });
  }

  return apiOk({
    available: true,
    total: data.mistakes.length,
    mistakes: data.mistakes.map((m) => ({
      id: m.id,
      q: m.q,
      opts: m.opts,
      correct: m.correct,
      explanation: m.exp || "",
      userAnswer: m.userAns ?? null,
      examTitle: m.examTitle ?? "",
      subject: m.subject ?? null,
      topic: m.topic ?? null,
      timestamp: m.timestamp ?? null,
      isBookmarked: !!m.isBookmarked,
    })),
  });
});

/**
 * PUT — **ইনক্রিমেন্টাল** সিঙ্ক (ওয়েবের ডিজাইন অপরিবর্তিত); পুরো তালিকা
 * replace-all নয়, শুধু যা বদলেছে:
 *
 * ```json
 * {
 *   "add":    [ { "q": "...", "opts": ["..."], "correct": 1, "exp": "...", "userAns": 2 } ],
 *   "remove": [ "mistake-id-1" ],
 *   "clear":  false
 * }
 * ```
 *
 * তিনটাই ঐচ্ছিক, একসাথে দেওয়া যায়। হাজার হাজার ভুল থাকলেও প্রতি কলে ছোট পেলোড
 * যায়, তাই কোনো আকার-সীমা (cap) নেই — শিক্ষার্থীর সব ভুলই থেকে যায়। এটাই
 * অ্যাপের অফলাইন-সিঙ্কের ভিত্তি: নেট ফিরলে শুধু জমা-হওয়া পরিবর্তনগুলোই পাঠাবে।
 *
 * `add`-এ `correct`/`exp` পাঠানোয় নতুন কিছু ফাঁস হয় না — প্রশ্নটা ভুল হওয়ার
 * সময়েই শিক্ষার্থী উত্তরটি দেখেছে। `student_id` সবসময় সার্ভার বসায়।
 */
export const PUT = withApi("student", async (ctx, req) => {
  requireStudent(ctx);

  const body = await readJsonBody(req);
  if (!body) {
    return apiFail("BAD_REQUEST", "অনুরোধের বডি পাঠান (add / remove / clear)।", 400);
  }

  const rawAdd = Array.isArray(body.add) ? (body.add as unknown[]) : [];
  const rawRemove = Array.isArray(body.remove) ? (body.remove as unknown[]) : [];
  const clear = body.clear === true;

  if (rawAdd.length === 0 && rawRemove.length === 0 && !clear) {
    return apiFail("BAD_REQUEST", "কিছুই দেওয়া হয়নি — add, remove বা clear লাগবে।", 400);
  }

  // ক্লায়েন্টের পাঠানো অবজেক্ট হুবহু বিশ্বাস না করে দরকারি ফিল্ডে সীমিত করি
  const items: MistakeSyncItem[] = rawAdd
    .map((raw) => {
      const it = (raw || {}) as Record<string, unknown>;
      const q = typeof it.q === "string" ? it.q.trim() : "";
      if (!q) return null;
      const item: MistakeSyncItem = {
        id: typeof it.id === "string" ? it.id : String(it.id ?? ""),
        q,
        opts: Array.isArray(it.opts) ? (it.opts as unknown[]).map(String) : [],
        correct: Number(it.correct ?? 0),
        exp: typeof it.exp === "string" ? it.exp : "",
        userAns: it.userAns === null || it.userAns === undefined ? null : Number(it.userAns),
        examTitle: typeof it.examTitle === "string" ? it.examTitle : "",
        subject: typeof it.subject === "string" ? it.subject : undefined,
        topic: typeof it.topic === "string" ? it.topic : undefined,
        timestamp: typeof it.timestamp === "string" ? it.timestamp : undefined,
      };
      return item;
    })
    .filter((x): x is MistakeSyncItem => x !== null);

  const removedIds = rawRemove.map((v) => String(v || "").trim()).filter(Boolean);

  let added = false;
  let removed = 0;
  let cleared = false;

  if (items.length > 0) added = await addMistakeItems("", items);
  for (const id of removedIds) {
    if (await removeMistakeItem("", id)) removed++;
  }
  if (clear) cleared = await clearStudentMistakes("");

  // সব অপারেশন নীরবে false ফেরায় (টেবিল নেই ইত্যাদি)। অ্যাপ ভাঙা উচিত নয় —
  // তাই 200-ই দিই, কিন্তু কোনটা সত্যিই হয়েছে তা `applied`-এ জানাই।
  return apiOk({
    applied: {
      added: items.length > 0 ? added : null,
      removed,
      removedRequested: removedIds.length,
      cleared: clear ? cleared : null,
    },
    addRequested: items.length,
    removeRequested: removedIds.length,
    clearRequested: clear,
  });
});
