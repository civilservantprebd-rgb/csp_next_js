import type { Metadata } from "next";
import { fetchAppConfigLite } from "@/actions/admin-actions";

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// কোর্স পেজ শেয়ার করলে টাইটেলসহ কার্ড যায় (course name)
export async function generateMetadata({ params }: { params: { courseName: string } }): Promise<Metadata> {
  const name = decodeParam(params?.courseName || "");
  let course = name || "কোর্স";
  try {
    const config = await fetchAppConfigLite();
    if (name && (config.courses || []).includes(name)) course = name;
  } catch {
    // fallback
  }
  return {
    title: course,
    description: `${course} — ভিডিও ক্লাস, পরীক্ষা ও চ্যাপ্টারভিত্তিক প্রস্তুতি।`,
  };
}

export default function CourseRouteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
