import { Schema } from "mongoose";
import type { AdultMark } from "@/lib/adult/adult";

export type { AdultMark };

export const adultMarkSchema = new Schema<AdultMark>(
  { manual: { type: Boolean }, auto: { type: Boolean } },
  { _id: false },
);
