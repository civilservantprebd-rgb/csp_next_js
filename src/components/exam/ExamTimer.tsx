"use client";

import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface ExamTimerProps {
  initialMinutes: number;
  onTimeExpire: () => void;
  onTimeUpdate?: (secondsLeft: number) => void;
}

export const ExamTimer: React.FC<ExamTimerProps> = ({
  initialMinutes,
  onTimeExpire,
  onTimeUpdate
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialMinutes * 60);

  useEffect(() => {
    const totalDurationSecs = initialMinutes * 60;
    const endTime = performance.now() + totalDurationSecs * 1000;

    const interval = setInterval(() => {
      const remainingMs = Math.max(0, endTime - performance.now());
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
  }, [initialMinutes, onTimeExpire, onTimeUpdate]);

  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  const timeFormatted = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-1.5 rounded-xl font-mono font-bold text-xs sm:text-sm border border-rose-100 shadow-sm">
      <Clock className="w-4 h-4 text-rose-600 animate-pulse" />
      <span>{timeFormatted}</span>
    </div>
  );
};
