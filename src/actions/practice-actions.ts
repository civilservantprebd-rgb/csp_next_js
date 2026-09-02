"use server";

import { supabase } from "@/lib/supabase";
import type { PracticeQuestion, TopicOption } from "@/lib/practice-helper";
import type { Exam } from "@/types/exam";

/**
 * Server-side Self-Practice data.
 *
 * Previously the home page shipped the ENTIRE topic_questions table + every
 * exam's questions to the client just to build the practice pool. Now the
 * questions are fetched from the database only when a practice session
 * actually starts — the home page stays light.
 */

export async function getPracticeTopics(): Promise<TopicOption[]> {
  try {
    const topicCountMap = new Map<string, number>();

    // 1. Registered topic list in app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("topics")
      .eq("id", "main")
      .maybeSingle();
    const registered: string[] = settings?.topics || [];
    registered.forEach((t) => {
      const trimmed = String(t || "").trim();
      if (trimmed && !topicCountMap.has(trimmed)) topicCountMap.set(trimmed, 0);
    });

    // 2. Count from permanent topicQuestions repository
    const { data: topicQuestions } = await supabase
      .from("topic_questions")
      .select("topic, q");

    (topicQuestions || []).forEach((tq: any) => {
      const t = String(tq.topic || "").trim();
      if (t) topicCountMap.set(t, (topicCountMap.get(t) || 0) + 1);
    });

    // 3. Count from exams where question has a topic tag (excluding questions
    //    already mirrored in topicQuestions). Matching uses NORMALIZED keys
    //    (trim + lowercase) so whitespace/format variance never double-counts,
    //    and the check is O(1) per link via a precomputed set.
    const { data: links } = await supabase
      .from("exam_questions_link")
      .select("question_bank(topic, q)");

    const norm = (s: string) => String(s || "").trim().toLowerCase();
    const mirroredKeys = new Set(
      (topicQuestions || []).map((tq: any) => `${norm(tq.q)}___${norm(tq.topic)}`)
    );

    (links || []).forEach((link: any) => {
      const q = link.question_bank?.q;
      const t = String(link.question_bank?.topic || "").trim();
      if (t && q) {
        const key = `${norm(q)}___${norm(t)}`;
        if (!mirroredKeys.has(key)) topicCountMap.set(t, (topicCountMap.get(t) || 0) + 1);
      }
    });

    const result: TopicOption[] = [];
    topicCountMap.forEach((count, name) => result.push({ name, count }));
    return result.sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name, "bn")
    );
  } catch (err) {
    console.error("Get practice topics error:", err);
    return [];
  }
}

