import { redirect } from "next/navigation";

export default function LeaderboardPage({ params }: { params: { examId: string } }) {
  redirect(`/?nav=leaderboard&exam=${params.examId}`);
}
