import type { mongo } from "mongoose";

export const id = "008-forum-categories";
// A new collection: there is nothing to back up.
export const collections: string[] = [];

// The starting categories (D80); later changes come from the admin panel (task 88).
const CATEGORIES: {
  key: string;
  en: string;
  pl: string;
  adminOnly?: boolean;
}[] = [
  {
    key: "announcements",
    en: "Announcements",
    pl: "Ogłoszenia",
    adminOnly: true,
  },
  { key: "workshop", en: "Writing workshop", pl: "Warsztat pisarski" },
  {
    key: "feedback",
    en: "Ideas and feedback for the app",
    pl: "Pomysły i feedback do aplikacji",
  },
  {
    key: "recommendations",
    en: "Reading recommendations",
    pl: "Polecenia lektur",
  },
  { key: "hyde-park", en: "Hyde Park", pl: "Hyde Park" },
];

// Keeps categories already there, so changes made by the admin survive a rerun.
export async function up(db: mongo.Db): Promise<void> {
  await db.collection<{ _id: string }>("forumCategories").bulkWrite(
    CATEGORIES.map(({ key, en, pl, adminOnly }, order) => ({
      updateOne: {
        filter: { _id: key },
        update: {
          $setOnInsert: {
            labels: { en, pl },
            scope: "global",
            ...(adminOnly && { adminOnly }),
            order,
            moderatorIds: [],
          },
        },
        upsert: true,
      },
    })),
  );
}
