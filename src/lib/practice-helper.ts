import { AppConfigData, QuestionItem, QuestionSolution } from "@/types/exam";
import { getExamSolutions } from "@/actions/exam-actions";

export interface PracticeQuestion {
  id: string;
  q: string;
  opts: string[];
  correct: number;
  exp: string;
  subject: string;
  topic?: string;
}

/**
 * Extract all unique subjects available from both exams and topic questions
 */
export function getAvailablePracticeSubjects(config: AppConfigData): string[] {
  const subjectSet = new Set<string>();

  // From registered subjects
  if (config.subjects && config.subjects.length > 0) {
    config.subjects.forEach((s) => {
      if (s.name?.trim()) subjectSet.add(s.name.trim());
    });
  }

  // From exams
  if (config.exams) {
    Object.values(config.exams).forEach((ex) => {
      if (ex.subject?.trim()) subjectSet.add(ex.subject.trim());
    });
  }

  // From topic questions
  if (config.topicQuestions) {
    config.topicQuestions.forEach((tq) => {
      if (tq.originalSubject?.trim()) subjectSet.add(tq.originalSubject.trim());
      if (tq.topic?.trim()) subjectSet.add(tq.topic.trim());
    });
  }

  return Array.from(subjectSet);
}

/**
 * Generate a randomized practice question pool for the chosen subject/topic
 */
export async function generatePracticeQuestions(
  config: AppConfigData,
  selectedSubject: string,
  count: number
): Promise<PracticeQuestion[]> {
  const pool: PracticeQuestion[] = [];
  const normalizedSubject = selectedSubject.trim().toLowerCase();
  const isAll = !selectedSubject || selectedSubject === "all" || selectedSubject === "সকল বিষয়";

  // 1. Collect from topicQuestions first (they already have correct answer and explanation!)
  if (config.topicQuestions && config.topicQuestions.length > 0) {
    config.topicQuestions.forEach((tq, idx) => {
      const matchSubject =
        isAll ||
        (tq.originalSubject && tq.originalSubject.toLowerCase().includes(normalizedSubject)) ||
        (tq.topic && tq.topic.toLowerCase().includes(normalizedSubject));

      if (matchSubject && tq.q && tq.opts && tq.opts.length >= 2) {
        pool.push({
          id: tq.id || `tq_${idx}`,
          q: tq.q,
          opts: tq.opts,
          correct: Number(tq.correct ?? 0),
          exp: tq.exp || "",
          subject: tq.originalSubject || tq.topic || "সাধারণ",
          topic: tq.topic
        });
      }
    });
  }

  // 2. Also collect from exams matching the subject
  if (config.exams) {
    const matchingExamEntries = Object.entries(config.exams).filter(([_, ex]) => {
      if (isAll) return true;
      const exSub = (ex.subject || "").toLowerCase();
      const exCourse = (ex.course || "").toLowerCase();
      return exSub.includes(normalizedSubject) || exCourse.includes(normalizedSubject);
    });

    for (const [examKey, ex] of matchingExamEntries) {
      if (!ex.questions || ex.questions.length === 0) continue;

      // fetch solutions for this exam
      const solutions = (await getExamSolutions(examKey)) || [];

      ex.questions.forEach((qItem, qIdx) => {
        const sol = solutions[qIdx] || { correct: 0, exp: "" };
        pool.push({
          id: `ex_${examKey}_${qIdx}`,
          q: qItem.q,
          opts: qItem.opts,
          correct: Number(sol.correct ?? 0),
          exp: sol.exp || "",
          subject: ex.subject || "সাধারণ",
          topic: qItem.topic
        });
      });
    }
  }

  // Deduplicate questions by question text
  const uniqueMap = new Map<string, PracticeQuestion>();
  pool.forEach((item) => {
    const key = item.q.trim().toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });

  const uniqueList = Array.from(uniqueMap.values());

  // Shuffle array using Fisher-Yates
  for (let i = uniqueList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueList[i], uniqueList[j]] = [uniqueList[j], uniqueList[i]];
  }

  return uniqueList.slice(0, Math.min(count, uniqueList.length));
}
