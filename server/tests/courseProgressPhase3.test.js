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

async function runPhase3Tests() {
  console.log("==================================================");
  console.log("PHASE 3: COURSE PROGRESS & STUDY INTEGRATION TESTS");
  console.log("==================================================\n");

  // 1. Initial Course Progress
  await test("GET /api/dashboard/progress returns 200 and initial array", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data));
  });

  // 2. Complete DSA Problem
  await test("POST complete-topic records a solved DSA problem (200)", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "1-1-Two Sum",
        itemTitle: "Two Sum",
        patternNumber: 1,
        totalItems: 150,
        courseTitle: "Data Structures & Algorithms",
        completed: true,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.courseSlug, "dsa");
    assert.strictEqual(res.data.data.completedCount, 1);
    assert.strictEqual(res.data.data.totalItems, 150);
    assert.strictEqual(res.data.data.progressPercentage, 1); // 1 / 150 * 100 = 1%
    assert.ok(res.data.data.lastAccessedTopic);
    assert.strictEqual(res.data.data.lastAccessedTopic.itemTitle, "Two Sum");
  });

  // 3. Duplicate Prevention
  await test("POST complete-topic prevents duplicate item completion in course", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "1-1-Two Sum",
        itemTitle: "Two Sum",
        patternNumber: 1,
        totalItems: 150,
        completed: true,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.completedCount, 1); // Count does NOT increase
    assert.ok(res.data.message.includes("already recorded"));
  });

  // 4. Complete a second DSA problem
  await test("POST complete-topic adds a second DSA problem", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "1-2-Valid Anagram",
        itemTitle: "Valid Anagram",
        patternNumber: 1,
        totalItems: 150,
        completed: true,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completedCount, 2);
  });

  // 5. Complete a System Design topic
  await test("POST complete-topic records a System Design topic", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/system-design/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "sys-1",
        itemTitle: "High Level Design",
        totalItems: 25,
        courseTitle: "System Design",
        completed: true,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.courseSlug, "system-design");
    assert.strictEqual(res.data.data.completedCount, 1);
    assert.strictEqual(res.data.data.progressPercentage, 4); // 1 / 25 * 100 = 4%
  });

  // 6. Complete a Web Development topic
  await test("POST complete-topic records a Web Development topic", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/web-development/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "web-1",
        itemTitle: "React.js Core & Hooks",
        totalItems: 24,
        courseTitle: "Web Development",
        completed: true,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.courseSlug, "web-development");
    assert.strictEqual(res.data.data.completedCount, 1);
  });

  // 7. Complete an Interview Preparation topic
  await test("POST complete-topic records an Interview Preparation topic", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/interview-prep/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "prep-1",
        itemTitle: "Java Interview Questions",
        totalItems: 20,
        courseTitle: "Interview Preparation",
        completed: true,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.courseSlug, "interview-prep");
    assert.strictEqual(res.data.data.completedCount, 1);
    assert.strictEqual(res.data.data.progressPercentage, 5); // 1 / 20 * 100 = 5%
  });

  // 8. Record Topic Access (for Continue Course resume without completing)
  await test("POST access-topic updates lastAccessedTopic", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/access-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "2-3-Sliding Window Maximum",
        itemTitle: "Sliding Window Maximum",
        patternNumber: 2,
        courseTitle: "Data Structures & Algorithms",
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.itemTitle, "Sliding Window Maximum");
    assert.strictEqual(res.data.data.patternNumber, 2);
  });

  // 9. Fetch Course by Slug
  await test("GET /api/dashboard/progress/:slug returns updated topic & access info", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.courseSlug, "dsa");
    assert.strictEqual(res.data.data.lastAccessedTopic.patternNumber, 2);
    assert.strictEqual(res.data.data.lastAccessedTopic.itemTitle, "Sliding Window Maximum");
  });

  // 10. Uncomplete topic
  await test("POST complete-topic with completed:false removes problem", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "1-2-Valid Anagram",
        itemTitle: "Valid Anagram",
        completed: false,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completedCount, 1); // Decreased from 2 to 1
  });

  // 11. Batch Sync DSA (migration from localStorage)
  await test("POST /api/dashboard/progress/dsa/batch-sync syncs localStorage items", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/batch-sync",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        totalItems: 150,
        solvedItems: [
          { itemId: "1-1-Two Sum", itemTitle: "Two Sum", patternNumber: 1 }, // Already exists
          { itemId: "1-3-Group Anagrams", itemTitle: "Group Anagrams", patternNumber: 1 }, // New
          { itemId: "1-4-Top K Frequent", itemTitle: "Top K Frequent", patternNumber: 1 }, // New
        ],
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    // Previously 1 (Two Sum was kept, Valid Anagram uncompleted), 2 new added = 3
    assert.strictEqual(res.data.data.completedCount, 3);
  });

  // 12. Dashboard Overview reflects dynamic course progress and DSA problems
  await test("GET /api/dashboard/overview reflects updated DSA and course stats", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/overview",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.overview.problemsPracticed >= 3);
    const dsaCourse = res.data.data.coursesProgress.find((c) => c.courseSlug === "dsa");
    assert.ok(dsaCourse);
    assert.strictEqual(dsaCourse.completedCount, 3);
  });

  // 13. User Isolation
  await test("User B has isolated course progress", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.completedItems.length, 0); // User B has 0 completed
  });

  // 14. Validation Error Handling
  await test("POST complete-topic rejects missing itemId or itemTitle with 400", async () => {
    const res = await httpRequest({
      path: "/api/dashboard/progress/dsa/complete-topic",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        itemId: "only-id", // missing itemTitle
      },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  console.log("\n==================================================");
  console.log(`PHASE 3 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
