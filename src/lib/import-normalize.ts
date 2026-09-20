import { parseBengaliDigits, toBengaliDigits } from "./utils";

/**
 * AI চ্যাট (Gemini/ChatGPT) থেকে কপি করা টেক্সট পরিষ্কার করা।
 *
 * কেন দরকার: চ্যাটের উত্তর সাধারণত Markdown-এ আসে — `**বোল্ড**`, `### হেডিং`,
 * `| টেবিল |`, কোড-ফেন্স, `> ব্লককোট`। আমাদের বাল্ক-ইমপোর্ট পarser নম্বর-মার্কার,
 * "উত্তর:", "ব্যাখ্যা:" লাইনের **শুরু** দেখে চিনে — তাই `**উত্তর: ক**` লাইনের
 * শুরুতে `**` থাকলে উত্তরটাই খুঁজে পাওয়া যায় না, `**ক)**` থাকলে অপশনই ধরা পড়ে না।
 * এখানে শুধু সাজসজ্জার মার্কারগুলো বাদ যায় — প্রশ্ন/অপশনের লেখা হুবহু থাকে।
 *
 * কনটেন্ট যাতে নষ্ট না হয়: বোল্ড/ইটালিক মার্কার বাদে বাকি সব লেখা অপরিবর্তিত;
 * টেবিল সারি শুধু তখনই ভাঙা হয় যখন সেটি স্পষ্টভাবে প্রশ্ন+অপশন+উত্তরের ছক।
 */
export function normalizePastedContent(rawText: string): string {
  if (!rawText) return rawText;
  let text = String(rawText);

  // কপি-পেস্টে চলে আসা অদৃশ্য অক্ষর (জিরো-উইড্থ, BOM) আর নন-ব্রেকিং স্পেস
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ");

  // JSON/কোড-ব্লকে আটকে থাকা ডাবল-এস্কেপড ডেলিমিটার: \\(x\\) → \(x\)
  text = text
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");

  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  /** টেবিল থেকে বানানো প্রশ্নে নম্বর বসানোর কাউন্টার (নতুন ব্লক চেনাতে দরকার) */
  let tableQuestionNo = 1;

  for (const rawLine of lines) {
    let line = rawLine;

    // কোড-ফেন্স (``` বা ~~~) — লাইনটা বাদ, ভেতরের লেখা থাকবে
    if (/^\s*(```|~~~)/.test(line)) continue;

    // Markdown অনুভূমিক রেখা (---, ***, ___, ===) — শুধু সাজসজ্জা
    if (/^\s*(?:[-*_=]\s*){3,}$/.test(line)) continue;

    // ব্লককোট "> লেখা"
    line = line.replace(/^\s*>\s?/, "");

    // Markdown টেবিল
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = convertTableRow(line);
      if (rows === null) continue; // হেডার/সেপারেটর সারি — বাদ
      // প্রশ্নের নম্বর বসানো হয়, নইলে সারিটা আগের প্রশ্নের ব্যাখ্যার সঙ্গে মিশে যায়
      rows[0] = `${toBengaliDigits(tableQuestionNo)}. ${rows[0]}`;
      tableQuestionNo += 1;
      out.push(...rows);
      continue;
    }

    // হেডিং: "### ১. প্রশ্ন?" → "১. প্রশ্ন?"
    // তবে "# টপিক > সাবটপিক" ধাঁচের হেডিং ছোঁয়া হয় না — ওটা পarser-এর
    // টপিক-শনাক্তকরণ (`^#+\s+`) হিসেবে কাজ করে, মার্কার সরালে ভেঙে যেত।
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (heading) {
      const rest = heading[1].trim();
      const looksLikeContent =
        /^([০-৯\d]+[\.\)]|প্রশ্ন\s*[০-৯\d]*\s*[:\.]|Q\s*[০-৯\d]*\s*[:\.]|সঠিক\s*উত্তর|উত্তর|ব্যাখ্যা|answer|explanation|exp)(?=[\s:ঃ\.\-–—]|$)/i.test(
          rest
        );
      if (looksLikeContent) line = rest;
    }

    // বোল্ড/ইটালিক মার্কার — ভেতরের লেখা অটুট রেখে মার্কারটা বাদ
    line = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
    // জোড়া না মেলা ঝুলে থাকা মার্কার (লাইনের শুরু/শেষে)
    line = line.replace(/^\s*\*\*\s*/, "").replace(/\s*\*\*\s*$/, "");

    out.push(line);
  }

  return out.join("\n");
}

/** অপশন-সেলের শুরুতে বাড়তি মার্কার থাকলে বাদ দেওয়া: "ক) ঢাকা" → "ঢাকা" */
function stripOptionMarker(cell: string): string {
  // ডট-রূপে (ক. খ.) স্পেস থাকা লাগবে — নইলে "গ.সা.গু." জাতীয় সংক্ষেপ ভেঙে যেত
  return cell.replace(/^\(?\s*[কখগঘabcdABCD]\s*(?:[\)\]]|[\.\-–—]\s+)\s*/, "").trim();
}

