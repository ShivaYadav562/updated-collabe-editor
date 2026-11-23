import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Clock3, Pause, ChevronRight } from "lucide-react";
import { useStudyTimer } from "../../context/StudyTimerContext";

export default function FloatingTimerWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isRunning,
    isPaused,
    elapsedSeconds,
    formatTime,
    sessionType,
    SESSION_TYPES,
  } = useStudyTimer();

  // Only show when timer is active and user is outside /dashboard
  if (!isRunning || location.pathname === "/dashboard") {
    return null;
  }

  const typeLabel =
    SESSION_TYPES.find((t) => t.id === sessionType)?.label || "Study Session";

  return (
    <div
      onClick={() => navigate("/dashboard")}
      title="Click to view Study Session on Dashboard"
      className="fixed bottom-5 right-5 z-50 flex cursor-pointer items-center gap-3 rounded-full border border-[#383838] bg-[#141414]/95 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all hover:border-zinc-400 hover:scale-105"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-zinc-200">
        <Clock3 size={15} />
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold text-white">
          {formatTime(elapsedSeconds)}
        </span>

        {isPaused ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            <Pause size={10} /> Paused
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {typeLabel}
          </span>
        )}
      </div>

      <ChevronRight size={14} className="text-zinc-500" />
    </div>
  );
}
