const mongoose = require("mongoose");
const StudySession = require("../models/StudySession");
const StudentActivity = require("../models/StudentActivity");
const { getLocalDateString } = require("../services/streakService");

/**
 * POST /api/dashboard/study-session
 * Body: { durationMinutes, sessionType, roomId, courseSlug, topicTitle }
 */
async function logStudySession(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const {
      durationMinutes,
      sessionType = "general",
      roomId,
      courseSlug,
      topicTitle,
    } = req.body;

    const validSessionTypes = ["editor_room", "dsa_practice", "course_study", "general"];
    const effectiveType = sessionType || "general";
    if (!validSessionTypes.includes(effectiveType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid session type. Valid types are: ${validSessionTypes.join(", ")}`,
      });
    }

    const duration = Number(durationMinutes);
    if (!duration || duration <= 0 || isNaN(duration)) {
      return res.status(400).json({
        success: false,
        message: "A positive duration in minutes is required.",
      });
    }

    if (duration < 0.1) {
      return res.status(400).json({
        success: false,
        message: "Duration must be at least 0.1 minutes (approx 6 seconds).",
      });
    }

    if (duration > 720) {
      return res.status(400).json({
        success: false,
        message: "Duration cannot exceed 720 minutes (12 hours) per session.",
      });
    }

    const today = getLocalDateString();

    const session = await StudySession.create({
      user: userId,
      sessionType: effectiveType,
      durationMinutes: duration,
      dateString: today,
      metadata: {
        roomId: roomId ? String(roomId).trim() : undefined,
        courseSlug: courseSlug ? String(courseSlug).trim() : undefined,
        topicTitle: topicTitle ? String(topicTitle).trim() : undefined,
      },
    });

    // Also log to StudentActivity to maintain streak
    await StudentActivity.create({
      user: userId,
      activityType: "study_session",
      dateString: today,
      details: {
        durationMinutes: duration,
        metadata: {
          sessionId: session._id,
          sessionType,
          roomId,
        },
      },
    }).catch((err) => console.warn("Activity log ignored:", err.message));

    return res.status(201).json({
      success: true,
      message: "Study session recorded successfully.",
      data: session,
    });
  } catch (error) {
    console.error("Log study session error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record study session.",
      error: error.message,
    });
  }
}

/**
 * GET /api/dashboard/study-time
 * Returns aggregated study time stats for the authenticated user
 */
async function getStudyTime(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const today = getLocalDateString();
    const [totalAgg, todayAgg, typeAgg] = await Promise.all([
      StudySession.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, totalMinutes: { $sum: "$durationMinutes" } } },
      ]),
      StudySession.aggregate([
        { $match: { user: userId, dateString: today } },
        { $group: { _id: null, todayMinutes: { $sum: "$durationMinutes" } } },
      ]),
      StudySession.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: "$sessionType",
            totalMinutes: { $sum: "$durationMinutes" },
            sessionCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalMinutes = totalAgg.length > 0 ? totalAgg[0].totalMinutes : 0;
    const totalHours = Number((totalMinutes / 60).toFixed(1));

    const todayMinutes = todayAgg.length > 0 ? todayAgg[0].todayMinutes : 0;
    const todayHours = Number((todayMinutes / 60).toFixed(1));

    return res.json({
      success: true,
      data: {
        totalMinutes: Math.round(totalMinutes),
        totalHours,
        formatted: `${totalHours} hrs`,
        todayMinutes: Math.round(todayMinutes),
        todayHours,
        todayFormatted: `${todayHours} hrs`,
        bySessionType: typeAgg.map((item) => ({
          type: item._id,
          totalMinutes: Math.round(item.totalMinutes),
          totalHours: Number((item.totalMinutes / 60).toFixed(1)),
          sessionCount: item.sessionCount,
        })),
      },
    });
  } catch (error) {
    console.error("Get study time error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve study time.",
      error: error.message,
    });
  }
}

module.exports = {
  logStudySession,
  getStudyTime,
};
