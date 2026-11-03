import type en from "@/messages/en.json";

// lib/ validation names the message; the caller translates it in the request's language.
export type ErrorKey = keyof (typeof en)["errors"];
export type ErrorValues = Record<string, string | number>;
export type ErrorMessage = { key: ErrorKey; values?: ErrorValues };
