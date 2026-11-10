import { NextRequest, NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { isPublicPath } from "@/lib/auth/public-paths";
import { contentSecurityPolicy } from "@/lib/security-headers";

const intl = createMiddleware(routing);

// Route Handlers stay outside the locale prefix (D46).
const UNPREFIXED =
  /^\/(api\/|(stories|folders)\/[^/]+\/export(\/|$)|(covers|avatars)\/[^/]+$)/;
// No page has a two-letter first segment, so this is a locale outside the list.
const LOCALE_LIKE = /^\/[a-z]{2}(-[A-Za-z]{2})?(\/|$)/;

export const proxy = auth((request) => {
  // Next.js reads the nonce from the request's CSP header and puts it on its own scripts (D77).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const withCsp = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const { pathname, search } = request.nextUrl;
  // Relative, so Auth.js accepts it whatever host name the request came in on.
  const callbackUrl = pathname + search;
  const signedIn = Boolean(request.auth?.user?.id);
  if (UNPREFIXED.test(pathname)) {
    if (signedIn || isPublicPath(pathname)) {
      return withCsp(NextResponse.next({ request: { headers } }));
    }
    // The next request picks the language from "/".
    return signInRedirect(request.nextUrl, "/", callbackUrl);
  }

  const first = pathname.split("/")[1];
  if (LOCALE_LIKE.test(pathname) && !hasLocale(routing.locales, first)) {
    // The catch-all page under the default locale renders the 404, signed in or not.
    return withCsp(
      NextResponse.rewrite(
        new URL(`/${routing.defaultLocale}${pathname}`, request.nextUrl),
        { request: { headers } },
      ),
    );
  }

  // next-intl passes on the headers of the request it gets.
  const response = withCsp(intl(new NextRequest(request, { headers })));
  if (response.headers.has("location") || signedIn || isPublicPath(pathname)) {
    return response;
  }
  return signInRedirect(request.nextUrl, `/${first}`, callbackUrl);
});

function signInRedirect(url: URL, signInPath: string, callbackUrl: string) {
  const target = new URL(signInPath, url);
  target.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(target);
}

export const config = {
  // Paths with a dot are files (favicon, public/fonts); slugs and nicknames never contain one.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
