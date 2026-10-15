"use client";

import React from "react";
import {
  Globe2,
  Landmark,
  Atom,
  Laptop,
  Compass,
  Scale,
  Brain,
  BookOpen,
  Languages,
  BookMarked,
  Calculator,
  GraduationCap,
  Briefcase,
  Sparkles,
  Layers,
  LucideIcon
} from "lucide-react";

interface TopicIconProps {
  name: string;
  className?: string;
  size?: number;
}

/**
 * টপিকের নাম বা কিওয়ার্ড অনুসারে সঠিক Lucide Icon রিটার্ন করে।
 * বাংলা ইউনিকোড কম্বাইনিং মার্ক (যেমন শুরুতে অসাবধানতাবশত যুক্ত `্`)
 * ও স্পেস ট্রিম করে ক্লিন ম্যাচিং নিশ্চিত করা হয়।
 */
export function getTopicIconComponent(rawName: string): LucideIcon {
  if (!rawName) return Layers;

  // Remove leading hasanta (্) or combining marks and trim
  const name = String(rawName)
    .replace(/^[\u09cd\s]+/, "")
    .trim()
    .toLowerCase();

  // ১. বাংলাদেশ
  if (
    name.includes("বাংলাদেশ") ||
    name.includes("bangladesh") ||
    name.includes("মুক্তিযুদ্ধ") ||
    name.includes("বঙ্গবন্ধু") ||
    name.includes("সংবিধান") ||
    name === "বিডি" ||
    name === "bd"
  ) {
    return Landmark;
  }

  // ২. আন্তর্জাতিক
  if (
    name.includes("আন্তর্জাতিক") ||
    name.includes("international") ||
    name.includes("জাতিসংঘ") ||
    name.includes("পররাষ্ট্র") ||
    name.includes("বিশ্ব")
  ) {
    return Globe2;
  }

  // ৩. সাধারণ বিজ্ঞান / বিজ্ঞান
  if (
    name.includes("বিজ্ঞান") ||
    name.includes("science") ||
    name.includes("পদার্থ") ||
    name.includes("রসায়ন") ||
    name.includes("জীববিজ্ঞান") ||
    name.includes("প্রাণিবিজ্ঞান") ||
    name.includes("উদ্ভিদবিজ্ঞান")
  ) {
    return Atom;
  }

  // ৪. কম্পিউটার ও তথ্যপ্রযুক্তি / আইসিটি
  if (
    name.includes("কম্পিউটার") ||
    name.includes("তথ্যপ্রযুক্তি") ||
    name.includes("তথ্য প্রযুক্তি") ||
    name.includes("ict") ||
    name.includes("computer") ||
    name.includes("আইসিটি") ||
    name.includes("প্রযুক্তি") ||
    name.includes("নেটওয়ার্ক")
  ) {
    return Laptop;
  }

  // ৫. ভূগোল ও পরিবেশ / দুর্যোগ
  if (
    name.includes("ভূগোল") ||
    name.includes("পরিবেশ") ||
    name.includes("দুর্যোগ") ||
    name.includes("geography") ||
    name.includes("বায়ুমণ্ডল") ||
    name.includes("আবহাওয়া") ||
    name.includes("মৃত্তিকা")
  ) {
    return Compass;
  }

  // ৬. নৈতিকতা ও সুশাসন / মূল্যবোধ
  if (
    name.includes("নৈতিকতা") ||
    name.includes("সুশাসন") ||
    name.includes("মূল্যবোধ") ||
    name.includes("ethics") ||
    name.includes("governance") ||
    name.includes("সততা")
  ) {
    return Scale;
  }

  // ৭. মানসিক দক্ষতা
  if (
    name.includes("মানসিক দক্ষতা") ||
    name.includes("মানসিক") ||
    name.includes("mental") ||
    name.includes("বুদ্ধিমত্তা") ||
    name.includes("যুক্তি") ||
    name.includes("reasoning")
  ) {
    return Brain;
  }

  // ৮. বিসিএস প্রিলিমিনারি প্রশ্ন / বিগত বছর / জব সল্যুশন
  if (
    name.includes("বিসিএস") ||
    name.includes("bcs") ||
    name.includes("প্রিলিমিনারি") ||
    name.includes("বিগত") ||
    name.includes("job solution") ||
    name.includes("মডেল টেস্ট")
  ) {
    return GraduationCap;
  }

  // ৯. Vocabulary / শব্দার্থ
  if (
    name.includes("vocabulary") ||
    name.includes("vocab") ||
    name.includes("শব্দার্থ") ||
    name.includes("synonym") ||
    name.includes("antonym") ||
    name.includes("words")
  ) {
    return BookMarked;
  }

  // ১০. ইংরেজি / English
  if (
    name.includes("ইংরেজি") ||
    name.includes("english") ||
    name.includes("grammar") ||
    name.includes("literature")
  ) {
    return Languages;
  }

  // ১১. গণিত / Math
  if (
    name.includes("গণিত") ||
    name.includes("গনিত") ||
    name.includes("পাটিগণিত") ||
    name.includes("বীজগণিত") ||
    name.includes("জ্যামিতি") ||
    name.includes("math") ||
    name.includes("ত্রিকোণমিতি") ||
    name.includes("পরিসংখ্যান") ||
    name.includes("অঙ্ক")
  ) {
    return Calculator;
  }

  // ১২. IBA Preparation / Business
  if (
    name.includes("iba") ||
    name.includes("business") ||
    name.includes("আইবিএ") ||
    name.includes("এমবিএ")
  ) {
    return Briefcase;
  }

  // ১৩. বাংলা ভাষা ও সাহিত্য / ব্যাকরণ
  if (
    name.includes("বাংলা") ||
    name.includes("bangla") ||
    name.includes("ব্যাকরণ") ||
    name.includes("সাহিত্য") ||
    name.includes("প্রাচীন") ||
    name.includes("মধ্যযুগ") ||
    name.includes("আধুনিক যুগ")
  ) {
    return BookOpen;
  }

  // ১৪. সাধারণ জ্ঞান / সাধারণ
  if (
    name.includes("সাধারণ জ্ঞান") ||
    name.includes("সাধারণ") ||
    name.includes("gk")
  ) {
    return Sparkles;
  }

  return Layers;
}

