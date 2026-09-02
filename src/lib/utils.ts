import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getTrueDate, parseBangladeshDateTime } from "@/lib/bangladesh-time";
import type { Exam } from "@/types/exam";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * In-place Fisher-Yates shuffle (unbiased — unlike `sort(() => 0.5 - Math.random())`).
 * Returns the same array for convenience.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

/**
 * Render a timestamp as the Bangladesh (UTC+6) wall clock, e.g. "৫:০০ PM".
 * The input may be an ISO string (absolute) or a naive BD string (interpreted
 * as +06:00 by parseBangladeshDateTime). Timezone-safe: it never delegates to
 * the device locale, so a browser set to another timezone still shows the real
 * BD wall-clock time.
 */
export function formatBangladeshClock(value: string | Date | null | undefined): string {
  const parsed = value instanceof Date ? value : parseBangladeshDateTime(value);
  if (!parsed || isNaN(parsed.getTime())) return "";
  // Shift into the UTC+6 wall clock, then read UTC fields — never the device
  // timezone — so the displayed time is the actual Bangladesh time.
  const bd = new Date(parsed.getTime() + 6 * 60 * 60 * 1000);
  let hours = bd.getUTCHours();
  const minutes = bd.getUTCMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = minutes < 10 ? `০${toBengaliDigits(minutes)}` : toBengaliDigits(minutes);
  return `${toBengaliDigits(hours)}:${mm} ${ampm}`;
}

/**
 * Timezone-safe Bangladesh (UTC+6) DATE renderer in the numeric bn-BD shape
 * ("D/M/YYYY" with Bengali digits) for date-only displays (ArchiveManager's
 * deletedAt column uses toLocaleDateString, so it needs the date, not a clock).
 */
export function formatBangladeshDate(value: string | Date | null | undefined): string {
  const parsed = value instanceof Date ? value : parseBangladeshDateTime(value);
  if (!parsed || isNaN(parsed.getTime())) return "";
  const bd = new Date(parsed.getTime() + 6 * 60 * 60 * 1000);
  return `${toBengaliDigits(bd.getUTCDate())}/${toBengaliDigits(bd.getUTCMonth() + 1)}/${toBengaliDigits(bd.getUTCFullYear())}`;
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
      if (parts.length === 3) {
        // H:MM:SS format
        mins = (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
        secs = parseFloat(parts[2]) || 0;
      } else {
        mins = parseFloat(parts[0]) || 0;
        secs = parseFloat(parts[1]) || 0;
      }
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
  // Use parseBangladeshDateTime (not raw new Date()) so naive stored timestamps
  // are interpreted as +06:00 exactly like every window check in the app.
  const ta = a[1].startTime ? (parseBangladeshDateTime(a[1].startTime)?.getTime() ?? null) : null;
  const tb = b[1].startTime ? (parseBangladeshDateTime(b[1].startTime)?.getTime() ?? null) : null;
  const ea = a[1].endTime ? (parseBangladeshDateTime(a[1].endTime)?.getTime() ?? null) : null;
  const eb = b[1].endTime ? (parseBangladeshDateTime(b[1].endTime)?.getTime() ?? null) : null;

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
