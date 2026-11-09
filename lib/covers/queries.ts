import type { Types } from "mongoose";
import { Cover } from "@/lib/models/cover";

export interface CoverView {
  path: string;
  // Rated 18+ by the filter or marked by the owner: public lists show a badge instead (D69).
  adult: boolean;
}

export const coverPath = (id: string | Types.ObjectId) => `/covers/${id}`;

// Covers of the given folders by folder id; folders without a rated cover are left out.
export async function coversOf(
  folders: { _id: Types.ObjectId; coverId?: Types.ObjectId }[],
): Promise<Map<string, CoverView>> {
  const ids = folders.flatMap(({ coverId }) => (coverId ? [coverId] : []));
  if (ids.length === 0) return new Map();
  const covers = await Cover.find({ _id: { $in: ids }, state: "rated" })
    .select({ folderId: 1, autoAdult: 1, manualAdult: 1 })
    .lean();
  return new Map(
    covers.map((cover) => [
      cover.folderId.toString(),
      {
        path: coverPath(cover._id),
        adult: Boolean(cover.autoAdult || cover.manualAdult),
      },
    ]),
  );
}
