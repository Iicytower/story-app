const PUBLIC_PATHS = [/^\/login$/, /^\/api\/auth(\/|$)/, /^\/s\/[^/]+$/];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}
