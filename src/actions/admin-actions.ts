"use server";

import { supabase } from "@/lib/supabase";
import { AppConfigData, Exam, QuestionItem, QuestionSolution, TopicQuestion } from "@/types/exam";
import { getExamSolutions } from "@/actions/exam-actions";
import { Submission } from "@/types/submission";

let cachedConfig: AppConfigData | null = null;
let lastFetchTime = 0;
let inflightFetch: Promise<AppConfigData> | null = null;
const CACHE_TTL_MS = 20000; // 20 seconds cache for lightning-fast page navigation

const DEFAULT_DATA: AppConfigData = {
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
    "বাংলাদেশ বিষয়াবলী",
    "আন্তর্জাতিক বিষয়াবলী",
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

function invalidateConfigCache() {
  cachedConfig = null;
  lastFetchTime = 0;
  cachedConfigLite = null;
  lastFetchTimeLite = 0;
}

export async function fetchAppConfig(forceRefresh = false): Promise<AppConfigData> {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("Firestore timeout")), 2500)
  );

  inflightFetch = (async () => {
    try {
      const fetchPromise = Promise.all([
        supabase.from("app_settings").select("*").eq("id", "main").maybeSingle(),
        supabase.from("subjects").select("name, course"),
        supabase.from("exams").select("*"),
        supabase.from("exam_questions_link").select("exam_id, order_index, question_bank(*)"),
        supabase.from("topic_questions").select("*").order("created_at", { ascending: true })
      ]);

      const results = await Promise.race([
        fetchPromise,
        timeoutPromise.then(() => { throw new Error("Timeout"); })
      ]);

      if (results) {
        const [settingsRes, subjectsRes, examsRes, linksRes, topicQuestionsRes] = results;

        const settings = settingsRes?.data || {};
        const courses = settings.courses || DEFAULT_DATA.courses;
        const topics = settings.topics || DEFAULT_DATA.topics;
        const teacherPass = settings.teacher_pass || DEFAULT_DATA.teacherPass;
        const driveRoutineUrl = settings.drive_routine_url || DEFAULT_DATA.driveRoutineUrl;
        const driveSyllabusUrl = settings.drive_syllabus_url || DEFAULT_DATA.driveSyllabusUrl;

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

        const questionsByExam: Record<string, { order: number; question: QuestionItem }[]> = {};
        (linksRes?.data || []).forEach((link: any) => {
          const examId = link.exam_id;
          const qData = link.question_bank;
          if (!qData) return;

          if (!questionsByExam[examId]) {
            questionsByExam[examId] = [];
          }
          questionsByExam[examId].push({
            order: Number(link.order_index ?? 0),
            question: {
              id: qData.id,
              q: qData.q,
              opts: qData.opts,
              topic: qData.topic || undefined
            }
          });
        });

        const exams: Record<string, Exam> = {};
        (examsRes?.data || []).forEach((ex) => {
          const sortedQs = (questionsByExam[ex.id] || [])
            .sort((a, b) => a.order - b.order)
            .map((item) => item.question);

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
            questions: sortedQs
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

    cachedConfig = DEFAULT_DATA;
    lastFetchTime = Date.now();
    return DEFAULT_DATA;
  })();

  return inflightFetch;
}

// ─── Lite Config (fast initial load — no full question JOIN) ────────────────

let cachedConfigLite: AppConfigData | null = null;
let lastFetchTimeLite = 0;
let inflightFetchLite: Promise<AppConfigData> | null = null;

/**
 * Fast version of fetchAppConfig for initial admin panel load.
 * Skips the heavy exam_questions_link JOIN — only fetches exam_id for counts.
 * Also skips topic_questions.
 * The exam list renders instantly; full data loads in the background.
 */
export async function fetchAppConfigLite(): Promise<AppConfigData> {
  const now = Date.now();
  if (cachedConfigLite && now - lastFetchTimeLite < CACHE_TTL_MS) {
    return cachedConfigLite;
  }

  if (inflightFetchLite) {
    return inflightFetchLite;
  }

  inflightFetchLite = (async () => {
    try {
      // 4 lightweight queries — NO question_bank JOIN, NO topic_questions
      const [settingsRes, subjectsRes, examsRes, linksRes] = await Promise.all([
        supabase.from("app_settings").select("*").eq("id", "main").maybeSingle(),
        supabase.from("subjects").select("name, course"),
        supabase.from("exams").select("*"),
        supabase.from("exam_questions_link").select("exam_id"), // only exam_id for counting
      ]);

      const settings = settingsRes?.data || {};
      const courses = settings.courses || DEFAULT_DATA.courses;
      const topics = settings.topics || DEFAULT_DATA.topics;
      const teacherPass = settings.teacher_pass || DEFAULT_DATA.teacherPass;
      const driveRoutineUrl = settings.drive_routine_url || DEFAULT_DATA.driveRoutineUrl;
      const driveSyllabusUrl = settings.drive_syllabus_url || DEFAULT_DATA.driveSyllabusUrl;

      const subjects = (subjectsRes?.data || []).map((s) => ({
        name: s.name,
        course: s.course
      }));

      // Count questions per exam without fetching question content
      const countsByExam: Record<string, number> = {};
      (linksRes?.data || []).forEach((link: any) => {
        countsByExam[link.exam_id] = (countsByExam[link.exam_id] || 0) + 1;
      });

      const exams: Record<string, Exam> = {};
      (examsRes?.data || []).forEach((ex) => {
        const count = countsByExam[ex.id] || 0;
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
          // Stub array of correct length so ex.questions.length shows right count
          questions: Array.from({ length: count }, () => ({ q: "", opts: [] }))
        };
      });

      const data: AppConfigData = {
        courses,
        subjects,
        topics,
        topicQuestions: [],
        exams,
        teacherPass,
        driveRoutineUrl,
        driveSyllabusUrl
      };

      cachedConfigLite = data;
      lastFetchTimeLite = Date.now();
      return data;
    } catch (err) {
      console.warn("Lite fetch failed:", err);
    } finally {
      inflightFetchLite = null;
    }

    if (cachedConfigLite) return cachedConfigLite;
    cachedConfigLite = DEFAULT_DATA;
    lastFetchTimeLite = Date.now();
    return DEFAULT_DATA;
  })();

  return inflightFetchLite;
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
    if (examData.startTime !== undefined) updateData.start_time = examData.startTime || null;
    if (examData.endTime !== undefined) updateData.end_time = examData.endTime || null;
    if (examData.isResultPublished !== undefined) updateData.is_result_published = examData.isResultPublished;
    if (examData.leaderboardStartTime !== undefined) updateData.leaderboard_start_time = examData.leaderboardStartTime || null;
    if (examData.leaderboardEndTime !== undefined) updateData.leaderboard_end_time = examData.leaderboardEndTime || null;

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

    // 1. Insert question into question_bank
    const targetTopic = question.topic?.trim() || "সাধারণ";
    const { data: newQ, error: qError } = await supabase
      .from("question_bank")
      .insert({
        q: question.q.trim(),
        opts: question.opts.map((o) => o.trim()),
        topic: targetTopic,
        correct: Number(solution.correct),
        exp: solution.exp.trim(),
        course: examData.course,
        subject: examData.subject
      })
      .select("id")
      .single();

    if (qError) throw qError;

    // 2. Find next order index
    const { data: currentLinks } = await supabase
      .from("exam_questions_link")
      .select("order_index")
      .eq("exam_id", examKey);

    const maxIndex = (currentLinks || []).reduce((max, link) => Math.max(max, Number(link.order_index)), -1);
    const nextIndex = maxIndex + 1;

    // 3. Link question to exam
    const { error: linkError } = await supabase
      .from("exam_questions_link")
      .insert({
        exam_id: examKey,
        question_id: newQ.id,
        order_index: nextIndex
      });

    if (linkError) throw linkError;

    // 4. Also add to topic questions pool for Self Practice mode
    const { error: tqError } = await supabase.from("topic_questions").insert({
      id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      topic: targetTopic,
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

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Add question error:", err);
    return false;
  }
}

export async function linkQuestionToExam(examKey: string, questionId: string): Promise<boolean> {
  try {
    const { data: currentLinks, error: fetchError } = await supabase
      .from("exam_questions_link")
      .select("order_index")
      .eq("exam_id", examKey);

    if (fetchError) throw fetchError;

    const maxIndex = (currentLinks || []).reduce((max, link) => Math.max(max, Number(link.order_index)), -1);
    const nextIndex = maxIndex + 1;

    const { error: linkError } = await supabase
      .from("exam_questions_link")
      .insert({
        exam_id: examKey,
        question_id: questionId,
        order_index: nextIndex
      });

    if (linkError) throw linkError;

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Link question error:", err);
    return false;
  }
}

export async function searchQuestionBank(
  queryText: string,
  topic?: string,
  subject?: string
): Promise<{ questions: any[]; total: number }> {
  try {
    let builder = supabase.from("question_bank").select("*", { count: "exact" });
    if (queryText) {
      builder = builder.ilike("q", `%${queryText}%`);
    }
    if (topic && topic !== "ALL") {
      builder = builder.eq("topic", topic);
    }
    if (subject && subject !== "ALL") {
      builder = builder.eq("subject", subject);
    }

    const { data, error, count } = await builder.limit(100);
    if (error) throw error;
    return { questions: data || [], total: count || 0 };
  } catch (err) {
    console.error("Search question bank error:", err);
    return { questions: [], total: 0 };
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

    const { data: links, error: fetchError } = await supabase
      .from("exam_questions_link")
      .select("question_id")
      .eq("exam_id", examKey)
      .order("order_index", { ascending: true });

    if (fetchError) throw fetchError;

    const targetLink = links?.[index];
    if (!targetLink) return false;

    // Fetch old question text to match in topic_questions in case question text changed
    const { data: oldQData } = await supabase
      .from("question_bank")
      .select("q")
      .eq("id", targetLink.question_id)
      .single();

    const oldQText = oldQData?.q || "";
    const targetTopic = question.topic?.trim() || "সাধারণ";

    const { error: updateError } = await supabase
      .from("question_bank")
      .update({
        q: question.q.trim(),
        opts: question.opts.map((o) => o.trim()),
        topic: targetTopic,
        correct: Number(solution.correct),
        exp: solution.exp.trim()
      })
      .eq("id", targetLink.question_id);

    if (updateError) throw updateError;

    const lookupText = oldQText || question.q.trim();
    const { data: existingTq } = await supabase
      .from("topic_questions")
      .select("id")
      .eq("exam_key", examKey)
      .eq("q", lookupText)
      .maybeSingle();

    if (existingTq) {
      await supabase
        .from("topic_questions")
        .update({
          topic: targetTopic,
          q: question.q.trim(),
          opts: question.opts.map((o) => o.trim()),
          correct: Number(solution.correct),
          exp: solution.exp.trim()
        })
        .eq("id", existingTq.id);
    } else {
      await supabase.from("topic_questions").insert({
        id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        topic: targetTopic,
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

    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Update question error:", err);
    return false;
  }
}

export async function deleteQuestionFromExam(examKey: string, index: number): Promise<boolean> {
  try {
    const { data: links, error: fetchError } = await supabase
      .from("exam_questions_link")
      .select("question_id, order_index")
      .eq("exam_id", examKey)
      .order("order_index", { ascending: true });

    if (fetchError) throw fetchError;

    const targetLink = links?.[index];
    if (!targetLink) return false;

    // 1. Delete the link
    const { error: deleteLinkError } = await supabase
      .from("exam_questions_link")
      .delete()
      .eq("exam_id", examKey)
      .eq("question_id", targetLink.question_id);

    if (deleteLinkError) throw deleteLinkError;

    // 2. Shift other questions
    const remaining = links.filter((_, i) => i !== index);
    const batchUpdates = remaining.map((link, newIdx) =>
      supabase
        .from("exam_questions_link")
        .update({ order_index: newIdx })
        .eq("exam_id", examKey)
        .eq("question_id", link.question_id)
    );

    await Promise.all(batchUpdates);

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
      const rawTopic = qItem.topic?.trim() || "সাধারণ";
      const fullTopic = qItem.subtopic ? `${rawTopic} > ${qItem.subtopic.trim()}` : rawTopic;
      return {
        q: qItem.q.trim(),
        opts: qItem.opts.map((o) => o.trim()),
        topic: fullTopic,
        correct: Number(sol.correct),
        exp: (sol.exp || "").trim(),
        course: examData.course,
        subject: examData.subject
      };
    });

    const { data: createdQs, error: insertError } = await supabase
      .from("question_bank")
      .insert(questionsInsert)
      .select("id");

    if (insertError) throw insertError;

    const { data: currentLinks } = await supabase
      .from("exam_questions_link")
      .select("order_index")
      .eq("exam_id", examKey);

    const maxIndex = (currentLinks || []).reduce((max, link) => Math.max(max, Number(link.order_index)), -1);
    const nextIndex = maxIndex + 1;

    const linksInsert = (createdQs || []).map((q, idx) => ({
      exam_id: examKey,
      question_id: q.id,
      order_index: nextIndex + idx
    }));

    const { error: linkError } = await supabase.from("exam_questions_link").insert(linksInsert);
    if (linkError) throw linkError;

    const topicQuestionsInsert = newQuestions
      .map((qItem, idx) => {
        const sol = newSolutions[idx] || { correct: 0, exp: "" };
        const rawTopic = qItem.topic?.trim() || "সাধারণ";
        const fullTopic = qItem.subtopic ? `${rawTopic} > ${qItem.subtopic.trim()}` : rawTopic;
        return {
          id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`,
          topic: fullTopic,
          q: qItem.q.trim(),
          opts: qItem.opts.map((o) => o.trim()),
          correct: Number(sol.correct),
          exp: (sol.exp || "").trim(),
          original_exam_title: examData.title,
          original_course: examData.course,
          original_subject: examData.subject,
          exam_key: examKey
        };
      });

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

export async function addBulkTopicQuestions(
  topic: string,
  newQuestions: QuestionItem[],
  newSolutions: QuestionSolution[]
): Promise<{ success: boolean; count: number }> {
  try {
    if (!newQuestions.length) return { success: false, count: 0 };

    const resolvedTopic = (topic || "").trim() || "সাধারণ";

    const topicQuestionsInsert = newQuestions.map((qItem, idx) => {
      const sol = newSolutions[idx] || { correct: 0, exp: "" };
      const rawTopic = qItem.topic?.trim() || resolvedTopic;
      const fullTopic = qItem.subtopic ? `${rawTopic} > ${qItem.subtopic.trim()}` : rawTopic;
      return {
        id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`,
        topic: fullTopic,
        q: qItem.q.trim(),
        opts: qItem.opts.map((o) => o.trim()),
        correct: Number(sol.correct),
        exp: (sol.exp || "").trim(),
        original_exam_title: "সরাসরি টপিকে যুক্ত",
        original_course: "সাধারণ কোর্স",
        original_subject: "সাধারণ জ্ঞান",
        exam_key: null
      };
    });

    const { error: tqError } = await supabase.from("topic_questions").insert(topicQuestionsInsert);
    if (tqError) throw tqError;

    const questionsInsert = newQuestions.map((qItem, idx) => {
      const sol = newSolutions[idx] || { correct: 0, exp: "" };
      const rawTopic = qItem.topic?.trim() || resolvedTopic;
      const fullTopic = qItem.subtopic ? `${rawTopic} > ${qItem.subtopic.trim()}` : rawTopic;
      return {
        q: qItem.q.trim(),
        opts: qItem.opts.map((o) => o.trim()),
        topic: fullTopic,
        correct: Number(sol.correct),
        exp: (sol.exp || "").trim(),
        course: "সাধারণ কোর্স",
        subject: "সাধারণ জ্ঞান"
      };
    });
    
    await supabase.from("question_bank").insert(questionsInsert);

    invalidateConfigCache();
    return { success: true, count: newQuestions.length };
  } catch (err) {
    console.error("Add bulk topic questions error:", err);
    return { success: false, count: 0 };
  }
}

export async function addQuestionToBank(
  question: Omit<QuestionItem, "id">,
  solution: QuestionSolution
): Promise<boolean> {
  try {
    const rawTopic = question.topic?.trim() || null;
    const fullTopic = rawTopic && question.subtopic ? `${rawTopic} > ${question.subtopic.trim()}` : rawTopic;

    const { error } = await supabase.from("question_bank").insert({
      q: question.q.trim(),
      opts: question.opts.map((o) => o.trim()),
      topic: fullTopic,
      correct: Number(solution.correct),
      exp: solution.exp.trim()
    });
    if (error) throw error;
    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Add question to bank error:", err);
    return false;
  }
}

export async function updateQuestionInBank(
  id: string,
  question: QuestionItem,
  solution: QuestionSolution
): Promise<boolean> {
  try {
    const rawTopic = question.topic?.trim() || null;
    const fullTopic = rawTopic && question.subtopic ? `${rawTopic} > ${question.subtopic.trim()}` : rawTopic;

    const { error } = await supabase.from("question_bank").update({
      q: question.q.trim(),
      opts: question.opts.map((o) => o.trim()),
      topic: fullTopic,
      correct: Number(solution.correct),
      exp: solution.exp.trim()
    }).eq("id", id);
    if (error) throw error;
    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Update question in bank error:", err);
    return false;
  }
}

export async function deleteQuestionFromBank(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("question_bank").delete().eq("id", id);
    if (error) throw error;
    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Delete question from bank error:", err);
    return false;
  }
}

export async function bulkMoveQuestionsToTopic(
  questionIds: string[],
  newTopic: string,
  newSubtopic?: string
): Promise<boolean> {
  try {
    if (!questionIds.length) return true;
    const targetTopic = newSubtopic?.trim()
      ? `${newTopic.trim()} > ${newSubtopic.trim()}`
      : newTopic.trim();

    const { error } = await supabase
      .from("question_bank")
      .update({ topic: targetTopic })
      .in("id", questionIds);

    if (error) throw error;
    invalidateConfigCache();
    return true;
  } catch (err) {
    console.error("Bulk move questions error:", err);
    return false;
  }
}

export async function addBulkQuestionsToBank(
  newQuestions: QuestionItem[],
  newSolutions: QuestionSolution[],
  fallbackTopic?: string,
  fallbackSubtopic?: string
): Promise<{ success: boolean; count: number }> {
  try {
    if (!newQuestions.length) return { success: false, count: 0 };
    const questionsInsert = newQuestions.map((qItem, idx) => {
      const sol = newSolutions[idx] || { correct: 0, exp: "" };
      const rawTopic = (qItem.topic || fallbackTopic || "").trim();
      const rawSubtopic = (qItem.subtopic || fallbackSubtopic || "").trim();
      const fullTopic = rawTopic && rawSubtopic ? `${rawTopic} > ${rawSubtopic}` : (rawTopic || null);

      return {
        q: qItem.q.trim(),
        opts: qItem.opts.map((o) => o.trim()),
        topic: fullTopic,
        correct: Number(sol.correct),
        exp: (sol.exp || "").trim(),
        course: "সাধারণ কোর্স",
        subject: "সাধারণ জ্ঞান"
      };
    });
    const { error } = await supabase.from("question_bank").insert(questionsInsert);
    if (error) throw error;
    invalidateConfigCache();
    return { success: true, count: newQuestions.length };
  } catch (err) {
    console.error("Add bulk questions to bank error:", err);
    return { success: false, count: 0 };
  }
}
