"use client";

import React, { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { submitEnrollRequest } from "@/actions/enroll-actions";

interface EnrollModalProps {
  isOpen: boolean;
  courses: string[];
  initialCourse?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const EnrollModal: React.FC<EnrollModalProps> = ({
  isOpen,
  courses,
  initialCourse,
  onClose,
  onSuccess,
}) => {
  const [course, setCourse] = useState(initialCourse || courses[0] || "সাধারণ কোর্স");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [trxId, setTrxId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (initialCourse && courses.includes(initialCourse)) {
      setCourse(initialCourse);
    } else if (courses.length > 0 && !courses.includes(course)) {
      setCourse(courses[0]);
    }
  }, [isOpen, initialCourse, courses]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const res = await submitEnrollRequest({
      course,
      mobile,
      name,
      trxId,
    });

    setIsLoading(false);
    if (res.success) {
      onClose();
      onSuccess(res.message);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 font-bengali">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" /> কোর্স এনরোলমেন্ট
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">কোর্স নির্বাচন করুন</label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-white cursor-pointer"
            >
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              মোবাইল নম্বর (এটি আইডি হিসেবে ব্যবহৃত হবে)
            </label>
            <input
              type="tel"
              required
              placeholder="যেমন: 01700000000"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">আপনার পূর্ণ নাম</label>
            <input
              type="text"
              required
              placeholder="যেমন: আব্দুর রহিম"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ট্রান্সেকশন আইডি (TrxID)</label>
            <input
              type="text"
              required
              placeholder="যেমন: 9H8G7F6E"
              value={trxId}
              onChange={(e) => setTrxId(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-mono uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition text-xs sm:text-sm shadow mt-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? "জমা হচ্ছে..." : "রিকোয়েস্ট সাবমিট করুন"}
          </button>
        </form>
      </div>
    </div>
  );
};
