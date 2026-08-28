"use client";

import React, { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import {
  toggleQuestionBookmark,
  isQuestionBookmarked
} from "@/lib/mistake-bookmark-store";

interface BookmarkButtonProps {
  studentId?: string;
  question: {
    q: string;
    opts: string[];
    correct: number;
    exp: string;
    userAns?: number | null;
    examTitle?: string;
    topic?: string;
    subject?: string;
  };
  size?: "sm" | "md";
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  studentId,
  question,
  size = "md",
}) => {
  const [effectiveStudentId, setEffectiveStudentId] = useState(studentId || "");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (studentId) {
      setEffectiveStudentId(studentId);
      setIsSaved(isQuestionBookmarked(studentId, question.q));
      return;
    }

    try {
      const stored = sessionStorage.getItem("current_student");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) {
          setEffectiveStudentId(parsed.id);
          setIsSaved(isQuestionBookmarked(parsed.id, question.q));
        }
      }
    } catch (_) {}
  }, [studentId, question.q]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const activeId = effectiveStudentId || "guest_student";
    const newState = toggleQuestionBookmark(activeId, question);
    setIsSaved(newState);
  };

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={isSaved ? "বুকমার্ক থেকে মুছুন" : "ভবিষ্যত রিভিশনের জন্য বুকমার্ক করুন"}
      className={`rounded-xl transition-all duration-200 flex items-center gap-1 cursor-pointer select-none active:scale-95 ${
        isSmall ? "p-1.5 text-xs" : "px-2.5 py-1.5 text-xs"
      } ${
        isSaved
          ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-2xs"
          : "bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 border border-slate-200"
      }`}
    >
      <Bookmark
        className={`${isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} ${
          isSaved ? "fill-amber-500 text-amber-600" : "text-slate-500"
        }`}
      />
      <span className="hidden sm:inline text-[11px]">
        {isSaved ? "বুকমার্ক সংরক্ষিত" : "বুকমার্ক"}
      </span>
    </button>
  );
};
