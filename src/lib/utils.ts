import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getTrueDate } from "@/lib/bangladesh-time";
import type { Exam } from "@/types/exam";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseBengaliDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  const bnDigits: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
  };
  return String(str).replace(/[০-৯]/g, (d) => bnDigits[d] || d);
}

export function toBengaliDigits(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "০";
  const enDigits: Record<string, string> = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯"
  };
  return String(num).replace(/[0-9]/g, (d) => enDigits[d] || d);
}

export function parseTimeSpentToSeconds(timeSpent: string | number | null | undefined): number {
  if (timeSpent === undefined || timeSpent === null || timeSpent === "") return Infinity;
  if (typeof timeSpent === "number") return isNaN(timeSpent) ? Infinity : timeSpent;

  const normalized = parseBengaliDigits(String(timeSpent)).trim();

  let mins = 0;
  let secs = 0;
  const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:মি(?:নিট|\.)?|min(?:ute)?s?|m\b)/i);
  const secMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:সে(?:কেন্ড|\.)?|sec(?:ond)?s?|s\b)/i);

  if (minMatch) mins = parseFloat(minMatch[1]) || 0;
  if (secMatch) secs = parseFloat(secMatch[1]) || 0;

  if (!minMatch && !secMatch) {
    if (normalized.includes(":")) {
      const parts = normalized.split(":");
      mins = parseFloat(parts[0]) || 0;
      secs = parseFloat(parts[1]) || 0;
    } else {
      const num = parseFloat(normalized);
      if (!isNaN(num)) return num;
      return Infinity;
    }
  }
  return mins * 60 + secs;
}

/**
 * Sort exams so students never have to scroll to find the one to take:
 *   1. currently live (started & not ended)   — earliest start first
 *   2. upcoming (scheduled, not started)      — earliest start first
 *   3. ended                                  — earliest start first
 *   4. no schedule (always-open practice)     — last
 */
export function sortExamsForStudents(a: [string, Exam], b: [string, Exam]): number {
  const now = getTrueDate().getTime();
  const ta = a[1].startTime ? new Date(a[1].startTime).getTime() : null;
  const tb = b[1].startTime ? new Date(b[1].startTime).getTime() : null;
  const ea = a[1].endTime ? new Date(a[1].endTime).getTime() : null;
  const eb = b[1].endTime ? new Date(b[1].endTime).getTime() : null;

  const status = (t: number | null, e: number | null): number => {
    if (t === null) return 3; // no schedule → last
    if (t <= now && (e === null || e >= now)) return 0; // live now
    if (t > now) return 1; // upcoming
    return 2; // ended
  };

  const sa = status(ta, ea);
  const sb = status(tb, eb);
  if (sa !== sb) return sa - sb;
  if (ta === null) return 0;
  if (tb === null) return 0;
  return ta - tb;
}