export async function getPracticeQuestions(
  selectedTopic: string,
  count: number,
  studentId?: string,
  email?: string
): Promise<PracticeQuestion[]> {
  try {
    // SECURITY: self-practice requires an enrolled student (any course) —
    // UNLESS the caller is a verified teacher (admins may browse the whole
    // bank, including not-yet-released exams — they are the content owners).
    const { isTeacherSession } = await import("@/lib/teacher-auth");
    const isTeacher = await isTeacherSession();

    const cleanId = String(studentId || "").trim();
    let access: { allowed: boolean; courses?: string[] } | null = null;
    if (isTeacher) {
      access = { allowed: true, courses: ["all"] };
    } else {
      if (!cleanId) return [];
      const { verifyStudentAccess } = await import("@/actions/student-actions");
      access = await verifyStudentAccess(cleanId, "ALL", email);
      if (!access.allowed) return [];
    }

    const studentCourses = (access.courses || [])
      .map((c) => String(c || "").trim().toLowerCase())
      .filter(Boolean);

    const requestedCount = Math.max(1, Math.min(50, Number(count) || 10));

    const pool: PracticeQuestion[] = [];
    const normalizedTopic = selectedTopic.trim().toLowerCase();
    const isAll =
      !selectedTopic ||
      selectedTopic === "all" ||
      selectedTopic === "সকল বিষয় (মিক্সড)" ||
      selectedTopic === "সকল টপিক (মিক্সড)";

    // Segment-boundary topic matching (not raw substring): selecting "বাংলা"
    // matches "বাংলা" and "বাংলা > প্রাচীন যুগ" (descendants) but NOT
    // "বাংলাদেশ বিষয়াবলী". Consistent with fetchTopicQuestionsForStudent.
    const { getTopicSegments } = await import("@/lib/topic-hierarchy");
    const isTopicMatch = (rawTopic?: string | null): boolean => {
      if (!rawTopic || !String(rawTopic).trim()) return false;
      const segs = getTopicSegments(String(rawTopic));
      const full = segs.join(" > ").toLowerCase();
      return (
        full === normalizedTopic ||
        full.startsWith(normalizedTopic + " > ") ||
        segs.some((s: string) => s.toLowerCase() === normalizedTopic)
      );
    };

    // Build exam access/lock info once: which exams the student may practice
    // (course scope) and which exams still have answer-locked keys (scheduled
    // exams that have not reached their answer-release time).
    const { isAnswerTimeReached } = await import("@/lib/bangladesh-time");
    const { data: allExams } = await supabase
      .from("exams")
      .select("id, course, start_time, end_time, leaderboard_end_time, is_result_published");

    const lockedExamIds = new Set<string>();
    const accessibleExamIds = new Set<string>();
    (allExams || []).forEach((ex: any) => {
      const examObj = {
        id: ex.id,
        startTime: ex.start_time,
        endTime: ex.end_time,
        leaderboardEndTime: ex.leaderboard_end_time,
        isResultPublished: ex.is_result_published === true
      } as Exam;
      const isScheduled = !!(ex.start_time && (ex.end_time || ex.leaderboard_end_time));
      if (!isTeacher && isScheduled && !isAnswerTimeReached(examObj)) lockedExamIds.add(ex.id);

      const exCourse = String(ex.course || "").trim().toLowerCase();
      const hasCourseAccess =
        studentCourses.includes("all") ||
        studentCourses.includes("সকল কোর্স") ||
        exCourse === "সাধারণ কোর্স" ||
        studentCourses.includes(exCourse);
      if (hasCourseAccess) accessibleExamIds.add(ex.id);
    });

    // 1. Persistent Topic Questions repository (skip questions mirrored from
    //    answer-locked exams or from exams of courses the student is not in).
    const { data: topicQuestions } = await supabase
      .from("topic_questions")
      .select("id, topic, q, opts, correct, exp, original_subject, original_course, original_exam_title, exam_key");

    (topicQuestions || []).forEach((tq: any, idx: number) => {
      const matchTopic = isAll || isTopicMatch(tq.topic);
      if (tq.exam_key) {
        if (lockedExamIds.has(tq.exam_key)) return;
        if (!accessibleExamIds.has(tq.exam_key)) return;
      }
      if (matchTopic && tq.q && tq.opts && tq.opts.length >= 2) {
        pool.push({
          id: tq.id || `tq_${idx}`,
          q: tq.q,
          opts: tq.opts,
          correct: Number(tq.correct ?? 0),
          exp: tq.exp || "",
          subject: tq.original_subject || tq.topic || "টপিক ভিত্তিক",
          topic: tq.topic
        });
      }
    });

    // 2. Exam questions with the matching topic — only from accessible exams
    //    whose answers are released (always-open practice exams are fine).
    const { data: examDataList } = await supabase
      .from("exams")
      .select("id, subject, course, title");

    const { data: links } = await supabase
      .from("exam_questions_link")
      .select("exam_id, order_index, question_bank(id, q, opts, topic, correct, exp)");

    const byExam: Record<string, any[]> = {};
    (links || []).forEach((link: any) => {
      if (!byExam[link.exam_id]) byExam[link.exam_id] = [];
      byExam[link.exam_id].push(link);
    });

    for (const ex of examDataList || []) {
      if (lockedExamIds.has(ex.id)) continue;
      if (!accessibleExamIds.has(ex.id)) continue;

      const examQuestions = (byExam[ex.id] || [])
        .sort((a: any, b: any) => Number(a.order_index) - Number(b.order_index))
        .map((l: any) => l.question_bank)
        .filter(Boolean);

      if (examQuestions.length === 0) continue;

      const matchingIndices: number[] = [];
      examQuestions.forEach((qItem: any, qIdx: number) => {
        const matchTopic = isAll ? String(qItem.topic || "").trim().length > 0 : isTopicMatch(qItem.topic);
        if (matchTopic) matchingIndices.push(qIdx);
      });

      matchingIndices.forEach((qIdx) => {
        const qItem = examQuestions[qIdx];
        pool.push({
          id: `ex_${ex.id}_${qIdx}`,
          q: qItem.q,
          opts: qItem.opts,
          correct: Number(qItem.correct ?? 0),
          exp: qItem.exp || "",
          subject: ex.subject || qItem.topic || "টপিক ভিত্তিক",
          topic: qItem.topic
        });
      });
    }

    // Deduplicate by question text (same as before)
    const uniqueMap = new Map<string, PracticeQuestion>();
    pool.forEach((item) => {
      const key = item.q.trim().toLowerCase();
      if (!uniqueMap.has(key)) uniqueMap.set(key, item);
    });

    const uniqueList = Array.from(uniqueMap.values());

    // Fisher-Yates shuffle (same as before)
    for (let i = uniqueList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueList[i], uniqueList[j]] = [uniqueList[j], uniqueList[i]];
    }

    return uniqueList.slice(0, requestedCount);
  } catch (err) {
    console.error("Get practice questions error:", err);
    return [];
  }
}
