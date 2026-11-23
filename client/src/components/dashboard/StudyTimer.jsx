import React from "react";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useStudyTimer } from "../../context/StudyTimerContext";

export default function StudyTimer({ onSessionComplete }) {
  const {
    sessionType,
    setSessionType,
    isRunning,
    isPaused,
    elapsedSeconds,
    isSubmitting,
    statusMessage,
    formatTime,
    handleStart,
    handlePause,
    handleResume,
    handleReset,
    handleStopAndSave,
    SESSION_TYPES,
  } = useStudyTimer();

  const onStopClick = () => {
    handleStopAndSave(onSessionComplete);
  };

  return (
    <div className="rounded-2xl border border-[#303030] bg-[#1a1a1a] p-5 sm:p-6 transition duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              REAL-TIME TRACKING
            </span>
            {isRunning && !isPaused && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            )}
            {isRunning && isPaused && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                Paused
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold text-white">
            Study Session Timer
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Track active study time to update your streak and dashboard metrics.
          </p>
        </div>

        {/* Session Type Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="session-type-select" className="text-xs text-zinc-400">
            Type:
          </label>
          <select
            id="session-type-select"
            value={sessionType}
            disabled={isRunning && !isPaused}
            onChange={(e) => setSessionType(e.target.value)}
            className="rounded-xl border border-[#303030] bg-[#090a0c] px-3 py-2 text-xs font-medium text-zinc-200 outline-none transition focus:border-white/25 disabled:opacity-60"
          >
            {SESSION_TYPES.map((type) => (
              <option key={type.id} value={type.id} className="bg-[#141414]">
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Timer Display and Controls */}
      <div className="mt-6 flex flex-col items-center justify-between gap-5 rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] p-5 sm:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#303030] bg-white/[0.04] text-zinc-200">
            <Clock3 size={24} strokeWidth={1.7} />
          </div>

          <div>
            <div className="font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {formatTime(elapsedSeconds)}
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {isRunning
                ? isPaused
                  ? "Timer is paused"
                  : "Session in progress (runs across pages)"
                : "Ready to start session"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex w-full flex-wrap items-center justify-center gap-2.5 sm:w-auto">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
            >
              <Play size={14} fill="currentColor" />
              <span>Start Session</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleResume}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 active:scale-95"
                >
                  <Play size={14} fill="currentColor" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#383838] bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.1] active:scale-95"
                >
                  <Pause size={14} />
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                onClick={onStopClick}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Square size={13} fill="currentColor" />
                )}
                <span>{isSubmitting ? "Saving..." : "Stop & Save"}</span>
              </button>

              <button
                type="button"
                title="Reset timer without saving"
                onClick={handleReset}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-xl border border-[#303030] bg-[#141414] p-2 text-zinc-400 transition hover:text-white disabled:opacity-40"
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status / feedback message */}
      {statusMessage && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs ${
            statusMessage.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : statusMessage.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-400"
              : "border-blue-500/20 bg-blue-500/10 text-blue-400"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 size={15} className="shrink-0" />
          ) : (
            <AlertCircle size={15} className="shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
