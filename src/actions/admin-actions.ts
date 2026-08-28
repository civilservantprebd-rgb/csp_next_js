"use server";

import { supabase } from "@/lib/supabase";
import { AppConfigData, Exam, QuestionItem, QuestionSolution, TopicQuestion } from "@/types/exam";
import { getExamSolutions } from "@/actions/exam-actions";
import { Submission } from "@/types/submission";

let cachedConfig: AppConfigData | null = null;
let lastFetchTime = 0;
let inflightFetch: Promise<AppConfigData> | null = null;
const CACHE_TTL_MS = 20000; // 20 seconds cache for lightning-fast page navigation

function invalidateConfigCache() {
  cachedConfig = null;
  lastFetchTime = 0;
}

export async function fetchAppConfig(forceRefresh = false): Promise<AppConfigData> {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  const defaultData: AppConfigData = {
    courses: ["সাধারণ কোর্স", "বিসিএস প্রিলি"],
    subjects: [
      { name: "বাংলা", course: "সাধারণ কোর্স" },
      { name: "ইংরেজি", course: "সাধারণ কোর্স" },
      { name: "গণিত", course: "সাধারণ কোর্স" },
      { name: "সাধারণ জ্ঞান", course: "সাধারণ কোর্স" }
    ],
    topics: [
      "প্রাচীন ও মধ্যযুগ",
      "আধুনিক যুগ",
      "বাংলা ব্যাকরণ",
      "English Grammar",
      "English Literature",
      "পাটিগণিত",
      "বীজগণিত",
      "জ্যামিতি",
      "বাংলাদেশ বিষয়াবলী",
      "আন্তর্জাতিক বিষয়াবলী",
      "সাধারণ বিজ্ঞান",
      "কম্পিউটার ও তথ্যপ্রযুক্তি",
      "ভূগোল ও পরিবেশ",
      "নৈতিকতা ও সুশাসন"
    ],
    topicQuestions: [],
    exams: {},
    teacherPass: "1234",
    driveRoutineUrl: "https://drive.google.com",
    driveSyllabusUrl: "https://drive.google.com"
  };

  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("Firestore timeout")), 2500)
  );

  inflightFetch = (async () => {
    try {
      const fetchPromise = Promise.all([
        supabase.from("app_settings").select("*").eq("id", "main").maybeSingle(),
        supabase.from("subjects").select("name, course"),
        supabase.from("exams").select("*"),
        supabase.from("exam_questions").select("*").order("created_at", { ascending: true }),
        supabase.from("topic_questions").select("*").order("created_at", { ascending: true })
      ]);

      const results = await Promise.race([
        fetchPromise,
        timeoutPromise.then(() => { throw new Error("Timeout"); })
      ]);

      if (results) {
        const [settingsRes, subjectsRes, examsRes, questionsRes, topicQuestionsRes] = results;

        const settings = settingsRes?.data || {};
        const courses = settings.courses || defaultData.courses;
        const topics = settings.topics || defaultData.topics;
        const teacherPass = settings.teacher_pass || defaultData.teacherPass;
        const driveRoutineUrl = settings.drive_routine_url || defaultData.driveRoutineUrl;
        const driveSyllabusUrl = settings.drive_syllabus_url || defaultData.driveSyllabusUrl;

        const subjects = (subjectsRes?.data || []).map((s) => ({
          name: s.name,
          course: s.course
        }));

        const topicQuestions: TopicQuestion[] = (topicQuestionsRes?.data || []).map((tq) => ({
          id: tq.id,
          topic: tq.topic,
          q: tq.q,
          opts: tq.opts,
          correct: Number(tq.correct),
          exp: tq.exp || "",
          originalExamTitle: tq.original_exam_title,
          originalCourse: tq.original_course,
          originalSubject: tq.original_subject,
          examKey: tq.exam_key,
          createdAt: tq.created_at
        }));

        const questionsByExam: Record<string, QuestionItem[]> = {};
        (questionsRes?.data || []).forEach((q) => {
          if (!questionsByExam[q.exam_id]) {
            questionsByExam[q.exam_id] = [];
          }
          questionsByExam[q.exam_id].push({
            q: q.q,
            opts: q.opts,
            topic: q.topic || undefined
          });
        });

        const exams: Record<string, Exam> = {};
        (examsRes?.data || []).forEach((ex) => {
          exams[ex.id] = {
            id: ex.id,
            course: ex.course,
            subject: ex.subject,
            title: ex.title,
            timerMinutes: ex.timer_minutes,
            isFree: ex.is_free,
            passMark: Number(ex.pass_mark),
            startTime: ex.start_time,
            endTime: ex.end_time,
            isResultPublished: ex.is_result_published,
            leaderboardStartTime: ex.leaderboard_start_time,
            leaderboardEndTime: ex.leaderboard_end_time,
            questions: questionsByExam[ex.id] || []
          };
        });

        const data: AppConfigData = {
          courses,
          subjects,
          topics,
          topicQuestions,
          exams,
          teacherPass,
          driveRoutineUrl,
          driveSyllabusUrl
        };

        cachedConfig = data;
        lastFetchTime = Date.now();
        return data;
      }
    } catch (err) {
      console.warn("Fetch app config timed out or failed, using cache/default:", err);
    } finally {
      inflightFetch = null;
    }

    if (cachedConfig) {
      return cachedConfig;
    }

    cachedConfig = defaultData;
    lastFetchTime = Date.now();
    return defaultData;
  })();

  return inflightFetch;
}

