const mongoose = require("mongoose");

const dailyGoalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Goal title is required"],
      trim: true,
      maxlength: [120, "Goal title cannot exceed 120 characters"],
    },
    targetDurationMinutes: {
      type: Number,
      default: 0,
      min: [0, "Target duration cannot be negative"],
      max: [1440, "Target duration cannot exceed 24 hours"],
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    targetDate: {
      type: String,
      required: [true, "Target date is required"],
      index: true, // format: YYYY-MM-DD
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to query goals by user and date
dailyGoalSchema.index({ user: 1, targetDate: 1 });

// Prevent duplicate goal title for the same user on the same date
dailyGoalSchema.index(
  { user: 1, targetDate: 1, title: 1 },
  { unique: true }
);

module.exports = mongoose.model("DailyGoal", dailyGoalSchema);
