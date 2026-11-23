const mongoose = require("mongoose");
const CourseProgress = require("../models/CourseProgress");
const StudentActivity = require("../models/StudentActivity");
const { getLocalDateString } = require("../services/streakService");

/**
 * GET /api/dashboard/progress
 * Returns user progress across all courses
 */
async function getProgress(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const progressList = await CourseProgress.find({ user: userId });

    return res.json({
      success: true,
      data: progressList,
    });
  } catch (error) {
    console.error("Get progress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch course progress.",
      error: error.message,
    });
  }
}

/**
 * GET /api/dashboard/progress/:courseSlug
 * Returns user progress for a specific course
 */
async function getCourseProgressBySlug(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const cleanSlug = req.params.courseSlug.toLowerCase().trim();

    const progress = await CourseProgress.findOne({
      user: userId,
      courseSlug: cleanSlug,
    });

    return res.json({
      success: true,
      data: progress || {
        courseSlug: cleanSlug,
        completedItems: [],
        totalItems: 0,
        progressPercentage: 0,
        lastAccessedTopic: null,
      },
    });
  } catch (error) {
    console.error("Get course progress by slug error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch course progress.",
      error: error.message,
    });
  }
}

/**
 * POST /api/dashboard/progress/:courseSlug/complete-topic
 * Body: { itemId, itemTitle, totalItems, patternNumber, courseTitle, completed, resourceType }
 * Marks a topic or problem as completed or uncompleted, avoiding duplicates
 */
async function completeTopic(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { courseSlug } = req.params;
    const {
      itemId,
      itemTitle,
      totalItems = 0,
      patternNumber,
      courseTitle = courseSlug,
      completed = true,
      resourceType,
    } = req.body;

    if (!itemId || !itemTitle) {
      return res.status(400).json({
        success: false,
        message: "Both itemId and itemTitle are required.",
      });
    }

    const cleanSlug = courseSlug.toLowerCase().trim();
    const cleanItemId = String(itemId).trim();
    const cleanItemTitle = String(itemTitle).trim();
    const today = getLocalDateString();

    // Find or create course progress document
    let progress = await CourseProgress.findOne({
      user: userId,
      courseSlug: cleanSlug,
    });

    if (!progress) {
      progress = new CourseProgress({
        user: userId,
        courseSlug: cleanSlug,
        courseTitle,
        totalItems: Math.max(0, Number(totalItems) || 0),
        completedItems: [],
      });
    } else if (totalItems > 0 && progress.totalItems !== totalItems) {
      progress.totalItems = Number(totalItems);
    }

    if (completed) {
      // Check if already completed (prevent duplicates)
      const alreadyCompleted = progress.completedItems.some(
        (item) => item.itemId === cleanItemId
      );

      if (!alreadyCompleted) {
        progress.completedItems.push({
          itemId: cleanItemId,
          itemTitle: cleanItemTitle,
          completedAt: new Date(),
        });
      }

      // Update last accessed topic
      progress.lastAccessedTopic = {
        itemId: cleanItemId,
        itemTitle: cleanItemTitle,
        patternNumber: patternNumber ? Number(patternNumber) : undefined,
        resourceType: resourceType ? String(resourceType).trim() : undefined,
        updatedAt: new Date(),
      };
      progress.lastAccessedAt = new Date();

      await progress.save();

      // Log student activity
      const isDsa = cleanSlug === "dsa";
      const activityType = isDsa ? "dsa_solved" : "topic_completed";

      try {
        await StudentActivity.create({
          user: userId,
          activityType,
          dateString: today,
          details: {
            problemId: cleanItemId,
            problemTitle: cleanItemTitle,
            patternNumber: patternNumber ? Number(patternNumber) : undefined,
            courseSlug: cleanSlug,
            topicTitle: cleanItemTitle,
          },
        });
      } catch (actErr) {
        if (actErr.code !== 11000) {
          console.warn("Failed to log activity entry:", actErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: alreadyCompleted
          ? "Topic was already recorded as completed."
          : "Topic completion saved successfully.",
        data: {
          courseSlug: progress.courseSlug,
          completedCount: progress.completedItems.length,
          totalItems: progress.totalItems,
          progressPercentage: progress.progressPercentage,
          lastAccessedTopic: progress.lastAccessedTopic,
        },
      });
    } else {
      // Uncomplete topic: remove from completedItems
      const initialCount = progress.completedItems.length;
      progress.completedItems = progress.completedItems.filter(
        (item) => item.itemId !== cleanItemId
      );

      if (progress.completedItems.length !== initialCount) {
        await progress.save();
      }

      // Remove activity entry if DSA solved
      if (cleanSlug === "dsa") {
        await StudentActivity.findOneAndDelete({
          user: userId,
          activityType: "dsa_solved",
          "details.problemId": cleanItemId,
        }).catch(() => { });
      }

      return res.status(200).json({
        success: true,
        message: "Topic completion removed.",
        data: {
          courseSlug: progress.courseSlug,
          completedCount: progress.completedItems.length,
          totalItems: progress.totalItems,
          progressPercentage: progress.progressPercentage,
          lastAccessedTopic: progress.lastAccessedTopic,
        },
      });
    }
  } catch (error) {
    console.error("Complete topic error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record topic completion.",
      error: error.message,
    });
  }
}

