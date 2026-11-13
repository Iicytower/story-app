// D77. Sent with every page from the proxy, which makes a new nonce per request. realtimeUrl:
// the realtime stream's address (task 90), the only other origin a page may connect to.
export function contentSecurityPolicy(
  nonce: string,
  dev: boolean,
  realtimeUrl: string | null = null,
): string {
  return [
    "default-src 'self'",
    // strict-dynamic: scripts loaded by a script with the nonce (Next.js chunks) may run.
    // React's development build uses eval for error stacks. WebAssembly only for pdf.js in the
    // PDF import, which otherwise falls back to slower JavaScript.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    // Style attributes from the editor and Radix cannot carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    // Covers come from /covers, the crop preview from blob: and data: URLs.
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self'${realtimeUrl ? ` ${new URL(realtimeUrl).origin}` : ""}${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Static headers for every response, from next.config.ts.
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // For browsers without frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Also off Vercel, which adds its own on its domains. Browsers ignore it over plain http.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];
