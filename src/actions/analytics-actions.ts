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
