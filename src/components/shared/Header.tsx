"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Contact, Trophy } from "lucide-react";

interface HeaderProps {
  onOpenStudentPortal?: () => void;
  onOpenLeaderboard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenStudentPortal, onOpenLeaderboard }) => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const [isTeacher, setIsTeacher] = useState(false);

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

  const handleStudentPortalClick = (e: React.MouseEvent) => {
    if (isTeacher) {
      e.preventDefault();
      alert("⚠️ আপনি শিক্ষক প্যানেলে লগইন করে আছেন। স্টুডেন্ট পোর্টাল ব্যবহার করতে চাইলে প্রথমে শিক্ষক প্যানেল থেকে লগআউট করুন।");
    }
  };

  return (
    <header className={`bg-indigo-900/95 backdrop-blur-md text-white shadow-lg sticky top-0 z-40 border-b border-indigo-800/50 transition-transform duration-300 ${
      isVisible ? "translate-y-0" : "-translate-y-full"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
        <Link
          href="/"
          onClick={(e) => {
            if (isTeacher) {
              e.preventDefault();
              router.push("/admin");
            }
          }}
          className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start cursor-pointer group"
        >
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-amber-400 to-indigo-500 text-slate-900 p-2 rounded-xl font-bold shadow-md group-hover:scale-105 transition-transform duration-200">
              <GraduationCap className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wide bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">
                আরোহণ
              </h1>
              <p className="text-xs text-indigo-300 font-medium font-bengali">
                স্মার্ট ও ইন্টারেক্টিভ প্রিপারেশন পোর্টাল
              </p>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap items-center justify-center sm:gap-3 w-full sm:w-auto font-bengali">
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
      </div>
    </header>
  );
};