export async function saveAppConfig(config: Partial<AppConfigData>): Promise<boolean> {
  try {
    const updateData: any = {};
    if (config.courses) updateData.courses = config.courses;
    if (config.topics) updateData.topics = config.topics;
    if (config.teacherPass) updateData.teacher_pass = config.teacherPass;
    if (config.driveRoutineUrl) updateData.drive_routine_url = config.driveRoutineUrl;
    if (config.driveSyllabusUrl) updateData.drive_syllabus_url = config.driveSyllabusUrl;

    if (Object.keys(updateData).length > 0) {
      const { error: settingsError } = await supabase
        .from("app_settings")
        .upsert({ id: "main", ...updateData });
      if (settingsError) throw settingsError;
    }

    if (config.subjects) {
      // Sync subjects table
      const { error: deleteError } = await supabase
        .from("subjects")
        .delete()
        .neq("name", "___nonexistent_subject___");
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("subjects")
        .insert(config.subjects.map((s) => ({ name: s.name, course: s.course })));
      if (insertError) throw insertError;
    }

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Save app config error:", err);
    return false;
  }
}

export async function createExam(examData: Omit<Exam, "id">): Promise<string | null> {
  try {
    const examKey = `exam_${Date.now()}`;
    const { error } = await supabase.from("exams").insert({
      id: examKey,
      course: examData.course,
      subject: examData.subject,
      title: examData.title,
      timer_minutes: examData.timerMinutes,
      is_free: examData.isFree ?? false,
      pass_mark: examData.passMark ?? 1,
      start_time: examData.startTime || null,
      end_time: examData.endTime || null,
      is_result_published: examData.isResultPublished ?? false,
      leaderboard_start_time: examData.leaderboardStartTime || null,
      leaderboard_end_time: examData.leaderboardEndTime || null
    });

    if (error) throw error;

    invalidateConfigCache();
    return examKey;
  } catch (err) {
    console.error("Create exam error:", err);
    return null;
  }
}

export async function updateExam(examKey: string, examData: Partial<Exam>): Promise<boolean> {
  try {
    const updateData: any = {};
    if (examData.course) updateData.course = examData.course;
    if (examData.subject) updateData.subject = examData.subject;
    if (examData.title) updateData.title = examData.title;
    if (examData.timerMinutes !== undefined) updateData.timer_minutes = examData.timerMinutes;
    if (examData.isFree !== undefined) updateData.is_free = examData.isFree;
    if (examData.passMark !== undefined) updateData.pass_mark = examData.passMark;
    if (examData.startTime !== undefined) updateData.start_time = examData.startTime;
    if (examData.endTime !== undefined) updateData.end_time = examData.endTime;
    if (examData.isResultPublished !== undefined) updateData.is_result_published = examData.isResultPublished;
    if (examData.leaderboardStartTime !== undefined) updateData.leaderboard_start_time = examData.leaderboardStartTime;
    if (examData.leaderboardEndTime !== undefined) updateData.leaderboard_end_time = examData.leaderboardEndTime;

    const { error } = await supabase
      .from("exams")
      .update(updateData)
      .eq("id", examKey);

    if (error) throw error;

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Update exam error:", err);
    return false;
  }
}

