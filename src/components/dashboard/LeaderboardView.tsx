"use client";

import React, { useState, useEffect } from "react";
import { Exam } from "@/types/exam";
import { LeaderboardItem } from "@/types/submission";
import { LeaderboardExamSearch } from "@/components/leaderboard/LeaderboardExamSearch";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { fetchLeaderboard } from "@/actions/exam-actions";
import { parseBangladeshDateTime, isAnswerTimeReached } from "@/lib/bangladesh-time";
import { formatBangladeshDate, formatBangladeshClock, getLatestPublishedExamKey } from "@/lib/utils";

interface LeaderboardViewProps {
  exams: Record<string, Exam>;
  initialExamKey?: string;
}

function resolveExamKey(exams: Record<string, Exam>, idOrKey?: string): string | null {
  if (!idOrKey) return null;
  if (exams[idOrKey]) return idOrKey;
  for (const [k, ex] of Object.entries(exams)) {
    if (ex.id === idOrKey || k === idOrKey) return k;
  }
  return null;
}

export function LeaderboardView({ exams, initialExamKey }: LeaderboardViewProps) {
  const [activeExamKey, setActiveExamKey] = useState<string>(() => {
    const matched = resolveExamKey(exams, initialExamKey);
    if (matched) return matched;
    return getLatestPublishedExamKey(exams);
  });
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const matched = resolveExamKey(exams, initialExamKey);
    if (matched && matched !== activeExamKey) {
      setActiveExamKey(matched);
    } else if (!activeExamKey || !exams[activeExamKey]) {
      const best = matched || getLatestPublishedExamKey(exams);
      if (best) {
        setActiveExamKey(best);
      }
    }
  }, [exams, initialExamKey, activeExamKey]);

  const exam = exams[activeExamKey] || null;

  useEffect(() => {
    if (!activeExamKey) return;
    let isMounted = true;
    setIsLoading(true);

    fetchLeaderboard(activeExamKey)
      .then((res) => {
        if (isMounted) {
          setItems(res || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading leaderboard:", err);
        if (isMounted) {
          setItems([]);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeExamKey]);

  const isScheduled = !!(exam?.startTime && (exam?.endTime || exam?.leaderboardEndTime));
  const hasNoLeaderboard = exam ? !isScheduled : false;
  const isLocked = exam ? (isScheduled && !isAnswerTimeReached(exam)) : false;
  const endDate = exam?.endTime ? parseBangladeshDateTime(exam.endTime) : null;
  const dateStr = endDate
    ? `পরীক্ষা সমাপ্তি: ${formatBangladeshDate(endDate)} — ${formatBangladeshClock(endDate)}`
    : (isScheduled ? "শিক্ষক রিলিজ করার পর" : "অনুশীলন (প্র্যাকটিস) মেধা তালিকা");

  return (
    <div className="space-y-5 animate-in fade-in duration-200 font-bengali">
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200 space-y-5">
        <div className="space-y-3">

          <LeaderboardExamSearch
            exams={exams}
            activeExamKey={activeExamKey}
            onSelect={(key) => setActiveExamKey(key)}
          />
          {exam && (
            <div className="flex items-center gap-2 flex-wrap text-sm font-bold text-slate-600">
              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg">
                📁 {exam.course}
              </span>
              {exam.subject && (
                <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg">
                  {exam.subject}
                </span>
              )}
            </div>
          )}
        </div>

        <LeaderboardTable
          title={`${exam?.title || "পরীক্ষা"} - মেধা তালিকা`}
          items={items}
          isLoading={isLoading}
          isLocked={isLocked}
          noLeaderboard={hasNoLeaderboard}
          releaseDateText={dateStr}
          onPrint={() => window.print()}
        />
      </div>
    </div>
  );
}
