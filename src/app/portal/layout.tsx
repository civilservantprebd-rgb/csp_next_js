import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "স্টুডেন্ট পোর্টাল",
  description: "ফলাফল, পারফরম্যান্স বিশ্লেষণ, ভুল উত্তরের খাতা ও চ্যাপ্টারভিত্তিক প্রশ্নব্যাংক — এক জায়গায়।",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
