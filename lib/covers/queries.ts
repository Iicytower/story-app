import type { Types } from "mongoose";
import { Avatar } from "@/lib/models/avatar";
import { Cover } from "@/lib/models/cover";

export interface CoverView {
  path: string;
  // Rated 18+ by the filter or marked by the owner: public lists show a badge instead (D69).
  adult: boolean;
}

// The same order as isAdult (D67): the admin's mark decides over the filter's and the owner's.
export function isAdultCover(cover: {
  autoAdult?: boolean;
  manualAdult?: boolean;
  adminAdult?: boolean;
}): boolean {
  return cover.adminAdult ?? Boolean(cover.autoAdult || cover.manualAdult);
}

export const coverPath = (id: string | Types.ObjectId) => `/covers/${id}`;

// Covers of the given folders by folder id; folders without a rated cover are left out.
export async function coversOf(
  folders: { _id: Types.ObjectId; coverId?: Types.ObjectId }[],
): Promise<Map<string, CoverView>> {
  const ids = folders.flatMap(({ coverId }) => (coverId ? [coverId] : []));
  if (ids.length === 0) return new Map();
  const covers = await Cover.find({ _id: { $in: ids }, state: "rated" })
    .select({ folderId: 1, autoAdult: 1, manualAdult: 1, adminAdult: 1 })
    .lean();
  return new Map(
    covers.map((cover) => [
      cover.folderId.toString(),
      {
        path: coverPath(cover._id),
        adult: isAdultCover(cover),
      },
    ]),
  );
}

// Bytes of all stored images, the room COVERS_MAX_TOTAL_MB limits: covers and avatars (task 70).
export async function storedImageBytes(): Promise<number> {
  const sum = [{ $group: { _id: null, bytes: { $sum: "$size" } } }];
  const [[covers], [avatars]] = await Promise.all([
    Cover.aggregate<{ bytes: number }>(sum),
    Avatar.aggregate<{ bytes: number }>(sum),
  ]);
  return (covers?.bytes ?? 0) + (avatars?.bytes ?? 0);
}
