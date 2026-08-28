import { AppConfigData } from "@/types/exam";
import { PracticeQuestion } from "./practice-helper";
import { getExamSolutions } from "@/actions/exam-actions";

export interface HierarchicalSubtopic {
  name: string;
  count: number;
}

export interface HierarchicalTopic {
  name: string;
  count: number;
  subtopics: HierarchicalSubtopic[];
}

export interface HierarchicalSubject {
  name: string;
  count: number;
  topics: HierarchicalTopic[];
}

/**
 * Parses a single topic string e.g. "আন্তর্জাতিক বিষয়াবলী > পরিবেশ ও দুর্যোগ > আন্তর্জাতিক চুক্তি"
 * or "পরিবেশ > চুক্তি" or "সাধারণ" into { subject, chapter/topic, subtopic }
 */
export function parseTopicHierarchy(rawTopic?: string, fallbackSubject?: string): {
  subject: string;
  topic: string;
  subtopic: string;
} {
  if (!rawTopic || !rawTopic.trim()) {
    return {
      subject: fallbackSubject || "সাধারণ জ্ঞান",
      topic: "সাধারণ",
      subtopic: ""
    };
  }

  const parts = rawTopic.split(/\s*[>›/|]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    return {
      subject: fallbackSubject || "সাধারণ জ্ঞান",
      topic: parts[0],
      subtopic: ""
    };
  } else if (parts.length === 2) {
    return {
      subject: fallbackSubject || parts[0],
      topic: parts[0],
      subtopic: parts[1]
    };
  } else {
    // 3 or more parts e.g. [Subject, Topic/Chapter, Subtopic...]
    return {
      subject: parts[0],
      topic: parts[1],
      subtopic: parts.slice(2).join(" > ")
    };
  }
}

/**
 * Builds a fast hierarchical subject->topic->subtopic tree from app config questions
 */
export function buildTopicHierarchyTree(config: AppConfigData): HierarchicalSubject[] {
  const treeMap = new Map<string, Map<string, Map<string, number>>>();

  // Helper to increment counts
  const registerQuestion = (rawTopic?: string, fallbackSubject?: string) => {
    const { subject, topic, subtopic } = parseTopicHierarchy(rawTopic, fallbackSubject);
    
    if (!treeMap.has(subject)) {
      treeMap.set(subject, new Map());
    }
    const topicMap = treeMap.get(subject)!;

    if (!topicMap.has(topic)) {
      topicMap.set(topic, new Map());
    }
    const subMap = topicMap.get(topic)!;

    const subKey = subtopic || "মূল অধ্যায়";
    subMap.set(subKey, (subMap.get(subKey) || 0) + 1);
  };

  // 1. From persistent topicQuestions
  if (config.topicQuestions && config.topicQuestions.length > 0) {
    config.topicQuestions.forEach((tq) => {
      registerQuestion(tq.topic, tq.originalSubject);
    });
  }

  // 2. From registered topics in config (if empty)
  if (config.topics && config.topics.length > 0) {
    config.topics.forEach((t) => {
      const { subject, topic, subtopic } = parseTopicHierarchy(t);
      if (!treeMap.has(subject)) treeMap.set(subject, new Map());
      const topicMap = treeMap.get(subject)!;
      if (!topicMap.has(topic)) topicMap.set(topic, new Map());
      const subMap = topicMap.get(topic)!;
      const subKey = subtopic || "মূল অধ্যায়";
      if (!subMap.has(subKey)) subMap.set(subKey, 0);
    });
  }

  // Transform map to array
  const subjects: HierarchicalSubject[] = [];

  treeMap.forEach((topicMap, subjectName) => {
    let subjectTotalCount = 0;
    const topics: HierarchicalTopic[] = [];

    topicMap.forEach((subMap, topicName) => {
      let topicTotalCount = 0;
      const subtopics: HierarchicalSubtopic[] = [];

      subMap.forEach((count, subName) => {
        topicTotalCount += count;
        subtopics.push({ name: subName, count });
      });

      subjectTotalCount += topicTotalCount;
      topics.push({
        name: topicName,
        count: topicTotalCount,
        subtopics: subtopics.sort((a, b) => b.count - a.count)
      });
    });

    subjects.push({
      name: subjectName,
      count: subjectTotalCount,
      topics: topics.sort((a, b) => b.count - a.count)
    });
  });

  return subjects.sort((a, b) => b.count - a.count);
}

/**
 * Fetch all questions for reading or quiz matching a specific Subject / Topic / Subtopic
 */
export async function getQuestionsForHierarchyNode(
  config: AppConfigData,
  filter: {
    subject?: string;
    topic?: string;
    subtopic?: string;
  }
): Promise<PracticeQuestion[]> {
  const pool: PracticeQuestion[] = [];

  const checkMatch = (rawTopic?: string, fallbackSubject?: string) => {
    const node = parseTopicHierarchy(rawTopic, fallbackSubject);

    if (filter.subject && filter.subject !== "ALL" && node.subject !== filter.subject && !node.subject.includes(filter.subject)) {
      return false;
    }
    if (filter.topic && filter.topic !== "ALL" && node.topic !== filter.topic && !node.topic.includes(filter.topic)) {
      return false;
    }
    if (filter.subtopic && filter.subtopic !== "ALL" && filter.subtopic !== "মূল অধ্যায়") {
      if (node.subtopic !== filter.subtopic && !node.subtopic.includes(filter.subtopic)) {
        return false;
      }
    }
    return true;
  };

  // 1. Collect from topic_questions
  if (config.topicQuestions) {
    config.topicQuestions.forEach((tq, idx) => {
      if (checkMatch(tq.topic, tq.originalSubject) && tq.q && tq.opts && tq.opts.length >= 2) {
        pool.push({
          id: tq.id || `tq_${idx}`,
          q: tq.q,
          opts: tq.opts,
          correct: Number(tq.correct ?? 0),
          exp: tq.exp || "",
          subject: tq.originalSubject || "বিষয়ভিত্তিক",
          topic: tq.topic
        });
      }
    });
  }

  // 2. Collect from exams
  if (config.exams) {
    for (const [examKey, ex] of Object.entries(config.exams)) {
      if (!ex.questions) continue;
      const matchingIndices: number[] = [];
      ex.questions.forEach((qItem, qIdx) => {
        if (checkMatch(qItem.topic, ex.subject)) {
          matchingIndices.push(qIdx);
        }
      });

      if (matchingIndices.length > 0) {
        const solutions = (await getExamSolutions(examKey)) || [];
        matchingIndices.forEach((qIdx) => {
          const qItem = ex.questions![qIdx];
          const sol = solutions[qIdx] || { correct: 0, exp: "" };
          pool.push({
            id: `ex_${examKey}_${qIdx}`,
            q: qItem.q,
            opts: qItem.opts,
            correct: Number(sol.correct ?? 0),
            exp: sol.exp || "",
            subject: ex.subject || "বিষয়ভিত্তিক",
            topic: qItem.topic
          });
        });
      }
    }
  }

  // Deduplicate
  const uniqueMap = new Map<string, PracticeQuestion>();
  pool.forEach((item) => {
    const key = item.q.trim().toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });

  return Array.from(uniqueMap.values());
}
