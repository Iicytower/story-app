import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Block } from "@/lib/models/block";
import { Conversation } from "@/lib/models/conversation";
import { Message } from "@/lib/models/message";
import { NOT_DELETED, User } from "@/lib/models/user";
import { resolveMentions } from "@/lib/social/mentions";
import { hiddenUserIdsFor } from "@/lib/social/permissions";

export const MESSAGES_PAGE = 50;
export const CONVERSATIONS_SHOWN = 100;
// Characters of the last message sent for the list preview; the line is cut further by CSS.
export const PREVIEW_LENGTH = 200;

type Id = string | Types.ObjectId;

export function pairOf(a: Id, b: Id): [Types.ObjectId, Types.ObjectId] {
  const ids = [a, b].map((id) => new Types.ObjectId(id.toString()));
  ids.sort((x, y) => x.toString().localeCompare(y.toString()));
  return [ids[0], ids[1]];
}

export const pairKeyOf = (a: Id, b: Id) => pairOf(a, b).join(":");

export function findConversationBetween(a: Id, b: Id) {
  return Conversation.findOne({ pairKey: pairKeyOf(a, b) }).lean();
}

// For task 86: a block closes the conversation of the pair, unblocking opens it again. Until
// then a block is also checked when read (conversationClosed), so either one closes it.
export async function setConversationClosed(
  a: Id,
  b: Id,
  closed: boolean,
): Promise<void> {
  await connectDB();
  await Conversation.updateOne(
    { pairKey: pairKeyOf(a, b) },
    { $set: { closedAt: closed ? new Date() : null } },
  );
}

export const otherOf = (participantIds: Types.ObjectId[], userId: string) =>
  participantIds.find((id) => !id.equals(userId)) ?? participantIds[0];

// The other parties of userId's conversations with a block either way.
async function blockedAmong(
  userId: string,
  others: Types.ObjectId[],
): Promise<Set<string>> {
  if (others.length === 0) return new Set();
  const blocks = await Block.find({
    $or: [
      { blockerId: userId, blockedId: { $in: others } },
      { blockerId: { $in: others }, blockedId: userId },
    ],
  })
    .select({ blockerId: 1, blockedId: 1 })
    .lean();
  return new Set(
    blocks.map(({ blockerId, blockedId }) =>
      (blockerId.equals(userId) ? blockedId : blockerId).toString(),
    ),
  );
}

export async function conversationClosed(conversation: {
  participantIds: Types.ObjectId[];
  closedAt: Date | null;
}): Promise<boolean> {
  if (conversation.closedAt) return true;
  const [a, b] = conversation.participantIds;
  const block = await Block.exists({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a },
    ],
  });
  return block !== null;
}

// Conversations with a message the account has not read: the sidebar counter (D80).
export async function countUnreadConversations(
  userId: string,
): Promise<number> {
  await connectDB();
  return Conversation.countDocuments({
    unreadBy: new Types.ObjectId(userId),
  });
}

export interface ConversationView {
  id: string;
  // The other party; null for an account without a nickname.
  nickname: string | null;
  // Whether their profile is visible to the viewer, for the link.
  visible: boolean;
  lastMessageAt: string;
  unread: boolean;
  closed: boolean;
  // The start of the last message as written (markdown), null in a conversation without one.
  preview: { body: string; own: boolean } | null;
}

// The last message of each conversation in one query: the sort follows the message index
// backwards, so the group takes the first one of each conversation without reading the rest.
async function lastMessagesOf(
  conversationIds: Types.ObjectId[],
): Promise<Map<string, { senderId: Types.ObjectId; body: string }>> {
  if (conversationIds.length === 0) return new Map();
  const rows = await Message.aggregate<{
    _id: Types.ObjectId;
    senderId: Types.ObjectId;
    body: string;
  }>([
    { $match: { conversationId: { $in: conversationIds } } },
    { $sort: { conversationId: -1, createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$conversationId",
        senderId: { $first: "$senderId" },
        body: { $first: "$body" },
      },
    },
    {
      $project: {
        senderId: 1,
        body: { $substrCP: ["$body", 0, PREVIEW_LENGTH] },
      },
    },
  ]);
  return new Map(rows.map(({ _id, ...last }) => [_id.toString(), last]));
}

