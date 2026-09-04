"use client";

import React, { useState, useEffect } from "react";
import { Newspaper as PenIcon, Download, FileText, Loader2, BookOpenText } from "lucide-react";
import { getEditorialDigests, EditorialDigest } from "@/actions/newspaper-actions";
import { toBengaliDigits } from "@/lib/utils";

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

function dateLabel(dateStr: string): string {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${toBengaliDigits(d)} ${BN_MONTHS[m - 1]} ${toBengaliDigits(y)}`;
}

/**
 * "দৈনিক সম্পাদকীয়" — সাইড-সেকশন:
 * রাত ৩টায় DeepSeek আপলোড করা পত্রিকা থেকে BCS-উপযোগী সম্পাদকীয়/মতামত/বিশ্লেষণ
 * বের করে প্রতিদিনের একটি পূর্ণাঙ্গ PDF বানায় — এই কার্ড থেকে তা ডাউনলোড/পড়া যায়।
 * (কোনো ডেটা না থাকলে কিছুই দেখায় না — লেআউট ভাঙে না।)
 */
export const EditorialDigestSection: React.FC<{ className?: string }> = ({ className }) => {
  const [digests, setDigests] = useState<EditorialDigest[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getEditorialDigests(20);
        if (!cancelled) setDigests(list || []);
      } catch {
        if (!cancelled) setDigests([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // লোডিং/ফাঁকা অবস্থায় কিছুই দেখায় না — লেআউট যেন কখনো ভাঙে না (সাইড কলাম তখন অদৃশ্য)
  if (digests === null || digests.length === 0) return null;

  return (
    <section className={`font-bengali rounded-3xl border border-white/60 bg-white/45 backdrop-blur-xl shadow-lg shadow-slate-900/5 p-4 sm:p-5 ${className || ""}`}>
      {/* হেডার */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-900/20 shrink-0">
          <PenIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-black text-black text-base leading-tight">দৈনিক সম্পাদকীয়</h2>
          <p className="text-[11px] text-slate-600 font-semibold truncate">
            BCS-উপযোগী সম্পাদকীয়, মতামত ও বিশ্লেষণ
          </p>
        </div>
      </div>

      {/* তালিকা */}
      <div className="space-y-2">
        {digests.map((dg) => {
          const href = dg.pdfUrl || dg.htmlUrl;
          if (!href) return null;
          return (
            <div key={dg.date} className="rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl hover:bg-white/80 transition p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-xs sm:text-sm text-black leading-snug">{dateLabel(dg.date)}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    {toBengaliDigits(dg.itemCount)}টি লেখা
                    {dg.papers.length > 0 && ` • ${dg.papers.slice(0, 2).join(", ")}${dg.papers.length > 2 ? "…" : ""}`}
                  </p>
                </div>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={dg.pdfUrl ? "সম্পাদকীয় PDF ডাউনলোড" : "সম্পাদকীয় HTML পড়ুন"}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-black transition cursor-pointer border ${
                    dg.pdfUrl
                      ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm"
                      : "bg-slate-900 text-white border-slate-900 hover:bg-slate-700"
                  }`}
                >
                  {dg.pdfUrl ? <Download className="w-3 h-3" /> : <BookOpenText className="w-3 h-3" />}
                  {dg.pdfUrl ? "PDF" : "পড়ুন"}
                </a>
              </div>
              {dg.htmlUrl && dg.pdfUrl && (
                <a
                  href={dg.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  <FileText className="w-3 h-3" /> ব্রাউজারে পড়ুন
                </a>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-slate-400 font-semibold mt-3 leading-relaxed">
        প্রতিদিন রাত ০৩:০০-তে DeepSeek আপলোড করা পত্রিকা থেকে বেছে নেয় — সম্পূর্ণ লেখাসহ PDF।
      </p>
    </section>
  );
};
