"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Loader2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Key,
  Layers,
  FileText,
  Copy,
  Check,
  ChevronDown
} from "lucide-react";
import { generateMCQWithAI } from "@/actions/ai-actions";
import { toBengaliDigits } from "@/lib/utils";
import { addBulkQuestionsToExam, addBulkQuestionsToBank } from "@/actions/admin-actions";

interface AIQuestionGeneratorModalProps {
  isOpen: boolean;
  activeExamKey?: string;
  examTitle?: string;
  defaultTopic?: string;
  defaultSubtopic?: string;
  topics?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AIQuestionGeneratorModal: React.FC<AIQuestionGeneratorModalProps> = ({
  isOpen,
  activeExamKey,
  examTitle,
  defaultTopic = "",
  defaultSubtopic = "",
  topics = [],
  onClose,
  onSuccess,
}) => {
  const [topic, setTopic] = useState(defaultTopic);
  const [subtopic, setSubtopic] = useState(defaultSubtopic);
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"সহজ" | "মাঝারি" | "কঠিন" | "বিসিএস প্রিলিমিনারি মান">("বিসিএস প্রিলিমিনারি মান");
  const [contextText, setContextText] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [generatedResult, setGeneratedResult] = useState<{
    questions: any[];
    solutions: any[];
    rawText: string;
    count: number;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (defaultTopic) setTopic(defaultTopic);
    if (defaultSubtopic) setSubtopic(defaultSubtopic);
  }, [defaultTopic, defaultSubtopic]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg("দয়া করে বিষয় বা টপিকের নাম দিন।");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setGeneratedResult(null);

    const res = await generateMCQWithAI({
      topic: topic.trim(),
      subtopic: subtopic.trim(),
      count: Number(count),
      difficulty,
      contextText: contextText.trim()
    });

    setIsLoading(false);

    if (res.success && res.data) {
      setGeneratedResult(res.data);
    } else {
      setErrorMsg(res.error || "প্রশ্ন তৈরি করতে সমস্যা হয়েছে।");
    }
  };

  const handleSaveToExamOrBank = async () => {
    if (!generatedResult || generatedResult.questions.length === 0) return;

    setIsSaving(true);
    let res;
    if (activeExamKey) {
      res = await addBulkQuestionsToExam(
        activeExamKey,
        generatedResult.questions,
        generatedResult.solutions
      );
    } else {
      res = await addBulkQuestionsToBank(
        generatedResult.questions,
        generatedResult.solutions,
        topic.trim(),
        subtopic.trim()
      );
    }
    setIsSaving(false);

    if (res && "success" in res && res.success) {
      alert(`🎉 সফলভাবে ${toBengaliDigits(res.count || generatedResult.count)}টি প্রশ্ন যুক্ত করা হয়েছে!`);
      onSuccess();
      onClose();
    } else {
      const err = (res as any)?.error || "প্রশ্ন সংরক্ষণ করতে সমস্যা হয়েছে।";
      alert(err);
    }
  };

