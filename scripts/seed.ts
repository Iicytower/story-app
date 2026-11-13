import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { BOOKS, type SeedChapter } from "./seed-content";

// Local databases only: the seed deletes and recreates its accounts' data.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function refuseRemoteDatabase(): void {
  const uri = process.env.MONGODB_URI;
  let local = false;
  try {
    const url = new URL(uri ?? "");
    local = url.protocol === "mongodb:" && LOCAL_HOSTS.has(url.hostname);
  } catch {
    local = false;
  }
  if (!local) {
    console.error(
      "Refusing to seed: MONGODB_URI must point at a local MongoDB (mongodb://127.0.0.1 or mongodb://localhost).",
    );
    process.exit(1);
  }
}

refuseRemoteDatabase();
// Seeded notifications need no push to open pages.
delete process.env.REALTIME_PUBLIC_URL;

const PASSWORD = "Quill-Lantern-2026!";
const PREFIX = "seed_";

const ACCOUNTS = [
  {
    nickname: "seed_admin",
    role: "admin",
    locale: "en",
    bio: "Keeps the site tidy. Write to me about anything that looks wrong.",
  },
  {
    nickname: "seed_anna",
    locale: "pl",
    bio: "Piszę fantasy o mgłach, mostach i ludziach, którzy się gubią. Rozdział co dwa tygodnie.",
  },
  {
    nickname: "seed_ben",
    locale: "en",
    bio: "Hard science fiction, slowly. Former radio engineer.",
  },
  {
    nickname: "seed_clara",
    locale: "en",
    bio: "Romance and ghost stories. Some of my books are 18+.",
  },
  {
    nickname: "seed_dawid",
    locale: "pl",
    bio: "Czytam wszystko, moderuję u Anny.",
  },
  { nickname: "seed_ewa", locale: "pl", bio: "Wiersze na deszczowe dni." },
  {
    nickname: "seed_frank",
    locale: "en",
    bio: "Reader, commenter, occasional critic.",
  },
  { nickname: "seed_troll", locale: "en", bio: "" },
] as const;

type Nick = (typeof ACCOUNTS)[number]["nickname"];

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (days: number, hours = 0) =>
  new Date(now - days * DAY_MS - hours * 60 * 60 * 1000);

