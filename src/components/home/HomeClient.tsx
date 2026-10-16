"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  Zap,
  Sparkles,
  CalendarClock,
  History,
  AlertOctagon,
  Bookmark,
  BarChart3,
  BookOpen,
  Layers,
  Award,
  Gift,
  Bell,
  Search,
  LogIn,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Play,
  Clock,
  CircleHelp,
  CheckCircle2,
  Calendar,
  Flame,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  User,
  ShieldCheck,
  Compass,
  Trophy,
  Loader2,
  FileText
} from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";

import { FreeModelTestsBox } from "@/components/dashboard/FreeModelTestsBox";
import { CourseCardGrid } from "@/components/dashboard/CourseCardGrid";
import { LiveExamsBox } from "@/components/dashboard/LiveExamsBox";
import { UpcomingExamsBox } from "@/components/dashboard/UpcomingExamsBox";
import { DailyNewsSection } from "@/components/dashboard/DailyNewsSection";
import { NewNewsPopup } from "@/components/dashboard/NewNewsPopup";
import { WhatsAppJoinPopup } from "@/components/dashboard/WhatsAppJoinPopup";
import { LandingPage } from "@/components/home/LandingPage";
import { ReferralCard } from "@/components/dashboard/ReferralCard";
import { AppConfigData, Exam } from "@/types/exam";
import { Submission } from "@/types/submission";
import { syncBangladeshNetworkTime, parseBangladeshDateTime, getTrueDate, getTrueNowMs, isAnswerTimeReached } from "@/lib/bangladesh-time";
import { getLocalStudentUser, loginWithGoogle, logoutStudentUser, StudentUser } from "@/lib/student-auth";
import { toBengaliDigits, sortExamsForStudents, formatBangladeshDate } from "@/lib/utils";
import { useCompletedExams } from "@/lib/use-completed-exams";
import { getRecentNotifications, type NotifItem } from "@/actions/notification-actions";
import { CourseGroupedResults } from "@/components/dashboard/CourseGroupedResults";
import { getStudentMistakes, getStudentBookmarks } from "@/lib/mistake-bookmark-store";
import { getStudentSubmissions } from "@/actions/student-actions";
import type { DailyNewsItem } from "@/actions/news-actions";

// Lazy-load modals
const EnrollModal = dynamic(() => import("@/components/modals/EnrollModal").then((m) => m.EnrollModal), { ssr: false });
const StudentAuthModal = dynamic(() => import("@/components/modals/StudentAuthModal").then((m) => m.StudentAuthModal), { ssr: false });
const StudentPortalLoginModal = dynamic(() => import("@/components/modals/StudentPortalLoginModal").then((m) => m.StudentPortalLoginModal), { ssr: false });
const StudentDashboardModal = dynamic(() => import("@/components/modals/StudentDashboardModal").then((m) => m.StudentDashboardModal), { ssr: false });
const ExamDetailPopup = dynamic(() => import("@/components/modals/ExamDetailPopup").then((m) => m.ExamDetailPopup), { ssr: false });
const QuestionBankView = dynamic(() => import("@/components/dashboard/QuestionBankView").then((m) => m.QuestionBankView), { ssr: false });
const LeaderboardView = dynamic(() => import("@/components/dashboard/LeaderboardView").then((m) => m.LeaderboardView), { ssr: false });
const PdfLibraryView = dynamic(() => import("@/components/dashboard/PdfLibraryView").then((m) => m.PdfLibraryView), { ssr: false });
const RoutineLibraryView = dynamic(() => import("@/components/dashboard/RoutineLibraryView").then((m) => m.RoutineLibraryView), { ssr: false });
const CourseClient = dynamic(() => import("@/components/course/CourseStudyView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20 text-indigo-600 gap-2">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="text-xs font-bold text-slate-500">কোর্স লোড হচ্ছে...</span>
    </div>
  )
});

const hasAuthTokensInUrl = () => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return hash.includes("access_token") || hash.includes("error") || search.includes("code=");
};

export type ActiveNavKey =
  | "dashboard"
  | "live_exams"
  | "free_exams"
  | "upcoming_exams"
  | "results"
  | "mistakes"
  | "bookmarks"
  | "analytics"
  | "leaderboard"
  | "practice"
  | "question_bank"
  | "courses"
  | "pdfs"
  | "routines"
  | "referral";

