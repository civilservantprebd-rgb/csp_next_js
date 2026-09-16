import { apiFail, apiOk, readJsonBody, requireStudent, withApi } from "@/lib/api-auth";
import {
  addReadItems,
  fetchStudentReadQuestions,
  removeReadItem,
  type MistakeSyncItem,
} from "@/actions/mistake-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/reads — প্রশ্নব্যাংকের "পড়া হয়েছে" (✓) টিক। GET + PUT।
 *
 * ── কেন এই রুট ──
 * ওয়েব অ্যাপে এই ফিচার আগেই আছে (`student_read_questions` টেবিল +
 * `read-store.ts`), কিন্তু **কোনো REST রুট ছিল না** — তাই অ্যাপ থেকে পড়া-চিহ্ন
 * দেওয়া অসম্ভব ছিল। `/api/bookmarks`-এর হুবহু আয়না, একই নিয়ম:
 *
 *   • প্রশ্নের **লেখা** (q) দিয়েই পরিচয় — আইডি নয়। কারণ একই প্রশ্ন পরীক্ষা ও
 *     ব্যাংক দুই জায়গা থেকেই আসে, আর আইডি দুই জায়গায় আলাদা হতে পারে।
 *   • মালিকানা সেশন-টোকেন থেকে (`withApi("student")`), ক্লায়েন্টের id থেকে নয়।
 *   • টেবিল না থাকলে `available: false` — অ্যাপ তখন ডিভাইসে সংরক্ষণে চলে যায়,
 *     ভাঙে না (ওয়েবের `read-store.ts`-এর মতোই নীতি)।
 */

/** GET — পড়া-চিহ্নিত প্রশ্নের তালিকা (নতুন আগে, সর্বোচ্চ ১০০০)। */
export const GET = withApi("student", async (ctx) => {
  requireStudent(ctx);

  const data = await fetchStudentReadQuestions("");

  if (!data) {
    return apiOk({
      available: false,
      total: 0,
      reads: [],
      message: "পড়া-চিহ্ন সিঙ্ক এখন উপলব্ধ নয় — ডিভাইসেই সংরক্ষিত থাকবে।",
    });
  }

  return apiOk({
    available: true,
    total: data.length,
    reads: data.map((r) => ({
      id: r.id,
      q: r.q,
      opts: r.opts,
      correct: r.correct,
      explanation: r.exp || "",
      examTitle: r.examTitle ?? "",
      subject: r.subject ?? null,
      topic: r.topic ?? null,
      timestamp: r.timestamp ?? null,
    })),
  });
});

/**
 * PUT — পড়া-চিহ্ন যোগ/মুছে ফেলা।
 *
 * ```json
 * { "add": [ { "q": "...", "opts": ["..."], "correct": 1, "exp": "..." } ],
 *   "remove": [ "<প্রশ্নের পূর্ণ লেখা>" ] }
 * ```
 *
 * `addReadItems` আগে থেকেই থাকা প্রশ্ন বাদ দেয়, তাই পরপর অনেক প্রশ্ন টিক দিলেও
 * বড় insert হয় না — ব্যয়বহুল নয়।
 */
export const PUT = withApi("student", async (ctx, req) => {
  requireStudent(ctx);

  const body = await readJsonBody(req);
  if (!body) {
    return apiFail("BAD_REQUEST", "অনুরোধের বডি পাঠান (add / remove)।", 400);
  }

  const rawAdd = Array.isArray(body.add) ? (body.add as unknown[]) : [];
  const rawRemove = Array.isArray(body.remove) ? (body.remove as unknown[]) : [];

  if (rawAdd.length === 0 && rawRemove.length === 0) {
    return apiFail("BAD_REQUEST", "কিছুই দেওয়া হয়নি — add বা remove লাগবে।", 400);
  }

  const items: MistakeSyncItem[] = rawAdd
    .map((raw) => {
      const it = (raw || {}) as Record<string, unknown>;
      const q = typeof it.q === "string" ? it.q.trim() : "";
      if (!q) return null;
      const rawId = (typeof it.id === "string" ? it.id : String(it.id ?? "")).trim();
      const item: MistakeSyncItem = {
        // ⚠️ id কখনো খালি রাখা যাবে না। সারির `id` ইউনিক, তাই একই খালি id দিয়ে
        // দ্বিতীয় insert duplicate-key-এ ব্যর্থ হয় — অথচ অ্যাকশন কেবল "false"
        // ফেরায়, ফলে ব্যবহারকারী দেখেন "চিহ্ন বসল না, কারণও নেই"। প্রশ্নব্যাংকের
        // প্রশ্নে আইডি না থাকলে এখানেই একটা ইউনিক id বানিয়ে দেওয়া হয়।
        id: rawId || `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        q,
        opts: Array.isArray(it.opts) ? (it.opts as unknown[]).map(String) : [],
        correct: Number(it.correct ?? 0),
        exp: typeof it.exp === "string" ? it.exp : "",
        examTitle: typeof it.examTitle === "string" ? it.examTitle : "",
        subject: typeof it.subject === "string" ? it.subject : undefined,
        topic: typeof it.topic === "string" ? it.topic : undefined,
        timestamp: typeof it.timestamp === "string" ? it.timestamp : undefined,
      };
      return item;
    })
    .filter((x): x is MistakeSyncItem => x !== null);

  const texts = rawRemove.map((v) => String(v || "").trim()).filter(Boolean);

  // ── সত্যিকারের ফল রিপোর্ট ──
  // ⚠️ অ্যাকশনগুলো কেবল **বুলিয়ান** ফেরায় ("চেষ্টা সফল হলো কি না"), কতগুলো
  // সত্যিই যোগ/মুছল তা নয়। আগে সেই বুলিয়ানকে "১টি যোগ হলো" বলে দেখানো হচ্ছিল,
  // ফলে insert যদি চুপচাপ কিছুই না করত, ক্লায়েন্ট তবু "সফল" ভাবত — মিথ্যা
  // সফলতা, আর ঠিক এই কারণেই বাগটা ধরা পড়তে দেরি হয়েছিল। এখন **আগে/পরে গণনা**
  // করে আসল পার্থক্যটাই পাঠানো হয়।
  const countReads = async (): Promise<number> =>
    (await fetchStudentReadQuestions(""))?.length ?? 0;

  const before = await countReads();
  const addOk = await addReadItems("", items);
  const afterAdd = await countReads();

  let removed = 0;
  for (const text of texts) {
    if (await removeReadItem("", text)) removed++;
  }
  const afterRemove = await countReads();

  return apiOk({
    applied: {
      /** সত্যিই কতগুলো নতুন সারি তৈরি হলো */
      added: Math.max(0, afterAdd - before),
      addRequested: items.length,
      /** সত্যিই কতগুলো মুছে গেল (অ্যাকশনের "true" নয়, গণনার পার্থক্য) */
      removed: Math.max(0, afterAdd - afterRemove),
      removeRequested: texts.length,
      /** অ্যাকশন নিজে সফল বলেছে কি না — ডায়াগনস্টিকের জন্য */
      addReportedOk: addOk,
      totals: { before, afterAdd, afterRemove },
    },
  });
});
