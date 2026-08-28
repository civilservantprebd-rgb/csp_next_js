import { QuestionItem, QuestionSolution } from "@/types/exam";

export interface MistakeQuestionItem {
  id: string;
  q: string;
  opts: string[];
  correct: number;
  exp: string;
  userAns: number | null;
  examTitle: string;
  subject?: string;
  topic?: string;
  timestamp: string;
  isBookmarked?: boolean;
}

const MISTAKES_KEY_PREFIX = "csp_student_mistakes_";
const BOOKMARKS_KEY_PREFIX = "csp_student_bookmarks_";

/**
 * Get all stored mistakes for a student
 */
export function getStudentMistakes(studentId: string): MistakeQuestionItem[] {
  if (typeof window === "undefined" || !studentId) return [];
  try {
    const raw = localStorage.getItem(`${MISTAKES_KEY_PREFIX}${studentId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Error loading student mistakes:", err);
    return [];
  }
}

/**
 * Get all stored bookmarks for a student
 */
export function getStudentBookmarks(studentId: string): MistakeQuestionItem[] {
  if (typeof window === "undefined" || !studentId) return [];
  try {
    const raw = localStorage.getItem(`${BOOKMARKS_KEY_PREFIX}${studentId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Error loading student bookmarks:", err);
    return [];
  }
}

/**
 * Save mistakes when a student finishes an exam
 */
export function saveMistakesFromSubmission(
  studentId: string,
  examTitle: string,
  questions: QuestionItem[],
  solutions: QuestionSolution[],
  answers: (number | null)[],
  subject?: string
): void {
  if (typeof window === "undefined" || !studentId || !questions.length) return;
  try {
    const currentMistakes = getStudentMistakes(studentId);
    const existingQTexts = new Set(currentMistakes.map((m) => m.q.trim().toLowerCase()));

    questions.forEach((q, idx) => {
      const userAns = answers[idx] ?? null;
      const sol = solutions[idx] || { correct: 0, exp: "" };

      // If wrong answer or skipped
      if (userAns !== sol.correct) {
        const qKey = q.q.trim().toLowerCase();
        if (!existingQTexts.has(qKey)) {
          currentMistakes.unshift({
            id: `mistake_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            q: q.q,
            opts: q.opts,
            correct: sol.correct,
            exp: sol.exp,
            userAns,
            examTitle,
            subject: subject || "সাধারণ",
            topic: q.topic,
            timestamp: new Date().toISOString()
          });
          existingQTexts.add(qKey);
        }
      }
    });

    localStorage.setItem(`${MISTAKES_KEY_PREFIX}${studentId}`, JSON.stringify(currentMistakes.slice(0, 200)));
  } catch (err) {
    console.error("Error saving mistakes:", err);
  }
}

/**
 * Toggle bookmark for a question
 */
export function toggleQuestionBookmark(
  studentId: string,
  item: {
    q: string;
    opts: string[];
    correct: number;
    exp: string;
    userAns?: number | null;
    examTitle?: string;
    subject?: string;
    topic?: string;
  }
): boolean {
  if (typeof window === "undefined" || !studentId) return false;
  try {
    const bookmarks = getStudentBookmarks(studentId);
    const qKey = item.q.trim().toLowerCase();
    const existingIdx = bookmarks.findIndex((b) => b.q.trim().toLowerCase() === qKey);

    if (existingIdx >= 0) {
      // Remove bookmark
      bookmarks.splice(existingIdx, 1);
      localStorage.setItem(`${BOOKMARKS_KEY_PREFIX}${studentId}`, JSON.stringify(bookmarks));
      return false;
    } else {
      // Add bookmark
      bookmarks.unshift({
        id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        q: item.q,
        opts: item.opts,
        correct: item.correct,
        exp: item.exp,
        userAns: item.userAns ?? null,
        examTitle: item.examTitle || "বুকমার্ককৃত প্রশ্ন",
        subject: item.subject || "সাধারণ",
        topic: item.topic,
        timestamp: new Date().toISOString(),
        isBookmarked: true
      });
      localStorage.setItem(`${BOOKMARKS_KEY_PREFIX}${studentId}`, JSON.stringify(bookmarks));
      return true;
    }
  } catch (err) {
    console.error("Error toggling bookmark:", err);
    return false;
  }
}

/**
 * Check if a question is bookmarked
 */
export function isQuestionBookmarked(studentId: string, questionText: string): boolean {
  if (typeof window === "undefined" || !studentId || !questionText) return false;
  const bookmarks = getStudentBookmarks(studentId);
  const qKey = questionText.trim().toLowerCase();
  return bookmarks.some((b) => b.q.trim().toLowerCase() === qKey);
}

/**
 * Remove a mistake from mistake notebook
 */
export function removeStudentMistake(studentId: string, mistakeId: string): MistakeQuestionItem[] {
  if (typeof window === "undefined" || !studentId) return [];
  const mistakes = getStudentMistakes(studentId).filter((m) => m.id !== mistakeId);
  localStorage.setItem(`${MISTAKES_KEY_PREFIX}${studentId}`, JSON.stringify(mistakes));
  return mistakes;
}

/**
 * Clear all mistakes for a student
 */
export function clearAllStudentMistakes(studentId: string): void {
  if (typeof window === "undefined" || !studentId) return;
  localStorage.removeItem(`${MISTAKES_KEY_PREFIX}${studentId}`);
}
