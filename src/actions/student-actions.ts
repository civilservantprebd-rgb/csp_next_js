import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection
} from "firebase/firestore";
import { AllowedStudent } from "@/types/student";
import { Submission } from "@/types/submission";
import { parseBengaliDigits } from "@/lib/utils";
import { getExamSolutions, isAnswerTimeReached } from "@/actions/exam-actions";

export async function verifyStudentAccess(
  rawStudentId: string,
  examCourse: string
): Promise<{ allowed: boolean; studentName?: string; normalizedId?: string; message?: string }> {
  const cleanId = String(rawStudentId).trim();
  const normalizedId = parseBengaliDigits(cleanId).trim();

  if (!cleanId) {
    return { allowed: false, message: "দয়া করে স্টুডেন্ট আইডি প্রদান করুন।" };
  }

  try {
    let matchedStudent: AllowedStudent | null = null;

    // 1. Direct match by raw ID
    let snap = await getDoc(doc(db, "allowed_students", cleanId));
    if (snap.exists()) {
      matchedStudent = snap.data() as AllowedStudent;
      if (!matchedStudent.id) matchedStudent.id = cleanId;
    }

    // 2. Direct match by normalized digits
    if (!matchedStudent && normalizedId && normalizedId !== cleanId) {
      snap = await getDoc(doc(db, "allowed_students", normalizedId));
      if (snap.exists()) {
        matchedStudent = snap.data() as AllowedStudent;
        if (!matchedStudent.id) matchedStudent.id = normalizedId;
      }
    }

    // 3. Collection search fallback
    if (!matchedStudent) {
      const allSnap = await getDocs(collection(db, "allowed_students"));
      allSnap.forEach((d) => {
        const data = d.data() as AllowedStudent;
        const docSid = String(data.id || d.id).trim();
        const docNormSid = parseBengaliDigits(docSid).trim();

        if (
          docSid === cleanId ||
          docNormSid === normalizedId ||
          (normalizedId.length >= 10 && docNormSid.endsWith(normalizedId.slice(-10))) ||
          (docNormSid.length >= 10 && normalizedId.endsWith(docNormSid.slice(-10)))
        ) {
          matchedStudent = data;
          if (!matchedStudent.id) matchedStudent.id = docSid;
        }
      });
    }

    if (!matchedStudent) {
      return {
        allowed: false,
        message: "আপনার স্টুডেন্ট আইডিটি অনুমোদিত নয়। কোর্সে এনরোল করার পর শিক্ষকের অনুমোদন পেলে পরীক্ষা দিতে পারবেন।"
      };
    }

    const studentCourses = matchedStudent.courses || [];
    const normalizedCourses = Array.isArray(studentCourses) ? studentCourses : [studentCourses];
    const targetCourse = (examCourse || "").trim();

    const hasCourseAccess =
      !targetCourse ||
      targetCourse === "ALL" ||
      targetCourse === "সাধারণ কোর্স" ||
      normalizedCourses.some((c) => {
        if (!c) return false;
        const sc = String(c).trim().toLowerCase();
        return sc === "all" || sc === "সকল কোর্স" || sc === targetCourse.toLowerCase();
      });

    if (!hasCourseAccess) {
      return {
        allowed: false,
        message: `দুঃখিত! আপনার আইডিটি "${examCourse}" কোর্সের জন্য অনুমোদিত নয়।`
      };
    }

    return {
      allowed: true,
      studentName: matchedStudent.name || "শিক্ষার্থী",
      normalizedId: matchedStudent.id || normalizedId || cleanId
    };
  } catch (err) {
    console.error("Student verification error:", err);
    return { allowed: false, message: "আইডি যাচাই করতে সমস্যা হয়েছে।" };
  }
}

export async function getStudentSubmissions(studentId: string): Promise<Submission[]> {
  const normId = parseBengaliDigits(studentId).trim();
  const cleanId = String(studentId).trim();

  try {
    const snap = await getDocs(collection(db, "submissions"));
    const subs: Submission[] = [];

    snap.forEach((d) => {
      const data = d.data() as Submission;
      const subSid = String(data.studentId || "").trim();
      const subNorm = parseBengaliDigits(subSid).trim();

      if (subSid === cleanId || (normId && subNorm === normId)) {
        subs.push({ ...data, id: d.id });
      }
    });

    for (const s of subs) {
      if (s.isPendingEvaluation || s.score === undefined) {
        const solutions = await getExamSolutions(s.examKey);
        if (solutions && s.answers) {
          let cor = 0;
          let incor = 0;
          s.answers.forEach((ans, idx) => {
            const sol = solutions[idx];
            if (ans !== null && sol) {
              if (ans === sol.correct) cor++;
              else incor++;
            }
          });
          s.correct = cor;
          s.incorrect = incor;
          s.score = Math.max(0, cor - incor * 0.5);
          s.isPendingEvaluation = false;
        }
      }
    }

    return subs;
  } catch (err) {
    console.error("Fetch student submissions error:", err);
    return [];
  }
}
