import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
