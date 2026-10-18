"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BookOpen,
  Bookmark,
  Check,
  CheckCheck,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Lightbulb,
  Loader2,
  Lock,
  LogIn,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getPracticeTopics, getQuestionBankTopicQuestions } from "@/actions/practice-actions";
import { verifyTeacherSession } from "@/actions/admin-actions";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";
import { getCachedEnrollment } from "@/lib/access-cache";
import { toBengaliDigits } from "@/lib/utils";
import { MathText } from "@/lib/MathText";
import { buildTopicGroupTree, colorFor, pruneEmptyNodes, TopicIcon, type HubNode } from "@/lib/topic-group";
import { LoadingState } from "@/components/shared/LoadingState";
import { BookmarkButton } from "@/components/shared/BookmarkButton";
import { getStudentBookmarks, syncStudentMistakeData } from "@/lib/mistake-bookmark-store";
import {
  getStudentReads,
  markQuestionsRead,
  syncStudentReads,
  toggleQuestionRead
} from "@/lib/read-store";

interface BankQ {
  id: string;
  q: string;
  opts: string[];
  correct: number;
  exp?: string;
  subject?: string;
  topic?: string;
}

interface TopicEntry {
  name: string;
  count: number;
}

type BankFilter = "all" | "unread" | "read" | "bookmarked";

const FILTER_LABELS: { id: BankFilter; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "unread", label: "পড়া হয়নি" },
  { id: "read", label: "পড়া হয়েছে" },
  { id: "bookmarked", label: "বুকমার্ক" }
];

const optLabels = ["ক", "খ", "গ", "ঘ"];

const TOPICS_CACHE_PREFIX = "csp_qbank_topics_";
const TOPICS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes fresh cache

export function readTopicsCache(uid: string): TopicEntry[] | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const raw = localStorage.getItem(TOPICS_CACHE_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.list)) return null;
    if (Date.now() - Number(parsed.ts || 0) > TOPICS_CACHE_TTL_MS) return null;
    return parsed.list as TopicEntry[];
  } catch {
    return null;
  }
}

export function writeTopicsCache(uid: string, list: TopicEntry[]): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(TOPICS_CACHE_PREFIX + uid, JSON.stringify({ list, ts: Date.now() }));
  } catch {}
}

const READ_CHUNK = 50;

