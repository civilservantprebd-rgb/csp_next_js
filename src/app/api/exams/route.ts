import { supabase } from "@/lib/supabase";
import { apiOk, withApi } from "@/lib/api-auth";
import { examToDto, rowToExam } from "@/lib/exam-api";
import { Exam } from "@/types/exam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/exams — সব পরীক্ষার হালকা তালিকা (শিরোনাম, কোর্স, বিষয়, সময়)।
 *
 * ── কেন `/api/exams/live`-ই যথেষ্ট নয় ──
 * ওটা কেবল **চলমান ও আসন্ন** পরীক্ষা দেয়। কিন্তু মেধা তালিকা মূলত শেষ হয়ে যাওয়া
 * পরীক্ষারই দেখা হয় — লাইভ চলাকালীন তালিকা তো লুকানোই থাকে (উত্তর-কী প্রকাশের
 * আগে কেউ র‍্যাংক পায় না)। তাই এখানে **সব** পরীক্ষা আসে, উইন্ডো-হিসাবসহ।
 *
 * ── যা কখনো আসে না ──
 * কেবল মেটাডেটা: প্রশ্ন, উত্তর, কারও স্কোর বা পরিচয় — একটাও নয়। ওয়েব অ্যাপের
 * `/leaderboard/[examId]` পেজও ঠিক এই কলামগুলোই (`EXAM_META_COLS`) ব্যবহার করে।
 *
 * `auth: "optional"` — ওয়েব লিডারবোর্ড পেজের মতো অতিথিও তালিকা দেখতে পারে;
 * মেধা তালিকা নিজেই আলাদা রাউট (`/api/exams/{id}/leaderboard`)।
 */
export const GET = withApi("optional", async () => {
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("exams")
    .select(
      "id, course, subject, title, timer_minutes, is_free, pass_mark, start_time, end_time, is_result_published, leaderboard_start_time, leaderboard_end_time"
    );

  if (error) {
    console.error("[api/exams] query error:", error);
    return apiOk({ total: 0, exams: [] });
  }

  const exams: Exam[] = [];
  for (const row of data || []) {
    const exam = rowToExam(row as Record<string, unknown>);
    if (!exam.id || !exam.title) continue;
    exams.push(exam);
  }

  // ── সময় অনুযায়ী: সাম্প্রতিক আগে ──
  // মেধা তালিকা দেখার উদ্দেশ্যেই তালিকাটা — যে পরীক্ষা এইমাত্র শেষ হলো, তার
  // র‍্যাংক সবচেয়ে দরকারি। যেসব পরীক্ষার সময়সূচিই নেই (সর্বদা-খোলা প্র্যাকটিস),
  // তারা সবার নিচে — কারণ ওদের "কোন সময়" বলে কিছু নেই।
  exams.sort((a, b) => {
    const at = examToDto(a, nowMs).startTimeMs;
    const bt = examToDto(b, nowMs).startTimeMs;
    if (at === null && bt === null) return (a.title || "").localeCompare(b.title || "", "bn");
    if (at === null) return 1;
    if (bt === null) return -1;
    return bt - at;
  });

  return apiOk({
    total: exams.length,
    exams: exams.map((e) => examToDto(e, nowMs)),
  });
});
