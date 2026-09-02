import type { Metadata } from "next";
import { fetchAppConfigLite } from "@/actions/admin-actions";

// লিডারবোর্ড শেয়ার করলে টাইটেলসহ কার্ড যায় (exam name)
export async function generateMetadata({ params }: { params: { examId: string } }): Promise<Metadata> {
  const examId = params?.examId || "";
  let title = "লিডারবোর্ড";
  try {
    const config = await fetchAppConfigLite();
    const ex = config.exams?.[examId];
    if (ex?.title) title = `${ex.title} — লিডারবোর্ড`;
  } catch {
    // fallback title
  }
  return { title };
}

export default function LeaderboardRouteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
