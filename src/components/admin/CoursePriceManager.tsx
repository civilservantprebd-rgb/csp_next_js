"use client";

import React, { useState, useEffect } from "react";
import { Tag, Save, Loader2 } from "lucide-react";
import { getCoursePrices, saveCoursePrice } from "@/actions/course-actions";
import { toBengaliDigits } from "@/lib/utils";

interface CoursePriceManagerProps {
  courses: string[];
}

export const CoursePriceManager: React.FC<CoursePriceManagerProps> = ({ courses }) => {
  const [drafts, setDrafts] = useState<Record<string, { price: string; offer: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    getCoursePrices().then((prices) => {
      const init: Record<string, { price: string; offer: string }> = {};
      (courses || []).forEach((c) => {
        init[c] = {
          price: prices[c]?.price !== undefined ? String(prices[c].price) : "",
          offer: prices[c]?.offerPrice !== undefined ? String(prices[c].offerPrice) : ""
        };
      });
      setDrafts(init);
    });
  }, [courses]);

  const setField = (course: string, key: "price" | "offer", val: string) => {
    setDrafts((prev) => ({ ...prev, [course]: { ...(prev[course] || { price: "", offer: "" }), [key]: val } }));
  };

  const handleSave = async (course: string) => {
    const d = drafts[course] || { price: "", offer: "" };
    setSaving((prev) => ({ ...prev, [course]: true }));
    setMsg(null);
    const res = await saveCoursePrice(
      course,
      d.price === "" ? null : Number(d.price),
      d.offer === "" ? null : Number(d.offer)
    );
    setSaving((prev) => ({ ...prev, [course]: false }));
    setMsg({ type: res.success ? "ok" : "err", text: res.message });
  };

  const numInput =
    "w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-indigo-600" />
        <h3 className="font-bold text-slate-900 text-sm sm:text-base">কোর্সের দাম ও ছাড় সেট করুন</h3>
      </div>

      {msg && (
        <p
          className={`text-xs font-bold p-2.5 rounded-xl ${
            msg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="space-y-2">
        {(courses || []).map((course) => (
          <div
            key={course}
            className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
          >
            <p className="text-sm font-black text-slate-800 truncate">{course}</p>
            <div className="grid grid-cols-2 gap-2 items-end">
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">মূল্য (৳)</span>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="যেমন: 2000"
                  value={drafts[course]?.price ?? ""}
                  onChange={(e) => setField(course, "price", e.target.value)}
                  className={numInput}
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">ছাড়ের পর মূল্য (৳)</span>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="যেমন: 1500"
                  value={drafts[course]?.offer ?? ""}
                  onChange={(e) => setField(course, "offer", e.target.value)}
                  className={numInput}
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving[course]}
                onClick={() => handleSave(course)}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition"
              >
                {saving[course] ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> সংরক্ষণ হচ্ছে...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> দাম সংরক্ষণ করুন
                  </>
                )}
              </button>
            </div>
            {drafts[course]?.offer && drafts[course]?.price && Number(drafts[course].offer) < Number(drafts[course].price) && (
              <p className="text-[11px] text-emerald-700 font-bold">
                ছাড়: {toBengaliDigits(Math.round((1 - Number(drafts[course].offer) / Number(drafts[course].price)) * 100))}% — হোম পেজে দেখাবে
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
