import { supabase } from "@/lib/supabase";
import { apiOk, withApi } from "@/lib/api-auth";
import { examToDto, rowToExam } from "@/lib/exam-api";
import { Exam } from "@/types/exam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/exams/live — API কন্ট্রাক্ট v1 #9 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * চলমান ও আসন্ন পরীক্ষার তালিকা — সার্ভার-হিসাব করা উইন্ডোসহ।
 *
 * ছোট কিন্তু ইচ্ছাকৃত বিচ্যুতি: গাইড §6.1 #9-এ auth চিহ্নিত ছিল ✅ (বাধ্যতামূলক),
 * কিন্তু এখানে `"optional"` রাখা হয়েছে — কারণ ওয়েব অ্যাপ ল্যান্ডিং পেজে অতিথিকেও
 * পরীক্ষার তালিকা দেখায়, আর অ্যাপে লগইনের আগে "কী কী পরীক্ষা আছে" না দেখালে
 * নতুন শিক্ষার্থী নিবন্ধনই করবে না। নিরাপত্তা-ঝুঁকি নেই: এখানে কোনো প্রশ্ন বা
 * উত্তর আসে না, শুধু শিরোনাম ও সময়।
 */
export const GET = withApi("optional", async () => {
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("exams")
    .select(
      "id, course, subject, title, timer_minutes, is_free, pass_mark, start_time, end_time, is_result_published, leaderboard_start_time, leaderboard_end_time"
    );

  if (error) {
    console.error("[api/exams/live] query error:", error);
    return apiOk({ liveExams: [], upcomingExams: [] });
  }

  const live: Exam[] = [];
  const upcoming: Exam[] = [];

  for (const row of data || []) {
    const exam = rowToExam(row as Record<string, unknown>);
    if (!exam.id || !exam.title) continue;
    const dto = examToDto(exam, nowMs);
    // উইন্ডো নেই = সর্বদা-খোলা প্র্যাকটিস পরীক্ষা → "আসন্ন" নয়, উপেক্ষা
    if (dto.startTimeMs === null || dto.endTimeMs === null) continue;
    if (dto.isLive) live.push(exam);
    else if (dto.isUpcoming) upcoming.push(exam);
  }

  // যে পরীক্ষা আগে শেষ হবে সেটা আগে
  live.sort(
    (a, b) =>
      (examToDto(a, nowMs).endTimeMs ?? 0) - (examToDto(b, nowMs).endTimeMs ?? 0)
  );
  // যে পরীক্ষা আগে শুরু হবে সেটা আগে
  upcoming.sort(
    (a, b) =>
      (examToDto(a, nowMs).startTimeMs ?? 0) - (examToDto(b, nowMs).startTimeMs ?? 0)
  );

  return apiOk({
    liveExams: live.map((e) => examToDto(e, nowMs)),
    upcomingExams: upcoming.map((e) => examToDto(e, nowMs)),
  });
});
