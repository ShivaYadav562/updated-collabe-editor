const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const http = require("http");

const JWT_SECRET = process.env.JWT_SECRET || "collab_editor_jwt_secret_dev_key_2026";
const API_PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

// Two distinct test user IDs for isolation testing
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
  console.log("  PHASE 5: LEARNING STREAK FULL-STACK INTEGRATION");
  console.log("==================================================\n");

  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collab_editor";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const StudentActivity = require("../models/StudentActivity");
  const StudySession = require("../models/StudySession");
  const {
    getLocalDateString,
    getOffsetDateString,
    calculateStreak,
  } = require("../services/streakService");

  // Clean up test data for our test users
  await StudentActivity.deleteMany({ user: { $in: [userA_Id, userB_Id] } });
  await StudySession.deleteMany({ user: { $in: [userA_Id, userB_Id] } });

  const today = getLocalDateString();
  const yesterday = getOffsetDateString(-1);
  const twoDaysAgo = getOffsetDateString(-2);
  const threeDaysAgo = getOffsetDateString(-3);

  // TEST 1: Unauthenticated request rejected
  await test("1. GET /api/dashboard/streak requires authentication", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
    });
    assert.strictEqual(res.status, 401, "Should return 401 without token");
  });

  // TEST 2: User with zero activity
  await test("2. User with no activity returns 0 streak, 0 active days, not active today", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.currentStreak, 0);
    assert.strictEqual(res.data.data.longestStreak, 0);
    assert.strictEqual(res.data.data.lastActiveDate, null);
    assert.strictEqual(res.data.data.isActiveToday, false);
    assert.strictEqual(res.data.data.totalActiveDays, 0);
    assert.strictEqual(res.data.data.weeklyActivity.length, 7);
  });

  // TEST 3: First-ever study activity (today)
  await test("3. First-ever activity today creates 1-day current and longest streak", async () => {
    await StudentActivity.create({
      user: userA_Id,
      activityType: "dsa_solved",
      dateString: today,
      details: { problemId: "two-sum", problemTitle: "Two Sum" },
    });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 1);
    assert.strictEqual(res.data.data.longestStreak, 1);
    assert.strictEqual(res.data.data.isActiveToday, true);
    assert.strictEqual(res.data.data.lastActiveDate, today);
    assert.strictEqual(res.data.data.totalActiveDays, 1);
  });

  // TEST 4: Duplicate activity on same day does NOT inflate streak
  await test("4. Multiple activities on the same day do not inflate streak or active days", async () => {
    // Add a study session and a goal completion on today
    await StudentActivity.create({
      user: userA_Id,
      activityType: "goal_completed",
      dateString: today,
      details: { topicTitle: "Solve 2 problems" },
    });
    await StudySession.create({
      user: userA_Id,
      sessionType: "dsa_practice",
      durationMinutes: 30,
      dateString: today,
    });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 1, "Streak should still be 1");
    assert.strictEqual(res.data.data.totalActiveDays, 1, "Total active days should still be 1");
  });

  // TEST 5: Consecutive days activity (yesterday + today)
  await test("5. Activity on consecutive days (yesterday + today) creates 2-day streak", async () => {
    await StudentActivity.create({
      user: userA_Id,
      activityType: "topic_completed",
      dateString: yesterday,
      details: { courseSlug: "system-design", topicTitle: "Caching" },
    });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 2);
    assert.strictEqual(res.data.data.longestStreak, 2);
    assert.strictEqual(res.data.data.totalActiveDays, 2);
  });

  // TEST 6: 3 consecutive days
  await test("6. Adding activity 2 days ago extends streak to 3 consecutive days", async () => {
    await StudentActivity.create({
      user: userA_Id,
      activityType: "dsa_solved",
      dateString: twoDaysAgo,
      details: { problemId: "reverse-linked-list", problemTitle: "Reverse Linked List" },
    });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 3);
    assert.strictEqual(res.data.data.longestStreak, 3);
    assert.strictEqual(res.data.data.totalActiveDays, 3);
  });

  // TEST 7: Longest streak calculation across historical periods
  await test("7. Historical longer streak (5 days) is preserved in longestStreak", async () => {
    // Insert a historical streak 5 days long from day -15 to -11
    for (let i = 15; i >= 11; i--) {
      await StudentActivity.create({
        user: userA_Id,
        activityType: "dsa_solved",
        dateString: getOffsetDateString(-i),
        details: { problemId: `hist-prob-${i}`, problemTitle: `Problem ${i}` },
      });
    }

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 3, "Current streak remains 3");
    assert.strictEqual(res.data.data.longestStreak, 5, "Longest streak should reflect historical 5 days");
    assert.strictEqual(res.data.data.totalActiveDays, 8, "Total active days should be 3 + 5 = 8");
  });

  // TEST 8: Streak alive when studied yesterday but not yet today
  await test("8. Streak remains alive when user studied yesterday but not yet today", async () => {
    // Delete today's activities temporarily to test "not studied today yet"
    await StudentActivity.deleteMany({ user: userA_Id, dateString: today });
    await StudySession.deleteMany({ user: userA_Id, dateString: today });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.isActiveToday, false, "Should not be active today");
    assert.strictEqual(res.data.data.currentStreak, 2, "Streak of 2 is preserved (yesterday & day before)");
    assert.strictEqual(res.data.data.lastActiveDate, yesterday);
  });

  // TEST 9: Missed day breaks current streak
  await test("9. Missed day (neither today nor yesterday) resets current streak to 0", async () => {
    // Delete yesterday's activities too, so last activity was 2 days ago
    await StudentActivity.deleteMany({ user: userA_Id, dateString: yesterday });
    await StudySession.deleteMany({ user: userA_Id, dateString: yesterday });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 0, "Current streak should be broken (0)");
    assert.strictEqual(res.data.data.longestStreak, 5, "Longest streak should still be 5");
    assert.strictEqual(res.data.data.lastActiveDate, twoDaysAgo);
  });

  // TEST 10: Non-qualifying activities (e.g. login) do NOT count as streak
  await test("10. Passive activities like login alone do not count toward learning streak", async () => {
    // Clear user B completely and add only a login activity
    await StudentActivity.create({
      user: userB_Id,
      activityType: "login",
      dateString: today,
    });

    const res = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.currentStreak, 0, "Login alone does not create streak");
    assert.strictEqual(res.data.data.isActiveToday, false);
    assert.strictEqual(res.data.data.totalActiveDays, 0);
  });

  // TEST 11: User isolation
  await test("11. User isolation: User A's streak has zero effect on User B", async () => {
    // Add activity today for User A
    await StudentActivity.create({
      user: userA_Id,
      activityType: "dsa_solved",
      dateString: today,
      details: { problemId: "lru-cache", problemTitle: "LRU Cache" },
    });

    const resA = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const resB = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    assert.strictEqual(resA.data.data.currentStreak, 1);
    assert.strictEqual(resB.data.data.currentStreak, 0, "User B streak must be completely isolated");
  });

  // TEST 12: GET /api/dashboard/overview returns matching streak data
  await test("12. GET /api/dashboard/overview returns consistent streak data", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    const ov = res.data.data.overview;
    assert.strictEqual(ov.currentStreak, 1);
    assert.strictEqual(ov.longestStreak, 5);
    assert.strictEqual(ov.isActiveToday, true);
    assert.strictEqual(ov.lastActiveDate, today);
    assert(Array.isArray(ov.weeklyActivity), "weeklyActivity must be an array");
    assert.strictEqual(ov.weeklyActivity.length, 7);

    // Verify today's slot in weeklyActivity is active: true
    const todaySlot = ov.weeklyActivity.find((w) => w.date === today);
    assert(todaySlot && todaySlot.active === true, "Today's slot should be active");
  });

  // TEST 13: Direct calculateStreak service unit check
  await test("13. calculateStreak service correctly computes data with referenceDate", async () => {
    const baseDate = new Date("2026-11-23T12:00:00Z");
    const streakResult = await calculateStreak(userA_Id, baseDate);
    assert.strictEqual(streakResult.currentStreak, 1);
    assert.strictEqual(streakResult.longestStreak, 5);
    assert.strictEqual(streakResult.weeklyActivity.length, 7);
  });

  console.log("\n--------------------------------------------------");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("--------------------------------------------------\n");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Streak test runner crashed:", err);
  process.exit(1);
});
