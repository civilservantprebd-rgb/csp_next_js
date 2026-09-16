import {
  apiFail,
  apiOk,
  profileToDto,
  readJsonBody,
  requireStudent,
  resolveStudentProfile,
  withApi,
} from "@/lib/api-auth";
import { syncStudentLogin } from "@/actions/student-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/student/sync-login — API কন্ট্রাক্ট v1 #3 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * নাম/ছবি বদলালে বা লগইনের পর প্রোফাইল রোস্টারে সিঙ্ক করতে।
 * বডি: `{ "name"?: string, "photoURL"?: string }` (দুটোই ঐচ্ছিক)।
 *
 * SECURITY: uid ও email **কখনো** বডি থেকে নেওয়া হয় না — দুটোই যাচাই করা
 * সেশন-টোকেন থেকে আসে। `syncStudentLogin` নিজেও এই নিয়ম মানে (ক্লায়েন্টের পাঠানো
 * ইমেইল দিয়ে `allowed_students.email` বদলানো যাবে না, কারণ ওটাই পরিচয়ের ভিত্তি)।
 */
export const POST = withApi("student", async (ctx, req) => {
  const identity = requireStudent(ctx);
  const body = await readJsonBody(req);

  const rawName = typeof body?.name === "string" ? body.name.trim() : "";
  const name = rawName || identity.name || "শিক্ষার্থী";
  const photoURL = typeof body?.photoURL === "string" ? body.photoURL.trim() : "";

  const res = await syncStudentLogin({
    uid: identity.uid,
    name,
    email: identity.email || "",
    photoURL,
  });

  if (!res?.success) {
    // সাধারণত DB/RLS সমস্যা — অ্যাপ এখানে লগইন আটকাবে না, শুধু জানাবে
    return apiFail("SYNC_FAILED", "প্রোফাইল সিঙ্ক করা যায়নি। আবার চেষ্টা করুন।", 502);
  }

  const profile = await resolveStudentProfile(identity);
  return apiOk({ synced: true, ...profileToDto(profile) });
});
