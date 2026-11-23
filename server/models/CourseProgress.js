const mongoose = require("mongoose");

const completedItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      trim: true,
    },
    itemTitle: {
      type: String,
      required: true,
      trim: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const courseProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    courseSlug: {
      type: String,
      required: [true, "Course slug is required"],
      trim: true,
      lowercase: true,
    },
    courseTitle: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
    },
    tag: {
      type: String,
      trim: true,
      default: "COURSE",
    },
    totalItems: {
      type: Number,
      default: 0,
      min: [0, "Total items cannot be negative"],
    },
    completedItems: [completedItemSchema],
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    lastAccessedTopic: {
      itemId: { type: String, trim: true },
      itemTitle: { type: String, trim: true },
      patternNumber: { type: Number },
      resourceType: { type: String, trim: true },
      updatedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

// One progress document per user per course
courseProgressSchema.index({ user: 1, courseSlug: 1 }, { unique: true });

// Auto-recalculate progress percentage before saving
courseProgressSchema.pre("save", function () {
  if (this.totalItems > 0 && Array.isArray(this.completedItems)) {
    this.progressPercentage = Math.min(
      100,
      Math.round((this.completedItems.length / this.totalItems) * 100)
    );
  } else {
    this.progressPercentage = 0;
  }
  this.lastAccessedAt = new Date();
});

module.exports = mongoose.model("CourseProgress", courseProgressSchema);
