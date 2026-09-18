import { NextResponse } from 'next/server';
import { apiFail } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import { getExamCandidateRank } from '@/actions/exam-actions';
import { getSessionUserFromCookies } from '@/lib/teacher-auth';

export async function GET(req: Request) {
  let uid = null;

  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      uid = data.user.id;
    }
  }

  if (!uid) {
    const sessionUser = await getSessionUserFromCookies();
    uid = sessionUser?.id;
  }

  if (!uid) {
    // গাইড §৩.৩-এর এরর-চুক্তি `{ error: { code, message } }` — বিস্তারিত কারণ
    // `profile/route.ts`-এ লেখা (String-error হলে অ্যাপ সেটাকে ডেটা ভেবে ক্র্যাশ করত)।
    return apiFail(
      authHeader ? "TOKEN_INVALID" : "UNAUTHENTICATED",
      authHeader
        ? "টোকেনটি বৈধ নয় বা মেয়াদোত্তীর্ণ। অনুগ্রহ করে আবার লগইন করুন।"
        : "লগইন প্রয়োজন। অনুগ্রহ করে Google দিয়ে লগইন করুন।",
      401
    );
  }

  const { data } = await supabase
    .from('submissions')
    .select('exam_key, exam_title, score, time_spent, submitted_at, correct, incorrect, total_questions, is_pending_evaluation')
    .eq('student_id', uid)
    .order('submitted_at', { ascending: false });

  const toBn = (n: number | string) => n.toString().replace(/[0-9]/g, c => "০১২৩৪৫৬৭৮৯"[parseInt(c)]);
  let allTests: any[] = [];

  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      const test = data[i];
      let pos = test.is_pending_evaluation ? "অপেক্ষমান" : "N/A";
      let participants = 0;
      
      if (!test.is_pending_evaluation) {
        try {
          const { practiceRank, totalCandidates } = await getExamCandidateRank(test.exam_key, Number(test.score) || 0, test.time_spent);
          pos = toBn(practiceRank) + " তম";
          participants = totalCandidates;
        } catch(e) {}
      }
      
      let type = "মডেল টেস্ট";
      try {
        const { data: examData } = await supabase.from('exams').select('course').eq('id', test.exam_key).single();
        if (examData?.course) type = examData.course;
      } catch(e) {}
      
      let badge = "গড় মান";
      const tq = test.total_questions || 0;
      if (tq >= 200) { badge = "সকল বিষয়"; }
      else if (tq >= 50) { badge = "শীর্ষ স্কোর"; }

      let formattedDate = "N/A";
      if (test.submitted_at) {
        const d = new Date(test.submitted_at);
        formattedDate = d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
      }

      allTests.push({
        id: test.exam_key || i.toString(),
        title: test.exam_title || "মডেল টেস্ট",
        type: type,
        badge: badge,
        score: toBn(test.score || 0),
        totalScore: toBn(tq),
        position: pos,
        wrongAnswers: toBn(test.incorrect || 0) + "টি",
        participants: toBn(participants),
        timeTaken: test.time_spent || "N/A",
        date: formattedDate,
        // ── কোর্স অনুযায়ী গ্রুপ ও সময় অনুযায়ী সাজানোর জন্য কাঁচা তথ্য ──
        // আগে শুধু `type` (কোর্সের নাম, নামটা বিভ্রান্তিকর) আর `date`
        // (বাংলায় ফরম্যাট করা লেখা) যেত — ওই লেখা দিয়ে সাজানো যায় না, কারণ
        // "১৬ সেপ্টেম্বর" বনাম "৫ অক্টোবর"-এর তুলনা বর্ণানুক্রমে হয়।
        // তাই অ্যাপের জন্য স্পষ্ট `course` + কাঁচা epoch-ms পাঠানো হচ্ছে।
        course: type,
        submittedAtMs: test.submitted_at ? new Date(test.submitted_at).getTime() : 0,
      });
    }
  }

  return NextResponse.json({ results: allTests });
}
