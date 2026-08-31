"use client";
import React, { useState, useEffect } from "react";
import { Zap, Clock, BookOpen, CircleHelp, UserPlus, Calendar, CheckCircle2 } from "lucide-react";
import { Exam } from "@/types/exam";
import { toBengaliDigits, sortExamsForStudents } from "@/lib/utils";
import { useCompletedExams } from "@/lib/use-completed-exams";
import { parseBangladeshDateTime, getTrueDate } from "@/lib/bangladesh-time";

interface LiveExamGridProps {
  exams: Record<string, Exam>;
  onSelectLiveExam: (examId: string) => void;
  onOpenEnrollModal?: () => void;
}

export const LiveExamGrid: React.FC<LiveExamGridProps> = ({
  exams,
  onSelectLiveExam,
  onOpenEnrollModal,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => getTrueDate());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(getTrueDate());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Exams the student already submitted → mark as completed
  const completedExams = useCompletedExams();

  // Find current active live exams based on accurate Bangladesh time
  const liveKeys = Object.entries(exams)
    .filter(([_, ex]) => {
      if (!ex.startTime) return false;
      const start = parseBangladeshDateTime(ex.startTime);
      if (!start || currentDate < start) return false;

      if (ex.endTime) {
        const end = parseBangladeshDateTime(ex.endTime);
        if (end && currentDate > end) return false;
      } else if (ex.leaderboardEndTime) {
        const end = parseBangladeshDateTime(ex.leaderboardEndTime);
        if (end && currentDate > end) return false;
      }
      return true;
    })
    .sort(sortExamsForStudents)
    .map(([k]) => k);

  if (liveKeys.length === 0) {
    return null;
  }

  return (
    <section className="relative font-bengali rounded-3xl bg-gradient-to-br from-rose-100/40 via-white to-red-50/50 border-2 border-rose-400 shadow-md shadow-rose-100/60 ring-1 ring-rose-300/20 p-5 sm:p-7 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-rose-200">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-200/90 text-black border border-rose-300 text-xs font-black shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            <span>চলতি পরীক্ষা (Live Now)</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2 mt-1">
            লাইভ এক্সাম হল
          </h3>
          <p className="text-xs sm:text-sm text-black font-bold">
            নির্ধারিত সমাপ্তি সময়ের মধ্যে পরীক্ষা দিন এবং সরাসরি মেধা তালিকায় নিজের অবস্থান যাচাই করুন
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {onOpenEnrollModal && (
            <button
              onClick={() => onOpenEnrollModal()}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Enroll Now</span>
            </button>
          )}
          <div className="shrink-0 bg-white px-3.5 py-1.5 rounded-xl border border-rose-300 text-xs font-black text-black flex items-center gap-1.5 shadow-2xs">
            <Zap className="w-4 h-4 text-rose-600 animate-pulse" />
            <span>{toBengaliDigits(liveKeys.length)}টি পরীক্ষা চলমান</span>
          </div>
        </div>
      </div>

      {/* Live Exams — all live exams shown (3 per row on desktop, page scrolls) */}
      <div className="pt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {liveKeys.map((k) => {
          const ex = exams[k];
          const isCompleted = completedExams.has(k);
          const qCount = ex.questions?.length || 0;
          return (
            <div
              key={k}
              className="group bg-white rounded-2xl p-5 border border-rose-200/90 hover:border-rose-450 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-slate-200 text-black text-[11px] font-black px-2.5 py-0.5 rounded-lg border border-slate-355 truncate max-w-[150px]">
                    {ex.course}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {ex.isFree && (
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ফ্রি
                      </span>
                    )}
                    {isCompleted && (
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> সম্পন্ন
                      </span>
                    )}
                    <span className="bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" /> Live
                    </span>
                  </span>
                </div>

                <div>
                  <h4 className="font-black text-black text-base sm:text-lg group-hover:text-rose-800 transition line-clamp-2">
                    {ex.title}
                  </h4>
                  <p className="text-xs text-black mt-1 flex items-center gap-1.5 font-bold">
                    <BookOpen className="w-3.5 h-3.5 text-black" /> বিষয়: {ex.subject}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2 text-xs text-black font-bold">
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/85">
                    <Clock className="w-3.5 h-3.5 text-rose-650" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                  </span>
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/85">
                    <CircleHelp className="w-3.5 h-3.5 text-black" /> {toBengaliDigits(qCount)} টি প্রশ্ন
                  </span>
                </div>
              </div>

              <button
                onClick={() => onSelectLiveExam(k)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.98]"
              >
                <Zap className="w-4 h-4 text-white fill-white" />
                <span>সরাসরি অংশ নিন</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
