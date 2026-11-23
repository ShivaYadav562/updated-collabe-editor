const mongoose = require("mongoose");

const studySessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    sessionType: {
      type: String,
      enum: {
        values: ["editor_room", "dsa_practice", "course_study", "general"],
        message: "{VALUE} is not a valid session type",
      },
      default: "general",
    },
    durationMinutes: {
      type: Number,
      required: [true, "Duration in minutes is required"],
      min: [0.1, "Duration must be at least 0.1 minutes"],
      max: [720, "Duration cannot exceed 12 hours per session"],
    },
    dateString: {
      type: String,
      required: true,
      index: true, // format: YYYY-MM-DD
    },
    metadata: {
      roomId: { type: String, trim: true },
      courseSlug: { type: String, trim: true },
      topicTitle: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to aggregate user sessions by date
studySessionSchema.index({ user: 1, dateString: -1 });

module.exports = mongoose.model("StudySession", studySessionSchema);
