import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";
import { AppSidebar } from "./app-sidebar";

const nav = vi.hoisted(() => ({
  feed: false,
  library: false,
  forums: false,
  messages: false,
  notifications: false,
  profile: false,
  moderation: false,
  admin: false,
  stats: false,
}));

vi.mock("@/lib/social/nav", () => ({ SOCIAL_NAV: nav }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/[locale]/(protected)/actions", () => ({
  saveSettings: vi.fn(),
}));
vi.mock("@/lib/theme", () => ({ applyTheme: vi.fn() }));
// The dialog stays closed; its form pulls in Server Actions of its own.
vi.mock("@/components/settings-dialog", () => ({
  SettingsDialog: () => null,
  clearSettingsReopen: () => {},
  settingsReopenRequested: () => false,
}));

const ITEMS = Object.keys(nav) as (keyof typeof nav)[];

function render(locale: "en" | "pl") {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : pl}
    >
      <TooltipProvider>
        <AppSidebar defaultCollapsed={false} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

const labels = (html: string) =>
  [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);

describe("AppSidebar", () => {
  beforeEach(() => {
    for (const item of ITEMS) nav[item] = false;
  });

  it("shows no social entries while their flags are off", () => {
    expect(labels(render("en"))).toEqual([
      "Menu",
      "Main",
      "Home",
      "Folders",
      "Settings",
      "Collapse sidebar",
    ]);
  });

  it.each(ITEMS)(
    "shows %s once its flag is on, in English and Polish",
    (item) => {
      nav[item] = true;
      const enLabels = labels(render("en"));
      const plLabels = labels(render("pl"));
      expect(enLabels).toContain(en.sidebar[item]);
      expect(plLabels).toContain(pl.sidebar[item]);
      expect(enLabels).toHaveLength(7);
    },
  );

  it("orders the entries as in D80", () => {
    for (const item of ITEMS) nav[item] = true;
    expect(labels(render("pl"))).toEqual([
      "Menu",
      "Główna",
      "Strona główna",
      "Feed",
      "Biblioteka",
      "Foldery",
      "Fora",
      "Wiadomości",
      "Powiadomienia",
      "Mój profil",
      "Moderacja",
      "Admin",
      "Statystyki",
      "Ustawienia",
      "Zwiń pasek boczny",
    ]);
  });

  it("links each entry to its page", () => {
    nav.library = true;
    expect(render("en")).toContain('href="/library"');
  });
});
