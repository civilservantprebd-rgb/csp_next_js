"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Layers,
  HelpCircle,
  Trash2,
  Loader2,
  Copy,
  Check,
  Wand2
} from "lucide-react";
import { parseBulkQuestionsText, type ParsedQuestionBlock } from "@/lib/question-parser";
import { addBulkQuestionsToExam, addBulkQuestionsToBank } from "@/actions/admin-actions";
import { TopicTreeSelector } from "./TopicTreeSelector";
import { toBengaliDigits } from "@/lib/utils";
import { MathText } from "@/lib/MathText";
import { GEMINI_PHOTO_PROMPT, type AiImportPayload } from "@/lib/ai-import-prompt";
import { shouldAutoTidy } from "@/lib/auto-tidy";
import { resolveImportTopic, topicPathLabel } from "@/lib/import-topic";

interface BulkQuestionImporterModalProps {
  isOpen: boolean;
  activeExamKey?: string;
  examTitle?: string;
  targetTopic?: string;
  targetSubtopic?: string;
  topics?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_TEXT = `# বাংলা সাহিত্য > প্রাচীন যুগ > চর্যাপদ

১. চর্যাপদ কোন ছন্দে রচিত?
ক) মাত্রাবৃত্ত
খ) অক্ষরবৃত্ত
গ) স্বরবৃত্ত
ঘ) গদ্যছন্দ
উত্তর: ক
ব্যাখ্যা: চর্যাপদের অধিকাংশ পদই মাত্রাবৃত্ত ছন্দে রচিত।

# আন্তর্জাতিক বিষয়াবলী > পরিবেশ ও দুর্যোগ > আন্তর্জাতিক চুক্তি

২. কিয়োটো প্রোটোকল কোন সালে গৃহীত হয়?
ক) ১৯৯২
খ) ১৯৯৭
গ) ২০১৫
ঘ) ১৯৮৭
উত্তর: খ
ব্যাখ্যা: ১৯৯৭ সালের ১১ ডিসেম্বর জাপানের কিয়োটো শহরে এটি গৃহীত হয়।

# গণিত > বীজগণিত > উৎপাদক

৩. $\\frac{x^2-1}{x-1}$-এর মান কত? (যেখানে x ≠ 1)
ক) $x+1$
খ) $x-1$
গ) $x^2+1$
ঘ) $1$
উত্তর: ক
ব্যাখ্যা: $\\frac{x^2-1}{x-1} = \\frac{(x-1)(x+1)}{x-1} = x+1$

৪. নিচের সমীকরণটির মূল কোনগুলো?

$$x^2 - 5x + 6 = 0$$

ক) ২ ও ৩
খ) ১ ও ৬
গ) −২ ও −৩
ঘ) ৪ ও ৫
উত্তর: ক
ব্যাখ্যা: $x^2-5x+6 = (x-2)(x-3)$, তাই মূল দুটি ২ ও ৩।

৫. [math]\\sqrt{2}[/math] ও \\sqrt{8} যোগ করলে কত হয়?
ক) \\sqrt{10}
খ) 3\\sqrt{2}
গ) 2\\sqrt{2}
ঘ) \\sqrt{6}
উত্তর: খ
ব্যাখ্যা: \\sqrt{8} = 2\\sqrt{2}, তাই \\sqrt{2} + 2\\sqrt{2} = 3\\sqrt{2}`;

export const BulkQuestionImporterModal: React.FC<BulkQuestionImporterModalProps> = ({
  isOpen,
  activeExamKey,
  examTitle,
  targetTopic,
  targetSubtopic,
  topics = [],
  onClose,
  onSuccess,
}) => {
  const [rawText, setRawText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState(targetTopic || "");
  const [selectedSubtopic, setSelectedSubtopic] = useState(targetSubtopic || "");
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  /** AI দিয়ে সাজানোর অবস্থা — ব্যস্ত, ফলাফলের নোট, আর ভুলের বার্তা */
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [aiError, setAiError] = useState("");
  /** AI যা বুঝে দিয়েছে (প্রশ্ন/অপশন/উত্তর আলাদা করে) — থাকলে এটাই প্রিভিউ চালায় */
  const [aiPayload, setAiPayload] = useState<AiImportPayload | null>(null);
  /** AI-র সতর্কতা (কোনো প্রশ্ন বাদ পড়লে ইত্যাদি) */
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  /** স্বয়ংক্রিয় সাজানো চালু কি না — শিক্ষক নিজেই বন্ধ করতে পারেন */
  const [autoAi, setAutoAi] = useState(true);
  /**
   * উত্তর ছাড়া প্রশ্নও নেওয়া হবে কি না। অনেক বইয়ে উত্তর আলাদা পাতায় থাকে —
   * তখন সব প্রশ্ন "উত্তর নেই" বলে বাদ পড়লে একটাও ইমপোর্ট হয় না। ডিফল্ট বন্ধ
   * (ভুল উত্তর-কী যাতে নিজে থেকে ঢুকে না পড়ে), শিক্ষক চাইলে চালু করবেন।
   */
  const [allowMissingAnswer, setAllowMissingAnswer] = useState(false);
  /** কোন টেক্সটে ইতিমধ্যেই AI চেষ্টা হয়েছে (একই টেক্সটে বারবার কল যাতে না হয়) */
  const aiTriedForRef = React.useRef("");
  /** কত নম্বর পেস্ট, আর কোন পেস্টে অটো-সাজানো হয়েছে — প্রতি পেস্টে একবারই চলে */
  const pasteSeqRef = React.useRef(0);
  const aiRanForPasteRef = React.useRef(-1);
  /** একবার ব্যর্থ হলে (key নেই/নেট সমস্যা) স্বয়ংক্রিয় চেষ্টা থামিয়ে দেওয়া হয় */
  const aiBlockedRef = React.useRef(false);

  const refreshTreeData = () => {
    import("@/actions/admin-actions")
      .then(({ getTopicTreeData }) => getTopicTreeData())
      .then((d) => setAllTopics(d.topics))
      .catch(() => {
        // tree picker simply falls back to the props-provided topics
      });
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshTreeData();
  }, [isOpen]);

  const mergedTopics = Array.from(new Set([...topics, ...allTopics]));

  const parsedResult = useMemo(() => {
    return parseBulkQuestionsText(rawText, selectedTopic, selectedSubtopic, { allowMissingAnswer });
  }, [rawText, selectedTopic, selectedSubtopic, allowMissingAnswer]);

  /**
   * AI-র কাঠামো (JSON) → প্রিভিউর ব্লক।
   *
   * এটাই মূল পথ: প্রশ্ন/অপশন/উত্তর আলাদা করার সিদ্ধান্ত DeepSeek-এর, আমাদের
   * regex নয়। তাই `০.৬৩` প্রশ্ন-নম্বর বা `গ.সা.গু.`-এর `গ.` অপশন-মার্কার
   * হয়ে আর কাঠামো ভাঙতে পারে না। regex শুধু টেক্সট-পাথের জন্য থাকে
   * (হাতে লেখা বা আগে থেকেই ঠিক ফরম্যাটের পেস্ট)।
   */
  const preview = useMemo(() => {
    // শিক্ষকের হাতে-বাছা টপিক সবচেয়ে জোরালো — AI বা লেখার ভেতরের `# টপিক:`
    // তার উপর চাপ দিতে পারে না (নইলে "টপিক বাছলাম অথচ সিলেক্ট হয়নি" মনে হয়)।
    const resolved = resolveImportTopic({
      manualTopic: selectedTopic,
      manualSubtopic: selectedSubtopic,
      aiTopic: aiPayload?.topic,
      aiSubtopic: aiPayload?.subtopic,
    });

    const base = !aiPayload
      ? parsedResult
      : (() => {
          const blocks: ParsedQuestionBlock[] = aiPayload.questions.map((q) => {
            const answerMissing = q.correct === null;
            const b: ParsedQuestionBlock = {
              q: q.q,
              opts: q.opts,
              correct: q.correct ?? 0,
              exp: q.exp,
              topic: resolved.topic,
              subtopic: resolved.subtopic,
              isValid: allowMissingAnswer || !answerMissing,
              answerMissing,
              error: answerMissing
                ? allowMissingAnswer
                  ? "সঠিক উত্তর লেখা নেই — ডিফল্ট 'ক' ধরা হয়েছে, মিলিয়ে নিন"
                  : "সঠিক উত্তর উল্লেখ নেই (ডিফল্ট: ক)"
                : undefined,
            };
            return b;
          });

          const validBlocks = blocks.filter((b) => b.isValid);
          return {
            blocks,
            questions: validBlocks.map((b) => ({
              q: b.q,
              opts: b.opts,
              topic: b.topic,
              subtopic: b.subtopic,
            })),
            solutions: validBlocks.map((b) => ({ correct: b.correct, exp: b.exp })),
            validCount: validBlocks.length,
            totalParsed: blocks.length,
          };
        })();

    // হাতে বাছা টপিক থাকলে টেক্সট-পাথেও (parser) সেটাই বসানো হয়
    if (resolved.source !== "manual") return base;

    return {
      ...base,
      blocks: base.blocks.map((b) => ({ ...b, topic: resolved.topic, subtopic: resolved.subtopic })),
      questions: base.questions.map((q) => ({ ...q, topic: resolved.topic, subtopic: resolved.subtopic })),
    };
  }, [aiPayload, parsedResult, allowMissingAnswer, selectedTopic, selectedSubtopic]);

  /** প্রিভিউতে দেখানোর জন্য: কোন টপিকে যাচ্ছে আর সেটা কোথা থেকে এল */
  const resolvedTopic = useMemo(
    () =>
      resolveImportTopic({
        manualTopic: selectedTopic,
        manualSubtopic: selectedSubtopic,
        aiTopic: aiPayload?.topic,
        aiSubtopic: aiPayload?.subtopic,
      }),
    [selectedTopic, selectedSubtopic, aiPayload]
  );

  /** প্রশ্ন ঠিক আছে কিন্তু উত্তর লেখা নেই — এমন ব্লকের সংখ্যা (শিক্ষককে দেখানোর জন্য) */
  const missingAnswerCount = useMemo(
    () => preview.blocks.filter((b) => b.answerMissing && b.q.trim().length > 0).length,
    [preview]
  );

  /** কতগুলো ব্লক ভাঙা (⚠️) — অটো-সাজানোর সিদ্ধান্তে লাগে */
  const invalidCount = useMemo(
    () => preview.blocks.filter((b) => !b.isValid).length,
    [preview]
  );

  /**
   * পোর্টালের জন্য "মাউন্ট হয়েছে কি না" — সার্ভার-রেন্ডারে `document` নেই,
   * তাই প্রথম রেন্ডারে কিছুই করা যায় না (হাইড্রেশন মিসম্যাচও এড়ানো হয়)।
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * স্বয়ংক্রিয় সাজানো: পেস্ট করা টেক্সট যদি একটাও বৈধ প্রশ্ন না দেয়
   * (অর্থাৎ ফরম্যাট এলোমেলো), তাহলে নিজে থেকেই একটা AI কল হয়ে যায়।
   * যা ঠিকভাবে পার্স হচ্ছে তাতে হাত দেওয়া হয় না — খরচ আর অপ্রয়োজনীয়
   * বদল দুটোই এড়ানো যায়।
   *
   * hook-টি ইচ্ছাকৃতভাবে নিচের অর্লি-রিটার্নের **আগে** — নইলে মডাল
   * খোলা/বন্ধ হওয়ার সাথে hook-এর ক্রম বদলে React ভেঙে যেত।
   * `runAiTidy` নিচে ঘোষিত হলেও নিরাপদ: গার্ড না মিললে আমরা ওটাকে ছুঁই না,
   * আর body শেষ পর্যন্ত চললে সব const ঠিকভাবে তৈরি হয়ে যায়।
   */
  useEffect(() => {
    const shouldRun = shouldAutoTidy({
      isOpen,
      mounted,
      autoAi,
      aiBusy,
      blocked: aiBlockedRef.current,
      text: rawText,
      validCount: parsedResult.validCount,
      totalParsed: parsedResult.totalParsed,
      invalidCount,
      triedText: aiTriedForRef.current,
      pasteSeq: pasteSeqRef.current,
      ranForPasteSeq: aiRanForPasteRef.current,
    });
    if (!shouldRun) return;

    const text = rawText.trim();
    const pasteSeq = pasteSeqRef.current;
    const timer = window.setTimeout(() => {
      aiTriedForRef.current = text;
      aiRanForPasteRef.current = pasteSeq;
      void runAiTidy(text);
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawText, parsedResult.validCount, parsedResult.totalParsed, invalidCount, autoAi, isOpen, mounted, aiBusy]);

  useEffect(() => {
    // মডাল আবার খুললে ব্যর্থতার "ব্লক" তুলে দেওয়া হয় — নতুন করে চেষ্টা করা যাবে
    if (isOpen) aiBlockedRef.current = false;
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handlePasteSample = () => {
    pasteSeqRef.current += 1;
    setRawText(SAMPLE_TEXT);
  };

  /**
   * ছবির লেখা আনতে Gemini চ্যাটে দেওয়ার প্রম্পট কপি।
   *
   * অ্যাপে ছবি পড়ার সুবিধা বাদ দেওয়া হয়েছে (ফল এলোমেলো আসছিল), তাই বইয়ের
   * ছবি থেকে লেখা আনার কাজটা বাইরে সেরে শুধু টেক্সট এখানে পেস্ট করা হয় —
   * এই বাটনটা সেই ধাপটার জন্য (Gemini-র API খরচ নেই, শুধু চ্যাট)।
   */
  const handleCopyGeminiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(GEMINI_PHOTO_PROMPT);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      alert(
        "ক্লিপবোর্ডে কপি করা যায়নি (ব্রাউজার অনুমতি দেয়নি)। অনুগ্রহ করে আবার চেষ্টা করুন বা ম্যানুয়ালি কপি করুন।"
      );
    }
  };

  const handleClear = () => {
    pasteSeqRef.current += 1;
    setRawText("");
    setAiNote("");
    setAiError("");
    setAiPayload(null);
    setAiWarnings([]);
  };

  /**
   * "যে ফরম্যাটেই দিই, AI বুঝে MCQ বানাবে" — পেস্ট করা এলোমেলো টেক্সট
   * DeepSeek-এ যায়, সে প্রশ্ন/অপশন/উত্তর/ব্যাখ্যা আলাদা করে **JSON** ফেরায়
   * (কোনটা নতুন প্রশ্ন সেই সিদ্ধান্তটাও তার)। ফলে আমাদের regex আর অনুমান করে
   * না — শুধু যাচাই করে; ফিরে আসা কাঠামোতেই প্রিভিউ ও ইমপোর্ট হয়।
   */
  const runAiTidy = async (
    textOverride?: string
  ): Promise<{ ok: boolean; validCount?: number; payload?: AiImportPayload }> => {
    const sourceText = (textOverride ?? rawText).trim();
    setAiError("");
    setAiNote("");
    setAiWarnings([]);
    if (!sourceText) {
      setAiError("আগে প্রশ্নগুলো পেস্ট করুন।");
      return { ok: false };
    }
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            success?: boolean;
            payload?: AiImportPayload;
            totalParsed?: number;
            validCount?: number;
            truncated?: boolean;
            error?: string;
          }
        | null;

      if (!res.ok || !data?.success || !data.payload) {
        setAiError(data?.error || `AI দিয়ে বোঝা যায়নি (${res.status})।`);
        aiBlockedRef.current = true;
        return { ok: false };
      }

      // প্রশ্ন/অপশন/উত্তর আলাদা করা কাঠামো — এটাই এখন প্রিভিউ ও ইমপোর্ট চালায়
      setAiPayload(data.payload);
      setAiWarnings(data.payload.warnings || []);

      // AI-র নিজের ফলাফলে আবার কল যাতে না হয় (লুপ-প্রতিরোধ)
      aiTriedForRef.current = sourceText;
      // এই পেস্টের কাজ শেষ — শিক্ষক এখন হাতে যা ঠিক করেন তা আর ছোঁয়া হবে না
      aiRanForPasteRef.current = pasteSeqRef.current;

      const total = data.payload.questions.length;
      const missing = data.payload.questions.filter((q) => q.correct === null).length;
      setAiNote(
        `DeepSeek ${toBengaliDigits(total)}টি প্রশ্ন বুঝেছে${
          missing > 0 ? ` — ${toBengaliDigits(missing)}টিতে উত্তর লেখা নেই` : ""
        }। প্রিভিউ মিলিয়ে দেখুন।`
      );
      return { ok: true, validCount: data.validCount || 0, payload: data.payload };
    } catch (err: any) {
      setAiError(err?.message || "AI দিয়ে সাজাতে সমস্যা হয়েছে।");
      aiBlockedRef.current = true;
      return { ok: false };
    } finally {
      setAiBusy(false);
    }
  };

  /**
   * পেস্ট করা লেখা নতুন কনটেন্ট ধরা হয় — অটো-সাজানোর অনুমতি রিফ্রেশ হয়,
   * কিন্তু লেখা নিজে থেকে বদলানো হয় না (এখন শুধু টেক্সট, কোনো ছবি নেই)।
   */
  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const cb = e.clipboardData;
    if (!cb) return;

    // নতুন কনটেন্ট এল → অটো-সাজানোর অনুমতি রিফ্রেশ (প্রতি পেস্টে একবার চলে)।
    // লেখার সাথে ছবি থাকলেও (Gemini/Word প্রায়ই বিটম্যাপও রাখে) লেখাটাই আসল —
    // লেখা নিজে থেকে বদলানো হয় না।
    const pastedText = cb.getData("text/plain") || "";
    if (pastedText.trim().length > 0) {
      pasteSeqRef.current += 1;
      setAiPayload(null); // নতুন পেস্ট → পুরনো AI-কাঠামো আর প্রাসঙ্গিক নয়
    }
  };

