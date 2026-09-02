"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { StudentDashboardModal } from "@/components/modals/StudentDashboardModal";
import { ExamDetailPopup } from "@/components/modals/ExamDetailPopup";
import { EnrollModal } from "@/components/modals/EnrollModal";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { AppConfigData } from "@/types/exam";
import { Submission } from "@/types/submission";
import { Contact, ArrowRight, Sparkles, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";

export default function PortalPage() {
  const router = useRouter();
  const [activeStudentId, setActiveStudentId] = useState("");
  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [configError, setConfigError] = useState("");
  const [configAttempt, setConfigAttempt] = useState(0);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [googleUser, setGoogleUser] = useState<{ uid: string; name: string; photoURL?: string } | null>(null);

  useEffect(() => {
    const isTeacherLoggedIn = sessionStorage.getItem("teacher_user");
    if (isTeacherLoggedIn) {
      alert("⚠️ আপনি শিক্ষক প্যানেলে লগইন করে আছেন। স্টুডেন্ট প্যানেলে প্রবেশ করতে চাইলে প্রথমে শিক্ষক প্যানেল থেকে লগআউট করুন।");
      router.replace("/admin");
      return;
    }

    fetchAppConfigLite()
      .then(setConfig)
      .catch(() => {
        console.error("Portal page config fetch failed.");
        setConfigError("সার্ভার থেকে তথ্য লোড করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      });

    const gUser = getLocalStudentUser();
    if (gUser) {
      setGoogleUser(gUser);
      setActiveStudentId(gUser.uid);
    }
  }, [router, configAttempt]);

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle(undefined, "/portal");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Header onOpenStudentPortal={() => window.scrollTo({ top: 0, behavior: "smooth" })} />

      <main className="flex-grow max-w-4xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-5">
        {/* Top banner */}
        <div className="relative bg-gradient-to-tr from-indigo-900 via-indigo-800 to-violet-800 text-white rounded-3xl p-6 sm:p-8 text-center overflow-hidden shadow-lg">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-400/20 rounded-full blur-lg pointer-events-none" />

          <div className="relative inline-flex mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-900/90 rounded-[12px] flex items-center justify-center">
                <Contact className="w-7 h-7 text-amber-300" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow">
              <Sparkles className="w-3 h-3" />
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">স্টুডেন্ট পোর্টাল</h2>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-sm mx-auto leading-relaxed">
            {googleUser ? `${googleUser.name} — আপনার পারফরম্যান্স ও পরীক্ষার ইতিহাস` : "আপনার পারফরম্যান্স ও পরীক্ষার ইতিহাস"}
          </p>
        </div>

        {configError && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="bg-rose-50 border border-rose-200/80 text-rose-700 text-xs p-3.5 rounded-2xl flex items-start gap-2.5">
              <CircleAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="leading-snug">{configError}</p>
            </div>
            <button
              type="button"
              onClick={() => setConfigAttempt((n) => n + 1)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl text-sm cursor-pointer transition"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        )}

        {!configError && !googleUser && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-5">
            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900">Google লগইন আবশ্যক</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                ফলাফল, পারফরম্যান্স বিশ্লেষণ, ভুল উত্তরের খাতা ও বুকমার্ক দেখতে
                <strong className="text-slate-700"> Google অ্যাকাউন্ট দিয়ে লগইন</strong> করুন।
                লগইনের পর আপনার রেকর্ড স্বয়ংক্রিয়ভাবে খুলে যাবে।
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-8 rounded-2xl border border-slate-300 shadow-sm transition text-sm cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.21 7.42 8.87 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.62z" />
                <path fill="#FBBC05" d="M5.28 14.78a7.02 7.02 0 0 1-.37-2.22c0-.77.13-1.51.37-2.22L1.39 7.32A11.96 11.96 0 0 0 0 12c0 1.72.36 3.35.99 4.83l4.29-3.05z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.51 1.18-4.23 1.18-3.13 0-5.79-2.38-6.73-5.54l-3.89 3.02C3.37 20.33 7.35 23 12 23z" />
              </svg>
              Google দিয়ে লগইন করুন
            </button>

            <p className="text-xs text-slate-400">
              💡 যে Google অ্যাকাউন্টে এনরোলমেন্ট নিবন্ধিত সেই অ্যাকাউন্ট দিয়েই লগইন করুন।
            </p>
          </div>
        )}

        {!configError && googleUser && (
          <StudentDashboardModal
            embedded
            isOpen
            studentId={activeStudentId}
            exams={config?.exams || {}}
            config={config || undefined}
            routineUrl={config?.driveRoutineUrl}
            syllabusUrl={config?.driveSyllabusUrl}
            onClose={() => {}}
            onSelectSubmissionDetail={(sub) => setSelectedSub(sub)}
          />
        )}
      </main>

      <Footer />

      {config && (
        <>
          <EnrollModal
            isOpen={isEnrollOpen}
            courses={config.courses || ["সাধারণ কোর্স"]}
            onClose={() => setIsEnrollOpen(false)}
            onSuccess={(msg) => alert(msg)}
          />

          <ExamDetailPopup
            isOpen={!!selectedSub}
            submission={selectedSub}
            exam={selectedSub ? config.exams?.[selectedSub.examKey] || null : null}
            onClose={() => setSelectedSub(null)}
          />
        </>
      )}
    </>
  );
}
