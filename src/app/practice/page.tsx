import React from "react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Sparkles } from "lucide-react";
import { PracticeHub } from "@/components/dashboard/PracticeHub";
import { getPracticeTopics } from "@/actions/practice-actions";
import { resolveStudyIdentity } from "@/lib/student-session";

export const revalidate = 60; // Cache the page for 60 seconds

export default async function PracticePage() {
  // Attempt to fetch topics on the server if the user is authenticated via cookies
  // If not, initialTopics will be null and the client component will fall back to fetching it
  let initialTopics = null;
  try {
    const identity = await resolveStudyIdentity(null, null);
    if (identity) {
      initialTopics = await getPracticeTopics();
    }
  } catch (e) {
    // Ignore error, client will handle it
  }

  return (
    <>
      <Header />

      <main className="flex-grow w-full p-3 sm:p-5 md:p-6 font-bengali space-y-5">
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

        <PracticeHub initialTopics={initialTopics} />
      </main>

      <Footer />
    </>
  );
}
