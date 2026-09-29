import { AI_JSON_PROMPT, type AiImportPayload, type AiImportQuestion } from "@/lib/ai-import-prompt";
import { callDeepSeek } from "@/lib/ai-providers";

/**
 * "যে ফরম্যাটেই দিই, AI বুঝে MCQ বানিয়ে দেবে" — এই কাজটার আসল ইঞ্জিন।
 *
 * **মূল নকশা (আগের থেকে বদল):** কাঠামো ঠিক করার সিদ্ধান্ত পুরোপুরি DeepSeek-এর।
 * আগে আমরা টেক্সট ফিরিয়ে এনে নিজের regex দিয়ে লাইন ভাগ করতাম — তখনই
 * `০.৬৩` কে প্রশ্ন-নম্বর, `গ.সা.গু.`-এর `গ.` কে অপশন-মার্কার ভাবা জাতীয় ভুল
 * হতো। এখন মডেল JSON-এ প্রশ্ন/অপশন/উত্তর/ব্যাখ্যা আলাদা করে দেয়, আর এখানে
 * শুধু **যাচাই** হয় (খালি প্রশ্ন, ভুল ইনডেক্স, অসম্পূর্ণ অপশন ইত্যাদি)।
 *
 * API key শুধু সার্ভারে; ডাকা হয় `src/app/api/ai/import/route.ts` থেকে।
 */

const MAX_TEXT_CHARS = 120_000;

/**
 * এক কলে সর্বোচ্চ কত token লেখা হবে।
 *
 * ── যে বাগটা এটা ঠিক করে (২০২৬-০৯-২৮) ──
 * আগে ছিল ৮,০০০ — আর সেটাই ছিল "AI দিয়ে সাজানো হচ্ছে না"-র আসল কারণ।
 * ব্যাখ্যাসহ বইয়ের প্রশ্নে ২০টি প্রশ্নেই উত্তর ৮,০০০ token ছাড়িয়ে যেত, JSON
 * মাঝপথে কেটে যেত, `extractJson` ব্যর্থ হতো, আর ফলাফল **পুরোটা** ফেলে দেওয়া
 * হতো — ১০টি সম্পূর্ণ প্রশ্ন হাতের মুঠোয় থাকা সত্ত্বেও শিক্ষক দেখতেন
 * "AI-র উত্তর JSON আকারে আসেনি।"
 *
 * মাপা ফল (deepseek-flash): ১০ প্রশ্ন ≈ ৪,৩০০ token, ২০ প্রশ্ন ≈ ৮,০০০ (কাটা
 * পড়ত), ৩০ প্রশ্ন ≈ ১২,০০০ token। এখন ৩২,০০০ — যেকোনো বাস্তব পেস্ট ধরে।
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 32_000;

/**
 * এক কলে কত অক্ষরের বেশি টেক্সট নয়। এর চেয়ে বড় পেস্ট ভাগ করে কয়েকবার কল হয়।
 *
 * ⚠️ মনে রাখতে হবে: ভাগ করায় কল-সংখ্যা বাড়ে, আর Vercel-এ `maxDuration = 60`
 * (route-এ সেট করা) সেকেন্ডের সীমা। তাই খুব বড় পেস্ট (লাখ অক্ষরের কাছাকাছি)
 * লোকাল ডেভ-সার্ভারে ঠিকই কাজ করবে, কিন্তু ডিপ্লয়ে টাইমআউট হতে পারে।
 */
const CHUNK_CHAR_BUDGET = 20_000;

/**
 * একসাথে কতগুলো ভাগ পাঠানো হবে।
 *
 * ভাগগুলো একটার পর একটা পাঠালে সময় যোগ হয় (৬০ প্রশ্ন ≈ ৭০ সেকেন্ড, যা
 * রাউটের `maxDuration = 60` ছাড়িয়ে যায়)। ৩টা করে একসাথে পাঠালে সময় প্রায়
 * এক-তৃতীয়াংশে নামে, কিন্তু মডেলের rate-limit-এ ধাক্কা খাওয়ার ঝুঁকিও থাকে —
 * তাই ছোট রাখা হয়েছে। কোনো ভাগ ব্যর্থ হলে সেটা আলাদাভাবেই ধরা পড়ে
 * (চারপাশের try/catch), বাকিরা স্বাভাবিকভাবে ফেরে।
 */
