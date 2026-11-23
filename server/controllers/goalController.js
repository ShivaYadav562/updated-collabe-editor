const mongoose = require("mongoose");
const DailyGoal = require("../models/DailyGoal");
const StudentActivity = require("../models/StudentActivity");
const { getLocalDateString } = require("../services/streakService");

/**
 * GET /api/dashboard/goals
 * Query: date (optional, defaults to today YYYY-MM-DD)
 */
async function getGoals(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const targetDate = req.query.date || getLocalDateString();

    const goals = await DailyGoal.find({ user: userId, targetDate }).sort({
      createdAt: 1,
    });

    const total = goals.length;
    const completed = goals.filter((g) => g.completed).length;

    return res.json({
      success: true,
      data: {
        date: targetDate,
        total,
        completed,
        goals,
      },
    });
  } catch (error) {
    console.error("Get goals error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch daily goals.",
      error: error.message,
    });
  }
}

/**
 * POST /api/dashboard/goals
 * Body: { title, targetDurationMinutes, targetDate }
 */
async function createGoal(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { title, targetDurationMinutes = 0, targetDate } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Goal title is required.",
      });
    }

    const trimmedTitle = title.trim();
    const date = targetDate || getLocalDateString();

    // Check for duplicate goal on the same day
    const existing = await DailyGoal.findOne({
      user: userId,
      targetDate: date,
      title: trimmedTitle,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A goal with this title already exists for the specified date.",
        data: existing,
      });
    }

    const goal = await DailyGoal.create({
      user: userId,
      title: trimmedTitle,
      targetDurationMinutes: Math.max(0, Number(targetDurationMinutes) || 0),
      targetDate: date,
    });

    return res.status(201).json({
      success: true,
      message: "Daily goal created successfully.",
      data: goal,
    });
  } catch (error) {
    console.error("Create goal error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create daily goal.",
      error: error.message,
    });
  }
}

/**
 * PATCH /api/dashboard/goals/:id/toggle
 * Toggles goal completion state
 */
async function toggleGoal(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID.",
      });
    }

    const goal = await DailyGoal.findOne({ _id: id, user: userId });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found.",
      });
    }

    goal.completed = !goal.completed;
    goal.completedAt = goal.completed ? new Date() : null;
    await goal.save();

    // If marked completed, log student activity
    if (goal.completed) {
      await StudentActivity.create({
        user: userId,
        activityType: "goal_completed",
        dateString: goal.targetDate,
        details: {
          topicTitle: goal.title,
          durationMinutes: goal.targetDurationMinutes,
          metadata: { goalId: goal._id },
        },
      }).catch((err) => console.warn("Activity log ignored:", err.message));
    }

    return res.json({
      success: true,
      message: `Goal marked as ${goal.completed ? "completed" : "incomplete"}.`,
      data: goal,
    });
  } catch (error) {
    console.error("Toggle goal error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update goal status.",
      error: error.message,
    });
  }
}

/**
 * DELETE /api/dashboard/goals/:id
 */
async function deleteGoal(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID.",
      });
    }

    const deleted = await DailyGoal.findOneAndDelete({ _id: id, user: userId });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Goal not found.",
      });
    }

    return res.json({
      success: true,
      message: "Goal deleted successfully.",
    });
  } catch (error) {
    console.error("Delete goal error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete goal.",
      error: error.message,
    });
  }
}

module.exports = {
  getGoals,
  createGoal,
  toggleGoal,
  deleteGoal,
};
