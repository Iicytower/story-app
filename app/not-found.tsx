import { SystemTheme } from "@/components/system-theme";
import "./globals.css";

// Paths outside a known locale never reach app/[locale]/layout.tsx, so this page brings its own
// <html>; the theme comes from the browser's copy or the system, as on pages without a session.
export default function NotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen items-center justify-center">
        <SystemTheme />
        <p>404 | This page could not be found.</p>
      </body>
    </html>
  );
}
