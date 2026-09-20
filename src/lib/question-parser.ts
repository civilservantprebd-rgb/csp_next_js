import { parseBengaliDigits } from "./utils";
import { maskMathSpans, unmaskMathSpans } from "./math-text";
import { normalizePastedContent } from "./import-normalize";
import { QuestionItem, QuestionSolution } from "@/types/exam";

export interface ParsedQuestionBlock {
  q: string;
  opts: string[];
  correct: number;
  exp: string;
  topic?: string;
  subtopic?: string;
  isValid: boolean;
  /** প্রশ্নটিতে সঠিক উত্তর লেখা ছিল না (ডিফল্ট 'ক' ধরে নেওয়া হয়েছে) */
  answerMissing?: boolean;
  error?: string;
}

/** উত্তর লাইন: "উত্তর: ক", "Ans: B", "সঠিক উত্তর: (গ)" ইত্যাদি */
const ANSWER_LINE_RE =
  /^(সঠিক\s*উত্তর|উত্তরঃ|উত্তর|উ\s*[:ঃ\.\-]|correct\s*answer|answer|correct\s*ans|ans|ans\s*[:ঃ\.\-]|answer\s*[:ঃ\.\-])[\s\-–—:ঃ\.]*([^\n\r]+)/i;

/**
 * ব্যাখ্যা লাইন: "ব্যাখ্যা: ...", "Exp: ..." ইত্যাদি।
 * `explanation` আগে রাখা হয়েছে যাতে "exp" শর্টকাট "explanation"-এর অংশ
 * কেটে না ফেলে; আর কনটেন্ট অংশটি শূন্যও হতে পারে — অর্থাৎ শুধু "ব্যাখ্যা:"
 * লিখে পরের লাইনগুলোতে ব্যাখ্যা লেখা হলে সেটাও ধরা পড়বে।
 */
const EXPLANATION_LINE_RE =
  /^(explanation|ব্যাখ্যা|note|নোট|exp)(?=[\s\-–—:ঃ.]|$)[\s\-–—:ঃ.]*([^\n\r]*)/i;

/**
 * প্রশ্নের নম্বর: `১.` `1)` `১-` `প্রশ্ন ১:` `Q1:`।
 *
 * ডট/ড্যাশ-রূপে পরে **স্পেস বাধ্যতামূলক**, আর ডটের পরপরই আরেকটা অঙ্ক থাকলে
 * সেটা দশমিক — নম্বর নয়। নইলে `০.৬৩, ১.০৫, ২.১০।` জাতীয় লাইনকে পarser
 * "০." নম্বরের প্রশ্ন ভেবে ফেলে, আর একটা প্রশ্ন ভেঙে দুটো হয়ে যায়
 * (দ্বিতীয়টা উত্তরহীন ⚠️)। এটা লাইভ ডেটায় ধরা পড়া বাগ।
 */
const QUESTION_NUMBER =
  "(?:[০-৯\\d]+\\)|[০-৯\\d]+[\\.\\-–—](?![০-৯0-9])(?=[ \\t]|$)|প্রশ্ন\\s*[০-৯\\d]*\\s*[:ঃ\\.]|Q\\s*[০-৯\\d]*\\s*[:ঃ\\.])";

/** প্রশ্নের শুরু: "১.", "1)", "প্রশ্ন ১:", "Q1:" */
const QUESTION_START_RE = new RegExp(`^${QUESTION_NUMBER}`, "i");

/** প্রশ্নের নম্বর কাটার জন্য (লাইনের শুরুতে ইনডেন্টেশনসহ) */
const QUESTION_MARKER_RE = new RegExp(`^[ \\t]*${QUESTION_NUMBER}[ \\t]*`, "i");

/** একই নিয়মে নম্বর+বাকি অংশ — পarser-এর ভেতরের গার্ডে ব্যবহৃত */
const QUESTION_LINE_RE = new RegExp(`^(${QUESTION_NUMBER})\\s*(.+)$`, "i");

