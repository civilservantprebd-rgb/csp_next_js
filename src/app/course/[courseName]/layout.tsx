import type { Metadata } from "next";
import { fetchCourseNameList } from "@/actions/admin-actions";

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
    // শুধু কোর্সের নামের তালিকা (app_settings) — পুরো কনফিগ নয়
    const courses = await fetchCourseNameList();
    if (name && courses.includes(name)) course = name;
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
