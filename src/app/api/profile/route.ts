import { NextResponse } from 'next/server';
import { getSessionUserFromCookies } from '@/lib/teacher-auth';
import { apiFail, resolveStudentProfile } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import { getExamCandidateRank } from '@/actions/exam-actions';
import { isAnswerTimeReached, parseBangladeshDateTime } from '@/lib/bangladesh-time';
import { examToDto, rowToExam } from '@/lib/exam-api';
import { compareExamsByStartTime } from '@/lib/utils';
import type { Exam } from '@/types/exam';

/**
 * পরীক্ষার ইতিহাসের জন্য দরকারি কলামগুলো।
 *
 * `total_questions` পরীক্ষার সারিতে সব স্কিমায় নাও থাকতে পারে — তখন ওই কলাম
 * বাদ দিয়ে আবার চেষ্টা করা হয়। না করলে পুরো কোয়েরিটাই ব্যর্থ হয়ে তালিকা
 * খালি দেখাত, অথচ পরীক্ষাগুলো ঠিকই আছে (`api-auth.ts`-এর রোস্টার-কলামেও
 * ঠিক এই ফলব্যাক-নীতিই আছে)।
 */
const EXAM_COLS_FULL =
  'id, title, course, subject, start_time, end_time, leaderboard_end_time, is_result_published, timer_minutes, total_questions';
const EXAM_COLS_LITE =
  'id, title, course, subject, start_time, end_time, leaderboard_end_time, is_result_published, timer_minutes';

/**
 * কোন কলাম-সেটটা আসলে কাজ করে — একবার জেনে রাখা হয়।
 *
 * কারণ: স্কিমা প্রতি রিকোয়েস্টে বদলায় না, অথচ প্রোফাইল রুট অ্যাপ সবচেয়ে বেশি
 * ডাকে। মনে না রাখলে কলাম না-থাকা ডেটাবেসে প্রতিবার পুরো `exams` টেবিল **দুইবার**
 * টানতে হতো (একবার ব্যর্থ, একবার সফল)।
 */
let examColsForHistory: string | null = null;

/**
 * সব পরীক্ষা **এক ব্যাচে** — ওয়েবও পুরো `exams` টেবিলটাই লোড করে
 * (StudentDashboardModal-এ যাওয়া `exams` ম্যাপ), তাই এখানেও ঠিক তাই: প্রতি
 * পরীক্ষায় আলাদা কোয়েরি (N+1) নয়, আর সাবমিশন-ভিত্তিক `.in()` তালিকাও লাগে না
 * (শূন্য-তালিকার সমস্যাটাই নেই)।
 *
 * কোর্স-ফিল্টার SQL-এ না করে JS-এ করা হয়, কারণ ওয়েবের নিয়ম হলো trim +
 * lowercase মিলিয়ে দেখা আর `all`/`সকল কোর্স`-কে "সব মেলে" ধরা — SQL ফিল্টার
 * দিলে ওই নিয়মগুলো চুপচাপ ভিন্ন ফল দিত (স্পেস/বড়-ছোট অক্ষরের ফারাকে পরীক্ষা
 * হারিয়ে যেত)।
 */
async function loadExamRowsForHistory(): Promise<any[]> {
  // আগেই কোনটা চলে জানা থাকলে কেবল সেটাই — ব্যর্থ কোয়েরিটা দোহরানো হয় না।
  const candidates = examColsForHistory ? [examColsForHistory] : [EXAM_COLS_FULL, EXAM_COLS_LITE];
  for (const cols of candidates) {
    try {
      const { data, error } = await supabase.from('exams').select(cols);
      // কলাম-সেট না মিললে সংকীর্ণ সেটে চেষ্টা
      if (error) continue;
      examColsForHistory = cols;
      return ((data || []) as unknown) as any[];
    } catch {
      // পরের (সংকীর্ণ) কলাম-সেটে চেষ্টা
    }
  }
  return [];
}