async function viewsOf(
  userId: string,
  conversations: {
    _id: Types.ObjectId;
    participantIds: Types.ObjectId[];
    lastMessageAt: Date;
    unreadBy: Types.ObjectId[];
    closedAt: Date | null;
  }[],
): Promise<ConversationView[]> {
  const others = conversations.map(({ participantIds }) =>
    otherOf(participantIds, userId),
  );
  const [users, blocked, hidden, lastMessages] = await Promise.all([
    User.find({
      _id: { $in: others },
      nickname: { $type: "string" },
      ...NOT_DELETED,
    })
      .select({ nickname: 1 })
      .lean(),
    blockedAmong(userId, others),
    hiddenUserIdsFor(userId),
    lastMessagesOf(conversations.map(({ _id }) => _id)),
  ]);
  const nicknames = new Map(
    users.map(({ _id, nickname }) => [_id.toString(), nickname]),
  );
  const hiddenIds = new Set(hidden.map(String));
  return conversations.map((conversation, index) => {
    const other = others[index].toString();
    const last = lastMessages.get(conversation._id.toString());
    return {
      id: conversation._id.toString(),
      nickname: nicknames.get(other) ?? null,
      visible: !hiddenIds.has(other),
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      unread: conversation.unreadBy.some((id) => id.equals(userId)),
      closed: Boolean(conversation.closedAt) || blocked.has(other),
      preview: last
        ? { body: last.body, own: last.senderId.equals(userId) }
        : null,
    };
  });
}

export async function listConversations(
  userId: string,
): Promise<ConversationView[]> {
  await connectDB();
  const conversations = await Conversation.find({
    participantIds: new Types.ObjectId(userId),
  })
    .sort({ lastMessageAt: -1 })
    .limit(CONVERSATIONS_SHOWN)
    .lean();
  return viewsOf(userId, conversations);
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationView | null> {
  if (!Types.ObjectId.isValid(conversationId)) return null;
  await connectDB();
  const conversation = await findOwnConversation(userId, conversationId);
  if (!conversation) return null;
  const [view] = await viewsOf(userId, [conversation]);
  return view;
}

export interface MessageView {
  id: string;
  own: boolean;
  body: string;
  createdAt: string;
  // Mentions that link to a profile (task 82).
  mentions: string[];
}

export type MessageCursor = { before: string } | { after: string } | null;

// A page of MESSAGES_PAGE in time order: the latest, the ones before a message (older) or after
// one (the poll). Ties of createdAt are broken by _id. null for an unknown cursor.
export async function listMessages(
  userId: string,
  conversationId: Types.ObjectId,
  cursor: MessageCursor,
): Promise<{ messages: MessageView[]; hasOlder: boolean } | null> {
  await connectDB();
  const id = cursor && ("before" in cursor ? cursor.before : cursor.after);
  let range = {};
  let newer = false;
  if (cursor) {
    const at = Types.ObjectId.isValid(id!)
      ? await Message.findOne({ _id: id, conversationId })
          .select({ createdAt: 1 })
          .lean()
      : null;
    if (!at) return null;
    newer = "after" in cursor;
    const op = newer ? "$gt" : "$lt";
    range = {
      $or: [
        { createdAt: { [op]: at.createdAt } },
        { createdAt: at.createdAt, _id: { [op]: at._id } },
      ],
    };
  }
  const order = newer ? 1 : -1;
  const found = await Message.find({ conversationId, ...range })
    .sort({ createdAt: order, _id: order })
    .limit(MESSAGES_PAGE + 1)
    .lean();
  const more = found.length > MESSAGES_PAGE;
  const page = found.slice(0, MESSAGES_PAGE);
  if (page.length === 0) return { messages: [], hasOlder: false };
  if (!newer) page.reverse();
  const hidden = await hiddenUserIdsFor(userId);
  const mentions = await resolveMentions(
    page.map(({ senderId, body }) => ({ writerId: senderId, body })),
    hidden,
  );
  return {
    messages: page.map((message, index) => ({
      id: message._id.toString(),
      own: message.senderId.equals(userId),
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      mentions: mentions[index],
    })),
    // The poll does not page backwards.
    hasOlder: !newer && more,
  };
}

// Only a party finds it (D1).
export function findOwnConversation(userId: string, conversationId: string) {
  return Conversation.findOne({
    _id: conversationId,
    participantIds: new Types.ObjectId(userId),
  }).lean();
}
