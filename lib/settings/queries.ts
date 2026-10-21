import { cache } from "react";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";
import { normalizeSettings, type UserSettings } from "./settings";

// Cached per request: the root layout (theme) and the editor page (layout) both read it.
export const getUserSettings = cache(
  async (userId: string): Promise<UserSettings> => {
    await connectDB();
    const user = await User.findById(userId).select({ settings: 1 }).lean();
    return normalizeSettings(user?.settings);
  },
);
