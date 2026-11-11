export const REPORT_TARGETS = [
  "comment",
  "post",
  "story",
  "folder",
  "profile",
] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "illegal",
  "unmarkedAdult",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_OUTCOMES = ["resolved", "dismissed"] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

export const isReportReason = (value: unknown): value is ReportReason =>
  REPORT_REASONS.includes(value as ReportReason);
