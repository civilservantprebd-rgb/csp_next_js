"use client";

import React, { useState } from "react";
import {
  Folder,
  BookOpen,
  Zap,
  ChevronRight,
  ChevronDown,
  Layers,
  Lock
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

  /** একটি নোডের সারি — মোবাইলে ছোট, ডেস্কটপে একটু বড় */
  const renderNodeBar = (node: TreeNode, isTop: boolean) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? false;

    return (
      <div
        className={`flex items-center gap-1.5 ${
          isTop ? "p-3 sm:p-3.5" : "py-2 px-1.5"
        } rounded-xl transition select-none ${
          isTop ? "" : "hover:bg-white"
        }`}
      >
        {/* টগল / লিফ ডট */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleExpand(node.id)}
            aria-label={isExpanded ? "বন্ধ করুন" : "খুলুন"}
            className="p-0.5 rounded-md text-slate-400 hover:text-indigo-600 shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1.5" />
        )}

        {/* আইকন */}
        <span className="shrink-0 flex items-center">
          {isTop ? (
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
              📖
            </span>
          ) : hasChildren ? (
            <Folder className="w-4 h-4 text-amber-500" />
          ) : (
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          )}
        </span>

        {/* নাম + কাউন্ট */}
        <button
          type="button"
          onClick={() => {
            if (hasChildren) toggleExpand(node.id);
            else onOpenReading(node.fullPath, node.name);
          }}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer"
          title={node.fullPath}
        >
          <span
            className={`truncate font-bold text-xs sm:text-sm ${
              isTop ? "text-slate-900 font-black" : "text-slate-800"
            }`}
          >
            {node.name}
          </span>
          <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200/70 shrink-0">
            {toBengaliDigits(node.count)}
          </span>
        </button>

        {/* অ্যাকশন */}
        <span className="flex items-center gap-1 shrink-0">
          {isLocked ? (
            <button
              type="button"
              onClick={onLockedAction}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
              title="এই প্রশ্নগুলো দেখতে কোর্সে এনরোল করুন"
            >
              <Lock className="w-3 h-3" /> লক
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenReading(node.fullPath, node.name)}
                className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center cursor-pointer transition"
                title="এই অংশের সব প্রশ্ন পড়ুন"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onStartQuiz(node.fullPath, node.name)}
                className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center cursor-pointer transition"
                title="এই অংশের ওপর ইনস্ট্যান্ট কুইজ দিন"
              >
                <Zap className="w-3 h-3 fill-white" />
              </button>
            </>
          )}
        </span>
      </div>
    );
  };

  // শীর্ষ স্তর: কার্ড হিসেবে
  if (depth === 0) {
    return (
      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {tree.map((node) => (
          <div
            key={node.id}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            {renderNodeBar(node, true)}
            {node.children && node.children.length > 0 && expandedNodes[node.id] && (
              <div className="px-2 sm:px-3 pb-2">
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

  // গভীর স্তর: পরিষ্কার, বক্স-মুক্ত রো (সঠিক ইন্ডেন্টেশনসহ)
  return (
    <div className="space-y-0.5 ml-2 sm:ml-4 border-l-2 border-indigo-100 pl-2 sm:pl-3">
      {tree.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes[node.id] ?? false;

        return (
          <div key={node.id}>
            {renderNodeBar(node, false)}
            {hasChildren && isExpanded && (
              <div className="pb-1">
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
