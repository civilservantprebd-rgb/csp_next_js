"use server";

import { supabase } from "@/lib/supabase";
import type { PracticeQuestion, TopicOption } from "@/lib/practice-helper";

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
    //    already mirrored in topicQuestions — same rule as before)
    const { data: links } = await supabase
      .from("exam_questions_link")
      .select("question_bank(topic, q)");

    (links || []).forEach((link: any) => {
      const q = link.question_bank?.q;
      const t = String(link.question_bank?.topic || "").trim();
      if (t && q) {
        const isMirrored = (topicQuestions || []).some(
          (tq: any) => tq.q === q && String(tq.topic || "").trim() === t
        );
        if (!isMirrored) topicCountMap.set(t, (topicCountMap.get(t) || 0) + 1);
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
    // SECURITY: self-practice requires an enrolled student (any course)
    if (studentId) {
      const { verifyStudentAccess } = await import("@/actions/student-actions");
      const access = await verifyStudentAccess(studentId, "ALL", email);
      if (!access.allowed) return [];
    }

    const pool: PracticeQuestion[] = [];
    const normalizedTopic = selectedTopic.trim().toLowerCase();
    const isAll =
      !selectedTopic ||
      selectedTopic === "all" ||
      selectedTopic === "সকল বিষয় (মিক্সড)" ||
      selectedTopic === "সকল টপিক (মিক্সড)";

    // 1. Persistent Topic Questions repository
    const { data: topicQuestions } = await supabase
      .from("topic_questions")
      .select("id, topic, q, opts, correct, exp, original_subject, original_course, original_exam_title, exam_key");

    (topicQuestions || []).forEach((tq: any, idx: number) => {
      const t = String(tq.topic || "").trim().toLowerCase();
      const matchTopic = isAll || t === normalizedTopic || t.includes(normalizedTopic);
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

    // 2. Exam questions with the matching topic
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
      const examQuestions = (byExam[ex.id] || [])
        .sort((a: any, b: any) => Number(a.order_index) - Number(b.order_index))
        .map((l: any) => l.question_bank)
        .filter(Boolean);

      if (examQuestions.length === 0) continue;

      const matchingIndices: number[] = [];
      examQuestions.forEach((qItem: any, qIdx: number) => {
        const t = String(qItem.topic || "").trim().toLowerCase();
        const matchTopic = isAll ? t.length > 0 : t === normalizedTopic || t.includes(normalizedTopic);
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

    return uniqueList.slice(0, Math.min(count, uniqueList.length));
  } catch (err) {
    console.error("Get practice questions error:", err);
    return [];
  }
}
