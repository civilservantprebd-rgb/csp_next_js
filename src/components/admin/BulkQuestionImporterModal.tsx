"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  Loader2
} from "lucide-react";
import { parseBulkQuestionsText } from "@/lib/question-parser";
import { addBulkQuestionsToExam, addBulkQuestionsToBank } from "@/actions/admin-actions";
import { TopicTreeSelector } from "./TopicTreeSelector";
import { toBengaliDigits } from "@/lib/utils";

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
ব্যাখ্যা: ১৯৯৭ সালের ১১ ডিসেম্বর জাপানের কিয়োটো শহরে এটি গৃহীত হয়।`;

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
    return parseBulkQuestionsText(rawText, selectedTopic, selectedSubtopic);
  }, [rawText, selectedTopic, selectedSubtopic]);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    setRawText(SAMPLE_TEXT);
  };

  const handleClear = () => {
    setRawText("");
  };

  const handleImport = async () => {
    if (parsedResult.validCount === 0) {
      alert("কোনো সঠিক প্রশ্ন পাওয়া যায়নি। দয়া করে ফরম্যাটটি পরীক্ষা করুন।");
      return;
    }

    setIsSubmitting(true);
    let res;
    if (activeExamKey) {
      res = await addBulkQuestionsToExam(
        activeExamKey,
        parsedResult.questions,
        parsedResult.solutions
      );
    } else {
      res = await addBulkQuestionsToBank(
        parsedResult.questions,
        parsedResult.solutions,
        selectedTopic,
        selectedSubtopic
      );
    }
    setIsSubmitting(false);

    if (res.success) {
      alert(`সফলভাবে ${toBengaliDigits(res.count)}টি প্রশ্ন যুক্ত করা হয়েছে!`);
      setRawText("");
      onSuccess();
      onClose();
    } else {
      alert("প্রশ্নগুলো যুক্ত করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
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

        {/* Modal Body: Split Grid */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-grow">
          {/* Left Column: Text Input & Controls (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">
                এখানে প্রশ্ন, অপশন ও উত্তর পেস্ট করুন:
              </span>
              <div className="flex items-center gap-2">
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

            <div className="relative flex-grow min-h-[260px] sm:min-h-[300px]">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`১. প্রশ্ন এখানে লিখুন...
ক) অপশন ১
খ) অপশন ২
গ) অপশন ৩
ঘ) অপশন ৪
উত্তর: খ
ব্যাখ্যা: ব্যাখ্যা লিখুন (ঐচ্ছিক)`}
                className="w-full h-full min-h-[260px] sm:min-h-[300px] p-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs sm:text-sm font-mono leading-relaxed resize-none shadow-sm"
              />
            </div>

            {/* Optional Topic Assignment — full hierarchy tree */}
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
                  {toBengaliDigits(parsedResult.validCount)}টি প্রস্তুত
                </span>
                <span className="bg-slate-200 text-slate-700 text-xs font-medium px-2 py-0.5 rounded-md">
                  মোট {toBengaliDigits(parsedResult.totalParsed)}টি শনাক্ত
                </span>
              </div>
            </div>

            {/* Preview List */}
            <div className="overflow-y-auto space-y-3 pr-1 max-h-[340px] flex-grow">
              {parsedResult.blocks.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">বামে প্রশ্ন পেস্ট করলেই এখানে প্রিভিউ দেখতে পাবেন।</p>
                </div>
              ) : (
                parsedResult.blocks.map((b, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border bg-white space-y-2 shadow-sm text-xs ${
                      b.isValid
                        ? "border-emerald-200"
                        : "border-amber-300 bg-amber-50/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900 leading-snug">
                        {toBengaliDigits(idx + 1)}. {b.q || "প্রশ্নবিহীন"}
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
                          {String.fromCharCode(65 + optIdx)}) {opt}
                        </div>
                      ))}
                    </div>

                    {b.exp && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                        <strong>ব্যাখ্যা:</strong> {b.exp}
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
            {parsedResult.validCount > 0 ? (
              <span>
                ✅ <strong>{toBengaliDigits(parsedResult.validCount)}টি প্রশ্ন</strong> সেটে যোগ করার জন্য প্রস্তুত।
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
              disabled={parsedResult.validCount === 0 || isSubmitting}
              onClick={handleImport}
              className={`flex-1 sm:flex-initial text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                parsedResult.validCount === 0 || isSubmitting
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
                  <span>এক ক্লিকে {toBengaliDigits(parsedResult.validCount)}টি প্রশ্ন যোগ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
