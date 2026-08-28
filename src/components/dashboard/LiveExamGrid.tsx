"use client";

import React from "react";
import { Zap, Clock } from "lucide-react";
import { Exam } from "@/types/exam";
import { isExamCurrentlyLive } from "@/actions/exam-actions";

interface LiveExamGridProps {
  exams: Record<string, Exam>;
  onSelectLiveExam: (examKey: string) => void;
}

export const LiveExamGrid: React.FC<LiveExamGridProps> = ({ exams, onSelectLiveExam }) => {
  const liveKeys = Object.keys(exams).filter((k) => isExamCurrentlyLive(exams[k]));

  if (liveKeys.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 font-bengali">
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </span>
        <h3 className="text-lg font-bold text-slate-900">লাইভ এক্সাম (Live Exam)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {liveKeys.map((k) => {
          const ex = exams[k];
          return (
            <div
              key={k}
              className="bg-gradient-to-r from-rose-500/10 via-indigo-500/10 to-violet-500/10 border-2 border-rose-500/30 p-5 rounded-2xl shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="bg-rose-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> Live Now
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {ex.course} • {ex.subject}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-base sm:text-lg">{ex.title}</h4>
                <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-500" /> সময়সীমা: {ex.timerMinutes} মিনিট
                </p>
              </div>
              <button
                onClick={() => onSelectLiveExam(k)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition text-xs sm:text-sm shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" /> সরাসরি অংশ নিন
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
