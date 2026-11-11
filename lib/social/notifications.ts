// Notification kinds (D80, task 81) by group. Mentions came with task 82; forums join in 87.
export const NOTIFICATION_GROUPS = {
  interactions: ["comment", "reaction", "rating", "follower", "library"],
  conversations: ["reply", "mention"],
  chapters: ["libraryChapter", "followedChapter"],
  moderation: [
    "moderatorInvite",
    "moderatorAccepted",
    "moderatorDeclined",
    "moderatorResigned",
    "moderatorRemoved",
    "ban",
    "hidden",
    "report",
    "reportResolved",
    "reportDismissed",
  ],
} as const;

export type NotificationGroup = keyof typeof NOTIFICATION_GROUPS;
export type NotificationType =
  (typeof NOTIFICATION_GROUPS)[NotificationGroup][number];

export const NOTIFICATION_TYPES = Object.values(
  NOTIFICATION_GROUPS,
).flat() as NotificationType[];

// Moderation cannot be turned off (D80); every other kind has its own switch in the settings.
export const OPTIONAL_GROUPS = [
  "interactions",
  "conversations",
  "chapters",
] as const satisfies NotificationGroup[];

export type OptionalNotificationType =
  (typeof NOTIFICATION_GROUPS)[(typeof OPTIONAL_GROUPS)[number]][number];

export const OPTIONAL_NOTIFICATION_TYPES: OptionalNotificationType[] =
  OPTIONAL_GROUPS.flatMap((group) => [...NOTIFICATION_GROUPS[group]]);

export function groupOf(type: NotificationType): NotificationGroup {
  return (Object.keys(NOTIFICATION_GROUPS) as NotificationGroup[]).find(
    (group) =>
      (NOTIFICATION_GROUPS[group] as readonly NotificationType[]).includes(
        type,
      ),
  )!;
}

export const isOptionalType = (
  type: NotificationType,
): type is OptionalNotificationType => groupOf(type) !== "moderation";

// Reactions and ratings of one object join in one unread notification ("5 people…").
export const GROUPED_TYPES: readonly NotificationType[] = [
  "reaction",
  "rating",
];

export const MAX_NOTIFICATIONS = 500;
export const NOTIFICATION_TTL_DAYS = 90;
export const ACTORS_KEPT = 5;
export const NOTIFICATIONS_SHOWN = 50;
export const NOTIFY_BATCH = 500;
export const POLL_MS = 30_000;
// The open conversation (task 85).
export const THREAD_POLL_MS = 5_000;

type Id = { toString(): string };

export interface NotificationSubject {
  actorId?: Id;
  authorId?: Id;
  folderId?: Id;
  storyIds?: Id[];
  commentId?: Id;
  // A mention in a direct message (task 85).
  conversationId?: Id;
}

// What groups notifications about one object, e.g. reaction:story:<id>: the most specific id.
export function objectKey(
  type: NotificationType,
  {
    actorId,
    authorId,
    folderId,
    storyIds,
    commentId,
    conversationId,
  }: NotificationSubject,
): string {
  // An admin-route report has no community; the reporter must not split or name it.
  if (type === "report" && !authorId) return "report:admin";
  const subject = conversationId
    ? `conversation:${conversationId.toString()}`
    : commentId
    ? `comment:${commentId.toString()}`
    : storyIds?.length
      ? `story:${storyIds.map(String).join(",")}`
      : folderId
        ? `folder:${folderId.toString()}`
        : `user:${(authorId ?? actorId)?.toString() ?? ""}`;
  return `${type}:${subject}`;
}
