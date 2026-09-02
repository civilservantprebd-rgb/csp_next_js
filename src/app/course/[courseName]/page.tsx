"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { VideoPlayerModal } from "@/components/course/VideoPlayerModal";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { getCourseVideosForStudent, StudentVideoAccess } from "@/actions/video-actions";
import { verifyStudentAccess } from "@/actions/student-actions";
import { AppConfigData, Exam } from "@/types/exam";
import { CourseVideo } from "@/types/video";
import { toBengaliDigits, sortExamsForStudents } from "@/lib/utils";
import { getLocalStudentUser } from "@/lib/student-auth";
import { getLocalIdentity, setVerifiedStudent } from "@/lib/student-identity";
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
  ShoppingCart,
  Layers
} from "lucide-react";

const EnrollModal = dynamic(() => import("@/components/modals/EnrollModal").then((m) => m.EnrollModal), { ssr: false });
const StudentAuthModal = dynamic(() => import("@/components/modals/StudentAuthModal").then((m) => m.StudentAuthModal), { ssr: false });

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
  const [videoResult, setVideoResult] = useState<StudentVideoAccess | null>(null);
  const [checking, setChecking] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [examSearch, setExamSearch] = useState("");

  // Modal player — ভিডিওতে ট্যাপ করলেই খোলে
  const [playingVideo, setPlayingVideo] = useState<CourseVideo | null>(null);

  // Manual identity gate
  const [gateId, setGateId] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState("");

  // Exam start modal state
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingExam, setPendingExam] = useState<Exam | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const hasGoogleUser = !!getLocalStudentUser();

  // সার্ভার-সাইড এনরোলমেন্ট চেক — প্রতি ভিজিটে, কোনো ক্যাশ করা "allowed" নেই
  const checkAccess = useCallback(async () => {
    if (!courseName) return;
    setChecking(true);
    const access = await getCourseVideosForStudent(courseName, getLocalIdentity());
    setVideoResult(access);
    if (access.allowed && access.name) {
      const id = getLocalIdentity();
      if (id) setVerifiedStudent({ id: id.id, name: access.name, email: id.email });
    }
    setChecking(false);
  }, [courseName]);

  useEffect(() => {
    if (!courseName) return;
    fetchAppConfigLite().then(setConfig);
    checkAccess();
  }, [courseName, checkAccess]);

  const isUnlocked = videoResult?.allowed === true;
  const videos = videoResult?.videos || [];

  // সাবজেক্ট → প্লেলিস্ট
  const playlists = useMemo(() => {
    const map = new Map<string, CourseVideo[]>();
    videos.forEach((v) => {
      const subj = v.subject || "সাধারণ";
      if (!map.has(subj)) map.set(subj, []);
      map.get(subj)!.push(v);
    });
    return Array.from(map.entries()).map(([subject, items]) => ({ subject, items }));
  }, [videos]);

  const visiblePlaylists = subjectFilter === "ALL" ? playlists : playlists.filter((p) => p.subject === subjectFilter);

  const openVideo = (v: CourseVideo) => {
    setPlayingVideo(v);
  };

  const playingPlaylist = useMemo(() => {
    if (!playingVideo) return [];
    return playlists.find((p) => p.subject === (playingVideo.subject || "সাধারণ"))?.items || [];
  }, [playingVideo, playlists]);

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

  // ম্যানুয়াল (মোবাইল/আইডি) স্টুডেন্ট যাচাই — একবার সফল হলে পরিচয় মনে থাকবে
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
        setVerifiedStudent({
          id: res.normalizedId || rawId,
          name: res.studentName || rawId
        });
        sessionStorage.setItem(
          "current_student",
          JSON.stringify({ id: res.normalizedId || rawId, name: res.studentName || rawId })
        );
        setGateId("");
        await checkAccess();
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
    const googleUser = getLocalStudentUser();
    const identity = getLocalIdentity();

    if (googleUser) {
      const { isExamCurrentlyLive } = await import("@/lib/bangladesh-time");
      const { checkStudentAlreadySubmitted } = await import("@/actions/exam-actions");

      if (isExamCurrentlyLive(ex)) {
        const already = await checkStudentAlreadySubmitted(examKey, googleUser.uid);
        if (already) {
          alert("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক অ্যাকাউন্ট দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      }

      if (ex.isFree) {
        sessionStorage.setItem("current_student", JSON.stringify({ id: googleUser.uid, name: googleUser.name }));
        router.push(`/exam/${examKey}`);
        return;
      } else {
        const res = await verifyStudentAccess(googleUser.uid, ex.course, googleUser.email);
        if (res.allowed) {
          sessionStorage.setItem(
            "current_student",
            JSON.stringify({ id: res.normalizedId || googleUser.uid, name: res.studentName || googleUser.name })
          );
          router.push(`/exam/${examKey}`);
          return;
        }
      }
      setPendingExam(ex);
      setAuthOpen(true);
      return;
    }

    if (identity) {
      if (ex.isFree) {
        sessionStorage.setItem(
          "current_student",
          JSON.stringify({ id: identity.id, name: identity.name || videoResult?.name || "শিক্ষার্থী" })
        );
        router.push(`/exam/${examKey}`);
        return;
      } else {
        const res = await verifyStudentAccess(identity.id, ex.course, identity.email);
        if (res.allowed) {
          sessionStorage.setItem(
            "current_student",
            JSON.stringify({ id: res.normalizedId || identity.id, name: res.studentName || identity.name || "শিক্ষার্থী" })
          );
          router.push(`/exam/${examKey}`);
          return;
        }
        alert(res.message || "এই কোর্সে আপনার এনরোলমেন্ট নেই — Enroll করে শিক্ষকের অনুমোদন নিন।");
        setEnrollOpen(true);
        return;
      }
    }

    setPendingExam(ex);
    setAuthOpen(true);
  };

  const handleStudentVerified = (student: { id: string; name: string }) => {
    setAuthOpen(false);
    sessionStorage.setItem("current_student", JSON.stringify(student));
    if (pendingExam) router.push(`/exam/${pendingExam.id}`);
  };

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
                    {toBengaliDigits(courseSubjects.length)}টি বিষয় · {toBengaliDigits(examCount)}টি পরীক্ষা
                    {isUnlocked && <> · {toBengaliDigits(playlists.length)}টি ভিডিও প্লেলিস্ট</>}
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
          {/* ============ LEFT: exams + video playlists ============ */}
          <div className="lg:col-span-8 space-y-5">
            {/* Exams section — সবার উপরে, যাতে পরীক্ষা সহজে পাওয়া যায় */}
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

            {/* ভিডিও ক্লাস সেকশন — বড় প্লেয়ার নেই, ট্যাপ করলেই মোডালে শুরু */}
            <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Video className="w-5 h-5 text-rose-600" /> ভিডিও ক্লাস
                  {isUnlocked && (
                    <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-md border border-rose-200">
                      {toBengaliDigits(videos.length)}টি ভিডিও
                    </span>
                  )}
                </h3>
              </div>

              {checking ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> এনরোলমেন্ট যাচাই হচ্ছে...
                </div>
              ) : isUnlocked ? (
                videos.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Video className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">এই কোর্সে এখনো কোনো ভিডিও ক্লাস যোগ হয়নি</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* সাবজেক্ট ফিল্টার চিপ */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSubjectFilter("ALL")}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                          subjectFilter === "ALL" ? "bg-rose-600 text-white border-rose-600" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        সব প্লেলিস্ট
                      </button>
                      {playlists.map((p) => (
                        <button
                          key={p.subject}
                          type="button"
                          onClick={() => setSubjectFilter(p.subject)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                            subjectFilter === p.subject ? "bg-rose-600 text-white border-rose-600" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {p.subject} ({toBengaliDigits(p.items.length)})
                        </button>
                      ))}
                    </div>

                    {/* প্লেলিস্ট গ্রুপ */}
                    {visiblePlaylists.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">এই সাবজেক্টে কোনো ভিডিও নেই</p>
                    ) : (
                      visiblePlaylists.map((playlist) => (
                        <div key={playlist.subject} className="space-y-3">
                          {/* প্লেলিস্ট হেডার */}
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                              <PlayCircle className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">{playlist.subject}</h4>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                প্লেলিস্ট · {toBengaliDigits(playlist.items.length)}টি ক্লাস
                              </p>
                            </div>
                          </div>

                          {/* ভিডিও কার্ড — ট্যাপ করলেই চলবে */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {playlist.items.map((v, vIdx) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => openVideo(v)}
                                className="group text-left bg-slate-50 hover:bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-rose-400 hover:shadow-md transition cursor-pointer active:scale-[0.99]"
                              >
                                <div className="relative aspect-video bg-slate-900">
                                  <img
                                    src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                                    alt=""
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-60 transition"
                                  />
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="w-12 h-12 rounded-full bg-black/60 group-hover:bg-rose-600 text-white flex items-center justify-center backdrop-blur-xs transition shadow-lg">
                                      <PlayCircle className="w-6 h-6" />
                                    </span>
                                  </span>
                                  <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                    {toBengaliDigits(vIdx + 1)}
                                  </span>
                                </div>
                                <div className="p-2.5">
                                  <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-rose-700 transition">
                                    {v.title}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )
              ) : (
                /* লকড অবস্থা */
                <div className="bg-gradient-to-br from-slate-50 to-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col items-center text-center gap-3">
                  {hasGoogleUser ? (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-slate-900 text-sm sm:text-base">এই কোর্সের ভিডিও ক্লাসগুলো লক করা আছে</p>
                        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                          {videoResult?.message || "শুধুমাত্র যারা এই কোর্সটি কিনেছেন (এনরোল্ড) তারাই ভিডিও দেখতে পারবেন। কোর্স কিনলে শিক্ষকের অনুমোদনের পরপরই সব প্লেলিস্ট আনলক হয়ে যাবে।"}
                        </p>
                      </div>
                      <button
                        onClick={() => setEnrollOpen(true)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <ShoppingCart className="w-4 h-4" /> কোর্স কিনুন (Enroll Now)
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-slate-900 text-sm sm:text-base">এনরোল্ড স্টুডেন্টরাই ভিডিও ক্লাস দেখতে পারবেন</p>
                        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                          কোর্স কিনে শিক্ষকের অনুমোদন পেলে নিচে আপনার আইডি/মোবাইল দিয়ে যাচাই করলেই সব প্লেলিস্ট আনলক হবে।{" "}
                          <button onClick={() => setEnrollOpen(true)} className="underline font-bold text-amber-700 cursor-pointer">
                            আগে কোর্স কিনুন
                          </button>
                          ।
                        </p>
                      </div>
                      <form onSubmit={handleManualVerify} className="w-full max-w-sm space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={gateId}
                            onChange={(e) => setGateId(e.target.value)}
                            placeholder="স্টুডেন্ট আইডি / মোবাইল / ইমেইল"
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white text-slate-900 text-xs sm:text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                        {gateError && <p className="text-rose-600 text-[11px] text-left">{gateError}</p>}
                        {videoResult?.message && !gateError && (
                          <p className="text-slate-400 text-[11px] text-left">{videoResult.message}</p>
                        )}
                      </form>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ============ RIGHT: সাবজেক্ট/প্লেলিস্ট ইন্ডেক্স ============ */}
          <aside className="lg:col-span-4 lg:sticky lg:top-4 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" /> প্লেলিস্ট ইন্ডেক্স
                {isUnlocked && (
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-md border border-indigo-200">
                    {toBengaliDigits(playlists.length)}টি
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isUnlocked ? "সাবজেক্ট অনুযায়ী ক্লাস — ট্যাপ করলেই ভিডিও শুরু হবে" : "এনরোল্ড স্টুডেন্টদের জন্য"}
              </p>
            </div>

            {!isUnlocked ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2">
                <Lock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  ভিডিও প্লেলিস্টগুলো লক করা আছে।
                  <br />
                  <button onClick={() => setEnrollOpen(true)} className="underline font-bold text-indigo-600 cursor-pointer">
                    কোর্স কিনুন
                  </button>
                  {!hasGoogleUser && " বা উপরে আইডি দিয়ে যাচাই করুন"}
                </p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-[11px] text-slate-400">কোনো প্লেলিস্ট নেই</p>
              </div>
            ) : (
              <div className="space-y-2">
                {playlists.map((p) => (
                  <button
                    key={p.subject}
                    type="button"
                    onClick={() => setSubjectFilter(p.subject)}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 cursor-pointer ${
                      subjectFilter === p.subject
                        ? "border-indigo-500 bg-indigo-50/60 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                      <PlayCircle className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-black text-slate-900 truncate">{p.subject}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">{toBengaliDigits(p.items.length)}টি ক্লাস</span>
                    </span>
                  </button>
                ))}
                {subjectFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSubjectFilter("ALL")}
                    className="w-full text-center text-[11px] font-bold text-indigo-600 hover:text-indigo-800 py-1 cursor-pointer"
                  >
                    সব প্লেলিস্ট দেখুন
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>

      <Footer />

      {/* ভিডিও প্লেয়ার মোডাল — ট্যাপ করলেই খোলে */}
      <VideoPlayerModal
        video={playingVideo}
        playlist={playingPlaylist}
        onClose={() => setPlayingVideo(null)}
        onSelect={(v) => setPlayingVideo(v)}
      />

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
