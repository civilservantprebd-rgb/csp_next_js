"use client";

import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScrollRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal scroll row — first ~3 cards fit in the viewport,
 * the rest are reached by scrolling (buttons or touch/trackpad).
 */
export const ScrollRow: React.FC<ScrollRowProps> = ({ children, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto px-6 py-1 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <button
        type="button"
        aria-label="পেছনে স্ক্রল"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 text-slate-600 hover:text-indigo-600 hover:shadow-lg flex items-center justify-center cursor-pointer z-10"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        aria-label="আগে স্ক্রল"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 text-slate-600 hover:text-indigo-600 hover:shadow-lg flex items-center justify-center cursor-pointer z-10"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};
