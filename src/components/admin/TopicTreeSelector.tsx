"use client";

import React, { useState, useMemo } from "react";
import {
  Folder,
  FolderPlus,
  Plus,
  ChevronRight,
  ChevronDown,
  Layers,
  Check,
  X,
  Sparkles,
  Tag,
  CheckCircle2
} from "lucide-react";
import { buildDeepTopicTree, TreeNode, getTopicSegments } from "@/lib/topic-hierarchy";
import { saveAppConfig } from "@/actions/admin-actions";

interface TopicTreeSelectorProps {
  selectedTopicPath: string;
  onSelectTopicPath: (path: string) => void;
  topics: string[];
  onTopicsUpdated?: (newTopics: string[]) => void;
  className?: string;
  label?: string;
  helperText?: string;
}

export const TopicTreeSelector: React.FC<TopicTreeSelectorProps> = ({
  selectedTopicPath,
  onSelectTopicPath,
  topics = [],
  onTopicsUpdated,
  className = "",
  label = "টপিক ও সাব-টপিক নির্বাচন",
  helperText = "যেকোনো টপিক/সাব-টপিক সিলেক্ট করুন অথবা নতুন যুক্ত করুন"
}) => {
  // Modal / Inline Add Node State
  const [addingParentPath, setAddingParentPath] = useState<string | null>(null); // null means root topic
  const [newNodeName, setNewNodeName] = useState("");
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});

  // Build hierarchical tree from registered topics
  const tree = useMemo(() => {
    return buildDeepTopicTree({
      topics: topics,
      courses: [],
      subjects: [],
      exams: {},
      topicQuestions: []
    });
  }, [topics]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  // Add new topic / subtopic / sub-subtopic
  const handleAddNewNode = async (parentPath: string | null) => {
    const rawName = newNodeName.trim();
    if (!rawName) return;

    // Construct full path
    const fullPath = parentPath ? `${parentPath} > ${rawName}` : rawName;

    // Check if topic already exists or prefix exists
    const currentTopics = [...topics];
    const exists = currentTopics.some(
      (t) => t.trim().toLowerCase() === fullPath.trim().toLowerCase()
    );

    if (exists) {
      // Just select the existing one
      onSelectTopicPath(fullPath);
      setNewNodeName("");
      setAddingParentPath(null);
      setIsAddingRoot(false);
      return;
    }

    setIsSaving(true);
    const updatedTopics = Array.from(new Set([...currentTopics, fullPath]));

    const success = await saveAppConfig({ topics: updatedTopics });
    setIsSaving(false);

    if (success) {
      if (onTopicsUpdated) {
        onTopicsUpdated(updatedTopics);
      }
      onSelectTopicPath(fullPath);
      if (parentPath) {
        setExpandedPaths((prev) => ({ ...prev, [parentPath]: true }));
      }
    } else {
      alert("টপিক সংরক্ষণ করতে সমস্যা হয়েছে।");
    }

    setNewNodeName("");
    setAddingParentPath(null);
    setIsAddingRoot(false);
  };

  // Render recursive tree branch
  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    if (!nodes || nodes.length === 0) return null;

    return (
      <div className={`space-y-1 ${depth > 0 ? "ml-3 sm:ml-4 pl-2.5 border-l-2 border-indigo-100" : ""}`}>
        {nodes.map((node) => {
          const isSelected =
            selectedTopicPath.trim().toLowerCase() === node.fullPath.trim().toLowerCase();
          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = expandedPaths[node.fullPath] ?? (depth === 0 || isSelected);
          const isAddingChild = addingParentPath === node.fullPath;

          return (
            <div key={node.fullPath} className="group text-xs">
              <div
                className={`p-2 rounded-xl border flex items-center justify-between gap-1.5 transition ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                    : "bg-white border-slate-200/90 text-slate-800 hover:border-indigo-300 hover:bg-slate-50"
                }`}
              >
                {/* Node Click / Expand */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(node.fullPath);
                      }}
                      className={`p-0.5 rounded hover:bg-black/10 transition cursor-pointer ${
                        isSelected ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${
                        isSelected ? "bg-white" : "bg-indigo-500"
                      }`}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectTopicPath(node.fullPath)}
                    className="flex items-center gap-1.5 truncate flex-1 text-left font-bold cursor-pointer"
                    title={node.fullPath}
                  >
                    {depth === 0 ? (
                      <span className="text-xs">📂</span>
                    ) : hasChildren ? (
                      <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    ) : (
                      <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : "text-indigo-600"}`} />
                    )}
                    <span className="truncate">{node.name}</span>
                  </button>
                </div>

                {/* Actions: Select Indicator & Add Subtopic Button */}
                <div className="flex items-center gap-1 shrink-0">
                  {isSelected && (
                    <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> নির্বাচিত
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingParentPath(isAddingChild ? null : node.fullPath);
                      setNewNodeName("");
                    }}
                    title="এই টপিকের ভেতর নতুন সাব-টপিক যোগ করুন"
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60"
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    <span className="hidden sm:inline">সাব-টপিক</span>
                  </button>
                </div>
              </div>

              {/* Inline Add Child Input */}
              {isAddingChild && (
                <div className="mt-1.5 ml-4 p-2 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                  <input
                    type="text"
                    autoFocus
                    placeholder={`"${node.name}" এর নতুন সাব-টপিক...`}
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewNode(node.fullPath);
                      } else if (e.key === "Escape") {
                        setAddingParentPath(null);
                      }
                    }}
                    className="flex-1 px-2.5 py-1 text-xs bg-white rounded-lg border border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={isSaving || !newNodeName.trim()}
                    onClick={() => handleAddNewNode(node.fullPath)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? "..." : "যোগ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingParentPath(null);
                      setNewNodeName("");
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Recursive Children */}
              {hasChildren && isExpanded && (
                <div className="mt-1">{renderTreeNodes(node.children, depth + 1)}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`space-y-2 font-bengali ${className}`}>
      {/* Header & Selected Topic Display */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div>
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-600" /> {label}
          </label>
          <p className="text-[11px] text-slate-500">{helperText}</p>
        </div>

        {/* Add Main Topic Button */}
        {!isAddingRoot && (
          <button
            type="button"
            onClick={() => {
              setIsAddingRoot(true);
              setNewNodeName("");
            }}
            className="self-start sm:self-auto bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>+ নতুন প্রধান টপিক</span>
          </button>
        )}
      </div>

      {/* Adding Root Topic Input */}
      {isAddingRoot && (
        <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-2 animate-in fade-in">
          <input
            type="text"
            autoFocus
            placeholder="নতুন প্রধান টপিকের নাম (যেমন: বাংলাদেশ বিষয়াবলী)..."
            value={newNodeName}
            onChange={(e) => setNewNodeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNewNode(null);
              } else if (e.key === "Escape") {
                setIsAddingRoot(false);
              }
            }}
            className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-white rounded-xl border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            disabled={isSaving || !newNodeName.trim()}
            onClick={() => handleAddNewNode(null)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? "সংরক্ষণ হচ্ছে..." : "যুক্ত করুন"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingRoot(false);
              setNewNodeName("");
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Currently Selected Topic Badge */}
      <div className="p-2.5 bg-slate-100/80 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-slate-500 shrink-0 font-medium">নির্ধারিত টপিক:</span>
          {selectedTopicPath ? (
            <span className="font-bold text-indigo-800 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-100 truncate shadow-2xs">
              {selectedTopicPath}
            </span>
          ) : (
            <span className="text-slate-400 italic">কোনো টপিক নির্বাচিত নেই</span>
          )}
        </div>
        {selectedTopicPath && (
          <button
            type="button"
            onClick={() => onSelectTopicPath("")}
            className="text-[10px] text-rose-600 hover:underline font-bold shrink-0 cursor-pointer"
          >
            ক্লিয়ার করুন
          </button>
        )}
      </div>

      {/* Topic Hierarchy Tree Container */}
      <div className="max-h-56 overflow-y-auto p-2 bg-slate-50/50 rounded-2xl border border-slate-200/90 space-y-1">
        {tree.length === 0 ? (
          <div className="text-center py-6 text-slate-400 space-y-1">
            <Layers className="w-6 h-6 mx-auto text-slate-300" />
            <p className="text-xs">কোনো টপিক তৈরি করা নেই।</p>
            <p className="text-[11px]">উপরের "+ নতুন প্রধান টপিক" বাটনে ক্লিক করে তৈরি করুন।</p>
          </div>
        ) : (
          renderTreeNodes(tree)
        )}
      </div>
    </div>
  );
};
