"use server";

import { Types } from "mongoose";
import { findUserByNickname } from "@/lib/accounts";
import { isId, isString } from "@/lib/action-input";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { lengthError } from "@/lib/limits";
import { Conversation } from "@/lib/models/conversation";
import { Follow } from "@/lib/models/follow";
import { Message } from "@/lib/models/message";
import { User } from "@/lib/models/user";
import {
  giveBackAttempt,
  SOCIAL_LIMITS,
  takeUserAttempt,
} from "@/lib/rate-limit";
import { getUserSettings } from "@/lib/settings/queries";
import type { DmFrom } from "@/lib/settings/settings";
import {
  conversationClosed,
  findConversationBetween,
  findOwnConversation,
  listMessages,
  type MessageView,
  otherOf,
  pairKeyOf,
  pairOf,
} from "@/lib/social/direct-messages";
import { mentionRecipients } from "@/lib/social/mentions";
import { notifyLater } from "@/lib/social/notify";
import { canInteract } from "@/lib/social/permissions";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const rateLimited = () => actionError("RATE_LIMITED", "tooManyAttempts");
const notFound = () => actionError("NOT_FOUND", "conversationNotFound");
// One key for a ban, a block, a closed conversation and the recipient's setting, so none of
// them is told apart (D80).
const refused = () => actionError("FORBIDDEN", "interactionNotAllowed");

// actionError translates, so it is async.
async function messageBody(value: unknown): Promise<string | ActionError> {
  if (!isString(value)) return invalid();
  const body = value.trim();
  if (!body) return actionError("INVALID_INPUT", "messageRequired");
  const tooLong = lengthError("dm", body);
  return tooLong ? translateError(tooLong) : body;
}

// The recipient sees the sender by name, and bans and blocks refuse it (D80).
async function sendError(
  userId: string,
  otherId: Types.ObjectId,
): Promise<ActionError | null> {
  const [named, permission] = await Promise.all([
    User.exists({ _id: userId, nickname: { $type: "string" } }),
    canInteract(userId, { authorId: otherId.toString(), kind: "dm" }),
  ]);
  if (!named) return refused();
  return permission.ok ? null : translateError(permission);
}

async function deliver(
  userId: string,
  conversationId: Types.ObjectId,
  otherId: Types.ObjectId,
  body: string,
): Promise<void> {
  const message = await Message.create({
    conversationId,
    senderId: userId,
    body,
  });
  // $max: of two messages sent at once the later time stays. After a message only the other
  // party has something unread, so answering reads the conversation.
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $max: { lastMessageAt: message.createdAt },
      $set: { unreadBy: [otherId] },
    },
  );
  // Only the other party can be mentioned in a conversation (task 82).
  notifyLater(() => mentionRecipients(userId, body, { only: [otherId] }), {
    type: "mention",
    actorId: userId,
    conversationId,
  });
}

// Whether the recipient's setting lets userId start a conversation (D80).
async function acceptsNew(
  userId: string,
  recipientId: Types.ObjectId,
): Promise<boolean> {
  const { dmFrom } = (await getUserSettings(recipientId.toString())).messages;
  if (dmFrom === "everyone") return true;
  if (dmFrom === "nobody") return false;
  return (
    (await Follow.exists({ followerId: recipientId, followeeId: userId })) !==
    null
  );
}

// Both limits count for a new conversation; a refusal of the minute one gives the day's attempt
// back (D80, task 69).
async function takeConversationAttempt(userId: string): Promise<boolean> {
  const day = await takeUserAttempt(SOCIAL_LIMITS.conversationDay, userId);
  if (!day) return false;
  if (await takeUserAttempt(SOCIAL_LIMITS.dmMinute, userId)) return true;
  await giveBackAttempt(day);
  return false;
}

async function createConversation(
  userId: string,
  recipientId: Types.ObjectId,
): Promise<Types.ObjectId> {
  const participantIds = pairOf(userId, recipientId);
  try {
    const conversation = await Conversation.create({
      participantIds,
      pairKey: pairKeyOf(userId, recipientId),
      lastMessageAt: new Date(),
    });
    return conversation._id;
  } catch (error) {
    // The other party started it at the same moment.
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await findConversationBetween(userId, recipientId);
    return existing!._id;
  }
}

