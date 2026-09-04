"use client";

import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Play,
  Award,
  BookOpen,
  Clock,
  CircleHelp,
  CheckCircle2,
  X,
  ChevronRight,
  UserPlus
} from "lucide-react";
import { Exam } from "@/types/exam";
import { toBengaliDigits, sortExamsForStudents } from "@/lib/utils";
import { useCompletedExams } from "@/lib/use-completed-exams";

interface FreeModelTestsBoxProps {
  exams: Record<string, Exam>;
  onStartExam: (examId: string) => void;
  onOpenEnrollModal?: () => void;
}

/**
 * "ফ্রি মডেল টেস্ট" — হোম পেজে একটা কমপ্যাক্ট বক্স:
 * সব ফ্রি পরীক্ষা সরাসরি না দেখিয়ে ট্যাপ করলে একটা উইন্ডো (মোডাল) খোলে,
 * সেখানে সব ফ্রি মডেল টেস্টের তালিকা থেকে শুরু করা যায়।
 */
export const FreeModelTestsBox: React.FC<FreeModelTestsBoxProps> = ({
  exams,
  onStartExam,
  onOpenEnrollModal
}) => {
  const [open, setOpen] = useState(false);

  // সব কোর্সের ফ্রি (মডেল) টেস্ট — শুরু/লাইভ আগে
  const freeExams = useMemo(
    () => Object.entries(exams).filter(([_, ex]) => ex.isFree).sort(sortExamsForStudents),
    [exams]
  );
  const completedExams = useCompletedExams();

  if (freeExams.length === 0) return null;

  const startExam = (key: string) => {
    setOpen(false);
    onStartExam(key);
  };

  return (
    <>
      {/* ---------- ১) কমপ্যাক্ট বক্স (ট্যাপ → উইন্ডো) ---------- */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left font-bengali rounded-3xl bg-gradient-to-r from-amber-100 via-amber-50 to-white border border-amber-200 shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer p-4 sm:p-5 active:scale-[0.995]"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0 group-hover:scale-105 transition">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-black text-base sm:text-lg leading-tight">ফ্রি মডেল টেস্ট</h3>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <Award className="w-3 h-3 text-emerald-600" /> সম্পূর্ণ ফ্রি
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-700 font-bold mt-0.5">
              মোট {toBengaliDigits(freeExams.length)}টি পরীক্ষা — রেজিস্ট্রেশন/ফি ছাড়াই প্রস্তুতি যাচাই করুন
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-amber-500 text-white text-xs font-black px-3 py-2 group-hover:bg-amber-600 transition shadow-sm">
            দেখুন <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </button>

      {/* ---------- ২) উইন্ডো (মোডাল): সব ফ্রি মডেল টেস্ট ---------- */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center font-bengali"
          role="dialog"
          aria-modal="true"
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full sm:max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
            {/* হেডার */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base leading-tight">ফ্রি মডেল টেস্ট</h3>
                  <p className="text-[11px] text-amber-100 font-bold">
                    মোট {toBengaliDigits(freeExams.length)}টি — যেকোনোটা বেছে পরীক্ষা শুরু করুন
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenEnrollModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenEnrollModal();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-[11px] shadow-sm transition cursor-pointer flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Enroll Now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
                  aria-label="বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* তালিকা */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-50">
              {freeExams.map(([key, ex]) => {
                const isCompleted = completedExams.has(key);
                const qCount = ex.questions?.length || 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => startExam(key)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-sm transition p-3.5 sm:p-4 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="bg-slate-200 text-black text-[11px] font-black px-2 py-0.5 rounded-lg border border-slate-300">
                            {ex.course}
                          </span>
                          <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ফ্রি
                          </span>
                          {isCompleted && (
                            <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> সম্পন্ন
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-black text-sm sm:text-base group-hover:text-amber-900 transition leading-snug">
                          {ex.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-600 font-bold flex-wrap">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-black" /> {ex.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-500" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                          </span>
                          <span className="flex items-center gap-1">
                            <CircleHelp className="w-3.5 h-3.5 text-indigo-500" /> {toBengaliDigits(qCount)}টি প্রশ্ন
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 w-9 h-9 rounded-xl bg-amber-500 group-hover:bg-amber-600 text-white flex items-center justify-center transition shadow-sm">
                        <Play className="w-4 h-4 fill-white text-white" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="bg-slate-50 px-4 sm:px-6 py-2.5 border-t border-slate-200 text-[10px] text-slate-500 font-bold">
              ⚡ যেকোনো মডেল টেস্টে ট্যাপ করলেই পরীক্ষা শুরু হবে — সময়ের মধ্যে উত্তর দিন, সাথে সাথেই মেধা তালিকায় অবস্থান দেখুন।
            </p>
          </div>
        </div>
      )}
    </>
  );
};
