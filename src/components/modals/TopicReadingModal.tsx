"use client";

import React, { useState } from "react";
import {
  X,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Zap,
  Bookmark,
  Search,
  Filter
} from "lucide-react";
import { PracticeQuestion } from "@/lib/practice-helper";
import { toBengaliDigits } from "@/lib/utils";

interface TopicReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: PracticeQuestion[];
  title: string;
  onStartQuiz?: () => void;
}

export const TopicReadingModal: React.FC<TopicReadingModalProps> = ({
  isOpen,
  onClose,
  questions,
  title,
  onStartQuiz,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "card">("list");
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const filteredQuestions = questions.filter((q) =>
    searchQuery
      ? q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.opts.some((o) => o.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
  );

  const toggleReveal = (idx: number) => {
    setRevealedAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const optLabels = ["ক", "খ", "গ", "ঘ"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                  স্টাডি ও রিডিং মোড
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {toBengaliDigits(questions.length)}টি প্রশ্ন
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 line-clamp-1 mt-0.5">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onStartQuiz && (
              <button
                type="button"
                onClick={onStartQuiz}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">এই টপিকের কুইজ দিন</span>
                <span className="sm:hidden">কুইজ</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher & Search Bar */}
        <div className="p-3.5 sm:px-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="প্রশ্ন বা উত্তর খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "list"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              এক নজরে সব প্রশ্ন (List)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("card")}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "card"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ফ্ল্যাশকার্ড মোড (1 by 1)
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-grow bg-slate-50/50">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <HelpCircle className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs">কোনো প্রশ্ন পাওয়া যায়নি।</p>
            </div>
          ) : activeTab === "list" ? (
            /* List View */
            <div className="space-y-4 max-w-3xl mx-auto">
              {filteredQuestions.map((q, idx) => {
                return (
                  <div
                    key={q.id || idx}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-relaxed">
                        <span className="text-indigo-600 mr-1.5">{toBengaliDigits(idx + 1)}.</span>
                        {q.q}
                      </h4>
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      {q.opts.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correct;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                              isCorrect
                                ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-bold"
                                : "border-slate-100 bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {optLabels[oIdx]}
                            </span>
                            <span>{opt}</span>
                            {isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.exp && (
                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-950 leading-relaxed space-y-1">
                        <span className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                          <Sparkles className="w-3 h-3 text-amber-600" /> সঠিক উত্তর ও ব্যাখ্যা:
                        </span>
                        <p className="text-slate-800">{q.exp}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Flashcard (1 by 1) View */
            <div className="max-w-xl mx-auto py-4 space-y-5">
              {filteredQuestions[currentCardIdx] && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-indigo-100 shadow-md space-y-5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-100 pb-3">
                    <span>
                      প্রশ্ন: {toBengaliDigits(currentCardIdx + 1)} / {toBengaliDigits(filteredQuestions.length)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleReveal(currentCardIdx)}
                      className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {revealedAnswers[currentCardIdx] ? "উত্তর লুকান" : "উত্তর দেখুন"}
                    </button>
                  </div>

                  <h4 className="font-bold text-slate-900 text-base sm:text-lg leading-relaxed">
                    {filteredQuestions[currentCardIdx].q}
                  </h4>

                  <div className="space-y-2 text-xs sm:text-sm">
                    {filteredQuestions[currentCardIdx].opts.map((opt, oIdx) => {
                      const isCorrect = oIdx === filteredQuestions[currentCardIdx].correct;
                      const isRevealed = revealedAnswers[currentCardIdx];
                      return (
                        <div
                          key={oIdx}
                          className={`p-3 rounded-xl border flex items-center gap-2.5 transition ${
                            isRevealed && isCorrect
                              ? "border-emerald-400 bg-emerald-50 text-emerald-950 font-bold shadow-xs"
                              : "border-slate-200 bg-slate-50 text-slate-800"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              isRevealed && isCorrect
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {optLabels[oIdx]}
                          </span>
                          <span>{opt}</span>
                          {isRevealed && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {revealedAnswers[currentCardIdx] && filteredQuestions[currentCardIdx].exp && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-slate-800 leading-relaxed animate-in fade-in">
                      <strong className="text-amber-900 block mb-1">ব্যাখ্যা:</strong>
                      {filteredQuestions[currentCardIdx].exp}
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={currentCardIdx === 0}
                      onClick={() => setCurrentCardIdx((p) => Math.max(0, p - 1))}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> আগের প্রশ্ন
                    </button>

                    <button
                      type="button"
                      disabled={currentCardIdx === filteredQuestions.length - 1}
                      onClick={() => setCurrentCardIdx((p) => Math.min(filteredQuestions.length - 1, p + 1))}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                    >
                      পরের প্রশ্ন <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
