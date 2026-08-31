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

export interface TopicOption {
  name: string;
  count: number;
}

/**
 * Extract all unique topics and their total question count from topicQuestions and exams
 */
export function getAvailablePracticeTopics(config: AppConfigData): TopicOption[] {
  const topicCountMap = new Map<string, number>();

  // 1. Registered topic list in config
  if (config.topics && config.topics.length > 0) {
    config.topics.forEach((t) => {
      const trimmed = t.trim();
      if (trimmed && !topicCountMap.has(trimmed)) {
        topicCountMap.set(trimmed, 0);
      }
    });
  }

  // 2. Count from permanent topicQuestions repository
  if (config.topicQuestions && config.topicQuestions.length > 0) {
    config.topicQuestions.forEach((tq) => {
      const t = (tq.topic || "").trim();
      if (t) {
        topicCountMap.set(t, (topicCountMap.get(t) || 0) + 1);
      }
    });
  }

  // 3. Count from exams where question has a topic tag
  if (config.exams) {
    Object.values(config.exams).forEach((ex) => {
      (ex.questions || []).forEach((q) => {
        const t = (q.topic || "").trim();
        if (t) {
          // If already in map, we increment only if this question wasn't already mirrored in topicQuestions
          if (!config.topicQuestions?.some((tq) => tq.q === q.q && tq.topic === t)) {
            topicCountMap.set(t, (topicCountMap.get(t) || 0) + 1);
          }
        }
      });
    });
  }

  const result: TopicOption[] = [];
  topicCountMap.forEach((count, name) => {
    result.push({ name, count });
  });

  // Sort topics alphabetically or by question count
  return result.sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name, "bn")));
}

/**
 * Generate a randomized practice question pool specifically filtered by selected Topic
 */
export async function generatePracticeQuestions(
  config: AppConfigData,
  selectedTopic: string,
  count: number
): Promise<PracticeQuestion[]> {
  const pool: PracticeQuestion[] = [];
  const normalizedTopic = selectedTopic.trim().toLowerCase();
  const isAll =
    !selectedTopic ||
    selectedTopic === "all" ||
    selectedTopic === "সকল বিষয় (মিক্সড)" ||
    selectedTopic === "সকল টপিক (মিক্সড)";

  // 1. Collect from persistent Topic Questions repository
  if (config.topicQuestions && config.topicQuestions.length > 0) {
    config.topicQuestions.forEach((tq, idx) => {
      const t = (tq.topic || "").trim().toLowerCase();
      const matchTopic = isAll || t === normalizedTopic || t.includes(normalizedTopic);

      if (matchTopic && tq.q && tq.opts && tq.opts.length >= 2) {
        pool.push({
          id: tq.id || `tq_${idx}`,
          q: tq.q,
          opts: tq.opts,
          correct: Number(tq.correct ?? 0),
          exp: tq.exp || "",
          subject: tq.originalSubject || tq.topic || "টপিক ভিত্তিক",
          topic: tq.topic
        });
      }
    });
  }

  // 2. Also collect from exams where question has the matching topic
  if (config.exams) {
    for (const [examKey, ex] of Object.entries(config.exams)) {
      if (!ex.questions || ex.questions.length === 0) continue;

      const matchingIndices: number[] = [];
      ex.questions.forEach((qItem, qIdx) => {
        const t = (qItem.topic || "").trim().toLowerCase();
        const matchTopic = isAll ? (t.length > 0) : (t === normalizedTopic || t.includes(normalizedTopic));
        if (matchTopic) {
          matchingIndices.push(qIdx);
        }
      });

      if (matchingIndices.length > 0) {
        const solutions = await getExamSolutions(examKey);
        // SECURITY/CORRECTNESS: when solutions are locked (live exam) or the
        // fetch failed, NEVER fall back to a fabricated "ক" answer — skip these
        // questions entirely so students never practice against wrong answers.
        if (!solutions) continue;
        matchingIndices.forEach((qIdx) => {
          const qItem = ex.questions![qIdx];
          const sol = solutions[qIdx] || { correct: 0, exp: "" };
          pool.push({
            id: `ex_${examKey}_${qIdx}`,
            q: qItem.q,
            opts: qItem.opts,
            correct: Number(sol.correct ?? 0),
            exp: sol.exp || "",
            subject: ex.subject || qItem.topic || "টপিক ভিত্তিক",
            topic: qItem.topic
          });
        });
      }
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