/**
 * POST /api/dashboard/progress/:courseSlug/access-topic
 * Body: { itemId, itemTitle, patternNumber, resourceType }
 * Updates the last accessed topic without marking it complete
 */
async function recordTopicAccess(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { courseSlug } = req.params;
    const { itemId, itemTitle, patternNumber, resourceType, courseTitle = courseSlug } = req.body;

    if (!itemId || !itemTitle) {
      return res.status(400).json({
        success: false,
        message: "Both itemId and itemTitle are required.",
      });
    }

    const cleanSlug = courseSlug.toLowerCase().trim();
    let progress = await CourseProgress.findOne({
      user: userId,
      courseSlug: cleanSlug,
    });

    if (!progress) {
      progress = new CourseProgress({
        user: userId,
        courseSlug: cleanSlug,
        courseTitle,
        completedItems: [],
      });
    }

    progress.lastAccessedTopic = {
      itemId: String(itemId).trim(),
      itemTitle: String(itemTitle).trim(),
      patternNumber: patternNumber ? Number(patternNumber) : undefined,
      resourceType: resourceType ? String(resourceType).trim() : undefined,
      updatedAt: new Date(),
    };
    progress.lastAccessedAt = new Date();

    await progress.save();

    return res.json({
      success: true,
      message: "Topic access recorded successfully.",
      data: progress.lastAccessedTopic,
    });
  } catch (error) {
    console.error("Record topic access error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record topic access.",
      error: error.message,
    });
  }
}

/**
 * POST /api/dashboard/progress/dsa/batch-sync
 * Body: { solvedItems: [{ itemId, itemTitle, patternNumber }] }
 * Batch syncs existing solved DSA problems (e.g. from localStorage) into MongoDB
 */
async function batchSyncDsa(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { solvedItems = [], totalItems = 150 } = req.body;

    if (!Array.isArray(solvedItems)) {
      return res.status(400).json({
        success: false,
        message: "solvedItems must be an array.",
      });
    }

    let progress = await CourseProgress.findOne({
      user: userId,
      courseSlug: "dsa",
    });

    if (!progress) {
      progress = new CourseProgress({
        user: userId,
        courseSlug: "dsa",
        courseTitle: "Data Structures & Algorithms",
        totalItems: Math.max(0, Number(totalItems) || 150),
        completedItems: [],
      });
    } else if (totalItems > 0) {
      progress.totalItems = Number(totalItems);
    }

    const existingIds = new Set(progress.completedItems.map((item) => item.itemId));
    const today = getLocalDateString();
    let newlyAddedCount = 0;

    for (const item of solvedItems) {
      if (!item.itemId || !item.itemTitle) continue;
      const cleanId = String(item.itemId).trim();
      const cleanTitle = String(item.itemTitle).trim();

      if (!existingIds.has(cleanId)) {
        existingIds.add(cleanId);
        progress.completedItems.push({
          itemId: cleanId,
          itemTitle: cleanTitle,
          completedAt: new Date(),
        });
        newlyAddedCount++;

        // Add student activity record for each newly synced problem
        try {
          await StudentActivity.create({
            user: userId,
            activityType: "dsa_solved",
            dateString: today,
            details: {
              problemId: cleanId,
              problemTitle: cleanTitle,
              patternNumber: item.patternNumber ? Number(item.patternNumber) : undefined,
              courseSlug: "dsa",
              topicTitle: cleanTitle,
            },
          });
        } catch {
          // Ignore duplicate activity
        }
      }
    }

    if (newlyAddedCount > 0) {
      await progress.save();
    }

    return res.json({
      success: true,
      message: `Synced ${newlyAddedCount} new problems. Total solved: ${progress.completedItems.length}.`,
      data: {
        completedCount: progress.completedItems.length,
        totalItems: progress.totalItems,
        progressPercentage: progress.progressPercentage,
        completedItems: progress.completedItems,
      },
    });
  } catch (error) {
    console.error("Batch sync DSA error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to batch sync DSA progress.",
      error: error.message,
    });
  }
}

module.exports = {
  getProgress,
  getCourseProgressBySlug,
  completeTopic,
  recordTopicAccess,
  batchSyncDsa,
};
