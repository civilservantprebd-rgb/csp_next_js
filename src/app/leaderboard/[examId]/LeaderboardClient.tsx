"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LeaderboardExamSearch } from "@/components/leaderboard/LeaderboardExamSearch";
import { fetchLeaderboard } from "@/actions/exam-actions";
import { fetchExamMeta, fetchExamMetaList } from "@/actions/admin-actions";
import { LeaderboardItem } from "@/types/submission";
import { Exam } from "@/types/exam";
import { parseBangladeshDateTime, isAnswerTimeReached } from "@/lib/bangladesh-time";
import { formatBangladeshDate, formatBangladeshClock } from "@/lib/utils";

export default function LeaderboardClient({
  initialAllExams,
  initialExam,
  initialItems
}: {
  initialAllExams: Record<string, Exam>;
  initialExam: Exam | null;
  initialItems: LeaderboardItem[];
}) {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [allExams, setAllExams] = useState<Record<string, Exam>>(initialAllExams);
  const [items, setItems] = useState<LeaderboardItem[]>(initialItems);
  const [exam, setExam] = useState<Exam | null>(initialExam);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectExam = (key: string) => {
    if (key === examId) return;
    router.replace(`/leaderboard/${key}`, { scroll: false });
  };

  const isScheduled = !!(exam?.startTime && (exam?.endTime || exam?.leaderboardEndTime));
  const hasNoLeaderboard = exam ? !isScheduled : false;
  const isLocked = exam ? (isScheduled && !isAnswerTimeReached(exam)) : false;
  const endDate = exam?.endTime ? parseBangladeshDateTime(exam.endTime) : null;
  const dateStr = endDate
    ? `পরীক্ষা সমাপ্তি: ${formatBangladeshDate(endDate)} — ${formatBangladeshClock(endDate)}`
    : (isScheduled ? "শিক্ষক রিলিজ করার পর" : "অনুশীলন (প্র্যাকটিস) মেধা তালিকা");

  return (
    <>
      <Header />

      <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 font-bengali">
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-md border border-slate-200 space-y-5">
          {/* Exam search — pick any course's any exam to see its rank */}
          <div className="space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">মেধা তালিকা দেখুন</h2>
              <p className="text-xs text-slate-500 font-semibold">
                আগে কোর্স বেছে নিন, তারপর পরীক্ষার নাম দিয়ে খুঁজুন — বিষয় দিয়েও খোঁজা যায়
              </p>
            </div>
            <LeaderboardExamSearch
              exams={allExams}
              activeExamKey={examId}
              onSelect={handleSelectExam}
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
      </main>

      <Footer />
    </>
  );
}
