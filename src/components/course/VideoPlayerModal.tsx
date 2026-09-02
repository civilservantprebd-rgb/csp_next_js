"use client";

import React, { useEffect } from "react";
import { X, PlayCircle, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { CourseVideo } from "@/types/video";
import { toBengaliDigits } from "@/lib/utils";

interface VideoPlayerModalProps {
  video: CourseVideo | null;
  playlist: CourseVideo[]; // একই সাবজেক্টের ভিডিও (একই প্লেলিস্ট)
  onClose: () => void;
  onSelect: (v: CourseVideo) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, playlist, onClose, onSelect }) => {
  // Esc চাপলে বন্ধ + খোলা থাকলেই স্ক্রল লক (ভিডিও বন্ধ থাকলে লক নয়!)
  useEffect(() => {
    if (!video) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [video, onClose]);

  if (!video) return null;

  const idx = playlist.findIndex((v) => v.id === video.id);
  const prevVideo = idx > 0 ? playlist[idx - 1] : null;
  const nextVideo = idx >= 0 && idx < playlist.length - 1 ? playlist[idx + 1] : null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-bengali animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-950 rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Player */}
        <div className="aspect-video w-full bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1&color=white&autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Info bar */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-black text-sm sm:text-lg leading-snug">{video.title}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {video.subject && (
                  <span className="bg-sky-500/15 text-sky-300 border border-sky-400/30 text-xs font-bold px-2 py-0.5 rounded-md">
                    {video.subject}
                  </span>
                )}
                <span className="text-slate-500 text-xs">
                  {playlist.length > 0 && <>প্লেলিস্টে {toBengaliDigits(idx + 1)} / {toBengaliDigits(playlist.length)}</>}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {video.description && (
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{video.description}</p>
          )}

          {/* Prev / Next */}
          <div className="flex items-center gap-2">
            {prevVideo ? (
              <button
                onClick={() => onSelect(prevVideo)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> আগের ক্লাস
              </button>
            ) : (
              <span />
            )}
            {nextVideo && (
              <button
                onClick={() => onSelect(nextVideo)}
                className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                পরের ক্লাস <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Same-subject playlist quick switch */}
          {playlist.length > 1 && (
            <div className="border-t border-slate-800 pt-3">
              <p className="text-sm font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <PlayCircle className="w-3.5 h-3.5 text-indigo-400" /> এই প্লেলিস্টের আরও ভিডিও ({toBengaliDigits(playlist.length)}টি)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {playlist.map((v) => {
                  const isActive = v.id === video.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => onSelect(v)}
                      className={`w-40 shrink-0 text-left rounded-xl overflow-hidden border transition cursor-pointer ${
                        isActive ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                          alt=""
                          className="w-full h-20 object-cover bg-slate-900"
                        />
                        {isActive && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          </span>
                        )}
                      </div>
                      <p className="px-2 py-1.5 text-xs font-bold text-slate-300 line-clamp-2 leading-snug">{v.title}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