export async function GET(req: Request) {
  let uid = null;
  let sessionUser: any = null;
  // কোর্স-তালিকা (allowed_students) খোঁজার জন্য ইমেইল দরকার — ওয়েবের
  // `checkEnrollmentCached`-ও ঠিক এই uid → ইমেইল ক্রমেই রোস্টার খোঁজে।
  let sessionEmail: string | null = null;

  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      uid = data.user.id;
      sessionEmail = data.user.email ?? null;
      sessionUser = { id: uid, name: data.user.user_metadata?.full_name || data.user.user_metadata?.name };
    }
  }

  if (!uid) {
    sessionUser = await getSessionUserFromCookies();
    uid = sessionUser?.id;
    sessionEmail = sessionUser?.email ?? null;
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

    const submissions: any[] = data || [];

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
    // পরীক্ষাভিত্তিক ফলাফল-ইতিহাস ও তার সারসংক্ষেপ — কোনো ডেটা না থাকলেও
    // ঠিক এই আকারেই ক্লায়েন্টে যায় (`[]` আর শূন্য-গণনা)।
    let computedResultHistory: any[] = [];
    let computedResultSummary = { exams: 0, liveCount: 0, practiceCount: 0, total: 0, taken: 0, notTaken: 0 };
    let computedResultCourses: string[] = [];
    const toBn = (n: number | string) => n.toString().replace(/[0-9]/g, c => "০১২৩৪৫৬৭৮৯"[parseInt(c)]);

    if (submissions.length > 0) {
      modelTests = submissions.length;
      const totalScore = submissions.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
      avgScore = parseFloat((totalScore / modelTests).toFixed(1));
      
      const latestTest = submissions[0];
      if (!latestTest.is_pending_evaluation) {
        try {
          const { practiceRank } = await getExamCandidateRank(latestTest.exam_key, Number(latestTest.score) || 0, latestTest.time_spent);
          meritPosition = practiceRank;
        } catch (e) {
          console.error("Error getting rank:", e);
        }
      }

      // Group by subject based on exam_title
      submissions.forEach(sub => {
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
      const recentThree = submissions.slice(0, 3);
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

    // ── পরীক্ষার ইতিহাস: কোর্সের **সব** পরীক্ষা — দেওয়া হোক বা না হোক ──
    //
    // কেন আর কেবল সাবমিশন থেকে নয়: শিক্ষার্থী এক নজরে দেখতে চায় কোনটা দিয়েছে
    // আর কোনটা **দেয়নি**। ওয়েবে ঠিক এই তালিকাই দেখানো হয় (StudentDashboardModal-এর
    // "পরীক্ষার ইতিহাস" ট্যাব, `examStatusList`), তাই অ্যাপেও একই অর্থ — সাবমিশন
    // একটাও না থাকলেও তালিকা খালি হয় না, কেবল সবগুলোতে `taken: false` থাকে।
    //
    // এই ব্লকটা `submissions.length > 0`-এর বাইরে: গার্ড হলো "শিক্ষার্থীর কোর্সের
    // তালিকা", সাবমিশন নয়।

    // ওয়েবের `studentCourses` কোথা থেকে আসে: StudentDashboardModal-এ প্রপ
    // হিসেবে আসে `checkEnrollmentCached(uid, email)` থেকে, আর সেটা ডাকে
    // `verifyStudentAccess(uid, "ALL", email)` — যা পড়ে `allowed_students.courses`
    // (প্রথমে uid দিয়ে, না মিললে ইমেইল দিয়ে)। সার্ভারেও ঠিক সেই একই টেবিল/কলাম
    // এবং একই uid → ইমেইল ক্রম `resolveStudentProfile` পড়ে, তাই অ্যাপ আর ওয়েব
    // একই কোর্স-তালিকা দেখে। `verifyStudentAccess`-কেই এখানে ডাকা হয়নি: মিল না
    // পেলে সেটা পুরো `allowed_students` স্ক্যান করে, আর প্রোফাইল রুটটাই অ্যাপ
    // সবচেয়ে বেশি ডাকে — ওই খরচটা এখানে বাড়ানো ঠিক নয়।
    const rosterProfile = await resolveStudentProfile({
      uid,
      email: sessionEmail || undefined,
      role: 'student',
    });
    const studentCourses = (rosterProfile?.courses || [])
      .map((c) => String(c || '').trim())
      .filter(Boolean);

    // সব পরীক্ষা এক ব্যাচে (হেল্পারটা উপরে) — প্রতি পরীক্ষায় আলাদা কোয়েরি নয়,
    // আর সাবমিশন-তালিকা খালি হলে `.in()` চালানোর প্রশ্নই ওঠে না।
    const examRows = await loadExamRowsForHistory();
    const examRowById = new Map<string, any>();
    const examById = new Map<string, Exam>();
    examRows.forEach((row: any) => {
      const id = String(row?.id ?? '').trim();
      if (!id) return;
      examRowById.set(id, row);
      // `rowToExam` দিয়েই সারি → Exam: একই ম্যাপিং সব রাউটে, আর
      // `isAnswerTimeReached`-এর জন্য `timerMinutes` ফাঁকা পড়ার ভয় নেই।
      examById.set(id, rowToExam(row));
    });

    const submittedKeys = new Set<string>();
    submissions.forEach((row: any) => {
      const key = String(row.exam_key ?? '').trim();
      // exam_key ছাড়া সারি কোনো পরীক্ষার সাথে মেলানোই যায় না — বাদ।
      if (key) submittedKeys.add(key);
    });

    // কোর্স-মেলানোর নিয়ম ওয়েবের সাথে হুবহু: কোর্স-তালিকা খালি হলে **সব** পরীক্ষা
    // মেলে, আর `all`/`সকল কোর্স` লেখা এন্ট্রিও সব মেলে। তুলনা trim + lowercase,
    // নাহলে কোর্সের বাড়তি স্পেস বা হাতের লেখা বড়-ছোট অক্ষরে পরীক্ষা হারিয়ে যেত।
    const matchesStudentCourse = (course: unknown): boolean => {
      if (studentCourses.length === 0) return true;
      const examCourse = String(course ?? '').trim().toLowerCase();
      return studentCourses.some((c) => {
        const sc = String(c || '').trim().toLowerCase();
        return sc === 'all' || sc === 'সকল কোর্স' || sc === examCourse;
      });
    };

    const allExamIds = Array.from(examById.keys());
    const myCourseExamIds = allExamIds.filter((id) => matchesStudentCourse(examById.get(id)?.course));
    const myCourseIdSet = new Set(myCourseExamIds);
    // কোর্সের বাইরের কোনো পরীক্ষা দিয়ে থাকলে সেটাও তালিকায় থাকবে — নাহলে
    // "দেওয়া হয়েছে" সংখ্যাটা ভুল দেখাত (ওয়েবের `alsoTaken` ঠিক এটাই করে)।
    const alsoTakenIds = allExamIds.filter((id) => submittedKeys.has(id) && !myCourseIdSet.has(id));
    // সাবমিশন আছে কিন্তু পরীক্ষার সারি আর নেই (শিক্ষক পরীক্ষাটা মুছে ফেলেছেন) —
    // এন্ট্রিটা বাদ দেওয়া হয় না, নাহলে ইতিহাস থেকে ফলাফল হঠাৎ উধাও হয়ে যেত
    // (আগের আচরণও এটাই ছিল: fail-closed `isReleased: false` নিয়ে এন্ট্রি থাকত)।
    const orphanTakenIds = Array.from(submittedKeys).filter((id) => !examById.has(id));

    // একই পরীক্ষার লাইভ ও প্র্যাকটিস **দুইটাই** থাকতে পারে (দুই সারি), কিন্তু
    // শিক্ষার্থীর কাছে সেটা একটাই পরীক্ষা — তাই exam_key ধরে এক এন্ট্রি (ওয়েবের
    // liveSub/practiceSub-ও ঠিক এই কারণেই গ্রুপ করে)। ক্রম `submitted_at DESC`,
    // তাই প্রথম যে সারিটা সামনে পড়ছে সেটাই নতুনতম — ওটার মান নিয়েই এন্ট্রি।
    const submissionInfoByExam = new Map<string, any>();
    submissions.forEach((row: any) => {
      const examKey = String(row.exam_key ?? '').trim();
      if (!examKey) return;

      let info = submissionInfoByExam.get(examKey);
      if (!info) {
        info = {
          title: row.exam_title || "মডেল টেস্ট",
          totalQuestions: Number(row.total_questions ?? 0) || 0,
          lastSubmittedAt: row.submitted_at ?? null,
          liveScore: null,
          practiceScore: null,
        };
        submissionInfoByExam.set(examKey, info);
      }

      // পুরনো সারিতে `is_live_submission` null বা একেবারে অনুপস্থিত থাকতে পারে;
      // কঠোরভাবে `true` না হলে প্র্যাকটিস ধরাই নিয়ম।
      if (row.is_live_submission === true) {
        if (info.liveScore === null) info.liveScore = Number(row.score ?? 0) || 0;
      } else {
        if (info.practiceScore === null) info.practiceScore = Number(row.score ?? 0) || 0;
      }
    });

    // কনট্র্যাক্ট "ISO string বা null": ডেটাবেসে সময় "YYYY-MM-DD HH:mm" আকারেও
    // থাকতে পারে, তাই শেয়ার্ড পার্সার দিয়ে পার্স করে canonical ISO বানানো হয়।
    const toIsoOrNull = (value: unknown): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseBangladeshDateTime(String(value));
      return parsed ? parsed.toISOString() : null;
    };

    const nowMs = Date.now();
    const historyByExam = new Map<string, any>();

    // ওয়েবের `examStatusList = [...myCourseExams, ...alsoTaken]` — একই ক্রমে,
    // একই ডিডুপ (Map হওয়ায় একই exam id দুইবার ঢুকলেও এন্ট্রি একটাই)।
    [...myCourseExamIds, ...alsoTakenIds, ...orphanTakenIds].forEach((examId) => {
      const examRow = examRowById.get(examId);
      const exam = examById.get(examId);
      const info = submissionInfoByExam.get(examId);
      const taken = !!info;

      // ⚠️ fail-closed: পরীক্ষার সারি না মিললে ফলাফল অপ্রকাশিত (false) — অজানা
      // পরীক্ষার উত্তর কী দেখানো নিরাপদ নয়। বাকি সব ক্ষেত্রে আগের মতোই
      // `isAnswerTimeReached` (ম্যানুয়াল publish বা সময়-পেরোনো হলে true), আর
      // ততক্ষণ কোনো লাইভ/প্র্যাকটিস স্কোর কখনো প্রকাশ পায় না —না-দেওয়া
      // পরীক্ষার দুটোই `null`, তাই লুকোবার মতো কিছুই নেই।
      const isReleased = exam ? isAnswerTimeReached(exam) : false;

      // `canStart`: `/api/exams/{id}`-এর সাথে হুবহু একই হিসাব — `examToDto`-র
      // `isUpcoming` (কেবল **শুরুর আগে** শুরু করা যায় না; উইন্ডো শেষ হওয়া বা
      // উইন্ডো-হীন প্র্যাকটিসে true)। পরীক্ষার সারিটাই নেই মানে সেটা আর নেই,
      // তাই ওখানকার 404-এর সাথে মিলিয়ে false।
      const canStart = exam ? !examToDto(exam, nowMs).isUpcoming : false;

      historyByExam.set(examId, {
        examKey: examId,
        title: info?.title || examRow?.title || "মডেল টেস্ট",
        course: examRow?.course ?? null,
        subject: examRow?.subject ?? null,
        // না-দেওয়া পরীক্ষায় সাবমিশনের সারিই নেই, তাই মোট প্রশ্ন আসে পরীক্ষার
        // সারি থেকে; দেওয়া পরীক্ষায় আগের মতোই সাবমিশনের মানটাই থাকে।
        totalQuestions: taken ? info.totalQuestions : (Number(examRow?.total_questions ?? 0) || 0),
        lastSubmittedAt: info?.lastSubmittedAt ?? null,
        isReleased: isReleased,
        liveScore: info?.liveScore ?? null,
        practiceScore: info?.practiceScore ?? null,
        // অ্যাপের নতুন কী: সময়সূচি (ISO/null), দেওয়া হয়েছে কি না, আর এখন
        // শুরু করা যাবে কি না — সবই পরীক্ষার সারি থেকে; কোনো স্কোর নয়।
        startTime: toIsoOrNull(examRow?.start_time),
        endTime: toIsoOrNull(examRow?.end_time),
        taken: taken,
        canStart: canStart,
      });
    });

    computedResultHistory = Array.from(historyByExam.values());

    // ক্রম: **নতুন শুরুর আগে**, আর সময়-হীন (সবসময়-খোলা) পরীক্ষা সবার শেষে।
    // তারিখ-তুলনার মূল অংশটা শেয়ার্ড `compareExamsByStartTime`-ই করে (নিজের
    // আলাদা ফরম্যাট-পার্সিং নয়), আর parser-ও ওটাই ব্যবহার করে।
    //
    // ⚠️ কেন কেবল `compareExamsByStartTime(b, a)` লিখেই ছাড়া হলো না: উল্টো
    // ক্রমে ডাকলে ওই ফাংশনের null-নিয়মও উল্টে যায় — অর্থাৎ সময়-হীন পরীক্ষা
    // সবার **আগে** চলে আসে (ওয়েবের মডালের `...b, a` কলটাতেও তাই ঘটে), অথচ
    // `/api/exams`-সহ অ্যাপের বাকি সব তালিকায় সময়-হীন পরীক্ষা সবার শেষে।
    // তাই null নিজে সামলানো হচ্ছে; সময়সহ দুটো এন্ট্রির তুলনা আগের মতোই শেয়ার্ড
    // ফাংশনের হাতে (সমান সময়ে নামের ক্রমও ওটাই দেয়)।
    const examForSort = (entry: any): Exam => {
      const exam = examById.get(String(entry?.examKey ?? ''));
      if (exam) return exam;
      // মুছে ফেলা পরীক্ষা: সময় নেই, তাই নিয়ম অনুযায়ী সবার শেষে যাবে।
      return {
        id: String(entry?.examKey ?? ''),
        course: String(entry?.course ?? ''),
        subject: String(entry?.subject ?? ''),
        title: String(entry?.title ?? ''),
        timerMinutes: 0,
        startTime: entry?.startTime ?? undefined,
      };
    };
    const startMsOf = (entry: any): number | null => {
      const startTime = examForSort(entry).startTime;
      if (!startTime) return null;
      const parsed = parseBangladeshDateTime(String(startTime));
      return parsed ? parsed.getTime() : null;
    };
    computedResultHistory.sort((a, b) => {
      const ta = startMsOf(a);
      const tb = startMsOf(b);
      if (ta === null && tb === null) return compareExamsByStartTime(examForSort(a), examForSort(b));
      if (ta === null) return 1;
      if (tb === null) return -1;
      return compareExamsByStartTime(examForSort(b), examForSort(a));
    });

    const takenCount = computedResultHistory.filter((e) => e.taken === true).length;

    // সারসংক্ষেপ: মোট কতগুলো পরীক্ষা, তার মধ্যে দেওয়া/না-দেওয়া কতগুলো, আর
    // কতগুলোয় লাইভ ও কতগুলোয় প্র্যাকটিস স্কোর আছে (দুইটাই থাকলে দুই জায়গাতেই)।
    computedResultSummary = {
      exams: computedResultHistory.length,
      liveCount: computedResultHistory.filter((e) => e.liveScore !== null).length,
      practiceCount: computedResultHistory.filter((e) => e.practiceScore !== null).length,
      total: computedResultHistory.length,
      taken: takenCount,
      notTaken: computedResultHistory.length - takenCount,
    };

    // অ্যাপের কোর্স-ফিল্টার ড্রপডাউনের জন্য: **পুরো ইতিহাসে** থাকা কোর্সগুলো,
    // একবার করে, বাংলা লোকেলে সাজানো (না-দেওয়া পরীক্ষার কোর্সও তাই ওঠে)।
    computedResultCourses = Array.from(
      new Set(
        computedResultHistory
          .map((e) => e.course)
          .filter((c: any): c is string => typeof c === 'string' && c.trim() !== '')
      )
    ).sort((a, b) => a.localeCompare(b, 'bn'));

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
