import { apiFail, apiOk, readJsonBody, requireStudent, withApi } from "@/lib/api-auth";
import { submitEnrollRequest } from "@/actions/enroll-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { courseName: string };
}

/**
 * POST /api/courses/{courseName}/enroll — API কন্ট্রাক্ট v1 #7 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * বডি: `{ "name": string, "trxId": string, "coupon"?: string }`
 *
 * এনরোলমেন্ট রিকোয়েস্ট (bKash/Nagad TRX আইডি সহ) — শিক্ষক পরে হাতে যাচাই করে
 * অনুমোদন দেন। **অ্যাপে কোনো পেমেন্ট গেটওয়ে নেই** (গাইড §২-এর scope-এর বাইরে),
 * এবং থাকবেও না — Play নীতিমালার ঝুঁকি এড়াতে ম্যানুয়াল TRX-ই থাকল।
 *
 * SECURITY: `uid`/`email` কখনো বডি থেকে নেওয়া হয় না — সেশন থেকেই যায়।
 * `submitEnrollRequest` নিজেও এই নিয়ম মানে (নাহলে যে কেউ অন্যের নামে রিকোয়েস্ট
 * ফাইল করে শিক্ষকের ইনবক্স ভরিয়ে দিতে পারত)। ডুপ্লিকেট TRX এবং এক-ঘণ্টার
 * রেট-লিমিট অপরিবর্তিত।
 */
export const POST = withApi<RouteParams>("student", async (ctx, req, routeCtx) => {
  const identity = requireStudent(ctx);

  const raw = String(routeCtx.params?.courseName ?? "");
  let course = raw;
  try {
    course = decodeURIComponent(raw);
  } catch {
    course = raw;
  }
  course = course.trim();

  if (!course) {
    return apiFail("BAD_REQUEST", "কোর্সের নাম প্রয়োজন।", 400);
  }

  const body = await readJsonBody(req);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const trxId = typeof body?.trxId === "string" ? body.trxId.trim() : "";
  const coupon = typeof body?.coupon === "string" ? body.coupon.trim() : "";

  if (!name || !trxId) {
    return apiFail("BAD_REQUEST", "নাম ও ট্রানজেকশন আইডি (TrxID) দুটোই প্রয়োজন।", 400);
  }

  const res = await submitEnrollRequest({
    uid: identity.uid,
    email: identity.email || "",
    name,
    course,
    trxId,
    coupon: coupon || undefined,
  });

  if (!res.success) {
    // "ইতিমধ্যে এনরোল করা" / "ডুপ্লিকেট TRX" — ব্যবসায়িক প্রত্যাখ্যান, ত্রুটি নয়।
    // অ্যাপ `message` দেখাবে; আলাদা কোড দিলে অ্যাপ স্ক্রিন বাছতে পারে।
    const already = /ইতিমধ্যে|আবার রিকোয়েস্ট/.test(res.message || "");
    return apiFail(already ? "ALREADY_ENROLLED_OR_PENDING" : "ENROLL_FAILED", res.message, already ? 409 : 400);
  }

  return apiOk({ submitted: true, course, message: res.message }, 201);
});
