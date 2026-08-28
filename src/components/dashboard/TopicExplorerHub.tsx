"use client";

import React, { useState, useMemo } from "react";
import {
  FolderTree,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  Zap,
  Play,
  HelpCircle,
  Loader2,
  Bookmark
} from "lucide-react";
import { AppConfigData } from "@/types/exam";
import {
  buildDeepTopicTree,
  getQuestionsForPath,
  TreeNode
} from "@/lib/topic-hierarchy";
import { PracticeQuestion } from "@/lib/practice-helper";
import { TopicReadingModal } from "@/components/modals/TopicReadingModal";
import { SelfPracticeModal } from "@/components/modals/SelfPracticeModal";
import { TopicTreeViewer } from "@/components/dashboard/TopicTreeViewer";
import { toBengaliDigits } from "@/lib/utils";

interface TopicExplorerHubProps {
  config: AppConfigData;
}

export const TopicExplorerHub: React.FC<TopicExplorerHubProps> = ({ config }) => {
  const tree = useMemo(() => {
    return buildDeepTopicTree(config);
  }, [config]);

  // Active Reading Modal State
  const [isReadingOpen, setIsReadingOpen] = useState(false);
  const [readingQuestions, setReadingQuestions] = useState<PracticeQuestion[]>([]);
  const [readingTitle, setReadingTitle] = useState("");
  const [isLoadingNode, setIsLoadingNode] = useState(false);

  // Active Quiz Modal State
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<PracticeQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState("");

  // Open Reading Mode for specific subtopic or chapter path
  const handleOpenReading = async (fullPath: string, nodeName: string) => {
    setIsLoadingNode(true);
    const qs = await getQuestionsForPath(config, fullPath);

    setReadingQuestions(qs);
    setReadingTitle(fullPath);
    setIsLoadingNode(false);
    setIsReadingOpen(true);
  };

  // Start instant quiz for specific subtopic path
  const handleStartNodeQuiz = async (fullPath: string, nodeName: string) => {
    setIsLoadingNode(true);
    const qs = await getQuestionsForPath(config, fullPath);

    // Shuffle
    const shuffled = [...qs].sort(() => 0.5 - Math.random());
    setQuizQuestions(shuffled.slice(0, Math.min(20, shuffled.length)));
    setQuizTitle(fullPath);
    setIsLoadingNode(false);
    setIsReadingOpen(false);
    setIsQuizOpen(true);
  };

  if (tree.length === 0) {
    return null;
  }

  return (
    <section className="font-bengali rounded-3xl p-5 sm:p-7 md:p-8 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 border-2 border-indigo-300 shadow-md shadow-indigo-100/50 ring-1 ring-indigo-200/30 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100 pb-5 mb-6">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded-full border border-indigo-200">
                অধ্যায় ও সাব-টপিক রিডিং জোন
              </span>
              <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> বিষয়ভিত্তিক প্রস্তুতি
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1 tracking-tight">
              টপিক ও চ্যাপ্টার ভিত্তিক প্রশ্ন ব্যাংক
            </h3>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-white px-3.5 py-1.5 rounded-xl border border-indigo-100 shadow-2xs self-start md:self-auto font-medium">
          📖 অধ্যায় ধরে ধরে প্রশ্ন পড়ুন অথবা সরাসরি কুইজ দিন
        </div>
      </div>

      {/* Recursive Multi-Level Topic Tree */}
      <TopicTreeViewer
        tree={tree}
        onOpenReading={handleOpenReading}
        onStartQuiz={handleStartNodeQuiz}
      />

      {/* Reading Mode Modal */}
      <TopicReadingModal
        isOpen={isReadingOpen}
        onClose={() => setIsReadingOpen(false)}
        questions={readingQuestions}
        title={readingTitle}
        onStartQuiz={() => {
          const shuffled = [...readingQuestions].sort(() => 0.5 - Math.random());
          setQuizQuestions(shuffled.slice(0, Math.min(20, shuffled.length)));
          setQuizTitle(readingTitle);
          setIsReadingOpen(false);
          setIsQuizOpen(true);
        }}
      />

      {/* Quiz Session Modal */}
      <SelfPracticeModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        questions={quizQuestions}
        subjectName={quizTitle}
        mode="instant"
        onRestart={() => {
          const shuffled = [...quizQuestions].sort(() => 0.5 - Math.random());
          setQuizQuestions(shuffled);
        }}
      />
    </section>
  );
};
