"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Play,
  Loader2,
  Lock,
  LogIn,
  ShoppingCart,
  Layers,
  ChevronRight,
  ChevronDown,
  Check,
  RotateCcw,
  BookOpen
} from "lucide-react";
import { getPracticeTopics, getPracticeQuestions } from "@/actions/practice-actions";
import { verifyTeacherSession } from "@/actions/admin-actions";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";
import type { TopicOption } from "@/lib/practice-helper";
import { buildTopicCountMap, buildTopicGroupTree, colorFor, pruneEmptyNodes, type HubNode } from "@/lib/topic-group";
import { LoadingState } from "@/components/shared/LoadingState";
import { toBengaliDigits } from "@/lib/utils";
import { useRouter } from "next/navigation";


/**
 * সেলফ প্র্যাকটিস হাব — Live MCQ-স্টাইলের টপিক-গ্রুপ কার্ড গ্রিড।
 *
 * নিয়ম (সার্ভার-অ্যাকশনে ইতোমধ্যে কার্যকর, এখানে শুধু UI):
 *  ১. যেকোনো একটি কোর্সে এনরোল্ড (বা শিক্ষক) থাকলেই সব টপিক-গ্রুপের সব প্রশ্ন
 *     প্র্যাকটিসযোগ্য — কোর্স-স্কোপ ফিল্টার নেই। এনরোলমেন্ট ছাড়া গেটে আটকে যায়।
 *  ২. নির্ধারিত (লাইভ) পরীক্ষার প্রশ্ন ফলাফল-সময়ের আগে কখনো দেখানো/গোনা হয় না;
 *     লাইভ শেষ (endTime + grace) হলে সেগুলো স্বয়ংক্রিয়ভাবে এখানে যুক্ত হয়।
 *
 * কার্যকারিতা অপরিবর্তিত: টপিক/গ্রুপ নির্বাচন → প্রশ্নসংখ্যা (১০/২০/৩০/৫০) →
 * ইনস্ট্যান্ট/মক মোড → /practice/session (আলাদা উইন্ডো/ট্যাব)।
 */

interface PracticeHubProps {
  onOpenEnrollModal?: () => void;
}

const ALL_LABEL = "সকল টপিক (মিক্সড)";
const QUESTION_COUNTS = [10, 20, 30, 50];

