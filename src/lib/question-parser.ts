import { parseBengaliDigits } from "./utils";
import { QuestionItem, QuestionSolution } from "@/types/exam";

export interface ParsedQuestionBlock {
  q: string;
  opts: string[];
  correct: number;
  exp: string;
  topic?: string;
  subtopic?: string;
  isValid: boolean;
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

/** প্রশ্নের শুরু: "১.", "1)", "প্রশ্ন ১:", "Q1:" */
const QUESTION_START_RE = /^([০-৯\d]+[\.\)]|প্রশ্ন\s*[০-৯\d]*\s*[:\.]|Q\s*[০-৯\d]*\s*[:\.])/i;

/** প্রশ্নের নম্বর কাটার জন্য (লাইনের শুরুতে ইনডেন্টেশনসহ) */
const QUESTION_MARKER_RE =
  /^[ \t]*(?:[০-৯\d]+[\.\)]|প্রশ্ন\s*[০-৯\d]*\s*[:\.]|Q\s*[০-৯\d]*\s*[:\.])[ \t]*/i;

/** শুধু বিভাজক রেখা (---, ===, ***) — এসব কোনো অপশনের অংশ নয় */
const SEPARATOR_LINE_RE = /^[ \t]*[-–—_=*~#.।|:•]+[ \t]*$/;

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
  defaultSubtopic?: string
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

  // Split into blocks by double newline or numbered questions or topic headers
  const lines = rawText.split(/\r?\n/);
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
        for (let k = j + 1; k < blockLines.length; k++) {
          const nextRaw = blockLines[k];
          const nextTrimmed = nextRaw.trim();
          if (nextTrimmed) {
            if (isQuestionStart(nextTrimmed) || isTopicHeader(nextTrimmed)) break;
            // ব্যাখ্যার পরে লেখা সঠিক উত্তর লাইনও আলাদা করে ধরা পড়ে
            if (probeAnswer(nextTrimmed).idx !== null) break;
          }
          expLines.push(nextRaw);
          j = k;
        }
        continue;
      }

      // A numbered line at the START of a block is the QUESTION, not an option.
      // Without this guard, question numbers "১."–"৪." (and ASCII digits) also
      // match the option regex below, so the question text gets swallowed as an
      // option and the block fails with "প্রশ্ন পাওয়া যায়নি"/option-count
      // errors — while Bengali "৫."–"৯."/multi-digit numbers never matched the
      // option class, which is why only the first few questions broke.
      if (qLines.length === 0) {
        const qNumMatch = line.match(/^([০-৯\d]+[\.\)]|প্রশ্ন\s*[০-৯\d]*\s*[:\.]|Q\s*[০-৯\d]*\s*[:\.])\s*(.+)$/i);
        if (qNumMatch) {
          pushQuestionLine(rawLine);
          continue;
        }
      }

      // Check Option line (e.g. "ক) ...", "ক. ...", "(ক) ...", "A) ...", "a.", "1) ...")
      // Check inline multiple options like "ক) ঢাকা  খ) খুলনা  গ) রাজশাহী  ঘ) সিলেট"
      // Split lines that carry multiple options like "ক) ঢাকা খ) খুলনা …" —
      // option TEXT may itself start with ক/খ/গ/ঘ/digits, so we split on the
      // option MARKERS rather than excluding letters from the text.
      // দশমিক সংখ্যা (যেমন "৫.৬ কিমি", "৩.৭", "1.5") যেন অপশন marker ("৩.") না
      // ভেবে ভুল split না হয়: digit+ডট সেকশন তখনই marker হয় যখন ডটের পর আরেকটা
      // অঙ্ক থাকে না (অর্থাৎ সত্যিকারের দশমিক নয়)। অক্ষর marker (ক/খ/গ/ঘ, a-d) আগের মতোই।
      const inlineOptRegex = /(?:^|\s)((?:[কখগঘabcdABCD][\)\.\-–—])|(?:[১-৪1-4](?:[\)\-–—]|\.(?![০-৯0-9]))))\s*([\s\S]*?)(?=\s+(?:(?:[কখগঘabcdABCD][\)\.\-–—])|(?:[১-৪1-4](?:[\)\-–—]|\.(?![০-৯0-9]))))|$)/g;
      const inlineMatches = Array.from(line.matchAll(inlineOptRegex));

      if (inlineMatches.length >= 2) {
        for (const m of inlineMatches) {
          const optClean = m[2].trim();
          if (optClean) opts.push(optClean);
        }
        continue;
      }

      const singleOptMatch = line.match(/^(\([কখগঘabcdABCD১-৪\d]\)|[কখগঘabcdABCD১-৪\d][\)\.\-–—])[ \t]*([\s\S]+)$/);
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
    const isValid = qText.length > 0 && opts.length >= 4 && realOptCount >= 2 && !hasTooMany && ansFound;
    let error: string | undefined = undefined;
    if (hasTooMany) error = "৪টির বেশি অপশন পাওয়া গেছে";
    else if (realOptCount < 2) error = "অপশন কম পাওয়া গেছে (কমপক্ষে ২টি প্রয়োজন)";
    if (!qText) error = "প্রশ্ন পাওয়া যায়নি";
    else if (!ansFound) error = "সঠিক উত্তর উল্লেখ নেই (ডিফল্ট: ক)";

    const block: ParsedQuestionBlock = {
      q: qText,
      opts: opts.slice(0, 4),
      correct: correctIdx,
      exp: exp,
      topic: inlineTopic || defaultTopic || undefined,
      subtopic: inlineSubtopic || defaultSubtopic || undefined,
      isValid,
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
