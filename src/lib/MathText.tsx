"use client";

import React, { useMemo } from "react";
import katex from "katex";
import { splitMathSegments } from "./math-text";

interface MathTextProps {
  /** প্রশ্ন, অপশন বা ব্যাখ্যার কাঁচা টেক্সট (LaTeX ডেলিমিটারসহ হতে পারে) */
  text?: string | null;
  /** র‍্যাপার span-এর ক্লাস (ফন্ট সাইজ/রঙ/leading প্যারেন্ট থেকেই সাধারণত আসে) */
  className?: string;
  /** স্ক্রিন-রিডারের জন্য কনটেইনারের ভাষা */
  lang?: string;
}

/**
 * প্রশ্ন/অপশন/ব্যাখ্যার টেক্সট রেন্ডারার — প্লেইন টেক্সটের ভেতরের LaTeX
 * ম্যাথ অংশ KaTeX দিয়ে রেন্ডার করে, বাকিটা হুবহু (স্পেস/লাইন ব্রেক সহ) রাখে।
 *
 * নিরাপত্তা: `dangerouslySetInnerHTML` শুধু KaTeX-এর নিজের আউটপুটে ব্যবহার
 * করা হয় — ব্যবহারকারীর কাঁচা ইনপুট কখনো HTML হিসেবে ইনজেক্ট হয় না।
 * ভুল সিনট্যাক্স হলে `throwOnError: false` — KaTeX নিজেই লাল রঙে সমস্যাটা
 * দেখায়, কিন্তু পেজ ভাঙে না।
 *
 * লেআউট: ডিসপ্লে ম্যাথ `<span className="block">` হিসেবে দেখানো হয়
 * (div নয়), কারণ এই কম্পোনেন্ট প্রায়ই `<h3>`, `<p>` বা `<button>`-এর
 * ভেতরে বসে — ওখানে div বসালে HTML কাঠামো অবৈধ হয়ে যেত।
 *
 * দ্রষ্টব্য: katex-এর CSS (`katex/dist/katex.min.css`) রুট লেআউটে ইমপোর্ট করা আছে।
 */
export const MathText: React.FC<MathTextProps> = ({ text, className, lang }) => {
  const segments = useMemo(() => splitMathSegments(text || ""), [text]);

  const rendered = useMemo(() => {
    const segs = segments.map((seg, idx) => {
      if (seg.type === "text") {
        return { key: `t${idx}`, type: "text" as const, value: seg.value };
      }
      let html = "";
      try {
        html = katex.renderToString(seg.value, {
          displayMode: seg.display,
          throwOnError: false,
          strict: false,
          trust: false,
          output: "html",
        });
      } catch {
        // KaTeX নিজে থ্রো করলে (খুব বিরল) কাঁচা টেক্সটই দেখানো হয়
        html = "";
      }
      return { key: `m${idx}`, type: "math" as const, value: seg.value, display: seg.display, html };
    });

    // ডিসপ্লে ম্যাথ নিজেই ব্লক, আর তার চারপাশের লেখায় হয়তো নতুন লাইন আছে
    // (`whitespace-pre-wrap` থাকলে সেটা আরেকটা লাইন-ব্রেক যোগ করত) — তাই ঠিক
    // একটা নতুন লাইন বাদ দেওয়া হয়, নইলে সমীকরণের চারপাশে বাড়তি ফাঁকা জায়গা হয়।
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.type !== "math" || !seg.display) continue;
      const prev = segs[i - 1];
      const next = segs[i + 1];
      if (prev && prev.type === "text" && prev.value.endsWith("\n")) prev.value = prev.value.slice(0, -1);
      if (next && next.type === "text" && next.value.startsWith("\n")) next.value = next.value.slice(1);
    }

    return segs;
  }, [segments]);

  return (
    <span className={className} lang={lang}>
      {rendered.map((seg) => {
        if (seg.type === "text") return <React.Fragment key={seg.key}>{seg.value}</React.Fragment>;
        if (!seg.html) return <React.Fragment key={seg.key}>{seg.value}</React.Fragment>;
        if (seg.display) {
          return (
            <span
              key={seg.key}
              className="block my-1.5 text-center overflow-x-auto overflow-y-hidden"
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          );
        }
        return (
          <span
            key={seg.key}
            className="inline-block align-middle max-w-full"
            dangerouslySetInnerHTML={{ __html: seg.html }}
          />
        );
      })}
    </span>
  );
};
