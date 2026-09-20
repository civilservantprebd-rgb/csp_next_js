/**
 * ইমপোর্টের সময় কোন টপিক আসলে ব্যবহার হবে — সেই সিদ্ধান্ত এক জায়গায়।
 *
 * কেন এই ফাংশন: টপিক তিন জায়গা থেকে আসতে পারে —
 *   ১. শিক্ষক ট্রি থেকে হাতে বেছেছেন (selectedTopic / targetTopic)
 *   ২. পেস্ট করা লেখার ভেতরে `# টপিক:` হেডিং আছে
 *   ৩. AI নিজে বুঝে বের করেছে (`topic` ফিল্ডে)
 *
 * এদের অগ্রাধিকার নিয়ে দ্বিধা থাকলে শিক্ষক বিভ্রান্ত হন: ট্রি-তে টপিক বেছে
 * ইমপোর্ট করার পর প্রশ্ন অন্য টপিকে চলে যায় — মনে হয় "সিলেক্টই হয়নি"।
 * নিয়ম: **শিক্ষকের হাতে-বাছা টপিকই সবচেয়ে জোরালো**, কারণ ওটা সরাসরি ও তাঁর
 * সাম্প্রতিক সিদ্ধান্ত। কিছু না বাছলে AI/লেখার টপিক ব্যবহার হয়।
 */
export interface ResolvedTopic {
  topic?: string;
  subtopic?: string;
  /** কোথা থেকে এল — UI-তে দেখানোর জন্য */
  source: "manual" | "ai" | "none";
}

export function resolveImportTopic(input: {
  manualTopic?: string;
  manualSubtopic?: string;
  aiTopic?: string;
  aiSubtopic?: string;
}): ResolvedTopic {
  const manual = (input.manualTopic || "").trim();
  const manualSub = (input.manualSubtopic || "").trim();

  // শিক্ষক কিছু বেছেছেন → সেটাই চূড়ান্ত (AI-র অনুমান নয়)
  if (manual || manualSub) {
    return {
      topic: manual || undefined,
      subtopic: manualSub || undefined,
      source: "manual",
    };
  }

  const ai = (input.aiTopic || "").trim();
  const aiSub = (input.aiSubtopic || "").trim();
  if (ai || aiSub) {
    return { topic: ai || undefined, subtopic: aiSub || undefined, source: "ai" };
  }

  return { source: "none" };
}

/** UI-তে দেখানোর জন্য এক লাইনের টপিক-পাথ */
export function topicPathLabel(resolved: ResolvedTopic): string {
  if (!resolved.topic) return "সাধারণ";
  return resolved.subtopic ? `${resolved.topic} > ${resolved.subtopic}` : resolved.topic;
}
