"use client";

import React, { useEffect, useState } from "react";
import { Newspaper, X, ChevronDown } from "lucide-react";
import { getDailyNews, DailyNewsItem } from "@/actions/news-actions";
import { formatBangladeshDate } from "@/lib/utils";

const SEEN_KEY = "bcs_news_seen_ids";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const seen = getSeenIds();
    seen.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
  } catch {
    // ignore
  }
}

/**
 * হোম পেজে নতুন সংবাদ এলে (বা অন্য পেজ থেকে হোমে ফিরে এলে) একবার
 * নোটিফিকেশন-স্টাইল পপআপে পুরো সংবাদটা দেখায়। দেখার পর localStorage-এ
 * চিহ্নিত হয়ে যায় — ফলে প্রতিটি সংবাদ কেবল একবারই পপআপ হয়।
 */
interface NewNewsPopupProps {
  /** সার্ভার-সাইড (হোম পেজ রেন্ডার) থেকে আনা সংবাদ — থাকলে নেটওয়ার্ক কল ছাড়াই যাচাই করে */
  initialNews?: DailyNewsItem[];
}

export const NewNewsPopup: React.FC<NewNewsPopupProps> = ({ initialNews }) => {
  const [news, setNews] = useState<DailyNewsItem | null>(null);

  useEffect(() => {
    // সার্ভার-রেন্ডার করা সংবাদ পেলে সরাসরি সেটা দিয়েই যাচাই — কোনো অতিরিক্ত ফেচ নয়
    if (initialNews !== undefined) {
      const firstUnseen = initialNews.find((n) => !getSeenIds().has(n.id));
      if (firstUnseen) setNews(firstUnseen);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await getDailyNews();
        if (cancelled || !list || list.length === 0) return;
        const seen = getSeenIds();
        // সবচেয়ে নতুন যে সংবাদটি এখনো দেখা হয়নি
        const firstUnseen = list.find((n) => !seen.has(n.id));
        if (!firstUnseen) return;
        // পপআপ একবার দেখানো হয়েছে বলে চিহ্নিত — কিন্তু পপআপটা এখনই দেখাই
        setNews(firstUnseen);
      } catch {
        // টেবিল না থাকলে কিছু হবে না
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialNews]);

  if (!news) return null;

  const dismiss = () => {
    markSeen(news.id);
    setNews(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md z-[80] font-bengali animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-3xl border border-white/70 bg-white/80 backdrop-blur-2xl shadow-2xl shadow-slate-900/25 overflow-hidden">
        {/* হেডার — সাদা/কালো মিনিমাল */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-900/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20">
              <Newspaper className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 tracking-wide">নতুন সংবাদ এসেছে</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="বন্ধ করুন"
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* কন্টেন্ট */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-slate-900 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
              দৈনিক সংবাদ
            </span>
            {news.createdAt && (
              <span className="text-[10px] text-slate-500 font-bold">{formatBangladeshDate(news.createdAt)}</span>
            )}
          </div>
          <h3 className="font-black text-slate-900 text-sm sm:text-base leading-snug mb-1.5">{news.heading}</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line line-clamp-4">{news.body}</p>
        </div>

        {/* অ্যাকশন */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={dismiss}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-slate-900/15"
          >
            পড়েছি <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
