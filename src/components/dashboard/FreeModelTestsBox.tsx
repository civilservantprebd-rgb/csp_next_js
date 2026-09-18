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
  UserPlus,
  Layers,
  ChevronDown
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
 * সব ফ্রি পরীক্ষা সরাসরি না দেখিয়ে ট্যাপ করলে একটা উইন্ডো (মোডাল) খোলে।
 *
 * তালিকা এখন **কোর্স অনুযায়ী সাজানো**:
 *   • প্রতিটি কোর্সের আলাদা সেকশন হেডার (কতটি পরীক্ষা আছে সহ)
 *   • কোর্স-চিপ দিয়ে এক কোর্সে সীমিত করা যায় (একাধিক কোর্স থাকলে)
 *   • কোর্সের ক্রম = তার সবচেয়ে "জরুরি" পরীক্ষা (লাইভ → আসন্ন → সমাপ্ত → অনুশীলন)
 */
export const FreeModelTestsBox: React.FC<FreeModelTestsBoxProps> = ({
  exams,
  onStartExam,
  onOpenEnrollModal
}) => {
  const [open, setOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>(""); // "" = সব কোর্স

  // সব কোর্সের ফ্রি (মডেল) টেস্ট — শুরু/লাইভ আগে
  const freeExams = useMemo(
    () => Object.entries(exams).filter(([_, ex]) => ex.isFree).sort(sortExamsForStudents),
    [exams]
  );

  /**
   * কোর্স অনুযায়ী গ্রুপ। `freeExams` আগেই urgency-ক্রমে সাজানো, আর Map
   * insertion-order মেনে চলে — তাই যে কোর্সে সবচেয়ে জরুরি পরীক্ষা আছে সেটাই
   * উপরে আসে, আর প্রতি গ্রুপের ভেতরেও একই ক্রম বজায় থাকে।
   */
  const courseGroups = useMemo(() => {
    const map = new Map<string, [string, Exam][]>();
    freeExams.forEach((entry) => {
      const course = String(entry[1].course || "").trim() || "অন্যান্য";
      const bucket = map.get(course);
      if (bucket) bucket.push(entry);
      else map.set(course, [entry]);
    });
    return Array.from(map.entries());
  }, [freeExams]);

  const visibleGroups = useMemo(
    () => (courseFilter ? courseGroups.filter(([c]) => c === courseFilter) : courseGroups),
    [courseGroups, courseFilter]
  );

  const completedExams = useCompletedExams();

  if (freeExams.length === 0) return null;

  const startExam = (key: string) => {
    setOpen(false);
    onStartExam(key);
  };

  return (
    <div>
      {/* ---------- ১) কমপ্যাক্ট বক্স (হালকা সবুজ — ট্যাপ → উইন্ডো) ---------- */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left font-bengali rounded-3xl bg-gradient-to-r from-emerald-100 via-emerald-50 to-white border border-emerald-200 shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer p-4 sm:p-5 active:scale-[0.995] h-full flex flex-col justify-between gap-3"
      >
        <div className="flex items-center gap-3.5 w-full">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0 group-hover:scale-105 transition">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-black text-base sm:text-lg leading-tight">ফ্রি মডেল টেস্ট</h3>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <Award className="w-3 h-3 text-emerald-600" /> সম্পূর্ণ ফ্রি
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-700 font-bold mt-0.5">
              মোট {toBengaliDigits(freeExams.length)}টি পরীক্ষা
              {courseGroups.length > 1 && (
                <>
                  {" "}— {toBengaliDigits(courseGroups.length)}টি কোর্সে সাজানো
                </>
              )}
            </p>
          </div>
        </div>
        <div className="w-full">
          <span className="w-full inline-flex justify-center items-center gap-1 rounded-xl bg-emerald-600 text-white text-xs font-black px-3 py-2 group-hover:bg-emerald-700 transition shadow-sm">
            দেখুন <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </button>

      {/* ---------- ২) উইন্ডো (মোডাল): কোর্স অনুযায়ী সাজানো তালিকা ---------- */}
      {open && (
        <div
          className="fixed inset-0 w-screen h-screen z-[9999] flex flex-col font-bengali bg-white animate-in fade-in slide-in-from-bottom-6 duration-300"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full h-full flex flex-col overflow-hidden">
            {/* হেডার */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-700 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base leading-tight">ফ্রি মডেল টেস্ট</h3>
                  <p className="text-[11px] text-emerald-100 font-bold">
                    মোট {toBengaliDigits(freeExams.length)}টি — কোর্স অনুযায়ী সাজানো
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

            {/* কোর্স-ফিল্টার ড্রপডাউন */}
            {courseGroups.length > 1 && (
              <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <label htmlFor="courseFilter" className="shrink-0 flex items-center gap-1.5 text-xs font-black text-slate-600 mb-0.5 sm:mb-0">
                  <Layers className="w-4 h-4" /> কোর্স নির্বাচন করুন:
                </label>
                <div className="relative w-full sm:flex-1 sm:max-w-[260px]">
                  <select
                    id="courseFilter"
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="w-full text-[13px] font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 sm:py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer transition appearance-none pr-9"
                  >
                    <option value="">সব কোর্স ({toBengaliDigits(freeExams.length)})</option>
                    {courseGroups.map(([course, items]) => (
                      <option key={course} value={course}>
                        {course} ({toBengaliDigits(items.length)})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* তালিকা */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-50">
              {(courseFilter ? freeExams.filter(e => e[1].course === courseFilter) : freeExams).map(([key, ex]) => {
                const isCompleted = completedExams.has(key);
                const qCount = ex.questions?.length || 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => startExam(key)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-sm transition p-3.5 sm:p-4 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="bg-slate-200 text-black text-[11px] font-black px-2 py-0.5 rounded-lg border border-slate-300">
                            {ex.course}
                          </span>
                          <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ফ্রি
                          </span>
                        </div>
                        <h4 className="font-black text-black text-sm sm:text-base group-hover:text-emerald-800 transition leading-snug flex items-center gap-2">
                          {ex.title}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> সম্পন্ন
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-600 font-bold flex-wrap">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-black" /> {ex.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                          </span>
                          <span className="flex items-center gap-1">
                            <CircleHelp className="w-3.5 h-3.5 text-indigo-500" /> {toBengaliDigits(qCount)}টি প্রশ্ন
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500 group-hover:bg-emerald-600 text-white flex items-center justify-center transition shadow-sm">
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
    </div>
  );
};
