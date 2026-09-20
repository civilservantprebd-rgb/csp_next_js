import { NextRequest, NextResponse } from "next/server";
import { runAiImport } from "@/lib/ai-import-run";

/**
 * POST /api/ai/import — "যেকোনো ফরম্যাটের টেক্সট → সঠিক ফরম্যাট"।
 *
 * শুধু টেক্সট নেয় (`{ "text": "..." }`)। ছবি পাঠানোর সুবিধা বাদ দেওয়া হয়েছে,
 * কারণ সরাসরি ছবি → প্রশ্ন করতে গিয়ে ফল এলোমেলো আসছিল।
 *
 * কেন server action নয়: AI কল কয়েক সেকেন্ড নেয়, আর Vercel-এ ডিফল্ট ফাংশন
 * টাইমআউট ~১০ সেকেন্ড। route handler-এ `maxDuration` দিলে সেটা ওই ফাংশনের
 * জন্যই প্রযোজ্য হয় — server action-এ এটা নির্ভরযোগ্য নয়।
 */
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // SECURITY: কোটা-অপচয় আটকাতে শুধু ভেরিফায়েড শিক্ষক
    const { requireTeacher } = await import("@/lib/teacher-auth");
    await requireTeacher();
  } catch {
    return NextResponse.json({ success: false, error: "অনুমতি নেই — শিক্ষক হিসেবে লগইন করুন।" }, { status: 401 });
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "অনুরোধটি পড়া যায়নি।" }, { status: 400 });
  }

  try {
    const result = await runAiImport({
      text: typeof body?.text === "string" ? body.text : "",
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error("AI Import Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "AI দিয়ে সাজাতে সমস্যা হয়েছে।" },
      { status: 502 }
    );
  }
}
