"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Hourglass,
  Clock,
  BookOpen,
  X,
  ChevronRight,
  AlarmClock
} from "lucide-react";
import { Exam } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";
import { parseBangladeshDateTime, getTrueNowMs, syncBangladeshNetworkTime } from "@/lib/bangladesh-time";

interface UpcomingExamsBoxProps {
  exams: Record<string, Exam>;
}

const BD_OFFSET_MS = 6 * 3600 * 1000;

/**
 * হোম পেজে আসন্ন লাইভ এক্সাম কেবল শুরু হওয়ার ১২ ঘণ্টা আগে থেকে এক বক্সে দেখা যায়;
 * ট্যাপ করলে উইন্ডোয় প্রতিটির "শুরু হতে আর …" কাউন্টডাউন লাল রঙে চলে।
 */
const UPCOMING_WINDOW_MS = 12 * 3600 * 1000;

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

function formatStartTime(d: Date): string {
  const bd = new Date(d.getTime() + BD_OFFSET_MS);
  const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const date = `${toBengaliDigits(bd.getUTCDate())}/${toBengaliDigits(bd.getUTCMonth() + 1)}/${toBengaliDigits(String(bd.getUTCFullYear()).slice(-2))}`;
  const time = `${toBengaliDigits(String(bd.getUTCHours()).padStart(2, "0"))}:${toBengaliDigits(String(bd.getUTCMinutes()).padStart(2, "0"))}`;
  return `${days[bd.getUTCDay()]}, ${date}, ${time}`;
}

export const UpcomingExamsBox: React.FC<UpcomingExamsBoxProps> = ({ exams }) => {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number>(() => getTrueNowMs());

  useEffect(() => {
    const timer = setInterval(() => setNow(getTrueNowMs()), 1000);
    // মাউন্টে নেটওয়ার্ক-টাইম সিঙ্ক — ডিভাইস ঘড়ি নয়
    syncBangladeshNetworkTime().then(() => setNow(getTrueNowMs()));
    return () => clearInterval(timer);
  }, []);

  // শুরু হতে বাকি ≤১২ ঘণ্টা — সবচেয়ে আগে যেটা শুরু হবে আগে
  const upcoming = useMemo(
    () =>
      Object.entries(exams)
        .map(([k, ex]) => ({ k, ex, start: ex.startTime ? parseBangladeshDateTime(ex.startTime) : null }))
        .filter(
          (x): x is { k: string; ex: Exam; start: Date } =>
            !!x.start && x.start.getTime() > now && x.start.getTime() <= now + UPCOMING_WINDOW_MS
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [exams, now]
  );

  if (upcoming.length === 0) return null;

  return (
    <>
      {/* ---------- ১) কমপ্যাক্ট বক্স (হালকা লাল — ট্যাপ → উইন্ডো) ---------- */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left font-bengali rounded-3xl bg-gradient-to-r from-red-100 via-red-50 to-white border border-red-200 shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer p-4 sm:p-5 active:scale-[0.995] h-full"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30 shrink-0 group-hover:scale-105 transition">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-black text-base sm:text-lg leading-tight">আসন্ন লাইভ এক্সাম</h3>
              <span className="bg-red-100 text-red-800 border border-red-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlarmClock className="w-3 h-3" /> ১২ ঘণ্টার মধ্যে
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-700 font-bold mt-0.5">
              {toBengaliDigits(upcoming.length)}টি পরীক্ষা শুরু হতে বাকি — ট্যাপ করে টাইমার দেখুন
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-red-600 text-white text-xs font-black px-3 py-2 group-hover:bg-red-700 transition shadow-sm">
            দেখুন <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </button>

      {/* ---------- ২) উইন্ডো (মোডাল): কাউন্টডাউন লাল রঙে ---------- */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center font-bengali"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full sm:max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
            {/* হেডার */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base leading-tight">আসন্ন লাইভ এক্সাম</h3>
                  <p className="text-[11px] text-red-100 font-bold">
                    {toBengaliDigits(upcoming.length)}টি পরীক্ষা শুরু হতে বাকি — টাইমার শেষ হলেই লাইভ তালিকায় চলে যাবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
                aria-label="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* তালিকা */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-50">
              {upcoming.map(({ k, ex, start }) => {
                const qCount = ex.questions?.length || 0;
                const remain = start.getTime() - now;
                return (
                  <div
                    key={k}
                    className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-red-400 hover:shadow-sm transition p-3.5 sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="bg-slate-200 text-black text-[11px] font-black px-2 py-0.5 rounded-lg border border-slate-300">
                            {ex.course}
                          </span>
                          {ex.isFree && (
                            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-200">
                              ফ্রি
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-black text-sm sm:text-base leading-snug">{ex.title}</h4>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-600 font-bold flex-wrap">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-black" /> {ex.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-sky-700" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5 text-sky-700" /> {formatStartTime(start)}
                          </span>
                          <span className="text-slate-400">• {toBengaliDigits(qCount)}টি প্রশ্ন</span>
                        </div>
                      </div>
                    </div>

                    {/* লাল কাউন্টডাউন: "শুরু হতে আর … বাকি" */}
                    <div className="mt-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl px-3 py-2.5 flex items-center justify-center gap-1.5 shadow-sm">
                      <Hourglass className="w-4 h-4 animate-pulse shrink-0" />
                      <span className="text-sm font-bold opacity-95">শুরু হতে আর</span>
                      <span className="text-base sm:text-lg font-black tracking-wide tabular-nums whitespace-nowrap">
                        {formatCountdown(remain)}
                      </span>
                      <span className="text-sm font-bold opacity-95">বাকি</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="bg-slate-50 px-4 sm:px-6 py-2.5 border-t border-slate-200 text-[10px] text-slate-500 font-bold">
              ⏰ টাইমার শেষ হলেই পরীক্ষাটি উপরের ‘লাইভ এক্সাম’ বক্সে চলে যাবে — সেখান থেকে সরাসরি অংশ নিতে পারবেন।
            </p>
          </div>
        </div>
      )}
    </>
  );
};
