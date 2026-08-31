import { AppConfigData } from "@/types/exam";
import { PracticeQuestion } from "./practice-helper";
import { getExamSolutions } from "@/actions/exam-actions";

export interface TreeNode {
  id: string;
  name: string;
  fullPath: string; // e.g. "বাংলা সাহিত্য > প্রাচীন যুগ > চর্যাপদ"
  count: number;
  children: TreeNode[];
  questions?: PracticeQuestion[];
}

/**
 * Splits a topic string into hierarchy segments
 * e.g. "বাংলা সাহিত্য > প্রাচীন যুগ > চর্যাপদ > পদকর্তা" -> ["বাংলা সাহিত্য", "প্রাচীন যুগ", "চর্যাপদ", "পদকর্তা"]
 */
export function getTopicSegments(rawTopic?: string, fallbackSubject?: string): string[] {
  if (!rawTopic || !rawTopic.trim()) {
    return [fallbackSubject || "সাধারণ জ্ঞান", "সাধারণ"];
  }
  const parts = rawTopic.split(/\s*[>›/|]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [fallbackSubject || "সাধারণ জ্ঞান"];
  return parts;
}

/**
 * Builds an N-level deep recursive tree of topics and subtopics
 */
export function buildDeepTopicTree(config?: AppConfigData | null): TreeNode[] {
  if (!config) return [];

  interface InternalNode {
    name: string;
    fullPath: string;
    count: number;
    children: Map<string, InternalNode>;
  }

  const rootMap = new Map<string, InternalNode>();

  const insertPath = (segments: string[]) => {
    if (segments.length === 0) return;

    let currentMap = rootMap;
    let accumulatedPath = "";

    segments.forEach((seg, idx) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath} > ${seg}` : seg;

      if (!currentMap.has(seg)) {
        currentMap.set(seg, {
          name: seg,
          fullPath: accumulatedPath,
          count: 0,
          children: new Map()
        });
      }

      const node = currentMap.get(seg)!;
      node.count += 1;
      currentMap = node.children;
    });
  };

  // 1. Topic Questions
  if (config.topicQuestions) {
    config.topicQuestions.forEach((tq) => {
      const segs = getTopicSegments(tq.topic, tq.originalSubject);
      insertPath(segs);
    });
  }

  // 2. Exam questions
  if (config.exams) {
    Object.values(config.exams).forEach((ex) => {
      (ex.questions || []).forEach((q) => {
        const segs = getTopicSegments(q.topic, ex.subject);
        insertPath(segs);
      });
    });
  }

  // 3. Registered empty topics
  if (config.topics) {
    config.topics.forEach((t) => {
      const segs = getTopicSegments(t);
      // insert empty if not already created
      let currentMap = rootMap;
      let accumulatedPath = "";
      segs.forEach((seg) => {
        accumulatedPath = accumulatedPath ? `${accumulatedPath} > ${seg}` : seg;
        if (!currentMap.has(seg)) {
          currentMap.set(seg, {
            name: seg,
            fullPath: accumulatedPath,
            count: 0,
            children: new Map()
          });
        }
        currentMap = currentMap.get(seg)!.children;
      });
    });
  }

  // Convert map to recursive TreeNode array
  const formatNode = (internal: InternalNode): TreeNode => {
    const childrenArr = Array.from(internal.children.values()).map(formatNode);
    return {
      id: internal.fullPath,
      name: internal.name,
      fullPath: internal.fullPath,
      count: internal.count,
      children: childrenArr.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, "bn");
      })
    };
  };

  const roots = Array.from(rootMap.values()).map(formatNode);
  return roots.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, "bn");
  });
}

/**
 * Fetch all questions that match a given prefix path or any subtopic
 */
export async function getQuestionsForPath(
  config: AppConfigData | null | undefined,
  targetPath: string
): Promise<PracticeQuestion[]> {
  if (!config) return [];
  const pool: PracticeQuestion[] = [];
  const cleanTarget = targetPath.trim().toLowerCase();

  const isMatch = (rawTopic?: string, fallbackSubject?: string) => {
    if (!cleanTarget || cleanTarget === "all") return true;
    const segs = getTopicSegments(rawTopic, fallbackSubject);
    const full = segs.join(" > ").toLowerCase();
    return full === cleanTarget || full.startsWith(cleanTarget + " > ") || segs.some(s => s.toLowerCase() === cleanTarget);
  };

  // 1. Topic Questions
  if (config.topicQuestions) {
    config.topicQuestions.forEach((tq, idx) => {
      if (isMatch(tq.topic, tq.originalSubject) && tq.q && tq.opts && tq.opts.length >= 2) {
        pool.push({
          id: tq.id || `tq_${idx}`,
          q: tq.q,
          opts: tq.opts,
          correct: Number(tq.correct ?? 0),
          exp: tq.exp || "",
          subject: tq.originalSubject || "পড়াশোনা",
          topic: tq.topic
        });
      }
    });
  }

  // 2. Exam Questions
  if (config.exams) {
    for (const [examKey, ex] of Object.entries(config.exams)) {
      if (!ex.questions) continue;
      const matchingIndices: number[] = [];
      ex.questions.forEach((qItem, qIdx) => {
        if (isMatch(qItem.topic, ex.subject)) {
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
            subject: ex.subject || "পড়াশোনা",
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
