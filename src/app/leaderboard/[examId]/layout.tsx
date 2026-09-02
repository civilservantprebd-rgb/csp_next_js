import type { Metadata } from "next";
import { fetchExamMeta } from "@/actions/admin-actions";

// লিডারবোর্ড শেয়ার করলে টাইটেলসহ কার্ড যায় (exam name)
export async function generateMetadata({ params }: { params: { examId: string } }): Promise<Metadata> {
  const examId = params?.examId || "";
  let title = "লিডারবোর্ড";
  try {
    // শুধু এই পরীক্ষার মেটা — পুরো কনফিগ নয়
    const ex = await fetchExamMeta(examId);
    if (ex?.title) title = `${ex.title} — লিডারবোর্ড`;
  } catch {
    // fallback title
  }
  return { title };
}

export default function LeaderboardRouteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
