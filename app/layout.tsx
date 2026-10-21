import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import { getUserSettings } from "@/lib/settings/queries";
import { type ThemeAttribute, themeScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Story App",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const userId = (await auth())?.user?.id;
  const theme: ThemeAttribute | undefined = userId
    ? ((await getUserSettings(userId)).theme ?? "system")
    : undefined;

  return (
    // The inline script adds the "dark" class before hydration, from data-theme,
    // the browser's saved choice or the system preference.
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
