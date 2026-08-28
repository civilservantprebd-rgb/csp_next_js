import { parseBengaliDigits } from "./utils";
import { QuestionItem, QuestionSolution } from "@/types/exam";

export interface ParsedQuestionBlock {
  q: string;
  opts: string[];
  correct: number;
  exp: string;
  isValid: boolean;
  error?: string;
}

/**
 * Smart Question Parser
 * Supports Bengali & English numbered questions, options (ক/খ/গ/ঘ or a/b/c/d or 1/2/3/4),
 * answers (উত্তরঃ/উত্তর:/Ans:/Answer:) and explanations (ব্যাখ্যা:/Exp:/Explanation:).
 */
export function parseBulkQuestionsText(rawText: string, defaultTopic?: string): {
  questions: QuestionItem[];
  solutions: QuestionSolution[];
  blocks: ParsedQuestionBlock[];
  validCount: number;
  totalParsed: number;
} {
  if (!rawText || !rawText.trim()) {
    return { questions: [], solutions: [], blocks: [], validCount: 0, totalParsed: 0 };
  }

  // Split into blocks by double newline or numbered questions
  const lines = rawText.split(/\r?\n/);
  const rawBlocks: string[][] = [];
  let currentBlock: string[] = [];

  const isQuestionStart = (line: string) => {
    const trimmed = line.trim();
    // e.g. "১.", "1.", "প্রশ্ন ১:", "Q1.", "১)", "1)"
    return /^([০-৯\d]+[\.\)]|প্রশ্ন\s*[০-৯\d]*\s*[:\.]|Q\s*[০-৯\d]*\s*[:\.])/i.test(trimmed);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentBlock.length > 0) {
        // Empty line might separate questions
      }
      continue;
    }

    if (isQuestionStart(trimmed) && currentBlock.length > 0) {
      rawBlocks.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    rawBlocks.push(currentBlock);
  }

  const blocks: ParsedQuestionBlock[] = [];
  const questions: QuestionItem[] = [];
  const solutions: QuestionSolution[] = [];

  for (const blockLines of rawBlocks) {
    let qText = "";
    const opts: string[] = [];
    let correctIdx = 0;
    let exp = "";
    let ansFound = false;

    for (let j = 0; j < blockLines.length; j++) {
      const line = blockLines[j].trim();
      if (!line) continue;

      // Check Answer line (e.g. উত্তর: খ, উত্তরঃ খ, Ans: B, Answer: (গ), উ: ঘ, সঠিক উত্তর: গ)
      const ansMatch = line.match(/^(সঠিক\s*উত্তর|উত্তর|উত্তরঃ|উ\s*[:ঃ\.\-]|ans|answer|correct\s*ans|ans\s*[:ঃ\.\-]|answer\s*[:ঃ\.\-])[\s\-–—:ঃ\.]*([^\n\r]+)/i);
      if (ansMatch) {
        ansFound = true;
        const ansRaw = ansMatch[2].trim();
        // Remove brackets or punctuation e.g. "(খ)" -> "খ", "[B]" -> "B", "খ." -> "খ"
        const cleanAns = ansRaw.replace(/^[\(\[\{\s]+|[\)\]\}\s\.\-]+$/g, "").trim().toLowerCase();
        const normVal = parseBengaliDigits(cleanAns);

        if (cleanAns.startsWith("ক") || cleanAns.startsWith("a") || normVal === "1" || normVal === "0") correctIdx = 0;
        else if (cleanAns.startsWith("খ") || cleanAns.startsWith("b") || normVal === "2") correctIdx = 1;
        else if (cleanAns.startsWith("গ") || cleanAns.startsWith("c") || normVal === "3") correctIdx = 2;
        else if (cleanAns.startsWith("ঘ") || cleanAns.startsWith("d") || normVal === "4") correctIdx = 3;
        else {
          // If the answer is the full option text, check against opts
          const matchedOptIdx = opts.findIndex((o) => o.toLowerCase().trim() === cleanAns);
          if (matchedOptIdx !== -1) {
            correctIdx = matchedOptIdx;
          }
        }
        continue;
      }

      // Check Explanation line
      const expMatch = line.match(/^(ব্যাখ্যা|ব্যাখ্যা\s*:|exp|explanation|ব্যাখ্যা\s*ঃ|note|নোট)[\s\-–—:]*([^\n\r]+)/i);
      if (expMatch) {
        exp = expMatch[2].trim();
        // capture subsequent lines as explanation if any
        for (let k = j + 1; k < blockLines.length; k++) {
          const nextL = blockLines[k].trim();
          if (!isQuestionStart(nextL)) {
            exp += " " + nextL;
            j = k;
          }
        }
        continue;
      }

      // Check Option line (e.g. "ক) ...", "ক. ...", "(ক) ...", "A) ...", "a.", "1) ...")
      // Check inline multiple options like "ক) ঢাকা  খ) খুলনা  গ) রাজশাহী  ঘ) সিলেট"
      const inlineOptRegex = /([কখগঘabcdABCD]|[১-৪1-4])[\)\.\-]\s*([^কখগঘabcdABCD১-৪1-4\)\.\-]+)/g;
      const inlineMatches = Array.from(line.matchAll(inlineOptRegex));

      if (inlineMatches.length >= 2) {
        for (const m of inlineMatches) {
          const optClean = m[2].trim();
          if (optClean) opts.push(optClean);
        }
        continue;
      }

      const singleOptMatch = line.match(/^(\([কখগঘabcdABCD\d]\)|[কখগঘabcdABCD\d][\)\.\-–—])\s*(.+)/);
      if (singleOptMatch) {
        opts.push(singleOptMatch[2].trim());
        continue;
      }

      // Otherwise, it's part of the question text
      if (!qText) {
        // Strip leading number if present (e.g. "১. ", "1) ", "Q1: ")
        qText = line.replace(/^([০-৯\d]+[\.\)]|প্রশ্ন\s*[০-৯\d]*\s*[:\.]|Q\s*[০-৯\d]*\s*[:\.])\s*/i, "").trim();
      } else if (opts.length === 0) {
        qText += " " + line;
      }
    }

    // Pad or trim options to exactly 4 if needed
    while (opts.length < 4) {
      opts.push(`অপশন ${opts.length + 1}`);
    }

    const isValid = qText.length > 0 && opts.length >= 4;
    let error: string | undefined = undefined;
    if (!qText) error = "প্রশ্ন পাওয়া যায়নি";
    else if (!ansFound) error = "সঠিক উত্তর উল্লেখ নেই (ডিফল্ট: ক)";

    const block: ParsedQuestionBlock = {
      q: qText,
      opts: opts.slice(0, 4),
      correct: correctIdx,
      exp: exp,
      isValid,
      error
    };

    blocks.push(block);

    if (isValid) {
      questions.push({
        q: block.q,
        opts: block.opts,
        ...(defaultTopic?.trim() ? { topic: defaultTopic.trim() } : {})
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
