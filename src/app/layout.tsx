import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BCS One - ইন্টারেক্টিভ কুইজ পোর্টাল",
  description: "বিসিএস ও সরকারি চাকরির প্রস্তুতির স্মার্ট ও ইন্টারেক্টিভ কুইজ পোর্টাল",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn">
      <body className="bg-slate-50 text-slate-800 min-h-screen flex flex-col overflow-x-hidden antialiased font-bengali">
        {children}
      </body>
    </html>
  );
}
