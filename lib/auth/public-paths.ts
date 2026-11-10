import { routing } from "@/i18n/routing";

const LOCALE = `(?:${routing.locales.join("|")})`;

const PUBLIC_PATHS = [
  new RegExp(`^/${LOCALE}/?$`),
  // Removed pages: a plain 404 instead of the sign-in dialog, which would return here afterwards.
  new RegExp(`^/${LOCALE}/(login|register)$`),
  /^\/api\/auth(\/|$)/,
  // The handler itself decides: the owner's or a published folder's cover (task 26).
  /^\/covers\/[^/]+$/,
  // Only a profile's current avatar (task 70).
  /^\/avatars\/[^/]+$/,
  // Profile, contents and chapter pages.
  new RegExp(`^/${LOCALE}/p/[^/]+(/[^/]+){0,2}$`),
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}
