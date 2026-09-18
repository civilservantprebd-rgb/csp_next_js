"use server";

import { supabase } from "@/lib/supabase";
import { AppConfigData } from "@/types/exam";
import { requireTeacher } from "@/lib/teacher-auth";

export interface AdminAnalyticsData {
  totalStudents: number;
  totalEnrollments: number;
  courseEnrollmentMap: Record<string, number>;
  totalSubmissions: number;
  examSubmissionMap: Record<string, { title: string; count: number; course: string }>;
  teacherQuestionStats: Record<string, { total: number; examQuestions: number; topicQuestions: number }>;
  totalQuestionBankCount: number;
  totalExamsCount: number;
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsData> {
  try {
    // SECURITY: admin analytics are teacher-only
    await requireTeacher();

    // 1. Fetch Students
    const { data: studentsData } = await supabase.from("allowed_students").select("id, courses");
    const students = studentsData || [];
    const totalStudents = students.length;

    let totalEnrollments = 0;
    const courseEnrollmentMap: Record<string, number> = {};

    students.forEach((st) => {
      const courses = Array.isArray(st.courses) ? st.courses : [];
      totalEnrollments += courses.length;
      courses.forEach((c: string) => {
        const cName = (c || "").trim();
        if (cName) {
          courseEnrollmentMap[cName] = (courseEnrollmentMap[cName] || 0) + 1;
        }
      });
    });

    // 2. Fetch Submissions
    const { data: submissionsData } = await supabase.from("submissions").select("id, exam_key, exam_title");
    const submissions = submissionsData || [];
    const totalSubmissions = submissions.length;

    const examSubmissionMap: Record<string, { title: string; count: number; course: string }> = {};
    submissions.forEach((sub) => {
      const eKey = sub.exam_key || "unknown";
      if (!examSubmissionMap[eKey]) {
        examSubmissionMap[eKey] = {
          title: sub.exam_title || eKey,
          count: 0,
          course: "সাধারণ"
        };
      }
      examSubmissionMap[eKey].count += 1;
    });

    // Fetch exams to attach course names to submissions
    const { data: examsData } = await supabase.from("exams").select("id, title, course");
    const totalExamsCount = (examsData || []).length;
    (examsData || []).forEach((ex) => {
      if (examSubmissionMap[ex.id]) {
        examSubmissionMap[ex.id].title = ex.title || examSubmissionMap[ex.id].title;
        examSubmissionMap[ex.id].course = ex.course || "সাধারণ";
      }
    });

    // 3. Question stats (count-based so the 1000-row default never undercounts)
    const { count: questionBankCount } = await supabase
      .from("question_bank")
      .select("*", { count: "exact", head: true });
    const totalQuestionBankCount = questionBankCount || 0;

    const { count: topicQuestionsCount } = await supabase
      .from("topic_questions")
      .select("*", { count: "exact", head: true });
    const totalTopicQuestions = topicQuestionsCount || 0;

    // Question stats: total bank size, and how many are mirrored in the topic
    // pool. NOT a per-teacher breakdown — no creator column exists yet.
    const teacherQuestionStats: Record<string, { total: number; examQuestions: number; topicQuestions: number }> = {
      "সর্বমোট (Total)": {
        total: totalQuestionBankCount,
        examQuestions: Math.max(0, totalQuestionBankCount - totalTopicQuestions),
        topicQuestions: totalTopicQuestions
      }
    };

    return {
      totalStudents,
      totalEnrollments,
      courseEnrollmentMap,
      totalSubmissions,
      examSubmissionMap,
      teacherQuestionStats,
      totalQuestionBankCount,
      totalExamsCount
    };
  } catch (err) {
    console.error("Error generating admin analytics:", err);
    return {
      totalStudents: 0,
      totalEnrollments: 0,
      courseEnrollmentMap: {},
      totalSubmissions: 0,
      examSubmissionMap: {},
      teacherQuestionStats: {},
      totalQuestionBankCount: 0,
      totalExamsCount: 0
    };
  }
}

export interface LiveExamRow {
  examKey: string;
  title: string;
  course: string;
  subject: string;
  /** এ পর্যন্ত কতজন (distinct) শিক্ষার্থী এই পরীক্ষার লাইভ সংস্করণ দিয়েছে */
  liveCount: number;
}

/**
 * শিক্ষক প্যানেলের রিপোর্ট: কোন কোর্স → কোন সাবজেক্ট → কোন পরীক্ষায় এ পর্যন্ত
 * কতজন লাইভ পরীক্ষা দিয়েছে। শুধু লাইভ (is_live_submission) সাবমিশন গোনা হয়।
 */
export async function getLiveExamParticipation(): Promise<LiveExamRow[]> {
  try {
    // SECURITY: teacher-only
    await requireTeacher();

    // পরীক্ষার মেটাডেটা (কোর্স + সাবজেক্ট) exams টেবিল থেকে
    const { data: examsData, error: examsErr } = await supabase
      .from("exams")
      .select("id, title, course, subject");
    if (examsErr) throw examsErr;
    const meta = new Map<string, { title: string; course: string; subject: string }>();
    (examsData || []).forEach((ex) => {
      if (!ex.id) return;
      meta.set(ex.id, {
        title: ex.title || String(ex.id),
        course: ex.course || "সাধারণ",
        subject: ex.subject || "সাধারণ"
      });
    });

    // লাইভ সাবমিশন — প্রতি (exam_key, student_id) আলাদা করে ধরে student গুনি
    const { data: subs, error: subsErr } = await supabase
      .from("submissions")
      .select("exam_key, student_id")
      .eq("is_live_submission", true);
    if (subsErr) throw subsErr;

    const byExam = new Map<string, Set<string>>();
    (subs || []).forEach((s) => {
      const k = s.exam_key || "unknown";
      if (!byExam.has(k)) byExam.set(k, new Set<string>());
      if (s.student_id) byExam.get(k)!.add(String(s.student_id));
    });

    const rows: LiveExamRow[] = [];
    byExam.forEach((students, examKey) => {
      const m = meta.get(examKey) || { title: examKey, course: "সাধারণ", subject: "সাধারণ" };
      rows.push({
        examKey,
        title: m.title,
        course: m.course,
        subject: m.subject,
        liveCount: students.size
      });
    });

    // কোর্স → সাবজেক্ট → পরীক্ষার নাম ক্রমে
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    rows.sort(
      (a, b) =>
        cmp(a.course, b.course) || cmp(a.subject, b.subject) || cmp(a.title, b.title)
    );
    return rows;
  } catch (err) {
    console.error("Error generating live exam participation report:", err);
    return [];
  }
}

export interface LiveParticipantNames {
  examKey: string;
  count: number;
  /** যে সব শিক্ষার্থী (শুধু নাম) এই পরীক্ষার লাইভ সংস্করণ দিয়েছে */
  names: string[];
}

/**
 * একটি নির্দিষ্ট পরীক্ষার লাইভ অংশগ্রহণকারী শিক্ষার্থীদের নাম (শুধু নাম) দেয়।
 */
export async function getLiveExamParticipants(examKey: string): Promise<LiveParticipantNames> {
  try {
    // SECURITY: teacher-only
    await requireTeacher();
    const { data, error } = await supabase
      .from("submissions")
      .select("student_id, student_name")
      .eq("exam_key", examKey)
      .eq("is_live_submission", true);
    if (error) throw error;

    // (exam, student) লাইভে একবারই, তবুও defensiveভাবে distinct
    const map = new Map<string, string>();
    (data || []).forEach((s) => {
      const id = s.student_id ? String(s.student_id) : "";
      const rawName = s.student_name ? String(s.student_name).trim() : "";
      const key = id || rawName || "";
      if (!key) return;
      if (!map.has(key)) map.set(key, rawName || id || key);
    });

    const names = Array.from(map.values()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return { examKey, count: names.length, names };
  } catch (err) {
    console.error("Error fetching live exam participants:", err);
    return { examKey, count: 0, names: [] };
  }
}

export interface StudentMissedExams {
  averageScore?: number;
  lastActiveDate?: string | null;
  studentId: string;
  studentName: string;
  courses: string[];
  totalAvailable: number;
  totalTaken: number;
  totalMissed: number;
  attendanceRate: number;
}

export async function getMissedExamsReport(
  courseFilter?: string,
  timeFilter?: string,
  customStart?: string,
  customEnd?: string
): Promise<StudentMissedExams[]> {
  try {
    await requireTeacher();

    // 1. Fetch Students
    const { data: studentsData } = await supabase.from("allowed_students").select("id, name, courses");
    const students = studentsData || [];

    // 2. Fetch Exams with date fields
    const { data: examsData, error: examsErr } = await supabase.from("exams").select("id, course, end_time, leaderboard_end_time");
    if (examsErr) {
      console.error("Exams fetch error:", examsErr);
    }
    let exams = examsData || [];

    // Apply time filter
    if (timeFilter && timeFilter !== "all") {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      if (timeFilter === "this_week") {
        startDate.setDate(now.getDate() - now.getDay()); // Sunday
        startDate.setHours(0,0,0,0);
      } else if (timeFilter === "this_month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (timeFilter === "last_month") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else if (timeFilter === "custom" && customStart && customEnd) {
        startDate = new Date(customStart);
        startDate.setHours(0,0,0,0);
        endDate = new Date(customEnd);
        endDate.setHours(23,59,59,999);
      }

      exams = exams.filter(ex => {
        const dStr = ex.end_time || ex.leaderboard_end_time;
        if (!dStr) return false; 
        const d = new Date(dStr);
        if (timeFilter === "last_month" || timeFilter === "custom") {
          return d >= startDate && d <= endDate;
        }
        return d >= startDate;
      });
    }

    // Group exams by course
    const examsByCourse: Record<string, string[]> = {};
    exams.forEach(ex => {
      const c = ex.course || "সাধারণ";
      if (!examsByCourse[c]) examsByCourse[c] = [];
      examsByCourse[c].push(ex.id);
    });

    // 3. Fetch all submissions
    const { data: subData } = await supabase.from("submissions").select("student_id, exam_key, score, total_questions, submitted_at");
    const submissions = subData || [];

    // Group submissions by student
    const subsByStudent: Record<string, Array<{key: string, score: number, total: number, date: string}>> = {};
    submissions.forEach(sub => {
      if (!sub.student_id) return;
      if (!subsByStudent[sub.student_id]) subsByStudent[sub.student_id] = [];
      if (sub.exam_key) {
        subsByStudent[sub.student_id].push({
          key: sub.exam_key,
          score: sub.score || 0,
          total: sub.total_questions || 0,
          date: sub.submitted_at || ""
        });
      }
    });

    // 4. Calculate for each student
    const report: StudentMissedExams[] = [];

    students.forEach(st => {
      const courses = Array.isArray(st.courses) ? st.courses : [];
      if (courses.length === 0) return; // Ignore unregistered
      
      // If courseFilter is set, and the student doesn't have it (and it's not ALL), skip them
      if (courseFilter && courseFilter !== "all") {
        if (!courses.includes(courseFilter) && !courses.includes("ALL")) {
          return;
        }
      }
      
      const availableExamIds = new Set<string>();
      
      if (courses.includes("ALL")) {
        // If student has ALL, they have access to all exams
        Object.keys(examsByCourse).forEach(cName => {
          if (courseFilter && courseFilter !== "all" && cName !== "সাধারণ" && cName !== courseFilter) {
            return; // skip if filtering by a specific course
          }
          examsByCourse[cName].forEach(e => availableExamIds.add(e));
        });
      } else {
        courses.forEach((c: string) => {
          const cName = c;
          if (courseFilter && courseFilter !== "all" && cName !== courseFilter) {
            return;
          }
          if (examsByCourse[cName]) {
            examsByCourse[cName].forEach(e => availableExamIds.add(e));
          }
          if (cName !== "সাধারণ" && examsByCourse["সাধারণ"]) {
            examsByCourse["সাধারণ"].forEach(e => availableExamIds.add(e));
          }
        });
      }

      const totalAvailable = availableExamIds.size; console.log('Student:', st.name, 'totalAvailable:', totalAvailable, 'courses:', courses);
      const stSubs = subsByStudent[st.id] || [];
      
      let totalTaken = 0;
      let sumPct = 0;
      let lastActive: Date | null = null;

      const uniqueTaken = new Set<string>(); // handle retakes safely
      
      stSubs.forEach(s => {
        if (availableExamIds.has(s.key)) {
          if (!uniqueTaken.has(s.key)) {
             totalTaken++;
             uniqueTaken.add(s.key);
          }
          if (s.total > 0) {
            sumPct += (s.score / s.total) * 100;
          }
          if (s.date) {
            const d = new Date(s.date);
            if (!lastActive || d > lastActive) lastActive = d;
          }
        }
      });
      
      const averageScore = stSubs.length > 0 ? Math.round(sumPct / stSubs.length) : 0;

      const totalMissed = totalAvailable - totalTaken;
      const attendanceRate = totalAvailable > 0 ? Math.round((totalTaken / totalAvailable) * 100) : 0;
      
      const safeLastActive = lastActive as Date | null;

      report.push({
        studentId: st.id,
        studentName: st.name || "Unknown",
        courses,
        totalAvailable,
        totalTaken,
        totalMissed: Math.max(0, totalMissed),
        attendanceRate,
        averageScore,
        lastActiveDate: safeLastActive ? safeLastActive.toISOString() : null
      });
    });

    report.sort((a, b) => b.attendanceRate - a.attendanceRate); // Highest attendance first

    return report;

  } catch (err) {
    console.error("Missed exams report err:", err);
    return [];
  }
}

