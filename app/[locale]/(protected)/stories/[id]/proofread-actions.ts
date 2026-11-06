"use server";

import { isObjectIdOrHexString } from "mongoose";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { folderLanguage, type FolderLanguage } from "@/lib/languages";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import {
  proofread,
  type ProofreadIssue,
} from "@/lib/proofreading/languagetool";
import { PROOFREAD_LIMIT, takeAttempt } from "@/lib/rate-limit";
import { toolsConfig, ToolsError } from "@/lib/tools/client";

// Checks the chapter's saved content (the caller saves first, task 23). The checked text is
// returned, so the caller can tell whether the offsets still fit what the editor holds.
export async function checkChapter(id: string): Promise<
  ActionResult<{
    content: string;
    language: FolderLanguage;
    issues: ProofreadIssue[];
  }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  const config = toolsConfig();
  if (!config) return actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  if (!isObjectIdOrHexString(id)) {
    return actionError("NOT_FOUND", "storyNotFound");
  }

  await connectDB();
  const story = await Story.findOne({
    _id: id,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ content: 1, folderId: 1 })
    .lean();
  if (!story) return actionError("NOT_FOUND", "storyNotFound");
  if (!(await takeAttempt(PROOFREAD_LIMIT, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyChecks");
  }
  const folder = await Folder.findOne({
    _id: story.folderId,
    userId: user.userId,
  })
    .select({ language: 1 })
    .lean();
  const language = folderLanguage(folder?.language);

  try {
    const issues = await proofread(config, story.content, language);
    return { ok: true, content: story.content, language, issues };
  } catch (error) {
    if (!(error instanceof ToolsError)) throw error;
    return error.failure === "TIMEOUT"
      ? actionError("TIMEOUT", "toolTimeout")
      : actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  }
}
