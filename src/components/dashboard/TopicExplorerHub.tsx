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
  buildTopicHierarchyTree,
  getQuestionsForHierarchyNode,
  HierarchicalSubject,
  HierarchicalTopic
} from "@/lib/topic-hierarchy";
import { PracticeQuestion } from "@/lib/practice-helper";
import { TopicReadingModal } from "@/components/modals/TopicReadingModal";
import { SelfPracticeModal } from "@/components/modals/SelfPracticeModal";
import { toBengaliDigits } from "@/lib/utils";

interface TopicExplorerHubProps {
  config: AppConfigData;
}

export const TopicExplorerHub: React.FC<TopicExplorerHubProps> = ({ config }) => {
  const tree = useMemo(() => {
    return buildTopicHierarchyTree(config);
  }, [config]);

  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Active Reading Modal State
  const [isReadingOpen, setIsReadingOpen] = useState(false);
  const [readingQuestions, setReadingQuestions] = useState<PracticeQuestion[]>([]);
  const [readingTitle, setReadingTitle] = useState("");
  const [isLoadingNode, setIsLoadingNode] = useState(false);

  // Active Quiz Modal State
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<PracticeQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState("");

  const toggleSubject = (subjectName: string) => {
    setExpandedSubjects((prev) => ({ ...prev, [subjectName]: !prev[subjectName] }));
  };

  const toggleTopic = (topicKey: string) => {
    setExpandedTopics((prev) => ({ ...prev, [topicKey]: !prev[topicKey] }));
  };

  // Open Reading Mode for specific subtopic or chapter
  const handleOpenReading = async (subject: string, topic?: string, subtopic?: string) => {
    setIsLoadingNode(true);
    const qs = await getQuestionsForHierarchyNode(config, {
      subject,
      topic,
      subtopic
    });

    const displayTitle = subtopic && subtopic !== "মূল অধ্যায়"
      ? `${topic || subject} ❯ ${subtopic}`
      : (topic || subject);

    setReadingQuestions(qs);
    setReadingTitle(displayTitle);
    setIsLoadingNode(false);
    setIsReadingOpen(true);
  };

  // Start instant quiz for specific subtopic
  const handleStartNodeQuiz = async (subject: string, topic?: string, subtopic?: string) => {
    setIsLoadingNode(true);
    const qs = await getQuestionsForHierarchyNode(config, {
      subject,
      topic,
      subtopic
    });

    const displayTitle = subtopic && subtopic !== "মূল অধ্যায়"
      ? `${topic || subject} ❯ ${subtopic}`
      : (topic || subject);

    // Shuffle
    const shuffled = [...qs].sort(() => 0.5 - Math.random());
    setQuizQuestions(shuffled.slice(0, Math.min(20, shuffled.length)));
    setQuizTitle(displayTitle);
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

      {/* Hierarchical Accordion View */}
      <div className="space-y-3">
        {tree.map((subjectItem) => {
          const isSubjExpanded = expandedSubjects[subjectItem.name] ?? false;

          return (
            <div
              key={subjectItem.name}
              className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs transition"
            >
              {/* Level 1: Subject Bar */}
              <div
                onClick={() => toggleSubject(subjectItem.name)}
                className="p-4 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between gap-3 cursor-pointer select-none transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm sm:text-base">
                      {subjectItem.name}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold bg-white text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {toBengaliDigits(subjectItem.count)}টি প্রশ্ন
                  </span>
                  <div className="text-slate-400">
                    {isSubjExpanded ? (
                      <ChevronDown className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Level 2: Chapters / Topics List */}
              {isSubjExpanded && (
                <div className="p-3 sm:p-4 bg-white space-y-2.5 border-t border-slate-100">
                  {subjectItem.topics.map((topicItem) => {
                    const topicKey = `${subjectItem.name}_${topicItem.name}`;
                    const isTopicExpanded = expandedTopics[topicKey] ?? true;

                    return (
                      <div
                        key={topicItem.name}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            onClick={() => toggleTopic(topicKey)}
                            className="flex items-center gap-2 cursor-pointer select-none"
                          >
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="font-bold text-xs sm:text-sm text-slate-800 hover:text-indigo-600 transition">
                              {topicItem.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              ({toBengaliDigits(topicItem.count)})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReading(subjectItem.name, topicItem.name)}
                              className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>পড়ুন</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartNodeQuiz(subjectItem.name, topicItem.name)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                            >
                              <Zap className="w-3 h-3 fill-white" />
                              <span>কুইজ</span>
                            </button>
                          </div>
                        </div>

                        {/* Level 3: Subtopics Chips / Pills */}
                        {isTopicExpanded && topicItem.subtopics.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-slate-200/50">
                            {topicItem.subtopics.map((sub) => (
                              <div
                                key={sub.name}
                                className="bg-white p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 flex items-center justify-between gap-2 shadow-2xs transition"
                              >
                                <div className="truncate text-xs">
                                  <span className="font-bold text-slate-800 truncate block">
                                    {sub.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {toBengaliDigits(sub.count)}টি প্রশ্ন
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReading(subjectItem.name, topicItem.name, sub.name)}
                                    className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                    title="পড়ুন"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartNodeQuiz(subjectItem.name, topicItem.name, sub.name)}
                                    className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                    title="কুইজ দিন"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
