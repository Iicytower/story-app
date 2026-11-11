import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MAX_REPORT_LENGTH } from "@/lib/limits";
import {
  REPORT_REASONS,
  REPORT_TARGETS,
  type ReportReason,
  type ReportTarget,
} from "@/lib/social/reports";

// A report of content in an author's community goes to the author and their moderators, the
// rest to the admin (D80, task 80). targetUserId is the account whose content it is, kept after
// the content is gone. Reports outlive purged content, as the moderation log does.
export interface ReportFields {
  reporterId: Types.ObjectId;
  targetType: ReportTarget;
  targetId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  route: "author" | "admin";
  authorId?: Types.ObjectId;
  reason: ReportReason;
  details: string;
  state: "open" | "resolved" | "dismissed";
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const reportSchema = new Schema<ReportFields>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    route: { type: String, enum: ["author", "admin"], required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: MAX_REPORT_LENGTH, default: "" },
    state: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// One open report of an object per person; a decided one can be followed by a new one.
reportSchema.index(
  { reporterId: 1, targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { state: "open" } },
);
reportSchema.index({ route: 1, authorId: 1, state: 1, createdAt: -1 });
// Account deletion (task 89).
reportSchema.index({ reporterId: 1 });

export const Report: Model<ReportFields> =
  (mongoose.models.Report as Model<ReportFields> | undefined) ??
  mongoose.model<ReportFields>("Report", reportSchema, "reports");