export const PracticeHub: React.FC<PracticeHubProps> = ({ onOpenEnrollModal }) => {
  const [phase, setPhase] = useState<"loading" | "guest" | "locked" | "hub">("loading");
  const [accessError, setAccessError] = useState("");
  const [topics, setTopics] = useState<TopicOption[] | null>(null);
  const [topicMap, setTopicMap] = useState<Record<string, number>>({});
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const router = useRouter();
  const [refreshTick, setRefreshTick] = useState(0);

  // হাব স্টেট
  const [selectedTopic, setSelectedTopic] = useState(ALL_LABEL);
  const [activeGroupPath, setActiveGroupPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [selectedCount, setSelectedCount] = useState(10);
  const [practiceMode, setPracticeMode] = useState<"instant" | "exam">("instant");
  const [isStarting, setIsStarting] = useState(false);
  // গ্রুপ-ট্যাপের স্ক্রল effect আবার চালানোর জন্য (একই গ্রুপে বারবার ট্যাপ)
  const [scrollTick, setScrollTick] = useState(0);
  const detailRef = useRef<HTMLDivElement | null>(null);
  // "প্রশ্নের সংখ্যা / মোড / প্র্যাকটিস শুরু করুন" সেকশন — টপিক বাছলেই এখানে নিয়ে আসি
  const configRef = useRef<HTMLDivElement | null>(null);
  // টপিক-লোড করার সময় যেই পরিচয়ে অ্যাক্সেস মিলেছে — সেটাই পরে প্রি-ফেচে ব্যবহার করি
  const identityRef = useRef<{ id: string; email: string }>({ id: "", email: "" });

  // ০-প্রশ্ন গ্রুপ বাদ — যা দেখা যায়, তাতে ট্যাপ করলে প্রশ্ন পাওয়া নিশ্চিত
  // (আগে খালি গ্রুপে ঢুকে "প্রশ্ন নেই" দেখাত)।
  const rawTree = useMemo(() => buildTopicGroupTree(topics || []), [topics]);
  const tree = useMemo(() => pruneEmptyNodes(rawTree), [rawTree]);
  const hiddenGroups = rawTree.length - tree.length;
  const countMap = useMemo(() => buildTopicCountMap(tree), [tree]);
  const totalCount = useMemo(() => tree.reduce((s, n) => s + n.count, 0), [tree]);
  const hasNested = useMemo(() => tree.some((n) => n.children.length > 0), [tree]);

  const loadTopics = async (id: string, email: string) => {
    identityRef.current = { id, email };
    try {
      const t = await getPracticeTopics(id, email);
      setTopics(t || []);
      setTopicsError("");
    } catch {
      setTopics([]);
      setTopicsError("টপিক তালিকা লোড করা যায়নি। নিচের 'আবার চেষ্টা করুন' বাটনে চাপুন।");
    }
    setPhase("hub");
  };

  // অ্যাক্সেস যাচাই: শিক্ষক সরাসরি; শিক্ষার্থী → যেকোনো একটি কোর্সে এনরোল্ড কিনা।
  // Google uid/email-এ না মিললে আগে যাচাই-কৃত (ফোন/ম্যানুয়াল) পরিচয় দিয়ে চেষ্টা।
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = getLocalStudentUser();
      if (!u) {
        if (!cancelled) setPhase("guest");
        return;
      }
      setAccessError("");
      try {
        // PERF: শিক্ষক-যাচাই আর এনরোলমেন্ট-ক্যাশ — দুটোই কখনো সার্ভার-কল হয়,
        // তাই একসাথে চালাই। আগে সিরিয়ালে বসত, ফলে হাব খুলতে দুটো রাউন্ড-ট্রিপ
        // পিছনে পিছনে লাগত (~৪০০ms শুধু অপেক্ষা)।
        const { checkEnrollmentCached } = await import("@/lib/access-cache");
        const [teacher, g] = await Promise.all([
          verifyTeacherSession(),
          checkEnrollmentCached(u.uid, u.email)
        ]);
        if (teacher.ok) {
          if (!cancelled) setPhase("hub");
          if (!cancelled) loadTopics(u.uid, u.email || "");
          return;
        }
        let allowed = g.allowed;
        let effId = u.uid;
        let effEmail = u.email || "";
        if (!allowed) {
          const { getVerifiedStudent } = await import("@/lib/student-identity");
          const verified = getVerifiedStudent();
          if (verified && verified.id && verified.id !== u.uid) {
            const alt = await checkEnrollmentCached(verified.id, verified.email);
            if (alt.allowed) {
              allowed = true;
              effId = verified.id;
              effEmail = verified.email || "";
            }
          }
        }
        if (!allowed) {
          if (!cancelled) setPhase("locked");
          return;
        }
        if (!cancelled) setPhase("hub");
        if (!cancelled) loadTopics(effId, effEmail);
      } catch {
        if (!cancelled) {
          setAccessError("এক্সেস যাচাই করা যায়নি। নেটওয়ার্ক ঠিক আছে কি না দেখে আবার চেষ্টা করুন।");
          setPhase("locked");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const openEnroll = () => {
    if (onOpenEnrollModal) {
      onOpenEnrollModal();
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("open_enroll", "1");
      window.location.href = "/";
    }
  };

  const selectNode = (fullPath: string) => {
    setSelectedTopic(fullPath);
    // এক ট্যাপেই ফ্লো শেষ: টপিক বাছলেই নিচের "প্রশ্নের সংখ্যা / মোড / শুরু করুন"
    // সেকশনে চলে যাই — ব্যবহারকারীকে হাতে স্ক্রল করতে হয় না।
    scrollToConfig();
  };

  /** পরের ফ্রেমে (DOM হালনাগাদের পরে) কোনো সেকশনে smooth স্ক্রল */
  const scrollToRef = (ref: React.RefObject<HTMLElement | null>) => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    );
  };

  const scrollToConfig = () => scrollToRef(configRef);

  const openGroup = (node: HubNode) => {
    setActiveGroupPath(node.fullPath);
    setSelectedTopic(node.fullPath); // পুরো গ্রুপ ডিফল্ট টার্গেট
    // একই গ্রুপে আবার ট্যাপ করলেও যেন আবার নিচে নামে (নিচের effect-এর নির্ভরতা
    // বদলানোর জন্য টিক বাড়াই — path একই থাকলে effect আর চলত না)।
    setScrollTick((t) => t + 1);
    // গ্রুপে সাব-টপিক নেই → বাছাই শেষ, সোজা কনফিগ সেকশনে যাই।
    // সাব-টপিক থাকলে নিচের সেকশনটা রেন্ডার হওয়ার পরে effect থেকে স্ক্রল হবে
    // (এখানে সাথে সাথে ডাকলে DOM তখনো তৈরি হয়নি — এটাই আগের "দুই ট্যাপ" বাগ)।
    if (!node.children || node.children.length === 0) scrollToConfig();
  };

  const backToGroups = () => {
    setActiveGroupPath(null);
  };

  /**
   * গ্রুপে ট্যাপ করার পর সাব-টপিক সেকশনে স্মুথ স্ক্রল।
   *
   * ⚠️ কেন effect-এ: ওই সেকশনটা `activeGroupPath` সেট হওয়ার **পরে** রেন্ডার হয়।
   * আগে `openGroup`-এর ভেতরে সাথে সাথে `scrollIntoView` ডাকা হত — তখন DOM-এ
   * সেকশনটাই ছিল না, তাই প্রথম ট্যাপে কিছুই হত না আর ব্যবহারকারীকে হাতে স্ক্রল
   * করে আবার ট্যাপ করতে হত ("দুই ট্যাপ" সমস্যা)।
   */
  useEffect(() => {
    if (!activeGroupPath) return;
    const node = activeGroupPath;
    const t = setTimeout(() => {
      if (node) scrollToRef(detailRef);
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupPath, scrollTick]);

  const toggleExpand = (fullPath: string) => {
    setExpandedPaths((prev) => ({ ...prev, [fullPath]: !prev[fullPath] }));
  };

  const activeGroupNode = useMemo(() => {
    if (!activeGroupPath) return null;
    const walk = (nodes: HubNode[]): HubNode | null => {
      for (const n of nodes) {
        if (n.fullPath === activeGroupPath) return n;
        const found = walk(n.children);
        if (found) return found;
      }
      return null;
    };
    return walk(tree);
  }, [tree, activeGroupPath]);

  const availableForSelection = useMemo(() => {
    if (selectedTopic === ALL_LABEL) return totalCount;
    return countMap.get(selectedTopic) ?? 0;
  }, [selectedTopic, countMap, totalCount]);

  const canStart = availableForSelection > 0 && phase === "hub";

  const handleStartPractice = () => {
    if (!canStart) return;
    const params = new URLSearchParams({
      topic: selectedTopic,
      count: String(selectedCount),
      mode: practiceMode
    });
    if (typeof window !== "undefined") {
      setIsStarting(true);
      router.push(`/practice/session?${params.toString()}`);
      setTimeout(() => setIsStarting(false), 800);
    }
  };

  // গ্রুপ-ডিটেইলে নোড-রো (রিকার্সিভ) — সিলেক্ট + চেভরন-এক্সপ্যান্ড
  const renderNodeRows = (nodes: HubNode[]) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedPaths[node.fullPath] ?? false;
      const isSelected = selectedTopic === node.fullPath;
      const row = (
        <div
          key={node.fullPath}
          className={`flex items-center gap-1.5 p-2 rounded-xl border transition cursor-pointer ${
            isSelected
              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
              : "bg-white border-slate-300 text-black hover:border-indigo-400 hover:bg-indigo-50/40"
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.fullPath);
              }}
              className={`p-0.5 rounded hover:bg-black/10 transition cursor-pointer shrink-0 ${
                isSelected ? "text-white" : "text-slate-400"
              }`}
              aria-label="খুলুন/বন্ধ করুন"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${isSelected ? "bg-white" : "bg-indigo-500"}`} />
          )}

          <button
            type="button"
            onClick={() => selectNode(node.fullPath)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left font-bold truncate cursor-pointer"
            title={node.fullPath}
          >
            {hasChildren ? (
              <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : "text-amber-500"}`} />
            ) : (
              <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : "text-indigo-600"}`} />
            )}
            <span className="truncate">{node.name}</span>
            {node.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                  isSelected ? "bg-white/20" : "bg-slate-100 text-slate-600"
                }`}
              >
                {toBengaliDigits(node.count)}টি
              </span>
            )}
          </button>

          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
        </div>
      );

      return (
        <div key={node.fullPath}>
          {row}
          {hasChildren && isExpanded && (
            <div className="ml-3 sm:ml-4 pl-2.5 border-l-2 border-indigo-100 space-y-1 mt-1">
              {renderNodeRows(node.children)}
            </div>
          )}
        </div>
      );
    });
  };

  /* ------------------- গেট ভিউ: গেস্ট / লকড ------------------- */
  if (phase === "loading") {
    return (
      <LoadingState
        label="এক্সেস যাচাই করা হচ্ছে..."
        hint="আপনার এনরোলমেন্ট যাচাই করে টপিক-তালিকা আনা হচ্ছে"
        variant="card"
      />
    );
  }

  if (phase === "guest") {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4 font-bengali">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
          <LogIn className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900">সেলফ প্র্যাকটিস দেখতে Google লগইন করুন</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            যেকোনো একটি কোর্সে এনরোল্ড থাকলেই <strong>সব বিষয় ও টপিক-গ্রুপের</strong> সব প্রশ্নে
            প্র্যাকটিস করা যায় — উত্তর ও ব্যাখ্যাসহ।
          </p>
        </div>
        <button
          type="button"
          onClick={() => loginWithGoogle(undefined, "/practice")}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-3 rounded-2xl text-sm cursor-pointer transition"
        >
          Google দিয়ে লগইন করুন
        </button>
      </div>
    );
  }

  if (phase === "locked") {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4 font-bengali">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900">সেলফ প্র্যাকটিস শুধু এনরোল্ড স্টুডেন্টদের জন্য</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            <strong>যেকোনো একটি কোর্সে</strong> এনরোল করলেই সব টপিক-গ্রুপের সব প্রশ্নে প্র্যাকটিস
            খুলে যায়। লাইভ পরীক্ষার প্রশ্নগুলো পরীক্ষা শেষ হলে স্বয়ংক্রিয়ভাবে এখানে যুক্ত হয়।
          </p>
        </div>
        {accessError && <p className="text-xs text-rose-600 font-semibold">{accessError}</p>}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={openEnroll}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-7 py-3 rounded-2xl text-sm cursor-pointer transition shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" /> কোর্স এনরোল করুন
          </button>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-2xl text-sm cursor-pointer transition"
          >
            <RotateCcw className="w-4 h-4" /> আবার চেষ্টা করুন
          </button>
        </div>
      </div>
    );
  }

  /* ------------------- হাব ভিউ ------------------- */
  if (topics === null) {
    return (
      <LoadingState
        label="প্রশ্নের তালিকা লোড হচ্ছে..."
        hint="টপিক-গ্রুপ ও প্রশ্নসংখ্যা হিসাব করা হচ্ছে"
        variant="list"
        rows={5}
      />
    );
  }

  const groupCardCls = (count: number, isSelected: boolean) =>
    `w-full text-left font-bengali rounded-3xl border shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 cursor-pointer h-full active:scale-[0.995] ${
      isSelected
        ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200"
        : count > 0
        ? "bg-white border-slate-200 hover:border-indigo-300"
        : "bg-slate-50 border-slate-200 opacity-80"
    }`;

  return (
    <div className="font-bengali space-y-5">
      {tree.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm text-center space-y-3 font-bengali">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-800">এখনো কোনো প্র্যাকটিসযোগ্য প্রশ্ন নেই</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            প্রশ্নব্যাংকে প্রশ্ন যুক্ত হলে বা কোনো লাইভ পরীক্ষা শেষ হলে এখানে দেখা যাবে।
          </p>
          {topicsError && <p className="text-xs text-rose-600 font-semibold">{topicsError}</p>}
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-sm cursor-pointer transition"
          >
            <RotateCcw className="w-4 h-4" /> আবার চেষ্টা করুন
          </button>
        </div>
      ) : (
        <>
          {/* ===== টপিক-গ্রুপ কার্ড গ্রিড (Live MCQ স্টাইল) ===== */}
          <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">

            {/* গ্রুপ কার্ড গ্রিড */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
              {tree.map((group, gi) => {
                const isSelected =
                  selectedTopic === group.fullPath || activeGroupPath === group.fullPath;
                const tile = isSelected ? "bg-white/25" : `bg-gradient-to-br ${colorFor(gi)}`;
                return (
                  <button
                    key={group.fullPath}
                    type="button"
                    onClick={() => openGroup(group)}
                    className={groupCardCls(group.count, isSelected)}
                    title={`${group.fullPath} — ${toBengaliDigits(group.count)}টি প্রশ্ন`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-base shadow-sm shrink-0 ${tile}`}
                      >
                        {group.name.trim().charAt(0)}
                      </div>
                      {group.count > 0 ? (
                        <span className="text-[11px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full shrink-0">
                          {toBengaliDigits(group.count)}টি
                        </span>
                      ) : (
                        <span className="text-[11px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full shrink-0">
                          আসছে
                        </span>
                      )}
                    </div>
                    <h3 className="font-black text-slate-900 text-xs sm:text-sm mt-2.5 leading-snug line-clamp-2">
                      {group.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      {hasNested ? "গ্রুপ খুলে টপিক দেখুন" : "প্র্যাকটিস শুরু করুন"}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* খালি গ্রুপগুলো এখানে দেখানো হয় না (ট্যাপ করলে প্রশ্ন পাওয়া যায় না) */}
            {hiddenGroups > 0 && (
              <p className="text-[11px] sm:text-xs text-slate-400 font-semibold mt-4 leading-relaxed flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  আরও {toBengaliDigits(hiddenGroups)}টি টপিক-গ্রুপের প্রশ্ন এখনো প্রস্তুত হয়নি বা লাইভ পরীক্ষার উত্তর
                  প্রকাশের অপেক্ষায় আছে — প্রস্তুত হলেই এখানে স্বয়ংক্রিয়ভাবে যুক্ত হবে।
                </span>
              </p>
            )}
          </section>

          {/* ===== গ্রুপ ডিটেইল: সাব-টপিক তালিকা ===== */}
          {activeGroupNode && hasNested && (
            <section
              ref={detailRef}
              className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm scroll-mt-20"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={backToGroups}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
                    aria-label="সব টপিক-গ্রুপে ফিরুন"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                      {activeGroupNode.name}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">
                      {toBengaliDigits(activeGroupNode.count)}টি প্রশ্ন এই গ্রুপে — সাব-টপিক বেছে নিন বা পুরো
                      গ্রুপে দিন
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full shrink-0">
                  {activeGroupNode.name} — {toBengaliDigits(activeGroupNode.count)}টি
                </span>
              </div>

              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {/* পুরো গ্রুপ রো */}
                <div
                  className={`flex items-center gap-1.5 p-2 rounded-xl border transition cursor-pointer ${
                    selectedTopic === activeGroupNode.fullPath
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-gradient-to-r from-indigo-50 to-white border-slate-300 text-black hover:border-indigo-400"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${
                      selectedTopic === activeGroupNode.fullPath ? "bg-white" : "bg-indigo-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => selectNode(activeGroupNode.fullPath)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left font-bold truncate cursor-pointer"
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 shrink-0 ${
                        selectedTopic === activeGroupNode.fullPath ? "text-white" : "text-amber-500"
                      }`}
                    />
                    <span className="truncate">পুরো {activeGroupNode.name} গ্রুপ (মিক্সড)</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                        selectedTopic === activeGroupNode.fullPath ? "bg-white/20" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {toBengaliDigits(activeGroupNode.count)}টি
                    </span>
                  </button>
                  {selectedTopic === activeGroupNode.fullPath && (
                    <Check className="w-3.5 h-3.5 shrink-0 text-white" />
                  )}
                </div>

                {renderNodeRows(activeGroupNode.children)}
              </div>



              <p className="text-[11px] text-slate-400 mt-3 font-medium">
                💡 টপিক বাছাই করে সবচেয়ে নিচের &ldquo;প্র্যাকটিস শুরু করুন&rdquo; চাপুন — সাব-টপিক বাছাই করলে শুধু সেই অংশের
                প্রশ্ন আসবে।
              </p>
            </section>
          )}
          {/* ===== নির্বাচন + কনফিগ বার (সব ভিউতে) ===== */}
          <div ref={configRef} className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4 scroll-mt-20">

            {/* নির্বাচিত টপিক */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">🎯 নির্বাচিত টপিক</p>
                <p className="font-black text-indigo-900 text-sm leading-snug truncate">{selectedTopic}</p>
                {availableForSelection > 0 && (
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{toBengaliDigits(availableForSelection)}টি প্রশ্ন পাওয়া যাবে</p>
                )}
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full shrink-0">
                মোট {toBengaliDigits(totalCount)}টি
              </span>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              {/* প্রশ্নের সংখ্যা */}
              <div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">প্রশ্নের সংখ্যা</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={selectedCount}
                      onChange={(e) => {
                        let val = parseInt(e.target.value, 10) || 5;
                        if (val > 200) val = 200;
                        setSelectedCount(val);
                      }}
                      className="w-12 text-center text-sm font-black bg-transparent focus:outline-none text-slate-900"
                    />
                    <span className="text-xs font-bold text-slate-400">টি</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[10, 30, 50, 100, 200].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setSelectedCount(cnt)}
                        className={`py-1.5 px-2.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                          selectedCount === cnt
                            ? "bg-black border-black text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-black"
                        }`}
                      >
                        {toBengaliDigits(cnt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* মোড */}
              <div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">মোড</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPracticeMode("instant")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer border-2 text-center ${
                      practiceMode === "instant"
                        ? "bg-black border-black text-white shadow-sm"
                        : "bg-white border-slate-200 text-black hover:bg-slate-50"
                    }`}
                  >
                    ⚡ ইনস্ট্যান্ট
                    <span className="block text-[10px] font-semibold opacity-70 mt-0.5">ক্লিকেই উত্তর</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPracticeMode("exam")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer border-2 text-center ${
                      practiceMode === "exam"
                        ? "bg-black border-black text-white shadow-sm"
                        : "bg-white border-slate-200 text-black hover:bg-slate-50"
                    }`}
                  >
                    📝 মক টেস্ট
                    <span className="block text-[10px] font-semibold opacity-70 mt-0.5">জমা দিলে রিভিউ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* শুরু বাটন */}
            <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400 text-center sm:text-left">
                {practiceMode === "instant"
                  ? "উত্তর দিলেই সঠিক উত্তর ও ব্যাখ্যা দেখাবে।"
                  : "সব প্রশ্ন একসাথে — জমা দেওয়ার পর স্কোর ও রিভিউ।"}
              </p>
              <button
                type="button"
                disabled={!canStart || isStarting}
                onClick={handleStartPractice}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-bold px-8 py-3 rounded-2xl text-sm shadow-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  canStart ? "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-600/20" : "bg-slate-400"
                }`}
              >
                {isStarting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> উইন্ডো খুলছে...</>
                ) : canStart ? (
                  <><Play className="w-4 h-4 fill-white" /> প্র্যাকটিস শুরু করুন</>
                ) : (
                  <><Lock className="w-4 h-4" /> এই নির্বাচনে এখনো প্রশ্ন নেই</>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
