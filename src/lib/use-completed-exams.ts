"use client";

import { useEffect, useState } from "react";

/**
 * Returns the set of exam keys the current student has already submitted.
 * Used to mark exams as "সম্পন্ন" (completed) in exam lists.
 */
export function useCompletedExams(): Set<string> {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    import("@/lib/student-auth").then(({ getLocalStudentUser }) => {
      const localUser = getLocalStudentUser();
      if (!localUser) return;
      import("@/actions/student-actions").then(({ getCompletedExamKeys }) => {
        getCompletedExamKeys(localUser.uid, localUser.email).then((keys) => {
          if (!cancelled) setCompleted(new Set(keys));
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return completed;
}
