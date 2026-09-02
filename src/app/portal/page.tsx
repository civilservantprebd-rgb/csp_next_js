"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { StudentPortalLoginModal } from "@/components/modals/StudentPortalLoginModal";
import { StudentDashboardModal } from "@/components/modals/StudentDashboardModal";
import { ExamDetailPopup } from "@/components/modals/ExamDetailPopup";
import { EnrollModal } from "@/components/modals/EnrollModal";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { AppConfigData } from "@/types/exam";
import { Submission } from "@/types/submission";
import { Contact, ArrowRight, Sparkles, Phone, UserCheck, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseBengaliDigits } from "@/lib/utils";
import { getLocalStudentUser } from "@/lib/student-auth";
import { setVerifiedStudent, getVerifiedStudent } from "@/lib/student-identity";

export default function PortalPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [activeStudentId, setActiveStudentId] = useState("");
  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [isDashOpen, setIsDashOpen] = useState(false);
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
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
        console.error("App config fetch failed on portal page.");
        setErrorMsg("সার্ভার থেকে তথ্য লোড করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      });

    const gUser = getLocalStudentUser();
    if (gUser) {
      setGoogleUser(gUser);
      setActiveStudentId(gUser.uid);
      setIsDashOpen(true);
    } else if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bcs_last_student_id");
      if (stored) setSavedId(stored);
      const verified = getVerifiedStudent();
      if (verified && verified.id) {
        // Returning ID-verified student: reopen the dashboard directly. Without
        // a Google session the dashboard itself explains that login is needed
        // (with a Google-login button) instead of showing a bare login wall.
        setActiveStudentId(verified.id);
        setIsDashOpen(true);
      }
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = studentId.trim();
    if (!clean) {
      setErrorMsg("দয়া করে আপনার স্টুডেন্ট আইডি বা মোবাইল নম্বর দিন।");
      return;
    }
    const norm = parseBengaliDigits(clean).trim();
    if (typeof window !== "undefined") {
      localStorage.setItem("bcs_last_student_id", norm || clean);
    }
    setActiveStudentId(norm || clean);
    setVerifiedStudent({ id: norm || clean });
    setIsDashOpen(true);
  };

  const handleUseSaved = (id: string) => {
    const norm = parseBengaliDigits(id).trim();
    setActiveStudentId(norm || id);
    setVerifiedStudent({ id: norm || id });
    setIsDashOpen(true);
  };

  return (
    <>
      <Header onOpenStudentPortal={() => setIsPortalModalOpen(true)} />

      <main className="flex-grow max-w-lg w-full mx-auto p-4 sm:p-6 font-bengali flex items-center justify-center">
        <div className="relative w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Top Banner Gradient */}
          <div className="relative bg-gradient-to-tr from-indigo-900 via-indigo-800 to-violet-800 text-white p-6 sm:p-8 text-center overflow-hidden">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-400/20 rounded-full blur-lg pointer-events-none" />

            <div className="relative inline-flex mb-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shadow-lg">
                <div className="w-full h-full bg-slate-900/90 rounded-[14px] flex items-center justify-center">
                  <Contact className="w-8 h-8 text-amber-300" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow">
                <Sparkles className="w-3 h-3" />
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white">স্টুডেন্ট পোর্টাল</h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1.5 max-w-xs mx-auto leading-relaxed">
              আপনার পারফরম্যান্স ও পরীক্ষার ইতিহাস দেখতে প্রবেশ করুন
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {/* Google session detected: show reopen button instead of ID form */}
            {googleUser ? (
              <div className="text-center space-y-4 py-2">
                <div className="flex items-center justify-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                  {googleUser.photoURL ? (
                    <Image src={googleUser.photoURL} alt="" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-indigo-200" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                      {googleUser.name?.[0] || "S"}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800">{googleUser.name}</p>
                    <p className="text-sm text-slate-500">লগইন আছেন</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setActiveStudentId(googleUser.uid); setVerifiedStudent({ id: googleUser.uid, name: googleUser.name }); setIsDashOpen(true); }}
                  className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <span>ড্যাশবোর্ড খুলুন</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // No Google session: show the classic ID form
              <>
                {errorMsg && (
                  <div className="bg-rose-50 border border-rose-200/80 text-rose-700 text-xs p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm">
                    <CircleAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="leading-snug">{errorMsg}</p>
                  </div>
                )}

                {savedId && (
                  <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-indigo-900 min-w-0">
                      <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate">আগের আইডি: <strong className="font-mono font-bold text-indigo-700">{savedId}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUseSaved(savedId)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl transition text-sm shrink-0 shadow-sm cursor-pointer"
                    >
                      সরাসরি প্রবেশ
                    </button>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      স্টুডেন্ট আইডি / মোবাইল নম্বর
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="যেমন: 01700000000"
                        value={studentId}
                        onChange={(e) => {
                          setStudentId(e.target.value);
                          if (errorMsg) setErrorMsg("");
                        }}
                        className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm font-mono transition text-slate-900 placeholder:text-slate-400 shadow-inner"
                      />
                    </div>
                    <p className="text-sm text-slate-400 mt-1.5">
                      💡 ভর্তির সময় ব্যবহৃত মোবাইল নম্বরটিই আপনার স্টুডেন্ট আইডি
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <span>ড্যাশবোর্ডে প্রবেশ করুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {config && (
        <>
          <StudentPortalLoginModal
            isOpen={isPortalModalOpen}
            onClose={() => setIsPortalModalOpen(false)}
            onLoginSuccess={(id) => {
              setActiveStudentId(id);
              setIsDashOpen(true);
            }}
            onOpenEnrollModal={() => setIsEnrollOpen(true)}
          />

          <EnrollModal
            isOpen={isEnrollOpen}
            courses={config.courses || ["সাধারণ কোর্স"]}
            onClose={() => setIsEnrollOpen(false)}
            onSuccess={(msg) => alert(msg)}
          />

          <StudentDashboardModal
            isOpen={isDashOpen}
            studentId={activeStudentId}
            exams={config.exams || {}}
            routineUrl={config.driveRoutineUrl}
            syllabusUrl={config.driveSyllabusUrl}
            onClose={() => setIsDashOpen(false)}
            onSelectSubmissionDetail={(sub) => setSelectedSub(sub)}
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
