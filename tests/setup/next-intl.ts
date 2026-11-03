import { createTranslator } from "next-intl";
import { vi } from "vitest";
import en from "@/messages/en.json";

// Server Actions run without a request in tests: they get English, as on /en.
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async (namespace?: string) =>
    createTranslator({ locale: "en", messages: en, namespace } as never),
}));
