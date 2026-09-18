import { NextResponse } from 'next/server';
import { getSessionUserFromCookies } from '@/lib/teacher-auth';
import { apiFail } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import { getExamCandidateRank } from '@/actions/exam-actions';
import { isAnswerTimeReached } from '@/lib/bangladesh-time';
import type { Exam } from '@/types/exam';

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
      // `is_live_submission` যোগ করা হলো: একই পরীক্ষা লাইভ আর প্র্যাকটিস —
      // দুইভাবে দেওয়া যায়, আর কোন স্কোরটা কোনটা সেটা এই কলাম ছাড়া বোঝার উপায় নেই
      // (ওয়েবের StudentDashboardModal-ও ঠিক এই ফিল্ডটাই দেখে)।
      .select('exam_key, exam_title, score, time_spent, submitted_at, correct, incorrect, total_questions, is_pending_evaluation, is_live_submission')
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
    // পরীক্ষাভিত্তিক ফলাফল-ইতিহাস ও তার সারসংক্ষেপ — সাবমিশন খালি থাকলে এই
    // ডিফল্টগুলোই ক্লায়েন্টে যায় (কনট্র্যাক্ট: `[]`, শূন্য-গণনা, `[]`)।
    let computedResultHistory: any[] = [];
    let computedResultSummary = { exams: 0, liveCount: 0, practiceCount: 0 };
    let computedResultCourses: string[] = [];
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

      // ── পরীক্ষাভিত্তিক ফলাফল-ইতিহাস: প্রতি exam_key-তে **একটাই** এন্ট্রি ──
      //
      // কেন গ্রুপ করা দরকার: একই পরীক্ষা একজন শিক্ষার্থী দুইবার দিতে পারে —
      // একবার নির্ধারিত লাইভ উইন্ডোতে (`is_live_submission = true`, লিডারবোর্ডে
      // গণ্য) আর পরে প্র্যাকটিস হিসেবে (`false`)। সাবমিশন টেবিলে ওগুলো দুইটা
      // আলাদা সারি, কিন্তু শিক্ষার্থীর কাছে সেটা **একেরই পরীক্ষা**। গ্রুপ না করলে
      // ইতিহাসে একই নাম দুইবার ওঠে আর কোনটা লাইভ বোঝার উপায় থাকে না — ওয়েবের
      // StudentDashboardModal-ও ঠিক এই কারণেই exam_key ধরে গ্রুপ করে
      // ("পরীক্ষার ইতিহাস" ট্যাবের liveSub/practiceSub)।
      const examKeys = Array.from(
        new Set(data.map((row: any) => row.exam_key).filter((k: any) => !!k))
      ) as string[];

      // কেন একটাই ব্যাচ-কোয়েরি (লুপে প্রতি সারির জন্য আলাদা কোয়েরি নয়):
      // আগের ধরনে প্রতি সাবমিশনের জন্য একটি `exams` কোয়েরি হতো (N+1) — ২০০
      // সাবমিশনে ২০০ রাউন্ড-ট্রিপ, আর অ্যাপ ঠিক এই রুটটাই সবচেয়ে বেশি ডাকে।
      // এখন সব exam_key একবারে `.in(...)` দিয়ে আনা হয়: মোট কোয়েরি সাবমিশন
      // সংখ্যা যতই হোক, স্থির।
      const examRowById = new Map<string, any>();
      if (examKeys.length > 0) {
        const { data: examRows } = await supabase
          .from('exams')
          // `isAnswerTimeReached`-এর জন্য timer_minutes + সময়সীমা (start_time /
          // end_time / leaderboard_end_time) আর ম্যানুয়াল-প্রকাশের
          // is_result_published দরকার — তাই আসল কলামগুলোই আনা হচ্ছে,
          // কোনো মান অনুমান করে বসানো হচ্ছে না।
          .select('id, course, subject, end_time, start_time, leaderboard_end_time, is_result_published, timer_minutes')
          .in('id', examKeys);

        (examRows || []).forEach((row: any) => {
          if (row?.id) examRowById.set(String(row.id), row);
        });
      }

      const historyByExam = new Map<string, any>();

      data.forEach((row: any) => {
        const examKey = String(row.exam_key ?? '').trim();
        // exam_key ছাড়া সারি কোনো পরীক্ষার সাথে মেলানোই যায় না — বাদ।
        if (!examKey) return;

        let entry = historyByExam.get(examKey);
        if (!entry) {
          const examRow = examRowById.get(examKey);

          // exam সারি না মিললে ফলাফল অপ্রকাশিত (false) — অজানা পরীক্ষার উত্তর
          // কী দেখানো নিরাপদ নয়।
          let isReleased = false;
          if (examRow) {
            const exam: Exam = {
              id: String(examRow.id ?? examKey),
              course: String(examRow.course ?? ''),
              subject: String(examRow.subject ?? ''),
              title: String(row.exam_title ?? ''),
              timerMinutes: Number(examRow.timer_minutes ?? 0) || 0,
              startTime: examRow.start_time || undefined,
              endTime: examRow.end_time || undefined,
              leaderboardEndTime: examRow.leaderboard_end_time || undefined,
              isResultPublished: examRow.is_result_published === true,
            };
            isReleased = isAnswerTimeReached(exam);
          }

          entry = {
            examKey: examKey,
            title: row.exam_title || "মডেল টেস্ট",
            course: examRow?.course ?? null,
            subject: examRow?.subject ?? null,
            // কোয়েরি `submitted_at DESC`-এ সাজানো, তাই এই পরীক্ষার **প্রথম যে
            // সারিটা সামনে পড়ছে সেটাই নতুনতম** — ওটার মান নিয়েই এন্ট্রি তৈরি,
            // পরে আসা পুরনো সারিগুলো আর এই ফিল্ড ছোঁয় না।
            totalQuestions: Number(row.total_questions ?? 0) || 0,
            lastSubmittedAt: row.submitted_at ?? null,
            isReleased: isReleased,
            liveScore: null,
            practiceScore: null,
          };
          historyByExam.set(examKey, entry);
        }

        // একই পরীক্ষার লাইভ ও প্র্যাকটিস **দুইটাই** থাকতে পারে — তাই দুইটাই
        // আলাদা ঘরে রাখা হয়। পুরনো সারিতে `is_live_submission` null বা একেবারে
        // অনুপস্থিত থাকতে পারে; কঠোরভাবে `true` না হলে প্র্যাকটিস ধরাই নিয়ম।
        if (row.is_live_submission === true) {
          if (entry.liveScore === null) entry.liveScore = Number(row.score ?? 0) || 0;
        } else {
          if (entry.practiceScore === null) entry.practiceScore = Number(row.score ?? 0) || 0;
        }
      });

      computedResultHistory = Array.from(historyByExam.values());

      // নতুনটাই আগে (`submitted_at` DESC), আর যাদের তারিখই নেই তারা সবার শেষে —
      // null তারিখ সরাসরি বিয়োগ করলে সাজানো এলোমেলো হয়ে যেত।
      const submissionTime = (value: string | null): number | null => {
        if (!value) return null;
        const t = new Date(value).getTime();
        return isNaN(t) ? null : t;
      };
      computedResultHistory.sort((a, b) => {
        const ta = submissionTime(a.lastSubmittedAt);
        const tb = submissionTime(b.lastSubmittedAt);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta;
      });

      // সারসংক্ষেপ: কতগুলো পরীক্ষা, তার মধ্যে কতগুলোয় লাইভ স্কোর আর কতগুলোয়
      // প্র্যাকটিস স্কোর আছে (দুইটাই একসাথে থাকলে দুই জায়গাতেই গোনা হয়)।
      computedResultSummary = {
        exams: computedResultHistory.length,
        liveCount: computedResultHistory.filter((e) => e.liveScore !== null).length,
        practiceCount: computedResultHistory.filter((e) => e.practiceScore !== null).length,
      };

      // অ্যাপের কোর্স-ফিল্টার ড্রপডাউনের জন্য: শুধু থাকা কোর্সগুলো, একবার করে,
      // বাংলা লোকেলে সাজানো।
      computedResultCourses = Array.from(
        new Set(
          computedResultHistory
            .map((e) => e.course)
            .filter((c: any): c is string => typeof c === 'string' && c.trim() !== '')
        )
      ).sort((a, b) => a.localeCompare(b, 'bn'));
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
      // অ্যাপের "পরীক্ষার ইতিহাস" তালিকা: প্রতি পরীক্ষায় একটাই সারি, আর
      // লাইভ/প্র্যাকটিস স্কোর আলাদা করে দেওয়া (ওয়েবের মডালের সমান অর্থ)।
      resultHistory: computedResultHistory,
      resultSummary: computedResultSummary,
      resultCourses: computedResultCourses,
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
