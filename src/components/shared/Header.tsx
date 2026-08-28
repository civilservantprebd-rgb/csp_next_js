"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { GraduationCap, Contact, Trophy } from "lucide-react";

interface HeaderProps {
  onOpenStudentPortal?: () => void;
  onOpenLeaderboard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenStudentPortal, onOpenLeaderboard }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header className={`bg-indigo-900/95 backdrop-blur-md text-white shadow-lg sticky top-0 z-40 border-b border-indigo-800/50 transition-transform duration-300 ${
      isVisible ? "translate-y-0" : "-translate-y-full"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-3">
        <Link href="/" className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start cursor-pointer group">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-amber-400 to-indigo-500 text-slate-900 p-2.5 rounded-2xl font-bold text-xl shadow-md group-hover:scale-105 transition-transform duration-200">
              <GraduationCap className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wide bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">
                BCS One
              </h1>
              <p className="text-[11px] text-indigo-300 font-medium font-bengali">
                স্মার্ট ও ইন্টারেক্টিভ কুইজ পোর্টাল
              </p>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap items-center justify-center sm:gap-3 w-full sm:w-auto font-bengali">
          {onOpenStudentPortal ? (
            <button
              onClick={onOpenStudentPortal}
              className="bg-white/10 hover:bg-white/20 border border-indigo-400/30 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm backdrop-blur-sm"
            >
              <Contact className="w-4 h-4 text-indigo-300" /> স্টুডেন্ট পোর্টাল
            </button>
          ) : (
            <Link
              href="/portal"
              className="bg-white/10 hover:bg-white/20 border border-indigo-400/30 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm backdrop-blur-sm"
            >
              <Contact className="w-4 h-4 text-indigo-300" /> স্টুডেন্ট পোর্টাল
            </Link>
          )}

          {onOpenLeaderboard ? (
            <button
              onClick={onOpenLeaderboard}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-md"
            >
              <Trophy className="w-4 h-4" /> লিডারবোর্ড
            </button>
          ) : (
            <Link
              href="/leaderboard/exam_01"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-md"
            >
              <Trophy className="w-4 h-4" /> লিডারবোর্ড
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
