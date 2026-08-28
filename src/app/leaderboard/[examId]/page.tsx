"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { fetchLeaderboard } from "@/actions/exam-actions";
import { fetchAppConfig } from "@/actions/admin-actions";
import { LeaderboardItem } from "@/types/submission";
import { Exam } from "@/types/exam";
import { parseBangladeshDateTime, isAnswerTimeReached } from "@/lib/bangladesh-time";

export default function StandaloneLeaderboardPage() {
  const params = useParams();
  const examId = params.examId as string;

  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAppConfig().then(async (config) => {
      const ex = config.exams?.[examId];
      if (ex) {
        setExam(ex);
        const data = await fetchLeaderboard(examId);
        setItems(data);
      }
      setIsLoading(false);
    });
  }, [examId]);

  const isLocked = exam ? !isAnswerTimeReached(exam) : false;
  const endDate = exam?.endTime ? parseBangladeshDateTime(exam.endTime) : null;
  const dateStr = endDate
    ? `পরীক্ষা সমাপ্তি: ${endDate.toLocaleString("bn-BD", {
        timeZone: "Asia/Dhaka",
        dateStyle: "medium",
        timeStyle: "short",
      })}`
    : "শিক্ষক রিলিজ করার পর";

  return (
    <>
      <Header />

      <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 font-bengali">
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-md border border-slate-200">
          <LeaderboardTable
            title={`${exam?.title || "পরীক্ষা"} - মেধা তালিকা`}
            items={items}
            isLoading={isLoading}
            isLocked={isLocked}
            releaseDateText={dateStr}
            onPrint={() => window.print()}
          />
        </div>
      </main>

      <Footer />
    </>
  );
}