interface QuestionBankViewProps {
  onOpenEnrollModal?: () => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({ onOpenEnrollModal }) => {
  const router = useRouter();

  // Immediate synchronous cache check for 0ms initial render
  const initialLocalUser = typeof window !== "undefined" ? getLocalStudentUser() : null;
  const initialEnrollSnap = typeof window !== "undefined" && initialLocalUser
    ? getCachedEnrollment(initialLocalUser.uid, initialLocalUser.email)
    : null;
  const initialEnrolled = initialEnrollSnap ? initialEnrollSnap.allowed : null;
  const initialCache = initialLocalUser && initialEnrolled === true
    ? readTopicsCache(initialLocalUser.uid || initialLocalUser.email)
    : null;
  const hasInitialCache = !!(initialCache && initialCache.length > 0 && initialEnrolled === true);

  const [user, setUser] = useState<{ uid: string; name: string; email?: string } | null>(initialLocalUser);
  const [entries, setEntries] = useState<TopicEntry[]>(initialCache || []);
  const [enrolled, setEnrolled] = useState<boolean | null>(initialEnrolled);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [topicsLoaded, setTopicsLoaded] = useState(hasInitialCache);
  const [accessId, setAccessId] = useState(() => initialLocalUser?.uid || "");
  const [accessEmail, setAccessEmail] = useState(() => initialLocalUser?.email || "");
  const [questionCache, setQuestionCache] = useState<Record<string, { qs: BankQ[]; total: number }>>({});

  // রিডিং স্টেট
  const [questions, setQuestions] = useState<BankQ[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(READ_CHUNK);
  const [filter, setFilter] = useState<BankFilter>("all");
  const [collection, setCollection] = useState<null | "bookmarks" | "reads">(null);
  const [storeTick, setStoreTick] = useState(0);

  // হাব স্টেট
  const [activeGroupPath, setActiveGroupPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const detailRef = useRef<HTMLDivElement | null>(null);
  const questionsRef = useRef<HTMLDivElement | null>(null);

  const rawTree = useMemo(() => buildTopicGroupTree(entries), [entries]);
  const tree = useMemo(() => pruneEmptyNodes(rawTree), [rawTree]);
  const hiddenGroups = rawTree.length - tree.length;
  const totalCount = useMemo(() => tree.reduce((s, n) => s + n.count, 0), [tree]);
  const hasNested = useMemo(() => tree.some((n) => n.children.length > 0), [tree]);

  const storeId = accessId || user?.uid || "";
  const readKeys = useMemo(
    () => new Set(getStudentReads(storeId).map((i) => i.q.trim().toLowerCase())),
    [storeId, storeTick]
  );
  const bookmarkKeys = useMemo(
    () => new Set(getStudentBookmarks(storeId).map((i) => i.q.trim().toLowerCase())),
    [storeId, storeTick]
  );

  useEffect(() => {
    const onStore = () => setStoreTick((t) => t + 1);
    window.addEventListener("storage", onStore);
    return () => window.removeEventListener("storage", onStore);
  }, []);

  const visibleQuestions = useMemo(() => {
    let list = questions;
    if (collection) {
      list = list.filter((q) => {
        const key = q.q.trim().toLowerCase();
        return collection === "bookmarks" ? bookmarkKeys.has(key) : readKeys.has(key);
      });
    }
    if (filter === "all") return list;
    return list.filter((q) => {
      const key = q.q.trim().toLowerCase();
      if (filter === "read") return readKeys.has(key);
      if (filter === "unread") return !readKeys.has(key);
      return bookmarkKeys.has(key);
    });
  }, [questions, collection, filter, readKeys, bookmarkKeys]);

  const readCount = useMemo(
    () => questions.filter((q) => readKeys.has(q.q.trim().toLowerCase())).length,
    [questions, readKeys]
  );
  const bookmarkedCount = useMemo(
    () => questions.filter((q) => bookmarkKeys.has(q.q.trim().toLowerCase())).length,
    [questions, bookmarkKeys]
  );
  const totalBookmarks = useMemo(() => getStudentBookmarks(storeId).length, [storeId, storeTick]);
  const totalReads = useMemo(() => getStudentReads(storeId).length, [storeId, storeTick]);

  useEffect(() => {
    const u = getLocalStudentUser();
    setUser(u);
    if (!u) {
      setEnrolled(false);
      return;
    }

    (async () => {
      try {
        const { checkEnrollmentCached } = await import("@/lib/access-cache");
        let allowed = false;
        let effId = u.uid;
        let effEmail = u.email;

        const g = await checkEnrollmentCached(u.uid, u.email);
        if (g.allowed) {
          allowed = true;
        } else {
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

        setEnrolled(allowed);
        if (!allowed) {
          setEntries([]);
          setTopicsLoaded(true);
          return;
        }

        setAccessId(effId);
        setAccessEmail(effEmail || "");

        // If enrolled, populate cached topics immediately if available
        const cached = readTopicsCache(effId || effEmail || u.uid);
        if (cached && cached.length > 0) {
          setEntries(cached);
          setTopicsLoaded(true);
        }

        void syncStudentReads(effId || u.uid).catch(() => {});

        const t = await getPracticeTopics(effId || u.uid, effEmail || u.email);
        if (t && t.length > 0) {
          const mapped = t.map((x: { name: string; count: number }) => ({
            name: x.name,
            count: x.count
          }));
          setEntries(mapped);
          setTopicsLoaded(true);
          writeTopicsCache(effId || effEmail || u.uid, mapped);
        } else if (!hasInitialCache) {
          setTopicsLoaded(true);
        }
      } catch {
        if (!hasInitialCache) {
          setLoadError("সার্ভার থেকে তথ্য লোড করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
        }
      }
    })();
  }, []);

  const openTopic = async (value: string, label: string) => {
    if (!user || enrolled !== true) return;
    
    if (questionCache[value]) {
      setQuestions(questionCache[value].qs);
      setTotalQuestions(questionCache[value].total);
      setCurrentPage(1);
      setSelectedLabel(label);
      setVisibleCount(READ_CHUNK);
      setFullscreen(false);
      setFilter("all");
      setCollection(null);
      setTimeout(() => {
        questionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }

    setBusy(true);
    setLoadError("");
    setRevealed(new Set());
    try {
      const { questions: qs, metadata } = await getQuestionBankTopicQuestions(
        value,
        1,
        READ_CHUNK,
        accessId || user.uid,
        accessEmail || user.email
      );

      if (!qs || qs.length === 0) {
        setLoadError(
          "এই নির্বাচনে বর্তমানে দেখানোর মতো প্রশ্ন পাওয়া যায়নি — নির্ধারিত (লাইভ) পরীক্ষার প্রশ্ন ফলাফল প্রকাশের আগে প্রশ্নব্যাংকে দেখানো হয় না। অন্য বিষয়/টপিক বেছে নিন।"
        );
        setBusy(false);
        return;
      }
      setQuestions(qs);
      setTotalQuestions(metadata.total);
      setQuestionCache((prev) => ({ ...prev, [value]: { qs, total: metadata.total } }));
      setCurrentPage(1);
      setSelectedLabel(label);
      setVisibleCount(READ_CHUNK);
      setFullscreen(false);
      setFilter("all");
      setCollection(null);
      setTimeout(() => {
        questionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      setLoadError("প্রশ্ন লোড করা যায়নি। আবার চেষ্টা করুন।");
    }
    setBusy(false);
  };

  const backToBank = () => {
    setQuestions([]);
    setTotalQuestions(0);
    setCurrentPage(1);
    setLoadError("");
    setRevealed(new Set());
    setFullscreen(false);
    setVisibleCount(READ_CHUNK);
    setFilter("all");
    setCollection(null);
  };

  const loadMoreQuestions = async () => {
    if (!user || enrolled !== true || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const topicKey = activeGroupPath || selectedLabel;
      const { questions: newQs, metadata } = await getQuestionBankTopicQuestions(
        topicKey,
        nextPage,
        READ_CHUNK,
        accessId || user.uid,
        accessEmail || user.email
      );
      if (newQs && newQs.length > 0) {
        setQuestions((prev) => {
          const combined = [...prev, ...newQs];
          setQuestionCache((c) => ({ ...c, [topicKey]: { qs: combined, total: metadata.total } }));
          return combined;
        });
        setCurrentPage(nextPage);
        setTotalQuestions(metadata.total);
        setVisibleCount((v) => v + READ_CHUNK);
      }
    } catch {}
    setIsLoadingMore(false);
  };

  const toggleRead = (item: BankQ) => {
    if (!storeId) return;
    toggleQuestionRead(storeId, {
      q: item.q,
      opts: item.opts,
      correct: item.correct,
      exp: item.exp || "",
      subject: item.subject,
      topic: item.topic
    });
    setStoreTick((t) => t + 1);
  };

  const markAllVisibleRead = () => {
    if (!storeId) return;
    const added = markQuestionsRead(
      storeId,
      visibleQuestions.map((q) => ({
        q: q.q,
        opts: q.opts,
        correct: q.correct,
        exp: q.exp || "",
        subject: q.subject,
        topic: q.topic
      }))
    );
    if (added > 0) setStoreTick((t) => t + 1);
  };

  const openCollection = async (kind: "bookmarks" | "reads") => {
    if (!user || enrolled !== true) return;
    const id = storeId || user.uid;
    setBusy(true);
    setLoadError("");
    setRevealed(new Set());
    try {
      if (kind === "bookmarks") await syncStudentMistakeData(id);
      else await syncStudentReads(id);
      setStoreTick((t) => t + 1);

      const items = kind === "bookmarks" ? getStudentBookmarks(id) : getStudentReads(id);
      if (items.length === 0) {
        setLoadError(
          kind === "bookmarks"
            ? "এখনো কোনো প্রশ্ন বুকমার্ক করা হয়নি — প্রশ্নের পাশে 🔖 বাটনে চাপ দিলে সেটি এখানে জমা হবে।"
            : "এখনো কোনো প্রশ্ন পড়া হিসেবে চিহ্নিত করা হয়নি — প্রশ্নের পাশে ✓ বাটনে চাপ দিলে সেটি এখানে জমা হবে।"
        );
        setBusy(false);
        return;
      }

      setQuestions(
        items.map((i) => ({
          id: i.id,
          q: i.q,
          opts: i.opts,
          correct: i.correct,
          exp: i.exp,
          subject: i.subject,
          topic: i.topic
        }))
      );
      setTotalQuestions(items.length);
      setCurrentPage(1);
      setCollection(kind);
      setFilter("all");
      setSelectedLabel(kind === "bookmarks" ? "আমার বুকমার্ক" : "পড়া হয়েছে");
      setVisibleCount(READ_CHUNK);
      setFullscreen(false);
      window.scrollTo({ top: 0 });
    } catch {
      setLoadError("সংগ্রহ লোড করা যায়নি। আবার চেষ্টা করুন।");
    }
    setBusy(false);
  };

  const openGroup = (node: HubNode) => {
    if (!hasNested) {
      openTopic(node.fullPath, node.fullPath);
      return;
    }
    setActiveGroupPath(node.fullPath);
    setExpandedPaths({});
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const backToGroups = () => {
    setActiveGroupPath(null);
  };

  const toggleExpand = (fullPath: string) => {
    setExpandedPaths((prev) => ({ ...prev, [fullPath]: !prev[fullPath] }));
  };

  const collectPaths = (node: HubNode): string[] =>
    node.children.flatMap((c) => [c.fullPath, ...collectPaths(c)]);

  const expandBranch = (node: HubNode) => {
    setExpandedPaths((prev) => {
      const next = { ...prev };
      collectPaths(node).forEach((p) => (next[p] = true));
      return next;
    });
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

  const toggleReveal = (idx: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const revealAll = () => setRevealed(new Set(questions.map((_, i) => i)));

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  const renderFilterBar = () => (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide min-w-0 flex-1">
      {FILTER_LABELS.map((f) => {
        const count =
          f.id === "read"
            ? readCount
            : f.id === "bookmarked"
            ? bookmarkedCount
            : f.id === "unread"
            ? Math.max(0, questions.length - readCount)
            : questions.length;
        const isActive = filter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              setVisibleCount(READ_CHUNK);
            }}
            className={`inline-flex items-center gap-1 shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer ${
              isActive
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
            }`}
          >
            {f.label}
            <span
              className={`rounded-full px-1.5 text-[10px] font-black ${
                isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {toBengaliDigits(count)}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderCollectionTabs = () =>
    collection && (
      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            { id: "bookmarks" as const, label: "বুকমার্ক", icon: <Bookmark className="w-3.5 h-3.5" /> },
            { id: "reads" as const, label: "পড়া হয়েছে", icon: <CheckCheck className="w-3.5 h-3.5" /> }
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openCollection(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              collection === t.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    );

  const renderQuestionCardsList = () => (
    <div className="space-y-3">
      {visibleQuestions.slice(0, visibleCount).map((q, idx) => {
        const isOpen = revealed.has(idx);
        const qKey = q.q.trim().toLowerCase();
        const isRead = readKeys.has(qKey);
        return (
          <div
            key={q.id || idx}
            className={`bg-white rounded-2xl p-4 border shadow-sm ${isRead ? "border-emerald-200" : "border-slate-200"}`}
          >
            <p className="text-sm font-bold text-slate-900 leading-relaxed">
              {toBengaliDigits(idx + 1)}. <MathText text={q.q} />
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
              {q.opts.map((opt, oIdx) => {
                const isCorrect = oIdx === q.correct;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => toggleReveal(idx)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs text-left transition cursor-pointer w-full ${
                      isOpen && isCorrect
                        ? "border-emerald-400 bg-emerald-50 text-emerald-950 font-bold shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                      isOpen && isCorrect ? "bg-emerald-600 text-white" : "bg-slate-800 text-white"
                    }`}>
                      {optLabels[oIdx]}
                    </span>
                    <span className="flex-1"><MathText text={opt} /></span>
                    {isOpen && isCorrect && (
                      <span className="ml-auto text-emerald-700 font-bold shrink-0">✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => toggleReveal(idx)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                {isOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {isOpen ? "উত্তর লুকান" : "সঠিক উত্তর দেখুন"}
              </button>

              {q.exp && (
                <button
                  type="button"
                  onClick={() => toggleReveal(idx)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-800 cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4" />
                  ব্যাখ্যা দেখুন
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleRead(q)}
                title={isRead ? "পড়া হয়নি হিসেবে ফিরিয়ে দিন" : "পড়া হয়েছে হিসেবে চিহ্নিত করুন"}
                className={`rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-xs px-2.5 py-1.5 cursor-pointer select-none active:scale-95 ${
                  isRead
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold shadow-sm"
                    : "bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 border-slate-200"
                }`}
              >
                <CheckCheck className={`w-4 h-4 ${isRead ? "text-emerald-600" : "text-slate-500"}`} />
                <span className="hidden sm:inline">{isRead ? "পড়া হয়েছে" : "পড়া হয়নি"}</span>
              </button>

              <BookmarkButton
                studentId={storeId}
                size="sm"
                question={{
                  q: q.q,
                  opts: q.opts,
                  correct: q.correct,
                  exp: q.exp || "",
                  subject: q.subject || selectedLabel,
                  topic: q.topic
                }}
              />
            </div>

            {isOpen && q.exp && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 leading-relaxed flex gap-2 whitespace-pre-wrap">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-amber-900">ব্যাখ্যা:</strong> <MathText text={q.exp} />
                </span>
              </div>
            )}
          </div>
        );
      })}

      {visibleQuestions.length === 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center space-y-1.5">
          <p className="text-sm font-bold text-slate-700">
            {filter === "read"
              ? "এই তালিকায় এখনো কোনো প্রশ্ন পড়া হিসেবে চিহ্নিত হয়নি"
              : filter === "unread"
              ? "দারুণ — এই তালিকার সব প্রশ্নই পড়া হয়ে গেছে"
              : filter === "bookmarked"
              ? "এই তালিকায় কোনো প্রশ্ন বুকমার্ক করা নেই"
              : "প্রশ্ন নেই"}
          </p>
          <p className="text-xs text-slate-500">
            প্রশ্নের পাশে ✓ বা 🔖 বাটনে চাপ দিলে সেটি এখানে জমা হবে।
          </p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-1 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition"
          >
            সব প্রশ্ন দেখান
          </button>
        </div>
      )}

      {(questions.length < totalQuestions || visibleCount < visibleQuestions.length) && (
        <div className="flex flex-col items-center gap-2.5 pt-2 pb-4">
          <p className="text-[11px] font-bold text-slate-400">
            মোট {toBengaliDigits(totalQuestions)}টির মধ্যে {toBengaliDigits(Math.min(visibleCount, visibleQuestions.length))}টি দেখানো হচ্ছে
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {visibleCount < visibleQuestions.length ? (
              <button
                type="button"
                onClick={() => setVisibleCount((v) => Math.min(visibleQuestions.length, v + READ_CHUNK))}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <BookOpen className="w-4 h-4" /> আরও{" "}
                {toBengaliDigits(Math.min(READ_CHUNK, visibleQuestions.length - visibleCount))}টি প্রশ্ন দেখুন
              </button>
            ) : questions.length < totalQuestions ? (
              <button
                type="button"
                onClick={loadMoreQuestions}
                disabled={isLoadingMore}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
              >
                {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                সার্ভার থেকে আরও {toBengaliDigits(Math.min(READ_CHUNK, totalQuestions - questions.length))}টি প্রশ্ন আনুন
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );

  const renderNodeRows = (nodes: HubNode[]) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedPaths[node.fullPath] ?? false;
      return (
        <div key={node.fullPath}>
          <div className={`flex items-center gap-0 rounded-2xl border transition overflow-hidden ${
            hasChildren
              ? "bg-slate-50 border-slate-200 hover:border-slate-300"
              : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm"
          }`}>
            <button
              type="button"
              onClick={() => openTopic(node.fullPath, node.fullPath)}
              className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3 text-left cursor-pointer group"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-900 text-sm leading-snug group-hover:text-indigo-700 transition">
                  {node.name}
                </span>
                {hasChildren && (
                  <span className="block text-[11px] text-slate-400 font-medium mt-0.5">
                    {toBengaliDigits(node.children.length)}টি সাব-টপিক
                  </span>
                )}
              </span>
              {node.count > 0 && (
                <span className="shrink-0 text-[11px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {toBengaliDigits(node.count)}
                </span>
              )}
            </button>

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.fullPath);
                }}
                className="shrink-0 h-full px-3 py-3 border-l border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                aria-label={isExpanded ? "সাব-টপিক বন্ধ করুন" : "সাব-টপিক খুলুন"}
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>
            )}

            {!hasChildren && (
              <span className="shrink-0 px-3 py-3 text-indigo-400 group-hover:text-indigo-600 pointer-events-none">
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>

          {hasChildren && isExpanded && (
            <div className="ml-3 pl-3 border-l-2 border-indigo-100 space-y-1 mt-1">
              {renderNodeRows(node.children)}
            </div>
          )}
        </div>
      );
    });
  };

  const groupCardCls = (count: number, isActive: boolean) =>
    `w-full text-left font-bengali rounded-3xl border shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 cursor-pointer h-full active:scale-[0.995] ${
      isActive
        ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200"
        : count > 0
        ? "bg-white border-slate-200 hover:border-indigo-300"
        : "bg-slate-50 border-slate-200 opacity-80"
    }`;

  return (
    <div className="space-y-5">
      {busy && (
        <div className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <LoadingState
              label="প্রশ্ন লোড হচ্ছে..."
              hint="শুধু নির্বাচিত টপিকের প্রশ্ন আনা হচ্ছে"
              variant="card"
            />
          </div>
        </div>
      )}

      {/* Header Banner */}
      {/* 
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black leading-tight tracking-tight">প্রশ্নব্যাংক</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              টপিক-গ্রুপ বেছে নিন — সঠিক উত্তর ও ব্যাখ্যাসহ বিস্তারিত পড়ুন
            </p>
          </div>
        </div>
      </div>
      */}

      {!user && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
            <LogIn className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900">প্রশ্নব্যাংক দেখতে Google লগইন করুন</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              এনরোল্ড শিক্ষার্থীরাই চ্যাপ্টারভিত্তিক প্রশ্নব্যাংক পড়তে পারেন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => loginWithGoogle(undefined, "/")}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-3 rounded-2xl text-sm cursor-pointer"
          >
            Google দিয়ে লগইন করুন
          </button>
        </div>
      )}

      {user && enrolled === false && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">প্রশ্নব্যাংক শুধু এনরোল্ড স্টুডেন্টদের জন্য</p>
          <p className="text-xs text-slate-500">
            যেকোনো একটি কোর্সে এনরোল করে শিক্ষকের অনুমোদন পেলে এই সেকশন খুলে যাবে।
          </p>
          <button
            type="button"
            onClick={() => {
              if (onOpenEnrollModal) onOpenEnrollModal();
            }}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm cursor-pointer transition shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" /> কোর্স এনরোল করুন
          </button>
        </div>
      )}

      {user && enrolled === null && (
        <LoadingState
          label="এক্সেস যাচাই হচ্ছে..."
          hint="আপনার এনরোলমেন্ট ও টপিক-তালিকা প্রস্তুত করা হচ্ছে"
          variant="card"
        />
      )}

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-2xl">{loadError}</div>
      )}

      {user && enrolled === true && questions.length === 0 && (
        <section className="space-y-5">
          {tree.length === 0 ? (
            !topicsLoaded ? (
              <LoadingState
                label="টপিক লোড হচ্ছে..."
                hint="আপনার পড়ার জন্য টপিক প্রস্তুত করা হচ্ছে"
                variant="card"
              />
            ) : (
              <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl mx-auto flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800">এখনো পড়ার মতো কোনো প্রশ্ন নেই</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  প্রশ্নব্যাংকে প্রশ্ন যুক্ত হলে বা কোনো লাইভ পরীক্ষা শেষ হলে এখানে দেখা যাবে।
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-sm cursor-pointer transition"
                >
                  <RotateCcw className="w-4 h-4" /> আবার চেষ্টা করুন
                </button>
              </div>
            )
          ) : (
            <>
              {/* আমার সংগ্রহ */}
              {(totalBookmarks > 0 || totalReads > 0) && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => openCollection("bookmarks")}
                    className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200 text-left transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Bookmark className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">আমার বুকমার্ক</h4>
                        <p className="text-[11px] text-amber-800 font-bold">
                          {toBengaliDigits(totalBookmarks)}টি সংরক্ষিত প্রশ্ন
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openCollection("reads")}
                    className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 text-left transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <CheckCheck className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">পড়া হয়েছে</h4>
                        <p className="text-[11px] text-emerald-800 font-bold">
                          {toBengaliDigits(totalReads)}টি সম্পন্ন প্রশ্ন
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}

              {/* টপিক-গ্রুপ হেডার + গ্রিড */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">টপিক-গ্রুপ বেছে নিন</h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                      গ্রুপে ট্যাপ করুন — তারপর সাব-টপিক বেছে পড়া শুরু করুন
                    </p>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full shrink-0">
                    মোট {toBengaliDigits(totalCount)}টি প্রশ্ন
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                  {tree.map((group, gi) => {
                    const isActive = activeGroupPath === group.fullPath;
                    const tile = isActive ? "bg-white/25" : `bg-gradient-to-br ${colorFor(gi, group.name)}`;
                    return (
                      <button
                        key={group.fullPath}
                        type="button"
                        onClick={() => openGroup(group)}
                        className={groupCardCls(group.count, isActive)}
                        title={`${group.fullPath} — ${toBengaliDigits(group.count)}টি প্রশ্ন`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-sm shrink-0 ${tile}`}
                          >
                            <TopicIcon name={group.name} className="w-5 h-5 text-white" />
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
                        <h3 className="font-black text-slate-900 text-sm sm:text-base mt-2.5 leading-snug line-clamp-3 break-words">
                          {group.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1">
                          <ChevronRight className="w-3 h-3 shrink-0" />
                          {hasNested ? "গ্রুপ খুলে টপিক দেখুন" : "প্রশ্ন পড়ুন"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* গ্রুপ ডিটেইল: সাব-টপিক তালিকা */}
              {activeGroupNode && hasNested && (
                <div
                  ref={detailRef}
                  className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm scroll-mt-20"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={backToGroups}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
                        aria-label="সব টপিক-গ্রুপে ফিরুন"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0 bg-gradient-to-br ${colorFor(0, activeGroupNode.name)}`}>
                        <TopicIcon name={activeGroupNode.name} className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-black text-slate-900 leading-snug truncate">{activeGroupNode.name}</h2>
                        <p className="text-[11px] text-slate-400 font-semibold">
                          {toBengaliDigits(activeGroupNode.count)}টি প্রশ্ন
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => openTopic(activeGroupNode.fullPath, activeGroupNode.fullPath)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition cursor-pointer group"
                    >
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block font-black text-indigo-900 text-sm leading-snug">সব প্রশ্ন একসাথে পড়ুন</span>
                        <span className="block text-[11px] text-indigo-500 font-medium mt-0.5">
                          মিক্সড — {toBengaliDigits(activeGroupNode.count)}টি প্রশ্ন
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0 group-hover:text-indigo-700" />
                    </button>

                    {renderNodeRows(activeGroupNode.children)}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-3 font-medium">
                    যেকোনো টপিকে ট্যাপ করলেই সেই অংশের প্রশ্ন খুলে যাবে।
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* রিডিং ডিটেইল */}
      {questions.length > 0 && !fullscreen && (
        <section ref={questionsRef} className="space-y-4 scroll-mt-20">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={backToBank}
                className="shrink-0 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                aria-label="প্রশ্নব্যাংকে ফিরুন"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="font-black text-slate-900 text-sm sm:text-base leading-snug truncate">{selectedLabel}</h2>
                <p className="text-[11px] text-slate-400 font-semibold">
                  {toBengaliDigits(totalQuestions)}টি প্রশ্ন • পড়া {toBengaliDigits(readCount)}টি • বুকমার্ক {toBengaliDigits(bookmarkedCount)}টি
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={markAllVisibleRead}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold py-2.5 px-2 rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <CheckCheck className="w-4 h-4 shrink-0" />
                <span>সব পড়া হয়েছে</span>
              </button>
              <button
                type="button"
                onClick={revealAll}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold py-2.5 px-2 rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span>সব উত্তর দেখুন</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
              {renderFilterBar()}
              {renderCollectionTabs()}
            </div>
          </div>

          {renderQuestionCardsList()}
        </section>
      )}

      {/* ফুল-স্ক্রিন মোড */}
      {fullscreen && questions.length > 0 && (
        <div className="fixed inset-0 z-[80] bg-white overflow-y-auto font-bengali">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={backToBank}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  ← প্রশ্নব্যাংকে ফিরে যান
                </button>
                <h2 className="font-black text-slate-900 text-sm sm:text-base truncate mt-1">{selectedLabel}</h2>
                <p className="text-xs text-slate-400 font-semibold">
                  {toBengaliDigits(totalQuestions)}টি প্রশ্ন • পড়া {toBengaliDigits(readCount)}টি • বুকমার্ক {toBengaliDigits(bookmarkedCount)}টি
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={markAllVisibleRead}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <CheckCheck className="w-4 h-4" /> সব পড়া হয়েছে
                </button>
                <button
                  type="button"
                  onClick={revealAll}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Eye className="w-4 h-4" /> সব উত্তর দেখুন
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <X className="w-4 h-4" /> ফুল স্ক্রিন বন্ধ
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {renderFilterBar()}
              {renderCollectionTabs()}
            </div>
          </div>

          <div className="max-w-4xl mx-auto p-4 sm:p-6">{renderQuestionCardsList()}</div>
        </div>
      )}
    </div>
  );
};
