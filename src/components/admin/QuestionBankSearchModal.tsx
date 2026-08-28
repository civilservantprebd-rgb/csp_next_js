"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Plus, Check, Loader2, BookOpen } from "lucide-react";
import { searchQuestionBank, linkQuestionToExam } from "@/actions/admin-actions";

interface QuestionBankSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  examKey: string;
  existingQuestionTexts: string[];
  topics: string[];
  onSuccess: () => void;
}

export const QuestionBankSearchModal: React.FC<QuestionBankSearchModalProps> = ({
  isOpen,
  onClose,
  examKey,
  existingQuestionTexts,
  topics,
  onSuccess,
}) => {
  const [queryText, setQueryText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("ALL");
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [linkingIds, setLinkingIds] = useState<Record<string, boolean>>({});

  const performSearch = async () => {
    setIsLoading(true);
    const res = await searchQuestionBank(queryText, selectedTopic);
    setQuestions(res.questions || []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      performSearch();
    }
  }, [isOpen, selectedTopic]);

  if (!isOpen) return null;

  const handleLink = async (qId: string) => {
    setLinkingIds((prev) => ({ ...prev, [qId]: true }));
    const success = await linkQuestionToExam(examKey, qId);
    setLinkingIds((prev) => ({ ...prev, [qId]: false }));
    if (success) {
      onSuccess();
    } else {
      alert("প্রশ্নটি যুক্ত করতে সমস্যা হয়েছে।");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-bengali">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-4 relative border border-slate-100 flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="bg-amber-50 text-amber-600 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 text-2xl shadow-inner border border-amber-100">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            প্রশ্ন ব্যাংক থেকে খুঁজুন
          </h3>
          <p className="text-xs text-slate-500">ডাটাবেজে আগে থেকে যুক্ত থাকা ৪,০০০+ প্রশ্ন খুঁজুন এবং এই পরীক্ষায় যুক্ত করুন</p>
        </div>

        {/* Search Bar & Filters */}
        <div className="flex gap-2.5 flex-col sm:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="প্রশ্ন কীওয়ার্ড খুঁজুন..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && performSearch()}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm bg-slate-50/50"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          </div>

          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-800 focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">সকল টপিক</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            onClick={performSearch}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
          >
            সার্চ করুন
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto min-h-60 pr-1 space-y-2.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              <span>প্রশ্ন খোঁজা হচ্ছে...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              কোনো প্রশ্ন পাওয়া যায়নি।
            </div>
          ) : (
            questions.map((q) => {
              const isAlreadyAdded = existingQuestionTexts.some(
                (ext) => ext.trim().toLowerCase() === q.q.trim().toLowerCase()
              );

              return (
                <div
                  key={q.id}
                  className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/30 flex justify-between items-start gap-4 transition hover:bg-slate-50/80"
                >
                  <div className="flex-1 space-y-1.5 text-xs text-slate-700">
                    <p className="font-bold text-slate-900 text-sm leading-relaxed">{q.q}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {q.opts.map((opt: string, oIdx: number) => (
                        <span
                          key={oIdx}
                          className={`px-2 py-0.5 rounded text-[10px] border ${
                            oIdx === q.correct
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                              : "bg-slate-50 text-slate-500 border-slate-100"
                          }`}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                    {q.topic && (
                      <span className="inline-block bg-amber-50 text-amber-700 border border-amber-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {q.topic}
                      </span>
                    )}
                  </div>

                  <div>
                    {isAlreadyAdded ? (
                      <button
                        disabled
                        className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>সংযুক্ত</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLink(q.id)}
                        disabled={linkingIds[q.id]}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {linkingIds[q.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>যুক্ত করুন</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
