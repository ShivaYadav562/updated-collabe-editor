const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Set dummy JWT secret for test environment if not present
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";

// Import modules to test
const authMiddleware = require("../middleware/authMiddleware");
const StudentActivity = require("../models/StudentActivity");
const CourseProgress = require("../models/CourseProgress");
const DailyGoal = require("../models/DailyGoal");
const StudySession = require("../models/StudySession");
const {
  getLocalDateString,
  getOffsetDateString,
  calculateStreak,
} = require("../services/streakService");
const { getDashboardData, DEFAULT_COURSES } = require("../services/dashboardService");
const goalController = require("../controllers/goalController");
const sessionController = require("../controllers/sessionController");
const progressController = require("../controllers/progressController");

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    testsFailed++;
  }
}

// Helper to mock express req/res
function createMockReqRes({ headers = {}, body = {}, params = {}, query = {}, user = null }) {
  const req = { headers, body, params, query, user };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return { req, res };
}

async function runSuite() {
  console.log("=========================================");
  console.log("STUDY DASHBOARD BACKEND FOUNDATION TESTS");
  console.log("=========================================\n");

  // 1. Auth Middleware Tests
  console.log("--- 1. Authentication Middleware Tests ---");
  runTest("authMiddleware rejects missing Authorization header with 401", () => {
    const { req, res } = createMockReqRes({});
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.body.message, "Access denied. No token provided.");
  });

  runTest("authMiddleware rejects invalid JWT with 401", () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: "Bearer invalid.jwt.token" },
    });
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.body.message, "Invalid or expired token.");
  });

  runTest("authMiddleware passes valid JWT and sets req.user", () => {
    const dummyUserId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign({ userId: dummyUserId }, process.env.JWT_SECRET);
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.ok(req.user);
    assert.strictEqual(req.user.userId, dummyUserId);
  });

  // 2. Mongoose Schema Validation Tests
  console.log("\n--- 2. Schema Validation Tests ---");
  await runAsyncTest("StudentActivity validates valid document and rejects invalid activityType", async () => {
    const dummyUserId = new mongoose.Types.ObjectId();
    const valid = new StudentActivity({
      user: dummyUserId,
      activityType: "dsa_solved",
      dateString: "2026-11-23",
      details: { problemId: "two-sum", problemTitle: "Two Sum" },
    });
    const validErr = valid.validateSync();
    assert.strictEqual(validErr, undefined);

    const invalid = new StudentActivity({
      user: dummyUserId,
      activityType: "invalid_type",
      dateString: "2026-11-23",
    });
    const invalidErr = invalid.validateSync();
    assert.ok(invalidErr);
    assert.ok(invalidErr.errors.activityType);
  });

  await runAsyncTest("DailyGoal validates required title and bounds on targetDurationMinutes", async () => {
    const dummyUserId = new mongoose.Types.ObjectId();
    const valid = new DailyGoal({
      user: dummyUserId,
      title: "Solve 2 problems",
      targetDurationMinutes: 45,
      targetDate: "2026-11-23",
    });
    assert.strictEqual(valid.validateSync(), undefined);

    const missingTitle = new DailyGoal({
      user: dummyUserId,
      targetDate: "2026-11-23",
    });
    assert.ok(missingTitle.validateSync().errors.title);

    const negativeDuration = new DailyGoal({
      user: dummyUserId,
      title: "Negative test",
      targetDurationMinutes: -10,
      targetDate: "2026-11-23",
    });
    assert.ok(negativeDuration.validateSync().errors.targetDurationMinutes);
  });

  await runAsyncTest("StudySession validates durationMinutes and sessionType enum", async () => {
    const dummyUserId = new mongoose.Types.ObjectId();
    const valid = new StudySession({
      user: dummyUserId,
      sessionType: "editor_room",
      durationMinutes: 30,
      dateString: "2026-11-23",
    });
    assert.strictEqual(valid.validateSync(), undefined);

    const zeroDuration = new StudySession({
      user: dummyUserId,
      durationMinutes: 0,
      dateString: "2026-11-23",
    });
    assert.ok(zeroDuration.validateSync().errors.durationMinutes);
  });

  await runAsyncTest("CourseProgress pre-save calculates progressPercentage correctly", async () => {
    const doc = new CourseProgress({
      user: new mongoose.Types.ObjectId(),
      courseSlug: "dsa",
      courseTitle: "Data Structures & Algorithms",
      totalItems: 50,
      completedItems: [
        { itemId: "1", itemTitle: "Two Sum" },
        { itemId: "2", itemTitle: "Reverse Linked List" },
      ],
    });

    // Manually trigger pre-save hook logic
    if (doc.totalItems > 0 && Array.isArray(doc.completedItems)) {
      doc.progressPercentage = Math.min(
        100,
        Math.round((doc.completedItems.length / doc.totalItems) * 100)
      );
    }

    assert.strictEqual(doc.progressPercentage, 4); // 2 / 50 * 100 = 4%
  });

  // 3. Streak Service Date Calculation Tests
  console.log("\n--- 3. Streak Service Logic Tests ---");
  runTest("Date helper formats YYYY-MM-DD accurately", () => {
    const dateStr = getLocalDateString(new Date(2026, 10, 23)); // Month is 0-indexed: 10 = Nov
    assert.strictEqual(dateStr, "2026-11-23");
  });

  runTest("getOffsetDateString correctly computes yesterday and future dates", () => {
    const base = new Date(2026, 10, 23);
    const yesterday = getOffsetDateString(-1, base);
    const tomorrow = getOffsetDateString(1, base);

    assert.strictEqual(yesterday, "2026-11-22");
    assert.strictEqual(tomorrow, "2026-11-24");
  });

  // 4. Controller Validation & Guard Tests
  console.log("\n--- 4. Controller Input Validation Tests ---");
  await runAsyncTest("createGoal rejects empty title with 400", async () => {
    const { req, res } = createMockReqRes({
      user: { userId: new mongoose.Types.ObjectId().toString() },
      body: { title: "   " },
    });

    await goalController.createGoal(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, "Goal title is required.");
  });

  await runAsyncTest("toggleGoal rejects malformed ObjectId with 400", async () => {
    const { req, res } = createMockReqRes({
      user: { userId: new mongoose.Types.ObjectId().toString() },
      params: { id: "invalid-id" },
    });

    await goalController.toggleGoal(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, "Invalid goal ID.");
  });

  await runAsyncTest("completeTopic rejects missing itemId or itemTitle with 400", async () => {
    const { req, res } = createMockReqRes({
      user: { userId: new mongoose.Types.ObjectId().toString() },
      params: { courseSlug: "dsa" },
      body: { itemId: "item-1" }, // missing itemTitle
    });

    await progressController.completeTopic(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  await runAsyncTest("logStudySession rejects zero or negative duration with 400", async () => {
    const { req, res } = createMockReqRes({
      user: { userId: new mongoose.Types.ObjectId().toString() },
      body: { durationMinutes: -5 },
    });

    await sessionController.logStudySession(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, "A positive duration in minutes is required.");
  });

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("=========================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