  const handleImport = async () => {
    let questions = preview.questions;
    let solutions = preview.solutions;
    let missingAnswers = preview.blocks.filter((b) => b.isValid && b.answerMissing).length;

    // ফরম্যাট এলোমেলো হলে (একটাও বৈধ প্রশ্ন নেই) নিজে থেকেই AI দিয়ে একবার
    // বুঝিয়ে নেওয়া হয় — শিক্ষককে আলাদা করে বাটন চাপতে হয় না।
    if (questions.length === 0) {
      const tidy = await runAiTidy();
      if (!tidy.ok) return; // কারণ aiError-এ দেখানো হয়েছে
      // সদ্য পাওয়া কাঠামো থেকেই হিসাব (state update-এর জন্য অপেক্ষা নয়)
      const aiQuestions = tidy.payload?.questions || [];
      const freshTopic = resolveImportTopic({
        manualTopic: selectedTopic,
        manualSubtopic: selectedSubtopic,
        aiTopic: tidy.payload?.topic,
        aiSubtopic: tidy.payload?.subtopic,
      });
      const questionsFromAi = aiQuestions.filter((q) => allowMissingAnswer || q.correct !== null);
      if (questionsFromAi.length === 0) {
        const missing = aiQuestions.filter((q) => q.correct === null).length;
        alert(
          missing > 0
            ? `প্রশ্নগুলো পাওয়া গেছে (${toBengaliDigits(missing)}টি), কিন্তু একটাতেও সঠিক উত্তর লেখা নেই — তাই কোনোটি নেওয়া হয়নি।\n\nউত্তর ছাড়া প্রশ্নগুলোও নিতে চাইলে ডান দিকের হলুদ ঘরটায় টিক দিন, তারপর আবার ইমপোর্ট চাপুন।`
            : "AI দিয়ে বোঝানোর পরেও কোনো ব্যবহারযোগ্য প্রশ্ন পাওয়া যায়নি।"
        );
        return;
      }
      questions = questionsFromAi.map((q) => ({
        q: q.q,
        opts: q.opts,
        topic: freshTopic.topic,
        subtopic: freshTopic.subtopic,
      }));
      solutions = questionsFromAi.map((q) => ({ correct: q.correct ?? 0, exp: q.exp }));
      missingAnswers = aiQuestions.filter((q) => q.correct === null).length;
    }

    // উত্তর ছাড়া প্রশ্ন থাকলে সেটা স্পষ্টভাবে জানিয়ে অনুমতি নেওয়া হয় —
    // নইলে ভুল উত্তর-কী চুপচাপ পরীক্ষায় ঢুকে পড়বে।
    if (missingAnswers > 0) {
      const ok = window.confirm(
        `${toBengaliDigits(missingAnswers)}টি প্রশ্নে সঠিক উত্তর লেখা নেই — ডিফল্ট হিসেবে 'ক' ধরে নেওয়া হবে।\n\nএগুলো পরে প্রশ্ন সম্পাদনা করে অবশ্যই মিলিয়ে নিন। এগিয়ে যাব?`
      );
      if (!ok) return;
    }

    setIsSubmitting(true);
    let res;
    if (activeExamKey) {
      res = await addBulkQuestionsToExam(activeExamKey, questions, solutions);
    } else {
      res = await addBulkQuestionsToBank(questions, solutions, selectedTopic, selectedSubtopic);
    }
    setIsSubmitting(false);

    if (res.success) {
      alert(`সফলভাবে ${toBengaliDigits(res.count)}টি প্রশ্ন যুক্ত করা হয়েছে!`);
      setRawText("");
      onSuccess();
      onClose();
    } else if (res.error) {
      // আসল কারণটা দেখাই — action এখন ডেটাবেজের এরর-বার্তাও ফেরায়। আগে শুধু
      // "সমস্যা হয়েছে" দেখাত, তাই কারণ জানার একমাত্র উপায় ছিল সার্ভার-টার্মিনাল।
      alert(`প্রশ্নগুলো যুক্ত করা যায়নি।

কারণ: ${res.error}`);
    } else {
      alert("প্রশ্নগুলো যুক্ত করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  /**
   * ⚠️ `createPortal` কেন জরুরি: এই মোডালটি "প্রশ্ন যোগ/এডিট" ট্যাব থেকে খুললে
   * সেটি আবার এক্সাম-এডিট মোডালের ভেতরে বসে। প্যারেন্ট মোডালে `backdrop-blur`
   * থাকায় CSS নিয়ম অনুযায়ী `position: fixed` আর viewport-এর সাপেক্ষে থাকে না —
   * মাঝখানের `overflow-y-auto` কনটেইনার মোডালটিকে কেটে ফেলে, ফলে পূর্ণ স্ক্রিন
   * হওয়ার বদলে ছোট/আটকে থাকা দেখাত। পোর্টাল সরাসরি `<body>`-তে বসায়, তাই এখন
   * যেখান থেকেই খোলা হোক — পুরো স্ক্রিনই জুড়ে বসে।
   *
   * `admin-shell` ক্লাসটা এখানে আবার বসানো: পোর্টাল DOM-এ `.admin-shell`-এর
   * বাইরে চলে যায়, আর ডার্ক থিম ওই স্কোপেই কাজ করে — নাহলে মোডালটা সাদা হয়ে যেত।
   */
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 bg-black/60 backdrop-blur-sm font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-none w-full h-full max-w-none flex flex-col shadow-2xl border-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                বাল্ক প্রশ্ন ইম্পোর্টার (Bulk Smart Paste)
              </h3>
              <p className="text-xs text-slate-500">
                টার্গেট: <strong className="text-indigo-700">{examTitle || "সেন্ট্রাল প্রশ্ন ব্যাংক ভাণ্ডার"}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Split Grid — বামে পেস্ট + টপিক, ডানে লাইভ প্রিভিউ */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto flex-grow min-h-0">
          {/* Left Column: Text Input & Controls (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">
                এখানে প্রশ্ন, অপশন ও উত্তর পেস্ট করুন:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyGeminiPrompt}
                  title="বইয়ের ছবি থেকে লেখা আনতে এই প্রম্পটটা Gemini চ্যাটে দিন — তারপর লেখাটা এখানে পেস্ট করলে DeepSeek সাজিয়ে দেবে"
                  className={`text-sm font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                    promptCopied
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-violet-600 hover:text-violet-800 bg-violet-50 border-violet-200"
                  }`}
                >
                  {promptCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {promptCopied ? "কপি হয়েছে!" : "ছবি → লেখার প্রম্পট"}
                </button>
                <button
                  type="button"
                  onClick={handlePasteSample}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> নমুনা দেখুন
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-sm font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> পরিষ্কার করুন
                  </button>
                )}
              </div>
            </div>

            {/* AI দিয়ে সাজানো — এলোমেলো টেক্সট বা বইয়ের ছবি, দুটোই */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void runAiTidy()}
                disabled={aiBusy}
                className="text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {aiBusy ? "সাজানো হচ্ছে…" : "AI দিয়ে সাজাও"}
              </button>

              <span className="text-[11px] text-slate-400">
                যেকোনো ফরম্যাটের টেক্সট — DeepSeek ঠিক ফরম্যাটে সাজিয়ে দেবে
              </span>

              {/* স্বয়ংক্রিয় সাজানো — পেস্ট করলেই নিজে থেকে ঠিক করে নেয় */}
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none ml-auto">
                <input
                  type="checkbox"
                  checked={autoAi}
                  onChange={(e) => setAutoAi(e.target.checked)}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                এলোমেলো পেস্ট হলে নিজে থেকেই সাজাও
              </label>
            </div>

            {aiError && (
              <p className="text-[11px] sm:text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </p>
            )}
            {aiNote && !aiError && (
              <p className="text-[11px] sm:text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                ✨ {aiNote}
              </p>
            )}

            {/* AI কোন প্রশ্ন/অপশন বাদ দিলে সেটা গোপন না রেখে দেখানো হয় */}
            {aiWarnings.length > 0 && (
              <ul className="text-[11px] sm:text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 space-y-1 list-disc list-inside">
                {aiWarnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <div className="relative flex-grow min-h-[200px] sm:min-h-[220px]">
              <textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  // হাতে সম্পাদনা মানে শিক্ষক আর AI-র কাঠামোয় ভরসা করছেন না —
                  // তখন টেক্সট-পাথের (parser) প্রিভিউ দেখানো হয়, দ্বিধা থাকে না।
                  if (aiPayload) {
                    setAiPayload(null);
                    setAiNote("");
                    setAiWarnings([]);
                  }
                }}
                onPaste={handleTextareaPaste}
                placeholder={`১. প্রশ্ন এখানে লিখুন...
ক) অপশন ১
খ) অপশন ২
গ) অপশন ৩
ঘ) অপশন ৪
উত্তর: খ
ব্যাখ্যা: ব্যাখ্যা লিখুন (ঐচ্ছিক)`}
                className="w-full h-full min-h-[200px] sm:min-h-[220px] p-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs sm:text-sm font-mono leading-relaxed resize-none shadow-sm"
              />
            </div>

            {/* LaTeX সাপোর্ট — ম্যাথ থাকলে সেটা রেন্ডার হয়েই সেভ হয় */}
            <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
              💡 <strong className="text-slate-600">LaTeX সাপোর্ট:</strong> ইনলাইন ম্যাথ{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">$x^2$</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">\(x^2\)</code> বা{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">[math]x^2[/math]</code>; ডিসপ্লে
              ম্যাথ <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">$$…$$</code> বা{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">\[…\]</code>। ডেলিমিটার ছাড়া{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">{"\\frac{1}{2}"}</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">{"\\sqrt{2}"}</code> লিখলেও সেটা ম্যাথ
              হিসেবেই ধরা হয় — প্রিভিউতেই রেন্ডার হয়ে দেখা যাবে, সেভও হবে হুবহু একই সোর্স।
            </p>

            {/* যেকোনো AI চ্যাট থেকে পেস্ট করা Markdown নিজে থেকেই পরিষ্কার হয় */}
            <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
              🤖 <strong className="text-slate-600">সাজানো কে করে:</strong> এই অ্যাপে শুধু{" "}
              <strong>DeepSeek</strong> ব্যবহার হয় — যা-ই পেস্ট করুন (বোল্ড, হেডিং, টেবিল, এলোমেলো লেখা) নিজে
              থেকেই ঠিক ফরম্যাটে সাজিয়ে দেয়। বইয়ের ছবি থেকে লেখা আনতে চাইলে উপরের{" "}
              <strong>ছবি → লেখার প্রম্পট</strong> বাটনটা ব্যবহার করুন।
            </p>

            {/* টপিক ও সাব-টপিক — বাম কলামেই, পেস্ট-বক্সের নিচে।
                কোনো বাক্স নেই, ভেতরের স্ক্রলও নেই — যত টপিক আছে সব একসাথে
                দেখা যায় (দরকার হলে পুরো মোডাল স্ক্রল হয়)। সাব-টপিক আগের মতোই
                বন্ধ থাকে, ট্যাপ করলে খোলে। */}
            <div>
              <TopicTreeSelector
                selectedTopicPath={selectedTopic}
                onSelectTopicPath={(path) => setSelectedTopic(path)}
                topics={mergedTopics}
                onTopicsUpdated={refreshTreeData}
                label="টপিক ও সাব-টপিক নির্বাচন (সকল প্রশ্নের জন্য)"
                helperText="যেকোনো স্তরের টপিক/সাবটপিক বাছাই করুন — টপিক না দিলে প্রশ্ন 'সাধারণ' টপিকে যাবে"
              />
            </div>
          </div>

          {/* Right Column: Live Preview & Status (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> লাইভ প্রিভিউ
              </h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-md">
                  {toBengaliDigits(preview.validCount)}টি প্রস্তুত
                </span>
                <span className="bg-slate-200 text-slate-700 text-xs font-medium px-2 py-0.5 rounded-md">
                  মোট {toBengaliDigits(preview.totalParsed)}টি শনাক্ত
                </span>
              </div>
            </div>

            {/* উত্তর ছাড়া প্রশ্ন — বইয়ে উত্তর আলাদা পাতায় থাকলে এটা দরকার।
                চালু না করলে ওই প্রশ্নগুলো ⚠️ হয়ে বাদ পড়ে (কিছুই ইমপোর্ট হয় না)। */}
            {missingAnswerCount > 0 && (
              <label className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowMissingAnswer}
                  onChange={(e) => setAllowMissingAnswer(e.target.checked)}
                  className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>
                  <strong>{toBengaliDigits(missingAnswerCount)}টি প্রশ্নে সঠিক উত্তর লেখা নেই।</strong> উত্তর আলাদা
                  পাতায় থাকলে এই ঘরটায় টিক দিন — প্রশ্নগুলোও নেওয়া হবে (ডিফল্ট উত্তর{" "}
                  <strong>&lsquo;ক&rsquo;</strong> ধরে নিয়ে)। পরে অবশ্যই মিলিয়ে নিন।
                </span>
              </label>
            )}

            {/* কোন টপিকে যাচ্ছে — স্পষ্ট করে দেখানো, নইলে "সিলেক্ট হয়নি" মনে হয় */}
            <p className="text-[11px] sm:text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5">
              📁 টপিক: <strong>{topicPathLabel(resolvedTopic)}</strong>
              {resolvedTopic.source === "manual" && (
                <span className="text-slate-500"> (আপনি বেছেছেন — এটাই ব্যবহার হবে)</span>
              )}
              {resolvedTopic.source === "ai" && (
                <span className="text-slate-500"> (AI বুঝে নিয়েছে — চাইলে ট্রি থেকে বদলান)</span>
              )}
              {resolvedTopic.source === "none" && (
                <span className="text-slate-500"> — ট্রি থেকে বেছে নিলে সেখানেই যাবে</span>
              )}
            </p>

            {/* Preview List */}
            <div className="overflow-y-auto space-y-3 pr-1 flex-1 min-h-[200px]">
              {preview.blocks.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">বামে প্রশ্ন পেস্ট করলেই এখানে প্রিভিউ দেখতে পাবেন।</p>
                </div>
              ) : (
                preview.blocks.map((b, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border bg-white space-y-2 shadow-sm text-xs ${
                      b.isValid
                        ? "border-emerald-200"
                        : "border-amber-300 bg-amber-50/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900 leading-snug whitespace-pre-wrap">
                        {toBengaliDigits(idx + 1)}. {b.q ? <MathText text={b.q} /> : "প্রশ্নবিহীন"}
                      </span>
                      {b.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    {(b.topic || b.subtopic) && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md w-fit border border-indigo-100">
                        <span>📁 {b.topic}</span>
                        {b.subtopic && <span>❯ {b.subtopic}</span>}
                      </div>
                    )}

                    {b.error && (
                      <p className="text-xs text-amber-700 font-medium">
                        ⚠️ {b.error}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-sm">
                      {b.opts.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className={`p-1.5 rounded-lg border px-2 truncate ${
                            optIdx === b.correct
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                              : "bg-slate-50 border-slate-200/80 text-slate-700"
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}) <MathText text={opt} />
                        </div>
                      ))}
                    </div>

                    {b.exp && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                        <strong>ব্যাখ্যা:</strong> <MathText text={b.exp} />
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500">
            {preview.validCount > 0 ? (
              <span>
                ✅ <strong>{toBengaliDigits(preview.validCount)}টি প্রশ্ন</strong> সেটে যোগ করার জন্য প্রস্তুত।
              </span>
            ) : (
              <span>বামে প্রশ্ন লিখে বা পেস্ট করে ইম্পোর্ট করুন।</span>
            )}
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              disabled={preview.validCount === 0 || isSubmitting}
              onClick={handleImport}
              className={`flex-1 sm:flex-initial text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                preview.validCount === 0 || isSubmitting
                  ? "bg-slate-300 cursor-not-allowed text-slate-500"
                  : "bg-slate-900 hover:bg-slate-800 active:scale-[0.98]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>যুক্ত হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>এক ক্লিকে {toBengaliDigits(preview.validCount)}টি প্রশ্ন যোগ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
