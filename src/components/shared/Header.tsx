"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Contact, Trophy, Menu, X, Bell } from "lucide-react";

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

  const toggleBell = () => {
    setIsNotifOpen((v) => !v);
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
              className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 cursor-pointer transition"
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* Notification dropdown */}
            {isNotifOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 max-w-[85vw] bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 font-bengali">
                <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-800 font-bold text-sm border-b border-indigo-100">
                  <Bell className="w-4 h-4" /> নোটিফিকেশন
                </div>
                <div className="px-4 py-6 text-center space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700">কোনো নতুন নোটিফিকেশন নেই</p>
                  <p className="text-xs text-slate-400">নতুন পরীক্ষা বা ফলাফল প্রকাশের খবর এখানে দেখাবে।</p>
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

      {/* Side panel (drawer) — light theme, matches site modals */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* Panel — slides in from the right */}
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-white text-slate-800 shadow-2xl flex flex-col border-l border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="flex items-center gap-2 font-black text-base text-indigo-900">
                <span className="bg-gradient-to-tr from-amber-400 to-indigo-500 p-1.5 rounded-lg">
                  <GraduationCap className="w-4 h-4 text-slate-900" />
                </span>
                আরোহণ
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="মেনু বন্ধ করুন"
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 font-bengali">
              <button
                type="button"
                onClick={goHome}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 transition text-sm font-semibold text-left cursor-pointer border border-transparent hover:border-indigo-100"
              >
                <GraduationCap className="w-5 h-5 text-indigo-500" /> হোম
              </button>

              <button
                type="button"
                onClick={openLeaderboard}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-900 transition text-sm font-semibold text-left cursor-pointer border border-transparent hover:border-amber-200"
              >
                <Trophy className="w-5 h-5 text-amber-500" /> লিডারবোর্ড
              </button>

              <button
                type="button"
                onClick={openStudentPortal}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition text-sm font-semibold text-left cursor-pointer border border-transparent hover:border-emerald-200"
              >
                <Contact className="w-5 h-5 text-emerald-500" /> Student Portal
              </button>
            </nav>

            <div className="px-4 py-3 border-t border-slate-200">
              <p className="text-xs text-slate-400 font-medium">
                BCS & Job Preparation Portal
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
