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
  console.log("  PHASE 4: REAL-TIME STUDY TIME TRACKING TESTS");
  console.log("==================================================\n");

  // Connect to DB directly for cleanup and deep verification
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collab_editor";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const StudySession = require("../models/StudySession");
  const StudentActivity = require("../models/StudentActivity");

  // Clean up any previous test data for our test users
  await StudySession.deleteMany({ user: { $in: [userA_Id, userB_Id] } });
  await StudentActivity.deleteMany({ user: { $in: [userA_Id, userB_Id] } });

  // TEST 1: Authentication required
  await test("1. POST /api/dashboard/study-session requires authentication", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      body: { durationMinutes: 30, sessionType: "general" },
    });
    assert.strictEqual(res.status, 401, "Should reject unauthenticated request");
  });

  // TEST 2: Validation - Negative duration
  await test("2. POST /api/dashboard/study-session rejects negative duration", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { durationMinutes: -15, sessionType: "dsa_practice" },
    });
    assert.strictEqual(res.status, 400, "Should return 400 for negative duration");
    assert.strictEqual(res.data.success, false);
  });

  // TEST 3: Validation - Zero duration
  await test("3. POST /api/dashboard/study-session rejects zero duration", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { durationMinutes: 0, sessionType: "dsa_practice" },
    });
    assert.strictEqual(res.status, 400, "Should return 400 for zero duration");
  });

  // TEST 4: Validation - Duration under minimum 0.1 minutes
  await test("4. POST /api/dashboard/study-session rejects duration < 0.1 minutes", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { durationMinutes: 0.05, sessionType: "general" },
    });
    assert.strictEqual(res.status, 400, "Should return 400 for duration < 0.1 min");
  });

  // TEST 5: Validation - Duration exceeds 720 minutes
  await test("5. POST /api/dashboard/study-session rejects duration > 720 minutes", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { durationMinutes: 800, sessionType: "general" },
    });
    assert.strictEqual(res.status, 400, "Should return 400 for duration > 720 min");
  });

  // TEST 6: Validation - Invalid sessionType
  await test("6. POST /api/dashboard/study-session rejects invalid sessionType", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { durationMinutes: 20, sessionType: "gaming" },
    });
    assert.strictEqual(res.status, 400, "Should return 400 for invalid sessionType");
  });

  // TEST 7: Record valid session 1 - DSA Practice
  await test("7. POST /api/dashboard/study-session logs DSA practice session (45 min)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        durationMinutes: 45,
        sessionType: "dsa_practice",
        courseSlug: "dsa",
        topicTitle: "Sliding Window",
      },
    });
    assert.strictEqual(res.status, 201, "Should return 201 Created");
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.durationMinutes, 45);
    assert.strictEqual(res.data.data.sessionType, "dsa_practice");
    assert.strictEqual(res.data.data.metadata.courseSlug, "dsa");
  });

  // TEST 8: Record valid session 2 - Course Study
  await test("8. POST /api/dashboard/study-session logs course study session (30 min)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        durationMinutes: 30,
        sessionType: "course_study",
        courseSlug: "system-design",
        topicTitle: "Load Balancing",
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.durationMinutes, 30);
    assert.strictEqual(res.data.data.sessionType, "course_study");
  });

  // TEST 9: Record valid session 3 - Editor Room
  await test("9. POST /api/dashboard/study-session logs editor room session (15 min)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-session",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        durationMinutes: 15,
        sessionType: "editor_room",
        roomId: "room-abc-123",
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.durationMinutes, 15);
    assert.strictEqual(res.data.data.sessionType, "editor_room");
  });

  // TEST 10: GET /api/dashboard/study-time returns accumulated totals
  await test("10. GET /api/dashboard/study-time returns accurate totals (90 min = 1.5 hrs)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-time",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.totalMinutes, 90, "Total minutes should be 45+30+15 = 90");
    assert.strictEqual(res.data.data.totalHours, 1.5, "Total hours should be 1.5");
    assert.strictEqual(res.data.data.formatted, "1.5 hrs");
    assert.strictEqual(res.data.data.todayMinutes, 90);
    assert.strictEqual(res.data.data.todayHours, 1.5);
  });

  // TEST 11: GET /api/dashboard/study-time returns grouped breakdown
  await test("11. GET /api/dashboard/study-time returns grouped stats bySessionType", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-time",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    const types = res.data.data.bySessionType;
    assert(Array.isArray(types), "bySessionType must be an array");

    const dsa = types.find((t) => t.type === "dsa_practice");
    const course = types.find((t) => t.type === "course_study");
    const editor = types.find((t) => t.type === "editor_room");

    assert(dsa && dsa.totalMinutes === 45, "DSA should have 45 min");
    assert(course && course.totalMinutes === 30, "Course study should have 30 min");
    assert(editor && editor.totalMinutes === 15, "Editor room should have 15 min");
  });

  // TEST 12: User isolation - User B has zero study time
  await test("12. User isolation: User B has 0 total study minutes and 0.0 hrs", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/study-time",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.totalMinutes, 0);
    assert.strictEqual(res.data.data.totalHours, 0);
    assert.strictEqual(res.data.data.formatted, "0 hrs");
  });

  // TEST 13: StudentActivity logged for streak maintenance
  await test("13. StudentActivity records created for study sessions", async () => {
    const activities = await StudentActivity.find({
      user: userA_Id,
      activityType: "study_session",
    });
    assert.strictEqual(activities.length, 3, "User A should have 3 study session activities");
  });

  // TEST 14: GET /api/dashboard/overview reflects study time
  await test("14. GET /api/dashboard/overview reflects formatted study time (1.5 hrs)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(
      res.data.data.overview.studyTimeFormatted,
      "1.5 hrs",
      "Overview studyTimeFormatted must match accumulated hours"
    );
  });

  // TEST 15: Direct MongoDB persistence verification
  await test("15. MongoDB persistence: StudySession docs verified in DB", async () => {
    const docs = await StudySession.find({ user: userA_Id }).sort({ createdAt: 1 });
    assert.strictEqual(docs.length, 3);
    assert.strictEqual(docs[0].sessionType, "dsa_practice");
    assert.strictEqual(docs[1].sessionType, "course_study");
    assert.strictEqual(docs[2].sessionType, "editor_room");
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
  console.error("Test runner crashed:", err);
  process.exit(1);
});
