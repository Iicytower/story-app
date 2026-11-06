"use client";

// A script rendered on the client (e.g. the root layout after a language switch) never
// runs and React warns about it, so the client renders it as inert text (Next.js guide
// "Preventing flash before hydration").
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
