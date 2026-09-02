import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "প্রশ্নব্যাংক",
  description: "বিষয় ও টপিক বেছে নিন — সঠিক উত্তর ও ব্যাখ্যাসহ বিস্তারিত পড়ুন।",
};

export default function QuestionBankLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