export async function deleteExam(examKey: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("exams").delete().eq("id", examKey);
    if (error) throw error;

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Delete exam error:", err);
    return false;
  }
}

export async function addQuestionToExam(
  examKey: string,
  question: QuestionItem,
  solution: QuestionSolution
): Promise<boolean> {
  try {
    const { data: examData, error: examError } = await supabase
      .from("exams")
      .select("title, course, subject")
      .eq("id", examKey)
      .single();

    if (examError) throw examError;

    const { error } = await supabase.from("exam_questions").insert({
      exam_id: examKey,
      q: question.q.trim(),
      opts: question.opts.map((o) => o.trim()),
      topic: question.topic?.trim() || null,
      correct: Number(solution.correct),
      exp: solution.exp.trim()
    });

    if (error) throw error;

    if (question.topic?.trim()) {
      const { error: tqError } = await supabase.from("topic_questions").insert({
        id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        topic: question.topic.trim(),
        q: question.q.trim(),
        opts: question.opts.map((o) => o.trim()),
        correct: Number(solution.correct),
        exp: solution.exp.trim(),
        original_exam_title: examData.title,
        original_course: examData.course,
        original_subject: examData.subject,
        exam_key: examKey
      });
      if (tqError) throw tqError;
    }

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Add question error:", err);
    return false;
  }
}

