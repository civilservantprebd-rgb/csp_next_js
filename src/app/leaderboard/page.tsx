import { redirect } from "next/navigation";
import { fetchExamMetaList } from "@/actions/admin-actions";
import { getLatestPublishedExamKey } from "@/lib/utils";

export const revalidate = 60;

export default async function LeaderboardIndexPage() {
  const allExams = await fetchExamMetaList();
  const latestKey = getLatestPublishedExamKey(allExams);
  redirect(`/leaderboard/${latestKey || "exam_01"}`);
}
