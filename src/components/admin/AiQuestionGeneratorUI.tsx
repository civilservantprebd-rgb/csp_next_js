"use client";

import React, { useState, useEffect } from "react";
import { Brain, Sparkles, Settings, RefreshCw, CheckCircle2, Play } from "lucide-react";
import { addBulkQuestionsToExam } from "@/actions/admin-actions";

import { Exam, FullQuestion } from "@/types/exam";

interface Props {
  exams: Record<string, Exam>;
  topics: string[];
}

export const AiQuestionGeneratorUI = ({ exams, topics }: Props) => {
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [topic, setTopic] = useState("");
  // Fixed target count for simplicity
  const [targetCount, setTargetCount] = useState(50);
  const [instructions, setInstructions] = useState("");
  
  const [generatorModel, setGeneratorModel] = useState("deepseek-chat");
  const [validatorModel1, setValidatorModel1] = useState("deepseek-chat");
  const [validatorModel2, setValidatorModel2] = useState("deepseek-chat");

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const [verifiedQuestions, setVerifiedQuestions] = useState<FullQuestion[]>([]);

  const courses = Array.from(new Set(Object.values(exams).map(ex => ex.course).filter(Boolean)));
  const filteredExams = Object.values(exams).filter(ex => !selectedCourse || ex.course === selectedCourse);

  const handleStart = async () => {
      if (!selectedExamId || !topic) return;
      
      setIsGenerating(true);
      setProgress(0);
      setVerifiedQuestions([]);
      
      let totalSaved = 0;
      let attempts = 0;
      const MAX_ATTEMPTS = 20; // Increased attempts in case of many duplicates
      
      try {
        while (totalSaved < targetCount && attempts < MAX_ATTEMPTS) {
          attempts++;
          const needed = targetCount - totalSaved;
          const batchSize = Math.min(needed, 10);
          
          setStatusText(`Generating ${batchSize} drafts with ${generatorModel}...`);
          const draftRes = await fetch("/api/ai/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              syllabus: topic,
              instructions,
              generatorModel,
              existingTopics: topics,
              count: batchSize
            })
          });
          
          const draftData = await draftRes.json();
          if (draftData.error) {
            console.error("Draft error:", draftData.error);
            setStatusText("Retrying due to model error...");
            continue;
          }
          
          const drafts = draftData.drafts || [];
          if (drafts.length === 0) continue;
          
          setStatusText(`Checking answers with ${validatorModel1}...`);
          const val1Res = await fetch("/api/ai/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questions: drafts, modelName: validatorModel1 })
          });
          const val1Data = await val1Res.json();
          
          setStatusText(`Checking answers with ${validatorModel2}...`);
          const val2Res = await fetch("/api/ai/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questions: drafts, modelName: validatorModel2 })
          });
          const val2Data = await val2Res.json();
          
          setStatusText("Comparing models and evaluating consensus...");
          
          const v1Sols = val1Data.solutions || [];
          const v2Sols = val2Data.solutions || [];
          
          let acceptedBatch: FullQuestion[] = [];
          
          // Consensus Check
          for (const d of drafts) {
            const s1 = v1Sols.find((s: any) => s.tempId === d.tempId);
            const s2 = v2Sols.find((s: any) => s.tempId === d.tempId);
            
            if (s1 && s2 && s1.correct === s2.correct) {
              acceptedBatch.push({
                q: d.q,
                opts: d.opts,
                correct: s1.correct,
                exp: s1.exp,
                topic: d.topic
              });
            }
          }
          
          if (acceptedBatch.length > 0) {
            setStatusText("Saving valid questions to database...");
            const newQuestions = acceptedBatch.map(a => ({ q: a.q, opts: a.opts, topic: a.topic }));
            const newSolutions = acceptedBatch.map(a => ({ correct: a.correct, exp: a.exp }));
            const res = await addBulkQuestionsToExam(selectedExamId, newQuestions, newSolutions);
            
            if (res && res.success) {
              totalSaved += res.count; // Only increment by the successfully saved non-duplicate amount
              
              setVerifiedQuestions(prev => [...prev, ...(res.insertedQuestions || []) as any]); // Just for visual UI, we can show them
              setProgress(Math.floor((totalSaved / targetCount) * 100));
            } else {
              console.error("Save Error:", res);
              setStatusText("Retrying due to save error...");
            }
          }
        }
        
        setStatusText(`Successfully finished! Saved ${totalSaved} questions. Reloading...`);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        
      } catch (err: any) {
        console.error(err);
        setStatusText("Fatal Error: " + err.message);
        setIsGenerating(false);
      }
    };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
          <Brain className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Question Generator</h2>
          <p className="text-sm text-slate-500">Auto-generate verified questions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left Column: Input Settings */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">1. Select Course</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-sm"
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSelectedExamId(""); // reset exam when course changes
              }}
            >
              <option value="">-- All Courses --</option>
              {courses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">2. Target Exam (Where to add questions)</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-sm"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={filteredExams.length === 0}
            >
              <option value="">-- Select an Exam --</option>
              {filteredExams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.subject} - {ex.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Topic / Syllabus</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="e.g. History of Bengal (Ancient to 1947)..."
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">বিশেষ নির্দেশনা (প্রম্পট)</label>
              <textarea
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                placeholder="যেমন: সাম্প্রতিক তথ্য যোগ করুন, অথবা কেবল মুক্তিযুদ্ধ নিয়ে প্রশ্ন বানান..."
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Question Count</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              min={5}
              max={200}
            />
          </div>
        </div>

        {/* Right Column: Model Selection */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-slate-500" />
            Model Configuration
          </h3>
          
          <div>
            <label className="block text-xs font-semibold text-indigo-600 mb-1">Generator Model (Creates Questions)</label>
            <select 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              value={generatorModel}
              onChange={(e) => setGeneratorModel(e.target.value)}
            >
              <option value="deepseek-chat">DeepSeek V3 (Best Value)</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-600 mb-1">Validator Model 1 (Checks Accuracy)</label>
            <select 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              value={validatorModel1}
              onChange={(e) => setValidatorModel1(e.target.value)}
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast & Cheap)</option>
              <option value="gpt-4o-mini">GPT-4o-mini</option>
              <option value="deepseek-chat">DeepSeek</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-600 mb-1">Validator Model 2 (Checks Accuracy)</label>
            <select 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              value={validatorModel2}
              onChange={(e) => setValidatorModel2(e.target.value)}
            >
              <option value="gpt-4o-mini">GPT-4o-mini (Fast & Cheap)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="deepseek-chat">DeepSeek</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6">
        {isGenerating ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                {statusText}
              </span>
              <span>{verifiedQuestions.length} / {targetCount} Validated</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div 
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, (verifiedQuestions.length / targetCount) * 100))}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Please do not close this window.
            </p>
          </div>
        ) : (
          <button
            onClick={handleStart}
            disabled={!selectedExamId || !topic}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            Start Generating
          </button>
        )}
      </div>
    </div>
  );
};
