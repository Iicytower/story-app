import "./globals.css";

// Paths outside a known locale never reach app/[locale]/layout.tsx, so this page brings its own <html>.
export default function NotFound() {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center">
        <p>404 | This page could not be found.</p>
      </body>
    </html>
  );
}
