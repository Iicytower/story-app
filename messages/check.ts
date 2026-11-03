import type en from "./en.json";
import pl from "./pl.json";

// tsc fails here when pl.json lacks a key of en.json (D46).
export const plHasEveryKey: typeof en = pl;
