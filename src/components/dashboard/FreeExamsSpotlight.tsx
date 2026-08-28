"use client";

import React from "react";
import { Sparkles, Play, Clock, CircleHelp, BookOpen, Award, CheckCircle2, UserPlus } from "lucide-react";
import { Exam } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";

interface FreeExamsSpotlightProps {
  exams: Record<string, Exam>;
  onStartExam: (examKey: string) => void;
  onOpenEnrollModal?: (courseName?: string) => void;
}

export const FreeExamsSpotlight: React.FC<FreeExamsSpotlightProps> = ({
  exams,
  onStartExam,
  onOpenEnrollModal
}) => {
  const freeExams = Object.entries(exams).filter(([_, ex]) => ex.isFree);

  if (freeExams.length === 0) {
    return null;
  }

  return (
    <section className="relative font-bengali overflow-hidden rounded-3xl bg-white border-2 border-amber-400/40 hover:border-amber-500 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between">
      {/* Header Banner - keeping current colors */}
      <div className="bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-indigo-500/10 p-5 sm:p-6 border-b border-amber-200/50 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Decorative Glows */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>সবার জন্য সম্পূর্ণ ফ্রি</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            ফ্রি মডেল টেস্ট স্পটলাইট
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            রেজিস্ট্রেশন বা ফি ছাড়াই যে কেউ অংশ নিয়ে নিজের প্রস্তুতি যাচাই করতে পারবেন
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {onOpenEnrollModal && (
            <button
              onClick={() => onOpenEnrollModal()}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md hover:shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>এনরোল করুন (Enroll Now)</span>
            </button>
          )}
          <div className="shrink-0 bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-2xl border border-amber-200 text-xs font-bold text-amber-900 shadow-sm flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            <span>মোট {toBengaliDigits(freeExams.length)}টি ফ্রি পরীক্ষা উপলব্ধ</span>
          </div>
        </div>
      </div>

      {/* Body Section */}
      <div className="p-5 sm:p-6 flex-grow bg-white">
        {/* Free Exams Grid with vertical scroll limit */}
        <div className="max-h-[640px] md:max-h-[580px] lg:max-h-[290px] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeExams.map(([key, ex]) => {
              const qCount = ex.questions?.length || 0;
              return (
                <div
                  key={key}
                  className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-indigo-100 truncate max-w-[150px]">
                        {ex.course}
                      </span>
                      <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ফ্রি
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-base group-hover:text-indigo-950 transition line-clamp-2 h-12">
                        {ex.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" /> বিষয়: {ex.subject}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-xs text-slate-600 font-medium">
                      <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        <Clock className="w-3.5 h-3.5 text-amber-500" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                      </span>
                      <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        <CircleHelp className="w-3.5 h-3.5 text-indigo-500" /> {toBengaliDigits(qCount)} টি প্রশ্ন
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onStartExam(key)}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-2.5 px-4 rounded-xl shadow hover:shadow-amber-500/10 transition duration-150 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98]"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>ফ্রি পরীক্ষা শুরু করুন</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