  const handleCopyRaw = () => {
    if (!generatedResult?.rawText) return;
    navigator.clipboard.writeText(generatedResult.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300/30" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  AI জেনারেটর
                </span>
                <span className="text-xs text-indigo-200">
                  {activeExamKey ? `পরীক্ষা: ${examTitle || "সিলেক্টেড পরীক্ষা"}` : "মূল প্রশ্নব্যাংক"}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                অটো প্রশ্ন ও ব্যাখ্যা জেনারেটর
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-grow p-4 sm:p-6 space-y-5">
          {/* Gemini API Key status */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 flex items-start gap-2 text-xs text-indigo-950">
            <Key className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              AI জেনারেটর সার্ভার-সাইড Gemini API Key (GEMINI_API_KEY) ব্যবহার করে — শিক্ষকদের আলাদা কোনো কী যোগ করার প্রয়োজন নেই। সার্ভারে কী সেট না থাকলে নিচে এরর বার্তা দেখানো হবে।
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  মূল বিষয় / চ্যাপ্টার <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="যেমন: বাংলা সাহিত্য, বাংলাদেশ বিষয়াবলী, সাধারণ বিজ্ঞান"
                  list="topic-list"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <datalist id="topic-list">
                  {topics.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  সাব-টপিক / নির্দিষ্ট বিষয় (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={subtopic}
                  onChange={(e) => setSubtopic(e.target.value)}
                  placeholder="যেমন: চর্যাপদ, মুক্তিযুদ্ধ ও সংবিধান, আলোকবিজ্ঞান"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  প্রশ্নের সংখ্যা
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                >
                  <option value={3}>৩টি প্রশ্ন</option>
                  <option value={5}>৫টি প্রশ্ন (প্রস্তাবিত)</option>
                  <option value={10}>১০টি প্রশ্ন</option>
                  <option value={15}>১৫টি প্রশ্ন</option>
                  <option value={20}>২০টি প্রশ্ন</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  প্রশ্নের মান ও লেভেল
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                >
                  <option value="বিসিএস প্রিলিমিনারি মান">বিসিএস প্রিলিমিনারি মান (স্ট্যান্ডার্ড)</option>
                  <option value="সহজ">সহজ (বেসিক)</option>
                  <option value="মাঝারি">মাঝারি</option>
                  <option value="কঠিন">কঠিন ও উচ্চতর মান</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                সহায়ক টেক্সট বা অনুচ্ছেদ (ঐচ্ছিক)
              </label>
              <textarea
                rows={2}
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="আপনি যদি কোনো নির্দিষ্ট অনুচ্ছেদ বা নোটস থেকে প্রশ্ন বানাতে চান, তবে তা এখানে পেস্ট করুন..."
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI দিয়ে প্রশ্ন তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>AI দিয়ে {toBengaliDigits(count)}টি প্রশ্ন ও ব্যাখ্যা জেনারেট করুন</span>
                </>
              )}
            </button>
          </form>

          {/* Generated Result Preview */}
          {generatedResult && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                    তৈরিকৃত প্রশ্নাবলী ({toBengaliDigits(generatedResult.count)}টি পাওয়া গেছে)
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyRaw}
                    className="text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "কপি হয়েছে!" : "টেক্সট কপি"}</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {generatedResult.questions.map((q, idx) => {
                  const sol = generatedResult.solutions[idx] || { correct: 0, exp: "" };
                  const optLabels = ["ক", "খ", "গ", "ঘ"];
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                    >
                      <div className="font-bold text-slate-900 flex items-start gap-1.5">
                        <span className="text-indigo-600 shrink-0">{toBengaliDigits(idx + 1)}.</span>
                        <span>{q.q}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pl-4">
                        {q.opts.map((opt: string, optIdx: number) => {
                          const isCorrect = optIdx === sol.correct;
                          return (
                            <div
                              key={optIdx}
                              className={`p-1.5 rounded-lg border flex items-center gap-1.5 ${
                                isCorrect
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                                  : "bg-white border-slate-200 text-slate-700"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                                isCorrect ? "bg-emerald-600 text-white font-black" : "bg-slate-100 text-slate-600"
                              }`}>
                                {optLabels[optIdx]}
                              </span>
                              <span className="truncate">{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      {sol.exp && (
                        <div className="mt-1 p-2 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-900 text-[11px] leading-relaxed">
                          <strong className="text-amber-950">💡 ব্যাখ্যা:</strong> {sol.exp}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Button: Directly Insert */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveToExamOrBank}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>ডাটাবেসে সংরক্ষণ করা হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>
                        সরাসরি {activeExamKey ? "এই পরীক্ষায়" : "প্রশ্নব্যাংকে"} {toBengaliDigits(generatedResult.count)}টি প্রশ্ন যুক্ত করুন
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
