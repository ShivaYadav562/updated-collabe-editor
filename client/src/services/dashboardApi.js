//const API_BASE = `${import.meta.env.VITE_API_URL}/api/auth`;
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000"; 

 

function getAuthHeaders() {
  // Check localStorage first (Remember Me), then sessionStorage (session-only login)
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("study-session-active");
      sessionStorage.removeItem("token");
    }
    const errorMsg =
      data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/**
 * Fetch daily goals for a given date (defaults to today)
 */
export async function fetchDailyGoals(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/dashboard/goals${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * Create a new daily goal
 */
export async function createDailyGoal({ title, targetDurationMinutes = 0, targetDate }) {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/goals`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      title,
      targetDurationMinutes,
      targetDate,
    }),
  });
  return handleResponse(res);
}

/**
 * Toggle goal completion status
 */
export async function toggleDailyGoal(id) {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/goals/${id}/toggle`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * Delete a goal
 */
export async function deleteDailyGoal(id) {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/goals/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * Fetch full dashboard overview (overview metrics, streak, goals, courses)
 */
export async function fetchDashboardOverview() {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/overview`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * Fetch progress for all courses
 */
export async function fetchCourseProgress() {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/progress`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * Fetch progress for a single course
 */
export async function fetchCourseProgressBySlug(slug) {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/progress/${encodeURIComponent(slug)}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * Complete or uncomplete a topic/problem in a course
 */
export async function completeCourseTopic(courseSlug, payload) {
  const res = await fetch(
    `${API_BASE_URL}/api/dashboard/progress/${encodeURIComponent(courseSlug)}/complete-topic`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleResponse(res);
}

/**
 * Record topic access without completing (for resuming last accessed topic)
 */
export async function recordCourseTopicAccess(courseSlug, payload) {
  const res = await fetch(
    `${API_BASE_URL}/api/dashboard/progress/${encodeURIComponent(courseSlug)}/access-topic`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleResponse(res);
}

/**
 * Batch sync DSA solved problems from localStorage into MongoDB
 */
export async function batchSyncDsaProgress(solvedItems, totalItems = 150) {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/progress/dsa/batch-sync`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      solvedItems,
      totalItems,
    }),
  });
  return handleResponse(res);
}

/**
 * Log a completed study session
 */
export async function logStudySession({
  durationMinutes,
  sessionType = "general",
  roomId,
  courseSlug,
  topicTitle,
}) {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/study-session`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      durationMinutes,
      sessionType,
      roomId,
      courseSlug,
      topicTitle,
    }),
  });
  return handleResponse(res);
}

/**
 * Fetch aggregated study time statistics for the authenticated user
 */
export async function fetchStudyTime() {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/study-time`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * Fetch detailed streak information for the authenticated user
 */
export async function fetchStreak() {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/streak`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}