// The first message to nickname, or the next one when the two already have a conversation:
// an existing conversation goes on whatever the recipient's setting (D80).
export async function startConversation(
  nickname: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(nickname)) return invalid();
  const text = await messageBody(body);
  if (!isString(text)) return text;
  await connectDB();
  const recipient = await findUserByNickname(nickname);
  if (!recipient?.nickname) return actionError("NOT_FOUND", "userNotFound");
  if (recipient._id.equals(user.userId)) return refused();
  const existing = await findConversationBetween(user.userId, recipient._id);
  if (existing) {
    const sent = await sendTo(user.userId, existing, text);
    return sent.ok ? { ok: true, id: existing._id.toString() } : sent;
  }
  if (!(await takeConversationAttempt(user.userId))) return rateLimited();
  const refusal = await sendError(user.userId, recipient._id);
  if (refusal) return refusal;
  if (!(await acceptsNew(user.userId, recipient._id))) return refused();

  const conversationId = await createConversation(user.userId, recipient._id);
  await deliver(user.userId, conversationId, recipient._id, text);
  return { ok: true, id: conversationId.toString() };
}

async function sendTo(
  userId: string,
  conversation: {
    _id: Types.ObjectId;
    participantIds: Types.ObjectId[];
    closedAt: Date | null;
  },
  body: string,
): Promise<ActionResult> {
  if (!(await takeUserAttempt(SOCIAL_LIMITS.dmMinute, userId))) {
    return rateLimited();
  }
  const other = otherOf(conversation.participantIds, userId);
  // A block closes the conversation both ways (D80).
  if (await conversationClosed(conversation)) return refused();
  const refusal = await sendError(userId, other);
  if (refusal) return refusal;
  await deliver(userId, conversation._id, other, body);
  return { ok: true };
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(conversationId)) return invalid();
  const text = await messageBody(body);
  if (!isString(text)) return text;
  await connectDB();
  const conversation = await findOwnConversation(user.userId, conversationId);
  if (!conversation) return notFound();
  return sendTo(user.userId, conversation, text);
}

export async function markConversationRead(
  conversationId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(conversationId)) return invalid();
  await connectDB();
  const { matchedCount } = await Conversation.updateOne(
    { _id: conversationId, participantIds: new Types.ObjectId(user.userId) },
    { $pull: { unreadBy: new Types.ObjectId(user.userId) } },
  );
  return matchedCount > 0 ? { ok: true } : notFound();
}

// Older messages (before) and the poll of the open conversation (after), read lazily like the
// notifications panel (task 81). closed tells the thread to put the form away.
export async function getMessages(
  conversationId: string,
  // after: null for the latest page, e.g. of a conversation shown without messages.
  cursor: { before: string } | { after: string | null },
): Promise<
  ActionResult<{ messages: MessageView[]; hasOlder: boolean; closed: boolean }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(conversationId) || typeof cursor !== "object" || cursor === null) {
    return invalid();
  }
  const parsed =
    "before" in cursor && isId(cursor.before)
      ? { before: cursor.before }
      : "after" in cursor && isId(cursor.after)
        ? { after: cursor.after }
        : "after" in cursor && cursor.after === null
          ? null
          : undefined;
  if (parsed === undefined) return invalid();
  await connectDB();
  const conversation = await findOwnConversation(user.userId, conversationId);
  if (!conversation) return notFound();
  const [page, closed] = await Promise.all([
    listMessages(user.userId, conversation._id, parsed),
    conversationClosed(conversation),
  ]);
  if (!page) return invalid();
  return { ok: true, ...page, closed };
}

// Read when the settings dialog opens; a change is saved with saveSettings at once.
export async function getMessageSettings(): Promise<
  ActionResult<{ dmFrom: DmFrom }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  return {
    ok: true,
    dmFrom: (await getUserSettings(user.userId)).messages.dmFrom,
  };
}
