"use client";

import { useEffect, useState } from "react";
import { getLocalStudentUser } from "@/lib/student-auth";
import { getCompletedExamKeys } from "@/actions/student-actions";

/**
 * Returns the set of exam keys the current student has already submitted.
 * Used to mark exams as "সম্পন্ন" (completed) in exam lists.
 *
 * Re-fetches whenever the logged-in student changes (login/logout/account
 * switch) so it never shows the previous student's completions.
 */
export function useCompletedExams(): Set<string> {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [userKey, setUserKey] = useState<string | null>(null);

  // Track the current local user; re-run when auth state changes
  useEffect(() => {
    const refresh = () => {
      try {
        const localUser = getLocalStudentUser();
        setUserKey(localUser ? `${localUser.uid}|${localUser.email || ""}` : null);
      } catch {
        setUserKey(null);
      }
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  useEffect(() => {
    if (!userKey) {
      setCompleted(new Set());
      return;
    }

    let cancelled = false;
    const localUser = getLocalStudentUser();
    if (!localUser) return;
    getCompletedExamKeys(localUser.uid, localUser.email)
      .then((keys) => {
        if (!cancelled) setCompleted(new Set(keys));
      })
      .catch(() => {
        // transient failure — show everything as incomplete rather than crashing
        if (!cancelled) setCompleted(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  return completed;
}
