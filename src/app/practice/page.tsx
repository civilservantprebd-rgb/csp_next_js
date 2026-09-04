"use client";

import React from "react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { PracticeHub } from "@/components/dashboard/PracticeHub";

// সেলফ প্র্যাকটিস হাব — টপিক-গ্রুপ কার্ড গ্রিড (Live MCQ-স্টাইল)।
// PracticeHub নিজেই লগইন/এনরোলমেন্ট যাচাই করে, টপিক-তালিকা (কাউন্টসহ) লোড করে
// এবং /practice/session-এ প্র্যাকটিস সেশন খোলে। এখানে শুধু লেআউট ও এনরোল-রুট।
export default function PracticePage() {
  const router = useRouter();

  const openEnrollModal = () => {
    sessionStorage.setItem("open_enroll", "1");
    router.push("/");
  };

  return (
    <>
      <Header />

      <main className="flex-grow max-w-6xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-5">
        {/* Page header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black leading-tight">সেলফ প্র্যাকটিস</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                টপিক-গ্রুপ বেছে নিন, প্রশ্নের সংখ্যা ও মোড ঠিক করুন, তারপর শুরু করুন — সাথে সঙ্গে উত্তর ও ব্যাখ্যা
              </p>
            </div>
          </div>
        </div>

        <PracticeHub onOpenEnrollModal={openEnrollModal} />
      </main>

      <Footer />
    </>
  );
}