const MAX_PARALLEL_CALLS = 3;

/** ক্রম ঠিক রেখে সীমিত সংখ্যক কাজ একসাথে চালানো */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  );

  return out;
}

function maxOutputTokens(): number {
  const raw = Number.parseInt(process.env.DEEPSEEK_MAX_TOKENS || "", 10);
  return Number.isFinite(raw) && raw >= 2_000 ? raw : DEFAULT_MAX_OUTPUT_TOKENS;
}

/** সতর্কতা-বার্তায় বাংলা সংখ্যা (দশমিক অংশটুকু ইংরেজিতেই থাকে) */
function bn(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}

export interface AiImportResult {
  success: boolean;
  payload?: AiImportPayload;
  /** কতগুলো প্রশ্ন এসেছে / তার মধ্যে কতগুলোতে উত্তর আছে */
  totalParsed?: number;
  validCount?: number;
  /** আউটপুট কাটা পড়লে true (অনেক প্রশ্ন একবারে দিলে হতে পারে) */
  truncated?: boolean;
  error?: string;
}

const ANSWER_LABELS = ["ক", "খ", "গ", "ঘ"];

/** "ক"/"b"/"৩"/2 → ০-৩; না মিললে null (অনুমান করা হয় না) */
function toAnswerIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3) return value;
  if (typeof value !== "string") return null;

  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  const first = raw.replace(/^[\(\[\{\s]+/, "").charAt(0);
  const bengaliIdx = ANSWER_LABELS.indexOf(first);
  if (bengaliIdx >= 0) return bengaliIdx;

  const latinIdx = ["a", "b", "c", "d"].indexOf(first);
  if (latinIdx >= 0) return latinIdx;

  const ascii = raw.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  const num = Number(ascii.replace(/[^\d]/g, ""));
  if (Number.isInteger(num) && num >= 1 && num <= 4) return num - 1;

  return null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** প্রশ্ন/অপশন এক লাইনে থাকা দরকার — ভেতরের সব নতুন লাইন/বাড়তি স্পেস চেপে দেওয়া হয় */
function asSingleLine(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/**
 * মডেল কখনো `\n` কে দুই অক্ষরের লেখা হিসেবে ফেরায় (ডাবল-এস্কেপড) — তখন
 * নতুন লাইন না পেয়ে ব্যাখ্যা এক লাইনে জোড়া লেগে যায়। LaTeX কমান্ড না থাকলে
 * নিরাপদে সেগুলো আসল নতুন লাইনে বদলে দেওয়া হয়।
 */
function reviveLiteralNewlines(text: string): string {
  if (/\\[a-zA-Z{[(]/.test(text)) return text; // LaTeX আছে — হাতে না দেওয়াই ভালো
  return text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, " ");
}

/**
 * ব্যাখ্যার প্যারাগ্রাফ কাঠামো ঠিক রাখা — লাইনপ্রতি বাড়তি স্পেস বাদ, দুইয়ের
 * বেশি ফাঁকা লাইন এক করা, শুরু/শেষের ফাঁকা লাইন বাদ। ভেতরের অনুচ্ছেদ অটুট থাকে,
 * কারণ UI `whitespace-pre-wrap` দিয়ে এগুলোই প্যারা হিসেবে দেখায়।
 */
function normalizeExplanation(v: unknown): string {
  const raw = typeof v === "string" ? reviveLiteralNewlines(v) : "";
  if (!raw.trim()) return "";

  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

/**
 * কোড-ফেন্সে মোড়ানো থাকলে বা আশপাশে কথা থাকলে JSON অংশটা বের করা।
 *
 * `<|channel|>` জাতীয় বিশেষ token মডেল মাঝে মাঝে আউটপুটে ফাঁস করে দেয়
 * (প্রকৃত কলেই মাপা গেছে) — সেগুলো JSON-কে ভাঙে, তাই আগেই মুছে দেওয়া হয়।
 */
function extractJson(text: string): any | null {
  const cleaned = text
    .replace(/<\|[^|>]{0,64}\|>/g, "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * কাটা পড়া JSON থেকে **সম্পূর্ণ** প্রশ্ন-অবজেক্টগুলো উদ্ধার করা।
 *
 * ── কেন জরুরি ──
 * উত্তর token-সীমায় কাটলে `JSON.parse` পুরো লেখাটাই ফেলে দেয় — অথচ প্রথম
 * দশটি প্রশ্ন অক্ষত পড়ে থাকে। শিক্ষকের কাছে "০টি প্রশ্ন, এরর" আর "১০টি প্রশ্ন,
 * শেষের দুটি বাদ" — এই পার্থক্যটাই এখানে তৈরি হয়। token-সীমা বাড়ানোর পরও
 * এটা নিরাপত্তা-জাল হিসেবেই থাকে: মডেল কখনো অকারণে বড় উত্তর দিলে যেন
 * শিক্ষকের কিছুই হারিয়ে না যায়।
 *
 * পদ্ধতি: `questions` অ্যারের ভেতরে বন্ধনী গুনে (স্ট্রিং ও escape মেনে) প্রতিটি
 * সম্পূর্ণ `{…}` আলাদা করা হয়, তারপর এক-এক করে parse — ভাঙা শেষ অবজেক্টটি
 * শুধু নিজেই বাদ পড়ে, বাকিরা বেঁচে যায়।
 */
function salvageJsonObjects(text: string, key = "questions"): any[] {
  const keyAt = text.indexOf(`"${key}"`);
  const start = text.indexOf("[", keyAt >= 0 ? keyAt : 0);
  if (start < 0) return [];

  const found: any[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === "{") { if (depth === 0) objStart = i; depth++; continue; }
    if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { found.push(JSON.parse(text.slice(objStart, i + 1))); } catch { /* ভাঙা অবজেক্ট বাদ */ }
        objStart = -1;
      }
      continue;
    }
    // questions অ্যারে শেষ — এর পরে আর খোঁজার কিছু নেই
    if (ch === "]" && depth === 0) break;
  }

  return found;
}

/** কাটা পড়া উত্তরের শুরুতেই `"topic": "…"` থাকলে সেটা তুলে নেওয়া */
function salvageTopic(text: string): string {
  const m = text.match(/"topic"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return "";
  try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
}

/**
 * বড় পেস্টকে কয়েকটি ছোট ভাগে ভাগ করা — যাতে কোনো এক কলে উত্তর token-সীমায়
 * কেটে না যায়।
 *
 * ভাগ করা হয় **ফাঁকা লাইনের সীমায়**, কারণ চেনা সব ফরম্যাটে (বই, Word, OCR,
 * অ্যাপের নমুনা) ফাঁকা লাইনই প্রশ্নের সীমানা — ফলে একটি প্রশ্ন দুই টুকরোয়
 * ভাগ হয়ে হারিয়ে যায় না। কোনো একক ব্লক নিজেই বাজেটের চেয়ে বড় হলে (যেমন
 * এক লাইনে গোটা অধ্যায়) তখনই কেবল অক্ষর-গুনে জোর করে কাটা হয়।
 */
function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_CHAR_BUDGET) return [text];

  const blocks = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const block of blocks) {
    if (block.length > CHUNK_CHAR_BUDGET) {
      flush();
      for (let i = 0; i < block.length; i += CHUNK_CHAR_BUDGET) {
        chunks.push(block.slice(i, i + CHUNK_CHAR_BUDGET));
      }
      continue;
    }
    if (current.length + block.length + 2 > CHUNK_CHAR_BUDGET) flush();
    current += (current ? "\n\n" : "") + block;
  }
  flush();

  return chunks.length > 0 ? chunks : [text];
}

/**
 * AI-র JSON যাচাই ও পরিষ্কার করা। এখানে অনুমান নেই — যা ভাঙা তা বাদ পড়ে,
 * আর কেন বাদ পড়ল তা শিক্ষক `warnings`-এ দেখতে পান।
 */
function normalizePayload(data: any): { payload: AiImportPayload } | { error: string } {
  if (!data || typeof data !== "object") {
    return { error: "AI-র উত্তর JSON নয় — আবার চেষ্টা করুন।" };
  }

  const list = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : null;
  if (!list) {
    return { error: "AI-র উত্তরে প্রশ্নের তালিকা (questions) পাওয়া যায়নি।" };
  }

  const warnings: string[] = [];
  const questions: AiImportQuestion[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;

    const q = asSingleLine(item.q);
    if (!q) {
      warnings.push("একটি প্রশ্নে প্রশ্নের লেখা ছিল না — বাদ দেওয়া হয়েছে।");
      continue;
    }

    const rawOpts: unknown[] = Array.isArray(item.opts) ? item.opts : [];
    let opts = rawOpts.map(asSingleLine).filter((o) => o.length > 0);

    if (opts.length > 4) {
      warnings.push(`"${q.slice(0, 30)}…" — ৪টির বেশি অপশন এসেছে, প্রথম ৪টি নেওয়া হয়েছে।`);
      opts = opts.slice(0, 4);
    }
    if (opts.length < 4) {
      warnings.push(`"${q.slice(0, 30)}…" — ${opts.length}টি অপশন পাওয়া গেছে (৪টি দরকার), প্রশ্নটি বাদ দেওয়া হয়েছে।`);
      continue;
    }

    questions.push({
      q,
      opts,
      correct: toAnswerIndex(item.correct),
      exp: normalizeExplanation(item.exp),
    });
  }

  if (questions.length === 0) {
    return { error: warnings[0] || "AI-র উত্তরে কোনো ব্যবহারযোগ্য প্রশ্ন পাওয়া যায়নি।" };
  }

  const topicRaw = asSingleLine(data.topic);
  let topic: string | undefined;
  let subtopic: string | undefined;
  if (topicRaw) {
    const parts = topicRaw.split(/\s*[>›/|]\s*/).map((p) => p.trim()).filter(Boolean);
    topic = parts[0];
    if (parts.length > 1) subtopic = parts.slice(1).join(" > ");
  }

  return { payload: { topic, subtopic, questions, warnings } };
}

function looksLikeDeepSeekKey(key: string): boolean {
  return /^sk-[0-9A-Za-z_\-]{20,}$/.test(key.trim());
}

export async function runAiImport(input: { text?: string }): Promise<AiImportResult> {
  const text = (input.text || "").trim();

  if (!text) return { success: false, error: "সাজানোর জন্য টেক্সট পেস্ট করুন।" };
  if (text.length > MAX_TEXT_CHARS) {
    return { success: false, error: "টেক্সট অনেক বড়। একবারে কয়েক ডজন প্রশ্ন দিতে পারেন।" };
  }

  const key = (process.env.DEEPSEEK_API_KEY || "").trim();
  if (!looksLikeDeepSeekKey(key)) {
    return {
      success: false,
      error:
        "DEEPSEEK_API_KEY পাওয়া যায়নি বা ভুল ফরম্যাটে আছে (.env.local-এ sk-… দিয়ে শুরু হওয়া key বসিয়ে ডেভ-সার্ভার রিস্টার্ট করুন)।",
    };
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const chunks = splitIntoChunks(text);
  const rawItems: any[] = [];
  const chunkWarnings: string[] = [];
  let topicRaw = "";
  let truncated = false;
  let salvaged = false;
  let outChars = 0;

  type ChunkOutcome = { raw: string; finishReason?: string; error?: string };

  const outcomes = await mapWithConcurrency<string, ChunkOutcome>(
    chunks,
    MAX_PARALLEL_CALLS,
    async (chunk, i): Promise<ChunkOutcome> => {
      try {
        const res = await callDeepSeek({
          apiKey: key,
          model,
          prompt: `${AI_JSON_PROMPT}\n\n--- ইনপুট শুরু ---\n${chunk}\n--- ইনপুট শেষ ---`,
          baseUrl: process.env.DEEPSEEK_BASE_URL,
          jsonMode: true,
          disableThinking: (process.env.DEEPSEEK_THINKING || "").trim().toLowerCase() !== "on",
          maxTokens: maxOutputTokens(),
        });
        return { raw: res.text, finishReason: res.finishReason };
      } catch (err: any) {
        // এক ভাগ ব্যর্থ হলে পুরো কাজ নষ্ট না করে বাকি ভাগ চালিয়ে যাওয়া হয় —
        // শিক্ষক যেন অন্তত বাকি প্রশ্নগুলো পান। এক ভাগই হলে এররটা উপরে যাক।
        if (chunks.length === 1) throw err;
        console.error(`[ai-import] ভাগ ${i + 1}/${chunks.length} ব্যর্থ:`, err?.message);
        return { raw: "", error: err?.message || "অজানা সমস্যা" };
      }
    }
  );

  // ক্রম ঠিক রাখা হয় — ভাগগুলো একসাথে চললেও প্রশ্নের ক্রম বদলায় না
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];

    if (outcome.error) {
      chunkWarnings.push(
        `অংশ ${bn(i + 1)}/${bn(chunks.length)} সাজানো যায়নি (${outcome.error}) — বাকি অংশ থেকে প্রশ্ন নেওয়া হয়েছে।`
      );
      continue;
    }

    const raw = outcome.raw;
    outChars += raw.length;
    if (outcome.finishReason === "length") truncated = true;

    const parsed = extractJson(raw);
    let list: any[] | null = null;
    if (Array.isArray(parsed)) list = parsed;
    else if (parsed && Array.isArray(parsed.questions)) list = parsed.questions;
    if (!topicRaw && parsed && typeof parsed.topic === "string") topicRaw = parsed.topic;

    if (!list || list.length === 0) {
      // JSON কাটা পড়েছে বা ভেঙে গেছে — সম্পূর্ণ প্রশ্নগুলো উদ্ধার করা হয়
      const recovered = salvageJsonObjects(raw);
      if (recovered.length > 0) {
        list = recovered;
        salvaged = true;
      }
      if (!topicRaw) topicRaw = salvageTopic(raw);
    }

    if (!list || list.length === 0) {
      console.error(`[ai-import] ভাগ ${i + 1}/${chunks.length}: প্রশ্ন বের করা যায়নি, কাঁচা উত্তর:`, raw.slice(0, 300));
      chunkWarnings.push(`অংশ ${bn(i + 1)}/${bn(chunks.length)}: কোনো প্রশ্ন বের করা যায়নি।`);
      continue;
    }

    rawItems.push(...list);
  }

  if (rawItems.length === 0) {
    return {
      success: false,
      error:
        chunkWarnings[0] ||
        "AI-র উত্তর JSON আকারে আসেনি। আবার চেষ্টা করুন।",
    };
  }

  const normalized = normalizePayload({ topic: topicRaw, questions: rawItems });
  if ("error" in normalized) return { success: false, error: normalized.error };

  const payload = normalized.payload;

  // সতর্কতাগুলো শিক্ষকের সামনে আগে আসুক (কেন কিছু বাদ পড়ল সেটাই মূল কথা)
  payload.warnings.unshift(...chunkWarnings);
  if (truncated) {
    payload.warnings.unshift(
      salvaged
        ? "AI-র উত্তর মাঝপথে কেটে গিয়েছিল — সম্পূর্ণ হওয়া প্রশ্নগুলো রাখা হয়েছে; শেষের কয়েকটি বাদ পড়তে পারে।"
        : "উত্তর অনেক বড় হয়ে গিয়েছিল — শেষের কিছু প্রশ্ন বাদ পড়তে পারে। ছোট ছোট ভাগে দিলে সব আসবে।"
    );
  }

  const withAnswer = payload.questions.filter((q) => q.correct !== null).length;

  console.log(
    `[ai-import] in=${text.length}chars chunks=${chunks.length} out=${outChars}chars questions=${payload.questions.length} withAnswer=${withAnswer} truncated=${truncated} salvaged=${salvaged}`
  );
  if ((process.env.AI_IMPORT_DEBUG || "") === "1") {
    console.log("[ai-import] IN >>>\n" + text.slice(0, 3000));
    console.log("[ai-import] JSON >>>\n" + JSON.stringify(payload).slice(0, 4000));
  }

  return {
    success: true,
    payload,
    totalParsed: payload.questions.length,
    validCount: withAnswer,
    truncated,
  };
}
