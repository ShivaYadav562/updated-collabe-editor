import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { logStudySession } from "../services/dashboardApi";

const STORAGE_KEY = "study-session-active";

const SESSION_TYPES = [
  { id: "dsa_practice", label: "DSA Practice" },
  { id: "course_study", label: "Course Study" },
  { id: "general", label: "General Study" },
  { id: "editor_room", label: "Editor Room" },
];

const StudyTimerContext = createContext(null);

export function StudyTimerProvider({ children }) {
  const [sessionType, setSessionType] = useState("dsa_practice");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const timerRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const accumulatedRef = useRef(0);

  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = useCallback((totalSecs) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const pad = (num) => String(num).padStart(2, "0");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }, []);

  // Sync state to localStorage
  const saveStateToStorage = useCallback(
    (running, paused, accumulated, lastStart, type) => {
      try {
        if (!running && accumulated === 0) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              isRunning: running,
              isPaused: paused,
              accumulatedSeconds: accumulated,
              lastStartedAt: lastStart,
              sessionType: type,
              updatedAt: Date.now(),
            })
          );
        }
      } catch (e) {
        console.warn("Could not save timer to localStorage", e);
      }
    },
    []
  );

  // Restore session from localStorage on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sessionType) {
          setSessionType(parsed.sessionType);
        }

        if (parsed.isRunning) {
          let currentElapsed = parsed.accumulatedSeconds || 0;
          if (!parsed.isPaused && parsed.lastStartedAt) {
            const added = Math.floor((Date.now() - parsed.lastStartedAt) / 1000);
            if (added > 0) {
              currentElapsed += added;
            }
          }

          accumulatedRef.current = currentElapsed;
          setElapsedSeconds(currentElapsed);
          setIsRunning(true);
          setIsPaused(Boolean(parsed.isPaused));
          lastTickRef.current = Date.now();
        } else if (parsed.accumulatedSeconds > 0) {
          accumulatedRef.current = parsed.accumulatedSeconds;
          setElapsedSeconds(parsed.accumulatedSeconds);
          setIsPaused(true);
          setIsRunning(true);
        }
      }
    } catch (e) {
      console.warn("Failed to restore timer state", e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Master timer interval - runs at root level, never interrupted by route changes
  useEffect(() => {
    if (isRunning && !isPaused) {
      lastTickRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = Math.floor((now - lastTickRef.current) / 1000);
        if (delta >= 1) {
          accumulatedRef.current += delta;
          setElapsedSeconds(accumulatedRef.current);
          lastTickRef.current = now;
          // Sync state with updated timestamp
          saveStateToStorage(
            true,
            false,
            accumulatedRef.current,
            now,
            sessionType
          );
        }
      }, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, isPaused, sessionType, saveStateToStorage]);

  // Start
  const handleStart = () => {
    const now = Date.now();
    lastTickRef.current = now;
    setIsRunning(true);
    setIsPaused(false);
    setStatusMessage(null);
    saveStateToStorage(true, false, accumulatedRef.current, now, sessionType);
  };

  // Pause
  const handlePause = () => {
    setIsPaused(true);
    saveStateToStorage(
      true,
      true,
      accumulatedRef.current,
      Date.now(),
      sessionType
    );
  };

  // Resume
  const handleResume = () => {
    const now = Date.now();
    lastTickRef.current = now;
    setIsPaused(false);
    saveStateToStorage(true, false, accumulatedRef.current, now, sessionType);
  };

  // Reset without saving
  const handleReset = () => {
    if (isRunning && elapsedSeconds > 10) {
      const confirmReset = window.confirm(
        "Discard this study session without saving?"
      );
      if (!confirmReset) return;
    }
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    accumulatedRef.current = 0;
    saveStateToStorage(false, false, 0, null, sessionType);
    setStatusMessage(null);
  };

  // Stop & Save to MongoDB
  const handleStopAndSave = async (onSaveCallback) => {
    if (isSubmitting) return;

    const totalSeconds = accumulatedRef.current;
    const durationMinutes = Number((totalSeconds / 60).toFixed(2));

    if (durationMinutes < 0.1) {
      setStatusMessage({
        type: "info",
        text: "Session too short to record (less than 6 seconds).",
      });
      setIsRunning(false);
      setIsPaused(false);
      setElapsedSeconds(0);
      accumulatedRef.current = 0;
      saveStateToStorage(false, false, 0, null, sessionType);
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      let saveResult = null;
      if (onSaveCallback) {
        saveResult = await onSaveCallback(durationMinutes, sessionType);
      } else {
        saveResult = await logStudySession({ durationMinutes, sessionType });
      }

      setStatusMessage({
        type: "success",
        text: `Logged ${durationMinutes} min of ${
          SESSION_TYPES.find((t) => t.id === sessionType)?.label || "study"
        }!`,
      });

      setIsRunning(false);
      setIsPaused(false);
      setElapsedSeconds(0);
      accumulatedRef.current = 0;
      saveStateToStorage(false, false, 0, null, sessionType);
      return saveResult;
    } catch (err) {
      console.error("Error saving study session:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to record study session. Please try again.",
      });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSessionTypeChange = (newType) => {
    setSessionType(newType);
    saveStateToStorage(
      isRunning,
      isPaused,
      accumulatedRef.current,
      lastTickRef.current,
      newType
    );
  };

  const value = {
    sessionType,
    setSessionType: handleSessionTypeChange,
    isRunning,
    isPaused,
    elapsedSeconds,
    isSubmitting,
    statusMessage,
    setStatusMessage,
    formatTime,
    handleStart,
    handlePause,
    handleResume,
    handleReset,
    handleStopAndSave,
    SESSION_TYPES,
  };

  return (
    <StudyTimerContext.Provider value={value}>
      {children}
    </StudyTimerContext.Provider>
  );
}

export function useStudyTimer() {
  const context = useContext(StudyTimerContext);
  if (!context) {
    throw new Error("useStudyTimer must be used within a StudyTimerProvider");
  }
  return context;
}
