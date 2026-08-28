"use client";

import React, { useState, useMemo } from "react";
import {
  Target,
  Sparkles,
  Zap,
  Clock,
  BookOpen,
  Play,
  Layers,
  ChevronRight,
  Loader2
} from "lucide-react";
import { AppConfigData } from "@/types/exam";
import {
  getAvailablePracticeTopics,
  generatePracticeQuestions,
  PracticeQuestion,
  TopicOption
} from "@/lib/practice-helper";
import { SelfPracticeModal } from "@/components/modals/SelfPracticeModal";
import { toBengaliDigits } from "@/lib/utils";

interface SelfPracticeCardProps {
  config: AppConfigData;
}

const QUESTION_COUNTS = [10, 20, 30, 50];

export const SelfPracticeCard: React.FC<SelfPracticeCardProps> = ({ config }) => {
  const availableTopics = useMemo(() => {
    return getAvailablePracticeTopics(config);
  }, [config]);

  const [selectedTopic, setSelectedTopic] = useState("সকল টপিক (মিক্সড)");
  const [selectedCount, setSelectedCount] = useState(10);
  const [practiceMode, setPracticeMode] = useState<"instant" | "exam">("instant");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[]>([]);

  const handleStartPractice = async () => {
    setIsLoading(true);
    const questions = await generatePracticeQuestions(config, selectedTopic, selectedCount);
    setPracticeQuestions(questions);
    setIsLoading(false);
    setIsModalOpen(true);
  };

  return (
    <div className="font-bengali">
      {/* Container Box with Soft Emerald / Teal Glow */}
      <div className="relative rounded-3xl p-5 sm:p-7 md:p-8 bg-gradient-to-br from-emerald-100/40 via-white to-teal-50/50 border-2 border-emerald-500 shadow-md shadow-emerald-100/60 ring-1 ring-emerald-300/20 transition-all duration-300">
        
        {/* Top Header Badge & Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-200 pb-5 mb-6">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <Target className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  সেলফ প্র্যাকটিস মোড
                </span>
                <span className="text-[10px] font-medium text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 animate-bounce" /> আনলিমিটেড ফ্রি অনুশীলন
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-emerald-950 mt-1 tracking-tight">
                বিষয়ভিত্তিক সেলফ-প্র্যাকটিস ও কুইজ
              </h2>
              <p className="text-xs sm:text-sm text-slate-800 mt-0.5 font-medium">
                টপিক নির্বাচন করে যেকোনো সময় প্র্যাকটিস ও কুইজ দিয়ে নিজের প্রস্তুতি ঝালাই করুন।
              </p>
            </div>
          </div>
        </div>

        {/* Practice Config Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* 1. Topic Selector */}
          <div className="space-y-2 bg-white/80 p-4 rounded-2xl border border-emerald-100/90 shadow-2xs">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-teal-600" /> ১. টপিক নির্বাচন করুন:
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              <option value="সকল টপিক (মিক্সড)">সকল টপিক (মিক্সড মডেল টেস্ট)</option>
              {availableTopics.map((top) => (
                <option key={top.name} value={top.name}>
                  {top.name} {top.count > 0 ? `(${toBengaliDigits(top.count)}টি প্রশ্ন)` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Question Count Selector */}
          <div className="space-y-2 bg-white/80 p-4 rounded-2xl border border-emerald-100/90 shadow-2xs">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" /> ২. প্রশ্নের সংখ্যা:
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {QUESTION_COUNTS.map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSelectedCount(cnt)}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    selectedCount === cnt
                      ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {toBengaliDigits(cnt)}টি
                </button>
              ))}
            </div>
          </div>

          {/* 3. Mode Selector */}
          <div className="space-y-2 bg-white/80 p-4 rounded-2xl border border-emerald-100/90 shadow-2xs">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-teal-600" /> ৩. অনুশীলনের ধরন:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPracticeMode("instant")}
                className={`p-2 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border text-center flex flex-col items-center justify-center gap-0.5 ${
                  practiceMode === "instant"
                    ? "bg-teal-50 border-teal-500 text-teal-950 ring-1 ring-teal-400"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>ইনস্ট্যান্ট মোড</span>
                <span className="text-[9px] font-normal text-slate-500">ক্লিক করলেই উত্তর</span>
              </button>

              <button
                type="button"
                onClick={() => setPracticeMode("exam")}
                className={`p-2 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border text-center flex flex-col items-center justify-center gap-0.5 ${
                  practiceMode === "exam"
                    ? "bg-teal-50 border-teal-500 text-teal-950 ring-1 ring-teal-400"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>মক টেস্ট মোড</span>
                <span className="text-[9px] font-normal text-slate-500">টাইমারসহ পরীক্ষা</span>
              </button>
            </div>
          </div>

        </div>

        {/* Action Call to Action Button */}
        <div className="mt-6 pt-4 border-t border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            🎯 নির্বাচিত: <strong className="text-teal-900 font-semibold">{selectedTopic}</strong> •{" "}
            <strong>{toBengaliDigits(selectedCount)}টি প্রশ্ন</strong> •{" "}
            <span>{practiceMode === "instant" ? "ইনস্ট্যান্ট উত্তর ও ব্যাখ্যা" : "টাইমারসহ মক টেস্ট"}</span>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleStartPractice}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold px-8 py-3.5 rounded-2xl text-xs sm:text-sm shadow-md shadow-teal-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>প্রশ্ন প্রস্তুত হচ্ছে...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>প্র্যাকটিস শুরু করুন</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Practice Session Modal */}
      <SelfPracticeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        questions={practiceQuestions}
        subjectName={selectedTopic}
        mode={practiceMode}
        onRestart={handleStartPractice}
      />
    </div>
  );
};
