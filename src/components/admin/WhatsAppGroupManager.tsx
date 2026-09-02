"use client";

import React, { useState, useEffect } from "react";
import { MessageCircle, Save, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { getAllWhatsAppLinks, saveWhatsAppLink } from "@/actions/whatsapp-actions";

/**
 * শিক্ষক প্যানেলের "WhatsApp গ্রুপ" ম্যানেজার:
 * প্রতিটি কোর্সের জন্য WhatsApp গ্রুপ জয়েন লিংক সেট/বদল/মুছুন।
 * স্টুডেন্টরা লগইনের পর একবার সেই লিংকসহ জয়েন প্রম্পট পায়।
 */
export const WhatsAppGroupManager: React.FC<{ courses: string[] }> = ({ courses }) => {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const list = await getAllWhatsAppLinks();
    const map: Record<string, string> = {};
    (list || []).forEach((r) => {
      map[r.course] = r.link;
    });
    setLinks(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (course: string, value?: string) => {
    setSavingCourse(course);
    setErrorMsg("");
    const val = value !== undefined ? value : (links[course] || "").trim();
    const res = await saveWhatsAppLink(course, val);
    setSavingCourse(null);
    if (res.success) {
      setNotice(res.message);
      setTimeout(() => setNotice(""), 3000);
      load();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="space-y-5 font-bengali">
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-100 space-y-2">
        <h3 className="font-bold text-emerald-900 text-xs sm:text-sm flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4" /> WhatsApp গ্রুপ জয়েন লিংক
        </h3>
        <p className="text-[11px] text-emerald-700 font-semibold leading-relaxed">
          প্রতিটি কোর্সে আলাদা WhatsApp গ্রুপের জয়েন লিংক দিন। স্টুডেন্টরা লগইন করার পর
          একবার সেই কোর্সের গ্রুপে জয়েন হওয়ার প্রম্পট পাবে। লিংক খালি রাখলে গ্রুপ প্রম্পট
          দেখানো হবে না।
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-8 text-slate-400 text-xs font-bold">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> লোড হচ্ছে...
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const isSaving = savingCourse === course;
            return (
              <div
                key={course}
                className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2"
              >
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{course}</span>
                  {links[course] && (
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-auto shrink-0">
                      লিংক সেট আছে
                    </span>
                  )}
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    placeholder="https://chat.whatsapp.com/..."
                    value={links[course] || ""}
                    onChange={(e) => setLinks((prev) => ({ ...prev, [course]: e.target.value }))}
                    className="w-full flex-grow px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSave(course)}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      সেভ
                    </button>
                    {links[course] && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSave(course, "")}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 font-semibold text-xs px-2.5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                        title="লিংক মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
