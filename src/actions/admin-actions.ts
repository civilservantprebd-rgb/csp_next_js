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
import { AppConfigData, Exam, QuestionItem, QuestionSolution, TopicQuestion } from "@/types/exam";
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

  inflightFetch = (async () => {
    try {
      const snap = await getDoc(doc(db, "app_config", "bcs_data"));
      if (snap.exists()) {
        const data = snap.data() as AppConfigData;
        if (Array.isArray(data.topics)) {
          data.topics = data.topics
            .map((t: any) => (typeof t === "string" ? t : t?.name))
            .filter((t): t is string => Boolean(t && typeof t === "string"));
        }
        if (!Array.isArray(data.topicQuestions)) {
          data.topicQuestions = [];
        }
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
    exam.questions.push({
      q: question.q,
      opts: question.opts,
      ...(question.topic ? { topic: question.topic } : {})
    });

    const solutions = (await getExamSolutions(examKey)) || [];
    solutions.push(solution);

    await setDoc(doc(db, "exam_solutions", examKey), {
      examKey,
      solutions,
      updatedAt: new Date().toISOString()
    });

    // Also permanently store in persistent Topic Questions repository
    if (question.topic?.trim()) {
      if (!config.topicQuestions) config.topicQuestions = [];
      config.topicQuestions.push({
        id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        topic: question.topic.trim(),
        q: question.q.trim(),
        opts: question.opts.map((o) => o.trim()),
        correct: Number(solution.correct),
        exp: solution.exp.trim(),
        originalExamTitle: exam.title,
        originalCourse: exam.course,
        originalSubject: exam.subject,
        examKey: examKey,
        createdAt: new Date().toISOString()
      });
    }

    await saveAppConfig({
      exams: config.exams,
      ...(question.topic?.trim() ? { topicQuestions: config.topicQuestions } : {})
    });
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
    const config = await fetchAppConfig();
    const exam = config.exams?.[examKey];
    if (!exam) return { success: false, count: 0 };

    if (!exam.questions) exam.questions = [];
    const currentSolutions = (await getExamSolutions(examKey)) || [];

    if (!config.topicQuestions) config.topicQuestions = [];

    newQuestions.forEach((qItem, idx) => {
      exam.questions!.push({
        q: qItem.q.trim(),
        opts: qItem.opts.map((o) => o.trim()),
        ...(qItem.topic ? { topic: qItem.topic.trim() } : {})
      });

      const sol = newSolutions[idx] || { correct: 0, exp: "" };
      currentSolutions.push(sol);

      if (qItem.topic?.trim()) {
        config.topicQuestions!.push({
          id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`,
          topic: qItem.topic.trim(),
          q: qItem.q.trim(),
          opts: qItem.opts.map((o) => o.trim()),
          correct: Number(sol.correct),
          exp: (sol.exp || "").trim(),
          originalExamTitle: exam.title,
          originalCourse: exam.course,
          originalSubject: exam.subject,
          examKey: examKey,
          createdAt: new Date().toISOString()
        });
      }
    });

    await setDoc(doc(db, "exam_solutions", examKey), {
      examKey,
      solutions: currentSolutions,
      updatedAt: new Date().toISOString()
    });

    await saveAppConfig({
      exams: config.exams,
      topicQuestions: config.topicQuestions
    });

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
    const config = await fetchAppConfig();
    const exam = config.exams?.[examKey];
    if (!exam || !exam.questions || !exam.questions[index]) return false;

    const oldQ = exam.questions[index];

    exam.questions[index] = {
      q: question.q,
      opts: question.opts,
      ...(question.topic ? { topic: question.topic } : {})
    };

    const solutions = (await getExamSolutions(examKey)) || [];
    solutions[index] = solution;

    await setDoc(doc(db, "exam_solutions", examKey), {
      examKey,
      solutions,
      updatedAt: new Date().toISOString()
    });

    // Update in topicQuestions repository if topic exists
    if (!config.topicQuestions) config.topicQuestions = [];
    if (question.topic?.trim()) {
      // Find matching item by examKey & old question text
      const existingIdx = config.topicQuestions.findIndex(
        (tq) => tq.examKey === examKey && tq.q === oldQ.q
      );
      if (existingIdx !== -1) {
        config.topicQuestions[existingIdx] = {
          ...config.topicQuestions[existingIdx],
          topic: question.topic.trim(),
          q: question.q.trim(),
          opts: question.opts.map((o) => o.trim()),
          correct: Number(solution.correct),
          exp: solution.exp.trim(),
          originalExamTitle: exam.title,
          originalCourse: exam.course,
          originalSubject: exam.subject,
        };
      } else {
        config.topicQuestions.push({
          id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          topic: question.topic.trim(),
          q: question.q.trim(),
          opts: question.opts.map((o) => o.trim()),
          correct: Number(solution.correct),
          exp: solution.exp.trim(),
          originalExamTitle: exam.title,
          originalCourse: exam.course,
          originalSubject: exam.subject,
          examKey: examKey,
          createdAt: new Date().toISOString()
        });
      }
    }

    await saveAppConfig({
      exams: config.exams,
      topicQuestions: config.topicQuestions
    });
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

export async function toggleExamResultPublish(examKey: string, publish: boolean): Promise<boolean> {
  try {
    const config = await fetchAppConfig();
    const exam = config.exams?.[examKey];
    if (!exam) return false;

    exam.isResultPublished = publish;
    await saveAppConfig({ exams: config.exams });

    // When releasing result: evaluate all student submissions for this exam against official solutions
    const snap = await getDocs(collection(db, "submissions"));
    const solutions = publish ? await getExamSolutions(examKey) : null;
    const batchUpdates: Promise<void>[] = [];

    snap.forEach((docSnap) => {
      const sub = docSnap.data() as any;
      if (sub.examKey === examKey) {
        const subRef = doc(db, "submissions", docSnap.id);
        if (publish && solutions && Array.isArray(sub.answers)) {
          let correct = 0;
          let incorrect = 0;
          sub.answers.forEach((ans: number | null, idx: number) => {
            const sol = solutions[idx];
            if (ans !== null && sol) {
              if (ans === sol.correct) correct++;
              else incorrect++;
            }
          });
          const score = Math.max(0, correct - incorrect * 0.5);
          batchUpdates.push(
            updateDoc(subRef, {
              score,
              correct,
              incorrect,
              isPendingEvaluation: false,
              evaluatedAt: new Date().toISOString()
            })
          );
        } else if (!publish) {
          // Resetting results: mark as pending evaluation
          batchUpdates.push(
            updateDoc(subRef, {
              isPendingEvaluation: true
            })
          );
        }
      }
    });

    await Promise.all(batchUpdates);
    return true;
  } catch (err) {
    console.error("Toggle exam result publish error:", err);
    return false;
  }
}

export async function deleteTopicQuestion(topicQuestionId: string): Promise<boolean> {
  try {
    const config = await fetchAppConfig();
    if (!config.topicQuestions) return false;
    config.topicQuestions = config.topicQuestions.filter((tq) => tq.id !== topicQuestionId);
    await saveAppConfig({ topicQuestions: config.topicQuestions });
    return true;
  } catch (err) {
    console.error("Delete topic question error:", err);
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
