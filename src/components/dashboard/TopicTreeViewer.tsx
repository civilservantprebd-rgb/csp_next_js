"use client";

import React, { useState } from "react";
import {
  Folder,
  BookOpen,
  Zap,
  ChevronRight,
  ChevronDown,
  Layers
} from "lucide-react";
import { TreeNode } from "@/lib/topic-hierarchy";
import { toBengaliDigits } from "@/lib/utils";

interface TopicTreeViewerProps {
  tree: TreeNode[];
  onOpenReading: (path: string, title: string) => void;
  onStartQuiz: (path: string, title: string) => void;
  depth?: number;
  isLocked?: boolean;
  onLockedAction?: () => void;
}

export const TopicTreeViewer: React.FC<TopicTreeViewerProps> = ({
  tree,
  onOpenReading,
  onStartQuiz,
  depth = 0,
  isLocked = false,
  onLockedAction,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!tree || tree.length === 0) return null;

  const renderNodeBar = (node: TreeNode, isTop: boolean) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? false;

    return (
      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
        <div
          onClick={() => hasChildren && toggleExpand(node.id)}
          className={`flex items-center gap-2 flex-1 min-w-0 select-none ${hasChildren ? "cursor-pointer" : ""}`}
        >
          {hasChildren ? (
            <div className="text-slate-400 p-0.5 hover:text-indigo-600 transition">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-indigo-600" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ml-1.5" />
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            {isTop ? (
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                📖
              </div>
            ) : hasChildren ? (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            )}

            <span
              className={`truncate font-bold text-xs sm:text-sm ${
                isTop ? "text-slate-900 font-black" : "text-slate-800"
              }`}
            >
              {node.name}
            </span>
          </div>

          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0 border border-slate-200/60">
            {toBengaliDigits(node.count)}টি প্রশ্ন
          </span>
        </div>

        {/* Action Buttons: Study & Quiz or Locked Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isLocked ? (
            <button
              type="button"
              onClick={onLockedAction}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
              title="এই প্রশ্নগুলো দেখতে কোর্সে এনরোল করুন"
            >
              <span className="text-xs">🔒</span>
              <span className="text-[11px] font-black text-amber-900">লক করা</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenReading(node.fullPath, node.name)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                title="এই অংশের সব প্রশ্ন পড়ুন"
              >
                <BookOpen className="w-3 h-3 text-indigo-600" />
                <span className="hidden sm:inline">পড়ুন</span>
              </button>

              <button
                type="button"
                onClick={() => onStartQuiz(node.fullPath, node.name)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                title="এই অংশের ওপর ইনস্ট্যান্ট কুইজ দিন"
              >
                <Zap className="w-3 h-3 fill-white" />
                <span className="hidden sm:inline">কুইজ</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Top level: vertical scroll list (4 visible, scroll up/down for more),
  // each topic is a card with its subtopics inside (scrollable if many).
  if (depth === 0) {
    return (
      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {tree.map((node) => (
          <div
            key={node.id}
            className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden"
          >
            {renderNodeBar(node, true)}
            {node.children && node.children.length > 0 && expandedNodes[node.id] && (
              <div className="px-3 pb-3 max-h-60 overflow-y-auto">
                <TopicTreeViewer
                  tree={node.children}
                  onOpenReading={onOpenReading}
                  onStartQuiz={onStartQuiz}
                  depth={1}
                  isLocked={isLocked}
                  onLockedAction={onLockedAction}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Deeper levels: vertical list (as before)
  return (
    <div className="space-y-2 font-bengali ml-3 sm:ml-5 border-l-2 border-indigo-100 pl-3 pt-1">
      {tree.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes[node.id] ?? false;

        return (
          <div
            key={node.id}
            className="rounded-2xl transition border border-slate-100 bg-slate-50/70"
          >
            {renderNodeBar(node, false)}
            {hasChildren && isExpanded && (
              <div className="pb-3 pr-3">
                <TopicTreeViewer
                  tree={node.children}
                  onOpenReading={onOpenReading}
                  onStartQuiz={onStartQuiz}
                  depth={depth + 1}
                  isLocked={isLocked}
                  onLockedAction={onLockedAction}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
