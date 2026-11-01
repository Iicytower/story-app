const PUBLIC_PATHS = [
  /^\/$/,
  // Removed pages: a plain 404 instead of the sign-in dialog, which would return here afterwards.
  /^\/login$/,
  /^\/register$/,
  /^\/api\/auth(\/|$)/,
  /^\/p\/[^/]+\/[^/]+(\/[^/]+)?$/,
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}
