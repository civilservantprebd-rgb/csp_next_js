"use client";

import React, { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SelfPracticeModal } from "@/components/modals/SelfPracticeModal";
import { getPracticeQuestions } from "@/actions/practice-actions";
import { getLocalStudentUser } from "@/lib/student-auth";
import { PracticeQuestion } from "@/lib/practice-helper";
import { shuffleArray } from "@/lib/utils";
import { AlertCircle, Loader2, LogIn } from "lucide-react";

/**
 * সেলফ-প্র্যাকটিস সেশন — আলাদা উইন্ডো/ট্যাবে খোলে (SelfPracticeCard থেকে
 * window.open("/practice/session?topic=...&count=...&mode=..."))।
 *
 * ইনস্ট্যান্ট ও মক-টেস্ট — দুই মুডেই এই পেজে পূর্ণ-স্ক্রিন প্র্যাকটিস চলে।
 * প্রশ্ন সার্ভার-অ্যাকশন থেকেই আসে (সার্ভার-সাইড এনরোলমেন্ট যাচাইসহ)।
 */

function PracticeSessionInner() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "সকল টপিক (মিক্সড)";
  const rawCount = parseInt(searchParams.get("count") || "10", 10);
  const count = [10, 20, 30, 50].includes(rawCount) ? rawCount : 10;
  const mode = searchParams.get("mode") === "exam" ? "exam" : "instant";

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [message, setMessage] = useState("");

  const closeWindow = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.close();
        // window.close() শুধু script-খোলা উইন্ডোতে কাজ করে — সরাসরি ঢুকলে ফিরিয়ে দিই
        setTimeout(() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = "/practice";
          }
        }, 150);
      }
    } catch {
      if (typeof window !== "undefined") window.location.href = "/practice";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const localUser = getLocalStudentUser();
      if (!localUser) {
        if (!cancelled) {
          setStatus("error");
          setMessage("প্র্যাকটিস করতে Google লগইন প্রয়োজন। হোম পেজ থেকে লগইন করে আবার চেষ্টা করুন।");
        }
        return;
      }
      try {
        const qs = await getPracticeQuestions(topic, count, localUser.uid, localUser.email);
        if (cancelled) return;
        if (!qs || qs.length === 0) {
          setStatus("error");
          setMessage(
            "এই টপিকে কোনো প্রশ্ন পাওয়া যায়নি বা আপনার এনরোলমেন্ট নেই। কোনো কোর্সে এনরোল করে আবার চেষ্টা করুন।"
          );
          return;
        }
        setQuestions(qs);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("প্রশ্ন লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // topic/count/mode একবারই লোড হয় (উইন্ডো খোলার সময়)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestart = () => {
    // নতুন রাউন্ড — একই প্রশ্ন শাফল করে; মোডাল নিজেই স্টেট রিসেট করে
    setQuestions((prev) => shuffleArray([...prev]));
  };

  if (status !== "ready") {
    return (
      <div className="min-h-dvh w-full bg-gradient-to-b from-teal-50/70 via-slate-50 to-indigo-50/60 font-bengali flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl border border-slate-100">
          {status === "loading" ? (
            <>
              <Loader2 className="w-12 h-12 text-teal-600 animate-spin mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">প্রশ্ন প্রস্তুত হচ্ছে...</h3>
              <p className="text-xs text-slate-500">
                {topic} • {count}টি প্রশ্ন • {mode === "instant" ? "ইনস্ট্যান্ট মোড" : "মক টেস্ট মোড"}
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">শুরু করা যাচ্ছে না</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{message}</p>
              {message.includes("লগইন") && (
                <a
                  href="/"
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  <LogIn className="w-4 h-4" /> লগইন পেজে যান
                </a>
              )}
            </>
          )}
          <button
            type="button"
            onClick={closeWindow}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    );
  }

  return (
    <SelfPracticeModal
      isOpen
      standalone
      onClose={closeWindow}
      questions={questions}
      subjectName={topic}
      mode={mode}
      onRestart={handleRestart}
    />
  );
}

export default function PracticeSessionPage() {
  return (
    <Suspense fallback={null}>
      <PracticeSessionInner />
    </Suspense>
  );
}
