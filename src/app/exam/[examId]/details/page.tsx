import React from "react";
import { getExamDetailedHubData } from "@/actions/exam-actions";
import ExamDetailsClient from "./ExamDetailsClient";

export default async function ExamDetailsPage({
  params
}: {
  params: { examId: string };
}) {
  const examId = decodeURIComponent(params?.examId || "");
  const initialData = await getExamDetailedHubData(examId);

  return <ExamDetailsClient examId={examId} initialData={initialData} />;
}
