const StudentActivity = require("../models/StudentActivity");
const CourseProgress = require("../models/CourseProgress");
const DailyGoal = require("../models/DailyGoal");
const StudySession = require("../models/StudySession");
const { calculateStreak, getLocalDateString } = require("./streakService");

/**
 * Default course definitions matching the learning paths
 */
const DEFAULT_COURSES = [
  {
    courseSlug: "dsa",
    courseTitle: "Data Structures & Algorithms",
    tag: "DSA",
    totalItems: 150,
  },
  {
    courseSlug: "system-design",
    courseTitle: "System Design",
    tag: "DESIGN",
    totalItems: 25,
  },
  {
    courseSlug: "web-development",
    courseTitle: "Web Development",
    tag: "DEVELOPMENT",
    totalItems: 24,
  },
  {
    courseSlug: "interview-prep",
    courseTitle: "Interview Preparation",
    tag: "CAREER",
    totalItems: 20,
  },
];

/**
 * Aggregates complete dashboard metrics for an authenticated user
 */
async function getDashboardData(userId) {
  const today = getLocalDateString();

  const [
    streakInfo,
    dsaSolvedCount,
    studySessions,
    todayGoals,
    userCourseProgress,
    recentActivities,
  ] = await Promise.all([
    // 1. Streak
    calculateStreak(userId),

    // 2. DSA Problems solved count
    StudentActivity.countDocuments({
      user: userId,
      activityType: "dsa_solved",
    }),

    // 3. Study session total minutes
    StudySession.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, totalMinutes: { $sum: "$durationMinutes" } } },
    ]),

    // 4. Today's goals
    DailyGoal.find({ user: userId, targetDate: today }).sort({ createdAt: 1 }),

    // 5. Course progress documents
    CourseProgress.find({ user: userId }),

    // 6. Recent activities (latest 10)
    StudentActivity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Compute total study hours
  const totalMinutes =
    studySessions.length > 0 ? studySessions[0].totalMinutes : 0;
  const studyHours = Number((totalMinutes / 60).toFixed(1));

  // Reconcile DSA solved count: use the larger of activity-log count vs
  // completed items in CourseProgress (they should agree, but handle drift).
  const dsaCourseProgress = userCourseProgress.find(
    (cp) => cp.courseSlug === "dsa"
  );
  const dsaCountFromCourse = dsaCourseProgress
    ? dsaCourseProgress.completedItems.length
    : 0;
  const totalProblemsPracticed = Math.max(dsaSolvedCount, dsaCountFromCourse);

  // Compute goal stats for today
  const totalTodayGoals = todayGoals.length;
  const completedTodayGoals = todayGoals.filter((g) => g.completed).length;

  // Merge default course structure with user's saved progress
  const progressMap = new Map();
  userCourseProgress.forEach((cp) => {
    progressMap.set(cp.courseSlug, cp);
  });

  const coursesSummary = DEFAULT_COURSES.map((def) => {
    const saved = progressMap.get(def.courseSlug);
    const completedCount = saved ? saved.completedItems.length : 0;
    const totalCount = saved && saved.totalItems > 0 ? saved.totalItems : def.totalItems;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      courseSlug: def.courseSlug,
      title: def.courseTitle,
      tag: def.tag,
      completedCount,
      totalCount,
      progressPercentage: progress,
      completedLabel: `${completedCount} / ${totalCount} topics`,
      lastAccessedAt: saved?.lastAccessedAt || null,
    };
  });

  return {
    overview: {
      problemsPracticed: totalProblemsPracticed,
      studyTimeHours: studyHours,
      studyTimeMinutes: Math.round(totalMinutes),
      studyTimeFormatted: `${studyHours} hrs`,
      goalsSummary: {
        completed: completedTodayGoals,
        total: totalTodayGoals,
        label: `${completedTodayGoals} / ${totalTodayGoals}`,
      },
      currentStreak: streakInfo.currentStreak,
      longestStreak: streakInfo.longestStreak,
      activeToday: streakInfo.activeToday,
      isActiveToday: streakInfo.isActiveToday,
      lastActiveDate: streakInfo.lastActiveDate,
      totalActiveDays: streakInfo.totalActiveDays,
      weeklyActivity: streakInfo.weeklyActivity,
    },
    streak: streakInfo,
    todayGoals: todayGoals.map((g) => ({
      id: g._id,
      title: g.title,
      targetDurationMinutes: g.targetDurationMinutes,
      completed: g.completed,
      completedAt: g.completedAt,
      targetDate: g.targetDate,
    })),
    coursesProgress: coursesSummary,
    recentActivities: recentActivities.map((act) => ({
      id: act._id,
      activityType: act.activityType,
      dateString: act.dateString,
      createdAt: act.createdAt,
      details: act.details,
    })),
  };
}

module.exports = {
  DEFAULT_COURSES,
  getDashboardData,
};
