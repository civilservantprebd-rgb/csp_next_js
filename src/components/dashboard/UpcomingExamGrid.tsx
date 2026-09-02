"use client";
import React, { useState, useEffect } from "react";
import {
  CalendarClock,
  Hourglass,
  Clock,
  BookOpen,
  CircleHelp,
  CheckCircle2,
  UserPlus
} from "lucide-react";
import { Exam } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";
import { parseBangladeshDateTime, getTrueNowMs } from "@/lib/bangladesh-time";

interface UpcomingExamGridProps {
  exams: Record<string, Exam>;
  onOpenEnrollModal?: () => void;
}

const BD_OFFSET_MS = 6 * 3600 * 1000;

/** "০২:৩০:১৫" or "২ দিন ৩ ঘণ্টা ৫ মিনিট" when longer than a day. */
function formatCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (d > 0) {
    return `${toBengaliDigits(d)} দিন ${toBengaliDigits(h)} ঘণ্টা ${toBengaliDigits(m)} মিনিট`;
  }
  return `${toBengaliDigits(String(h).padStart(2, "0"))}:${toBengaliDigits(String(m).padStart(2, "0"))}:${toBengaliDigits(String(s).padStart(2, "0"))}`;
}

/** Scheduled start time shown in Bangladesh wall-clock (independent of device timezone). */
function formatStartTime(d: Date): string {
  const bd = new Date(d.getTime() + BD_OFFSET_MS);
  const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const date = `${toBengaliDigits(bd.getUTCDate())}/${toBengaliDigits(bd.getUTCMonth() + 1)}/${toBengaliDigits(String(bd.getUTCFullYear()).slice(-2))}`;
  const time = `${toBengaliDigits(String(bd.getUTCHours()).padStart(2, "0"))}:${toBengaliDigits(String(bd.getUTCMinutes()).padStart(2, "0"))}`;
  return `${days[bd.getUTCDay()]}, ${date}, ${time}`;
}

/**
 * Upcoming scheduled exams — each card shows a live countdown ("শুরু হতে আর … বাকি").
 * Uses the Bangladesh network-synced clock; when a countdown hits zero the exam
 * disappears from here and automatically appears in the "চলতি পরীক্ষা" (Live) hall.
 */
export const UpcomingExamGrid: React.FC<UpcomingExamGridProps> = ({ exams, onOpenEnrollModal }) => {
  const [now, setNow] = useState<number>(() => getTrueNowMs());

  useEffect(() => {
    const timer = setInterval(() => setNow(getTrueNowMs()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Scheduled exams whose start time hasn't arrived yet — soonest first
  const upcoming = Object.entries(exams)
    .map(([k, ex]) => ({ k, ex, start: ex.startTime ? parseBangladeshDateTime(ex.startTime) : null }))
    .filter((x): x is { k: string; ex: Exam; start: Date } => !!x.start && x.start.getTime() > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <section className="relative font-bengali rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-sky-200">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-200/90 text-black border border-sky-300 text-xs font-black shadow-sm">
            <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
            <span>আসন্ন পরীক্ষা (Upcoming)</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2 mt-1">
            শীঘ্রই শুরু হবে
          </h3>
          <p className="text-xs sm:text-sm text-black font-bold">
            কাউন্টডাউন শেষ হলেই পরীক্ষা শুরু করুন — নির্ধারিত সময়ের আগেই প্রস্তুত হয়ে নিন
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {onOpenEnrollModal && (
            <button
              onClick={() => onOpenEnrollModal()}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Enroll Now</span>
            </button>
          )}
          <div className="shrink-0 bg-white px-3.5 py-1.5 rounded-xl border border-sky-300 text-xs font-black text-black flex items-center gap-1.5 shadow-sm">
            <CalendarClock className="w-4 h-4 text-sky-600" />
            <span>{toBengaliDigits(upcoming.length)}টি পরীক্ষা শুরু হবে</span>
          </div>
        </div>
      </div>

      {/* Upcoming Exams */}
      <div className="pt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {upcoming.map(({ k, ex, start }) => {
          const qCount = ex.questions?.length || 0;
          return (
            <div
              key={k}
              className="group bg-white rounded-2xl p-5 border border-sky-200/90 hover:border-sky-400 shadow-sm hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-slate-200 text-black text-sm font-black px-2.5 py-0.5 rounded-lg border border-slate-300 truncate max-w-[150px]">
                    {ex.course}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {ex.isFree && (
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ফ্রি
                      </span>
                    )}
                    <span className="bg-sky-100 text-sky-900 border border-sky-300 text-xs font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-ping" /> আসন্ন
                    </span>
                  </span>
                </div>

                <div>
                  <h4 className="font-black text-black text-base sm:text-lg group-hover:text-sky-800 transition line-clamp-2">
                    {ex.title}
                  </h4>
                  <p className="text-xs text-black mt-1 flex items-center gap-1.5 font-bold">
                    <BookOpen className="w-3.5 h-3.5 text-black" /> বিষয়: {ex.subject}
                  </p>
                </div>

                {/* Live countdown to start */}
                <div className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl px-3 py-2.5 flex items-center justify-center gap-1.5 shadow-sm">
                  <Hourglass className="w-4 h-4 animate-pulse shrink-0" />
                  <span className="text-sm font-bold opacity-90">শুরু হতে আর</span>
                  <span className="text-sm sm:text-base font-black tracking-wide tabular-nums whitespace-nowrap">
                    {formatCountdown(start.getTime() - now)}
                  </span>
                  <span className="text-sm font-bold opacity-90">বাকি</span>
                </div>

                <p className="text-sm text-slate-600 font-bold flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-sky-700" /> শুরুর সময়: {formatStartTime(start)}
                </p>

                <div className="flex items-center gap-3 pt-1 text-xs text-black font-bold">
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/85">
                    <Clock className="w-3.5 h-3.5 text-sky-700" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                  </span>
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/85">
                    <CircleHelp className="w-3.5 h-3.5 text-black" /> {toBengaliDigits(qCount)} টি প্রশ্ন
                  </span>
                </div>
              </div>

              <button
                disabled
                className="w-full bg-slate-200 text-slate-500 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Hourglass className="w-4 h-4" />
                <span>পরীক্ষা শুরু হয়নি</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