/**
 * বিষয়/টপিক অনুসারে বিষয়ভিত্তিক টেলউইন্ড গ্রেডিয়েন্ট।
 */
export function getTopicGradientClass(rawName: string, fallbackIdx: number = 0): string {
  if (!rawName) return "from-indigo-500 to-violet-600";

  const name = String(rawName)
    .replace(/^[\u09cd\s]+/, "")
    .trim()
    .toLowerCase();

  if (name.includes("বাংলাদেশ") || name.includes("bangladesh")) {
    return "from-emerald-600 to-green-700";
  }
  if (name.includes("আন্তর্জাতিক") || name.includes("international")) {
    return "from-sky-500 to-blue-600";
  }
  if (name.includes("বিজ্ঞান") || name.includes("science")) {
    return "from-purple-500 to-indigo-600";
  }
  if (name.includes("কম্পিউটার") || name.includes("তথ্যপ্রযুক্তি") || name.includes("ict") || name.includes("computer")) {
    return "from-cyan-500 to-teal-600";
  }
  if (name.includes("ভূগোল") || name.includes("পরিবেশ") || name.includes("geography")) {
    return "from-amber-500 to-orange-600";
  }
  if (name.includes("নৈতিকতা") || name.includes("সুশাসন") || name.includes("মূল্যবোধ") || name.includes("ethics")) {
    return "from-rose-500 to-pink-600";
  }
  if (name.includes("মানসিক") || name.includes("mental")) {
    return "from-fuchsia-500 to-purple-600";
  }
  if (name.includes("বিসিএস") || name.includes("bcs") || name.includes("প্রিলিমিনারি")) {
    return "from-slate-700 to-slate-900";
  }
  if (name.includes("vocabulary") || name.includes("vocab")) {
    return "from-violet-500 to-purple-600";
  }
  if (name.includes("ইংরেজি") || name.includes("english")) {
    return "from-indigo-500 to-violet-600";
  }
  if (name.includes("গণিত") || name.includes("গনিত") || name.includes("math") || name.includes("পাটিগণিত") || name.includes("বীজগণিত")) {
    return "from-orange-500 to-amber-600";
  }
  if (name.includes("বাংলা") || name.includes("bangla") || name.includes("সাহিত্য") || name.includes("ব্যাকরণ")) {
    return "from-teal-500 to-emerald-600";
  }
  if (name.includes("iba") || name.includes("business")) {
    return "from-blue-600 to-indigo-700";
  }
  if (name.includes("সাধারণ") || name.includes("gk")) {
    return "from-teal-600 to-cyan-700";
  }

  const FALLBACK_GRADIENTS = [
    "from-emerald-500 to-teal-600",
    "from-indigo-500 to-violet-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-sky-500 to-blue-600",
    "from-fuchsia-500 to-purple-600",
    "from-lime-500 to-green-600",
    "from-cyan-500 to-teal-600",
    "from-red-500 to-rose-600",
    "from-blue-500 to-indigo-600"
  ];
  return FALLBACK_GRADIENTS[fallbackIdx % FALLBACK_GRADIENTS.length];
}

export const TopicIcon: React.FC<TopicIconProps> = ({ name, className = "w-5 h-5", size }) => {
  const IconComponent = getTopicIconComponent(name);
  return <IconComponent className={className} size={size} />;
};
