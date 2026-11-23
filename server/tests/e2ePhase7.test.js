const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const http = require("http");

const JWT_SECRET = process.env.JWT_SECRET || "collab_editor_jwt_secret_dev_key_2026";
const API_PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

// Two distinct test user IDs
const userA_Id = new mongoose.Types.ObjectId().toString();
const userB_Id = new mongoose.Types.ObjectId().toString();

const tokenA = jwt.sign({ userId: userA_Id }, JWT_SECRET, { expiresIn: "1h" });
const tokenB = jwt.sign({ userId: userB_Id }, JWT_SECRET, { expiresIn: "1h" });

let passed = 0;
let failed = 0;

function httpRequest({ path, method = "GET", headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );

    req.on("error", (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n==================================================");
  console.log("  PHASE 7: COMPLETE END-TO-END QA & AUDIT SUITE");
  console.log("==================================================\n");

  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collab_editor";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const StudentActivity = require("../models/StudentActivity");
  const CourseProgress = require("../models/CourseProgress");
  const DailyGoal = require("../models/DailyGoal");
  const StudySession = require("../models/StudySession");
  const {
    getLocalDateString,
    getOffsetDateString,
    calculateStreak,
  } = require("../services/streakService");

  // Initial clean up for test users only (never touch other user data)
  await StudentActivity.deleteMany({ user: { $in: [userA_Id, userB_Id] } });
  await CourseProgress.deleteMany({ user: { $in: [userA_Id, userB_Id] } });
  await DailyGoal.deleteMany({ user: { $in: [userA_Id, userB_Id] } });
  await StudySession.deleteMany({ user: { $in: [userA_Id, userB_Id] } });

  const todayIST = getLocalDateString();
  const yesterdayIST = getOffsetDateString(-1);

  // ----------------------------------------------------
  // JOURNEY 1: AUTHENTICATION & MULTI-TENANT ISOLATION
  // ----------------------------------------------------
  console.log("--- Journey 1: Authentication & User Isolation ---");

  await test("J1.1 Rejects unauthenticated dashboard requests", async () => {
    const res = await httpRequest({ path: "/api/dashboard/overview", method: "GET" });
    assert.strictEqual(res.status, 401, "Overview should require authentication");
  });

  await test("J1.2 Loads authenticated dashboard for User A with initial zero state", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.overview.problemsPracticed, 0);
    assert.strictEqual(res.data.data.overview.currentStreak, 0);
    assert.strictEqual(res.data.data.overview.studyTimeFormatted, "0 hrs");
  });

  // ----------------------------------------------------
  // JOURNEY 2: DAILY GOALS LIFECYCLE & PERSISTENCE
  // ----------------------------------------------------
  console.log("\n--- Journey 2: Daily Goals Lifecycle ---");
  let createdGoalId = null;

  await test("J2.1 Create goal 'Solve 3 Dynamic Programming problems' (45 min)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { title: "Solve 3 Dynamic Programming problems", targetDurationMinutes: 45 },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.completed, false);
    createdGoalId = res.data.data._id;
  });

  await test("J2.2 Prevents duplicate goal on the same day", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { title: "Solve 3 Dynamic Programming problems" },
    });
    assert.strictEqual(res.status, 409, "Should reject duplicate goal title");
  });

  await test("J2.3 Toggle goal to completed -> persists completed: true", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalId}/toggle`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completed, true);
    assert(res.data.data.completedAt !== null, "completedAt must be populated");
  });

  await test("J2.4 Toggle goal to uncompleted -> persists completed: false", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalId}/toggle`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completed, false);
    assert.strictEqual(res.data.data.completedAt, null);
  });

  await test("J2.5 Re-complete goal and verify goalsSummary updates in overview", async () => {
    await httpRequest({
      path: `/api/dashboard/goals/${createdGoalId}/toggle`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const res = await httpRequest({
      path: "/api/dashboard/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.overview.goalsSummary.completed, 1);
    assert.strictEqual(res.data.data.overview.goalsSummary.total, 1);
  });

  // ----------------------------------------------------
  // JOURNEY 3: COURSE PROGRESS & STUDY NAVIGATION
  // ----------------------------------------------------
  console.log("\n--- Journey 3: Course Progress & Study Section Navigation ---");

  await test("J3.1 Completes topic in System Design and Interview Prep", async () => {
    const resSys = await httpRequest({
      path: "/api/dashboard/progress/system-design/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { itemId: "sd-cap-theorem", itemTitle: "CAP Theorem", resourceType: "topic" },
    });
    assert.strictEqual(resSys.status, 200);
    assert.strictEqual(resSys.data.data.completedCount, 1);

    const resInt = await httpRequest({
      path: "/api/dashboard/progress/interview-prep/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { itemId: "int-star-method", itemTitle: "STAR Method", resourceType: "topic" },
    });
    assert.strictEqual(resInt.status, 200);
    assert.strictEqual(resInt.data.data.completedCount, 1);
  });

  await test("J3.2 Records topic access for resuming course navigation", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/access-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { itemId: "dsa-pat-4", itemTitle: "Merge Intervals", patternNumber: 4 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.patternNumber, 4);
    assert.strictEqual(res.data.data.itemTitle, "Merge Intervals");
  });

  // ----------------------------------------------------
  // JOURNEY 4: DSA TRACKING & TWO-WAY SYNC
  // ----------------------------------------------------
  console.log("\n--- Journey 4: DSA Tracking & Sync ---");

  await test("J4.1 Solves DSA problem -> increments problemsPracticed", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { itemId: "prob-sliding-window-max", itemTitle: "Sliding Window Maximum", patternNumber: 3 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completedCount, 1);

    const ov = await httpRequest({
      path: "/api/dashboard/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(ov.data.data.overview.problemsPracticed, 1);
  });

  await test("J4.2 Batch sync from localStorage prevents duplication", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/batch-sync",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        solvedItems: [
          { itemId: "prob-sliding-window-max", itemTitle: "Sliding Window Maximum" },
          { itemId: "prob-trapping-rainwater", itemTitle: "Trapping Rain Water" },
        ],
        totalItems: 150,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completedCount, 2, "Should have 2 distinct problems solved");
  });

  // ----------------------------------------------------
  // JOURNEY 5: STUDY TIMER & TIME AGGREGATION
  // ----------------------------------------------------
  console.log("\n--- Journey 5: Study Timer & Real-Time Aggregation ---");

  await test("J5.1 Logs 45-min DSA session and 25-min Editor Room session", async () => {
    const s1 = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { durationMinutes: 45, sessionType: "dsa_practice", courseSlug: "dsa" },
    });
    assert.strictEqual(s1.status, 201);

    const s2 = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { durationMinutes: 25, sessionType: "editor_room", roomId: "collab-room-101" },
    });
    assert.strictEqual(s2.status, 201);
  });

  await test("J5.2 GET /api/dashboard/study-time accurately reflects 70 min = 1.2 hrs", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-time",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.totalMinutes, 70);
    assert.strictEqual(res.data.data.totalHours, 1.2);
    assert.strictEqual(res.data.data.formatted, "1.2 hrs");
    assert.strictEqual(res.data.data.todayMinutes, 70);
  });

  // ----------------------------------------------------
  // JOURNEY 6: LEARNING STREAK DYNAMICS
  // ----------------------------------------------------
  console.log("\n--- Journey 6: Learning Streak Dynamics ---");

  await test("J6.1 Activity today creates active streak of 1 day", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 1);
    assert.strictEqual(res.data.data.isActiveToday, true);
    assert.strictEqual(res.data.data.weeklyActivity.length, 7);
  });

  await test("J6.2 Adding historical yesterday activity forms 2-day consecutive streak", async () => {
    await StudentActivity.create({
      user: userA_Id,
      activityType: "topic_completed",
      dateString: yesterdayIST,
      details: { topicTitle: "Yesterday study topic" },
    });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 2);
    assert.strictEqual(res.data.data.longestStreak, 2);
  });

  // ----------------------------------------------------
  // JOURNEY 7: TIMEZONE (ASIA/KOLKATA) VERIFICATION
  // ----------------------------------------------------
  console.log("\n--- Journey 7: Timezone Verification ---");

  await test("J7.1 11:55 PM IST vs 12:05 AM IST date transitions accurately", () => {
    const dLate = new Date("2026-11-23T18:25:00.000Z"); // 23:55 IST
    const dEarly = new Date("2026-11-23T18:35:00.000Z"); // 00:05 IST next day

    assert.strictEqual(getLocalDateString(dLate), "2026-11-23");
    assert.strictEqual(getLocalDateString(dEarly), "2026-11-24");
  });

  // ----------------------------------------------------
  // JOURNEY 8: DIRECT DATABASE PERSISTENCE VERIFICATION
  // ----------------------------------------------------
  console.log("\n--- Journey 8: Direct MongoDB Persistence ---");

  await test("J8.1 Verify all records in MongoDB have valid ObjectId ownership and match schema", async () => {
    const goalsCount = await DailyGoal.countDocuments({ user: userA_Id });
    const progressCount = await CourseProgress.countDocuments({ user: userA_Id });
    const sessionsCount = await StudySession.countDocuments({ user: userA_Id });
    const activitiesCount = await StudentActivity.countDocuments({ user: userA_Id });

    assert(goalsCount >= 1, "Must have saved goals");
    assert(progressCount >= 2, "Must have saved progress docs");
    assert.strictEqual(sessionsCount, 2, "Must have exactly 2 study sessions");
    assert(activitiesCount >= 3, "Must have logged activities");
  });

  await test("J8.2 User B has strictly zero records (complete data isolation)", async () => {
    const goalsCountB = await DailyGoal.countDocuments({ user: userB_Id });
    const sessionsCountB = await StudySession.countDocuments({ user: userB_Id });
    const activitiesCountB = await StudentActivity.countDocuments({ user: userB_Id });

    assert.strictEqual(goalsCountB, 0, "User B must have 0 goals");
    assert.strictEqual(sessionsCountB, 0, "User B must have 0 sessions");
    assert.strictEqual(activitiesCountB, 0, "User B must have 0 activities");
  });

  console.log("\n--------------------------------------------------");
  console.log(`Phase 7 Results: ${passed} passed, ${failed} failed`);
  console.log("--------------------------------------------------\n");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Phase 7 test runner error:", err);
  process.exit(1);
});
