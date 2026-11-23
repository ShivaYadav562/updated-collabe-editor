const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const { getOverview, getStreak } = require("../controllers/dashboardController");
const {
  getGoals,
  createGoal,
  toggleGoal,
  deleteGoal,
} = require("../controllers/goalController");
const {
  getProgress,
  getCourseProgressBySlug,
  completeTopic,
  recordTopicAccess,
  batchSyncDsa,
} = require("../controllers/progressController");
const {
  logStudySession,
  getStudyTime,
} = require("../controllers/sessionController");

const router = express.Router();

// Require authentication for all dashboard routes
router.use(authMiddleware);

// 1. Overview & Statistics
router.get("/overview", getOverview);
router.get("/streak", getStreak);

// 2. Daily Goals
router.get("/goals", getGoals);
router.post("/goals", createGoal);
router.patch("/goals/:id/toggle", toggleGoal);
router.delete("/goals/:id", deleteGoal);

// 3. Course Progress & Topic Completions
router.get("/progress", getProgress);
router.post("/progress/dsa/batch-sync", batchSyncDsa);
router.get("/progress/:courseSlug", getCourseProgressBySlug);
router.post("/progress/:courseSlug/complete-topic", completeTopic);
router.post("/progress/:courseSlug/access-topic", recordTopicAccess);

// 4. Study Sessions & Time Tracking
router.post("/study-session", logStudySession);
router.get("/study-time", getStudyTime);

module.exports = router;
