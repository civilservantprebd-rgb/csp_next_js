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
    <section className="relative font-bengali overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500/10 via-indigo-500/5 to-violet-500/10 border-2 border-rose-400/40 p-5 sm:p-7 shadow-xl shadow-rose-500/5">
      {/* Decorative Glows */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-rose-400/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />
 
      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-rose-200/50">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-black shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>চলতি পরীক্ষা (Active Now)</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            লাইভ এক্সাম হল (Live Exam Hall)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            নির্ধারিত সময়ের মধ্যে পরীক্ষায় অংশগ্রহণ করুন, অটো-সাবমিশন ও রিয়েল-টাইম মেধা তালিকা যুক্ত
          </p>
        </div>
 
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {onOpenEnrollModal && (
            <button
              onClick={() => onOpenEnrollModal()}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md hover:shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>এনরোল করুন (Enroll Now)</span>
            </button>
          )}
          <div className="shrink-0 bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-2xl border border-rose-200 text-xs font-bold text-rose-900 shadow-sm flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-rose-500 animate-bounce" />
            <span>{toBengaliDigits(liveKeys.length)}টি পরীক্ষা চলমান</span>
          </div>
        </div>
      </div>
 
      {/* Live Exams Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
        {liveKeys.map((k) => {
          const ex = exams[k];
          const qCount = ex.questions?.length || 0;
          return (
            <div
              key={k}
              className="group bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-rose-400 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 hover:-translate-y-0.5"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-indigo-100 truncate max-w-[150px]">
                    {ex.course}
                  </span>
                  <span className="bg-rose-500 text-white text-[10px] uppercase font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> Live Now
                  </span>
                </div>
 
                <div>
                  <h4 className="font-bold text-slate-900 text-base sm:text-lg group-hover:text-rose-900 transition line-clamp-2">
                    {ex.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" /> বিষয়: {ex.subject}
                  </p>
                </div>
 
                <div className="flex items-center gap-3 pt-2 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    <Clock className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                  </span>
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    <CircleHelp className="w-3.5 h-3.5 text-indigo-500" /> {toBengaliDigits(qCount)} টি প্রশ্ন
                  </span>
                </div>
              </div>
 
              <button
                onClick={() => onSelectLiveExam(k)}
                className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black py-2.5 px-4 rounded-xl shadow transition duration-150 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer group-hover:shadow-rose-500/20 active:scale-[0.98]"
              >
                <Zap className="w-4 h-4 text-white fill-white animate-pulse" />
                <span>সরাসরি অংশ নিন</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
