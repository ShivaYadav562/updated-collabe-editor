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
    const reqHeaders = {
      ...headers,
    };
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

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function runPhase2Tests() {
  console.log("==========================================");
  console.log("PHASE 2: DAILY GOALS INTEGRATION TESTS");
  console.log("==========================================\n");

  let createdGoalA1 = null;
  let createdGoalA2 = null;
  let createdGoalB1 = null;

  // 1. Authentication requirement
  await test("GET /api/dashboard/goals rejects request without token (401)", async () => {
    const res = await httpRequest({ path: "/api/dashboard/goals" });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.message, "Access denied. No token provided.");
  });

  await test("GET /api/dashboard/goals rejects request with invalid token (401)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      headers: { Authorization: "Bearer bad.token.here" },
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.message, "Invalid or expired token.");
  });

  // 2. Fetch initial goals
  await test("GET /api/dashboard/goals returns goals for User A with status 200", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data.goals));
  });

  // 3. Create goals for User A
  await test("POST /api/dashboard/goals creates a new goal for User A (201)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "Solve 2 DSA problems (Integration Test)",
        targetDurationMinutes: 45,
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data._id);
    assert.strictEqual(res.data.data.title, "Solve 2 DSA problems (Integration Test)");
    assert.strictEqual(res.data.data.targetDurationMinutes, 45);
    assert.strictEqual(res.data.data.completed, false);
    createdGoalA1 = res.data.data;
  });

  await test("POST /api/dashboard/goals creates a second goal for User A (201)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "Revise System Design (Integration Test)",
        targetDurationMinutes: 30,
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data._id);
    createdGoalA2 = res.data.data;
  });

  // 4. Duplicate prevention
  await test("POST /api/dashboard/goals rejects duplicate goal title on same date (409)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "Solve 2 DSA problems (Integration Test)",
        targetDurationMinutes: 60,
      },
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.message.includes("already exists"));
  });

  // 5. Input validation
  await test("POST /api/dashboard/goals rejects empty or whitespace title (400)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "   ",
      },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.message, "Goal title is required.");
  });

  // 6. Complete and uncomplete goals (toggle)
  await test("PATCH /api/dashboard/goals/:id/toggle completes the goal (200)", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalA1._id}/toggle`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.completed, true);
    assert.ok(res.data.data.completedAt !== null);
  });

  await test("PATCH /api/dashboard/goals/:id/toggle uncompletes the goal (200)", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalA1._id}/toggle`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.completed, false);
    assert.strictEqual(res.data.data.completedAt, null);
  });

  await test("PATCH /api/dashboard/goals/:id/toggle re-completes for persistence check", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalA1._id}/toggle`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completed, true);
  });

  // 7. Persistence after refresh
  await test("GET /api/dashboard/goals verifies persistence of goals and completion state", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    const goals = res.data.data.goals;
    const g1 = goals.find((g) => g._id === createdGoalA1._id);
    const g2 = goals.find((g) => g._id === createdGoalA2._id);

    assert.ok(g1, "Goal A1 must exist");
    assert.ok(g2, "Goal A2 must exist");
    assert.strictEqual(g1.completed, true, "Goal A1 completed state must be persisted");
    assert.strictEqual(g2.completed, false, "Goal A2 completed state must be persisted");
  });

  // 8. Dynamic progress verification
  await test("GET /api/dashboard/overview returns dynamic goalsSummary calculation", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/overview",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    const goalsSummary = res.data.data.overview.goalsSummary;
    assert.ok(goalsSummary.total >= 2);
    assert.ok(goalsSummary.completed >= 1);
    assert.strictEqual(goalsSummary.label, `${goalsSummary.completed} / ${goalsSummary.total}`);
  });

  // 9. User Isolation / Multi-User Security
  await test("POST /api/dashboard/goals creates a goal for User B", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
      body: {
        title: "User B Private Goal",
        targetDurationMinutes: 20,
      },
    });
    assert.strictEqual(res.status, 201);
    createdGoalB1 = res.data.data;
  });

  await test("User A cannot see User B's goals", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const foundBInA = res.data.data.goals.some((g) => g._id === createdGoalB1._id);
    assert.strictEqual(foundBInA, false, "User A must NOT see User B goals");
  });

  await test("User A cannot toggle User B's goal (404 Not Found)", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalB1._id}/toggle`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 404);
  });

  await test("User A cannot delete User B's goal (404 Not Found)", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalB1._id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 404);
  });

  // 10. Delete Goal
  await test("DELETE /api/dashboard/goals/:id deletes the goal for User A (200)", async () => {
    const res = await httpRequest({
      path: `/api/dashboard/goals/${createdGoalA1._id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.message, "Goal deleted successfully.");
  });

  await test("GET /api/dashboard/goals confirms goal is permanently deleted", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/goals",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    const found = res.data.data.goals.some((g) => g._id === createdGoalA1._id);
    assert.strictEqual(found, false, "Deleted goal must not appear in MongoDB query");
  });

  // Clean up remaining test goals
  if (createdGoalA2) {
    await httpRequest({
      path: `/api/dashboard/goals/${createdGoalA2._id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
  }
  if (createdGoalB1) {
    await httpRequest({
      path: `/api/dashboard/goals/${createdGoalB1._id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
  }

  console.log("\n==========================================");
  console.log(`PHASE 2 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
