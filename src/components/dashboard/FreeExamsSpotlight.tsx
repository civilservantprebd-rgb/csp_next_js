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
    <section className="font-bengali rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-yellow-50/40 border border-amber-200/90 shadow-xs flex flex-col justify-between overflow-hidden">
      {/* Header Banner */}
      <div className="bg-amber-50/60 p-5 sm:p-6 border-b border-amber-100/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/90 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>সবার জন্য সম্পূর্ণ ফ্রি</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            ফ্রি মডেল টেস্ট
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            রেজিস্ট্রেশন বা ফি ছাড়াই যে কেউ অংশ নিয়ে নিজের প্রস্তুতি যাচাই করতে পারবেন
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
          <div className="shrink-0 bg-white/90 px-3.5 py-1.5 rounded-xl border border-amber-200 text-xs font-semibold text-amber-900 flex items-center gap-1.5 shadow-2xs">
            <Award className="w-4 h-4 text-amber-500" />
            <span>মোট {toBengaliDigits(freeExams.length)}টি ফ্রি পরীক্ষা</span>
          </div>
        </div>
      </div>

      {/* Body Section */}
      <div className="p-5 sm:p-6 flex-grow">
        {/* Free Exams Grid with vertical scroll limit */}
        <div className="max-h-[640px] md:max-h-[580px] lg:max-h-[290px] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeExams.map(([key, ex]) => {
              const qCount = ex.questions?.length || 0;
              return (
                <div
                  key={key}
                  className="bg-white rounded-2xl p-5 border border-amber-100/90 hover:border-amber-300 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border border-slate-200 truncate max-w-[150px]">
                        {ex.course}
                      </span>
                      <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ফ্রি
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-base group-hover:text-amber-800 transition line-clamp-2 h-12">
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
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98]"
                  >
                    <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
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