export default function HomeClient({
  config,
  initialDailyNews
}: {
  config: AppConfigData;
  initialDailyNews?: DailyNewsItem[];
}) {
  const router = useRouter();

  // Active navigation section
  const [activeNav, setActiveNav] = useState<ActiveNavKey>("dashboard");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [dashboardGroupOpen, setDashboardGroupOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarHidden, setDesktopSidebarHidden] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aarohon_desktop_sidebar_hidden");
      if (saved === "true") {
        setDesktopSidebarHidden(true);
      }
    }
  }, []);

  const toggleDesktopSidebar = () => {
    setDesktopSidebarHidden((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("aarohon_desktop_sidebar_hidden", String(next));
      }
      return next;
    });
  };

  // Student auth & portal
  const [studentUser, setStudentUser] = useState<StudentUser | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);

  // Selected exam & Modals state
  const [selectedExamKey, setSelectedExamKey] = useState(() => {
    const keys = Object.keys(config.exams || {});
    return keys[0] || "";
  });
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [selectedEnrollCourse, setSelectedEnrollCourse] = useState<string | undefined>(undefined);
  const [isStudentAuthOpen, setIsStudentAuthOpen] = useState(false);
  const [isStudentPortalLoginOpen, setIsStudentPortalLoginOpen] = useState(false);
  const [isStudentDashOpen, setIsStudentDashOpen] = useState(false);
  const [activePortalStudentId, setActivePortalStudentId] = useState("");
  const [selectedLeaderboardExam, setSelectedLeaderboardExam] = useState<string | null>(null);
  const [selectedSubmissionForPopup, setSelectedSubmissionForPopup] = useState<Submission | null>(null);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  // Gate: "loading" → "guest" / "user"
  const [gate, setGate] = useState<"loading" | "guest" | "user">("loading");

  // Notifications
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("notif_last_seen") || 0) || 0;
  });

  // Time & active exams tracking
  const [currentDate, setCurrentDate] = useState<Date>(() => getTrueDate());
  const [nowMs, setNowMs] = useState<number>(() => getTrueNowMs());
  const completedExams = useCompletedExams();

  const examsObj = useMemo(() => config.exams || {}, [config.exams]);
  const coursesList = config.courses || ["সাধারণ কোর্স"];
  const subjectsList = config.subjects || [];
  const currentExam: Exam | undefined = examsObj[selectedExamKey];

  useEffect(() => {
    const teacherLogged = !!sessionStorage.getItem("teacher_user");
    if (teacherLogged) {
      router.replace("/admin");
      return;
    }
    setIsTeacher(teacherLogged);

    syncBangladeshNetworkTime();
    const interval = setInterval(() => {
      syncBangladeshNetworkTime();
      setCurrentDate(getTrueDate());
      setNowMs(getTrueNowMs());
    }, 15000);

    const localUser = getLocalStudentUser();
    if (localUser) {
      setStudentUser(localUser);
      setActivePortalStudentId(localUser.uid);
    }

    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("open_enroll")) {
      sessionStorage.removeItem("open_enroll");
      setIsEnrollOpen(true);
    }

    const p = new URLSearchParams(window.location.search);
    const n = p.get("nav") as ActiveNavKey | null;
    const c = p.get("course");
    const ex = p.get("exam") || p.get("examId") || p.get("examKey");
    if (ex) {
      setSelectedLeaderboardExam(ex);
    }
    if (c) {
      setActiveNav("courses");
      setSelectedCourse(c);
    } else if (n) {
      setActiveNav(n);
    }

    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const navP = params.get("nav") as ActiveNavKey | null;
      const courseP = params.get("course");
      const examP = params.get("exam") || params.get("examId") || params.get("examKey");
      if (examP) setSelectedLeaderboardExam(examP);
      if (courseP) {
        setActiveNav("courses");
        setSelectedCourse(courseP);
      } else {
        setSelectedCourse(null);
        if (navP) setActiveNav(navP);
        else setActiveNav("dashboard");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useLayoutEffect(() => {
    if (hasAuthTokensInUrl()) setIsAuthProcessing(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const needsAuth =
        typeof window !== "undefined" &&
        (hasAuthTokensInUrl() ||
          !!localStorage.getItem("bcs_student_user") ||
          !!sessionStorage.getItem("teacher_user"));

      if (needsAuth) {
        try {
          await import("@/lib/supabase");
          await new Promise<void>((resolve) => {
            const deadline = Date.now() + 3000;
            let done = false;
            let timer: ReturnType<typeof setInterval>;
            let onStorage: () => void;
            const check = () => {
              if (done) return;
              if (getLocalStudentUser() || Date.now() > deadline) {
                done = true;
                clearInterval(timer);
                window.removeEventListener("storage", onStorage);
                resolve();
              }
            };
            onStorage = () => check();
            window.addEventListener("storage", onStorage);
            timer = setInterval(check, 120);
          });

          if (typeof window !== "undefined" && (window.location.hash || window.location.search)) {
            const url = new URL(window.location.href);
            url.hash = "";
            url.searchParams.delete("code");
            url.searchParams.delete("error");
            url.searchParams.delete("error_description");
            history.replaceState({}, "", url);
          }
        } catch { }
      }

      if (cancelled || typeof window === "undefined") {
        setIsAuthProcessing(false);
        return;
      }

      const intentExamId = sessionStorage.getItem("target_exam_intent");
      if (config && intentExamId && config.exams?.[intentExamId]) {
        sessionStorage.removeItem("target_exam_intent");
        setIsAuthProcessing(false);
        const waitForStudent = async (ms: number) => {
          const t0 = Date.now();
          while (Date.now() - t0 < ms) {
            const u = getLocalStudentUser();
            if (u) return u;
            await new Promise((r) => setTimeout(r, 300));
          }
          return null;
        };
        const readyUser = await waitForStudent(8000);
        if (readyUser) {
          handleStartExamByKey(intentExamId);
        } else {
          setSelectedExamKey(intentExamId);
          setIsStudentAuthOpen(true);
        }
        return;
      }

      const redirectPath = sessionStorage.getItem("auth_redirect");
      if (redirectPath && redirectPath.startsWith("/") && redirectPath !== "/") {
        sessionStorage.removeItem("auth_redirect");
        setIsAuthProcessing(false);
        router.replace(redirectPath);
        return;
      }

      setIsAuthProcessing(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    const keys = Object.keys(examsObj);
    if (keys.length === 0) return;
    const t = setTimeout(() => {
      keys.slice(0, 25).forEach((k) => router.prefetch(`/exam/${encodeURIComponent(k)}`));
    }, 700);
    return () => clearTimeout(t);
  }, [config, examsObj, router]);

  const handleStartExamByKey = async (examKey: string) => {
    const ex = examsObj[examKey];
    if (!ex) return;
    setSelectedExamKey(examKey);

    const localUser = getLocalStudentUser();

    if (ex.isFree && localUser) {
      sessionStorage.setItem(
        "current_student",
        JSON.stringify({ id: localUser.uid, name: localUser.name })
      );
      router.push(`/exam/${examKey}`);
      return;
    }

    if (localUser) {
      const { isExamCurrentlyLive } = await import("@/lib/bangladesh-time");
      const { checkAttemptBlocked } = await import("@/lib/exam-attempt-cache");

      if (isExamCurrentlyLive(ex)) {
        const already = await checkAttemptBlocked(examKey, localUser.uid);
        if (already) {
          alert("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক অ্যাকাউন্ট দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      }

      if (ex.isFree) {
        sessionStorage.setItem(
          "current_student",
          JSON.stringify({ id: localUser.uid, name: localUser.name })
        );
        router.push(`/exam/${examKey}`);
        return;
      } else {
        const { verifyStudentAccess } = await import("@/actions/student-actions");
        const res = await verifyStudentAccess(localUser.uid, ex.course, localUser.email);
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

  useEffect(() => {
    if (isAuthProcessing) return;
    const id = window.setTimeout(() => {
      const isTeacherNow = !!sessionStorage.getItem("teacher_user");
      const u = getLocalStudentUser();
      setGate(isTeacherNow || !!u ? "user" : "guest");
      if (u) {
        setStudentUser(u);
        setActivePortalStudentId(u.uid);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [isAuthProcessing, config]);

  useEffect(() => {
    const syncUser = () => {
      const u = getLocalStudentUser();
      if (u) {
        setStudentUser(u);
        setActivePortalStudentId(u.uid);
      } else {
        setStudentUser(null);
        setActivePortalStudentId("");
      }
      const isTeacherNow = !!sessionStorage.getItem("teacher_user");
      setGate(isTeacherNow || !!u ? "user" : "guest");
    };

    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  const handleLandingLogin = async () => {
    const { loginWithGoogle } = await import("@/lib/student-auth");
    await loginWithGoogle(undefined, "/");
  };

  const handleStudentLogout = async () => {
    if (confirm("আপনি কি নিশ্চিতভাবে লগআউট করতে চান?")) {
      await logoutStudentUser();
      window.location.reload();
    }
  };

  // Live Exams list calculation
  const liveExamKeys = useMemo(
    () =>
      Object.entries(examsObj)
        .filter(([_, ex]) => {
          if (!ex.startTime) return false;
          const start = parseBangladeshDateTime(ex.startTime);
          if (!start || currentDate < start) return false;
          if (ex.endTime) {
            const end = parseBangladeshDateTime(ex.endTime);
            if (end && currentDate > end) return false;
          } else if (ex.leaderboardEndTime) {
            const end = parseBangladeshDateTime(ex.leaderboardEndTime);
            if (end && currentDate > end) return false;
          }
          return true;
        })
        .sort(sortExamsForStudents)
        .map(([k]) => k),
    [examsObj, currentDate]
  );

  // Free exams state & course grouping
  const [freeExamCourseFilter, setFreeExamCourseFilter] = useState<string>("");

  const freeExamsList = useMemo(
    () => Object.entries(examsObj).filter(([_, ex]) => ex.isFree).sort(sortExamsForStudents),
    [examsObj]
  );

  const freeExamKeys = useMemo(
    () => freeExamsList.map(([k]) => k),
    [freeExamsList]
  );

  const freeExamCourseGroups = useMemo(() => {
    const map = new Map<string, [string, Exam][]>();
    freeExamsList.forEach((entry) => {
      const course = String(entry[1].course || "").trim() || "অন্যান্য কোর্স";
      const bucket = map.get(course);
      if (bucket) bucket.push(entry);
      else map.set(course, [entry]);
    });
    return Array.from(map.entries());
  }, [freeExamsList]);

  const visibleFreeExamGroups = useMemo(() => {
    if (!freeExamCourseFilter) return freeExamCourseGroups;
    return freeExamCourseGroups.filter(([c]) => c === freeExamCourseFilter);
  }, [freeExamCourseGroups, freeExamCourseFilter]);

  // Upcoming exams calculation (within 12 hours)
  const UPCOMING_WINDOW_MS = 12 * 3600 * 1000;
  const upcomingExamsList = useMemo(
    () =>
      Object.entries(examsObj)
        .map(([k, ex]) => ({ k, ex, start: ex.startTime ? parseBangladeshDateTime(ex.startTime) : null }))
        .filter(
          (x): x is { k: string; ex: Exam; start: Date } =>
            !!x.start && x.start.getTime() > nowMs && x.start.getTime() <= nowMs + UPCOMING_WINDOW_MS
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [examsObj, nowMs]
  );

  // Mistakes and bookmarks counts
  const studentMistakesCount = useMemo(() => {
    if (!studentUser?.uid) return 0;
    return getStudentMistakes(studentUser.uid).length;
  }, [studentUser]);

  const studentBookmarksCount = useMemo(() => {
    if (!studentUser?.uid) return 0;
    return getStudentBookmarks(studentUser.uid).length;
  }, [studentUser]);

  // Notifications loader
  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const local = getLocalStudentUser();
      const list = await getRecentNotifications(local ? { id: local.uid, email: local.email } : null);
      setNotifs(list);
    } catch { }
    setNotifLoading(false);
  };

  const markAllSeen = () => {
    const t = Date.now();
    localStorage.setItem("notif_last_seen", String(t));
    setSeenAt(t);
  };

  const unreadCount = notifs.filter((n) => new Date(n.timeISO).getTime() > seenAt).length;

  const toggleBell = () => {
    setIsNotifOpen((v) => {
      if (!v) loadNotifications();
      return !v;
    });
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "এইমাত্র";
    if (m < 60) return `${toBengaliDigits(m)} মিনিট আগে`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${toBengaliDigits(h)} ঘণ্টা আগে`;
    return `${toBengaliDigits(Math.floor(h / 24))} দিন আগে`;
  };

  // Switch navigation helper
  const handleNavSelect = (key: ActiveNavKey) => {
    setActiveNav(key);
    setMobileSidebarOpen(false);
    if (key !== "courses") {
      setSelectedCourse(null);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("course");
        if (key === "dashboard") {
          url.searchParams.delete("nav");
        } else {
          url.searchParams.set("nav", key);
        }
        history.pushState({}, "", url.pathname + (url.search ? url.search : ""));
      }
    } else {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("nav", "courses");
        if (!selectedCourse) url.searchParams.delete("course");
        history.pushState({}, "", url.pathname + (url.search ? url.search : ""));
      }
    }
  };

  const handleOpenCourse = (course: string) => {
    setSelectedCourse(course);
    setActiveNav("courses");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("nav", "courses");
      url.searchParams.set("course", course);
      history.pushState({}, "", url.pathname + url.search);
    }
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("course");
      url.searchParams.set("nav", "courses");
      history.pushState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  };

  // If gate is guest, render LandingPage
  if (gate === "guest") {
    return (
      <LandingPage
        courses={coursesList}
        subjects={subjectsList}
        pinnedCourses={config.pinnedCourses || []}
        onLogin={handleLandingLogin}
      />
    );
  }

  // Loading splash
  if (gate === "loading") {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-bengali flex flex-col items-center justify-center gap-4">
        <span className="bg-gradient-to-tr from-amber-400 to-indigo-500 p-2.5 rounded-2xl shadow-xl shadow-black/40">
          <GraduationCap className="w-8 h-8 text-slate-950" />
        </span>
        <p className="text-sm font-bold text-indigo-100">আরোহণ লোড হচ্ছে...</p>
        <span className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-bengali flex flex-col antialiased">
      {/* ========================================================================= */}
      {/* MAIN LAYOUT: FIXED/STICKY SIDEBAR (LEFT) + MAIN WORKSPACE (RIGHT)        */}
      {/* ========================================================================= */}
      <div className="flex-1 flex w-full relative">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ----------------- LEFT SIDEBAR ----------------- */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#141d2e] text-slate-300 flex flex-col border-r border-[#1f2c44] shadow-2xl transition-transform duration-300 ease-in-out ${
            desktopSidebarHidden ? "lg:-translate-x-full" : "lg:translate-x-0"
          } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {/* Logo & Brand Name */}
          <div className="h-16 px-5 border-b border-[#1f2c44] flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-400/20 group-hover:scale-105 transition-transform duration-200">
                <GraduationCap className="w-5 h-5 text-slate-950" />
              </span>
              <div className="flex flex-col">
                <span className="text-xl font-medium tracking-wide text-white group-hover:text-amber-300 transition-colors">
                  আরোহণ
                </span>
                <span className="text-[10px] text-slate-400 -mt-1 font-semibold tracking-wider uppercase">
                  BCS & Job Hub
                </span>
              </div>
            </Link>

            {/* Desktop hide button */}
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer active:scale-95"
              title="সাইডবার লুকান (ফুলস্ক্রিন)"
              aria-label="সাইডবার লুকান"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 text-xs font-medium custom-scrollbar">
            {/* GROUP: ড্যাশবোর্ড (Dashboard Group) */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setDashboardGroupOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer font-medium ${activeNav === "dashboard" ||
                  activeNav === "live_exams" ||
                  activeNav === "free_exams" ||
                  activeNav === "upcoming_exams" ||
                  activeNav === "results" ||
                  activeNav === "mistakes" ||
                  activeNav === "bookmarks" ||
                  activeNav === "analytics" ||
                  activeNav === "leaderboard"
                  ? "text-white bg-slate-800/80 border border-slate-700/60 shadow-sm"
                  : "text-white hover:bg-slate-800/40 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <LayoutDashboard className="w-4 h-4" />
                  </span>
                  <span className="text-[15px] font-medium tracking-wide">ড্যাশবোর্ড</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${dashboardGroupOpen ? "rotate-0" : "-rotate-90"
                    }`}
                />
              </button>

              {/* Sub-items under ড্যাশবোর্ড */}
              {dashboardGroupOpen && (
                <div className="pl-4 pr-1 pt-1 pb-1 space-y-1 border-l-2 border-slate-700/60 ml-4.5 my-1 animate-in fade-in duration-200">
                  {/* ওভারভিউ (Overview) */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("dashboard")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${activeNav === "dashboard"
                      ? "bg-indigo-600/30 text-amber-300 font-medium border border-indigo-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span>ওভারভিউ</span>
                  </button>

                  {/* লাইভ এক্সাম */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("live_exams")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${activeNav === "live_exams"
                      ? "bg-red-500/20 text-red-300 font-medium border border-red-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-red-400" />
                      <span>লাইভ এক্সাম</span>
                    </div>
                    {liveExamKeys.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-medium animate-pulse">
                        {toBengaliDigits(liveExamKeys.length)}
                      </span>
                    )}
                  </button>

                  {/* ফ্রী মডেল টেস্ট */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("free_exams")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${activeNav === "free_exams"
                      ? "bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ফ্রী মডেল টেস্ট</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                      ফ্রি
                    </span>
                  </button>

                  {/* আসন্ন মডেল টেস্ট */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("upcoming_exams")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${activeNav === "upcoming_exams"
                      ? "bg-rose-500/20 text-rose-300 font-medium border border-rose-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-3.5 h-3.5 text-rose-400" />
                      <span>আসন্ন মডেল টেস্ট</span>
                    </div>
                    {upcomingExamsList.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px]">
                        {toBengaliDigits(upcomingExamsList.length)}
                      </span>
                    )}
                  </button>

                  {/* ফলাফল */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("results")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${activeNav === "results"
                      ? "bg-purple-600/30 text-purple-200 font-medium border border-purple-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <History className="w-3.5 h-3.5 text-purple-400" />
                    <span>ফলাফল</span>
                  </button>

                  {/* ভুল উত্তরের খাতা */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("mistakes")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${activeNav === "mistakes"
                      ? "bg-rose-500/20 text-rose-300 font-medium border border-rose-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                      <span>ভুল উত্তরের খাতা</span>
                    </div>
                    {studentMistakesCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-900/60 text-rose-200 text-[10px]">
                        {toBengaliDigits(studentMistakesCount)}
                      </span>
                    )}
                  </button>


                  {/* এনালাইসিস */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("analytics")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${activeNav === "analytics"
                      ? "bg-blue-600/30 text-blue-200 font-medium border border-blue-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    <span>এনালাইসিস</span>
                  </button>

                  {/* লিডারবোর্ড */}
                  <button
                    type="button"
                    onClick={() => handleNavSelect("leaderboard")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${activeNav === "leaderboard"
                      ? "bg-amber-500/20 text-amber-300 font-medium border border-amber-500/40 shadow-sm"
                      : "text-white hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>লিডারবোর্ড</span>
                  </button>
                </div>
              )}
            </div>

            {/* DIVIDER & SUB-SECTION: নিচের সেকশনগুলো */}
            <div className="pt-2 border-t border-[#1f2c44] space-y-1">
              <p className="px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                অনুশীলন ও কোর্স
              </p>


              {/* প্রশ্ন ব্যাংক */}
              <button
                type="button"
                onClick={() => handleNavSelect("question_bank")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left font-medium ${activeNav === "question_bank"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-white hover:bg-white/5 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5" />
                  </span>
                  <span>অনুশীলন</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeNav === "question_bank" ? "text-cyan-400" : "text-slate-500"}`} />
              </button>

              {/* কোর্স */}
              <button
                type="button"
                onClick={() => handleNavSelect("courses")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left font-medium ${activeNav === "courses"
                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm"
                  : "text-white hover:bg-white/5 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5" />
                  </span>
                  <span>কোর্স</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  {toBengaliDigits(coursesList.length)}
                </span>
              </button>

              {/* পিডিএফ শিট */}
              <button
                type="button"
                onClick={() => handleNavSelect("pdfs")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left font-medium ${activeNav === "pdfs"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-white hover:bg-white/5 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  <span>পিডিএফ শিট</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeNav === "pdfs" ? "text-amber-400" : "text-slate-500"}`} />
              </button>

              {/* রুটিন */}
              <button
                type="button"
                onClick={() => handleNavSelect("routines")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left font-medium ${activeNav === "routines"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                  : "text-white hover:bg-white/5 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <span>রুটিন</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${activeNav === "routines" ? "text-indigo-400" : "text-slate-500"}`} />
              </button>

              {/* রেফারেল */}
              <button
                type="button"
                onClick={() => handleNavSelect("referral")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left font-medium ${activeNav === "referral"
                  ? "bg-gradient-to-r from-amber-500/25 to-pink-500/20 text-amber-300 border border-amber-400/40 shadow-sm"
                  : "text-white hover:bg-white/5 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-sm">
                    <Gift className="w-3.5 h-3.5" />
                  </span>
                  <span>রেফারেল</span>
                </div>
                <span className="bg-amber-400 text-slate-950 font-medium text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                  ৳৫০ অফার
                </span>
              </button>
            </div>
          </div>

          {/* User profile / Bottom bar inside sidebar */}
          <div className="p-3 border-t border-[#1f2c44] bg-[#0f172a]/70">
            {studentUser ? (
              <div className="flex items-center justify-between gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-medium text-xs shrink-0 overflow-hidden ring-1 ring-white/20">
                    {studentUser.photoURL ? (
                      <Image src={studentUser.photoURL} alt="Avatar" width={32} height={32} className="w-full h-full object-cover" />
                    ) : (
                      studentUser.name.charAt(0) || "S"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate leading-tight">{studentUser.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">স্টুডেন্ট আইডি: {studentUser.uid.slice(0, 6)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStudentLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition"
                  title="লগআউট"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLandingLogin}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-medium text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Google দিয়ে লগইন</span>
              </button>
            )}
          </div>
        </aside>

        {/* ----------------- RIGHT WORKSPACE AREA ----------------- */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out ${
            desktopSidebarHidden ? "lg:pl-0" : "lg:pl-64"
          }`}
        >
          {/* Top Bar matching Tablet UI mockup */}
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
            {/* Left: Mobile hamburger, Desktop sidebar toggle & Active Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0 active:scale-95"
                aria-label="মেনু খুলুন"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop sidebar toggle button */}
              <button
                type="button"
                onClick={toggleDesktopSidebar}
                className="hidden lg:inline-flex p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-indigo-600 transition shrink-0 active:scale-95 cursor-pointer items-center justify-center border border-slate-200/80 shadow-2xs"
                title={desktopSidebarHidden ? "সাইডবার দেখান" : "সাইডবার লুকান (ফুলস্ক্রিন)"}
                aria-label={desktopSidebarHidden ? "সাইডবার দেখান" : "সাইডবার লুকান"}
              >
                {desktopSidebarHidden ? (
                  <PanelLeftOpen className="w-5 h-5 text-indigo-600" />
                ) : (
                  <PanelLeftClose className="w-5 h-5" />
                )}
              </button>

              <div className="min-w-0">
                <h1 className="text-base sm:text-2xl font-medium text-slate-900 leading-tight truncate">
                  {activeNav === "dashboard" && "ওভারভিউ"}
                  {activeNav === "live_exams" && "লাইভ এক্সাম সমূহ"}
                  {activeNav === "free_exams" && "ফ্রী মডেল টেস্ট সমূহ"}
                  {activeNav === "upcoming_exams" && "আসন্ন মডেল টেস্ট"}
                  {activeNav === "results" && "পরীক্ষার ফলাফল"}
                  {activeNav === "mistakes" && "ভুল উত্তরের খাতা"}
                  {activeNav === "bookmarks" && "বুকমার্ককৃত প্রশ্নাবলী"}
                  {activeNav === "analytics" && "শক্তি ও দুর্বলতা"}
                  {activeNav === "leaderboard" && "লিডারবোর্ড"}
                  {activeNav === "question_bank" && "অনুশীলন"}
                  {activeNav === "courses" && (selectedCourse ? selectedCourse : "কোর্স সমূহ")}
                  {activeNav === "pdfs" && "লেকচার ও পিডিএফ শিট"}
                  {activeNav === "routines" && "কোর্স রুটিন সমূহ"}
                  {activeNav === "referral" && "রেফারেল ও রিওয়ার্ড"}
                </h1>
                {/* <p className="text-xs sm:text-sm text-slate-600 font-normal truncate hidden sm:block mt-0.5">
                  {activeNav === "courses" && selectedCourse
                    ? "কোর্সের পরীক্ষাসমূহ ও ভিডিও ক্লাস"
                    : "বিসিএস ও সরকারি চাকরির প্রস্তুতিতে আরোহণ আপনার সার্বক্ষণিক সঙ্গী"}
                </p> */}
              </div>
            </div>

            {/* Right: Quick actions, notifications bell, leaderboard, enroll button */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Leaderboard button */}
              <button
                type="button"
                onClick={() => handleNavSelect("leaderboard")}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 text-xs font-bold transition shadow-xs"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>লিডারবোর্ড</span>
              </button>

              {/* Enroll Now quick button */}
              <button
                type="button"
                onClick={() => handleOpenEnrollModal()}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-[11px] sm:text-xs font-medium transition shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <span>এনরোল করুন</span>
              </button>

              {/* Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={toggleBell}
                  className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
                  aria-label="নোটিফিকেশন"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-medium flex items-center justify-center shadow-xs border border-white">
                      {toBengaliDigits(unreadCount)}
                    </span>
                  )}
                </button>

                {/* Notifications Popup */}
                {isNotifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <span className="flex items-center gap-2 font-bold text-xs text-slate-800">
                        <Bell className="w-3.5 h-3.5 text-indigo-600" /> নোটিফিকেশন
                        {unreadCount > 0 && (
                          <span className="bg-rose-500 text-white text-[10px] font-medium px-1.5 py-0.2 rounded-full">
                            {toBengaliDigits(unreadCount)} নতুন
                          </span>
                        )}
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllSeen}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          সব পড়া হয়েছে
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifLoading && notifs.length === 0 && (
                        <div className="px-4 py-6 text-center text-xs text-slate-400">লোড হচ্ছে...</div>
                      )}
                      {!notifLoading && notifs.length === 0 && (
                        <div className="px-4 py-6 text-center text-xs text-slate-400">কোনো নতুন নোটিফিকেশন নেই</div>
                      )}
                      {notifs.map((n) => {
                        const isNew = new Date(n.timeISO).getTime() > seenAt;
                        return (
                          <div key={n.id} className={`px-4 py-2.5 flex gap-2.5 ${isNew ? "bg-indigo-50/50" : ""}`}>
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-xs font-bold text-slate-800">{n.title}</p>
                              <p className="text-[11px] text-slate-500 leading-snug">{n.body}</p>
                              <p className="text-[10px] text-slate-400">{timeAgo(n.timeISO)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Student avatar badge */}
              {studentUser && (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-300 flex items-center justify-center font-bold text-xs ring-2 ring-amber-400/30">
                    {studentUser.photoURL ? (
                      <Image src={studentUser.photoURL} alt="Avatar" width={32} height={32} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      studentUser.name.charAt(0) || "S"
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>


          {/* Main Content Workspace Body */}
          <main className="flex-1 px-3 sm:px-6 py-3.5 sm:py-5 space-y-5 sm:space-y-6 pb-24 lg:pb-6">
            {/* VIEW 1: ড্যাশবোর্ড ওভারভিউ (DASHBOARD OVERVIEW) */}
            {activeNav === "dashboard" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* দৈনিক সংবাদ — সবার উপরে */}
                <DailyNewsSection initialNews={initialDailyNews} />

                {/* ২ কলাম গ্রিড: লাইভ এক্সাম ও ফ্রি মডেল টেস্ট */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <LiveExamsBox
                    exams={examsObj}
                    onSelectLiveExam={handleStartExamByKey}
                    onOpenEnrollModal={handleOpenEnrollModal}
                  />

                  <FreeModelTestsBox
                    exams={examsObj}
                    onStartExam={handleStartExamByKey}
                    onOpenEnrollModal={handleOpenEnrollModal}
                  />
                </div>

                {/* আসন্ন লাইভ এক্সাম */}
                <UpcomingExamsBox exams={examsObj} />

                {/* কুইক অ্যাক্সেস: পিডিএফ শিট ও রুটিন */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div
                    onClick={() => handleNavSelect("pdfs")}
                    className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm group-hover:scale-105 transition shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-amber-800 transition truncate">
                          পিডিএফ শিট ও নোটস
                        </h4>
                        <p className="text-xs text-slate-500 truncate">
                          কোর্স ও বিষয়ভিত্তিক লেকচার শিট ও সমাধান
                        </p>
                      </div>
                    </div>
                    <span className="p-2 rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-slate-950 transition shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>

                  <div
                    onClick={() => handleNavSelect("routines")}
                    className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/80 hover:border-indigo-400 hover:shadow-md transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-indigo-800 transition truncate">
                          কোর্স রুটিন সমূহ
                        </h4>
                        <p className="text-xs text-slate-500 truncate">
                          সাপ্তাহিক পরীক্ষার শিডিউল ও ক্লাসের রুটিন
                        </p>
                      </div>
                    </div>
                    <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* পরীক্ষার ফলাফল সেকশন — কোর্স অনুযায়ী কার্ড */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-medium text-slate-900 leading-tight">
                          পরীক্ষার ফলাফল
                        </h3>
                      </div>
                    </div>
                  </div>

                  <CourseGroupedResults
                    exams={examsObj}
                    studentId={activePortalStudentId}
                    onSelectSubmissionDetail={(sub) => setSelectedSubmissionForPopup(sub)}
                    onOpenEnrollModal={() => handleOpenEnrollModal()}
                    onLoginPrompt={() => loginWithGoogle(undefined, "/")}
                  />
                </div>

                {/* মেধা তালিকা ও লিডারবোর্ড সেকশন — সরাসরি ড্যাশবোর্ড ওভারভিউতে */}
                <div className="pt-2">
                  <LeaderboardView
                    exams={examsObj}
                    initialExamKey={selectedLeaderboardExam || undefined}
                  />
                </div>
              </div>
            )}

            {/* VIEW 2: লাইভ এক্সাম (LIVE EXAMS DEDICATED VIEW) */}
            {activeNav === "live_exams" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {liveExamKeys.length === 0 ? (
                  <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-500 space-y-2">
                    <Zap className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-700">এই মুহূর্তে কোনো লাইভ পরীক্ষা চলমান নেই</p>
                    <p className="text-xs text-slate-400">আসন্ন পরীক্ষাগুলোর সময়সূচি দেখতে আসন্ন মডেল টেস্ট সেকশন দেখুন।</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {liveExamKeys.map((k) => {
                      const ex = examsObj[k];
                      const isCompleted = completedExams.has(k);
                      const qCount = ex.questions?.length || 0;
                      return (
                        <div
                          key={k}
                          onClick={() => handleStartExamByKey(k)}
                          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 hover:border-red-400 hover:shadow-md transition cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <span className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-xs">
                              <Zap className="w-6 h-6 fill-red-600" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="bg-slate-100 text-slate-800 text-[11px] font-medium px-2 py-0.5 rounded-lg border border-slate-200">
                                  {ex.course}
                                </span>
                                <span className="bg-red-100 text-red-800 text-[10px] font-medium px-2 py-0.5 rounded-md border border-red-300 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" /> Live
                                </span>
                                {ex.isFree && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-medium px-2 py-0.5 rounded-md border border-emerald-300">
                                    ফ্রি
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm sm:text-base font-medium text-slate-900 group-hover:text-red-700 transition leading-snug">
                                {ex.title}
                              </h3>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-semibold flex-wrap">
                                <span>{ex.subject}</span>
                                <span>• {toBengaliDigits(ex.timerMinutes)} মিনিট</span>
                                <span>• {toBengaliDigits(qCount)}টি প্রশ্ন</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4" /> সম্পন্ন হয়েছে
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-sm group-hover:scale-102 transition">
                                <Play className="w-3.5 h-3.5 fill-white" /> অংশ নিন
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: ফ্রী মডেল টেস্ট (FREE EXAMS DEDICATED VIEW) */}
            {activeNav === "free_exams" && (
              <div className="space-y-6 animate-in fade-in duration-200">


                {/* Course Filter Dropdown Box */}
                {freeExamCourseGroups.length > 1 && (
                  <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                        <Layers className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-medium text-slate-800 leading-tight">
                          কোর্স অনুযায়ী দেখুন
                        </h3>
                        <p className="text-[11px] text-slate-500 font-semibold">
                          যেকোনো একটি নির্দিষ্ট কোর্সের ফ্রি পরীক্ষা বেছে নিন
                        </p>
                      </div>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <select
                        value={freeExamCourseFilter}
                        onChange={(e) => setFreeExamCourseFilter(e.target.value)}
                        className="w-full appearance-none bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-900 text-xs sm:text-sm font-medium border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 pr-10 transition cursor-pointer outline-none shadow-xs"
                      >
                        <option value="">
                          সকল কোর্স ({toBengaliDigits(freeExamKeys.length)}টি পরীক্ষা)
                        </option>
                        {freeExamCourseGroups.map(([cName, items]) => (
                          <option key={cName} value={cName}>
                            {cName} ({toBengaliDigits(items.length)}টি পরীক্ষা)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Course-Wise Grouped Exam Cards */}
                {visibleFreeExamGroups.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-slate-500 font-bold">
                    কোনো ফ্রি মডেল টেস্ট পাওয়া যায়নি।
                  </div>
                ) : (
                  <div className="space-y-6">
                    {visibleFreeExamGroups.map(([courseName, groupExams]) => (
                      <div
                        key={courseName}
                        className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden"
                      >
                        {/* Course Group Header */}
                        <div className="bg-gradient-to-r from-slate-50 to-emerald-50/40 px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-medium">
                              <BookOpen className="w-4 h-4 text-emerald-700" />
                            </span>
                            <div>
                              <h3 className="text-base font-medium text-slate-900 leading-tight">
                                {courseName}
                              </h3>
                              <span className="text-[11px] text-slate-500 font-bold">
                                {toBengaliDigits(groupExams.length)}টি ফ্রি পরীক্ষা উপলব্ধ
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            উন্মুক্ত
                          </span>
                        </div>

                        {/* List of Exams under this Course */}
                        <div className="p-3 sm:p-4 divide-y divide-slate-100 space-y-1">
                          {groupExams.map(([key, ex]) => {
                            const isCompleted = completedExams.has(key);
                            const qCount = ex.questions?.length || 0;
                            return (
                              <div
                                key={key}
                                onClick={() => handleStartExamByKey(key)}
                                className="p-3 sm:p-4 rounded-2xl hover:bg-emerald-50/50 hover:border-emerald-200 border border-transparent transition cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <span className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition shadow-xs mt-0.5">
                                    <Sparkles className="w-5 h-5" />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-medium px-2 py-0.5 rounded-md border border-emerald-200">
                                        ফ্রি মডেল টেস্ট
                                      </span>
                                      {ex.subject && (
                                        <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-200">
                                          {ex.subject}
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-sm sm:text-base font-medium text-slate-900 group-hover:text-emerald-700 transition leading-snug">
                                      {ex.title}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-semibold flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        {toBengaliDigits(ex.timerMinutes)} মিনিট
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <CircleHelp className="w-3.5 h-3.5 text-slate-400" />
                                        {toBengaliDigits(qCount)}টি প্রশ্ন
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2 pt-1 sm:pt-0">
                                  {isCompleted ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> সম্পন্ন
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 group-hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition">
                                      <Play className="w-3.5 h-3.5 fill-white" /> পরীক্ষা দিন
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 4: আসন্ন মডেল টেস্ট (UPCOMING EXAMS DEDICATED VIEW) */}
            {activeNav === "upcoming_exams" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* <div className="bg-gradient-to-r from-rose-600 to-pink-700 text-white p-5 rounded-3xl shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                      <CalendarClock className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-medium">আসন্ন মডেল টেস্ট</h2>
                      <p className="text-xs text-rose-100 font-semibold mt-0.5">
                        {toBengaliDigits(upcomingExamsList.length)}টি পরীক্ষা শুরু হতে বাকি — টাইমার শেষ হতেই লাইভ হবে
                      </p>
                    </div>
                  </div>
                </div> */}

                <UpcomingExamsBox
                  exams={examsObj}
                  showEmptyGreetings={true}
                  onNavigate={(tab) => handleNavSelect(tab as any)}
                />
              </div>
            )}

            {/* VIEW 5: পরীক্ষার ফলাফল (RESULTS DEDICATED VIEW) */}
            {activeNav === "results" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <CourseGroupedResults
                  exams={examsObj}
                  studentId={activePortalStudentId || studentUser?.uid || ""}
                  onSelectSubmissionDetail={(sub) => setSelectedSubmissionForPopup(sub)}
                  onOpenEnrollModal={() => handleOpenEnrollModal()}
                  onLoginPrompt={() => loginWithGoogle(undefined, "/")}
                />
              </div>
            )}

            {/* VIEW 6: ভুল উত্তরের খাতা (MISTAKES BANK VIEW) */}
            {activeNav === "mistakes" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <StudentDashboardModal
                  isOpen={true}
                  embedded={true}
                  wide={true}
                  initialTab="mistakes"
                  hideTabs={true}
                  studentId={activePortalStudentId || studentUser?.uid || ""}
                  exams={examsObj}
                  config={config}
                  onClose={() => { }}
                  onSelectSubmissionDetail={(sub) => setSelectedSubmissionForPopup(sub)}
                />
              </div>
            )}

            {/* VIEW 7: বুকমার্ক্স (BOOKMARKS VIEW) */}
            {activeNav === "bookmarks" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <StudentDashboardModal
                  isOpen={true}
                  embedded={true}
                  wide={true}
                  initialTab="bookmarks"
                  hideTabs={true}
                  studentId={activePortalStudentId || studentUser?.uid || ""}
                  exams={examsObj}
                  config={config}
                  onClose={() => { }}
                  onSelectSubmissionDetail={(sub) => setSelectedSubmissionForPopup(sub)}
                />
              </div>
            )}

            {/* VIEW 8: এনালাইসিস (ANALYTICS & WEAKNESS VIEW) */}
            {activeNav === "analytics" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <StudentDashboardModal
                  isOpen={true}
                  embedded={true}
                  wide={true}
                  initialTab="analytics"
                  hideTabs={true}
                  studentId={activePortalStudentId || studentUser?.uid || ""}
                  exams={examsObj}
                  config={config}
                  onClose={() => { }}
                  onSelectSubmissionDetail={(sub) => setSelectedSubmissionForPopup(sub)}
                />
              </div>
            )}

            {/* VIEW: লিডারবোর্ড (LEADERBOARD VIEW) */}
            {activeNav === "leaderboard" && (
              <LeaderboardView
                exams={examsObj}
                initialExamKey={selectedLeaderboardExam || undefined}
              />
            )}

            {/* VIEW: প্রশ্নব্যাংক (QUESTION BANK VIEW) */}
            {activeNav === "question_bank" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <QuestionBankView onOpenEnrollModal={handleOpenEnrollModal} />
              </div>
            )}

            {/* VIEW 9: কোর্স (COURSES CARD GRID VIEW) */}
            {activeNav === "courses" && (
              <div className="space-y-5 animate-in fade-in duration-200">


                {/* 
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 p-5 rounded-3xl shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/30 flex items-center justify-center shrink-0">
                      <BookOpen className="w-6 h-6 text-slate-950" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-medium">সকল কোর্স সমূহ</h2>
                      <p className="text-xs text-amber-950 font-bold mt-0.5">
                        আপনার পছন্দের কোর্স বেছে নিন ও নিয়মতান্ত্রিক পরীক্ষা দিয়ে নিজেকে প্রস্তুত করুন
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEnrollModal()}
                    className="px-4 py-2 rounded-xl bg-slate-950 text-white font-bold text-xs shadow-sm cursor-pointer hover:bg-slate-900 transition"
                  >
                    এনরোল করুন
                  </button>
                </div>
                */}


                {selectedCourse ? (
                  <CourseClient
                    courseNameProp={selectedCourse}
                    initialConfig={config}
                    onBack={handleBackToCourses}
                    embedded={true}
                  />
                ) : (
                  <CourseCardGrid
                    courses={coursesList}
                    subjects={subjectsList}
                    exams={examsObj}
                    pinnedCourses={config.pinnedCourses || []}
                    onOpenCourse={handleOpenCourse}
                    onOpenEnrollModal={handleOpenEnrollModal}
                  />
                )}
              </div>
            )}

            {/* VIEW: পিডিএফ শিট (PDF LIBRARY VIEW) */}
            {activeNav === "pdfs" && (
              <PdfLibraryView courses={coursesList} />
            )}

            {/* VIEW: রুটিন (ROUTINE LIBRARY VIEW) */}
            {activeNav === "routines" && (
              <RoutineLibraryView courses={coursesList} />
            )}

            {/* VIEW 10: রেফারেল (REFERRAL & REWARDS VIEW) */}
            {activeNav === "referral" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* 
                <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white p-5 rounded-3xl shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                      <Gift className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-medium">রেফারেল প্রোগ্রাম</h2>
                      <p className="text-xs text-indigo-200 font-semibold mt-0.5">
                        বন্ধুদের রেফার করে আয় করুন আকর্ষণীয় রিওয়ার্ড ও সহপাঠীদের দিন বিশেষ ছাড়
                      </p>
                    </div>
                  </div>
                </div>
                */}

                <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs">
                  <ReferralCard studentId={activePortalStudentId || studentUser?.uid || ""} />
                </div>
              </div>
            )}
          </main>

          {/* Simple Clean Footer */}
          <footer className="mt-auto py-5 px-4 sm:px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-900 font-medium pb-24 lg:pb-5">
            © {new Date().getFullYear()} আরোহণ — বিসিএস ও সরকারি চাকরির প্রস্তুতি পোর্টাল | সর্বস্বত্ব সংরক্ষিত
          </footer>

          {/* ----------------- MOBILE BOTTOM NAVIGATION BAR ----------------- */}
          <nav
            aria-label="মোবাইল নেভিগেশন"
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around font-bengali"
          >
            {/* Overview / Dashboard */}
            <button
              type="button"
              onClick={() => handleNavSelect("dashboard")}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-xl active:scale-95 ${activeNav === "dashboard"
                ? "text-indigo-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
                }`}
            >
              <div className={`p-1 rounded-xl transition-all ${activeNav === "dashboard" ? "bg-indigo-50 text-indigo-600" : ""}`}>
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-0.5">ওভারভিউ</span>
            </button>

            {/* Live Exams (with pulsing red count badge) */}
            <button
              type="button"
              onClick={() => handleNavSelect("live_exams")}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-xl relative active:scale-95 ${activeNav === "live_exams"
                ? "text-red-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
                }`}
            >
              <div className={`p-1 rounded-xl transition-all relative ${activeNav === "live_exams" ? "bg-red-50 text-red-600" : ""}`}>
                <Zap className="w-5 h-5" />
                {liveExamKeys.length > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {toBengaliDigits(liveExamKeys.length)}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight mt-0.5">লাইভ</span>
            </button>

            {/* Question Bank / Practice */}
            <button
              type="button"
              onClick={() => handleNavSelect("question_bank")}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-xl active:scale-95 ${activeNav === "question_bank"
                ? "text-cyan-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
                }`}
            >
              <div className={`p-1 rounded-xl transition-all ${activeNav === "question_bank" ? "bg-cyan-50 text-cyan-600" : ""}`}>
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-0.5">অনুশীলন</span>
            </button>

            {/* Courses */}
            <button
              type="button"
              onClick={() => {
                if (activeNav === "courses" && selectedCourse) {
                  handleBackToCourses();
                } else {
                  handleNavSelect("courses");
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-xl active:scale-95 ${activeNav === "courses"
                ? "text-amber-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
                }`}
            >
              <div className={`p-1 rounded-xl transition-all ${activeNav === "courses" ? "bg-amber-50 text-amber-600" : ""}`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-0.5">কোর্স</span>
            </button>

            {/* Menu Drawer Toggle */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-xl text-slate-500 hover:text-slate-800 font-medium active:scale-95"
            >
              <div className="p-1 rounded-xl">
                <Menu className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-0.5">মেনু</span>
            </button>
          </nav>
        </div>
      </div >

      {/* Popups & Modals */}
      < NewNewsPopup initialNews={initialDailyNews} />
      <WhatsAppJoinPopup />

      <EnrollModal
        isOpen={isEnrollOpen}
        courses={coursesList}
        initialCourse={selectedEnrollCourse}
        onClose={() => {
          setIsEnrollOpen(false);
          setSelectedEnrollCourse(undefined);
        }}
      />

      {
        currentExam && (
          <StudentAuthModal
            isOpen={isStudentAuthOpen}
            exam={currentExam}
            onClose={() => setIsStudentAuthOpen(false)}
            onVerified={handleStudentVerified}
          />
        )
      }

      <StudentPortalLoginModal
        isOpen={isStudentPortalLoginOpen}
        onClose={() => setIsStudentPortalLoginOpen(false)}
        onLoginSuccess={(id) => {
          setActivePortalStudentId(id);
          setIsStudentDashOpen(true);
        }}
        onOpenEnrollModal={() => handleOpenEnrollModal()}
      />

      <StudentDashboardModal
        isOpen={isStudentDashOpen}
        studentId={activePortalStudentId}
        exams={examsObj}
        config={config}
        onClose={() => setIsStudentDashOpen(false)}
        onSelectSubmissionDetail={(sub) => setSelectedSubmissionForPopup(sub)}
      />

      <ExamDetailPopup
        isOpen={!!selectedSubmissionForPopup}
        submission={selectedSubmissionForPopup}
        exam={selectedSubmissionForPopup ? examsObj[selectedSubmissionForPopup.examKey] || null : null}
        onClose={() => setSelectedSubmissionForPopup(null)}
      />

      {
        isAuthProcessing && (
          <div className="fixed inset-0 z-[70] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 font-bengali">
            <div className="w-11 h-11 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            <p className="text-sm font-bold text-slate-800">লগইন হচ্ছে...</p>
            <p className="text-xs text-slate-500">এক মুহূর্ত অপেক্ষা করুন — পরীক্ষা স্বয়ংক্রিয়ভাবে শুরু হবে</p>
          </div>
        )
      }
    </div >
  );
}
