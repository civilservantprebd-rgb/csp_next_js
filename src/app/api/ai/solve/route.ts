import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const solveSchema = z.object({
  solutions: z.array(z.object({
    tempId: z.string(),
    correct: z.number().min(0).max(3).describe("The index (0 to 3) of the absolutely correct option. 0=Ka, 1=Kha, 2=Ga, 3=Gha."),
    exp: z.string().describe("Detailed explanation of why this option is correct, and optionally why others are wrong.")
  }))
});

export const maxDuration = 60;`n`nexport async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questions, modelName } = body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "No questions provided" }, { status: 400 });
    }

    let model;
    if (modelName === "claude-3-5-sonnet") {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      model = anthropic("claude-3-5-sonnet-20240620");
    } else if (modelName.includes("gemini")) {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
      // Usually gemini-1.5-flash is used for validation
      model = google(`models/${modelName}`);
    } else if (modelName.includes("deepseek")) {
      const deepseek = createOpenAI({ 
        baseURL: "https://api.deepseek.com/v1", 
        apiKey: process.env.DEEPSEEK_API_KEY 
      });
      model = deepseek("deepseek-chat");
    } else {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      model = openai(modelName || "gpt-4o-mini");
    }

    const systemPrompt = `You are a highly intelligent BCS exam judge.
I will provide you with a list of multiple-choice questions (with options).
Your task is to independently identify the correct answer for each question and write a detailed explanation.
You must output in valid JSON matching the required schema. Do not wrap in markdown tags if possible.`;

    const promptText = JSON.stringify(
      questions.map(q => ({ tempId: q.tempId, question: q.q, options: q.opts })),
      null, 2
    );

    const { object } = await generateObject({
      model,

      system: systemPrompt,
      prompt: `Please solve the following questions:\n\n${promptText}`,
      schema: solveSchema,

 // Low temperature for factual accuracy
    });

    return NextResponse.json({ solutions: object.solutions });

  } catch (error: any) {
    console.error("AI Solve Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

