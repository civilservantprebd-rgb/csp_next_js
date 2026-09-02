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
  month: number; // 1-12
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
  // সপ্তাহ শুরু শনিবার থেকে
  const offset = (firstDow + 1) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = todayBD();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  return (
    <div className="select-none">
      {/* মাস নেভিগেশন */}
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

      {/* সপ্তাহের নাম */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-[9px] font-black text-slate-400 py-0.5">
            {w}
          </span>
        ))}
      </div>

      {/* দিনের গ্রিড */}
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
 * হোম পেজের "দৈনিক সংবাদ" — মিনিমালিস্ট গ্লাস-প্যানেল:
 * - উপরে স্টিকি কমপ্যাক্ট বার (শিরোনাম + ক্যালেন্ডার) — নিচে স্ক্রল করলে
 *   কনটেন্ট বারটার নিচে ভাঁজ হয়ে (fold) যায়
 * - প্রথম সংবাদ (সর্বশেষ) বড় করে খোলা, বাকিগুলো অ্যাকর্ডিয়ন (ট্যাপ = ভাঁজ খোলা)
 * - ক্যালেন্ডার আইকনে ট্যাপ → যেকোনো দিন বাছাই, ওই দিনের সব সংবাদ পড়া যায়
 */
export const DailyNewsSection: React.FC = () => {
  const [news, setNews] = useState<DailyNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string>("");
  const [viewKey, setViewKey] = useState<string | null>(null); // null = সব
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState<{ y: number; m: number }>(() => {
    const t = todayBD();
    return { y: t.y, m: t.m };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getDailyNews();
        if (cancelled) return;
        setNews(list || []);
        if (list && list.length > 0) setExpandedId(list[0].id);
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

  // প্রতিটি সংবাদের BD-তারিখ
  const dated = useMemo(
    () =>
      (news || [])
        .map((n) => ({ n, bd: bdParts(n.createdAt) }))
        .filter((x): x is { n: DailyNewsItem; bd: NonNullable<ReturnType<typeof bdParts>> } => !!x.bd),
    [news]
  );

  const newsKeys = useMemo(() => new Set(dated.map((x) => x.bd.key)), [dated]);

  const visible = useMemo(() => {
    if (!viewKey) return dated;
    return dated.filter((x) => x.bd.key === viewKey);
  }, [dated, viewKey]);

  // খোলা আইটেমটা visible-এর মধ্যে না থাকলে প্রথমটা খুলে দিই
  const openItem = visible.find((x) => x.n.id === expandedId) || visible[0];

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
    <section className="font-bengali rounded-3xl border border-white/60 bg-white/45 backdrop-blur-xl shadow-lg shadow-slate-900/5 overflow-hidden">
      {/* ===== স্ক্রল প্যানেল: বার + কার্ডগুলো ===== */}
      <div className="max-h-[560px] overflow-y-auto overscroll-contain">
        {/* স্টিকি কমপ্যাক্ট বার — স্ক্রল করলে কার্ডগুলো এর নিচে ভাঁজ হয়ে যায় */}
        <div className="sticky top-0 z-20 px-4 sm:px-5 pt-4 pb-2.5 bg-white/70 backdrop-blur-2xl border-b border-white/70 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20 shrink-0">
                <Newspaper className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-slate-900 text-base leading-tight">দৈনিক সংবাদ</h2>
                <p className="text-[11px] text-slate-500 font-semibold truncate">
                  {viewKey ? `${longLabel(viewKey)} — মোট ${toBengaliDigits(visible.length)}টি` : "প্রতিদিনের গুরুত্বপূর্ণ আপডেট"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="hidden sm:inline text-[10px] font-bold text-slate-500 bg-white/80 border border-white/90 px-2 py-1 rounded-full shadow-sm">
                {toBengaliDigits(news.length)}টি সংবাদ
              </span>
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
                  title="সব সংবাদ দেখুন"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ক্যালেন্ডার ড্রপডাউন */}
          {calOpen && (
            <div className="mt-3 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-2xl shadow-xl shadow-slate-900/10 p-3">
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
        </div>

        {/* ===== সংবাদের কার্ডসমূহ ===== */}
        {visible.length === 0 ? (
          <div className="px-4 sm:px-5 py-10 text-center">
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
          <div className="p-3 sm:p-4 space-y-2">
            {visible.map(({ n, bd }, idx) => {
              const isOpen = openItem?.n.id === n.id;
              const isFirst = idx === 0;
              return (
                <div
                  key={n.id}
                  className={`rounded-2xl border transition-all duration-300 shadow-sm overflow-hidden ${
                    isOpen
                      ? "border-slate-300 bg-white/90 backdrop-blur-xl shadow-md"
                      : "border-white/70 bg-white/55 backdrop-blur-xl hover:bg-white/75 hover:shadow-md"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? "" : n.id)}
                    className="w-full text-left px-3.5 py-3 cursor-pointer flex items-start gap-2.5"
                  >
                    {isFirst && !viewKey && (
                      <span className="mt-0.5 shrink-0 bg-slate-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        সর্বশেষ
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block font-bold text-xs sm:text-sm leading-snug ${
                          isOpen ? "text-slate-900" : "text-slate-700"
                        }`}
                      >
                        {n.heading}
                      </span>
                      <span className="block text-[11px] text-slate-400 font-bold mt-0.5">
                        {shortLabel(bd.key)}
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 mt-0.5 transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-slate-900" : "text-slate-400"
                      }`}
                    />
                  </button>

                  {/* ভাঁজ-খোলা বডি (মসৃণ অ্যাকর্ডিয়ন) */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3.5 pb-3.5">
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-900/5 pt-2.5">
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
      </div>
    </section>
  );
};
