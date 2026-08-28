"use client";

import React from "react";
import { Timer, ListChecks, Trophy, ArrowRight } from "lucide-react";
import { Exam } from "@/types/exam";

interface StatCardsProps {
  currentExam?: Exam;
  onOpenLeaderboard: () => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ currentExam, onOpenLeaderboard }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-bengali">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex items-center space-x-4">
        <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl text-2xl font-bold">
          <Timer className="w-7 h-7" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">সময়সীমা</h4>
          <p className="text-lg sm:text-xl font-bold text-slate-900">
            {currentExam ? `${currentExam.timerMinutes} মিনিট` : "১০ মিনিট"}
          </p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex items-center space-x-4">
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl text-2xl font-bold">
          <ListChecks className="w-7 h-7" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">মোট প্রশ্ন</h4>
          <p className="text-lg sm:text-xl font-bold text-slate-900">
            {currentExam?.questions ? currentExam.questions.length : 0}
          </p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex items-center space-x-4">
        <div className="bg-amber-50 text-amber-600 p-4 rounded-2xl text-2xl font-bold">
          <Trophy className="w-7 h-7" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">র‍্যাংকিং ও স্কোর</h4>
          <button
            onClick={onOpenLeaderboard}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold mt-0.5 flex items-center gap-1 cursor-pointer"
          >
            লিডারবোর্ড দেখুন <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
