"use client";

import React from "react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { QuestionBankView } from "@/components/dashboard/QuestionBankView";
import { useRouter } from "next/navigation";

export default function QuestionBankPage() {
  const router = useRouter();

  return (
    <>
      <Header />
      <main className="flex-grow max-w-6xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-5">
        <QuestionBankView
          onOpenEnrollModal={() => {
            sessionStorage.setItem("open_enroll", "1");
            router.push("/");
          }}
        />
      </main>
      <Footer />
    </>
  );
}
