import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";

// Firebase Client Config for migration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCwlSDuA69JeGihmWNQ0oHeUzghwP6ymtQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "civilservantprep-5af11.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://civilservantprep-5af11-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "civilservantprep-5af11",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "civilservantprep-5af11.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "592167317635",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:592167317635:web:cc7090297a425c45c5ebb6",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-RECS6T30V5"
};

const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(fbApp);

export async function GET() {
  const log: string[] = [];

  try {
    log.push("Starting migration from Firebase to Supabase...");

    // 1. Migrate App Config (Routine, Syllabus, Exams, Questions, Subjects)
    log.push("Fetching app_config/bcs_data from Firestore...");
    const configDocRef = doc(db, "app_config", "bcs_data");
    const configSnap = await getDoc(configDocRef);

    if (configSnap.exists()) {
      const data = configSnap.data();
      log.push("Found app_config data in Firestore.");

      // A. Save App Settings
      log.push("Migrating app settings...");
      const { error: settingsError } = await supabase.from("app_settings").upsert({
        id: "main",
        courses: data.courses || [],
        topics: data.topics || [],
        teacher_pass: data.teacherPass || "1234",
        drive_routine_url: data.driveRoutineUrl || "https://drive.google.com",
        drive_syllabus_url: data.driveSyllabusUrl || "https://drive.google.com"
      });
      if (settingsError) throw new Error(`Settings migration failed: ${settingsError.message}`);
      log.push("Settings migrated successfully.");

      // B. Save Subjects
      if (Array.isArray(data.subjects)) {
        log.push(`Migrating ${data.subjects.length} subjects...`);
        await supabase.from("subjects").delete().neq("name", "___nonexistent___");
        const { error: subjectsError } = await supabase.from("subjects").insert(
          data.subjects.map((s: any) => ({
            name: s.name,
            course: s.course
          }))
        );
        if (subjectsError) throw new Error(`Subjects migration failed: ${subjectsError.message}`);
        log.push("Subjects migrated successfully.");
      }

      // C. Save Exams & Questions
      if (data.exams && typeof data.exams === "object") {
        const examKeys = Object.keys(data.exams);
        log.push(`Migrating ${examKeys.length} exams and their questions...`);

        for (const examKey of examKeys) {
          const exam = data.exams[examKey];
          log.push(`Migrating exam: ${exam.title || examKey}...`);

          // Insert Exam Metadata
          const { error: examError } = await supabase.from("exams").upsert({
            id: examKey,
            course: exam.course || "",
            subject: exam.subject || "",
            title: exam.title || "",
            timer_minutes: Number(exam.timerMinutes || 30),
            is_free: Boolean(exam.isFree),
            pass_mark: Number(exam.passMark || 1),
            start_time: exam.startTime || null,
            end_time: exam.endTime || null,
            is_result_published: Boolean(exam.isResultPublished),
            leaderboard_start_time: exam.leaderboardStartTime || null,
            leaderboard_end_time: exam.leaderboardEndTime || null
          });
          if (examError) throw new Error(`Exam ${examKey} migration failed: ${examError.message}`);

          // Fetch solutions if any (from separate exam_solutions collection in Firestore)
          log.push(`Fetching solutions for ${examKey} from Firestore...`);
          const solDocRef = doc(db, "exam_solutions", examKey);
          const solSnap = await getDoc(solDocRef);
          const solutionsList = solSnap.exists() ? solSnap.data().solutions || [] : [];

          // Insert Exam Questions
          if (Array.isArray(exam.questions)) {
            log.push(`Inserting ${exam.questions.length} questions for ${examKey}...`);
            // Clean up existing questions first to prevent duplicates on rerun
            await supabase.from("exam_questions").delete().eq("exam_id", examKey);

            const questionsInsert = exam.questions.map((q: any, idx: number) => {
              const sol = solutionsList[idx] || {};
              return {
                exam_id: examKey,
                q: q.q || "",
                opts: q.opts || [],
                topic: q.topic || null,
                correct: Number(sol.correct !== undefined ? sol.correct : 0),
                exp: sol.exp || ""
              };
            });

            if (questionsInsert.length > 0) {
              const { error: qError } = await supabase.from("exam_questions").insert(questionsInsert);
              if (qError) throw new Error(`Questions migration failed for ${examKey}: ${qError.message}`);
            }
          }
        }
        log.push("Exams and questions migrated successfully.");
      }
    } else {
      log.push("No app_config/bcs_data found in Firestore. Skipping.");
    }

    // 2. Migrate Allowed Students
    log.push("Fetching allowed_students from Firestore...");
    const allowedStudentsSnap = await getDocs(collection(db, "allowed_students"));
    const allowedDocs = allowedStudentsSnap.docs;
    log.push(`Found ${allowedDocs.length} allowed students in Firestore.`);

    if (allowedDocs.length > 0) {
      log.push("Upserting allowed students into Supabase...");
      const allowedInsert = allowedDocs.map((docSnap) => {
        const student = docSnap.data();
        return {
          id: docSnap.id.trim(),
          name: student.name || "",
          email: student.email || "",
          courses: Array.isArray(student.courses) ? student.courses : [student.courses].filter(Boolean),
          approved_at: student.timestamp || new Date().toISOString()
        };
      });

      const { error: allowedError } = await supabase.from("allowed_students").upsert(allowedInsert);
      if (allowedError) throw new Error(`Allowed students migration failed: ${allowedError.message}`);
      log.push("Allowed students migrated successfully.");
    }

    // 3. Migrate Enrollment Requests
    log.push("Fetching enroll_requests from Firestore...");
    const enrollSnap = await getDocs(collection(db, "enroll_requests"));
    const enrollDocs = enrollSnap.docs;
    log.push(`Found ${enrollDocs.length} enrollment requests in Firestore.`);

    if (enrollDocs.length > 0) {
      log.push("Inserting enrollment requests into Supabase...");
      await supabase.from("enroll_requests").delete().neq("student_uid", "___nonexistent___");

      const enrollInsert = enrollDocs.map((docSnap) => {
        const req = docSnap.data();
        return {
          id: docSnap.id,
          student_uid: req.uid || req.studentUid || "",
          email: req.email || "",
          name: req.name || "",
          course: req.course || "",
          trx_id: req.trxId || "",
          created_at: req.timestamp || new Date().toISOString()
        };
      });

      const { error: enrollError } = await supabase.from("enroll_requests").insert(enrollInsert);
      if (enrollError) throw new Error(`Enroll requests migration failed: ${enrollError.message}`);
      log.push("Enrollment requests migrated successfully.");
    }

    // 4. Migrate Submissions
    log.push("Fetching submissions from Firestore...");
    const submissionsSnap = await getDocs(collection(db, "submissions"));
    const submissionsDocs = submissionsSnap.docs;
    log.push(`Found ${submissionsDocs.length} submissions in Firestore.`);

    if (submissionsDocs.length > 0) {
      log.push("Inserting submissions into Supabase...");
      await supabase.from("submissions").delete().neq("student_id", "___nonexistent___");

      const submissionsInsert = submissionsDocs.map((docSnap) => {
        const sub = docSnap.data();
        return {
          id: docSnap.id.length === 36 ? docSnap.id : undefined, // PostgreSQL UUID format check
          student_name: sub.studentName || "",
          student_id: sub.studentId || "",
          exam_key: sub.examKey || "",
          exam_title: sub.examTitle || "",
          score: Number(sub.score !== undefined ? sub.score : 0),
          correct: Number(sub.correct !== undefined ? sub.correct : 0),
          incorrect: Number(sub.incorrect !== undefined ? sub.incorrect : 0),
          total_questions: Number(sub.totalQuestions !== undefined ? sub.totalQuestions : 0),
          time_spent: sub.timeSpent || "",
          answers: Array.isArray(sub.answers) ? sub.answers.map((v: any) => v === null ? -1 : Number(v)) : [],
          is_pending_evaluation: Boolean(sub.isPendingEvaluation),
          is_live_submission: Boolean(sub.isLiveSubmission),
          submitted_at: sub.timestamp || new Date().toISOString()
        };
      });

      // Insert chunk by chunk to avoid payload size limits
      const chunkSize = 100;
      for (let i = 0; i < submissionsInsert.length; i += chunkSize) {
        const chunk = submissionsInsert.slice(i, i + chunkSize);
        const { error: subError } = await supabase.from("submissions").upsert(chunk);
        if (subError) throw new Error(`Submissions migration failed at chunk ${i}: ${subError.message}`);
      }
      log.push("Submissions migrated successfully.");
    }

    // 5. Migrate Topic Questions
    log.push("Fetching topic_questions from Firestore...");
    try {
      const tqSnap = await getDocs(collection(db, "topic_questions"));
      const tqDocs = tqSnap.docs;
      log.push(`Found ${tqDocs.length} topic questions in Firestore.`);

      if (tqDocs.length > 0) {
        log.push("Inserting topic questions into Supabase...");
        await supabase.from("topic_questions").delete().neq("topic", "___nonexistent___");

        const tqInsert = tqDocs.map((docSnap) => {
          const tq = docSnap.data();
          return {
            id: docSnap.id,
            topic: tq.topic || "",
            q: tq.q || "",
            opts: tq.opts || [],
            correct: Number(tq.correct !== undefined ? tq.correct : 0),
            exp: tq.exp || "",
            original_exam_title: tq.originalExamTitle || null,
            original_course: tq.originalCourse || null,
            original_subject: tq.originalSubject || null,
            exam_key: tq.examKey || null,
            created_at: tq.createdAt || new Date().toISOString()
          };
        });

        const { error: tqError } = await supabase.from("topic_questions").insert(tqInsert);
        if (tqError) throw new Error(`Topic questions migration failed: ${tqError.message}`);
        log.push("Topic questions migrated successfully.");
      }
    } catch (tqErr: any) {
      log.push(`Topic questions migration skipped or failed (might not exist): ${tqErr.message}`);
    }

    log.push("All migrations completed successfully!");
    return NextResponse.json({ success: true, log });
  } catch (err: any) {
    log.push(`MIGRATION FAILED: ${err.message}`);
    console.error("Migration error:", err);
    return NextResponse.json({ success: false, log, error: err.message }, { status: 500 });
  }
}
