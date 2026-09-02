"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Newspaper,
  CalendarDays,
  Loader2,
  ChevronRight,
  ChevronLeft,
  X,
  Calendar as CalendarIcon,
  Layers
} from "lucide-react";
import { getDailyNews, DailyNewsItem } from "@/actions/news-actions";
import { toBengaliDigits } from "@/lib/utils";

/* ---------- বাংলাদেশ (UTC+6) তারিখ হেল্পার ---------- */

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];
const WEEKDAYS = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র"];

function bdParts(iso: string): { y: number; m: number; d: number; key: string } | null {
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return null;
  const bd = new Date(parsed.getTime() + 6 * 60 * 60 * 1000);
  const y = bd.getUTCFullYear();
  const m = bd.getUTCMonth() + 1;
  const d = bd.getUTCDate();
  return { y, m, d, key: `${y}-${m}-${d}` };
}

function todayBD(): { y: number; m: number; d: number } {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

function longLabel(key: string): string {
  const [y, m, d] = key.split("-").map((x) => Number(x));
  return `${toBengaliDigits(d)} ${BN_MONTHS[(m || 1) - 1]} ${toBengaliDigits(y)}`;
}

function shortLabel(key: string): string {
  const [y, m, d] = key.split("-").map((x) => Number(x));
  return `${toBengaliDigits(d)}/${toBengaliDigits(m)}/${toBengaliDigits(y)}`;
}

/* ---------- মিনি ক্যালেন্ডার ---------- */

interface MiniCalendarProps {
  month: number;
  year: number;
  newsKeys: Set<string>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({
  month, year, newsKeys, selectedKey, onSelect, onPrev, onNext
}) => {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (firstDow + 1) % 7; // সপ্তাহ শুরু শনিবার
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = todayBD();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={onPrev}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          aria-label="আগের মাস"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="font-black text-slate-900 text-xs sm:text-sm">
          {BN_MONTHS[month - 1]} {toBengaliDigits(year)}
        </p>
        <button
          type="button"
          onClick={onNext}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          aria-label="পরের মাস"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-[9px] font-black text-slate-400 py-0.5">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <span key={`x_${idx}`} />;
          const key = `${year}-${month}-${day}`;
          const hasNews = newsKeys.has(key);
          const isSelected = selectedKey === key;
          const isToday = today.y === year && today.m === month && today.d === day;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              disabled={!hasNews}
              className={`relative aspect-square rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                isSelected
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                  : hasNews
                  ? "bg-white border border-slate-200 text-slate-800 hover:bg-slate-100"
                  : "bg-transparent text-slate-300 cursor-not-allowed"
              }`}
            >
              {toBengaliDigits(day)}
              {hasNews && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-900" />
              )}
              {isToday && !isSelected && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full border border-slate-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- বিস্তারিত পপআপ ---------- */

const NewsDetailPopup: React.FC<{ item: DailyNewsItem; onClose: () => void }> = ({ item, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const dateKey = bdParts(item.createdAt)?.key || "";

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 font-bengali">
      {/* ব্যাকড্রপ */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

      {/* গ্লাস কার্ড */}
      <div className="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/70 bg-white/90 backdrop-blur-2xl shadow-2xl shadow-slate-900/30 overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-300">
        {/* হেডার */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-slate-900/5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Newspaper className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 tracking-wide truncate">দৈনিক সংবাদ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* কন্টেন্ট — স্ক্রলযোগ্য */}
        <div className="px-4 sm:px-5 py-4 overflow-y-auto">
          {dateKey && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/70 px-2 py-0.5 rounded-full mb-2.5">
              <CalendarDays className="w-3 h-3" /> {longLabel(dateKey)}
            </span>
          )}
          <h3 className="font-black text-slate-900 text-base sm:text-lg leading-snug mb-3">{item.heading}</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">{item.body}</p>
        </div>

        {/* ফুটার */}
        <div className="px-4 sm:px-5 pb-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-slate-900/15"
          >
            পড়েছি
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- মূল সেকশন ---------- */

/**
 * হোম পেজের "দৈনিক সংবাদ":
 * - শুধু সর্বশেষ ৩টি হেডিং (কমপ্যাক্ট বক্স) দেখায়
 * - যেকোনো হেডিংয়ে ট্যাপ করলে পপআপে পুরো নিউজ খোলে
 * - "তারিখ" বাটন → ক্যালেন্ডার, ওই দিনের সব সংবাদ দেখা যায়
 */
export const DailyNewsSection: React.FC = () => {
  const [news, setNews] = useState<DailyNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewKey, setViewKey] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState<{ y: number; m: number }>(() => {
    const t = todayBD();
    return { y: t.y, m: t.m };
  });
  const [reading, setReading] = useState<DailyNewsItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getDailyNews();
        if (cancelled) return;
        setNews(list || []);
      } catch {
        // টেবিল না থাকলে চুপচাপ খালি
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dated = useMemo(
    () =>
      (news || [])
        .map((n) => ({ n, bd: bdParts(n.createdAt) }))
        .filter((x): x is { n: DailyNewsItem; bd: NonNullable<ReturnType<typeof bdParts>> } => !!x.bd),
    [news]
  );

  const newsKeys = useMemo(() => new Set(dated.map((x) => x.bd.key)), [dated]);

  // ডিফল্ট: সর্বশেষ ৩টি; তারিখ বাছাই করলে ওই দিনের সব
  const visible = useMemo(() => {
    if (viewKey) return dated.filter((x) => x.bd.key === viewKey);
    return dated.slice(0, 3);
  }, [dated, viewKey]);

  const selectDay = (key: string) => {
    setViewKey(key);
    setCalOpen(false);
  };

  const resetDay = () => {
    setViewKey(null);
    setCalOpen(false);
  };

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/60 bg-white/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 p-5 sm:p-6 font-bengali">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
          <Loader2 className="w-4 h-4 animate-spin text-slate-700" /> সংবাদ লোড হচ্ছে...
        </div>
      </section>
    );
  }

  if (news.length === 0) return null;

  return (
    <section className="font-bengali rounded-3xl border border-white/60 bg-white/45 backdrop-blur-xl shadow-lg shadow-slate-900/5 p-4 sm:p-5">
      {/* হেডার */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20 shrink-0">
            <Newspaper className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 text-base leading-tight">দৈনিক সংবাদ</h2>
            <p className="text-[11px] text-slate-500 font-semibold truncate">
              {viewKey ? `${longLabel(viewKey)} — ${toBengaliDigits(visible.length)}টি` : "সর্বশেষ আপডেট"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCalOpen((v) => !v);
              const t = todayBD();
              setCalMonth({ y: t.y, m: t.m });
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer shadow-sm ${
              viewKey
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "bg-white/80 border border-white/90 text-slate-700 hover:bg-slate-100"
            }`}
            title="তারিখ ধরে সংবাদ দেখুন"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {viewKey ? shortLabel(viewKey) : "তারিখ"}
          </button>
          {viewKey && (
            <button
              type="button"
              onClick={resetDay}
              className="w-8 h-8 rounded-xl bg-white/80 border border-white/90 text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer shadow-sm"
              title="সব দেখুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ক্যালেন্ডার ড্রপডাউন */}
      {calOpen && (
        <div className="mb-3 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-2xl shadow-xl shadow-slate-900/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" /> তারিখ বাছাই করুন
            </p>
            <button
              type="button"
              onClick={resetDay}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              সব দেখুন
            </button>
          </div>
          <MiniCalendar
            month={calMonth.m}
            year={calMonth.y}
            newsKeys={newsKeys}
            selectedKey={viewKey}
            onSelect={selectDay}
            onPrev={() => {
              setCalMonth(({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }));
            }}
            onNext={() => {
              setCalMonth(({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }));
            }}
          />
          <p className="text-[10px] text-slate-400 font-semibold mt-2 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-900" /> চিহ্নিত দিনগুলোতে সংবাদ আছে
          </p>
        </div>
      )}

      {/* হেডিং তালিকা */}
      {visible.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Layers className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-slate-500">
            {viewKey ? `${longLabel(viewKey)} তারিখে কোনো সংবাদ নেই` : "কোনো সংবাদ নেই"}
          </p>
          {viewKey && (
            <button
              type="button"
              onClick={resetDay}
              className="mt-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-700 px-4 py-2 rounded-xl transition cursor-pointer"
            >
              সব সংবাদ দেখুন
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(({ n, bd }, idx) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setReading(n)}
              className="w-full text-left rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl px-3.5 py-3 shadow-sm hover:bg-white/85 hover:shadow-md transition cursor-pointer flex items-center gap-2.5 group"
            >
              {idx === 0 && !viewKey && (
                <span className="shrink-0 bg-slate-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  সর্বশেষ
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-xs sm:text-sm leading-snug text-slate-800 group-hover:text-slate-900">
                  {n.heading}
                </span>
                <span className="block text-[11px] text-slate-400 font-bold mt-0.5">
                  {shortLabel(bd.key)}
                </span>
              </span>
              <span className="shrink-0 w-7 h-7 rounded-full bg-slate-100 group-hover:bg-slate-900 text-slate-500 group-hover:text-white flex items-center justify-center transition">
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* বিস্তারিত পপআপ */}
      {reading && <NewsDetailPopup item={reading} onClose={() => setReading(null)} />}
    </section>
  );
};
