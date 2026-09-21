import React from "react";
import PortalClient from "./PortalClient";
import { getCompletedExamKeys, getStudentStreak } from "@/actions/student-actions";
import { fetchDriveLinks } from "@/actions/admin-actions";
import { resolveStudyIdentity } from "@/lib/student-session";

export const revalidate = 60; // Cache for 60 seconds

export default async function PortalPage() {
  let initialExamsTaken = null;
  let initialStreak = null;
  let initialDriveLinks = null;

  try {
    const [identity, links] = await Promise.all([
      resolveStudyIdentity(null, null),
      fetchDriveLinks()
    ]);
    
    initialDriveLinks = links;

    if (identity) {
      const [keys, streak] = await Promise.all([
        getCompletedExamKeys(identity.id, identity.email),
        getStudentStreak(identity.id)
      ]);
      
      initialExamsTaken = (keys || []).length;
      initialStreak = streak;
    }
  } catch (e) {
    // Ignore, let client handle fallback fetching
  }

  return (
    <PortalClient 
      initialExamsTaken={initialExamsTaken} 
      initialStreak={initialStreak}
      initialDriveLinks={initialDriveLinks} 
    />
  );
}
