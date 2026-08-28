import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  updateDoc,
  deleteField
} from "firebase/firestore";
import { AppConfigData, Exam, QuestionItem, QuestionSolution } from "@/types/exam";
import { getExamSolutions } from "@/actions/exam-actions";

let cachedConfig: AppConfigData | null = null;
let lastFetchTime = 0;
let inflightFetch: Promise<AppConfigData> | null = null;
const CACHE_TTL_MS = 20000; // 20 seconds cache for lightning-fast page navigation

export function invalidateConfigCache() {
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
    exams: {},
    teacherPass: "1234",
    driveRoutineUrl: "https://drive.google.com",
    driveSyllabusUrl: "https://drive.google.com"
  };

  inflightFetch = (async () => {
    try {
      const snap = await getDoc(doc(db, "app_config", "bcs_data"));
      if (snap.exists()) {
        const data = snap.data() as AppConfigData;
        cachedConfig = data;
        lastFetchTime = Date.now();
        return data;
      }
    } catch (err) {
      console.error("Fetch app config error:", err);
    } finally {
      inflightFetch = null;
    }
    cachedConfig = defaultData;
    lastFetchTime = Date.now();
    return defaultData;
  })();

  return inflightFetch;
}

export async function saveAppConfig(config: Partial<AppConfigData>): Promise<boolean> {
  try {
    await setDoc(doc(db, "app_config", "bcs_data"), config, { merge: true });
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
    const config = await fetchAppConfig();
    if (!config.exams) config.exams = {};

    config.exams[examKey] = {
      ...examData,
      id: examKey,
      questions: []
    };

    await saveAppConfig({ exams: config.exams });
    return examKey;
  } catch (err) {
    console.error("Create exam error:", err);
    return null;
  }
}

export async function updateExam(examKey: string, examData: Partial<Exam>): Promise<boolean> {
  try {
    const config = await fetchAppConfig();
    if (!config.exams || !config.exams[examKey]) return false;

    config.exams[examKey] = {
      ...config.exams[examKey],
      ...examData
    };

    await saveAppConfig({ exams: config.exams });
    return true;
  } catch (err) {
    console.error("Update exam error:", err);
    return false;
  }
}

export async function deleteExam(examKey: string): Promise<boolean> {
  try {
    const config = await fetchAppConfig();
    if (config.exams && config.exams[examKey]) {
      delete config.exams[examKey];
      const ref = doc(db, "app_config", "bcs_data");
      await updateDoc(ref, {
        [`exams.${examKey}`]: deleteField()
      });
      invalidateConfigCache();
      await deleteDoc(doc(db, "exam_solutions", examKey)).catch(() => {});
      return true;
    }
    return false;
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
    const config = await fetchAppConfig();
    const exam = config.exams?.[examKey];
    if (!exam) return false;

    if (!exam.questions) exam.questions = [];
    exam.questions.push({ q: question.q, opts: question.opts });

    const solutions = (await getExamSolutions(examKey)) || [];
    solutions.push(solution);

    await setDoc(doc(db, "exam_solutions", examKey), {
      examKey,
      solutions,
      updatedAt: new Date().toISOString()
    });

    await saveAppConfig({ exams: config.exams });
    return true;
  } catch (err) {
    console.error("Add question error:", err);
    return false;
  }
}

export async function updateQuestionInExam(
  examKey: string,
  index: number,
  question: QuestionItem,
  solution: QuestionSolution
): Promise<boolean> {
  try {
    const config = await fetchAppConfig();
    const exam = config.exams?.[examKey];
    if (!exam || !exam.questions || !exam.questions[index]) return false;

    exam.questions[index] = { q: question.q, opts: question.opts };

    const solutions = (await getExamSolutions(examKey)) || [];
    solutions[index] = solution;

    await setDoc(doc(db, "exam_solutions", examKey), {
      examKey,
      solutions,
      updatedAt: new Date().toISOString()
    });

    await saveAppConfig({ exams: config.exams });
    return true;
  } catch (err) {
    console.error("Update question error:", err);
    return false;
  }
}

export async function deleteQuestionFromExam(examKey: string, index: number): Promise<boolean> {
  try {
    const config = await fetchAppConfig();
    const exam = config.exams?.[examKey];
    if (!exam || !exam.questions) return false;

    exam.questions.splice(index, 1);

    const solutions = (await getExamSolutions(examKey)) || [];
    if (solutions.length > index) {
      solutions.splice(index, 1);
      await setDoc(doc(db, "exam_solutions", examKey), {
        examKey,
        solutions,
        updatedAt: new Date().toISOString()
      });
    }

    await saveAppConfig({ exams: config.exams });
    return true;
  } catch (err) {
    console.error("Delete question error:", err);
    return false;
  }
}

export async function clearAllSubmissions(): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, "submissions"));
    const promises: Promise<void>[] = [];
    snap.forEach((d) => {
      promises.push(deleteDoc(doc(db, "submissions", d.id)));
    });
    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error("Clear submissions error:", err);
    return false;
  }
}
