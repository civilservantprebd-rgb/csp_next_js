import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "শিক্ষক প্যানেল - BCS One",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 flex flex-col">{children}</div>;
}
