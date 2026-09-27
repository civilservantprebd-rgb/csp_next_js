import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const questionSchema = z.object({
  questions: z.array(z.object({
    q: z.string().describe("The main multiple-choice question."),
    opts: z.array(z.string()).length(4).describe("Exactly 4 options for the question."),
    topic: z.string().describe("The selected topic/subtopic exactly from the provided list. Choose the deepest/most specific node.")
  }))
});

function calculateSimilarity(str1: string, str2: string) {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple word overlap
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  let intersection = 0;
  words1.forEach(w => { if (words2.has(w)) intersection++; });
  const union = words1.size + words2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { syllabus, instructions, generatorModel, existingTopics, count = 10 } = body;

    if (!syllabus) {
      return NextResponse.json({ error: "Syllabus is required" }, { status: 400 });
    }

    let model;
    if (generatorModel === "claude-3-5-sonnet") {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      model = anthropic("claude-3-5-sonnet-20240620");
    } else if (generatorModel.includes("gemini")) {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
      model = google("models/gemini-1.5-pro-latest");
    } else if (generatorModel.includes("deepseek")) {
      const deepseek = createOpenAI({ 
        baseURL: "https://api.deepseek.com/v1", 
        apiKey: process.env.DEEPSEEK_API_KEY 
      });
      model = deepseek("deepseek-chat");
    } else {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      model = openai("gpt-4o-2024-05-13");
    }

    const systemPrompt = `You are an expert exam question generator for the BCS (Bangladesh Civil Service) exam.
Your task is to generate exactly ${count} highly standard multiple-choice questions based on the provided syllabus.

CRITICAL INSTRUCTIONS:
1. Generate ONLY the question and 4 options. DO NOT provide the answer or explanation.
2. ${instructions}
3. You MUST classify each question under one of the provided existing topics.
4. If a topic has subtopics (e.g., "A > B > C"), you MUST select the deepest/most specific node (e.g., "A > B > C"). Do NOT invent new topics.
5. You must output in valid JSON matching the required schema. Do not wrap in markdown tags if possible.

AVAILABLE EXACT TOPICS:
${existingTopics.join("\n")}
`;

    const { object } = await generateObject({
      model,

      system: systemPrompt,
      prompt: `Generate ${count} questions based on this syllabus/context:\n\n${syllabus}`,
      schema: questionSchema,


    });

    const draftQuestions = object.questions;

    // TARGETED DB FETCH: Get existing questions ONLY for the assigned topics
    const assignedTopics = Array.from(new Set(draftQuestions.map(q => q.topic)));
    
    let existingQuestions: any[] = [];
    if (assignedTopics.length > 0) {
      const [qbRes, tqRes] = await Promise.all([
        supabase.from("question_bank").select("q").in("topic", assignedTopics),
        supabase.from("topic_questions").select("q").in("topic", assignedTopics)
      ]);
      
      existingQuestions = [
        ...(qbRes.data || []),
        ...(tqRes.data || [])
      ].map(r => r.q);
    }

    // FILTER DUPLICATES & SHUFFLE
    const uniqueDrafts = [];
    
    for (const draft of draftQuestions) {
      // Check similarity
      let isDuplicate = false;
      for (const eq of existingQuestions) {
        if (calculateSimilarity(draft.q, eq) > 0.75) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        // Shuffle options completely
        const shuffledOpts = [...draft.opts];
        for (let i = shuffledOpts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledOpts[i], shuffledOpts[j]] = [shuffledOpts[j], shuffledOpts[i]];
        }
        
        uniqueDrafts.push({
          q: draft.q,
          opts: shuffledOpts,
          topic: draft.topic,
          tempId: Math.random().toString(36).substring(7) // assign a temporary ID for tracking
        });
      }
    }

    return NextResponse.json({ 
      drafts: uniqueDrafts, 
      generatedCount: draftQuestions.length, 
      duplicateCount: draftQuestions.length - uniqueDrafts.length 
    });

  } catch (error: any) {
    console.error("AI Draft Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
