import React from "react";
import LeaderboardClient from "./LeaderboardClient";
import { fetchLeaderboard } from "@/actions/exam-actions";
import { fetchExamMeta, fetchExamMetaList } from "@/actions/admin-actions";

export const revalidate = 60; // Cache for 60 seconds

export default async function LeaderboardPage({ params }: { params: { examId: string } }) {
  const [meta, list, items] = await Promise.all([
    fetchExamMeta(params.examId),
    fetchExamMetaList(),
    fetchLeaderboard(params.examId)
  ]);

  return (
    <LeaderboardClient
      initialAllExams={list}
      initialExam={meta}
      initialItems={items}
    />
  );
}
