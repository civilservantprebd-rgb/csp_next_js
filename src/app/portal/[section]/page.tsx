import React from "react";
import PortalSectionClient from "./PortalSectionClient";
import { getStudentPortalData } from "@/actions/student-actions";

import { resolveStudyIdentity } from "@/lib/student-session";

export const revalidate = 60; // Cache for 60 seconds

export default async function PortalSectionPage() {
  let initialData = null;


  try {
    const identity = await resolveStudyIdentity(null, null);
    if (identity) {
      const data = await getStudentPortalData(identity.id, identity.email);
      if (data?.allowed) {
        initialData = data;
      }
    }
    
    if (!initialData) {
      initialDriveLinks = null;
    }
  } catch (e) {
    // Ignore, let client handle fallback fetching
  }

  return (
    <PortalSectionClient 
      initialData={initialData} 
 
    />
  );
}
