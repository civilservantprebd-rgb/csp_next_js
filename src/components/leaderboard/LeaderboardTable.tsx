"use client";

import React from "react";
import { LeaderboardItem } from "@/types/submission";
import { Trophy, Printer, Clock, Medal } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

interface LeaderboardTableProps {
  title: string;
  items: LeaderboardItem[];
  isLoading?: boolean;
  isLocked?: boolean;
  noLeaderboard?: boolean;
  releaseDateText?: string;
  onPrint?: () => void;
}

/**
 * মেধা তালিকা — রেসপন্সিভ।
 * মোবাইল (< sm): পরিচ্ছন্ন কার্ড-লিস্ট (র‍্যাংক মেডেল + নাম + পাস/ফেইল + সময় + বড় স্কোর)।
 * ডেস্কটপ/প্রিন্ট (>= sm): পুরোনো টেবিল (5 কলাম)।
 * ফলাফল যত বড়ই হোক — কার্ডে ভিড় নেই, নাম ভাঙে না, স্কোর স্পষ্ট।
 */

const TOP_STYLES: Record<number, { card: string; circle: string }> = {
  0: {
    card: "bg-gradient-to-r from-amber-50 to-yellow-50/60 border-amber-300",
    circle: "bg-amber-400 text-amber-950",
  },
  1: {
    card: "bg-gradient-to-r from-slate-50 to-slate-100/70 border-slate-300",
    circle: "bg-slate-300 text-slate-900",
  },
  2: {
    card: "bg-gradient-to-r from-orange-50 to-amber-50/60 border-orange-300",
    circle: "bg-orange-500 text-white",
  },
};

function rankCircle(idx: number): string {
  return TOP_STYLES[idx]?.circle || "bg-indigo-50 text-indigo-700 border border-indigo-200";
}

function rankCard(idx: number): string {
  return TOP_STYLES[idx]?.card || "bg-white border-slate-200";
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  title,
  items,
  isLoading = false,
  isLocked = false,
  noLeaderboard = false,
  releaseDateText = "নির্ধারিত সময়ে",
  onPrint,
}) => {
  if (noLeaderboard) {
    return (
      <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-slate-200 font-bengali">
        <div className="max-w-md mx-auto space-y-2">
          <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-1" />
          <h4 className="font-bold text-slate-700 text-base sm:text-lg">এই পরীক্ষার জন্য লিডারবোর্ড নেই</h4>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            লিডারবোর্ড শুধুমাত্র নির্ধারিত সময়ে (লাইভ) অনুষ্ঠিত পরীক্ষার জন্য। লাইভ সময়ের বাইরে দেওয়া পরীক্ষার ফলাফল পরীক্ষা শেষে এবং স্টুডেন্ট পোর্টালে দেখা যাবে।
          </p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="p-8 text-center bg-amber-50/60 rounded-2xl border border-amber-200 font-bengali">
        <div className="max-w-md mx-auto space-y-2">
          <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-1" />
          <h4 className="font-bold text-slate-800 text-base sm:text-lg">মার্ক্স এখনও প্রকাশিত হয়নি</h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            শিক্ষক কর্তৃক পরীক্ষার ফলাফল এখনও রিলিজ করা হয়নি। শিক্ষক ফলাফল প্রকাশ করার সাথে সাথেই মেধা তালিকা ও সকল শিক্ষার্থীর প্রাপ্ত নম্বর এখানে প্রদর্শিত হবে।
          </p>
        </div>
      </div>
    );
  }

  const rankNumber = (idx: number) =>
    idx === 0 ? (
      <span className="flex items-center gap-0.5">
        <Medal className="w-3 h-3" /> ১
      </span>
    ) : (
      toBengaliDigits(idx + 1)
    );

  return (
    <div className="space-y-4 font-bengali">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> {title}
          </h3>
          <p className="text-xs text-slate-500">সর্বোচ্চ স্কোর এবং কম সময়ে পরীক্ষার্থীদের র‍্যাংকিং</p>
        </div>
        {onPrint && (
          <button
            onClick={onPrint}
            className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-4 py-2 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" /> প্রিন্ট করুন
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm shadow-sm">
          ডেটা লোড হচ্ছে...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm shadow-sm">
          এই পরীক্ষায় এখনো কেউ অংশগ্রহণ করেনি।
        </div>
      ) : (
        <>
          {/* ── মোবাইল: পরিচ্ছন্ন কার্ড-লিস্ট ─────────────────────────────── */}
          <div className="sm:hidden space-y-2.5">
            {items.map((sub, idx) => (
              <div
                key={`${sub.studentId || sub.studentName}-${idx}`}
                className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm ${rankCard(idx)}`}
              >
                {/* র‍্যাংক */}
                <div
                  className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-black text-xs ${rankCircle(idx)}`}
                >
                  {rankNumber(idx)}
                </div>

                {/* নাম + স্ট্যাটাস */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm leading-snug break-words">
                    {sub.studentName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        sub.isPassed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {sub.isPassed ? "পাস" : "ফেইল"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      <Clock className="w-3 h-3" /> {sub.timeSpent}
                    </span>
                  </div>
                </div>

                {/* স্কোর */}
                <div className="text-right shrink-0">
                  <p className="text-xl font-black text-indigo-700 leading-none">
                    {toBengaliDigits(sub.score)}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">স্কোর</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── ডেস্কটপ / প্রিন্ট: টেবিল ─────────────────────────────────── */}
          <div
            id="printable-leaderboard"
            className="hidden sm:block overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm"
          >
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="p-3 font-semibold w-12 text-center">#</th>
                  <th className="p-3 font-semibold">শিক্ষার্থীর নাম</th>
                  <th className="p-3 font-semibold text-center">স্ট্যাটাস</th>
                  <th className="p-3 font-semibold text-center">সময়</th>
                  <th className="p-3 font-semibold text-right">স্কোর</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sub, idx) => (
                  <tr
                    key={`${sub.studentId || sub.studentName}-${idx}`}
                    className={`border-b border-slate-100 transition ${
                      idx === 0 ? "bg-amber-50/50" : idx === 1 ? "bg-slate-50/60" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="p-3 text-center font-bold text-slate-700">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center gap-1 bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-full text-xs">
                          <Medal className="w-3 h-3" /> ১
                        </span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center gap-1 bg-slate-300 text-slate-900 font-bold px-2.5 py-1 rounded-full text-xs">
                          <Medal className="w-3 h-3" /> ২
                        </span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center gap-1 bg-amber-600 text-white font-bold px-2.5 py-1 rounded-full text-xs">
                          <Medal className="w-3 h-3" /> ৩
                        </span>
                      ) : (
                        toBengaliDigits(idx + 1)
                      )}
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{sub.studentName}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          sub.isPassed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {sub.isPassed ? "পাস" : "ফেইল"}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-500 font-mono text-xs">{sub.timeSpent}</td>
                    <td className="p-3 text-right font-black text-indigo-700">{toBengaliDigits(sub.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
