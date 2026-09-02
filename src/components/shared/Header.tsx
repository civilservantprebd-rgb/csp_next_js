"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Contact, Trophy, Menu, X, Home } from "lucide-react";

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

  // Close the mobile drawer with the Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  const handleStudentPortalClick = (e: React.MouseEvent) => {
    if (isTeacher) {
      e.preventDefault();
      alert("⚠️ আপনি শিক্ষক প্যানেলে লগইন করে আছেন। স্টুডেন্ট পোর্টাল ব্যবহার করতে চাইলে প্রথমে শিক্ষক প্যানেল থেকে লগআউট করুন।");
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

  const openStudentPortal = (e: React.MouseEvent) => {
    handleStudentPortalClick(e);
    if (isTeacher) return;
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

  return (
    <>
      <header className={`bg-indigo-900/95 backdrop-blur-md text-white shadow-lg sticky top-0 z-40 border-b border-indigo-800/50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2">
          {/* Logo (left) */}
          <Link
            href="/"
            onClick={(e) => {
              if (isTeacher) {
                e.preventDefault();
                router.push("/admin");
              }
            }}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer group"
          >
            <div className="bg-gradient-to-tr from-amber-400 to-indigo-500 text-slate-900 p-2 rounded-xl font-bold shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0">
              <GraduationCap className="w-5 h-5 text-slate-900" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-wide bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent leading-tight">
                আরোহণ
              </h1>
              <p className="text-xs text-indigo-300 font-medium font-bengali truncate">
                স্মার্ট ও ইন্টারেক্টিভ প্রিপারেশন পোর্টাল
              </p>
            </div>
          </Link>

          {/* Desktop buttons (right) */}
          <div className="hidden sm:flex items-center gap-2 font-bengali">
            {onOpenStudentPortal ? (
              <button
                onClick={(e) => {
                  handleStudentPortalClick(e);
                  if (!isTeacher) onOpenStudentPortal();
                }}
                className="bg-white/10 hover:bg-white/20 border border-indigo-400/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm backdrop-blur-sm"
              >
                <Contact className="w-4 h-4 text-indigo-300" /> Student Portal
              </button>
            ) : (
              <Link
                href="/portal"
                onClick={handleStudentPortalClick}
                className="bg-white/10 hover:bg-white/20 border border-indigo-400/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm backdrop-blur-sm"
              >
                <Contact className="w-4 h-4 text-indigo-300" /> Student Portal
              </Link>
            )}

            {onOpenLeaderboard ? (
              <button
                onClick={onOpenLeaderboard}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
              >
                <Trophy className="w-4 h-4" /> লিডারবোর্ড
              </button>
            ) : (
              <Link
                href="/leaderboard/exam_01"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
              >
                <Trophy className="w-4 h-4" /> লিডারবোর্ড
              </Link>
            )}
          </div>

          {/* Mobile hamburger (right) */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="মেনু খুলুন"
            aria-expanded={isMenuOpen}
            className="sm:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-indigo-400/30 text-white cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile side panel (drawer) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* Panel — slides in from the right */}
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-gradient-to-b from-indigo-950 to-indigo-900 text-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-800/70">
              <span className="flex items-center gap-2 font-black text-base">
                <span className="bg-gradient-to-tr from-amber-400 to-indigo-500 p-1.5 rounded-lg">
                  <GraduationCap className="w-4 h-4 text-slate-900" />
                </span>
                আরোহণ
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="মেনু বন্ধ করুন"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 font-bengali">
              <button
                type="button"
                onClick={goHome}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm font-semibold text-left cursor-pointer"
              >
                <Home className="w-5 h-5 text-indigo-300" /> হোম
              </button>

              <button
                type="button"
                onClick={openLeaderboard}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm font-semibold text-left cursor-pointer"
              >
                <Trophy className="w-5 h-5 text-amber-400" /> লিডারবোর্ড
              </button>

              <button
                type="button"
                onClick={openStudentPortal}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm font-semibold text-left cursor-pointer"
              >
                <Contact className="w-5 h-5 text-emerald-300" /> Student Portal
              </button>
            </nav>

            <div className="px-4 py-3 border-t border-indigo-800/70">
              <p className="text-xs text-indigo-300 font-medium">
                BCS & Job Preparation Portal
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
