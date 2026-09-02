"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Contact, Trophy, Menu, X, Bell, Sparkles, Layers, ShoppingCart, Clock, Video, Loader2 } from "lucide-react";
import { getRecentNotifications, type NotifItem } from "@/actions/notification-actions";
import { toBengaliDigits } from "@/lib/utils";

interface HeaderProps {
  onOpenStudentPortal?: () => void;
  onOpenLeaderboard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenStudentPortal, onOpenLeaderboard }) => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("notif_last_seen") || 0) || 0;
  });

  useEffect(() => {
    const refreshTeacherState = () => {
      setIsTeacher(!!sessionStorage.getItem("teacher_user"));
    };
    refreshTeacherState();

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Re-read on auth changes (login/logout in this tab or another tab)
    window.addEventListener("storage", refreshTeacherState);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("storage", refreshTeacherState);
    };
  }, []);

  // Close the drawer / notification panel with the Escape key
  useEffect(() => {
    if (!isMenuOpen && !isNotifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        setIsNotifOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen, isNotifOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  const openStudentPortal = (e: React.MouseEvent) => {
    if (isTeacher) {
      e.preventDefault();
      alert("⚠️ আপনি শিক্ষক প্যানেলে লগইন করে আছেন। স্টুডেন্ট পোর্টাল ব্যবহার করতে চাইলে প্রথমে শিক্ষক প্যানেল থেকে লগআউট করুন।");
      return;
    }
    closeMenu();
    if (onOpenStudentPortal) onOpenStudentPortal();
    else router.push("/portal");
  };

  const openLeaderboard = () => {
    closeMenu();
    if (onOpenLeaderboard) onOpenLeaderboard();
    else router.push("/leaderboard/exam_01");
  };

  const goHome = () => {
    closeMenu();
    if (isTeacher) router.push("/admin");
    else router.push("/");
  };

  const unreadCount = notifs.filter((n) => new Date(n.timeISO).getTime() > seenAt).length;

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const list = await getRecentNotifications();
      setNotifs(list);
    } catch {
      // নেটওয়ার্ক সমস্যা হলে বেল খালি থাকে
    }
    setNotifLoading(false);
  };

  const markAllSeen = () => {
    const nowMs = Date.now();
    localStorage.setItem("notif_last_seen", String(nowMs));
    setSeenAt(nowMs);
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

  const toggleBell = () => {
    setIsNotifOpen((v) => {
      if (!v && notifs.length === 0) loadNotifications();
      return !v;
    });
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Light top bar, coherent with the site's white/slate design language */}
      <header className={`bg-white/95 backdrop-blur-md text-slate-800 shadow-sm sticky top-0 z-40 border-b border-slate-200 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex items-center justify-between gap-2 relative">
          {/* Left: notification bell */}
          <div className="flex-1 flex justify-start relative">
            <button
              type="button"
              onClick={toggleBell}
              aria-label="নোটিফিকেশন"
              aria-expanded={isNotifOpen}
              className="relative p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 cursor-pointer transition"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm border border-white">
                  {toBengaliDigits(unreadCount)}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {isNotifOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 max-w-[88vw] bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 font-bengali">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="flex items-center gap-2 font-bold text-sm text-slate-800">
                    <Bell className="w-4 h-4 text-indigo-600" /> নোটিফিকেশন
                    {unreadCount > 0 && (
                      <span className="bg-rose-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                        {toBengaliDigits(unreadCount)} নতুন
                      </span>
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllSeen}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      সব পড়া হয়েছে
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifLoading && notifs.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> লোড হচ্ছে...
                    </div>
                  )}
                  {!notifLoading && notifs.length === 0 && (
                    <div className="px-4 py-8 text-center space-y-1.5">
                      <p className="text-sm font-semibold text-slate-600">কোনো নতুন নোটিফিকেশন নেই</p>
                      <p className="text-xs text-slate-400">পরীক্ষা শুরু/শেষ, নতুন পরীক্ষা ও নতুন ভিডিওর খবর এখানে আসবে।</p>
                    </div>
                  )}
                  {notifs.map((n) => {
                    const isNew = new Date(n.timeISO).getTime() > seenAt;
                    const iconBox =
                      n.type === "new_video"
                        ? "bg-rose-50 text-rose-600"
                        : n.type === "new_exam"
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-amber-50 text-amber-600";
                    return (
                      <div key={n.id} className={`px-4 py-3 flex gap-3 ${isNew ? "bg-indigo-50/40" : ""}`}>
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBox}`}>
                          {n.type === "new_video" ? (
                            <Video className="w-4 h-4" />
                          ) : n.type === "new_exam" ? (
                            <GraduationCap className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{n.body}</p>
                          <p className="text-[11px] text-slate-400">{timeAgo(n.timeISO)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Center: brand name */}
          <Link
            href="/"
            onClick={(e) => {
              if (isTeacher) {
                e.preventDefault();
                router.push("/admin");
              }
            }}
            className="flex items-center gap-2 cursor-pointer group min-w-0"
          >
            <span className="bg-gradient-to-tr from-amber-400 to-indigo-500 p-1.5 rounded-xl shadow-sm group-hover:scale-105 transition-transform duration-200 shrink-0">
              <GraduationCap className="w-5 h-5 text-slate-900" />
            </span>
            <span className="text-lg sm:text-xl font-black tracking-wide text-indigo-900 whitespace-nowrap">
              আরোহণ
            </span>
          </Link>

          {/* Right: menu (side panel) */}
          <div className="flex-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(true);
                setIsNotifOpen(false);
              }}
              aria-label="মেনু খুলুন"
              aria-expanded={isMenuOpen}
              className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 cursor-pointer transition"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Side panel (drawer) — glass, black & white */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* Panel — slides in from the right */}
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-white/75 backdrop-blur-2xl text-slate-800 shadow-2xl shadow-slate-900/20 flex flex-col border-l border-white/60">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-900/5">
              <span className="flex items-center gap-2 font-black text-base text-indigo-900">
                <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 p-1.5 rounded-lg">
                  <GraduationCap className="w-4 h-4" />
                </span>
                আরোহণ
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="মেনু বন্ধ করুন"
                className="p-2 rounded-lg bg-white/70 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 cursor-pointer border border-slate-900/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 font-bengali">
              <button
                type="button"
                onClick={goHome}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition text-sm font-semibold text-left cursor-pointer border border-white/80 hover:border-indigo-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </span>
                হোম
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  router.push("/practice");
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition text-sm font-semibold text-left cursor-pointer border border-white/80 hover:border-indigo-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                সেলফ প্র্যাকটিস
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  router.push("/question-bank");
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition text-sm font-semibold text-left cursor-pointer border border-white/80 hover:border-indigo-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </span>
                প্রশ্নব্যাংক
              </button>

              <button
                type="button"
                onClick={openLeaderboard}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition text-sm font-semibold text-left cursor-pointer border border-white/80 hover:border-indigo-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </span>
                লিডারবোর্ড
              </button>

              <button
                type="button"
                onClick={openStudentPortal}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition text-sm font-semibold text-left cursor-pointer border border-white/80 hover:border-indigo-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Contact className="w-4 h-4" />
                </span>
                Student Portal
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  sessionStorage.setItem("open_enroll", "1");
                  router.push("/");
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition text-sm font-semibold text-left cursor-pointer border border-white/80 hover:border-indigo-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </span>
                কোর্স এনরোল করুন
              </button>
            </nav>

            <div className="px-4 py-3 border-t border-slate-900/5">
              <p className="text-xs text-slate-500 font-medium">
                BCS & Job Preparation Portal
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
