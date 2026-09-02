import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "সেলফ প্র্যাকটিস",
  description: "নিজের গতিতে টপিকভিত্তিক প্রশ্ন প্র্যাকটিস করুন — উত্তর ও ব্যাখ্যাসহ।",
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
