"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { toBengaliDigits, shuffleArray } from "@/lib/utils";

interface TopicExplorerHubProps {
  config: AppConfigData;
  onOpenEnrollModal?: (courseName?: string) => void;
}

export const TopicExplorerHub: React.FC<TopicExplorerHubProps> = ({ config, onOpenEnrollModal }) => {
  const tree = useMemo(() => {
    return buildDeepTopicTree(config);
  }, [config]);

  const [isPaidStudent, setIsPaidStudent] = useState(false);

  useEffect(() => {
    import("@/lib/student-auth").then(({ getLocalStudentUser }) => {
      const localUser = getLocalStudentUser();
      if (localUser) {
        import("@/actions/student-actions")
          .then(({ verifyStudentAccess }) => verifyStudentAccess(localUser.uid, "ALL", localUser.email))
          .then((res) => setIsPaidStudent(res.allowed))
          .catch(() => {
            // enrollment status is a display flag — the default (false) is safe
          });
      }
    });
  }, []);

  // Active Reading Modal State
  const [isReadingOpen, setIsReadingOpen] = useState(false);
  const [readingQuestions, setReadingQuestions] = useState<PracticeQuestion[]>([]);
  const [readingTitle, setReadingTitle] = useState("");
  const [isLoadingNode, setIsLoadingNode] = useState(false);

  // Active Quiz Modal State
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<PracticeQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState("");

  const handleLockedAction = () => {
    alert("🔒 এই অংশের প্রশ্ন পড়তে ও কুইজ দিতে কোর্সে এনরোল করতে হবে। অনুগ্রহ করে এনরোল করুন।");
    if (onOpenEnrollModal) {
      onOpenEnrollModal();
    } else if (typeof window !== "undefined") {
      window.location.href = "/#courses";
    }
  };

  // Open Reading Mode for specific subtopic or chapter path
  const handleOpenReading = async (fullPath: string, nodeName: string) => {
    if (!isPaidStudent) {
      handleLockedAction();
      return;
    }
    setIsLoadingNode(true);
    const { getLocalStudentUser } = await import("@/lib/student-auth");
    const localUser = getLocalStudentUser();
    const studentId = localUser?.uid || "";
    const studentEmail = localUser?.email || "";

    const { fetchTopicQuestionsForStudent } = await import("@/actions/student-actions");
    const res = await fetchTopicQuestionsForStudent(studentId, fullPath, studentEmail);

    setIsLoadingNode(false);
    if (!res.success || res.questions.length === 0) {
      alert(res.message || "এই অধ্যায়ে কোনো প্রশ্ন পাওয়া যায়নি।");
      return;
    }

    setReadingQuestions(res.questions);
    setReadingTitle(fullPath);
    setIsReadingOpen(true);
  };

  // Start instant quiz for specific subtopic path
  const handleStartNodeQuiz = async (fullPath: string, nodeName: string) => {
    if (!isPaidStudent) {
      handleLockedAction();
      return;
    }
    setIsLoadingNode(true);
    const { getLocalStudentUser } = await import("@/lib/student-auth");
    const localUser = getLocalStudentUser();
    const studentId = localUser?.uid || "";
    const studentEmail = localUser?.email || "";

    const { fetchTopicQuestionsForStudent } = await import("@/actions/student-actions");
    const res = await fetchTopicQuestionsForStudent(studentId, fullPath, studentEmail);

    setIsLoadingNode(false);
    if (!res.success || res.questions.length === 0) {
      alert(res.message || "এই অধ্যায়ে কোনো প্রশ্ন পাওয়া যায়নি।");
      return;
    }

    // Shuffle
    const shuffled = shuffleArray([...res.questions]);
    setQuizQuestions(shuffled.slice(0, Math.min(20, shuffled.length)));
    setQuizTitle(fullPath);
    setIsReadingOpen(false);
    setIsQuizOpen(true);
  };

  if (tree.length === 0) {
    return null;
  }

  return (
    <section className="font-bengali rounded-3xl p-5 sm:p-7 md:p-8 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 border-2 border-indigo-300 shadow-md shadow-indigo-100/50 ring-1 ring-indigo-200/30 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-indigo-100 pb-5 mb-6">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded-full border border-indigo-200">
                অধ্যায় ও সাব-টপিক রিডিং জোন
              </span>
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> বিষয়ভিত্তিক প্রস্তুতি
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1 tracking-tight">
              টপিক ও চ্যাপ্টার ভিত্তিক প্রশ্ন ব্যাংক
            </h3>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-white px-3.5 py-1.5 rounded-xl border border-indigo-100 shadow-sm self-start md:self-auto font-medium mt-1">
          📖 অধ্যায় ধরে ধরে প্রশ্ন পড়ুন অথবা সরাসরি কুইজ দিন
        </div>
      </div>

      {/* Recursive Multi-Level Topic Tree */}
      <TopicTreeViewer
        tree={tree}
        isLocked={!isPaidStudent}
        onLockedAction={handleLockedAction}
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
          const shuffled = shuffleArray([...readingQuestions]);
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
          const shuffled = shuffleArray([...quizQuestions]);
          setQuizQuestions(shuffled);
        }}
      />
    </section>
  );
};
