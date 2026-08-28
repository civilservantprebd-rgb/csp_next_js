"use server";

import { GoogleGenAI } from "@google/genai";
import { QuestionItem, QuestionSolution } from "@/types/exam";

export interface GeneratedMCQResult {
  questions: QuestionItem[];
  solutions: QuestionSolution[];
  rawText: string;
  count: number;
}

export async function generateMCQWithAI(params: {
  topic: string;
  subtopic?: string;
  count?: number;
  difficulty?: "সহজ" | "মাঝারি" | "কঠিন" | "বিসিএস প্রিলিমিনারি মান";
  contextText?: string;
  apiKey?: string;
}): Promise<{ success: boolean; data?: GeneratedMCQResult; error?: string }> {
  const { topic, subtopic, count = 5, difficulty = "বিসিএস প্রিলিমিনারি মান", contextText, apiKey } = params;

  const resolvedApiKey = apiKey?.trim() || process.env.GEMINI_API_KEY || "";

  if (!resolvedApiKey) {
    return {
      success: false,
      error: "Gemini API Key পাওয়া যায়নি। দয়া করে আপনার ফ্রি Gemini API Key প্রদান করুন (Google AI Studio থেকে সংগ্রহ করতে পারেন)।"
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: resolvedApiKey });

    const topicHierarchy = [topic, subtopic].filter(Boolean).join(" > ");
    const numQuestions = Math.max(1, Math.min(20, Number(count) || 5));

    const prompt = `তুমি একজন অভিজ্ঞ বিসিএস ও সরকারি চাকরি পরীক্ষার প্রশ্নপ্রণেতা।
তোমার কাজ হলো নিচের বিষয়/টপিকের উপর ভিত্তি করে ${numQuestions}টি মানসম্মত ও নির্ভুল বহুনির্বাচনী (MCQ) প্রশ্ন, ৪টি বিকল্প অপশন, সঠিক উত্তর এবং বিস্তারিত ব্যাখ্যা বাংলায় তৈরি করা।

বিষয় / টপিক: "${topicHierarchy}"
প্রশ্নের মান / লেভেল: "${difficulty}"
${contextText ? `\nঅনুচ্ছেদ / সহায়ক তথ্য (যদি থাকে):\n"""\n${contextText}\n"""\n` : ""}

নির্দেশনা:
১. প্রতিটি প্রশ্নের ৪টি করে অপশন (ক, খ, গ, ঘ) থাকবে।
২. একটিমাত্র সঠিক উত্তর থাকবে এবং সঠিক উত্তরের অপশন (ক / খ / গ / ঘ) স্পষ্ট থাকবে।
৩. প্রতিটি প্রশ্নের শেষে তথ্যবহুল, নির্ভুল ও শিক্ষণীয় ব্যাখ্যা থাকবে।
৪. প্রশ্নগুলো বাস্তব বিসিএস ও পিএসসি প্রিলিমিনারি পরীক্ষার প্যাটার্ন অনুযায়ী প্রণয়ন করবে।

আউটপুট ফরম্যাট অবশ্যই হুবহু নিচের কাঠামোর মতো হতে হবে (কোনো অপ্রয়োজনীয় ভূমিকা বা উপসংহার ছাড়াই):

# ${topicHierarchy}

১. [এখানে প্রশ্নের টেক্সট লিখুন]
ক) [অপশন ১]
খ) [অপশন ২]
গ) [অপশন ৩]
ঘ) [অপশন ৪]
উত্তর: [ক/খ/গ/ঘ]
ব্যাখ্যা: [বিস্তারিত ব্যাখ্যা লিখুন]

২. [দ্বিতীয় প্রশ্ন...]
...
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const generatedText = response.text || "";

    if (!generatedText.trim()) {
      return { success: false, error: "AI থেকে কোনো টেক্সট পাওয়া যায়নি।" };
    }

    // Parse generated text using existing parser
    const { parseBulkQuestionsText } = await import("@/lib/question-parser");
    const parsed = parseBulkQuestionsText(generatedText, topic, subtopic);

    if (parsed.validCount === 0) {
      return {
        success: false,
        error: "AI টেক্সট জেনারেট করেছে কিন্তু প্রশ্নগুলো সঠিকভাবে পার্স করা যায়নি।",
        data: {
          questions: [],
          solutions: [],
          rawText: generatedText,
          count: 0
        }
      };
    }

    return {
      success: true,
      data: {
        questions: parsed.questions,
        solutions: parsed.solutions,
        rawText: generatedText,
        count: parsed.validCount
      }
    };
  } catch (err: any) {
    console.error("AI MCQ Generation Error:", err);
    return {
      success: false,
      error: err?.message || "AI দিয়ে প্রশ্ন জেনারেট করতে সমস্যা হয়েছে।"
    };
  }
}
