"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Newspaper,
  CalendarDays,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
  Layers
} from "lucide-react";
import { getDailyNews, incrementNewsRead, DailyNewsItem } from "@/actions/news-actions";
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

/* ---------- মূল সেকশন ---------- */

/**
 * হোম পেজের "দৈনিক সংবাদ":
 * - সবগুলোই ছোট হেডিং (সর্বশেষটা উপরে, ছোট "সর্বশেষ" ব্যাজসহ)
 * - যেকোনো একটায় ট্যাপ করলে সেটা বড় হয়ে পুরো লেখা খোলে (অ্যাকর্ডিয়ন)
 * - "তারিখ" বাটন → ক্যালেন্ডার, ওই দিনের সব সংবাদ দেখা যায়
 */
interface DailyNewsSectionProps {
  /** সার্ভার-সাইড (হোম পেজ রেন্ডার) থেকে আনা সংবাদ — থাকলে কোনো স্পিনার ছাড়াই সাথে সাথে দেখায় */
  initialNews?: DailyNewsItem[];
}

export const DailyNewsSection: React.FC<DailyNewsSectionProps> = ({ initialNews }) => {
  const [news, setNews] = useState<DailyNewsItem[]>(initialNews || []);
  const [loading, setLoading] = useState(initialNews === undefined);
  const [expandedId, setExpandedId] = useState<string>("");
  const [viewKey, setViewKey] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState<{ y: number; m: number }>(() => {
    const t = todayBD();
    return { y: t.y, m: t.m };
  });

  useEffect(() => {
    // সার্ভার-রেন্ডার করা সংবাদ (খালি হোক বা না হোক) পেলে ক্লায়েন্ট-সাইড ফেচের
    // দরকার নেই — প্রথম পেইন্টেই সংবাদ হাজির থাকে (কোনো লোডিং স্পিনার নেই)।
    if (initialNews !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getDailyNews();
        if (cancelled) return;
        setNews(list || []);
        // সব হেডিং ছোট থাকে — ট্যাপ করলেই একটা খোলে
      } catch {
        // টেবিল না থাকলে চুপচাপ খালি
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialNews]);

  const dated = useMemo(
    () =>
      (news || [])
        .map((n) => ({ n, bd: bdParts(n.createdAt) }))
        .filter((x): x is { n: DailyNewsItem; bd: NonNullable<ReturnType<typeof bdParts>> } => !!x.bd),
    [news]
  );

  const newsKeys = useMemo(() => new Set(dated.map((x) => x.bd.key)), [dated]);

  // ডিফল্ট: সবগুলো; তারিখ বাছাই করলে ওই দিনের সব
  const visible = useMemo(() => {
    if (viewKey) return dated.filter((x) => x.bd.key === viewKey);
    return dated;
  }, [dated, viewKey]);

  const selectDay = (key: string) => {
    setViewKey(key);
    setCalOpen(false);
    const first = dated.find((x) => x.bd.key === key);
    if (first) setExpandedId(first.n.id);
  };

  const resetDay = () => {
    setViewKey(null);
    setCalOpen(false);
    if (dated.length > 0) setExpandedId(dated[0].n.id);
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
            <h2 className="font-black text-black text-base leading-tight">দৈনিক সংবাদ</h2>
            <p className="text-[11px] text-slate-600 font-semibold truncate">
              {viewKey ? `${longLabel(viewKey)} — ${toBengaliDigits(visible.length)}টি` : `মোট ${toBengaliDigits(dated.length)}টি সংবাদ`}
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

      {/* সংবাদের তালিকা — একসাথে ৩টা হেডিং দৃশ্যমান, বাকিগুলো স্ক্রল */}
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
        <div className="max-h-[13.5rem] overflow-y-auto overscroll-contain pr-1 space-y-2 [scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_transparent]">
          {visible.map(({ n, bd }, idx) => {
            const isOpen = expandedId === n.id;
            return (
              <div
                key={n.id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${
                  isOpen
                    ? "border-slate-300 bg-white/90 backdrop-blur-xl shadow-md"
                    : "border-white/70 bg-white/60 backdrop-blur-xl hover:bg-white/80"
                }`}
              >
                {/* হেডিং বার */}
                <button
                  type="button"
                  onClick={() => {
                    // বন্ধ → খোলা: পড়ার কাউন্ট বাড়াই (admin প্যানেলে দেখা যায়)
                    if (!isOpen) incrementNewsRead(n.id);
                    setExpandedId(isOpen ? "" : n.id);
                  }}
                  className="w-full text-left px-3.5 py-3 cursor-pointer flex items-center gap-2.5"
                >
                  {idx === 0 && !viewKey && (
                    <span className="shrink-0 bg-slate-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      সর্বশেষ
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-xs sm:text-sm leading-snug text-black">
                      {n.heading}
                    </span>
                    <span className="block text-[11px] text-slate-600 font-bold mt-0.5">
                      {shortLabel(bd.key)}
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-black" : "text-slate-500"
                    }`}
                  />
                </button>

                {/* খোলা বডি */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-3.5 pb-4">
                      <p className="text-xs sm:text-sm text-black leading-relaxed whitespace-pre-line border-t border-slate-900/5 pt-3">
                        {n.body}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