/** শুধু বিভাজক রেখা (---, ===, ***) — এসব কোনো অপশনের অংশ নয় */
const SEPARATOR_LINE_RE = /^[ \t]*[-–—_=*~#.।|:•]+[ \t]*$/;

/**
 * উত্তর-লেবেল (ক/খ/গ/ঘ, a–d, ১–৪) → অপশন ইনডেক্স। প্রশ্নের লাইনের শেষে
 * বসানো উত্তর ("… ঘ) চার উত্তর: ক") কাটার সময় এটাই দরকার হয়।
 */
function answerLabelToIndex(label: string): number | null {
  const l = label.trim().toLowerCase();
  if (!l) return null;
  const norm = parseBengaliDigits(l);
  if (l.startsWith("ক") || l.startsWith("a") || norm === "1") return 0;
  if (l.startsWith("খ") || l.startsWith("b") || norm === "2") return 1;
  if (l.startsWith("গ") || l.startsWith("c") || norm === "3") return 2;
  if (l.startsWith("ঘ") || l.startsWith("d") || norm === "4") return 3;
  return null;
}

/**
 * Smart Question Parser
 * Supports Bengali & English numbered questions, options (ক/খ/গ/ঘ or a/b/c/d or 1/2/3/4),
 * answers (উত্তরঃ/উত্তর:/Ans:/Answer:) and explanations (ব্যাখ্যা:/Exp:/Explanation:),
 * and automatic hierarchy/topic/subtopic detection from markdown headers or 'টপিক:' tags.
 *
 * ফরম্যাটিং নীতি: প্রশ্ন, অপশন আর ব্যাখ্যার ভেতরের লেখা হুবহু সংরক্ষণ করা হয় —
 * লাইন ব্রেক, ফাঁকা লাইন, ইনডেন্টেশন ও স্পেসিং সবই ব্যবহারকারী যেভাবে লিখেছেন
 * সেভাবেই থাকে। শুধু কাঠামোর মার্কারগুলো (প্রশ্নের নম্বর, "ক)", "উত্তর:",
 * "ব্যাখ্যা:") বাদ যায়। (আগে প্রতিটি লাইন trim হয়ে ব্যাখ্যা এক লাইনে জোড়া
 * লাগত — তাতেই ফরম্যাটিং নষ্ট হত।)
 */
export function parseBulkQuestionsText(
  rawText: string,
  defaultTopic?: string,
  defaultSubtopic?: string,
  options?: {
    /**
     * উত্তর লেখা না থাকলে প্রশ্নটা বৈধ ধরা হবে কি না (সঠিক উত্তর = ক)।
     * দরকার হয় কারণ অনেক বইয়ে উত্তর আলাদা পাতায় থাকে — তখন সব প্রশ্ন
     * "সঠিক উত্তর উল্লেখ নেই" বলে বাদ পড়লে একটাও ইমপোর্ট হয় না।
     * ডিফল্ট false: উত্তর ছাড়া প্রশ্ন নিজে থেকে ঢুকে পড়বে না।
     */
    allowMissingAnswer?: boolean;
  }
): {
  questions: QuestionItem[];
  solutions: QuestionSolution[];
  blocks: ParsedQuestionBlock[];
  validCount: number;
  totalParsed: number;
} {
  if (!rawText || !rawText.trim()) {
    return { questions: [], solutions: [], blocks: [], validCount: 0, totalParsed: 0 };
  }

  // AI চ্যাট (Gemini/ChatGPT) থেকে কপি করা Markdown সাজসজ্জা বাদ:
  // **বোল্ড**, ### হেডিং, > ব্লককোট, কোড-ফেন্স, | টেবিল | — নইলে
  // "**উত্তর: ক**" বা "**ক)**" লাইনগুলো চেনা যায় না।
  const cleaned = normalizePastedContent(rawText);

  // LaTeX ম্যাথ স্প্যানগুলো আগে mask করা হয়: নইলে ম্যাথ সোর্সের ভেতরের
  // `\frac{1}{2})`, `a)` বা `#` জাতীয় অংশ অপশন-মার্কার/টপিক-হেডার regex-এ
  // পড়ে প্রশ্নটা ভুলভাবে ভেঙে যেত। পার্স শেষে আসল টেক্সট ফিরিয়ে দেওয়া হয়।
  const { masked, spans } = maskMathSpans(cleaned);

  // Split into blocks by double newline or numbered questions or topic headers
  const lines = masked.split(/\r?\n/);
  const rawBlocks: { lines: string[]; currentSectionTopic?: string; currentSectionSubtopic?: string }[] = [];
  let currentBlockLines: string[] = [];
  let activeTopic = defaultTopic?.trim() || "";
  let activeSubtopic = defaultSubtopic?.trim() || "";

  const isTopicHeader = (line: string) => {
    const trimmed = line.trim();
    return /^#+\s+|^\[?(টপিক|অধ্যায়|চ্যাপ্টার|অধ্যায়|বিষয়|বিষয়|Topic|Chapter|Subject)\]?\s*[:ঃ\-=]/i.test(trimmed);
  };

  const parseTopicHeader = (line: string) => {
    const trimmed = line.trim().replace(/^#+\s*/, "").replace(/^\[?(টপিক|অধ্যায়|চ্যাপ্টার|অধ্যায়|বিষয়|বিষয়|Topic|Chapter|Subject)\]?\s*[:ঃ\-=]\s*/i, "").trim();
    // Support hierarchy like "বাংলা সাহিত্য > প্রাচীন যুগ > চর্যাপদ" or "পরিবেশ / চুক্তি"
    const parts = trimmed.split(/\s*[>›/|]\s*/);
    if (parts.length >= 2) {
      return {
        topic: parts[0].trim(),
        subtopic: parts.slice(1).join(" > ").trim()
      };
    }
    return {
      topic: trimmed,
      subtopic: ""
    };
  };

  const isQuestionStart = (line: string) => QUESTION_START_RE.test(line.trim());

  /**
   * "১) … ২) … ৩) … ৪) …" ধাঁচের অপশন নম্বর — প্রশ্নের নম্বরও দেখতে প্রায় একই
   * (`১.`, `১)`), তাই `QUESTION_START_RE` একা এদের আলাদা করতে পারে না। তখন
   * সামনের দিকটা দেখে সিদ্ধান্ত নেওয়া হয়: ১ থেকে শুরু করে পরপর কয়েকটা
   * নম্বর-মার্কার পেলে সেগুলো প্রশ্ন নয়, চলতি ব্লকের অপশন।
   */
  const digitOptionRun = (from: number): number[] => {
    const indices: number[] = [];
    let expected = 1;
    for (let k = from; k < lines.length; k++) {
      const t = lines[k].trim();
      if (!t) {
        if (indices.length > 0) break;
        continue;
      }
      const m = t.match(/^\(?([০-৯\d]{1,3})[\)\-–—]/);
      if (!m) break;
      if (Number(parseBengaliDigits(m[1])) !== expected) break;
      indices.push(k);
      expected += 1;
      if (indices.length >= 4) break;
    }
    return indices;
  };

  const blockHasAnswerLine = (blockLines: string[]) =>
    blockLines.some((l) => ANSWER_LINE_RE.test(l.trim()));

  const blockHasExplanation = (blockLines: string[]) =>
    blockLines.some((l) => EXPLANATION_LINE_RE.test(l.trim()));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // ফাঁকা লাইন হারিয়ে ফেলা যাবে না — প্রশ্ন ও ব্যাখ্যার প্যারাগ্রাফ
      // আলাদা করার জন্য এগুলো পরে দরকার হয়।
      if (currentBlockLines.length > 0) currentBlockLines.push(line);
      continue;
    }

    // Check if line is a topic/chapter header
    if (isTopicHeader(trimmed)) {
      if (currentBlockLines.length > 0) {
        rawBlocks.push({ lines: currentBlockLines, currentSectionTopic: activeTopic, currentSectionSubtopic: activeSubtopic });
        currentBlockLines = [];
      }
      const parsedH = parseTopicHeader(trimmed);
      activeTopic = parsedH.topic || activeTopic;
      activeSubtopic = parsedH.subtopic || activeSubtopic;
      continue;
    }

    if (isQuestionStart(trimmed) && currentBlockLines.length > 0) {
      const run = digitOptionRun(i);
      if (run.length >= 2) {
        if (blockHasExplanation(currentBlockLines)) {
          // ব্যাখ্যার ভেতরের "১) … ২) …" তালিকা — প্রশ্ন নয়, ব্যাখ্যারই অংশ
          for (const k of run) currentBlockLines.push(lines[k]);
          i = run[run.length - 1];
          continue;
        }
        if (!blockHasAnswerLine(currentBlockLines)) {
          // "১) … ২) …" — এগুলো চলতি প্রশ্নেরই অপশন, নতুন প্রশ্ন নয়
          for (const k of run) currentBlockLines.push(lines[k]);
          i = run[run.length - 1];
          continue;
        }
      }
      rawBlocks.push({ lines: currentBlockLines, currentSectionTopic: activeTopic, currentSectionSubtopic: activeSubtopic });
      currentBlockLines = [line];
    } else {
      currentBlockLines.push(line);
    }
  }

  if (currentBlockLines.length > 0) {
    rawBlocks.push({ lines: currentBlockLines, currentSectionTopic: activeTopic, currentSectionSubtopic: activeSubtopic });
  }

  const blocks: ParsedQuestionBlock[] = [];
  const questions: QuestionItem[] = [];
  const solutions: QuestionSolution[] = [];

  for (const blockData of rawBlocks) {
    const blockLines = blockData.lines;
    const qLines: string[] = [];
    const expLines: string[] = [];
    const opts: string[] = [];
    let correctIdx = 0;
    let ansFound = false;
    let expStarted = false;
    const inlineTopic = blockData.currentSectionTopic || "";
    const inlineSubtopic = blockData.currentSectionSubtopic || "";

    /** প্রশ্নের লাইন যোগ করা — প্রথম লাইন থেকে শুধু নম্বর মার্কারটা বাদ যায়, বাকিটা অপরিবর্তিত */
    const pushQuestionLine = (raw: string) => {
      if (qLines.length === 0) {
        const marker = raw.match(QUESTION_MARKER_RE);
        qLines.push(marker ? raw.slice(marker[0].length) : raw.trimStart());
      } else {
        qLines.push(raw);
      }
    };

    /**
     * উত্তর লাইন শনাক্ত করা। "উত্তর দেওয়ার আগে…" জাতীয় বাক্য উত্তর লাইন নয়,
     * তাই অপশন-লেবেল না মিললে matched:true কিন্তু idx:null ফেরে — তখন লাইনটি
     * প্রশ্নের টেক্সট হিসেবে ধরা হয় (আগের আচরণ অপরিবর্তিত)।
     */
    const probeAnswer = (text: string): { matched: boolean; idx: number | null } => {
      const m = text.match(ANSWER_LINE_RE);
      if (!m) return { matched: false, idx: null };
      const cleanAns = m[2].trim().replace(/^[\(\[\{\s]+|[\)\]\}\s\.\-]+$/g, "").trim().toLowerCase();
      const normVal = parseBengaliDigits(cleanAns);
      const looksLikeOption =
        /^[কখগঘabcdABCD১-৪1-4]/.test(cleanAns) ||
        opts.some((o) => o.toLowerCase().trim() === cleanAns);
      if (!looksLikeOption) return { matched: true, idx: null };

      if (cleanAns.startsWith("ক") || cleanAns.startsWith("a") || normVal === "1" || normVal === "0") return { matched: true, idx: 0 };
      if (cleanAns.startsWith("খ") || cleanAns.startsWith("b") || normVal === "2") return { matched: true, idx: 1 };
      if (cleanAns.startsWith("গ") || cleanAns.startsWith("c") || normVal === "3") return { matched: true, idx: 2 };
      if (cleanAns.startsWith("ঘ") || cleanAns.startsWith("d") || normVal === "4") return { matched: true, idx: 3 };

      // If the answer is the full option text, check against opts
      const matchedOptIdx = opts.findIndex((o) => o.toLowerCase().trim() === cleanAns);
      return { matched: true, idx: matchedOptIdx !== -1 ? matchedOptIdx : 0 };
    };

    /**
     * এই ব্লকের ভেতরে `from` থেকে শুরু করে "১) ২) ৩) …" ধারাবাহিক নম্বর-মার্কার
     * কতগুলো পাশাপাশি আছে (প্রশ্ন বনাম ব্যাখ্যার তালিকা আলাদা করতে দরকার)।
     */
    const digitRunInBlock = (from: number): number => {
      let expected = 1;
      let count = 0;
      for (let k = from; k < blockLines.length; k++) {
        const t = blockLines[k].trim();
        if (!t) {
          if (count > 0) break;
          continue;
        }
        const m = t.match(/^\(?([০-৯\d]{1,3})[\)\-–—]/);
        if (!m || Number(parseBengaliDigits(m[1])) !== expected) break;
        expected += 1;
        count += 1;
        if (count >= 4) break;
      }
      return count;
    };

    for (let j = 0; j < blockLines.length; j++) {
      const rawLine = blockLines[j];
      const line = rawLine.trim();

      if (!line) {
        // প্রশ্নের স্টেমের ভেতরের ফাঁকা লাইন রাখা হয় (প্যারাগ্রাফ ব্রেক),
        // অপশন শুরু হওয়ার পরের ফাঁকা লাইন বাদ যায়।
        if (qLines.length > 0 && opts.length === 0 && !ansFound && !expStarted) {
          qLines.push("");
        }
        continue;
      }

      // ---- উত্তর লাইন ----
      const ansProbe = probeAnswer(line);
      if (ansProbe.matched) {
        if (ansProbe.idx !== null) {
          ansFound = true;
          correctIdx = ansProbe.idx;
        } else {
          // "উত্তর:" দিয়ে শুরু হলেও মানে অপশন-লেবেল নেই — প্রশ্নের টেক্সট
          pushQuestionLine(rawLine);
        }
        continue;
      }

      // ---- ব্যাখ্যা লাইন (মাল্টি-লাইন, হুবহু) ----
      const expMatch = line.match(EXPLANATION_LINE_RE);
      if (expMatch) {
        expStarted = true;
        // মার্কারের পরে ব্যবহারকারী যা লিখেছেন ঠিক তা-ই নেওয়া হয়।
        const leadingWs = rawLine.length - rawLine.trimStart().length;
        const contentStart = leadingWs + expMatch[0].length - expMatch[2].length;
        expLines.push(rawLine.slice(contentStart));

        // পরের লাইনগুলোও ব্যাখ্যার অংশ — লাইন ব্রেক, ফাঁকা লাইন ও
        // ইনডেন্টেশন অপরিবর্তিত রেখে যোগ করা হয়।
        let inDigitList = false;
        for (let k = j + 1; k < blockLines.length; k++) {
          const nextRaw = blockLines[k];
          const nextTrimmed = nextRaw.trim();
          if (nextTrimmed) {
            // ব্যাখ্যার ভেতরে "১) … ২) …" তালিকা থাকলে সেটা পরের প্রশ্ন নয় —
            // ১ থেকে শুরু হওয়া ধারাবাহিক রান, কিংবা চলতি তালিকার পরের আইটেম।
            const isDigitMarker = /^\(?[০-৯\d]{1,3}[\)\-–—]/.test(nextTrimmed);
            const startsList = /^\(?১[\)\-–—]/.test(nextTrimmed) && digitRunInBlock(k) >= 2;
            const isListContinuation = inDigitList && isDigitMarker;
            if ((isQuestionStart(nextTrimmed) && !startsList && !isListContinuation) || isTopicHeader(nextTrimmed)) break;
            // ব্যাখ্যার পরে লেখা সঠিক উত্তর লাইনও আলাদা করে ধরা পড়ে — তবে
            // উত্তর আগেই পাওয়া গেলে (যেমন ব্যাখ্যার শেষে "সঠিক উত্তর: ক।"
            // আবার লেখা থাকলে) থেমে যাওয়া চলবে না, নইলে বাকি লেখাটা শেষ
            // অপশনের সঙ্গে জুড়ে লেগে যায়।
            if (!ansFound && probeAnswer(nextTrimmed).idx !== null) break;
            inDigitList = isDigitMarker;
          }
          expLines.push(nextRaw);
          j = k;
        }
        continue;
      }

      // অপশন-মার্কার regex — এখানেই ঘোষণা করা হচ্ছে, কারণ প্রশ্নের লাইনেই
      // অপশন বসানো থাকলে (`১) প্রশ্ন? ক) … খ) …`) নিচের গার্ডেও এটা লাগে।
      //
      // মার্কারের নিয়ম (বাংলা গণিতের সংক্ষেপে ভাঙে না — সেটাই মূল শর্ত):
      //   • বন্ধনী-রূপ `ক)` `খ]` — সবসময় মার্কার, স্পেস লাগে না
      //   • ডট/ড্যাশ-রূপ `ক.` `ক-` — **পরে অবশ্যই স্পেস থাকতে হবে**
      // কেন: `গ.সা.গু.` (গরিষ্ঠ সাধারণ গুণনীয়ক) লেখার ভেতরে `গ.` আছে।
      // আগে ওটা মার্কার ধরা পড়ত, তাই `ক) ল.সা.গু. …, গ.সা.গু. …` লাইনটা
      // দুই টুকরো হয়ে ৪টি অপশন ৮টি হয়ে যেত — ফলে পুরো প্রশ্নটাই অবৈধ হতো
      // এবং "৪টির বেশি অপশন পাওয়া গেছে" দেখাত।
      //
      // দশমিক সংখ্যা (যেমন "৫.৬ কিমি", "৩.৭", "1.5") যেন মার্কার ("৩.") না
      // ভেবে ভুল split না হয়: digit+ডটের পরে আরেকটা অঙ্ক থাকলে সেটা দশমিক।
      const LETTER_MARKER = "(?:[কখগঘabcdABCD][\\)\\]]|[কখগঘabcdABCD][\\.\\-–—][ \\t]+)";
      const DIGIT_MARKER = "(?:[১-৪1-4][\\)\\]]|[১-৪1-4][\\-–—][ \\t]+|[১-৪1-4]\\.(?![০-৯0-9])[ \\t]+)";
      const inlineOptRegex = new RegExp(
        `(?:^|\\s)(${LETTER_MARKER}|${DIGIT_MARKER})\\s*([\\s\\S]*?)(?=\\s+(?:${LETTER_MARKER}|${DIGIT_MARKER})|$)`,
        "g"
      );

      // A numbered line at the START of a block is the QUESTION, not an option.
      // Without this guard, question numbers "১."–"৪." (and ASCII digits) also
      // match the option regex below, so the question text gets swallowed as an
      // option and the block fails with "প্রশ্ন পাওয়া যায়নি"/option-count
      // errors — while Bengali "৫."–"৯."/multi-digit numbers never matched the
      // option class, which is why only the first few questions broke.
      if (qLines.length === 0) {
        const qNumMatch = line.match(QUESTION_LINE_RE);
        if (qNumMatch) {
          // এক লাইনে প্রশ্ন + অপশন: "১) প্রশ্ন কী? ক) এক খ) দুই গ) তিন ঘ) চার উত্তর: ক"
          // (পুরনো প্রশ্নব্যাংকের অনেক ফরম্যাটে এভাবেই থাকে)
          let rest = qNumMatch[2];
          let tailAnswer: number | null = null;

          // লাইনের শেষে বসানো উত্তর অংশটা আগে কেটে নেওয়া হয়, নইলে শেষ
          // অপশনের টেক্সটের সঙ্গে "উত্তর: ক" জোড়া লেগে যেত।
          const tailAns = rest.match(
            /\s(?:সঠিক\s*উত্তর|উত্তরঃ|উত্তর|correct\s*answer|answer|ans)[\s\-–—:ঃ\.]*([কখগঘabcdABCD১-৪1-4])[\)\.]?\s*$/i
          );
          if (tailAns && typeof tailAns.index === "number") {
            tailAnswer = answerLabelToIndex(tailAns[1]);
            if (tailAnswer !== null) rest = rest.slice(0, tailAns.index);
          }

          const headMatches = Array.from(rest.matchAll(inlineOptRegex));
          const firstAt = headMatches.length > 0 ? headMatches[0].index ?? -1 : -1;
          if (headMatches.length >= 2 && firstAt > 0) {
            qLines.push(rest.slice(0, firstAt).trim());
            for (const hm of headMatches) {
              const optClean = hm[2].trim();
              if (optClean) opts.push(optClean);
            }
            if (tailAnswer !== null) {
              ansFound = true;
              correctIdx = tailAnswer;
            }
            continue;
          }

          pushQuestionLine(rawLine);
          continue;
        }
      }

      const inlineMatches = Array.from(line.matchAll(inlineOptRegex));

      if (inlineMatches.length >= 2) {
        for (const m of inlineMatches) {
          const optClean = m[2].trim();
          if (optClean) opts.push(optClean);
        }
        continue;
      }

      // এক লাইনে একটি অপশন: "ক) ঢাকা", "গ. ঢাকা", "(ঘ) সিলেট"।
      // ডট-রূপে স্পেস বাধ্যতামূলক — নইলে "গ.সা.গু. = ২১" জাতীয় ব্যাখ্যা-লাইন
      // অপশন হয়ে যেত (একই কারণে ইনলাইন regex-ও স্পেস চায়)।
      const singleOptMatch = line.match(
        new RegExp(`^(${LETTER_MARKER}|${DIGIT_MARKER}|\\([কখগঘabcdABCD১-৪\\d]\\))\\s*([\\s\\S]+)$`)
      );
      if (singleOptMatch) {
        opts.push(singleOptMatch[2]);
        continue;
      }

      // Otherwise, it's part of the question text
      if (opts.length === 0) {
        pushQuestionLine(rawLine);
      } else if (!SEPARATOR_LINE_RE.test(rawLine)) {
        // অপশনের পরে আসা সাধারণ টেক্সট = শেষ অপশনের পরের লাইন (লম্বা অপশন
        // ভেঙে গেলে এভাবে আসে)। আগে এগুলো নীরবে হারিয়ে যেত।
        opts[opts.length - 1] = `${opts[opts.length - 1]}\n${line}`;
      }
    }

    // Track how many REAL options were parsed before padding placeholders —
    // padded placeholders must never make a broken block look valid.
    const realOptCount = opts.length;

    // Pad or trim options to exactly 4 if needed
    while (opts.length < 4) {
      opts.push(`অপশন ${opts.length + 1}`);
    }

    // ব্যাখ্যার শুরু/শেষের অতিরিক্ত ফাঁকা লাইন বাদ (ভেতরেরগুলো অক্ষত থাকে)
    while (expLines.length > 0 && !expLines[0].trim()) expLines.shift();
    while (expLines.length > 0 && !expLines[expLines.length - 1].trim()) expLines.pop();

    const qText = qLines.join("\n").trim();
    const exp = expLines.join("\n");

    const hasTooMany = realOptCount > 4;
    const answerMissing = !ansFound;
    const allowMissing = options?.allowMissingAnswer === true;

    // উত্তর না থাকলে প্রশ্নটা বাদ পড়ে — তবে শিক্ষক অনুমতি দিলে (allowMissing)
    // ডিফল্ট 'ক' ধরে নিয়ে নেওয়া হয়, যাতে উত্তর আলাদা পাতায় থাকা বইগুলোতেও
    // একটাও প্রশ্ন হারিয়ে না যায়।
    const isValid =
      qText.length > 0 && opts.length >= 4 && realOptCount >= 2 && !hasTooMany && (ansFound || allowMissing);

    let error: string | undefined = undefined;
    if (hasTooMany) error = "৪টির বেশি অপশন পাওয়া গেছে";
    else if (realOptCount < 2) error = "অপশন কম পাওয়া গেছে (কমপক্ষে ২টি প্রয়োজন)";
    if (!qText) error = "প্রশ্ন পাওয়া যায়নি";
    else if (answerMissing && !allowMissing) error = "সঠিক উত্তর উল্লেখ নেই (ডিফল্ট: ক)";
    else if (answerMissing) error = "সঠিক উত্তর লেখা নেই — ডিফল্ট 'ক' ধরা হয়েছে, মিলিয়ে নিন";

    const block: ParsedQuestionBlock = {
      // প্লেসহোল্ডার থেকে আসল LaTeX সোর্স ফিরিয়ে আনা হচ্ছে (টেক্সট হুবহু অটুট)
      q: unmaskMathSpans(qText, spans),
      opts: opts.slice(0, 4).map((o) => unmaskMathSpans(o, spans)),
      correct: correctIdx,
      exp: unmaskMathSpans(exp, spans),
      topic: inlineTopic || defaultTopic || undefined,
      subtopic: inlineSubtopic || defaultSubtopic || undefined,
      isValid,
      answerMissing,
      error
    };

    blocks.push(block);

    if (isValid) {
      questions.push({
        q: block.q,
        opts: block.opts,
        topic: block.topic,
        subtopic: block.subtopic
      });
      solutions.push({
        correct: block.correct,
        exp: block.exp
      });
    }
  }

  return {
    questions,
    solutions,
    blocks,
    validCount: questions.length,
    totalParsed: blocks.length
  };
}
