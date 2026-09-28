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

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { syllabus, instructions, generatorModel, existingTopics, count = 10, ragTopic, existingQuestions = [] } = body;

    let finalSyllabus = syllabus || ragTopic;
    if (!finalSyllabus) {
      
    return NextResponse.json({ error: "Syllabus is required" }, { status: 400 });
    }

    let model;
    if (generatorModel === "claude-3-5-sonnet") {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      model = anthropic("claude-3-5-sonnet-20240620");
    } else if (generatorModel.includes("gemini")) {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
      model = google(`models/${generatorModel}`);
    } else if (generatorModel.includes("deepseek")) {
      const deepseek = createOpenAI({ 
        baseURL: "https://api.deepseek.com/v1", 
        apiKey: process.env.DEEPSEEK_API_KEY 
      });
      model = deepseek(generatorModel);
    } else {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      model = openai(generatorModel);
    }

    const systemPrompt = `You are an elite subject matter expert and examiner for the BCS (Bangladesh Civil Service) exam.\nYour task is to generate exactly ${count} highly standard, unique, and slightly above-basic level (medium to hard) multiple-choice questions based on the provided syllabus.\n\nCRITICAL INSTRUCTIONS:\n1. Generate highly creative and deep questions. DO NOT generate basic, commonly known, or generic questions (as they already exist in the database and will be rejected).\n2. Generate ONLY the question and 4 options. DO NOT provide the answer or explanation here.\n3. ${instructions}\n4. You MUST classify each question under one of the provided existing topics. Select the deepest/most specific node. Do NOT invent new topics.\n5. You must output in valid JSON matching the required schema. Do not wrap in markdown tags if possible.\n\nAVAILABLE EXACT TOPICS:\n${existingTopics.join('\n')}\n`;

      
      let ragReference = "";
      try {
        const { data: allMasterQs } = await supabase
          .from("question_bank")
          .select("q, opts")
          .eq("topic", ragTopic || syllabus)
          .eq("is_master", true)
          .limit(100);
          
        if (allMasterQs && allMasterQs.length > 0) {
          const shuffled = allMasterQs.sort(() => 0.5 - Math.random());
          const selectedQs = shuffled.slice(0, 5);
          ragReference = '\n\n=== MASTER REFERENCE QUESTIONS ===\n(Use these to understand the required standard/complexity. DO NOT COPY them):\n' +
            selectedQs.map((mq, i) => `Q${i+1}: ${mq.q}\nOptions: ${mq.opts.join(" | ")}`).join("\n\n");
        }
      } catch(e) {}
      
      const finalSystemPrompt = systemPrompt + ragReference;
      
      const { object } = await generateObject({
      abortSignal: AbortSignal.timeout(60000),
      model,

      system: finalSystemPrompt,
      prompt: `Generate ${count} questions based on this syllabus/context:\n\n${syllabus}`,
      schema: questionSchema, temperature: 0.9,


    });

    const draftQuestions = object.questions;

    let allExisting = [...existingQuestions];

    // FILTER DUPLICATES & SHUFFLE
    const uniqueDrafts = [];
    
    for (const draft of draftQuestions) {
      // Check similarity
      let isDuplicate = false;
      for (const eq of allExisting) {
        if (calculateSimilarity(draft.q, eq) > 0.85) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        allExisting.push(draft.q); // Add to local list to prevent repeats within the same batch
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

