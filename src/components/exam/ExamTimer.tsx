"use client";

import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { getTrueNowMs } from "@/lib/bangladesh-time";

interface ExamTimerProps {
  initialSeconds: number;
  onTimeExpire: () => void;
  onTimeUpdate?: (secondsLeft: number) => void;
}

export const ExamTimer: React.FC<ExamTimerProps> = ({
  initialSeconds,
  onTimeExpire,
  onTimeUpdate
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    const endServerTime = getTrueNowMs() + initialSeconds * 1000;

    const interval = setInterval(() => {
      const remainingMs = Math.max(0, endServerTime - getTrueNowMs());
      const remainingSecs = Math.ceil(remainingMs / 1000);

      setSecondsRemaining(remainingSecs);
      if (onTimeUpdate) {
        onTimeUpdate(remainingSecs);
      }

      if (remainingMs <= 0) {
        clearInterval(interval);
        onTimeExpire();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [initialSeconds, onTimeExpire, onTimeUpdate]);

  const m = Math.max(0, Math.floor(secondsRemaining / 60));
  const s = Math.max(0, secondsRemaining % 60);
  const timeFormatted = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-1.5 rounded-xl font-mono font-bold text-xs sm:text-sm border border-rose-100 shadow-sm">
      <Clock className="w-4 h-4 text-rose-600 animate-pulse" />
      <span>{timeFormatted}</span>
    </div>
  );
};
