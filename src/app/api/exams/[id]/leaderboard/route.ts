import { apiOk, withApi } from "@/lib/api-auth";
import { examToDto, loadExam } from "@/lib/exam-api";
import { isAnswerTimeReached } from "@/lib/bangladesh-time";
import { fetchLeaderboard } from "@/actions/exam-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/exams/{id}/leaderboard — API কন্ট্রাক্ট v1 #14 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * র্যাংকিং: স্কোর DESC, তারপর **কম সময়** আগে (টাই-ব্রেকার), তারপর নাম।
 * `fetchLeaderboard`-এর নিয়ম অপরিবর্তিত:
 *   • কেবল **নির্ধারিত** পরীক্ষারই অফিসিয়াল লিডারবোর্ড, আর কেবল উত্তর-প্রকाशনের পরে
 *   • কেবল `is_live_submission` সারিগুলো র‌্যাংক হয় (দেরিতে দেওয়া "প্র্যাকটিস"
 *     সাবমিশন কখনো র্যাংক পায় না)
 *   • PII: শিক্ষার্থীর আইডি ফোন-নম্বর — অন্যের কাছে শুধু শেষ ২ ডিজিট,
 *     নিজের সেশন হলে পুরোটা
 *
 * `auth: "optional"` — ওয়েব অ্যাপের মতো অতিথিও দেখতে পারে (নম্বর মাস্ক করা)।
 * নিজে লগইন থাকলে নিজের আইডি পুরো দেখা যায়।
 *
 * `exam` মেটাডেটা সাথে দেওয়া হয় যাতে অ্যাপ এক কলেই হেডার (শিরোনাম, পাস-মার্ক,
 * প্রকাশ-অবস্থা) আঁকতে পারে — পোলিং ১৫–৩০ সেকেন্ডে হলে প্রতি কলে দুই রাউন্ড-ট্রিপ
 * না লাগে।
 */
export const GET = withApi<RouteParams>("optional", async (_ctx, _req, routeCtx) => {
  const nowMs = Date.now();
  const exam = await loadExam(routeCtx.params?.id);
  const released = isAnswerTimeReached(exam);

  const entries = await fetchLeaderboard(exam.id);

  return apiOk({
    exam: examToDto(exam, nowMs),
    // `false` হলে অ্যাপ "ফলাফল প্রকাশিত হয়নি" দেখাবে — খালি টেবিল নয়।
    // (উভয় ক্ষেত্রেই entries = [], তাই এই ফ্ল্যাগটা ছাড়া অ্যাপ পার্থক্য করতে পারে না)
    isLeaderboardAvailable: released && entries.length > 0,
    isAnswersReleased: released,
    total: entries.length,
    entries: entries.map((e) => ({
      rank: e.rank,
      studentName: e.studentName,
      /** মাস্ক করা আইডি (যেমন "••••••42"); নিজের হলে পুরোটা */
      studentId: e.studentId,
      score: e.score,
      timeSpent: e.timeSpent,
      isPassed: e.isPassed,
    })),
  });
});
