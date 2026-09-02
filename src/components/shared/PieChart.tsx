"use client";

import React from "react";
import { toBengaliDigits } from "@/lib/utils";

interface PieChartProps {
  correct: number;
  wrong: number;
  skipped: number;
}

/** Small donut chart showing correct / wrong / skipped shares (live exams). */
export const PieChart: React.FC<PieChartProps> = ({ correct, wrong, skipped }) => {
  const total = correct + wrong + skipped;
  if (total === 0) {
    return (
      <div className="text-sm text-slate-400 py-2 text-center">
        এখনো কোনো লাইভ পরীক্ষার পরিসংখ্যান নেই
      </div>
    );
  }

  const R = 34;
  const C = 2 * Math.PI * R;
  const segLen = (n: number) => (n / total) * C;
  const pct = (n: number) => Math.round((n / total) * 100);

  const c1 = segLen(correct);
  const c2 = segLen(wrong);
  const c3 = segLen(skipped);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 100 100" className="w-20 h-20 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        {correct > 0 && (
          <circle
            cx="50" cy="50" r={R} fill="none" stroke="#10b981" strokeWidth="14"
            strokeDasharray={`${c1} ${C - c1}`} strokeDashoffset={0} strokeLinecap="butt"
          />
        )}
        {wrong > 0 && (
          <circle
            cx="50" cy="50" r={R} fill="none" stroke="#f43f5e" strokeWidth="14"
            strokeDasharray={`${c2} ${C - c2}`} strokeDashoffset={-c1} strokeLinecap="butt"
          />
        )}
        {skipped > 0 && (
          <circle
            cx="50" cy="50" r={R} fill="none" stroke="#94a3b8" strokeWidth="14"
            strokeDasharray={`${c3} ${C - c3}`} strokeDashoffset={-(c1 + c2)} strokeLinecap="butt"
          />
        )}
      </svg>

      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-bold text-emerald-700">সঠিক: {toBengaliDigits(correct)}</span>
          <span className="text-slate-400">({toBengaliDigits(pct(correct))}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <span className="font-bold text-rose-700">ভুল: {toBengaliDigits(wrong)}</span>
          <span className="text-slate-400">({toBengaliDigits(pct(wrong))}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
          <span className="font-bold text-slate-600">স্কিপ: {toBengaliDigits(skipped)}</span>
          <span className="text-slate-400">({toBengaliDigits(pct(skipped))}%)</span>
        </div>
        <div className="pt-0.5 text-slate-500 font-semibold">
          মোট অংশগ্রহণ: {toBengaliDigits(total)} জন
        </div>
      </div>
    </div>
  );
};
