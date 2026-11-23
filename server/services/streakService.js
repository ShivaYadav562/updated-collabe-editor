const StudentActivity = require("../models/StudentActivity");
const StudySession = require("../models/StudySession");

const TIMEZONE = "Asia/Kolkata";

/**
 * Returns formatted date string YYYY-MM-DD in Asia/Kolkata timezone
 */
function getLocalDateString(date = new Date()) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Calculates date string for offset in days (e.g. -1 for yesterday) in Asia/Kolkata timezone
 */
function getOffsetDateString(offsetDays, baseDate = new Date()) {
  const baseStr = getLocalDateString(baseDate);
  const [y, m, d] = baseStr.split("-").map(Number);
  const targetEpoch = Date.UTC(y, m - 1, d) + offsetDays * 86400000;
  return new Date(targetEpoch).toISOString().slice(0, 10);
}

/**
 * Converts a "YYYY-MM-DD" string into an integer day count since UTC epoch.
 * Used for reliable, timezone-safe consecutive day arithmetic.
 */
function dateStringToEpochDay(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
}

/**
 * Meaningful learning activity types that qualify for streak calculation
 */
const QUALIFYING_ACTIVITY_TYPES = [
  "dsa_solved",
  "topic_completed",
  "goal_completed",
  "study_session",
];

/**
 * Generates an array of the last 7 calendar days up to today with active indicators
 */
function generateWeeklyActivity(uniqueDatesSet, baseDate = new Date()) {
  const weekly = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 6; i >= 0; i--) {
    const dateStr = getOffsetDateString(-i, baseDate);
    const [y, m, d] = dateStr.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    weekly.push({
      date: dateStr,
      day: dayNames[dayOfWeek],
      active: uniqueDatesSet.has(dateStr),
    });
  }
  return weekly;
}

/**
 * Calculates learning streak statistics from actual qualifying study activities in MongoDB
 * @param {string|ObjectId} userId
 * @param {Date} [referenceDate] - Optional date reference (defaults to now)
 * @returns {Promise<{
 *   currentStreak: number,
 *   longestStreak: number,
 *   lastActiveDate: string|null,
 *   isActiveToday: boolean,
 *   activeToday: boolean,
 *   weeklyActivity: Array<{ date: string, day: string, active: boolean }>,
 *   totalActiveDays: number
 * }>}
 */
async function calculateStreak(userId, referenceDate = new Date()) {
  const today = getLocalDateString(referenceDate);
  const yesterday = getOffsetDateString(-1, referenceDate);

  // 1. Aggregate distinct active dates across qualifying activities and valid study sessions
  const [activityDates, sessionDates] = await Promise.all([
    StudentActivity.distinct("dateString", {
      user: userId,
      activityType: { $in: QUALIFYING_ACTIVITY_TYPES },
    }),
    StudySession.distinct("dateString", {
      user: userId,
      durationMinutes: { $gte: 0.1 },
    }),
  ]);

  const uniqueDatesSet = new Set([...activityDates, ...sessionDates]);
  const sortedDatesAsc = Array.from(uniqueDatesSet).sort();

  // If user has no activity yet
  if (sortedDatesAsc.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      isActiveToday: false,
      activeToday: false,
      weeklyActivity: generateWeeklyActivity(uniqueDatesSet, referenceDate),
      totalActiveDays: 0,
    };
  }

  const isActiveToday = uniqueDatesSet.has(today);
  const isActiveYesterday = uniqueDatesSet.has(yesterday);
  const lastActiveDate = sortedDatesAsc[sortedDatesAsc.length - 1];

  // 2. Calculate current consecutive streak
  let currentStreak = 0;
  if (isActiveToday || isActiveYesterday) {
    let checkOffset = isActiveToday ? 0 : -1;
    while (true) {
      const targetDate = getOffsetDateString(checkOffset, referenceDate);
      if (uniqueDatesSet.has(targetDate)) {
        currentStreak += 1;
        checkOffset -= 1;
      } else {
        break;
      }
    }
  }

  // 3. Calculate all-time longest streak
  let maxRun = 0;
  let currentRun = 0;
  let prevEpochDay = null;

  for (const dateStr of sortedDatesAsc) {
    const epochDay = dateStringToEpochDay(dateStr);
    if (prevEpochDay === null) {
      currentRun = 1;
    } else if (epochDay === prevEpochDay + 1) {
      currentRun += 1;
    } else if (epochDay > prevEpochDay + 1) {
      currentRun = 1;
    }

    if (currentRun > maxRun) {
      maxRun = currentRun;
    }
    prevEpochDay = epochDay;
  }

  const longestStreak = Math.max(maxRun, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastActiveDate,
    isActiveToday,
    activeToday: isActiveToday, // backward compatibility
    weeklyActivity: generateWeeklyActivity(uniqueDatesSet, referenceDate),
    totalActiveDays: uniqueDatesSet.size,
  };
}

module.exports = {
  getLocalDateString,
  getOffsetDateString,
  dateStringToEpochDay,
  generateWeeklyActivity,
  calculateStreak,
  QUALIFYING_ACTIVITY_TYPES,
  TIMEZONE,
};
