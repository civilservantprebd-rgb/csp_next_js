import { NextResponse } from 'next/server';
import { getSessionUserFromCookies } from '@/lib/teacher-auth';
import { apiFail } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import { getExamCandidateRank } from '@/actions/exam-actions';

export async function GET(req: Request) {
  let uid = null;
  let sessionUser: any = null;

  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      uid = data.user.id;
      sessionUser = { id: uid, name: data.user.user_metadata?.full_name || data.user.user_metadata?.name };
    }
  }

  if (!uid) {
    sessionUser = await getSessionUserFromCookies();
    uid = sessionUser?.id;
  }

  let modelTests = 0;
  let meritPosition = 0;
  let avgScore = 0;
  let studyStreak = 1; 

  if (uid) {
    // Streak logic using user_metadata
    const meta = sessionUser as any;
    const { data: userResp } = await supabase.auth.admin.getUserById(uid);
    if (userResp?.user) {
      const userMeta = userResp.user.user_metadata || {};
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      let lastDate = userMeta.lastStreakDate;
      let currentStreak = userMeta.studyStreak || 0;
      let updated = false;

      if (lastDate === today) {
        studyStreak = currentStreak;
      } else if (lastDate === yesterday) {
        studyStreak = currentStreak + 1;
        updated = true;
      } else {
        studyStreak = 1;
        updated = true;
      }

      if (updated) {
        await supabase.auth.admin.updateUserById(uid, {
          user_metadata: { ...userMeta, studyStreak: studyStreak, lastStreakDate: today }
        });
      }
    }

    const { data } = await supabase
      .from('submissions')
      .select('exam_key, exam_title, score, time_spent, submitted_at, correct, incorrect, total_questions, is_pending_evaluation')
      .eq('student_id', uid)
      .order('submitted_at', { ascending: false });

    // Compute Syllabus Progress dynamically from exam_titles
    let subjectScores: Record<string, { total: number, count: number }> = {
      "বাংলাদেশ বিষয়াবলি": { total: 0, count: 0 },
      "গাণিতিক যুক্তি ও মানসিক দক্ষতা": { total: 0, count: 0 },
      "বাংলা ভাষা ও সাহিত্য": { total: 0, count: 0 },
      "আন্তর্জাতিক বিষয়াবলি": { total: 0, count: 0 },
      "সাধারণ বিজ্ঞান ও তথ্যপ্রযুক্তি": { total: 0, count: 0 },
      "ইংরেজি ভাষা ও সাহিত্য": { total: 0, count: 0 },
    };

    let computedRecentTests: any[] = [];
    const toBn = (n: number | string) => n.toString().replace(/[0-9]/g, c => "০১২৩৪৫৬৭৮৯"[parseInt(c)]);

    if (data && data.length > 0) {
      modelTests = data.length;
      const totalScore = data.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
      avgScore = parseFloat((totalScore / modelTests).toFixed(1));
      
      const latestTest = data[0];
      if (!latestTest.is_pending_evaluation) {
        try {
          const { practiceRank } = await getExamCandidateRank(latestTest.exam_key, Number(latestTest.score) || 0, latestTest.time_spent);
          meritPosition = practiceRank;
        } catch (e) {
          console.error("Error getting rank:", e);
        }
      }

      // Group by subject based on exam_title
      data.forEach(sub => {
        const title = sub.exam_title || "";
        let pct = 0;
        if (sub.total_questions && sub.total_questions > 0) {
          pct = ((Number(sub.score) || 0) / sub.total_questions) * 100;
        } else {
          pct = Number(sub.score) || 0; // Fallback if no total_questions
        }

        if (title.includes("বাংলাদেশ")) { subjectScores["বাংলাদেশ বিষয়াবলি"].total += pct; subjectScores["বাংলাদেশ বিষয়াবলি"].count++; }
        else if (title.includes("গণিত") || title.includes("মানসিক")) { subjectScores["গাণিতিক যুক্তি ও মানসিক দক্ষতা"].total += pct; subjectScores["গাণিতিক যুক্তি ও মানসিক দক্ষতা"].count++; }
        else if (title.includes("বাংলা")) { subjectScores["বাংলা ভাষা ও সাহিত্য"].total += pct; subjectScores["বাংলা ভাষা ও সাহিত্য"].count++; }
        else if (title.includes("আন্তর্জাতিক")) { subjectScores["আন্তর্জাতিক বিষয়াবলি"].total += pct; subjectScores["আন্তর্জাতিক বিষয়াবলি"].count++; }
        else if (title.includes("বিজ্ঞান") || title.includes("কম্পিউটার") || title.includes("প্রযুক্তি")) { subjectScores["সাধারণ বিজ্ঞান ও তথ্যপ্রযুক্তি"].total += pct; subjectScores["সাধারণ বিজ্ঞান ও তথ্যপ্রযুক্তি"].count++; }
        else if (title.includes("ইংরেজি") || title.includes("English")) { subjectScores["ইংরেজি ভাষা ও সাহিত্য"].total += pct; subjectScores["ইংরেজি ভাষা ও সাহিত্য"].count++; }
      });

      // Build recentTests
      const recentThree = data.slice(0, 3);
      for (let i = 0; i < recentThree.length; i++) {
        const test = recentThree[i];
        let pos = test.is_pending_evaluation ? "অপেক্ষমান" : "N/A";
        let participants = 0;
        
        if (!test.is_pending_evaluation) {
          // Calculate rank for recent tests
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

        console.log('Sending type:', type);
        computedRecentTests.push({
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
        });
      }
    }

    // Prepare syllabusProgress array
    const computedSyllabusProgress = Object.entries(subjectScores).map(([subject, stats]) => {
      // ⚠️ পরীক্ষা না দিলে progress = ০ — **এটাই সত্য**, আর সেটাই পাঠানো হয়।
      //
      // ২০২৬-০৯-১৭: আগে এখানে `Math.random()` দিয়ে একটা সংখ্যা বানানো হতো
      // ("খালি বার দেখতে খারাপ লাগে" — কোডের নিজের কমেন্টে তাই লেখা ছিল)।
      // ফলে শিক্ষার্থী রিফ্রেশ করলেই একই বিষয়ে ৭২% → ৬৫% → ৭৯% পাল্টাত,
      // অথচ ওটা তার কোনো অগ্রগতিই ছিল না। মিথ্যা সংখ্যার চেয়ে খালি বার ভালো।
      const progress = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;

      let color = "red";
      if (progress >= 80) color = "green";
      else if (progress >= 60) color = "blue";
      else if (progress >= 40) color = "indigo";
      
      return { subject, progress, color };
    }).sort((a, b) => b.progress - a.progress);

    const userMeta = userResp?.user?.user_metadata || {};
    const predictedTarget = userMeta.target_cadre || null;

    // ⚠️ ২০২৬-০৯-১৭: এখানে আগে একটা **সম্পূর্ণ বানানো** "ক্যাডার সম্ভাবনা" ছিল —
    // `avgScore` থেকে সূত্র কষে (প্রশাসন = avgScore×০.৮+১৫) একটা শতাংশ, আর
    // `totalExaminees: 106708` নামের একটা যাদু সংখ্যা। ওটা কোনো ডেটা নয়,
    // কোনো মডেলও নয় — অথচ স্ক্রিনে "নিরাপদ জোন" লেখা সবুজ ব্যাজ সহ দেখানো হতো।
    // এখন বাদ: মিথ্যা ভবিষ্যদ্বাণীর চেয়ে কিছু না দেখানো অনেক ভালো।
    // (আসল ভবিষ্যদ্বাণী করতে হলে মডেল দরকার — সেটা আলাদা কাজ।)

    return NextResponse.json({
      user: {
        name: sessionUser?.name || null,
        // ⚠️ `badge` ("প্রো মেম্বার") আর `subtitle` ("বিসিএস প্রো শিক্ষার্থী")
        // ছিল hardcoded — কোনো ডেটার সাথে সম্পর্ক নেই। বাদ দেওয়া হলো।
        target: predictedTarget ? `১ম পছন্দ ${predictedTarget}` : null,
        // ⚠️ `ui-avatars.com`-এর বাইরের লিংক fallback ছিল — অ্যাপে সেটা
        // ডিকোড ব্যর্থ হয়ে ব্যতিক্রম ছুড়ত। এখন ছবি না থাকলে `null`।
        avatarUrl: userMeta.avatar_url || null,
      },
      overview: {
        modelTests: modelTests,
        meritPosition: meritPosition,
        avgScore: avgScore,
        studyStreak: studyStreak,
      },
      syllabusProgress: computedSyllabusProgress,
      recentTests: computedRecentTests,
    });
}
  // গাইড §৩.৩-এর এরর-চুক্তি: `{ error: { code, message } }`।
  // ⚠️ আগে ছিল `{ error: "Unauthorized" }` (String) — অ্যাপের ApiClient কেবল
  // `error` অবজেক্ট হলে এরর ধরে, তাই ওই বডিটা "সফল ডেটা" হয়ে স্ক্রিনে পৌঁছে
  // প্রোফাইল পেজ ভেঙে পড়ত (`type 'Null' is not a subtype of Map`)।
  // `TOKEN_INVALID` বনাম `UNAUTHENTICATED` ফারাকটা অ্যাপের জন্য জরুরি —
  // টোকেন ছিল কিন্তু অবৈধ হলে অ্যাপ রিফ্রেশ করে আবার চেষ্টা করে, টোকেনই না থাকলে
  // লগইন স্ক্রিন দেখায় ("Unauthorized" এক কোডে দুটোই মিলিয়ে যায়)।
  return apiFail(
    authHeader ? "TOKEN_INVALID" : "UNAUTHENTICATED",
    authHeader
      ? "টোকেনটি বৈধ নয় বা মেয়াদোত্তীর্ণ। অনুগ্রহ করে আবার লগইন করুন।"
      : "লগইন প্রয়োজন। অনুগ্রহ করে Google দিয়ে লগইন করুন।",
    401
  );
}
