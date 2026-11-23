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
  console.log("  PHASE 6: TIMEZONE AUDIT & FINAL INTEGRATION TESTS");
  console.log("==================================================\n");

  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collab_editor";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const StudentActivity = require("../models/StudentActivity");
  const DailyGoal = require("../models/DailyGoal");
  const StudySession = require("../models/StudySession");
  const {
    getLocalDateString,
    getOffsetDateString,
    calculateStreak,
    TIMEZONE,
  } = require("../services/streakService");

  // Clean test data
  await StudentActivity.deleteMany({ user: { $in: [userA_Id, userB_Id] } });
  await DailyGoal.deleteMany({ user: { $in: [userA_Id, userB_Id] } });
  await StudySession.deleteMany({ user: { $in: [userA_Id, userB_Id] } });

  // TEST 1: Timezone constant check
  await test("1. TIMEZONE constant is configured to 'Asia/Kolkata'", () => {
    assert.strictEqual(TIMEZONE, "Asia/Kolkata");
  });

  // TEST 2: 11:55 PM IST vs 12:05 AM IST date boundary
  // 11:55 PM IST on Nov 23, 2026 is 18:25:00 UTC on Nov 23, 2026
  // 12:05 AM IST on Nov 24, 2026 is 18:35:00 UTC on Nov 23, 2026
  const dateBeforeMidnight = new Date("2026-11-23T18:25:00.000Z");
  const dateAfterMidnight = new Date("2026-11-23T18:35:00.000Z");

  await test("2. 11:55 PM IST resolves to '2026-11-23' (Day N)", () => {
    const str = getLocalDateString(dateBeforeMidnight);
    assert.strictEqual(str, "2026-11-23", "11:55 PM IST must be 2026-11-23");
  });

  await test("3. 12:05 AM IST resolves to '2026-11-24' (Day N+1)", () => {
    const str = getLocalDateString(dateAfterMidnight);
    assert.strictEqual(str, "2026-11-24", "12:05 AM IST must be 2026-11-24");
  });

  // TEST 4: Offset date calculations around midnight
  await test("4. Offset dates calculate correctly from midnight IST boundaries", () => {
    const yesterdayFrom1205AM = getOffsetDateString(-1, dateAfterMidnight);
    const tomorrowFrom1155PM = getOffsetDateString(1, dateBeforeMidnight);

    assert.strictEqual(yesterdayFrom1205AM, "2026-11-23");
    assert.strictEqual(tomorrowFrom1155PM, "2026-11-24");
  });

  // TEST 5: Consecutive streak crossing midnight IST
  await test("5. Activities logged at 11:55 PM IST and 12:05 AM IST form a 2-day consecutive streak", async () => {
    // Activity at 11:55 PM IST (Day 2026-11-23)
    await StudentActivity.create({
      user: userA_Id,
      activityType: "dsa_solved",
      dateString: getLocalDateString(dateBeforeMidnight),
      details: { problemId: "late-night-prob", problemTitle: "Midnight DSA" },
      createdAt: dateBeforeMidnight,
    });

    // Activity at 12:05 AM IST (Day 2026-11-24)
    await StudentActivity.create({
      user: userA_Id,
      activityType: "dsa_solved",
      dateString: getLocalDateString(dateAfterMidnight),
      details: { problemId: "early-morn-prob", problemTitle: "Early Morning DSA" },
      createdAt: dateAfterMidnight,
    });

    // Evaluate streak as of 12:05 AM IST (2026-11-24)
    const streakData = await calculateStreak(userA_Id, dateAfterMidnight);
    assert.strictEqual(streakData.currentStreak, 2, "Should be 2 consecutive days across midnight");
    assert.strictEqual(streakData.isActiveToday, true);
    assert.strictEqual(streakData.lastActiveDate, "2026-11-24");
    assert.strictEqual(streakData.totalActiveDays, 2);
  });

  // TEST 6: Daily Goals around midnight
  await test("6. Daily goals are strictly segmented by Asia/Kolkata targetDate", async () => {
    // Goal created for 2026-11-23
    const goal23 = await DailyGoal.create({
      user: userA_Id,
      title: "Goal Before Midnight",
      targetDate: "2026-11-23",
      createdAt: dateBeforeMidnight,
    });

    // Goal created for 2026-11-24
    const goal24 = await DailyGoal.create({
      user: userA_Id,
      title: "Goal After Midnight",
      targetDate: "2026-11-24",
      createdAt: dateAfterMidnight,
    });

    // Query goals for 2026-11-23
    const res23 = await httpRequest({
      path: "/api/dashboard/goals?date=2026-11-23",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res23.status, 200);
    assert.strictEqual(res23.data.data.goals.length, 1);
    assert.strictEqual(res23.data.data.goals[0].title, "Goal Before Midnight");

    // Query goals for 2026-11-24
    const res24 = await httpRequest({
      path: "/api/dashboard/goals?date=2026-11-24",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res24.status, 200);
    assert.strictEqual(res24.data.data.goals.length, 1);
    assert.strictEqual(res24.data.data.goals[0].title, "Goal After Midnight");
  });

  // TEST 7: Study time aggregation around midnight
  await test("7. Study sessions on different IST days aggregate to correct total and daily totals", async () => {
    // 30 min session at 11:55 PM IST
    await StudySession.create({
      user: userA_Id,
      sessionType: "general",
      durationMinutes: 30,
      dateString: "2026-11-23",
      createdAt: dateBeforeMidnight,
    });

    // 20 min session at 12:05 AM IST
    await StudySession.create({
      user: userA_Id,
      sessionType: "dsa_practice",
      durationMinutes: 20,
      dateString: "2026-11-24",
      createdAt: dateAfterMidnight,
    });

    const res = await httpRequest({
      path: "/api/dashboard/study-time",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    // Total should be 30 + 20 = 50 min
    assert.strictEqual(res.data.data.totalMinutes, 50);
    assert.strictEqual(res.data.data.totalHours, 0.8);
  });

  // TEST 8: User isolation across midnight
  await test("8. User isolation: User B has 0 streak and 0 goals across midnight", async () => {
    const resStreakB = await httpRequest({
      path: "/api/dashboard/streak",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(resStreakB.status, 200);
    assert.strictEqual(resStreakB.data.data.currentStreak, 0);

    const resGoalsB = await httpRequest({
      path: "/api/dashboard/goals?date=2026-11-23",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(resGoalsB.data.data.goals.length, 0);
  });

  // TEST 9: Backward compatibility with plain date strings
  await test("9. getLocalDateString safely accepts existing 'YYYY-MM-DD' date strings unchanged", () => {
    const input = "2026-11-23";
    const output = getLocalDateString(input);
    assert.strictEqual(output, "2026-11-23");
  });

  // TEST 10: Weekly activity 7-day structure
  await test("10. generateWeeklyActivity correctly labels days in Asia/Kolkata", () => {
    const { generateWeeklyActivity } = require("../services/streakService");
    const activeSet = new Set(["2026-11-23", "2026-11-24"]);
    const weekly = generateWeeklyActivity(activeSet, dateAfterMidnight);

    assert.strictEqual(weekly.length, 7);
    const day23 = weekly.find((d) => d.date === "2026-11-23");
    const day24 = weekly.find((d) => d.date === "2026-11-24");

    assert(day23 && day23.active === true, "Day 23 should be active");
    assert(day24 && day24.active === true, "Day 24 should be active");
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
  console.error("Timezone test runner crashed:", err);
  process.exit(1);
});
