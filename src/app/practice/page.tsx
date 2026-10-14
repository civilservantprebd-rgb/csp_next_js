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
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-5 rounded-3xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-medium">সেলফ প্র্যাকটিস</h1>
              <p className="text-xs text-teal-50 font-bold mt-0.5">
                টপিক-গ্রুপ ও মোড বেছে নিয়ে আপনার অনুশীলন শুরু করুন
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
