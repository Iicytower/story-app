"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";

// For a page outside the locale layout, which Next.js may render on the client, where the
// inline theme script never runs (app/not-found.tsx).
export function SystemTheme() {
  useEffect(applyTheme, []);
  return null;
}
