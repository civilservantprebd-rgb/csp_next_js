import { apiOk, withApi } from "@/lib/api-auth";
import { examToDto, loadExam } from "@/lib/exam-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/exams/{id} — API কন্ট্রাক্ট v1 #10 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * পরীক্ষার মেটাডেটা + উইন্ডো — **প্রশ্ন ছাড়া**। প্রশ্ন আলাদা রাউটে
 * (`/questions`), যাতে অ্যাপ উইন্ডো না খুললে প্রশ্নই না নামায় (ব্যান্ডউইথ বাঁচে,
 * আর লিক-পৃষ্ঠতল ছোট থাকে)।
 *
 * `auth: "optional"` — অতিথিও দেখতে পারে কোন পরীক্ষা কখন। এখানে কোনো প্রশ্ন,
 * উত্তর বা ফলাফল নেই — শুধু শিরোনাম, কোর্স, সময় ও পাস-মার্ক। উইন্ডো-লঙ্ঘনের
 * আসল প্রতিরোধ `/questions` ও `/submit`-এ; এখানে `canStart` কেবল অ্যাপের
 * "শুরু করুন" বোতাম সক্রিয়/নিষ্ক্রিয় করার UI-সূত্র।
 */
export const GET = withApi<RouteParams>("optional", async (_ctx, _req, routeCtx) => {
  const nowMs = Date.now();
  const exam = await loadExam(routeCtx.params?.id);
  const dto = examToDto(exam, nowMs);

  return apiOk({
    exam: dto,
    // কেবল **শুরুর আগে** শুরু করা যায় না।
    //
    // ⚠️ আগে `!dto.isClosed`-ও ছিল — অর্থাৎ সময় শেষ হলেই বোতাম নিষ্ক্রিয়।
    // কিন্তু ওয়েব তা করে না: উইন্ডো শেষ হওয়ার পরে দেওয়া পরীক্ষা ওখানে
    // "প্র্যাকটিস-প্রয়াস" হিসেবে চলে, আর লিডারবোর্ড কেবল লাইভ সারি গোনে
    // (`is_live_submission = true`) — তাই প্র্যাকটিস কারো র‍্যাংক ছোঁয় না।
    // উইন্ডো-হীন সর্বদা-খোলা পরীক্ষায়ও দুটোই false, তাই canStart = true।
    canStart: !dto.isUpcoming,
  });
});
