import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  return {
    locale: hasLocale(routing.locales, requested)
      ? requested
      : routing.defaultLocale,
    // The dictionaries arrive in task 44; the provider refuses to render without messages.
    messages: {},
  };
});