export async function addBulkQuestionsToExam(
  examKey: string,
  newQuestions: QuestionItem[],
  newSolutions: QuestionSolution[]
): Promise<{ success: boolean; count: number }> {
  try {
    if (!newQuestions.length) return { success: false, count: 0 };

    const { data: examData, error: examError } = await supabase
      .from("exams")
      .select("title, course, subject")
      .eq("id", examKey)
      .single();

    if (examError) throw examError;

    const questionsInsert = newQuestions.map((qItem, idx) => {
      const sol = newSolutions[idx] || { correct: 0, exp: "" };
      return {
        exam_id: examKey,
        q: qItem.q.trim(),
        opts: qItem.opts.map((o) => o.trim()),
        topic: qItem.topic?.trim() || null,
        correct: Number(sol.correct),
        exp: (sol.exp || "").trim()
      };
    });

    const { error: insertError } = await supabase.from("exam_questions").insert(questionsInsert);
    if (insertError) throw insertError;

    const topicQuestionsInsert = newQuestions
      .map((qItem, idx) => {
        const sol = newSolutions[idx] || { correct: 0, exp: "" };
        if (!qItem.topic?.trim()) return null;
        return {
          id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`,
          topic: qItem.topic.trim(),
          q: qItem.q.trim(),
          opts: qItem.opts.map((o) => o.trim()),
          correct: Number(sol.correct),
          exp: (sol.exp || "").trim(),
          original_exam_title: examData.title,
          original_course: examData.course,
          original_subject: examData.subject,
          exam_key: examKey
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (topicQuestionsInsert.length > 0) {
      const { error: tqError } = await supabase.from("topic_questions").insert(topicQuestionsInsert);
      if (tqError) throw tqError;
    }

    invalidateConfigCache();
    return { success: true, count: newQuestions.length };
  } catch (err) {
    console.error("Add bulk questions error:", err);
    return { success: false, count: 0 };
  }
}

export async function updateQuestionInExam(
  examKey: string,
  index: number,
  question: QuestionItem,
  solution: QuestionSolution
): Promise<boolean> {
  try {
    const { data: examData, error: examError } = await supabase
      .from("exams")
      .select("title, course, subject")
      .eq("id", examKey)
      .single();

    if (examError) throw examError;

    const { data: qList, error: qListError } = await supabase
      .from("exam_questions")
      .select("id, q")
      .eq("exam_id", examKey)
      .order("created_at", { ascending: true });

    if (qListError) throw qListError;

    const oldQ = qList?.[index];
    if (!oldQ) return false;

    const { error: updateError } = await supabase
      .from("exam_questions")
      .update({
        q: question.q.trim(),
        opts: question.opts.map((o) => o.trim()),
        topic: question.topic?.trim() || null,
        correct: Number(solution.correct),
        exp: solution.exp.trim()
      })
      .eq("id", oldQ.id);

    if (updateError) throw updateError;

    if (question.topic?.trim()) {
      const { data: existingTq } = await supabase
        .from("topic_questions")
        .select("id")
        .eq("exam_key", examKey)
        .eq("q", oldQ.q)
        .maybeSingle();

      if (existingTq) {
        await supabase
          .from("topic_questions")
          .update({
            topic: question.topic.trim(),
            q: question.q.trim(),
            opts: question.opts.map((o) => o.trim()),
            correct: Number(solution.correct),
            exp: solution.exp.trim()
          })
          .eq("id", existingTq.id);
      } else {
        await supabase.from("topic_questions").insert({
          id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          topic: question.topic.trim(),
          q: question.q.trim(),
          opts: question.opts.map((o) => o.trim()),
          correct: Number(solution.correct),
          exp: solution.exp.trim(),
          original_exam_title: examData.title,
          original_course: examData.course,
          original_subject: examData.subject,
          exam_key: examKey
        });
      }
    }

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Update question error:", err);
    return false;
  }
}

export async function deleteQuestionFromExam(examKey: string, index: number): Promise<boolean> {
  try {
    const { data: qList, error: qListError } = await supabase
      .from("exam_questions")
      .select("id")
      .eq("exam_id", examKey)
      .order("created_at", { ascending: true });

    if (qListError) throw qListError;

    const target = qList?.[index];
    if (!target) return false;

    const { error: deleteError } = await supabase
      .from("exam_questions")
      .delete()
      .eq("id", target.id);

    if (deleteError) throw deleteError;

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Delete question error:", err);
    return false;
  }
}

export async function toggleExamResultPublish(examKey: string, publish: boolean): Promise<boolean> {
  try {
    const { error: examUpdateError } = await supabase
      .from("exams")
      .update({ is_result_published: publish })
      .eq("id", examKey);

    if (examUpdateError) throw examUpdateError;

    const { data: subs, error: subsError } = await supabase
      .from("submissions")
      .select("*")
      .eq("exam_key", examKey);

    if (subsError) throw subsError;

    const solutions = publish ? await getExamSolutions(examKey) : null;
    const batchUpdates: Promise<any>[] = [];

    (subs || []).forEach((row) => {
      if (publish && solutions && Array.isArray(row.answers)) {
        let correct = 0;
        let incorrect = 0;
        row.answers.forEach((ans: number | null, idx: number) => {
          const sol = solutions[idx];
          if (ans !== null && ans !== -1 && sol) {
            if (ans === sol.correct) correct++;
            else incorrect++;
          }
        });
        const score = Math.max(0, correct - incorrect * 0.5);
        batchUpdates.push(
          (async () => {
            const { error } = await supabase
              .from("submissions")
              .update({
                score,
                correct,
                incorrect,
                is_pending_evaluation: false
              })
              .eq("id", row.id);
            if (error) throw error;
          })()
        );
      } else if (!publish) {
        batchUpdates.push(
          (async () => {
            const { error } = await supabase
              .from("submissions")
              .update({ is_pending_evaluation: true })
              .eq("id", row.id);
            if (error) throw error;
          })()
        );
      }
    });

    await Promise.all(batchUpdates);
    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Toggle exam result publish error:", err);
    return false;
  }
}

export async function deleteTopicQuestion(topicQuestionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("topic_questions").delete().eq("id", topicQuestionId);
    if (error) throw error;

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Delete topic question error:", err);
    return false;
  }
}

export async function clearAllSubmissions(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("submissions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Deletes all

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Clear submissions error:", err);
    return false;
  }
}

export async function getAllSubmissions(): Promise<Submission[]> {
  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      studentName: row.student_name,
      studentId: row.student_id,
      examKey: row.exam_key,
      examTitle: row.exam_title,
      score: Number(row.score ?? 0),
      correct: Number(row.correct ?? 0),
      incorrect: Number(row.incorrect ?? 0),
      totalQuestions: Number(row.total_questions ?? 0),
      timeSpent: row.time_spent,
      answers: Array.isArray(row.answers)
        ? row.answers.map((v: any) => (v === -1 || v === null ? null : Number(v)))
        : [],
      isPendingEvaluation: row.is_pending_evaluation,
      isLiveSubmission: row.is_live_submission,
      submittedAtISO: row.submitted_at
    }));
  } catch (err) {
    console.error("Fetch all submissions error:", err);
    return [];
  }
}