// Deterministic, so every run seeds the same numbers.
function prng(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toMarkdown = (chapter: SeedChapter) => chapter.paragraphs.join("\n\n");

async function main() {
  // Imported after the guard, so nothing connects before it.
  const { createOrUpdateUser } = await import("@/lib/accounts");
  const { purgeAccountData } = await import("@/lib/account-deletion");
  const { passwordError } = await import("@/lib/credentials");
  const { connectDB, disconnectDB } = await import("@/lib/db");
  await import("@/lib/models");
  const { ensureStarterShelves } = await import("@/lib/library/queries");
  const { Activity } = await import("@/lib/models/activity");
  const { AuthSession } = await import("@/lib/models/session");
  const { Block } = await import("@/lib/models/block");
  const { Comment, HIDDEN_COMMENT_TTL_DAYS } =
    await import("@/lib/models/comment");
  const { CommunityBan } = await import("@/lib/models/community-ban");
  const { CommunityModerator } =
    await import("@/lib/models/community-moderator");
  const { Conversation } = await import("@/lib/models/conversation");
  const { DailyStat } = await import("@/lib/models/daily-stat");
  const { Folder } = await import("@/lib/models/folder");
  const { Follow } = await import("@/lib/models/follow");
  const { ForumCategory } = await import("@/lib/models/forum-category");
  const { ForumPost } = await import("@/lib/models/forum-post");
  const { ForumThread } = await import("@/lib/models/forum-thread");
  const { LibraryItem } = await import("@/lib/models/library-item");
  const { Message } = await import("@/lib/models/message");
  const { ModerationLog } = await import("@/lib/models/moderation-log");
  const { Notification } = await import("@/lib/models/notification");
  const { PredefinedTag } = await import("@/lib/models/predefined-tag");
  const { Profile } = await import("@/lib/models/profile");
  const { Ranking } = await import("@/lib/models/ranking");
  const { Rating } = await import("@/lib/models/rating");
  const { Reaction } = await import("@/lib/models/reaction");
  const { ReadEvent } = await import("@/lib/models/read-event");
  const { ReaderMark } = await import("@/lib/models/reader-mark");
  const { ReadingProgress } = await import("@/lib/models/reading-progress");
  const { Report } = await import("@/lib/models/report");
  const { Settings } = await import("@/lib/models/settings");
  const { Shelf } = await import("@/lib/models/shelf");
  const { Story } = await import("@/lib/models/story");
  const { ThreadFollow } = await import("@/lib/models/thread-follow");
  const { NICKNAME_COLLATION, User } = await import("@/lib/models/user");
  const { applyBlock } = await import("@/lib/social/blocks");
  const { pairKeyOf, pairOf } = await import("@/lib/social/direct-messages");
  const { threadReplyRecipients } = await import("@/lib/social/forums");
  const { mentionRecipients } = await import("@/lib/social/mentions");
  const { logModeration } = await import("@/lib/social/moderation");
  const { notify, reportRecipients } = await import("@/lib/social/notify");
  const { recomputeRanking } = await import("@/lib/social/ranking-queries");
  const { READ_EVENT_TTL_MS, statsDay } =
    await import("@/lib/social/read-stats");
  const { saveVersion } = await import("@/lib/versions/mutations");

  for (const { nickname } of ACCOUNTS) {
    const error = passwordError(PASSWORD, nickname);
    if (error) throw new Error(`Seed password rejected: ${error.key}`);
  }

  await connectDB();

  const [tagCount, categories] = await Promise.all([
    PredefinedTag.countDocuments(),
    ForumCategory.find().sort({ order: 1 }).lean(),
  ]);
  if (tagCount === 0 || categories.length === 0) {
    console.error(
      "Predefined tags or forum categories are missing. Run npm run migrate first.",
    );
    process.exitCode = 1;
    await disconnectDB();
    return;
  }

  // --- Cleanup: everything of the earlier seed accounts, tombstones included.
  const previous = (
    await User.find({ nickname: { $regex: `^${PREFIX}`, $options: "i" } })
      .select({ _id: 1 })
      .lean()
  ).map(({ _id }) => _id);
  for (const id of previous) await purgeAccountData(id.toString());
  if (previous.length > 0) {
    const ids = { $in: previous };
    const threadIds = (await ForumThread.distinct("_id", {
      userId: ids,
    })) as Types.ObjectId[];
    const postIds = (await ForumPost.distinct("_id", {
      $or: [{ threadId: { $in: threadIds } }, { userId: ids }],
    })) as Types.ObjectId[];
    await Promise.all([
      Reaction.deleteMany({ targetType: "post", targetId: { $in: postIds } }),
      ThreadFollow.deleteMany({ threadId: { $in: threadIds } }),
      Notification.deleteMany({ threadId: { $in: threadIds } }),
      Comment.deleteMany({ $or: [{ userId: ids }, { authorId: ids }] }),
      ModerationLog.deleteMany({
        $or: [{ actorId: ids }, { authorId: ids }, { targetUserId: ids }],
      }),
      Block.deleteMany({ $or: [{ blockerId: ids }, { blockedId: ids }] }),
      Report.deleteMany({
        $or: [{ reporterId: ids }, { targetUserId: ids }, { authorId: ids }],
      }),
      AuthSession.deleteMany({ userId: ids }),
    ]);
    await ForumPost.deleteMany({ _id: { $in: postIds } });
    await ForumThread.deleteMany({ _id: { $in: threadIds } });
    await User.deleteMany({ _id: ids });
  }

  // --- Accounts, settings, profiles and shelves.
  const users = {} as Record<Nick, Types.ObjectId>;
  for (const [index, account] of ACCOUNTS.entries()) {
    await createOrUpdateUser(account.nickname, PASSWORD);
    const user = await User.findOne({ nickname: account.nickname })
      .collation(NICKNAME_COLLATION)
      .lean();
    const id = user!._id;
    users[account.nickname] = id;
    // The native driver: Mongoose keeps a timestamps createdAt immutable.
    await User.collection.updateOne(
      { _id: id },
      {
        $set: {
          createdAt: daysAgo(45 - index),
          ...("role" in account && { role: account.role }),
        },
      },
    );
    await new Settings({
      userId: id,
      appearance: { locale: account.locale, accent: "sepia" },
      ...(account.nickname === "seed_frank" && {
        messages: { dmFrom: "following" },
      }),
      createdAt: daysAgo(45 - index),
      updatedAt: daysAgo(45 - index),
    }).save({ timestamps: false });
    await ensureStarterShelves(
      id.toString(),
      account.locale === "pl"
        ? ["Czytam", "Na później", "Przeczytane"]
        : ["Reading", "Read later", "Read"],
    );
    await Profile.updateOne(
      { userId: id },
      {
        $set: {
          bio: account.bio,
          libraryPublic: account.nickname !== "seed_frank",
        },
      },
    );
  }
  const u = (nick: Nick) => users[nick];
  const favourites = await new Shelf({
    userId: u("seed_dawid"),
    name: "Ulubione",
    order: 3,
    createdAt: daysAgo(30),
  }).save({ timestamps: false });

  // --- Books and chapters.
  type BookRef = {
    id: Types.ObjectId;
    owner: Types.ObjectId;
    chapters: {
      id: Types.ObjectId;
      title: string;
      content: string;
      public: boolean;
      publishedAt?: Date;
    }[];
  };
  const books = new Map<string, BookRef>();
  const positions = new Map<string, number>();
  for (const book of BOOKS) {
    const owner = u(book.owner as Nick);
    const position = positions.get(book.owner) ?? 0;
    positions.set(book.owner, position + 1);
    const latest = Math.min(...book.chapters.map((c) => c.createdDaysAgo));
    const folder = await new Folder({
      userId: owner,
      name: book.name,
      description: book.description,
      notes: book.notes,
      notesUpdatedAt: daysAgo(latest),
      lastActivityAt: daysAgo(latest),
      position,
      tags: book.tags,
      chapterSort: "created",
      manualChapterOrder: false,
      language: "pl",
      ...(book.published && { published: true }),
      ...(book.adult && { adult: { manual: true } }),
      ...(book.commentsDisabled && { commentsDisabled: true }),
      deletedAt: null,
      createdAt: daysAgo(book.createdDaysAgo),
      updatedAt: daysAgo(latest),
    }).save({ timestamps: false });
    const ref: BookRef = { id: folder._id, owner, chapters: [] };
    for (const [index, chapter] of book.chapters.entries()) {
      const content = toMarkdown(chapter);
      const publishedAt =
        chapter.publication === "public" &&
        chapter.publishedDaysAgo !== undefined
          ? daysAgo(chapter.publishedDaysAgo, 2)
          : undefined;
      const story = await new Story({
        userId: owner,
        folderId: folder._id,
        title: chapter.title,
        content,
        notes: chapter.notes ?? "",
        position: index,
        tags: chapter.tags ?? [],
        ...(chapter.publication && { publication: chapter.publication }),
        ...(publishedAt && { publishedAt }),
        ...(chapter.adult && { adult: { manual: true } }),
        deletedAt: chapter.deleted ? daysAgo(chapter.createdDaysAgo - 1) : null,
        createdAt: daysAgo(chapter.createdDaysAgo),
        updatedAt: daysAgo(chapter.publishedDaysAgo ?? chapter.createdDaysAgo),
      }).save({ timestamps: false });
      if (!chapter.deleted) {
        ref.chapters.push({
          id: story._id,
          title: chapter.title,
          content,
          public: chapter.publication === "public",
          publishedAt,
        });
      }
    }
    books.set(book.name, ref);
  }
  const book = (name: string) => books.get(name)!;
  const chapter = (name: string, index: number) => book(name).chapters[index];

  // Versions: one before and one after an edit of the first chapter.
  const valley = book("Kroniki Mglistej Doliny");
  await saveVersion(
    valley.owner.toString(),
    valley.id.toString(),
    "Pierwsza wersja",
  );
  const firstChapter = chapter("Kroniki Mglistej Doliny", 0);
  firstChapter.content = `${firstChapter.content}\n\nZa jej plecami most zaskrzypiał, choć nikt po nim nie szedł.`;
  await Story.updateOne(
    { _id: firstChapter.id },
    { $set: { content: firstChapter.content } },
    { timestamps: false },
  );
  await saveVersion(
    valley.owner.toString(),
    valley.id.toString(),
    "Po poprawkach",
  );
  const kepler = book("Signals from Kepler Station");
  await saveVersion(
    kepler.owner.toString(),
    kepler.id.toString(),
    "Before beta readers",
  );

  // --- Feed: one entry per publication day of each book.
  for (const ref of books.values()) {
    const byDay = new Map<number, Types.ObjectId[]>();
    for (const c of ref.chapters) {
      if (!c.public || !c.publishedAt) continue;
      byDay.set(c.publishedAt.getTime(), [
        ...(byDay.get(c.publishedAt.getTime()) ?? []),
        c.id,
      ]);
    }
    for (const [time, storyIds] of byDay) {
      await new Activity({
        actorId: ref.owner,
        type: "chapterPublished",
        folderId: ref.id,
        storyIds,
        createdAt: new Date(time),
      }).save({ timestamps: false });
    }
  }

  // --- Follows.
  const follows: [Nick, Nick, number][] = [
    ["seed_dawid", "seed_anna", 33],
    ["seed_ewa", "seed_anna", 30],
    ["seed_frank", "seed_anna", 26],
    ["seed_anna", "seed_ben", 28],
    ["seed_frank", "seed_ben", 27],
    ["seed_dawid", "seed_ben", 20],
    ["seed_ben", "seed_clara", 22],
    ["seed_frank", "seed_clara", 21],
    ["seed_anna", "seed_ewa", 19],
    ["seed_ben", "seed_frank", 15],
    ["seed_admin", "seed_anna", 12],
    ["seed_clara", "seed_anna", 9],
    ["seed_troll", "seed_clara", 7],
  ];
  for (const [follower, followee, days] of follows) {
    await new Follow({
      followerId: u(follower),
      followeeId: u(followee),
      createdAt: daysAgo(days),
    }).save({ timestamps: false });
    await notify(u(followee), { type: "follower", actorId: u(follower) });
  }

  // --- Library, shelves, reading progress, bookmarks and notes.
  const shelvesOf = async (nick: Nick) =>
    (
      await Shelf.find({ userId: u(nick) })
        .sort({ order: 1 })
        .lean()
    ).map(({ _id }) => _id);
  const library: [Nick, string, number[], number][] = [
    ["seed_dawid", "Kroniki Mglistej Doliny", [0], 32],
    ["seed_dawid", "Signals from Kepler Station", [2], 25],
    ["seed_dawid", "Wiersze na deszcz", [1], 18],
    ["seed_ewa", "Kroniki Mglistej Doliny", [0], 29],
    ["seed_frank", "Kroniki Mglistej Doliny", [1], 25],
    ["seed_frank", "Signals from Kepler Station", [0], 26],
    ["seed_frank", "Velvet Hours", [0], 20],
    ["seed_anna", "Signals from Kepler Station", [2], 27],
    ["seed_ben", "The House on Wren Street", [0], 14],
    ["seed_clara", "Wiersze na deszcz", [1], 10],
  ];
  for (const [reader, name, shelfIndexes, days] of library) {
    const shelves = await shelvesOf(reader);
    const ref = book(name);
    await new LibraryItem({
      userId: u(reader),
      folderId: ref.id,
      shelfIds: [
        ...shelfIndexes.map((i) => shelves[i]),
        ...(reader === "seed_dawid" && name !== "Wiersze na deszcz"
          ? [favourites._id]
          : []),
      ],
      addedAt: daysAgo(days),
    }).save();
    await notify(ref.owner, {
      type: "library",
      actorId: u(reader),
      folderId: ref.id,
    });
  }

  const progress: [Nick, string, number, number, number][] = [
    ["seed_dawid", "Kroniki Mglistej Doliny", 2, 0.4, 1],
    ["seed_ewa", "Kroniki Mglistej Doliny", 1, 0.8, 6],
    ["seed_frank", "Signals from Kepler Station", 2, 1, 4],
    ["seed_anna", "Signals from Kepler Station", 1, 0.5, 10],
    ["seed_frank", "Velvet Hours", 0, 0.6, 9],
  ];
  for (const [reader, name, last, position, days] of progress) {
    const ref = book(name);
    await new ReadingProgress({
      userId: u(reader),
      folderId: ref.id,
      lastStoryId: ref.chapters[last].id,
      position,
      readStoryIds: ref.chapters
        .slice(0, position === 1 ? last + 1 : last)
        .map(({ id }) => id),
      updatedAt: daysAgo(days),
    }).save({ timestamps: false });
  }

  // A note anchors to a passage of the chapter's text.
  const anchor = (content: string, quote: string) => {
    const start = content.indexOf(quote);
    if (start === -1) throw new Error(`Quote not in chapter: ${quote}`);
    return {
      quote,
      prefix: content.slice(Math.max(0, start - 50), start),
      suffix: content.slice(start + quote.length, start + quote.length + 50),
      position: start / content.length,
    };
  };
  const marks = [
    {
      reader: "seed_dawid" as Nick,
      c: chapter("Kroniki Mglistej Doliny", 0),
      kind: "bookmark",
      name: "Tu wrócić",
      position: 0.5,
    },
    {
      reader: "seed_dawid" as Nick,
      c: chapter("Kroniki Mglistej Doliny", 1),
      kind: "note",
      text: "Strażnik wie więcej, niż mówi. Teoria: to ojciec Ili?",
      ...anchor(
        chapter("Kroniki Mglistej Doliny", 1).content,
        "Latarnie gasną szybciej, niż myślisz.",
      ),
    },
    {
      reader: "seed_frank" as Nick,
      c: chapter("Signals from Kepler Station", 1),
      kind: "note",
      text: "Nice detail about the forty-minute round trip.",
      ...anchor(
        chapter("Signals from Kepler Station", 1).content,
        "every question took almost forty minutes to answer",
      ),
    },
    {
      reader: "seed_frank" as Nick,
      c: chapter("Signals from Kepler Station", 2),
      kind: "bookmark",
      name: "The map",
      position: 0.2,
    },
  ];
  for (const [index, { reader, c, ...mark }] of marks.entries()) {
    const ref = [...books.values()].find((b) => b.chapters.includes(c))!;
    await new ReaderMark({
      userId: u(reader),
      storyId: c.id,
      folderId: ref.id,
      ...mark,
      createdAt: daysAgo(8 - index),
      updatedAt: daysAgo(8 - index),
    }).save({ timestamps: false });
  }

  // --- Community: moderators and a ban.
  const anna = u("seed_anna");
  const ben = u("seed_ben");
  await new CommunityModerator({
    authorId: anna,
    userId: u("seed_dawid"),
    state: "active",
    createdAt: daysAgo(20),
  }).save({ timestamps: false });
  await logModeration({
    authorId: anna,
    actorId: anna,
    action: "invite",
    targetType: "user",
    targetId: u("seed_dawid"),
    targetUserId: u("seed_dawid"),
  });
  await logModeration({
    authorId: anna,
    actorId: u("seed_dawid"),
    action: "accept",
    targetType: "user",
    targetId: u("seed_dawid"),
    targetUserId: u("seed_dawid"),
  });
  await notify(u("seed_dawid"), {
    type: "moderatorInvite",
    actorId: anna,
    authorId: anna,
  });
  await notify(anna, {
    type: "moderatorAccepted",
    actorId: u("seed_dawid"),
    authorId: anna,
  });
  await new CommunityModerator({
    authorId: ben,
    userId: u("seed_frank"),
    state: "invited",
    createdAt: daysAgo(2),
  }).save({ timestamps: false });
  await logModeration({
    authorId: ben,
    actorId: ben,
    action: "invite",
    targetType: "user",
    targetId: u("seed_frank"),
    targetUserId: u("seed_frank"),
  });
  await notify(u("seed_frank"), {
    type: "moderatorInvite",
    actorId: ben,
    authorId: ben,
  });

  // A forum category moderator, named by the admin.
  const openCategories = categories.filter(({ adminOnly }) => !adminOnly);
  const announcements = categories.find(({ adminOnly }) => adminOnly);
  const workshop = openCategories[0];
  await ForumCategory.updateOne(
    { _id: workshop._id },
    { $addToSet: { moderatorIds: u("seed_ewa") } },
  );
  await logModeration({
    authorId: null,
    scope: "global",
    actorId: u("seed_admin"),
    action: "addModerator",
    targetType: "category",
    targetKey: workshop._id,
    targetUserId: u("seed_ewa"),
  });

  // --- Comments with replies, mentions and moderation.
  type CommentPlace = { book: string; chapter: number | null };
  const placeOf = ({ book: name, chapter: index }: CommentPlace) => {
    const ref = book(name);
    return {
      authorId: ref.owner,
      folderId: ref.id,
      storyId: index === null ? null : ref.chapters[index].id,
    };
  };
  const eventOf = (place: ReturnType<typeof placeOf>) => ({
    authorId: place.authorId,
    folderId: place.folderId,
    ...(place.storyId && { storyIds: [place.storyId] }),
  });
  const comments: Record<string, Types.ObjectId> = {};
  const addComment = async (
    key: string,
    writer: Nick,
    where: CommentPlace,
    body: string,
    days: number,
    parentKey?: string,
  ) => {
    const place = placeOf(where);
    const parent = parentKey ? comments[parentKey] : null;
    const comment = await new Comment({
      ...place,
      userId: u(writer),
      parentId: parent,
      body,
      createdAt: daysAgo(days),
      ...(key === "frankEdited" && { editedAt: daysAgo(days, -0.1) }),
    }).save({ timestamps: false });
    comments[key] = comment._id;
    const event = {
      actorId: u(writer),
      ...eventOf(place),
      commentId: comment._id,
    };
    const exclude = [place.authorId];
    if (parent) {
      const root = await Comment.findById(parent).select({ userId: 1 }).lean();
      exclude.push(root!.userId);
      await notify(root!.userId, { ...event, type: "reply" });
      if (!root!.userId.equals(place.authorId)) {
        await notify(place.authorId, { ...event, type: "comment" });
      }
      if (place.authorId.equals(u(writer))) {
        await new Activity({
          actorId: u(writer),
          type: "authorReply",
          folderId: place.folderId,
          ...(place.storyId && { storyIds: [place.storyId] }),
          commentId: comment._id,
          createdAt: daysAgo(days),
        }).save({ timestamps: false });
      }
    } else {
      await notify(place.authorId, { ...event, type: "comment" });
    }
    await notify(await mentionRecipients(u(writer), body, { exclude }), {
      ...event,
      type: "mention",
    });
  };
  const valley0 = { book: "Kroniki Mglistej Doliny", chapter: 0 };
  const valley1 = { book: "Kroniki Mglistej Doliny", chapter: 1 };
  await addComment(
    "dawid1",
    "seed_dawid",
    valley0,
    "Świetny klimat! Ta mgła pachnąca żelazem zostanie ze mną na długo.",
    33,
  );
  await addComment(
    "annaReply",
    "seed_anna",
    valley0,
    "Dziękuję! Zapach mgły jeszcze wróci w rozdziale trzecim.",
    32,
    "dawid1",
  );
  await addComment(
    "ewaReply",
    "seed_ewa",
    valley0,
    "Zgadzam się z przedmówcą. @seed_frank, musisz to przeczytać.",
    31,
    "dawid1",
  );
  await addComment(
    "frankEdited",
    "seed_frank",
    valley1,
    "Read it with a translator and still loved it. The bridge keeper is great.",
    19,
  );
  await addComment(
    "troll",
    "seed_troll",
    valley1,
    "Boring. Nobody reads this stuff.",
    18,
  );
  await addComment(
    "annaKepler",
    "seed_anna",
    { book: "Signals from Kepler Station", chapter: 0 },
    "The countdown at the end gave me chills. **More please!**",
    28,
  );
  await addComment(
    "benReply",
    "seed_ben",
    { book: "Signals from Kepler Station", chapter: 0 },
    "Thanks, @seed_anna! Part two is already in the works.",
    27,
    "annaKepler",
  );
  await addComment(
    "frankKepler",
    "seed_frank",
    { book: "Signals from Kepler Station", chapter: 2 },
    "Pressing send without asking anyone. Classic Mara.",
    4,
  );
  await addComment(
    "frankBook",
    "seed_frank",
    { book: "The House on Wren Street", chapter: null },
    "Whole book in one sitting. The sugar jar key is a perfect detail.",
    2,
  );
  await addComment(
    "dawidClara",
    "seed_dawid",
    { book: "Velvet Hours", chapter: 0 },
    "Piękna scena w pociągu.",
    20,
  );

  // The troll's comment, hidden by the community moderator.
  const hiddenAt = daysAgo(17);
  const purgeAt = new Date(
    hiddenAt.getTime() + HIDDEN_COMMENT_TTL_DAYS * DAY_MS,
  );
  await Comment.updateOne(
    { _id: comments.troll },
    {
      $set: {
        hidden: {
          by: u("seed_dawid"),
          at: hiddenAt,
          reason: "Off-topic insult",
        },
        purgeAt,
      },
    },
  );
  await logModeration({
    authorId: anna,
    actorId: u("seed_dawid"),
    action: "hide",
    targetType: "comment",
    targetId: comments.troll,
    targetUserId: u("seed_troll"),
    reason: "Off-topic insult",
  });
  await notify(u("seed_troll"), {
    type: "hidden",
    actorId: u("seed_dawid"),
    ...eventOf(placeOf(valley1)),
    commentId: comments.troll,
  });

  // The troll is banned in Anna's community for two weeks, and Clara blocks them.
  await new CommunityBan({
    authorId: anna,
    userId: u("seed_troll"),
    until: new Date(now + 14 * DAY_MS),
    reason: "Insulting readers in the comments",
    by: u("seed_dawid"),
    createdAt: daysAgo(17),
  }).save({ timestamps: false });
  await logModeration({
    authorId: anna,
    actorId: u("seed_dawid"),
    action: "ban",
    targetType: "user",
    targetId: u("seed_troll"),
    targetUserId: u("seed_troll"),
    reason: "Insulting readers in the comments",
  });
  await notify(u("seed_troll"), {
    type: "ban",
    actorId: u("seed_dawid"),
    authorId: anna,
  });
  await applyBlock(u("seed_clara"), u("seed_troll"));

  // --- Reports: one for the community, two for the admins (one already resolved).
  const reports = [
    {
      reporterId: u("seed_frank"),
      targetType: "comment",
      targetId: comments.troll,
      targetUserId: u("seed_troll"),
      route: "author",
      authorId: anna,
      reason: "harassment",
      details: "Insults other readers.",
      createdAt: daysAgo(18, -2),
    },
    {
      reporterId: u("seed_ewa"),
      targetType: "profile",
      targetId: u("seed_troll"),
      targetUserId: u("seed_troll"),
      route: "admin",
      reason: "spam",
      details: "Posts the same insult everywhere.",
      createdAt: daysAgo(6),
    },
    {
      reporterId: u("seed_dawid"),
      targetType: "story",
      targetId: chapter("The House on Wren Street", 1).id,
      targetUserId: u("seed_clara"),
      route: "admin",
      reason: "unmarkedAdult",
      details: "Maybe too scary without a warning?",
      state: "dismissed",
      resolvedBy: u("seed_admin"),
      resolvedAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
  ] as const;
  for (const report of reports) {
    await new Report(report).save({ timestamps: false });
    if (!("state" in report)) {
      await notify(
        await reportRecipients({
          ...("authorId" in report && { authorId: report.authorId }),
          targetUserId: report.targetUserId,
        }),
        {
          type: "report",
          actorId: report.reporterId,
          ...("authorId" in report && { authorId: report.authorId }),
        },
      );
    }
  }
  await logModeration({
    authorId: null,
    scope: "global",
    actorId: u("seed_admin"),
    action: "dismiss",
    targetType: "report",
    targetUserId: u("seed_clara"),
  });
  await notify(u("seed_dawid"), {
    type: "reportDismissed",
    actorId: u("seed_admin"),
  });

  // --- Ratings: enough book ratings for the "top rated" ranking.
  const random = prng(42);
  const raters: Nick[] = [
    "seed_admin",
    "seed_anna",
    "seed_ben",
    "seed_clara",
    "seed_dawid",
    "seed_ewa",
    "seed_frank",
  ];
  const rated: [string, number][] = [
    ["Kroniki Mglistej Doliny", 4.5],
    ["Signals from Kepler Station", 4],
    ["Wiersze na deszcz", 3.8],
    ["Velvet Hours", 3.5],
    ["The House on Wren Street", 4.2],
  ];
  for (const [name, mean] of rated) {
    const ref = book(name);
    for (const [index, rater] of raters.entries()) {
      if (u(rater).equals(ref.owner)) continue;
      if (name === "Velvet Hours" && index % 2 === 0) continue;
      const value = Math.max(
        1,
        Math.min(5, Math.round(mean + (random() - 0.5) * 2)),
      );
      await new Rating({
        userId: u(rater),
        targetType: "folder",
        targetId: ref.id,
        authorId: ref.owner,
        folderId: ref.id,
        storyId: null,
        value,
        updatedAt: daysAgo(1 + Math.floor(random() * 20)),
      }).save();
      await notify(ref.owner, {
        type: "rating",
        actorId: u(rater),
        authorId: ref.owner,
        folderId: ref.id,
      });
    }
    const first = ref.chapters[0];
    for (const rater of raters.slice(4)) {
      if (u(rater).equals(ref.owner)) continue;
      await new Rating({
        userId: u(rater),
        targetType: "story",
        targetId: first.id,
        authorId: ref.owner,
        folderId: ref.id,
        storyId: first.id,
        value: 5,
        updatedAt: daysAgo(3),
      }).save();
      await notify(ref.owner, {
        type: "rating",
        actorId: u(rater),
        authorId: ref.owner,
        folderId: ref.id,
        storyIds: [first.id],
      });
    }
  }

  // --- Reactions to chapters and comments.
  const reactionKeys = [
    "heart",
    "laugh",
    "wow",
    "sad",
    "fire",
    "clap",
  ] as const;
  for (const ref of books.values()) {
    for (const c of ref.chapters.filter((x) => x.public)) {
      for (const rater of raters) {
        if (u(rater).equals(ref.owner) || random() < 0.4) continue;
        await new Reaction({
          userId: u(rater),
          targetType: "story",
          targetId: c.id,
          authorId: ref.owner,
          folderId: ref.id,
          storyId: c.id,
          reaction: reactionKeys[Math.floor(random() * reactionKeys.length)],
          createdAt: daysAgo(Math.floor(random() * 10)),
        }).save();
        await notify(ref.owner, {
          type: "reaction",
          actorId: u(rater),
          authorId: ref.owner,
          folderId: ref.id,
          storyIds: [c.id],
        });
      }
    }
  }
  const commentReactions: [string, Nick, (typeof reactionKeys)[number]][] = [
    ["dawid1", "seed_anna", "heart"],
    ["dawid1", "seed_ewa", "clap"],
    ["annaKepler", "seed_ben", "heart"],
    ["frankBook", "seed_clara", "fire"],
  ];
  for (const [key, reader, reaction] of commentReactions) {
    const comment = await Comment.findById(comments[key]).lean();
    await new Reaction({
      userId: u(reader),
      targetType: "comment",
      targetId: comment!._id,
      authorId: comment!.authorId,
      folderId: comment!.folderId,
      storyId: comment!.storyId,
      reaction,
      createdAt: daysAgo(2),
    }).save();
    await notify(comment!.userId, {
      type: "reaction",
      actorId: u(reader),
      authorId: comment!.authorId,
      folderId: comment!.folderId,
      ...(comment!.storyId && { storyIds: [comment!.storyId] }),
    });
  }

  // --- Direct messages.
  const conversation = async (
    a: Nick,
    b: Nick,
    messages: [Nick, string, number][],
    readByAll: boolean,
  ) => {
    const last = messages[messages.length - 1];
    const doc = await new Conversation({
      participantIds: pairOf(u(a), u(b)),
      pairKey: pairKeyOf(u(a), u(b)),
      lastMessageAt: daysAgo(last[2]),
      unreadBy: readByAll ? [] : [u(last[0] === a ? b : a)],
      closedAt: null,
      createdAt: daysAgo(messages[0][2]),
    }).save({ timestamps: false });
    for (const [sender, body, days] of messages) {
      await new Message({
        conversationId: doc._id,
        senderId: u(sender),
        body,
        createdAt: daysAgo(days),
      }).save({ timestamps: false });
      const other = sender === a ? b : a;
      await notify(
        await mentionRecipients(u(sender), body, { only: [u(other)] }),
        {
          type: "mention",
          actorId: u(sender),
          conversationId: doc._id,
        },
      );
    }
  };
  await conversation(
    "seed_anna",
    "seed_ben",
    [
      [
        "seed_anna",
        "Hi Ben! Would you beta-read my next chapter? It's in Polish, but the translator does fine.",
        10,
      ],
      ["seed_ben", "Sure, send it over when it's ready.", 9.8],
      ["seed_anna", "Thanks! Draft is in the book already, hidden for now.", 3],
      [
        "seed_ben",
        "Read it. The tower stairs are a great idea, @seed_anna.",
        1,
      ],
    ],
    true,
  );
  await conversation(
    "seed_ben",
    "seed_frank",
    [
      [
        "seed_ben",
        "Hey Frank, I invited you to moderate my community. No pressure!",
        2,
      ],
      ["seed_ben", "Mostly just keeping an eye on comments.", 1.9],
    ],
    false,
  );
  await conversation(
    "seed_dawid",
    "seed_anna",
    [
      [
        "seed_dawid",
        "Ukryłem komentarz trolla i dałem mu bana na dwa tygodnie.",
        17,
      ],
      ["seed_anna", "Dzięki, Dawid!", 16.5],
    ],
    false,
  );

  // --- Forums: global threads, an announcement and an author's forum.
  const threads: Record<string, Types.ObjectId> = {};
  const posts: Record<string, Types.ObjectId> = {};
  const startThread = async (
    key: string,
    starter: Nick,
    place: { categoryId: string } | { authorId: Types.ObjectId },
    title: string,
    body: string,
    days: number,
  ) => {
    const thread = await new ForumThread({
      ...("categoryId" in place
        ? { scope: "global", categoryId: place.categoryId }
        : { scope: "author", authorId: place.authorId }),
      userId: u(starter),
      title,
      lastPostAt: daysAgo(days),
      postCount: 1,
      createdAt: daysAgo(days),
    }).save({ timestamps: false });
    threads[key] = thread._id;
    const post = await new ForumPost({
      threadId: thread._id,
      userId: u(starter),
      body,
      createdAt: daysAgo(days),
    }).save({ timestamps: false });
    posts[key] = post._id;
    await new ThreadFollow({
      userId: u(starter),
      threadId: thread._id,
      createdAt: daysAgo(days),
    }).save({ timestamps: false });
    if ("authorId" in place && place.authorId.equals(u(starter))) {
      await new Activity({
        actorId: u(starter),
        type: "forumThread",
        threadId: thread._id,
        createdAt: daysAgo(days),
      }).save({ timestamps: false });
    }
  };
  const reply = async (
    key: string,
    threadKey: string,
    writer: Nick,
    body: string,
    days: number,
    quoteKey?: string,
  ) => {
    const thread = await ForumThread.findById(threads[threadKey]).lean();
    const post = await new ForumPost({
      threadId: thread!._id,
      userId: u(writer),
      body,
      ...(quoteKey && { quotePostId: posts[quoteKey] }),
      createdAt: daysAgo(days),
    }).save({ timestamps: false });
    posts[key] = post._id;
    await ForumThread.updateOne(
      { _id: thread!._id },
      { $inc: { postCount: 1 }, $max: { lastPostAt: post.createdAt } },
    );
    const event = {
      actorId: u(writer),
      ...(thread!.authorId && { authorId: thread!.authorId }),
      threadId: thread!._id,
      postId: post._id,
    };
    const quoted: Types.ObjectId[] = [];
    if (quoteKey) {
      const quotedPost = await ForumPost.findById(posts[quoteKey]).lean();
      quoted.push(quotedPost!.userId);
      await notify(quotedPost!.userId, { ...event, type: "quote" });
    }
    const followers = await threadReplyRecipients(thread!._id, quoted);
    await notify(followers, { ...event, type: "threadReply" });
    await notify(
      await mentionRecipients(u(writer), body, {
        exclude: [...quoted, ...followers],
      }),
      { ...event, type: "mention" },
    );
  };
  const follow = async (threadKey: string, nick: Nick, days: number) => {
    await new ThreadFollow({
      userId: u(nick),
      threadId: threads[threadKey],
      createdAt: daysAgo(days),
    }).save({ timestamps: false });
  };

  if (announcements) {
    await startThread(
      "welcome",
      "seed_admin",
      { categoryId: announcements._id },
      "Welcome to the seeded forums",
      "This is a **local test** forum. Be kind, stay on topic, and report anything that breaks the rules.",
      30,
    );
  }
  await startThread(
    "pov",
    "seed_ewa",
    { categoryId: workshop._id },
    "First person or third person?",
    "Which point of view do you find easier to write in, and why?\n\nI keep switching mid-draft.",
    14,
  );
  await follow("pov", "seed_frank", 13);
  await follow("pov", "seed_anna", 13);
  await reply(
    "pov2",
    "pov",
    "seed_frank",
    "Third person limited. It gives me room to breathe without losing the character's voice.",
    13,
  );
  await reply(
    "pov3",
    "pov",
    "seed_anna",
    "Pierwsza osoba, ale tylko w krótkich formach.",
    12,
    "pov2",
  );
  await reply(
    "pov4",
    "pov",
    "seed_ben",
    "Depends on the story. For Kepler Station I needed the distance of third person. @seed_ewa what do you use for poems?",
    5,
  );
  const second =
    openCategories[openCategories.length > 2 ? 2 : openCategories.length - 1];
  await startThread(
    "recs",
    "seed_frank",
    { categoryId: second._id },
    "Recommend me something short",
    "Looking for short stories under 20 minutes of reading. Any genre.",
    6,
  );
  await reply(
    "recs2",
    "recs",
    "seed_dawid",
    "Polecam *Wiersze na deszcz* od @seed_ewa – krótkie i piękne.",
    5,
  );
  await startThread(
    "annaQa",
    "seed_anna",
    { authorId: anna },
    "Pytania o Mglistą Dolinę",
    "Tu możecie pytać o świat, postacie i plany na kolejne rozdziały.",
    10,
  );
  await follow("annaQa", "seed_dawid", 9);
  await reply(
    "annaQa2",
    "annaQa",
    "seed_dawid",
    "Czy strażnik mostu pojawi się jeszcze?",
    9,
  );
  await reply(
    "annaQa3",
    "annaQa",
    "seed_anna",
    "Tak, w rozdziale czwartym. Więcej nie zdradzę!",
    8,
    "annaQa2",
  );

  const postReactions: [string, Nick, (typeof reactionKeys)[number]][] = [
    ["pov2", "seed_ewa", "clap"],
    ["pov3", "seed_frank", "heart"],
    ["annaQa3", "seed_dawid", "laugh"],
  ];
  for (const [key, reader, reaction] of postReactions) {
    const post = await ForumPost.findById(posts[key]).lean();
    const thread = await ForumThread.findById(post!.threadId).lean();
    await new Reaction({
      userId: u(reader),
      targetType: "post",
      targetId: post!._id,
      authorId: thread!.scope === "author" ? thread!.authorId : null,
      folderId: null,
      storyId: null,
      reaction,
      createdAt: daysAgo(3),
    }).save();
    await notify(post!.userId, {
      type: "reaction",
      actorId: u(reader),
      ...(thread!.authorId && { authorId: thread!.authorId }),
      threadId: thread!._id,
      postId: post!._id,
    });
  }

  // --- The latest chapters reach the libraries and followers (task 81).
  for (const name of ["Kroniki Mglistej Doliny", "Wiersze na deszcz"]) {
    const ref = book(name);
    const latest = ref.chapters.filter((c) => c.public).at(-1)!;
    const event = {
      actorId: ref.owner,
      authorId: ref.owner,
      folderId: ref.id,
      storyIds: [latest.id],
      count: 1,
    };
    const owners = (
      await LibraryItem.distinct("userId", { folderId: ref.id })
    ).map(String);
    const followers = (
      await Follow.distinct("followerId", { followeeId: ref.owner })
    ).map(String);
    await notify(owners, { ...event, type: "libraryChapter" });
    await notify(
      followers.filter((id) => !owners.includes(id)),
      { ...event, type: "followedChapter" },
    );
  }
  // A few read already, so the list shows both states.
  await Notification.updateMany(
    {
      userId: { $in: [u("seed_dawid"), u("seed_frank")] },
      type: { $in: ["follower", "library"] },
    },
    { $set: { readAt: daysAgo(1) } },
  );

  // --- Reads over the last four weeks: readEvents and the dailyStats counted from them.
  for (const ref of books.values()) {
    for (const c of ref.chapters) {
      if (!c.public || !c.publishedAt) continue;
      const age = Math.min(
        27,
        Math.floor((now - c.publishedAt.getTime()) / DAY_MS),
      );
      for (let day = age; day >= 0; day--) {
        const date = daysAgo(day);
        const key = statsDay(date);
        const fresh = Math.max(
          1,
          Math.round((12 * (1 + age - day)) / (1 + age)),
        );
        const guests = Math.floor(random() * fresh) + (day === age ? 8 : 0);
        const readers = [
          ...Array.from(
            { length: guests },
            (_, i) =>
              `g:${createHash("sha256").update(`seed-guest-${i}-${key}`).digest("hex")}`,
          ),
          ...raters
            .filter((r) => !u(r).equals(ref.owner) && random() < 0.15)
            .map((r) => `u:${u(r).toString()}`),
        ];
        if (readers.length === 0) continue;
        await ReadEvent.insertMany(
          readers.map((reader) => ({
            storyId: c.id,
            folderId: ref.id,
            day: key,
            reader,
            expiresAt: new Date(date.getTime() + READ_EVENT_TTL_MS),
          })),
        );
        await new DailyStat({
          storyId: c.id,
          folderId: ref.id,
          authorId: ref.owner,
          day: key,
          readers: readers.length,
        }).save();
      }
    }
  }

  // --- Rankings: computed now instead of on the next home page visit.
  await Ranking.updateMany(
    { _id: { $in: ["weekly", "topRated"] } },
    { $set: { computedAt: new Date(0), computing: null } },
  );
  await recomputeRanking("weekly");
  await recomputeRanking("topRated");

  console.log(
    `Seeded ${ACCOUNTS.length} accounts. Password for all: ${PASSWORD}`,
  );
  for (const account of ACCOUNTS) {
    console.log(
      `  ${account.nickname.padEnd(12)} ${"role" in account ? account.role : "user"}`,
    );
  }
  await disconnectDB();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  const { disconnectDB } = await import("@/lib/db");
  await disconnectDB();
});
