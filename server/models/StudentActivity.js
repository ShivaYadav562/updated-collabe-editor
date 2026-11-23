const mongoose = require("mongoose");

const studentActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    activityType: {
      type: String,
      enum: {
        values: [
          "dsa_solved",
          "topic_completed",
          "goal_completed",
          "study_session",
          "login",
        ],
        message: "{VALUE} is not a valid activity type",
      },
      required: [true, "Activity type is required"],
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      index: true, // format: YYYY-MM-DD
    },
    details: {
      problemId: { type: String, trim: true },
      problemTitle: { type: String, trim: true },
      patternNumber: { type: Number },
      courseSlug: { type: String, trim: true },
      topicTitle: { type: String, trim: true },
      durationMinutes: { type: Number, min: 0 },
      metadata: { type: mongoose.Schema.Types.Mixed },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user activity by date range
studentActivitySchema.index({ user: 1, dateString: -1 });

// Unique compound index for dsa problems to prevent duplicate problem solves in activity
studentActivitySchema.index(
  { user: 1, activityType: 1, "details.problemId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      activityType: "dsa_solved",
      "details.problemId": { $exists: true, $type: "string" },
    },
  }
);

module.exports = mongoose.model("StudentActivity", studentActivitySchema);
