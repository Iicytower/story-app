import type { routing } from "@/i18n/routing";
import type messages from "@/messages/en.json";

// Keys come from en.json, so a key missing from another language fails tsc.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
