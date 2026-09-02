import type { Metadata } from "next";
import { fetchAppConfigLite } from "@/actions/admin-actions";

// পরীক্ষার পেজ শেয়ার করলে টাইটেল/ছবিসহ কার্ড যায় (exam name)
export async function generateMetadata({ params }: { params: { examId: string } }): Promise<Metadata> {
  const examId = params?.examId || "";
  let title = "পরীক্ষা";
  try {
    const config = await fetchAppConfigLite();
    const ex = config.exams?.[examId];
    if (ex?.title) title = ex.title;
  } catch {
    // fallback title
  }
  return { title };
}

export default function ExamRouteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
