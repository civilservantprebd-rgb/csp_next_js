"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { FreeExamsSpotlight } from "@/components/dashboard/FreeExamsSpotlight";
import { SelfPracticeCard } from "@/components/dashboard/SelfPracticeCard";
import { TopicExplorerHub } from "@/components/dashboard/TopicExplorerHub";
import { CourseCardGrid } from "@/components/dashboard/CourseCardGrid";
import { LiveExamGrid } from "@/components/dashboard/LiveExamGrid";
import { EnrollModal } from "@/components/modals/EnrollModal";
import { StudentAuthModal } from "@/components/modals/StudentAuthModal";
import { StudentPortalLoginModal } from "@/components/modals/StudentPortalLoginModal";
import { TeacherLoginModal } from "@/components/modals/TeacherLoginModal";
import { StudentDashboardModal } from "@/components/modals/StudentDashboardModal";
import { ExamDetailPopup } from "@/components/modals/ExamDetailPopup";
import { fetchAppConfig } from "@/actions/admin-actions";
import { AppConfigData, Exam } from "@/types/exam";
import { Submission } from "@/types/submission";
import { syncBangladeshNetworkTime } from "@/lib/bangladesh-time";
import { getLocalStudentUser } from "@/lib/student-auth";

export default function HomePage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [selectedExamKey, setSelectedExamKey] = useState("");

  // Modals state
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [selectedEnrollCourse, setSelectedEnrollCourse] = useState<string | undefined>(undefined);
  const [isStudentAuthOpen, setIsStudentAuthOpen] = useState(false);
  const [isStudentPortalLoginOpen, setIsStudentPortalLoginOpen] = useState(false);
  const [isTeacherLoginOpen, setIsTeacherLoginOpen] = useState(false);
  const [isStudentDashOpen, setIsStudentDashOpen] = useState(false);
  const [activePortalStudentId, setActivePortalStudentId] = useState("");
  const [selectedSubmissionForPopup, setSelectedSubmissionForPopup] = useState<Submission | null>(null);

  const loadData = async () => {
    // Start time sync in parallel without blocking UI data fetch
    syncBangladeshNetworkTime();

    const data = await fetchAppConfig();
    setConfig(data);

    const keys = Object.keys(data.exams || {});
    if (keys.length > 0) {
      setSelectedExamKey((prev) => prev || keys[0]);
    }
  };

  useEffect(() => {
    // Redirect teacher to admin panel if logged in
    const isTeacherLoggedIn = sessionStorage.getItem("teacher_user");
    if (isTeacherLoggedIn) {
      router.replace("/admin");
      return;
    }

    loadData();
    const interval = setInterval(syncBangladeshNetworkTime, 60000);

    const localUser = getLocalStudentUser();
    if (localUser) {
      setActivePortalStudentId(localUser.uid);
    }

    return () => clearInterval(interval);
  }, [router]);

  // Check if returning from Google Auth with a target exam intent (Must be before any return statement)
  useEffect(() => {
    if (config && typeof window !== "undefined") {
      const intentExamId = sessionStorage.getItem("target_exam_intent");
      if (intentExamId && config.exams?.[intentExamId]) {
        sessionStorage.removeItem("target_exam_intent");
        handleStartExamByKey(intentExamId);
      }
    }
  }, [config]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bengali text-slate-500">
        লোড হচ্ছে...
      </div>
    );
  }

  const examsObj = config.exams || {};
  const coursesList = config.courses || ["সাধারণ কোর্স"];
  const subjectsList = config.subjects || [];
  const currentExam: Exam | undefined = examsObj[selectedExamKey];

  const handleStartExamByKey = async (examKey: string) => {
    const ex = examsObj[examKey];
    if (!ex) return;
    setSelectedExamKey(examKey);

    const localUser = getLocalStudentUser();
    if (localUser) {
      const { isExamCurrentlyLive } = await import("@/lib/bangladesh-time");
      const { checkStudentAlreadySubmitted } = await import("@/actions/exam-actions");

      if (isExamCurrentlyLive(ex)) {
        const already = await checkStudentAlreadySubmitted(examKey, localUser.uid);
        if (already) {
          alert("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক অ্যাকাউন্ট দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      }

      if (ex.isFree) {
        // Free exam: Start instantly without popup
        sessionStorage.setItem(
          "current_student",
          JSON.stringify({ id: localUser.uid, name: localUser.name })
        );
        router.push(`/exam/${examKey}`);
        return;
      } else {
        // Paid exam: Check authorization instantly
        const { verifyStudentAccess } = await import("@/actions/student-actions");
        const res = await verifyStudentAccess(localUser.uid, ex.course);
        if (res.allowed) {
          sessionStorage.setItem(
            "current_student",
            JSON.stringify({
              id: res.normalizedId || localUser.uid,
              name: res.studentName || localUser.name,
            })
          );
          router.push(`/exam/${examKey}`);
          return;
        }
      }
    }

    // If not logged in or paid verification required, show modal
    setIsStudentAuthOpen(true);
  };

  const handleStudentVerified = (student: { id: string; name: string }) => {
    setIsStudentAuthOpen(false);
    sessionStorage.setItem("current_student", JSON.stringify(student));
    router.push(`/exam/${selectedExamKey}`);
  };

  const handleOpenEnrollModal = (courseName?: string) => {
    setSelectedEnrollCourse(courseName);
    setIsEnrollOpen(true);
  };

  const handleOpenStudentPortal = () => {
    const localUser = getLocalStudentUser();
    if (localUser) {
      setActivePortalStudentId(localUser.uid);
      setIsStudentDashOpen(true);
    } else {
      setIsStudentPortalLoginOpen(true);
    }
  };

  const handleStudentPortalLoginSuccess = (id: string) => {
    setActivePortalStudentId(id);
    setIsStudentDashOpen(true);
  };

  return (
    <>
      <Header
        onOpenStudentPortal={handleOpenStudentPortal}
        onOpenLeaderboard={() => router.push(`/leaderboard/${selectedExamKey || "exam_01"}`)}
      />

      <main className="flex-grow max-w-6xl w-full mx-auto p-3 sm:p-5 md:p-6 space-y-10">
        {/* Live Exams (if any) */}
        <LiveExamGrid
          exams={examsObj}
          onSelectLiveExam={handleStartExamByKey}
          onOpenEnrollModal={handleOpenEnrollModal}
        />

        {/* Free Exams Spotlight Box (Eye-catching spotlight for all free exams across all courses) */}
        <FreeExamsSpotlight
          exams={examsObj}
          onStartExam={handleStartExamByKey}
          onOpenEnrollModal={handleOpenEnrollModal}
        />

        {/* Custom Subject Self-Practice Card */}
        <SelfPracticeCard config={config} />

        {/* Chapter & Subtopic Exploration Hub */}
        <TopicExplorerHub config={config} />

        {/* Dynamic Course Card Grid (Each course is a box with subjects, exams, enroll button & start exam button) */}
        <CourseCardGrid
          courses={coursesList}
          subjects={subjectsList}
          exams={examsObj}
          onStartExam={handleStartExamByKey}
          onOpenEnrollModal={handleOpenEnrollModal}
        />
      </main>

      <Footer onOpenTeacherLogin={() => setIsTeacherLoginOpen(true)} />

      {/* Modals */}
      <EnrollModal
        isOpen={isEnrollOpen}
        courses={coursesList}
        initialCourse={selectedEnrollCourse}
        onClose={() => {
          setIsEnrollOpen(false);
          setSelectedEnrollCourse(undefined);
        }}
      />

      {currentExam && (
        <StudentAuthModal
          isOpen={isStudentAuthOpen}
          exam={currentExam}
          onClose={() => setIsStudentAuthOpen(false)}
          onVerified={handleStudentVerified}
        />
      )}

      <TeacherLoginModal
        isOpen={isTeacherLoginOpen}
        onClose={() => setIsTeacherLoginOpen(false)}
        onLoginSuccess={(user) => {
          sessionStorage.setItem("teacher_user", JSON.stringify(user));
          router.push("/admin");
        }}
      />

      <StudentPortalLoginModal
        isOpen={isStudentPortalLoginOpen}
        onClose={() => setIsStudentPortalLoginOpen(false)}
        onLoginSuccess={handleStudentPortalLoginSuccess}
        onOpenEnrollModal={() => handleOpenEnrollModal()}
      />

      <StudentDashboardModal
        isOpen={isStudentDashOpen}
        studentId={activePortalStudentId}
        exams={examsObj}
        routineUrl={config.driveRoutineUrl}
        syllabusUrl={config.driveSyllabusUrl}
        onClose={() => setIsStudentDashOpen(false)}
        onSelectSubmissionDetail={(sub) => setSelectedSubmissionForPopup(sub)}
      />

      <ExamDetailPopup
        isOpen={!!selectedSubmissionForPopup}
        submission={selectedSubmissionForPopup}
        exam={selectedSubmissionForPopup ? examsObj[selectedSubmissionForPopup.examKey] || null : null}
        onClose={() => setSelectedSubmissionForPopup(null)}
      />
    </>
  );
}
