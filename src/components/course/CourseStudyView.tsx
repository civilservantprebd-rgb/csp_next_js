"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { VideoPlayerModal } from "@/components/course/VideoPlayerModal";
import { CourseExamDetailView } from "@/components/course/CourseExamDetailView";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { getCoursePdfsAndRoutines } from "@/actions/pdf-actions";
import { getCourseVideosForStudent, StudentVideoAccess } from "@/actions/video-actions";
import { verifyStudentAccess } from "@/actions/student-actions";
import { getCourseWhatsAppForStudent } from "@/actions/whatsapp-actions";
import { AppConfigData, Exam } from "@/types/exam";
import { CourseVideo } from "@/types/video";
import { CoursePdfItem, CourseRoutineItem } from "@/types/pdf";
import { toBengaliDigits, sortExamsForStudents, formatBangladeshDate } from "@/lib/utils";
import { isExamCurrentlyLive, parseBangladeshDateTime, getTrueNowMs } from "@/lib/bangladesh-time";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";
import { getLocalIdentity, setVerifiedStudent } from "@/lib/student-identity";
import { useCompletedExams } from "@/lib/use-completed-exams";
import {
  ChevronLeft,
  ChevronDown,
  PlayCircle,
  Lock,
  Search,
  Clock,
  CircleHelp,
  CheckCircle2,
  BookOpen,
  Video,
  FileText,
  ExternalLink,
  GraduationCap,
  UserPlus,
  Loader2,
  ShieldCheck,
  ShoppingCart,
  Layers,
  LogIn,
  MessageCircle,
  Calendar,
  Sparkles,
  Info,
  X
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

export interface CourseClientProps {
  initialConfig?: AppConfigData | null;
  initialCourseDetails?: string;
  courseNameProp?: string;
  onBack?: () => void;
  embedded?: boolean;
}

export default function CourseClient({
  initialConfig = null,
  initialCourseDetails = "",
  courseNameProp,
  onBack,
  embedded = false
}: CourseClientProps) {
  const params = useParams();
  const router = useRouter();
  const courseName = courseNameProp || decodeParam(String(params?.courseName || ""));

  const [config, setConfig] = useState<AppConfigData | null>(initialConfig);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [videoResult, setVideoResult] = useState<StudentVideoAccess | null>(null);
  const [checking, setChecking] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [examSearch, setExamSearch] = useState("");
  const [coursePdfs, setCoursePdfs] = useState<CoursePdfItem[]>([]);
  const [courseRoutines, setCourseRoutines] = useState<CourseRoutineItem[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  const [pdfSubjectFilter, setPdfSubjectFilter] = useState("ALL");
  const completedExams = useCompletedExams();
  // এনরোল্ড স্টুডেন্টের জন্য কোর্সের WhatsApp গ্রুপ লিংক (খালি = দেখানো হবে না)
  const [waLink, setWaLink] = useState("");

  // কোর্স সেকশনের ৩টি বাটন: ভিডিও | পিডিএফ | পরীক্ষা (ডিফল্ট: পরীক্ষা)
  const [activeCourseTab, setActiveCourseTab] = useState<"video" | "pdf" | "exam">("exam");
  const [selectedDetailExamKey, setSelectedDetailExamKey] = useState<string | null>(null);

  useEffect(() => {
    if (!config) {
      fetchAppConfigLite().then((c) => setConfig(c)).catch(() => {});
    }
  }, [config]);

  useEffect(() => {
    if (courseName) {
      setLoadingPdfs(true);
      getCoursePdfsAndRoutines(courseName)
        .then((res) => {
          setCoursePdfs(res.pdfs || []);
          setCourseRoutines(res.routines || []);
        })
        .catch(() => {})
        .finally(() => setLoadingPdfs(false));
    }
  }, [courseName]);

  // Modal player — ভিডিওতে ট্যাপ করলেই খোলে
  const [playingVideo, setPlayingVideo] = useState<CourseVideo | null>(null);

  // Exam start modal state
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingExam, setPendingExam] = useState<Exam | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const hasGoogleUser = !!getLocalStudentUser();

  // সার্ভার-সাইড এনরোলমেন্ট চেক — প্রতি ভিজিটে, কোনো ক্যাশ করা "allowed" নেই
  const checkAccess = useCallback(async () => {
    if (!courseName) return;
    setChecking(true);
    const t0 = typeof window !== "undefined" ? performance.now() : 0;
    try {
      const access = await getCourseVideosForStudent(courseName, getLocalIdentity());
      try {
        if (typeof window !== "undefined") {
          console.log(`[course-page] video-access: ${Math.round(performance.now() - t0)}ms (allowed=${access.allowed})`);
        }
      } catch {
        /* ignore */
      }
      setVideoResult(access);
      if (access.allowed && access.name) {
        const id = getLocalIdentity();
        if (id) setVerifiedStudent({ id: id.id, name: access.name, email: id.email });
      }
    } catch (err) {
      // Access check failed (network/server): keep any previous result, log the
      // failure, and let `finally` switch the "enrollment check" spinner off.
      console.error("Course access check failed:", err);
    } finally {
      setChecking(false);
    }
  }, [courseName]);

  // ডায়াগনস্টিক: প্রতিটি সার্ভার কল কতক্ষণ নিচ্ছে — ব্রাউজার কনসোলে দেখায়
  const logLoadMs = (label: string, startMs: number) => {
    try {
      if (typeof window !== "undefined") {
        console.log(`[course-page] ${label}: ${Math.round(performance.now() - startMs)}ms`);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!courseName) return;
    setLoadError("");

    // WhatsApp লিংক — শুধু লোকাল পরিচয় থাকলেই fetch (অননুমোদিত/অ্যানন → সার্ভার খালি দেয়)
    const identity = getLocalIdentity();
    if (identity && (identity.id || identity.email)) {
      const tWa = performance.now();
      getCourseWhatsAppForStudent(courseName, identity)
        .then((l) => {
          logLoadMs("whatsapp-link", tWa);
          setWaLink(l);
        })
        .catch(() => {});
    }

    // ভিডিও + এনরোলমেন্ট যাচাই (আলাদা async) — সাথে সাথে শুরু হয়
    checkAccess();
  }, [courseName, checkAccess, loadAttempt]);

  const isUnlocked = videoResult?.allowed === true;
  const videos = videoResult?.videos || [];

  // সাবজেক্ট → প্লেলিস্ট। নিয়ম:
  //  - কোর্সে সাবজেক্ট (config.subjects) থাকলে সেগুলো আলাদা প্লেলিস্ট;
  //    সাবজেক্টবিহীন ভিডিও "সাধারণ" (কোর্স-লেভেল) প্লেলিস্টে থাকে।
  //  - কোর্সে কোনো সাবজেক্টই না থাকলে সব ভিডিও একটাই কোর্স-লেভেল প্লেলিস্টে।
  const playlists = useMemo(() => {
    const definedSubjects = (config?.subjects || [])
      .filter((s) => s.course === courseName)
      .map((s) => s.name);
    const hasSubjects = definedSubjects.length > 0;

    const label = (v: CourseVideo) => {
      const subj = String(v.subject || "").trim();
      if (!subj) return hasSubjects ? "সাধারণ" : courseName || "সাধারণ";
      return subj;
    };

    const map = new Map<string, CourseVideo[]>();
    videos.forEach((v) => {
      const subj = label(v);
      if (!map.has(subj)) map.set(subj, []);
      map.get(subj)!.push(v);
    });

    // সাজানো: নির্ধারিত সাবজেক্ট আগে → বাকি (অনির্বাচিত সাবজেক্ট) → "সাধারণ" শেষে;
    // সাবজেক্টবিহীন কোর্সে শুধু কোর্স-নামের একটাই প্লেলিস্ট।
    const desired: string[] = hasSubjects
      ? [
          ...definedSubjects,
          ...Array.from(map.keys()).filter(
            (k) => !definedSubjects.includes(k) && k !== "সাধারণ"
          ),
          ...(map.has("সাধারণ") ? ["সাধারণ"] : [])
        ]
      : [courseName || "সাধারণ"];

    const result: { subject: string; items: CourseVideo[] }[] = [];
    desired.forEach((name) => {
      const items = map.get(name);
      if (items && items.length > 0) result.push({ subject: name, items });
    });
    return result;
  }, [videos, config, courseName]);

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
      ([_, ex]) => {
        const titleMatch = ex.title.toLowerCase().includes(q);
        const subjectMatch = (ex.subject || "").toLowerCase().includes(q);
        const dateSource = ex.endTime || ex.leaderboardEndTime || ex.startTime;
        const dateFormatted = dateSource ? formatBangladeshDate(dateSource) : "";
        const dateMatch = dateFormatted.toLowerCase().includes(q);
        return titleMatch || subjectMatch || dateMatch;
      }
    );
  }, [courseExams, examSearch]);

  // ---- Exam বাছাই/সাজানো: subject-wise + serial (live → সম্প্রতি শেষ) ----
  const [examView, setExamView] = useState<"serial" | "subject">("subject");
  const [examSubject, setExamSubject] = useState("ALL");
  // প্রতি ৩০ সেকেন্ডে রি-রেন্ডার যাতে live/সম্প্রতি-শেষ হালনাগাদ থাকে
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const examSubjectOptions = useMemo(() => {
    const seen = new Set<string>();
    courseExams.forEach(([, ex]) => {
      const s = String(ex.subject || "").trim();
      if (s) seen.add(s);
    });
    return Array.from(seen);
  }, [courseExams]);

  const subjectKeyOf = (ex: Exam): string => {
    const s = String(ex.subject || "").trim();
    return s || "অন্যান্য";
  };

  // সিরিয়াল অর্ডার: ০=চলমান (start অনুযায়ী) → ১=শেষ হওয়া (endTime desc, সম্প্রতি আগে) → ২=সময়বিহীন
  const orderExamsNow = (list: [string, Exam][]): [string, Exam][] => {
    const info = (ex: Exam) => {
      const start = parseBangladeshDateTime(ex.startTime)?.getTime();
      const end = parseBangladeshDateTime(ex.endTime || ex.leaderboardEndTime)?.getTime();
      const live = isExamCurrentlyLive(ex);
      return { start, end, live };
    };
    return [...list]
      .map(([k, ex]) => ({ k, ex, i: info(ex) }))
      .sort((a, b) => {
        const ba = a.i.live ? 0 : a.i.end ? 1 : 2;
        const bb = b.i.live ? 0 : b.i.end ? 1 : 2;
        if (ba !== bb) return ba - bb;
        if (ba === 0) return (a.i.start ?? 0) - (b.i.start ?? 0);
        if (ba === 1) return (b.i.end ?? 0) - (a.i.end ?? 0);
        return 0;
      })
      .map((r) => [r.k, r.ex] as [string, Exam]);
  };

  const serialExams = useMemo(
    () => orderExamsNow(filteredExams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredExams, nowTick]
  );

  const examsBySubject = useMemo(() => {
    const map = new Map<string, [string, Exam][]>();
    examSubjectOptions.forEach((s) => map.set(s, []));
    filteredExams.forEach(([k, ex]) => {
      const key = subjectKeyOf(ex);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push([k, ex]);
    });
    const out: { subject: string; exams: [string, Exam][] }[] = [];
    map.forEach((list, subject) => {
      if (list.length > 0) out.push({ subject, exams: orderExamsNow(list) });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredExams, examSubjectOptions, nowTick]);

  const visibleBySubject =
    examSubject === "ALL" ? examsBySubject : examsBySubject.filter((g) => g.subject === examSubject);

  // দ্রুত শুরু: ক্লিক করার আগেই /exam রাউটগুলো প্রি-লোড — নেভিগেশন দেরি কমে যায়
  useEffect(() => {
    const keys = courseExams.map(([k]) => k);
    if (keys.length === 0) return;
    const t = setTimeout(() => {
      keys.slice(0, 25).forEach((k) => router.prefetch(`/exam/${encodeURIComponent(k)}`));
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseName, examsObj]);


  const handleStartExam = async (examKey: string) => {
    const ex = examsObj[examKey];
    if (!ex) return;
    const googleUser = getLocalStudentUser();

    if (googleUser) {
      // ফ্রি এক্সাম: কোনো অপেক্ষা ছাড়াই সাথে সাথে পরীক্ষার পেজে
      if (ex.isFree) {
        sessionStorage.setItem("current_student", JSON.stringify({ id: googleUser.uid, name: googleUser.name }));
        router.push(`/exam/${examKey}`);
        return;
      }
      const { isExamCurrentlyLive } = await import("@/lib/bangladesh-time");
      const { checkAttemptBlocked } = await import("@/lib/exam-attempt-cache");

      if (isExamCurrentlyLive(ex)) {
        const already = await checkAttemptBlocked(examKey, googleUser.uid);
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


    setPendingExam(ex);
    setAuthOpen(true);
  };

  const handleStudentVerified = (student: { id: string; name: string }) => {
    setAuthOpen(false);
    sessionStorage.setItem("current_student", JSON.stringify(student));
    if (pendingExam) router.push(`/exam/${pendingExam.id}`);
  };

  // একটি exam-রো (serial ও subject-ভিউ দুটিতেই ব্যবহৃত)
  const renderExamRow = (eKey: string, ex: Exam) => {
    const qCount = ex.questions?.length || 0;
    const live = isExamCurrentlyLive(ex);
    const dateSource = ex.endTime || ex.leaderboardEndTime || ex.startTime;
    const endDateFormatted = dateSource ? formatBangladeshDate(dateSource) : null;
    return (
      <div
        key={eKey}
        className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          live
            ? "border-rose-300 bg-rose-50/50 hover:border-rose-400 hover:bg-rose-50 shadow-sm"
            : "border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30"
        }`}
      >
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {live && (
              <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-xs font-black px-2 py-0.5 rounded-md shrink-0 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" /> লাইভ
              </span>
            )}
            <h4 className={`font-black text-sm flex flex-wrap items-center gap-2 ${live ? "text-rose-900" : "text-slate-900"}`}>
              <span>{ex.title}</span>
              {endDateFormatted && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 ${
                  live
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{live ? `শেষ: ${endDateFormatted}` : `শেষ: ${endDateFormatted}`}</span>
                </span>
              )}
              {completedExams.has(eKey) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> সম্পন্ন
                </span>
              )}
            </h4>
            {ex.isFree && (
              <span className="bg-emerald-100 text-emerald-950 text-xs font-black px-2 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                <CheckCircle2 className="w-2.5 h-2.5" /> ফ্রি
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {examView === "serial" && (
              <span className="text-sm text-slate-500 font-semibold">{ex.subject}</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3 text-amber-600" /> {toBengaliDigits(ex.timerMinutes)} মিনিট
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              <CircleHelp className="w-3 h-3 text-indigo-600" /> {toBengaliDigits(qCount)}টি প্রশ্ন
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
          <button
            type="button"
            onClick={() => setSelectedDetailExamKey(eKey)}
            className="w-full sm:w-auto px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/70 text-indigo-700 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] shadow-2xs whitespace-nowrap"
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            <span>বিস্তারিত</span>
          </button>
          <button
            onClick={() => handleStartExam(eKey)}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-[0.98] shadow-sm whitespace-nowrap"
          >
            <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>{completedExams.has(eKey) ? "আবার দিন" : "পরীক্ষা দিন"}</span>
          </button>
        </div>
      </div>
    );
  };

  const pdfSubjects = useMemo(() => {
    const set = new Set<string>();
    coursePdfs.forEach((p) => {
      set.add(p.subject || "সাধারণ");
    });
    return Array.from(set);
  }, [coursePdfs]);

  const filteredPdfs = useMemo(() => {
    if (pdfSubjectFilter === "ALL") return coursePdfs;
    return coursePdfs.filter((p) => (p.subject || "সাধারণ") === pdfSubjectFilter);
  }, [coursePdfs, pdfSubjectFilter]);

  const examCount = courseExams.length;

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 font-bengali text-slate-500">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> কোর্স লোড হচ্ছে...
        </div>
        {loadError && (
          <div className="text-center px-4 space-y-3">
            <p className="text-rose-600 text-xs font-bold">{loadError}</p>
            <button
              type="button"
              onClick={() => setLoadAttempt((n) => n + 1)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        )}
      </div>
    );
  }

  const courseSubjects = (config.subjects || []).filter((s) => s.course === courseName);

  return (
    <>
      {!embedded && <Header />}

      <div className={embedded ? "font-bengali space-y-4 sm:space-y-5" : "flex-grow max-w-7xl w-full mx-auto p-2.5 sm:p-5 md:p-6 font-bengali space-y-4 sm:space-y-5"}>
        {selectedDetailExamKey ? (
          <CourseExamDetailView
            examKey={selectedDetailExamKey}
            courseName={courseName}
            onBack={() => setSelectedDetailExamKey(null)}
            onStartExam={(k) => handleStartExam(k)}
          />
        ) : (
          <>
            {/* Course header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-3.5 sm:p-5 shadow-sm border border-slate-800">
              <button
                onClick={() => (onBack ? onBack() : router.push("/"))}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-200 hover:text-white transition cursor-pointer font-bold mb-2.5 sm:mb-3 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" /> সকল কোর্সে ফিরে যান
              </button>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shadow-md shrink-0">
                      <div className="w-full h-full bg-slate-900/90 rounded-[10px] flex items-center justify-center">
                        <GraduationCap className="w-4 h-4 text-amber-300" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-base sm:text-xl font-black text-white leading-tight truncate">{courseName}</h1>
                      <p className="text-[11px] text-indigo-200 font-semibold mt-0.5 truncate">
                        {toBengaliDigits(courseSubjects.length)}টি বিষয় · {toBengaliDigits(examCount)}টি পরীক্ষা
                        {isUnlocked && <> · {toBengaliDigits(playlists.length)}টি ভিডিও প্লেলিস্ট</>}
                      </p>
                    </div>
                  </div>

                  {courseSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-0.5">
                      {courseSubjects.slice(0, 8).map((s) => (
                        <span key={s.name} className="bg-white/10 border border-white/20 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md">
                          {s.name}
                        </span>
                      ))}
                      {courseSubjects.length > 8 && (
                        <span className="bg-white/5 text-indigo-200 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                          +{toBengaliDigits(courseSubjects.length - 8)}টি আরও
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {checking ? (
                  <div className="w-full sm:w-[100px] flex items-center justify-center py-2 shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                  </div>
                ) : (
                  <button
                    disabled={isUnlocked}
                    onClick={() => !isUnlocked && setEnrollOpen(true)}
                    className={`w-full sm:w-auto font-bold px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 shrink-0 ${
                      isUnlocked
                        ? "bg-emerald-900/40 text-emerald-100 cursor-not-allowed border border-emerald-500/30 shadow-none"
                        : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white hover:shadow-emerald-500/20 cursor-pointer active:scale-[0.98]"
                    }`}
                  >
                    {isUnlocked ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enrolled</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Enroll Now</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* প্রধান ৩টি বাটন: ভিডিও | পিডিএফ | পরীক্ষা */}
            <section className="bg-white rounded-2xl sm:rounded-3xl p-1 sm:p-2 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-3 gap-1 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setActiveCourseTab("video")}
              className={`flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3.5 px-1 sm:px-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base whitespace-nowrap transition cursor-pointer active:scale-[0.98] select-none min-w-0 ${
                activeCourseTab === "video"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/25 border border-rose-600"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
              }`}
            >
              <Video className="w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0" />
              <span className="shrink-0">ভিডিও</span>
              {videos.length > 0 && (
                <span
                  className={`text-[9px] sm:text-[11px] font-black px-1 sm:px-1.5 py-0.5 rounded-full shrink-0 leading-none min-w-[16px] text-center ${
                    activeCourseTab === "video"
                      ? "bg-white/20 text-white"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {toBengaliDigits(videos.length)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCourseTab("pdf")}
              className={`flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3.5 px-1 sm:px-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base whitespace-nowrap transition cursor-pointer active:scale-[0.98] select-none min-w-0 ${
                activeCourseTab === "pdf"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/25 border border-amber-600"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0" />
              <span className="shrink-0">পিডিএফ</span>
              {(coursePdfs.length + courseRoutines.length) > 0 && (
                <span
                  className={`text-[9px] sm:text-[11px] font-black px-1 sm:px-1.5 py-0.5 rounded-full shrink-0 leading-none min-w-[16px] text-center ${
                    activeCourseTab === "pdf"
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {toBengaliDigits(coursePdfs.length + courseRoutines.length)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCourseTab("exam")}
              className={`flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3.5 px-1 sm:px-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base whitespace-nowrap transition cursor-pointer active:scale-[0.98] select-none min-w-0 ${
                activeCourseTab === "exam"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-600"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0" />
              <span className="shrink-0">পরীক্ষা</span>
              {examCount > 0 && (
                <span
                  className={`text-[9px] sm:text-[11px] font-black px-1 sm:px-1.5 py-0.5 rounded-full shrink-0 leading-none min-w-[16px] text-center ${
                    activeCourseTab === "exam"
                      ? "bg-white/20 text-white"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {toBengaliDigits(examCount)}
                </span>
              )}
            </button>
          </div>
        </section>

        {/* ============ পরীক্ষাসমূহ ও ভিডিও ক্লাস (ফুল-উইডথ) ============ */}
        <div className="space-y-6">
            {/* WhatsApp গ্রুপ — কোর্সে এনরোল্ড স্টুডেন্ট ছাড়া কেউ দেখে না; ট্যাপ করলে WhatsApp খোলে */}
            {isUnlocked && waLink && (
              <section className="rounded-2xl sm:rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 shrink-0">
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-emerald-950 text-sm sm:text-base">WhatsApp কমিউনিটি</h3>
                      <p className="text-[11px] text-emerald-800/90 font-semibold leading-snug">
                        এই কোর্সের নিয়মিত আপডেট, নোটিশ ও আলোচনা
                      </p>
                    </div>
                  </div>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition cursor-pointer active:scale-[0.98] shrink-0 w-full sm:w-auto"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp-এ জয়েন করুন
                  </a>
                </div>
                <p className="text-[10px] text-emerald-700/80 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> শুধু এনরোল্ড স্টুডেন্টদের জন্য — ট্যাপ করলেই WhatsApp খুলবে
                </p>
              </section>
            )}

            {/* Exams section — পরীক্ষা ট্যাবের অধীনে */}
            {activeCourseTab === "exam" && (
              <section className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" /> পরীক্ষাসমূহ
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-black px-2 py-0.5 rounded-md border border-indigo-200">
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
                  className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* দৃশ্য টগল: বিষয় অনুযায়ী / সম্পূর্ণ তালিকা (serial) */}
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 sm:inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setExamView("subject")}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer text-center whitespace-nowrap ${
                      examView === "subject"
                        ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    বিষয় অনুযায়ী
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamView("serial")}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer text-center whitespace-nowrap ${
                      examView === "serial"
                        ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    সম্পূর্ণ তালিকা<span className="hidden sm:inline"> (লাইভ আগে)</span>
                  </button>
                </div>

                {examView === "subject" && examSubjectOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExamSubject("ALL")}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                        examSubject === "ALL"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      সব বিষয়
                    </button>
                    {examSubjectOptions.map((s) => {
                      const cnt = examsBySubject.find((g) => g.subject === s)?.exams.length ?? 0;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setExamSubject(s)}
                          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                            examSubject === s
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {s} ({toBengaliDigits(cnt)})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {examView === "subject" && examSubjectOptions.length > 0 ? (
                visibleBySubject.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-medium">এই বিষয়ে কোনো পরীক্ষা পাওয়া যায়নি।</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {visibleBySubject.map((group) => (
                      <div key={group.subject} className="space-y-2.5">
                        <div className="flex items-center gap-2 pt-1">
                          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
                            <BookOpen className="w-3.5 h-3.5" />
                          </span>
                          <h5 className="font-black text-slate-800 text-sm sm:text-base">{group.subject}</h5>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            {toBengaliDigits(group.exams.length)}টি
                          </span>
                        </div>
                        {group.exams.map(([eKey, ex]) => renderExamRow(eKey, ex))}
                      </div>
                    ))}
                  </div>
                )
              ) : serialExams.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-medium">
                    {courseExams.length === 0 ? "এই কোর্সে এখনো কোনো পরীক্ষা যুক্ত নেই।" : `"${examSearch}" — কোনো পরীক্ষা পাওয়া যায়নি`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {serialExams.map(([eKey, ex]) => renderExamRow(eKey, ex))}
                </div>
              )}
            </section>
          )}

          {/* ২. ভিডিও ক্লাস সেকশন — ভিডিও ট্যাবের অধীনে */}
          {activeCourseTab === "video" && (
            <section className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" /> ভিডিও ক্লাস
                  {isUnlocked && (
                    <span className="bg-rose-50 text-rose-700 text-xs font-black px-2 py-0.5 rounded-md border border-rose-200">
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
                  <div className="space-y-5 sm:space-y-6">
                    {/* সাবজেক্ট ফিল্টার চিপ */}
                    <div className="flex flex-wrap gap-1 sm:gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSubjectFilter("ALL")}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                          subjectFilter === "ALL" ? "bg-rose-600 text-white border-rose-600 shadow-2xs" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        সব প্লেলিস্ট
                      </button>
                      {playlists.map((p) => (
                        <button
                          key={p.subject}
                          type="button"
                          onClick={() => setSubjectFilter(p.subject)}
                          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                            subjectFilter === p.subject ? "bg-rose-600 text-white border-rose-600 shadow-2xs" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
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
                              <p className="text-xs text-slate-400 font-semibold">
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
                                    <span className="w-12 h-12 rounded-full bg-black/60 group-hover:bg-rose-600 text-white flex items-center justify-center backdrop-blur-sm transition shadow-lg">
                                      <PlayCircle className="w-6 h-6" />
                                    </span>
                                  </span>
                                  <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
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
                        className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
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
                          কোর্স কিনে শিক্ষকের অনুমোদন পেলে Google লগইন করলেই সব প্লেলিস্ট আনলক হয়ে যাবে।{" "}
                          <button onClick={() => setEnrollOpen(true)} className="underline font-bold text-amber-700 cursor-pointer">
                            আগে কোর্স কিনুন
                          </button>
                          ।
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loginWithGoogle(undefined, `/course/${encodeURIComponent(courseName)}`)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm transition shadow-md cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" /> Google দিয়ে লগইন করুন
                      </button>
                      {videoResult?.message && (
                        <p className="text-slate-400 text-sm">{videoResult.message}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ৩. পিডিএফ ও রুটিন ট্যাব — গুগল ড্রাইভ লিংক ওপেন */}
          {activeCourseTab === "pdf" && (
            <section className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 shadow-sm space-y-4 sm:space-y-6">
              

              {loadingPdfs ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> ফাইল লোড হচ্ছে...
                </div>
              ) : coursePdfs.length === 0 && courseRoutines.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                  <p className="text-sm font-bold text-slate-700">এই কোর্সে এখনো কোনো রুটিন বা পিডিএফ যুক্ত হয়নি</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    শিক্ষক প্যানেল থেকে রুটিন বা পিডিএফ ড্রাইভ লিংক যুক্ত করা হলে এখানে দেখা যাবে।
                  </p>
                </div>
              ) : (
                <div className="space-y-5 sm:space-y-6">
                  {/* ১. কোর্স রুটিন সেকশন (যদি রুটিন থাকে) */}
                  {courseRoutines.length > 0 && (
                    <div className="space-y-3 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 border border-indigo-200/70 p-3.5 sm:p-5 shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                            <Calendar className="w-4 h-4" />
                          </span>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm sm:text-base">
                              কোর্স রুটিন
                            </h4>
                            <p className="text-[11px] text-slate-500 font-semibold">
                              বর্তমান ও পূর্ববর্তী সকল সপ্তাহের গুগল ড্রাইভ রুটিন
                            </p>
                          </div>
                        </div>
          
                      </div>

                      {/* সর্বশেষ রুটিন — প্রধান হাইলাইট কার্ড */}
                      <div className="bg-white rounded-2xl border-2 border-indigo-300 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-indigo-400">
                        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                          </span>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] sm:text-[10px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md">
                                বর্তমান / সর্বশেষ রুটিন
                              </span>
                              <span className="text-[11px] text-slate-400 font-bold">
                                {formatBangladeshDate(courseRoutines[0].createdAt)}
                              </span>
                            </div>
                            <h5 className="font-black text-sm sm:text-base text-slate-900 leading-snug">
                              {courseRoutines[0].title}
                            </h5>
                          </div>
                        </div>

                        <a
                          href={courseRoutines[0].driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition cursor-pointer active:scale-[0.98] shrink-0 w-full sm:w-auto"
                        >
                          <ExternalLink className="w-4 h-4" /> রুটিন দেখুন (Drive)
                        </a>
                      </div>

                      {/* পূর্ববর্তী সপ্তাহের রুটিনসমূহ (পুরাতন রুটিনও থাকা লাগবে) */}
                      {courseRoutines.length > 1 && (
                        <div className="pt-2 space-y-2.5">
                          <p className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> পূর্ববর্তী সপ্তাহের রুটিনসমূহ ({toBengaliDigits(courseRoutines.length - 1)}টি)
                          </p>
                          <div className="space-y-2.5">
                            {courseRoutines.slice(1).map((r, rIdx) => (
                              <div
                                key={r.id || rIdx}
                                className="w-full bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 hover:shadow-sm transition"
                              >
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                  <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                  </span>
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                      {r.title}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-semibold">
                                      {formatBangladeshDate(r.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={r.driveLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm transition shrink-0 active:scale-95 w-full sm:w-auto"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> দেখুন
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ২. বিষয়ভিত্তিক লেকচার ও এক্সাম পিডিএফ শিট */}
                  {coursePdfs.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-600" /> বিষয়ভিত্তিক লেকচার ও পরীক্ষার শিট
                        </h4>
                        <span className="text-xs font-bold text-slate-500">
                          {toBengaliDigits(coursePdfs.length)}টি ফাইল
                        </span>
                      </div>

                      {videoResult?.allowed ? (
                        <>
                          {/* বিষয় ফিল্টার চিপ (যদি একাধিক বিষয় থাকে) */}
                          {pdfSubjects.length > 1 && (
                            <div className="flex flex-wrap gap-1 sm:gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPdfSubjectFilter("ALL")}
                                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                                  pdfSubjectFilter === "ALL"
                                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                সব বিষয় ({toBengaliDigits(coursePdfs.length)})
                              </button>
                              {pdfSubjects.map((subj) => {
                                const count = coursePdfs.filter((p) => (p.subject || "সাধারণ") === subj).length;
                                return (
                                  <button
                                    key={subj}
                                    type="button"
                                    onClick={() => setPdfSubjectFilter(subj)}
                                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                                      pdfSubjectFilter === subj
                                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                        : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                                    }`}
                                  >
                                    {subj} ({toBengaliDigits(count)})
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* পিডিএফ ফাইল তালিকা */}
                          <div className="space-y-2.5">
                            {filteredPdfs.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-6">
                                এই বিষয়ে কোনো পিডিএফ ফাইল পাওয়া যায়নি।
                              </p>
                            ) : (
                              filteredPdfs.map((pdf, idx) => (
                                <div
                                  key={pdf.id || `${pdf.examId}_${idx}`}
                                  onClick={() => window.open(pdf.driveLink, "_blank", "noopener,noreferrer")}
                                  className="group p-3 sm:p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer shadow-xs active:scale-[0.99]"
                                >
                                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                                    <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                                      <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </span>
                                    <div className="min-w-0 space-y-1">
                                      <h4 className="font-black text-sm text-slate-900 group-hover:text-emerald-900 transition leading-snug">
                                        {pdf.title}
                                      </h4>
                                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
                                        {pdf.subject && (
                                          <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[11px] sm:text-xs">
                                            {pdf.subject}
                                          </span>
                                        )}
                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] sm:text-xs">
                                          Google Drive
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <a
                                    href={pdf.driveLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow-sm shadow-emerald-600/20 active:scale-[0.98] cursor-pointer shrink-0 w-full sm:w-auto"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" /> ড্রাইভ ওপেন করুন
                                  </a>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : (
                        /* এনরোল না থাকলে পিডিএফ লকড কার্ড */
                        <div className="bg-gradient-to-br from-slate-50 to-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col items-center text-center gap-3">
                          {hasGoogleUser ? (
                            <>
                              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                                <Lock className="w-6 h-6 text-amber-600" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-black text-slate-900 text-sm sm:text-base">এই কোর্সের পিডিএফ শিটগুলো লক করা আছে</p>
                                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                                  {videoResult?.message || "শুধুমাত্র যারা এই কোর্সটি কিনেছেন (এনরোল্ড) তারাই লেকচার ও পরীক্ষার পিডিএফ দেখতে পারবেন। কোর্স কিনলে শিক্ষকের অনুমোদনের পর সকল শিট আনলক হয়ে যাবে।"}
                                </p>
                              </div>
                              <button
                                onClick={() => setEnrollOpen(true)}
                                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
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
                                <p className="font-black text-slate-900 text-sm sm:text-base">এনরোল্ড স্টুডেন্টরাই পিডিএফ শিট দেখতে পারবেন</p>
                                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                                  কোর্স কিনে শিক্ষকের অনুমোদন পেলে Google লগইন করলেই সব পিডিএফ শিট আনলক হয়ে যাবে।{" "}
                                  <button onClick={() => setEnrollOpen(true)} className="underline font-bold text-amber-700 cursor-pointer">
                                    আগে কোর্স কিনুন
                                  </button>
                                  ।
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => loginWithGoogle(undefined, `/course/${encodeURIComponent(courseName)}`)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm transition shadow-md cursor-pointer"
                              >
                                <LogIn className="w-4 h-4" /> Google দিয়ে লগইন করুন
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
          </>
        )}
      </div>

      {!embedded && <Footer />}

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
