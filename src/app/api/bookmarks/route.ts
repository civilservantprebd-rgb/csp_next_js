import { apiFail, apiOk, readJsonBody, requireStudent, withApi } from "@/lib/api-auth";
import {
  addBookmarkItem,
  fetchStudentMistakeData,
  removeBookmarkItem,
  type MistakeSyncItem,
} from "@/actions/mistake-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/bookmarks — API কন্ট্রাক্ট v1 #24 GET + PUT (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * মিসটেক-নোটবুকের ভাই-ফাংশন, একই টেবিল-কাঠামো (`student_bookmarks`)।
 * মালিকানা যাচাই সেশন দিয়ে — `/api/mistakes`-এর মতোই।
 *
 * বুকমার্কে প্রশ্নের **লেখা** (q) দিয়েই পরিচয় নির্ধারিত হয় (আইডি নয়) —
 * কারণ একই প্রশ্ন পরীক্ষা ও ব্যাংক দুই জায়গা থেকেই আসে। তাই PUT-এ
 * `remove`-এ আইডি নয়, প্রশ্নের লেখাটাই পাঠাতে হয় (ওয়েব অ্যাকশনের চুক্তি)।
 */

/** GET — বই-চিহ্নিত প্রশ্নের তালিকা (নতুন আগে, সর্বোচ্চ ৫০০)। */
export const GET = withApi("student", async (ctx) => {
  requireStudent(ctx);

  const data = await fetchStudentMistakeData("");

  if (!data) {
    return apiOk({
      available: false,
      total: 0,
      bookmarks: [],
      message: "বুকমার্ক সিঙ্ক এখন উপলব্ধ নয় — ডিভাইসেই সংরক্ষিত থাকবে।",
    });
  }

  return apiOk({
    available: true,
    total: data.bookmarks.length,
    bookmarks: data.bookmarks.map((b) => ({
      id: b.id,
      q: b.q,
      opts: b.opts,
      correct: b.correct,
      explanation: b.exp || "",
      examTitle: b.examTitle ?? "",
      subject: b.subject ?? null,
      topic: b.topic ?? null,
      timestamp: b.timestamp ?? null,
    })),
  });
});

/**
 * PUT — বুকমার্ক যোগ/মুছে ফেলা।
 *
 * ```json
 * { "add": [ { "q": "...", "opts": ["..."], "correct": 1, "exp": "..." } ],
 *   "remove": [ "<প্রশ্নের পূর্ণ লেখা>" ] }
 * ```
 *
 * `addBookmarkItem` একই প্রশ্ন আগে থেকে থাকলে আগেরটা মুছে নতুনটা বসায় —
 * ফলে প্রশ্ন-লেখা বদলালে (শিক্ষক সংশোধন) পুরোনো নকল জমে না।
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
        // ⚠️ id খালি হলে দ্বিতীয় insert duplicate-key-এ ব্যর্থ হয় (সারির id ইউনিক),
        // আর তখন বুকমার্ক "সেভ হচ্ছে না" মনে হয় — কারণ খুঁজতে অনেক সময় যায়।
        // বিস্তারিত: `src/app/api/reads/route.ts`।
        id: rawId || `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
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

  // remove-এ প্রশ্নের লেখা — আইডি নয় (উপরে ব্যাখ্যা)
  const texts = rawRemove.map((v) => String(v || "").trim()).filter(Boolean);

  let added = 0;
  for (const item of items) {
    if (await addBookmarkItem("", item)) added++;
  }
  let removed = 0;
  for (const text of texts) {
    if (await removeBookmarkItem("", text)) removed++;
  }

  return apiOk({
    applied: {
      added,
      addRequested: items.length,
      removed,
      removeRequested: texts.length,
    },
  });
});
