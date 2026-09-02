"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { getCourseVideos } from "@/actions/video-actions";
import { AppConfigData, Exam } from "@/types/exam";
import { CourseVideo } from "@/types/video";
import { toBengaliDigits, sortExamsForStudents } from "@/lib/utils";
import { getLocalStudentUser } from "@/lib/student-auth";
import {
  ChevronLeft,
  PlayCircle,
  Lock,
  Search,
  Clock,
  CircleHelp,
  CheckCircle2,
  BookOpen,
  Video,
  GraduationCap,
  UserPlus,
  Loader2,
  ShieldCheck,
  Check
} from "lucide-react";

const EnrollModal = dynamic(() => import("@/components/modals/EnrollModal").then((m) => m.EnrollModal), { ssr: false });
const StudentAuthModal = dynamic(() => import("@/components/modals/StudentAuthModal").then((m) => m.StudentAuthModal), { ssr: false });

interface AccessState {
  allowed: boolean;
  name?: string;
  id?: string;
  email?: string;
}

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function CourseStudyPage() {
  const params = useParams();
  const router = useRouter();
  const courseName = decodeParam(String(params.courseName || ""));

  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [examSearch, setExamSearch] = useState("");

  // Enrollment/access gate state
  const [access, setAccess] = useState<AccessState | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [gateId, setGateId] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState("");

  // Exam start modal state
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingExam, setPendingExam] = useState<Exam | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const sessionKey = `course_access_${courseName}`;

  useEffect(() => {
    if (!courseName) return;
    fetchAppConfigLite().then(setConfig);
    getCourseVideos(courseName).then(setVideos);
  }, [courseName]);

  // Restore verified access from this browser session, else auto-verify Google users
  useEffect(() => {
    if (!courseName || !config) return;
    (async () => {
      try {
        const cached = sessionStorage.getItem(sessionKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.allowed) {
            setAccess(parsed);
            setAccessChecked(true);
            return;
          }
        }
        const localUser = getLocalStudentUser();
        if (localUser) {
          const res = await verifyStudentAccess(localUser.uid, courseName, localUser.email);
          if (res.allowed) {
            const state: AccessState = { allowed: true, name: res.studentName || localUser.name, id: localUser.uid, email: localUser.email };
            setAccess(state);
            sessionStorage.setItem(sessionKey, JSON.stringify(state));
          }
        }
      } catch {
        // ignore — manual gate stays visible
      }
      setAccessChecked(true);
    })();
  }, [courseName, config, sessionKey]);

  const selectedVideo = useMemo(
    () => videos.find((v) => v.id === selectedVideoId) || null,
    [videos, selectedVideoId]
  );

  const subjectsWithVideos = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => set.add(v.subject || "সাধারণ"));
    return Array.from(set);
  }, [videos]);

  const visibleVideos = useMemo(
    () =>
      subjectFilter === "ALL"
        ? videos
        : videos.filter((v) => (v.subject || "সাধারণ") === subjectFilter),
    [videos, subjectFilter]
  );

  // Auto-select the first video once unlocked
  useEffect(() => {
    if (access?.allowed && videos.length > 0 && selectedVideoId === null) {
      setSelectedVideoId(videos[0].id);
    }
  }, [access, videos, selectedVideoId]);

  const examsObj = config?.exams || {};
  const courseExams = useMemo(
    () =>
      Object.entries(examsObj)
        .filter(([_, ex]) => ex.course === courseName)
        .sort(sortExamsForStudents),
    [examsObj, courseName]
  );

  const filteredExams = useMemo(() => {
    const q = examSearch.trim().toLowerCase();
    if (!q) return courseExams;
    return courseExams.filter(
      ([_, ex]) =>
        ex.title.toLowerCase().includes(q) || (ex.subject || "").toLowerCase().includes(q)
    );
  }, [courseExams, examSearch]);

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawId = gateId.trim();
    if (!rawId) {
      setGateError("আপনার স্টুডেন্ট আইডি / মোবাইল / ইমেইল লিখুন।");
      return;
    }
    setGateBusy(true);
    setGateError("");
    try {
      const res = await verifyStudentAccess(rawId, courseName);
      if (res.allowed) {
        const state: AccessState = { allowed: true, name: res.studentName || rawId, id: res.normalizedId || rawId };
        setAccess(state);
        sessionStorage.setItem(sessionKey, JSON.stringify(state));
        sessionStorage.setItem(
          "current_student",
          JSON.stringify({ id: res.normalizedId || rawId, name: res.studentName || rawId })
        );
        setGateId("");
      } else {
        setGateError(res.message || "অ্যাক্সেস মেলেনি। এনরোলমেন্ট যাচাই করে দেখুন।");
      }
    } finally {
      setGateBusy(false);
    }
  };

  const handleStartExam = async (examKey: string) => {
    const ex = examsObj[examKey];
    if (!ex) return;
    const localUser = getLocalStudentUser();

    if (localUser) {
      const { isExamCurrentlyLive } = await import("@/lib/bangladesh-time");
      const { checkStudentAlreadySubmitted } = await import("@/actions/exam-actions");

      if (isExamCurrentlyLive(ex)) {
        const already = await checkStudentAlreadySubmitted(examKey, localUser.uid);
        if (already) {
          alert("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক অ্যাকাউন্ট দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      }

      if (ex.isFree) {
        sessionStorage.setItem("current_student", JSON.stringify({ id: localUser.uid, name: localUser.name }));
        router.push(`/exam/${examKey}`);
        return;
      } else {
        const { verifyStudentAccess: verify } = await import("@/actions/student-actions");
        const res = await verify(localUser.uid, ex.course, localUser.email);
        if (res.allowed) {
          sessionStorage.setItem(
            "current_student",
            JSON.stringify({ id: res.normalizedId || localUser.uid, name: res.studentName || localUser.name })
          );
          router.push(`/exam/${examKey}`);
          return;
        }
      }
    }

    // Google login / verification required
    setPendingExam(ex);
    setAuthOpen(true);
  };

  const handleStudentVerified = (student: { id: string; name: string }) => {
    setAuthOpen(false);
    sessionStorage.setItem("current_student", JSON.stringify(student));
    if (pendingExam) router.push(`/exam/${pendingExam.id}`);
  };

  const isUnlocked = access?.allowed === true;
  const examCount = courseExams.length;

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bengali text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> কোর্স লোড হচ্ছে...
      </div>
    );
  }

  const courseSubjects = (config.subjects || []).filter((s) => s.course === courseName);

  return (
    <>
      <Header />

      <main className="flex-grow max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-5">
        {/* Course header */}
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-950 text-white rounded-3xl p-5 sm:p-7 shadow-lg">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-xs text-indigo-200 hover:text-white transition cursor-pointer font-semibold"
          >
            <ChevronLeft className="w-4 h-4" /> হোম পেজে ফিরে যান
          </button>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-3">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shadow-md shrink-0">
                  <div className="w-full h-full bg-slate-900/90 rounded-[14px] flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-amber-300" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">{courseName}</h1>
                  <p className="text-xs text-indigo-200 font-semibold">
                    {toBengaliDigits(courseSubjects.length)}টি বিষয় · {toBengaliDigits(examCount)}টি পরীক্ষা ·{" "}
                    {toBengaliDigits(videos.length)}টি ভিডিও ক্লাস
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {courseSubjects.slice(0, 12).map((s) => (
                  <span key={s.name} className="bg-white/10 border border-white/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => setEnrollOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4" /> Enroll Now
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ============ LEFT: player + exams ============ */}
          <div className="lg:col-span-8 space-y-5">
            {/* Video player panel */}
            <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
              {isUnlocked && selectedVideo ? (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?rel=0&modestbranding=1&color=white`}
                    title={selectedVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video w-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-slate-900 to-indigo-950">
                  {isUnlocked && videos.length === 0 ? (
                    <>
                      <Video className="w-10 h-10 text-slate-500 mb-3" />
                      <p className="text-slate-300 font-bold text-sm sm:text-base">এই কোর্সে এখনো কোনো ভিডিও ক্লাস যোগ করা হয়নি</p>
                      <p className="text-slate-500 text-xs mt-1">শিক্ষক ভিডিও যোগ করলেই এখানে দেখা যাবে</p>
                    </>
                  ) : (
                    <>
                      <Lock className="w-10 h-10 text-amber-400 mb-3" />
                      <p className="text-slate-200 font-bold text-sm sm:text-base">এনরোল্ড স্টুডেন্টরাই ভিডিও ক্লাস দেখতে পারবেন</p>
                      <p className="text-slate-400 text-xs mt-1 mb-4">
                        কোর্সে এনরোল করে শিক্ষকের অনুমোদন নিলে নিচের যাচাই বক্সে আইডি দিলেই ভিডিও আনলক হবে
                      </p>

                      {!isUnlocked && (
                        <form onSubmit={handleManualVerify} className="w-full max-w-sm space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={gateId}
                              onChange={(e) => setGateId(e.target.value)}
                              placeholder="স্টুডেন্ট আইডি / মোবাইল / ইমেইল"
                              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/95 text-slate-900 text-xs sm:text-sm border border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <button
                              type="submit"
                              disabled={gateBusy}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {gateBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                              যাচাই করুন
                            </button>
                          </div>
                          {gateError && <p className="text-amber-300 text-[11px] text-left">{gateError}</p>}
                        </form>
                      )}

                      {!accessChecked && !gateError && (
                        <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> এনরোলমেন্ট যাচাই হচ্ছে...
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Video info bar */}
              <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-white font-black text-sm sm:text-base leading-snug line-clamp-2">
                    {isUnlocked && selectedVideo ? selectedVideo.title : "ভিডিও ক্লাস"}
                  </h2>
                  {selectedVideo?.subject && (
                    <span className="inline-block mt-1.5 bg-white/10 text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/15">
                      {selectedVideo.subject}
                    </span>
                  )}
                  {selectedVideo?.description && (
                    <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{selectedVideo.description}</p>
                  )}
                </div>
                {isUnlocked && selectedVideo && (
                  <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 text-[10px] font-black px-2 py-1 rounded-md flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" /> আনলকড
                  </span>
                )}
              </div>
            </div>

            {/* Exams section */}
            <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" /> পরীক্ষাসমূহ
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-md border border-indigo-200">
                    {toBengaliDigits(examCount)}টি
                  </span>
                </h3>
              </div>

              {/* Exam search bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="পরীক্ষার নাম বা বিষয় লিখে খুঁজুন..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {filteredExams.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-medium">
                    {courseExams.length === 0 ? "এই কোর্সে এখনো কোনো পরীক্ষা যুক্ত নেই।" : `"${examSearch}" — কোনো পরীক্ষা পাওয়া যায়নি`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredExams.map(([eKey, ex]) => {
                    const qCount = ex.questions?.length || 0;
                    return (
                      <div
                        key={eKey}
                        className="p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-slate-900 text-sm truncate">{ex.title}</h4>
                            {ex.isFree && (
                              <span className="bg-emerald-100 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5" /> ফ্রি
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-slate-500 font-semibold">{ex.subject}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              <Clock className="w-3 h-3 text-amber-600" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              <CircleHelp className="w-3 h-3 text-indigo-600" /> {toBengaliDigits(qCount)}টি প্রশ্ন
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartExam(eKey)}
                          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-[0.98] shadow-sm"
                        >
                          <PlayCircle className="w-4 h-4" /> পরীক্ষা শুরু করুন
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ============ RIGHT: subject-wise video library ============ */}
          <aside className="lg:col-span-4 lg:sticky lg:top-4 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Video className="w-5 h-5 text-rose-600" /> ভিডিও লাইব্রেরি
                <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-md border border-rose-200">
                  {toBengaliDigits(videos.length)}টি
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">বিষয় বেছে নিন, ভিডিওতে চাপ দিলে বড় প্যানেলে দেখা যাবে</p>
            </div>

            {/* Subject filter chips */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSubjectFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                  subjectFilter === "ALL" ? "bg-rose-600 text-white border-rose-600" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                সব
              </button>
              {subjectsWithVideos.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubjectFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                    subjectFilter === s ? "bg-rose-600 text-white border-rose-600" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Video list */}
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {visibleVideos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">এই বিষয়ে কোনো ভিডিও নেই</p>
              ) : (
                visibleVideos.map((v) => {
                  const isActive = selectedVideoId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (isUnlocked) {
                          setSelectedVideoId(v.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        } else {
                          setGateError("ভিডিও দেখতে আগে এনরোলমেন্ট যাচাই করুন।");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center gap-3 cursor-pointer ${
                        isActive
                          ? "border-rose-400 bg-rose-50/70 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <img
                        src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                        alt=""
                        className="w-24 h-14 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                          {v.title}
                        </span>
                        <span className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                            {v.subject || "সাধারণ"}
                          </span>
                          {!isUnlocked && <Lock className="w-3 h-3 text-slate-400" />}
                          {isActive && <PlayCircle className="w-3.5 h-3.5 text-rose-600" />}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Enrollment hint */}
            {!isUnlocked && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" /> ভিডিও লক করা আছে
                </p>
                <p className="text-amber-800/90">
                  কোর্সে এনরোল্ড স্টুডেন্টরা সব ভিডিও দেখতে পারবেন। উপরের প্লেয়ারে আইডি দিয়ে যাচাই করুন অথবা{" "}
                  <button onClick={() => setEnrollOpen(true)} className="underline font-bold cursor-pointer">
                    Enroll করুন
                  </button>
                  ।
                </p>
              </div>
            )}
          </aside>
        </div>
      </main>

      <Footer />

      {/* Exam auth modal (Google login required flow) */}
      {pendingExam && (
        <StudentAuthModal
          isOpen={authOpen}
          exam={pendingExam}
          onClose={() => {
            setAuthOpen(false);
            setPendingExam(null);
          }}
          onVerified={handleStudentVerified}
          onOpenEnrollModal={() => setEnrollOpen(true)}
        />
      )}

      <EnrollModal
        isOpen={enrollOpen}
        courses={config.courses || []}
        initialCourse={courseName}
        onClose={() => setEnrollOpen(false)}
      />
    </>
  );
}
