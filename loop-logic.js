const fs = require('fs');

let code = fs.readFileSync('src/actions/ai-actions.ts', 'utf8');

// The replacement logic:
const newFunction = `export async function generateMCQWithAI(params: {
  topic: string;
  subtopic?: string;
  count?: number;
  difficulty?: "সহজ" | "মাঝারি" | "কঠিন" | "বিসিএস স্ট্যান্ডার্ড";
  contextText?: string;
  customInstruction?: string;
  apiKey?: string;
  examId?: string; // NEW PARAMETER
}): Promise<{ success: boolean; data?: GeneratedMCQResult; error?: string }> {
  try {
    const { requireTeacher } = await import("@/lib/teacher-auth");
    await requireTeacher();

    const { topic, subtopic, count = 5, difficulty = "বিসিএস স্ট্যান্ডার্ড", contextText, customInstruction, examId } = params;
    const resolvedApiKey = process.env.GEMINI_API_KEY || "";

    if (!resolvedApiKey) {
      return { success: false, error: "Gemini API Key missing" };
    }

    const ai = new GoogleGenAI({ apiKey: resolvedApiKey });
    const topicHierarchy = [topic, subtopic].filter(Boolean).join(" > ");
    const targetCount = Math.max(1, Math.min(20, Number(count) || 5));

    // Fetch existing questions to avoid duplicates
    const existingSet = new Set<string>();
    if (examId) {
      const { supabase } = await import("@/lib/supabase-server");
      const { data: existingLinks } = await supabase()
        .from("exam_questions_link")
        .select("question_bank(q)")
        .eq("exam_id", examId);
      (existingLinks || []).forEach((l: any) => {
        const qb = Array.isArray(l.question_bank) ? l.question_bank[0] : l.question_bank;
        if (qb?.q) existingSet.add(String(qb.q).trim().toLowerCase());
      });
    }

    let allQuestions: QuestionItem[] = [];
    let allSolutions: QuestionSolution[] = [];
    let allRawText = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (allQuestions.length < targetCount && attempts < MAX_ATTEMPTS) {
      attempts++;
      const needed = targetCount - allQuestions.length;

      const prompt = \`আপনি একজন বিসিএস ক্যাডার ও বিশেষজ্ঞ।
আপনাকে ঠিক \${needed}টি নতুন ও সম্পূর্ণ ইউনিক (MCQ) প্রশ্ন তৈরি করতে হবে, যা আগে কখনো দেওয়া হয়নি।

টপিক: "\${topicHierarchy}"
কাঠিন্য: "\${difficulty}"
\${contextText ? \`\\nকনটেক্সট:\\n"""\\n\${contextText}\\n"""\\n\` : ""}
\${customInstruction ? \`\\nবিশেষ নির্দেশনা:\\n"""\\n\${customInstruction}\\n"""\\n\` : ""}

শর্তাবলী:
১. প্রতিটি প্রশ্নের ঠিক ৪টি অপশন (ক, খ, গ, ঘ) থাকবে।
২. সঠিক উত্তরটি অপশনের (ক / খ / গ / ঘ) অক্ষর দিয়ে উল্লেখ করুন।
৩. প্রতিটি প্রশ্নের একটি তথ্যবহুল ব্যাখ্যা দিন।
৪. প্রশ্নগুলো যেন বিসিএস স্ট্যান্ডার্ড হয়।

ফরম্যাট (মার্কডাউন):
# \${topicHierarchy}

১. [এখানে প্রশ্ন]
ক) [অপশন ১]
খ) [অপশন ২]
গ) [অপশন ৩]
ঘ) [অপশন ৪]
উত্তর: [ক/খ/গ/ঘ]
ব্যাখ্যা: [সঠিক উত্তরের ব্যাখ্যা]

২. [দ্বিতীয় প্রশ্ন]...
\`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const generatedText = response.text || "";
      if (!generatedText.trim()) continue;

      allRawText += "\\n\\n" + generatedText;

      const { parseBulkQuestionsText } = await import("@/lib/question-parser");
      const parsed = parseBulkQuestionsText(generatedText, topic, subtopic);

      parsed.questions.forEach((q, idx) => {
        const key = String(q.q || "").trim().toLowerCase();
        if (key && !existingSet.has(key)) {
          existingSet.add(key);
          allQuestions.push(q);
          allSolutions.push(parsed.solutions[idx]);
        }
      });
    }

    if (allQuestions.length === 0) {
      return {
        success: false,
        error: "AI কোনো সঠিক ফরম্যাটের নতুন প্রশ্ন তৈরি করতে পারেনি।",
        data: { questions: [], solutions: [], rawText: allRawText, count: 0 }
      };
    }

    // Limit to exactly the requested count in case it generated too many
    allQuestions = allQuestions.slice(0, targetCount);
    allSolutions = allSolutions.slice(0, targetCount);

    return {
      success: true,
      data: {
        questions: allQuestions,
        solutions: allSolutions,
        rawText: allRawText,
        count: allQuestions.length
      }
    };
  } catch (err: any) {
    console.error("AI MCQ Generation Error:", err);
    return { success: false, error: err?.message || "Generation error" };
  }
}`;

const oldFuncRegex = /export async function generateMCQWithAI[\s\S]*?\}\s*catch\s*\(err:\s*any\)\s*\{[\s\S]*?\}\s*\}/;

if (oldFuncRegex.test(code)) {
    code = code.replace(oldFuncRegex, newFunction);
    fs.writeFileSync('src/actions/ai-actions.ts', code, 'utf8');
    console.log("Updated generateMCQWithAI to support looping and deduplication");
} else {
    console.log("Regex didn't match.");
}