/**
 * Markdown টেবিলের একটা সারি → সাধারণ ব্লক লাইন।
 *   | ১ | চর্যাপদ কোন ছন্দে? | মাত্রাবৃত্ত | অক্ষরবৃত্ত | স্বরবৃত্ত | গদ্যছন্দ | ক |
 * → প্রশ্ন + ক)/খ)/গ)/ঘ) + উত্তর: ক
 *
 * স্পষ্ট প্রশ্ন-ছক না হলে (যেমন শুধু তথ্যের টেবিল) সারিটা এক লাইনে জোড়া লাগানো
 * হয়, যাতে কিছুই হারিয়ে না যায়। হেডার ও সেপারেটর সারি বাদ যায় (null)।
 */
function convertTableRow(line: string): string[] | null {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

  if (cells.length === 0) return null;

  // |---|---| ধাঁচের সেপারেটর সারি
  if (cells.every((c) => /^[\s:\-–—_]*$/.test(c))) return null;

  // হেডার সারি: কোনো সেলে শুধু "প্রশ্ন/ক/খ/গ/ঘ/উত্তর/ব্যাখ্যা" জাতীয় শিরোনাম
  const headerWords = /^(#|প্রশ্ন|প্রশ্নাবলি|question|ক|খ|গ|ঘ|উত্তর|সঠিক উত্তর|answer|ব্যাখ্যা|explanation)$/i;
  const headerHits = cells.filter((c) => headerWords.test(c)).length;
  if (headerHits >= 2 || (headerHits >= 1 && cells.length <= 6 && !/[?？]/.test(cells[0]))) {
    return null;
  }

  // শুরুতে ক্রমিক নম্বরের কলাম থাকলে বাদ (| ১ | প্রশ্ন | … |)
  if (cells.length >= 6 && /^[০-৯\d]{1,3}[\.\)]?$/.test(cells[0])) cells.shift();

  // উত্তর-কলাম খুঁজে বের করা: [প্রশ্ন, ক, খ, গ, ঘ, উত্তর, (ব্যাখ্যা)]
  if (cells.length >= 5) {
    const answerIdx = cells.length >= 6 ? 5 : -1;
    const answerCell = answerIdx > 0 ? cells[answerIdx] : "";
    const ansIndex = answerCell ? answerLabelIndex(answerCell) : null;
    if (ansIndex !== null) {
      const q = cells[0];
      const opts = cells.slice(1, 5);
      const exp = cells.length >= 7 ? cells.slice(6).join(" ").trim() : "";
      if (q && opts.every((o) => o.length > 0)) {
        const rows = [
          q,
          `ক) ${stripOptionMarker(opts[0])}`,
          `খ) ${stripOptionMarker(opts[1])}`,
          `গ) ${stripOptionMarker(opts[2])}`,
          `ঘ) ${stripOptionMarker(opts[3])}`,
          `উত্তর: ${cells[answerIdx]}`,
        ];
        if (exp) rows.push(`ব্যাখ্যা: ${exp}`);
        return rows;
      }
    }
  }

  // প্রশ্ন-ছক নয় — তথ্য হারাতে না দিয়ে এক লাইনে জোড়া লাগানো হয়
  return [cells.join("  ")];
}

/** উত্তর-সেল থেকে অপশন ইনডেক্স (০-৩), না মিললে null */
function answerLabelIndex(cell: string): number | null {
  const clean = cell.trim().replace(/^[\(\[\{\s]+|[\)\]\}\s\.\-]+$/g, "").toLowerCase();
  if (!clean) return null;
  const norm = parseBengaliDigits(clean);
  if (clean.startsWith("ক") || clean.startsWith("a") || norm === "1") return 0;
  if (clean.startsWith("খ") || clean.startsWith("b") || norm === "2") return 1;
  if (clean.startsWith("গ") || clean.startsWith("c") || norm === "3") return 2;
  if (clean.startsWith("ঘ") || clean.startsWith("d") || norm === "4") return 3;
  return null;
}
