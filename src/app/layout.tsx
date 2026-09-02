import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aarohon.com"),
  title: "আরোহণ - প্রিপারেশন পোর্টাল",
  description: "বিসিএস ও সরকারি চাকরির প্রস্তুতির স্মার্ট প্রিপারেশন পোর্টাল — কুইজ, মডেল টেস্ট, লিডারবোর্ড ও চ্যাপ্টারভিত্তিক পড়াশোনা এক জায়গায়।",
  openGraph: {
    title: "আরোহণ - প্রিপারেশন পোর্টাল",
    description: "বিসিএস ও সরকারি চাকরির প্রস্তুতির স্মার্ট প্রিপারেশন পোর্টাল — কুইজ, মডেল টেস্ট ও চ্যাপ্টারভিত্তিক পড়াশোনা এক জায়গায়।",
    type: "website",
    locale: "bn_BD",
    siteName: "আরোহণ",
  },
  twitter: {
    card: "summary_large_image",
    title: "আরোহণ - প্রিপারেশন পোর্টাল",
    description: "বিসিএস ও সরকারি চাকরির প্রস্তুতির স্মার্ট প্রিপারেশন পোর্টাল",
  },
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
        <Analytics />
      </body>
    </html>
  );
}
