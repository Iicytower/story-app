"use server";

import { isId } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { Notification } from "@/lib/models/notification";
import { getUserSettings } from "@/lib/settings/queries";
import { countUnreadConversations } from "@/lib/social/direct-messages";
import { publishRead, realtimeUrl } from "@/lib/social/realtime";
import { createRealtimeToken } from "@/lib/social/realtime-token";
import { toolsConfig } from "@/lib/tools/client";
import type { UserSettings } from "@/lib/settings/settings";
import {
  countUnread,
  listNotifications,
  type NotificationView,
} from "@/lib/social/notification-list";

// The polled counters (D80): notifications and conversations with unread messages, no list.
export async function unreadCounts(): Promise<
  ActionResult<{ notifications: number; messages: number }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  const [notifications, messages] = await Promise.all([
    countUnread(user.userId),
    countUnreadConversations(user.userId),
  ]);
  return { ok: true, notifications, messages };
}

// The token of the realtime stream for the session's account (task 90, D80), renewed by the
// page before it expires.
export async function realtimeToken(): Promise<
  ActionResult<{ token: string; expiresAt: number }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  const config = toolsConfig();
  if (!config || !realtimeUrl()) {
    return actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  }
  return { ok: true, ...createRealtimeToken(user.userId, config.secret) };
}

export async function getNotifications(): Promise<
  ActionResult<{ notifications: NotificationView[]; unread: number }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  const [notifications, unread] = await Promise.all([
    listNotifications(user.userId),
    countUnread(user.userId),
  ]);
  return { ok: true, notifications, unread };
}

// Another account's notification does not exist for this one (D1).
export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(id)) return actionError("INVALID_INPUT", "requestInvalid");
  await connectDB();
  const owned = { _id: id, userId: user.userId };
  // Reading keeps updatedAt: the order of the list and the TTL stay as they were.
  const { matchedCount } = await Notification.updateOne(
    { ...owned, readAt: null },
    { $set: { readAt: new Date() } },
    { timestamps: false },
  );
  if (matchedCount > 0) publishRead(user.userId);
  const found = matchedCount > 0 || (await Notification.exists(owned));
  if (!found) return actionError("NOT_FOUND", "notificationNotFound");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  await connectDB();
  const { modifiedCount } = await Notification.updateMany(
    { userId: user.userId, readAt: null },
    { $set: { readAt: new Date() } },
    { timestamps: false },
  );
  if (modifiedCount > 0) publishRead(user.userId);
  return { ok: true };
}

// Read when the settings dialog opens; a change is saved with saveSettings at once.
export async function getNotificationSettings(): Promise<
  ActionResult<{ settings: UserSettings["notifications"] }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  return {
    ok: true,
    settings: (await getUserSettings(user.userId)).notifications,
  };
}
