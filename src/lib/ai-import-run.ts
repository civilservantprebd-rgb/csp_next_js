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

/** কোড-ফেন্সে মোড়ানো থাকলে বা আশপাশে কথা থাকলে JSON অংশটা বের করা */
function extractJson(text: string): any | null {
  const cleaned = text
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

  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";

  const { text: raw, finishReason } = await callDeepSeek({
    apiKey: key,
    model,
    prompt: `${AI_JSON_PROMPT}\n\n--- ইনপুট শুরু ---\n${text}\n--- ইনপুট শেষ ---`,
    baseUrl: process.env.DEEPSEEK_BASE_URL,
    jsonMode: true,
    disableThinking: (process.env.DEEPSEEK_THINKING || "").trim().toLowerCase() !== "on",
  });

  const parsedJson = extractJson(raw);
  if (!parsedJson) {
    console.error("[ai-import] JSON বোঝা যায়নি, কাঁচা উত্তর:", raw.slice(0, 500));
    return { success: false, error: "AI-র উত্তর JSON আকারে আসেনি। আবার চেষ্টা করুন।" };
  }

  const normalized = normalizePayload(parsedJson);
  if ("error" in normalized) return { success: false, error: normalized.error };

  const payload = normalized.payload;
  const truncated = finishReason === "length";
  if (truncated) {
    payload.warnings.unshift(
      "উত্তর অনেক বড় হয়ে গিয়েছিল — শেষের কিছু প্রশ্ন বাদ পড়তে পারে। ছোট ছোট ভাগে দিলে সব আসবে।"
    );
  }

  const withAnswer = payload.questions.filter((q) => q.correct !== null).length;

  console.log(
    `[ai-import] in=${text.length}chars out=${raw.length}chars questions=${payload.questions.length} withAnswer=${withAnswer} truncated=${truncated}`
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
