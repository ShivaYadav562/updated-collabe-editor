const mongoose = require("mongoose");
const { getDashboardData } = require("../services/dashboardService");
const { calculateStreak } = require("../services/streakService");

/**
 * GET /api/dashboard/overview
 * Returns all dashboard metrics aggregated for the authenticated user
 */
async function getOverview(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const data = await getDashboardData(userId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard overview.",
      error: error.message,
    });
  }
}

/**
 * GET /api/dashboard/streak
 * Returns detailed streak statistics for the authenticated user
 */
async function getStreak(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const streak = await calculateStreak(userId);

    return res.json({
      success: true,
      data: streak,
    });
  } catch (error) {
    console.error("Dashboard streak error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve streak data.",
      error: error.message,
    });
  }
}

module.exports = {
  getOverview,
  getStreak,
};
