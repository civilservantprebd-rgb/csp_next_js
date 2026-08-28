"use client";
 
import React from "react";
import { Zap, Clock, BookOpen, CircleHelp, UserPlus } from "lucide-react";
import { Exam } from "@/types/exam";
import { isExamCurrentlyLive } from "@/actions/exam-actions";
import { toBengaliDigits } from "@/lib/utils";
 
interface LiveExamGridProps {
  exams: Record<string, Exam>;
  onSelectLiveExam: (examKey: string) => void;
  onOpenEnrollModal?: (courseName?: string) => void;
}
 
export const LiveExamGrid: React.FC<LiveExamGridProps> = ({
  exams,
  onSelectLiveExam,
  onOpenEnrollModal
}) => {
  const liveKeys = Object.keys(exams).filter((k) => isExamCurrentlyLive(exams[k]));
 
  if (liveKeys.length === 0) {
    return null;
  }
 
  return (
    <section className="relative font-bengali rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            <span>চলতি পরীক্ষা (Live Now)</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            লাইভ এক্সাম হল
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            নির্ধারিত সমাপ্তি সময়ের মধ্যে পরীক্ষা দিন এবং সরাসরি মেধা তালিকায় নিজের অবস্থান যাচাই করুন
          </p>
        </div>
 
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {onOpenEnrollModal && (
            <button
              onClick={() => onOpenEnrollModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>এনরোল করুন</span>
            </button>
          )}
          <div className="shrink-0 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-rose-500" />
            <span>{toBengaliDigits(liveKeys.length)}টি পরীক্ষা চলমান</span>
          </div>
        </div>
      </div>
 
      {/* Live Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
        {liveKeys.map((k) => {
          const ex = exams[k];
          const qCount = ex.questions?.length || 0;
          return (
            <div
              key={k}
              className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border border-slate-200 truncate max-w-[150px]">
                    {ex.course}
                  </span>
                  <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" /> Live
                  </span>
                </div>
 
                <div>
                  <h4 className="font-bold text-slate-900 text-base sm:text-lg group-hover:text-indigo-600 transition line-clamp-2">
                    {ex.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" /> বিষয়: {ex.subject}
                  </p>
                </div>
 
                <div className="flex items-center gap-3 pt-2 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                    <Clock className="w-3.5 h-3.5 text-slate-500" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                  </span>
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                    <CircleHelp className="w-3.5 h-3.5 text-slate-500" /> {toBengaliDigits(qCount)} টি প্রশ্ন
                  </span>
                </div>
              </div>
 
              <button
                onClick={() => onSelectLiveExam(k)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98]"
              >
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>সরাসরি অংশ নিন</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
