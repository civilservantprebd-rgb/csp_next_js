/**
 * স্বয়ংক্রিয় সাজানোর সিদ্ধান্ত — UI থেকে আলাদা রাখা হয়েছে যাতে টেস্ট করা যায়।
 *
 * কেন এটা আলাদা ফাংশন: ভুল হলে ফলাফল খারাপ নয়, **টাকা পুড়ত** — পেস্ট করা
 * টেক্সট যদি বারবার নিজে থেকে AI-তে যেত, প্রতিবার একটা পেইড কল হতো। তাই
 * "কখন চালাব" নিয়মটা খাঁটি (pure) ফাংশনে রেখে প্রতিটি শর্ত টেস্ট করা হয়েছে।
 */
export interface AutoTidyInput {
  /** মডাল খোলা আছে কি না */
  isOpen: boolean;
  /** ক্লায়েন্টে মাউন্ট হয়েছে কি না (SSR-এ কিছুই করা যাবে না) */
  mounted: boolean;
  /** শিক্ষকের টগল চালু আছে কি না */
  autoAi: boolean;
  /** এখনই একটা AI কল চলছে কি না */
  aiBusy: boolean;
  /** আগের কোনো চেষ্টা ব্যর্থ হয়ে থামিয়ে দেওয়া হয়েছে কি না */
  blocked: boolean;
  /** পেস্ট-বক্সের কাঁচা টেক্সট */
  text: string;
  /** ওই টেক্সট থেকে এখন কতগুলো বৈধ প্রশ্ন পাওয়া যাচ্ছে */
  validCount: number;
  /** মোট কতগুলো প্রশ্ন-ব্লক শনাক্ত হয়েছে */
  totalParsed: number;
  /** তার মধ্যে কতগুলো ভাঙা (⚠️) */
  invalidCount: number;
  /** কোন টেক্সটে ইতিমধ্যেই চেষ্টা করা হয়েছে */
  triedText: string;
  /**
   * পেস্ট-পেস্ট কতবার হয়েছে (এবং কত নম্বর পেস্টে অটো-সাজানো চালানো হয়েছে)।
   * মূল কারণ: একবার সাজানোর পর শিক্ষক যদি হাতে কিছু ঠিক করেন (যেমন উত্তর
   * বসান), তখন validCount আবার ০ হতে পারে — কিন্তু অটো-সাজানো আবার চললে
   * তার হাতের সংশোধন মুছে যেত। তাই **প্রতি পেস্টে একবারই** অটো-সাজানো চলে।
   */
  pasteSeq: number;
  ranForPasteSeq: number;
}

/** খুব ছোট/অসম্পূর্ণ লেখায় (প্রথম কয়েকটা অক্ষর টাইপ করার সময়) AI চালানো হয় না */
export const AUTO_TIDY_MIN_CHARS = 40;

export function shouldAutoTidy(input: AutoTidyInput): boolean {
  if (!input.isOpen || !input.mounted) return false;
  if (!input.autoAi) return false; // শিক্ষক নিজে বন্ধ করেছেন
  if (input.aiBusy || input.blocked) return false;

  // এই পেস্টে আগেই সাজানো হয়ে গেছে — হাতে করা সংশোধন আর মুছবে না
  if (input.ranForPasteSeq === input.pasteSeq) return false;

  const text = input.text.trim();
  if (text.length < AUTO_TIDY_MIN_CHARS) return false;

  // যা ঠিকভাবে পার্স হচ্ছে তাতে হাত দেওয়া হয় না — তবে অর্ধেকের বেশি প্রশ্ন
  // ভাঙা মানে ফরম্যাটই এলোমেলো, তখন সাজানো দরকার। (আগে শুধু "একটাও বৈধ নয়"
  // অবস্থাতেই চলত; ফলে কিছু প্রশ্ন ঠিক আর কিছু এলোমেলো হলে হাত পড়ত না, আর
  // শিক্ষকের কাছে সেটা "কিছুই ঠিক হচ্ছে না" বলেই মনে হতো।)
  const badlyBroken = input.totalParsed >= 2 && input.invalidCount / input.totalParsed >= 0.5;
  if (input.validCount > 0 && !badlyBroken) return false;

  // একই টেক্সটে দুবার নয় (AI-র নিজের ফলও এখানেই ধরা পড়ে, তাই লুপ হয় না)
  if (input.triedText === text) return false;

  return true;
}
