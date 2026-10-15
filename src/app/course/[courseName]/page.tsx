import { redirect } from "next/navigation";

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function CourseStudyPage({ params }: { params: { courseName: string } }) {
  const courseName = decodeParam(String(params.courseName || ""));
  redirect(`/?nav=courses&course=${encodeURIComponent(courseName)}`);
}
