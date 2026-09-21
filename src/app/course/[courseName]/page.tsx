import React from "react";
import CourseClient from "./CourseClient";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { fetchCourseDetails } from "@/actions/course-actions";

export const revalidate = 60; // Cache the page for 60 seconds

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function CourseStudyPage({ params }: { params: { courseName: string } }) {
  const courseName = decodeParam(String(params.courseName || ""));

  const [config, courseDetails] = await Promise.all([
    fetchAppConfigLite(),
    fetchCourseDetails(courseName)
  ]);

  return <CourseClient initialConfig={config} initialCourseDetails={courseDetails} />;
}
