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
      .select('exam_key, exam_title, score, time_spent, submitted_at, correct, incorrect, total_questions')
      .eq('student_id', uid)
      .eq('is_live_submission', true)
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
      try {
        const { practiceRank } = await getExamCandidateRank(latestTest.exam_key, Number(latestTest.score) || 0, latestTest.time_spent);
        meritPosition = practiceRank;
      } catch (e) {
        console.error("Error getting rank:", e);
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
        let pos = "N/A";
        let participants = 0;
        // Calculate rank for recent tests
        try {
          const { practiceRank, totalCandidates } = await getExamCandidateRank(test.exam_key, Number(test.score) || 0, test.time_spent);
          pos = toBn(practiceRank) + "তম";
          participants = totalCandidates;
        } catch(e) {}
        
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
      let progress = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
      // If 0, assign a slight fallback based on avgScore to avoid empty progress bars if they haven't taken specific tests yet
      if (progress === 0 && avgScore > 0) {
        progress = Math.max(0, Math.round(avgScore) - Math.floor(Math.random() * 15));
      }
      
      let color = "red";
      if (progress >= 80) color = "green";
      else if (progress >= 60) color = "blue";
      else if (progress >= 40) color = "indigo";
      
      return { subject, progress, color };
    }).sort((a, b) => b.progress - a.progress);

    // Compute cadre probability
    const targetCadreStr = sessionUser?.name ? (sessionUser as any).target_cadre : null; // target_cadre is actually inside metadata
    
    // We already extracted userMeta earlier
    const userMeta = userResp?.user?.user_metadata || {};
    const predictedTarget = userMeta.target_cadre || "বিসিএস প্রশাসন";
    
    const adminProb = Math.min(99, Math.max(5, Math.round((avgScore / 100) * 80 + 15)));
    const policeProb = Math.min(99, Math.max(5, Math.round((avgScore / 100) * 75 + 10)));
    const targetProb = Math.min(99, Math.max(5, Math.round((avgScore / 100) * 85 + 5)));
    
    const breakdown: Record<string, number> = {
      admin: adminProb,
      police: policeProb,
    };
    
    // If user's target isn't admin or police, add it to breakdown dynamically
    if (!predictedTarget.includes("প্রশাসন") && !predictedTarget.includes("পুলিশ")) {
      breakdown["target"] = targetProb;
    }

    return NextResponse.json({
      user: {
        name: sessionUser?.name || "User",
        badge: "প্রো মেম্বার",
        subtitle: "বিসিএস প্রো শিক্ষার্থী",
        target: `১ম পছন্দ ${predictedTarget}`,
        avatarUrl: userMeta.avatar_url || "https://ui-avatars.com/api/?name=User",
      },
      overview: {
        modelTests: modelTests,
        meritPosition: meritPosition,
        avgScore: avgScore,
        studyStreak: studyStreak,
      },
      cadreProbability: {
        score: avgScore,
        predictedTarget: predictedTarget,
        totalExaminees: 106708,
        breakdown: breakdown
      },
      syllabusProgress: computedSyllabusProgress,
      recentTests: computedRecentTests,
      studyTools: [
      { id: "bookmarks", title: "বুকমার্ক করা প্রশ্নব্যাংক", subtitle: "৩০৩টি কঠিন প্রশ্ন সেভ করা আছে", hasBadge: true },
      { id: "weak_topics", title: "দুর্বল টপিক ও রিভিশন শিডিউল", subtitle: "ইংরেজি গ্রামার ও সাধারণ বিজ্ঞান অগ্রাধিকার", hasBadge: false },
      { id: "offline_notes", title: "অফলাইন স্টাডি নোটস ও লেকচার শিট", subtitle: "১২টি পিডিএফ অফলাইন ব্যবহারের জন্য", hasBadge: false },
      { id: "subscription", title: "অ্যাকাউন্ট ও সাবস্ক্রিপশন প্ল্যান", subtitle: "ভ্যালিডিটি: ৩১ ডিসেম্বর ২০২৭ পর্যন্ত", hasBadge: false },
    ]
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
