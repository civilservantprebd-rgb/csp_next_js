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
    const enrolledStudents = studentsData || [];

    // 2. Fetch Live Exams (only exams with start_time and end_time/leaderboard_end_time)
    const { data: examsData, error: examsErr } = await supabase.from("exams").select("id, course, start_time, end_time, leaderboard_end_time");
    if (examsErr) {
      console.error("Exams fetch error:", examsErr);
    }
    
    // Only consider scheduled/live exams
    let exams = (examsData || []).filter(ex => !!ex.start_time && !!(ex.end_time || ex.leaderboard_end_time));

    // Apply time filter based on end time of the exam
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

    // Filter exams by course if needed
    if (courseFilter && courseFilter !== "all") {
      exams = exams.filter(ex => (ex.course || "সাধারণ") === courseFilter || ex.course === "সাধারণ");
    }

    const liveExamIds = new Set(exams.map(e => String(e.id)));

    // 3. Fetch submissions (only live submissions for these exams)
    const { data: subData } = await supabase.from("submissions")
      .select("student_id, exam_key, is_live_submission");
    const submissions = subData || [];

    // Group live submissions by student
    const liveSubsByStudent: Record<string, Set<string>> = {};
    submissions.forEach(sub => {
      if (!sub.student_id) return;
      if (sub.is_live_submission === true && liveExamIds.has(sub.exam_key)) {
        if (!liveSubsByStudent[sub.student_id]) {
          liveSubsByStudent[sub.student_id] = new Set();
        }
        liveSubsByStudent[sub.student_id].add(sub.exam_key);
      }
    });

    // Determine which students to show
    const reportMap = new Map<string, StudentMissedExams>();

    // Pass 1: Enrolled students
    enrolledStudents.forEach(st => {
      const courses = Array.isArray(st.courses) ? st.courses : [];
      let isEnrolledInFilteredCourse = true;
      if (courseFilter && courseFilter !== "all") {
        isEnrolledInFilteredCourse = courses.includes(courseFilter) || courses.includes("ALL");
      }
      
      // If student is enrolled, we process them
      if (isEnrolledInFilteredCourse) {
        let studentTotalExams = 0;
        let studentTakenExams = 0;

        exams.forEach(ex => {
          const exCourse = ex.course || "সাধারণ";
          // If the exam is for the student's enrolled courses or it's a general exam
          if (courses.includes("ALL") || courses.includes(exCourse) || exCourse === "সাধারণ") {
             studentTotalExams++;
             if (liveSubsByStudent[st.id]?.has(ex.id)) {
               studentTakenExams++;
             }
          }
        });

        const totalMissed = studentTotalExams - studentTakenExams;
        const attendanceRate = studentTotalExams > 0 ? Math.round((studentTakenExams / studentTotalExams) * 100) : 0;

        reportMap.set(st.id, {
          studentId: st.id,
          studentName: st.name || "Unknown",
          courses: courses,
          totalAvailable: studentTotalExams,
          totalTaken: studentTakenExams,
          totalMissed: Math.max(0, totalMissed),
          attendanceRate: attendanceRate,
        });
      }
    });

    // Pass 2: Unenrolled students who gave exams in this course
    if (courseFilter && courseFilter !== "all") {
       // Filter submissions again to find students who took an exam specifically for this course
       const courseSpecificExams = new Set(exams.filter(e => (e.course || "সাধারণ") === courseFilter).map(e => e.id));
       
       for (const sub of submissions) {
         if (sub.is_live_submission === true && courseSpecificExams.has(sub.exam_key)) {
           const sid = sub.student_id;
           if (!reportMap.has(sid)) {
             // We need this student's info
             const stInfo = enrolledStudents.find(s => s.id === sid);
             const sName = stInfo ? stInfo.name : "Unknown";
             const sCourses = stInfo && Array.isArray(stInfo.courses) ? stInfo.courses : [];
             
             // Calculate stats for this student based on the exams they just had access to
             let studentTotalExams = 0;
             let studentTakenExams = 0;

             exams.forEach(ex => {
               const exCourse = ex.course || "সাধারণ";
               // Unenrolled student, so we only count exams they actually took? No, the rule for attendance:
               // If they took a live exam in this course, they get evaluated against all exams in this course.
               if (exCourse === courseFilter || exCourse === "সাধারণ") {
                 studentTotalExams++;
                 if (liveSubsByStudent[sid]?.has(ex.id)) {
                   studentTakenExams++;
                 }
               }
             });

             const totalMissed = studentTotalExams - studentTakenExams;
             const attendanceRate = studentTotalExams > 0 ? Math.round((studentTakenExams / studentTotalExams) * 100) : 0;

             reportMap.set(sid, {
               studentId: sid,
               studentName: sName,
               courses: sCourses,
               totalAvailable: studentTotalExams,
               totalTaken: studentTakenExams,
               totalMissed: Math.max(0, totalMissed),
               attendanceRate: attendanceRate,
             });
           }
         }
       }
    }

    const report = Array.from(reportMap.values());
    report.sort((a, b) => b.attendanceRate - a.attendanceRate); // Highest attendance first

    return report;

  } catch (err) {
    console.error("Missed exams report err:", err);
    return [];
  }
}

