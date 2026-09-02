"use client";

import React, { useEffect, useState } from "react";
import { MessageCircle, X, ExternalLink, Users } from "lucide-react";
import { getWhatsAppLinksForStudent, CourseWhatsAppLink } from "@/actions/whatsapp-actions";
import { getLocalStudentUser } from "@/lib/student-auth";

const SEEN_KEY = "bcs_whatsapp_seen_courses";

function getSeenCourses(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function markSeen(courses: string[]) {
  try {
    const seen = getSeenCourses();
    courses.forEach((c) => seen.add(c));
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
  } catch {
    // ignore
  }
}

/**
 * লগইন করার পর (হোম পেজে থাকলে / অন্য পেজ থেকে হোমে বা পোর্টালে ফিরে এলে)
 * স্টুডেন্টের এনরোল্ড কোর্সের WhatsApp গ্রুপে জয়েন হতে বলে — প্রতিটি কোর্স
 * কেবল একবারই (localStorage-এ চিহ্নিত)। শিক্ষক/লগইন-বিহীন দর্শক দেখে না।
 * মিনিমালিস্ট গ্লাস-কার্ড স্টাইল (সাদা/কালো + শ্যাডো)।
 */
export const WhatsAppJoinPopup: React.FC = () => {
  const [groups, setGroups] = useState<CourseWhatsAppLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const localUser = getLocalStudentUser();
      if (!localUser) return;
      try {
        const list = await getWhatsAppLinksForStudent(localUser.uid, localUser.email);
        if (cancelled) return;
        const seen = getSeenCourses();
        const unseen = (list || []).filter((g) => !seen.has(g.course));
        if (unseen.length === 0) return;
        setGroups(unseen);
      } catch {
        // টেবিল/নেটওয়ার্ক সমস্যায় কিছু দেখানো হয় না
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (groups.length === 0) return null;

  const dismiss = () => {
    markSeen(groups.map((g) => g.course));
    setGroups([]);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md z-[85] font-bengali animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-3xl border border-white/70 bg-white/80 backdrop-blur-2xl shadow-2xl shadow-slate-900/25 overflow-hidden">
        {/* হেডার — সাদা/কালো মিনিমাল */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-900/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 tracking-wide">WhatsApp গ্রুপে জয়েন করুন</span>
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
        <div className="p-4 space-y-3">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            আপনার এনরোল্ড কোর্সের নিয়মিত আপডেট, নোটিশ ও আলোচনার জন্য WhatsApp গ্রুপে জয়েন করুন:
          </p>

          {groups.map((g) => (
            <div
              key={g.course}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-900/10 bg-white/70 backdrop-blur-xl px-3.5 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">কোর্স</p>
                <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{g.course}</p>
              </div>
              <a
                href={g.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shrink-0 shadow-md shadow-slate-900/15"
              >
                <ExternalLink className="w-3.5 h-3.5" /> জয়েন করুন
              </a>
            </div>
          ))}

          <button
            type="button"
            onClick={dismiss}
            className="w-full inline-flex items-center justify-center gap-1.5 border border-slate-900/10 bg-white/60 hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-bold py-2 rounded-xl transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" /> পরে জয়েন করব
          </button>
        </div>
      </div>
    </div>
  );
};
