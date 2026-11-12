import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";
import { AppSidebar, type SocialNavItem } from "./app-sidebar";

const location = vi.hoisted(() => ({ pathname: "/" }));

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
  usePathname: () => location.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/[locale]/(protected)/actions", () => ({
  saveSettings: vi.fn(),
}));
vi.mock("@/lib/theme", () => ({ applyTheme: vi.fn() }));
// The counter polls Server Actions; here it only shows the count it starts with.
vi.mock("@/components/notifications", () => ({
  useUnreadNotifications: (
    initial: number,
    _onOpen: () => void,
    messages: number,
  ) => [initial, () => {}, messages],
  NotificationsPanel: () => null,
}));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
// The dialog stays closed; its form pulls in Server Actions of its own.
vi.mock("@/components/settings-dialog", () => ({
  SettingsDialog: () => null,
  clearSettingsReopen: () => {},
  settingsReopenRequested: () => false,
}));

const ITEMS: SocialNavItem[] = [
  "feed",
  "library",
  "forums",
  "messages",
  "notifications",
  "profile",
  "moderation",
  "admin",
  "stats",
];

function render(
  locale: "en" | "pl",
  props: { hiddenItems?: SocialNavItem[]; profilePath?: string } = {},
) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : pl}
    >
      <TooltipProvider>
        <AppSidebar defaultCollapsed={false} toolsAvailable {...props} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

const labels = (html: string) =>
  [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);

describe("AppSidebar", () => {
  beforeEach(() => {
    location.pathname = "/";
  });

  it.each(ITEMS)("shows %s in English and Polish", (item) => {
    expect(labels(render("en"))).toContain(en.sidebar[item]);
    expect(labels(render("pl"))).toContain(pl.sidebar[item]);
  });

  it("orders the entries as in D80", () => {
    expect(labels(render("pl"))).toEqual([
      "Menu",
      "Główna",
      "Strona główna",
      "Feed",
      "Biblioteka",
      "Książki",
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

  it("leaves out an entry hidden for this account (moderation, task 79)", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <TooltipProvider>
          <AppSidebar
            defaultCollapsed={false}
            toolsAvailable
            hiddenItems={["moderation"]}
          />
        </TooltipProvider>
      </NextIntlClientProvider>,
    );
    expect(labels(html)).not.toContain(en.sidebar.moderation);
  });

  it("leaves out Statistics for an account without a publication (task 83)", () => {
    const html = (hiddenItems: SocialNavItem[]) =>
      renderToStaticMarkup(
        <NextIntlClientProvider locale="en" messages={en}>
          <TooltipProvider>
            <AppSidebar
              defaultCollapsed={false}
              toolsAvailable
              hiddenItems={hiddenItems}
            />
          </TooltipProvider>
        </NextIntlClientProvider>,
      );
    expect(labels(html(["stats"]))).not.toContain(en.sidebar.stats);
    expect(html([])).toContain('href="/stats"');
  });

  it("shows the unread notifications on the bell (task 81)", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="pl" messages={pl}>
        <TooltipProvider>
          <AppSidebar
            defaultCollapsed={false}
            toolsAvailable
            initialUnread={5}
          />
        </TooltipProvider>
      </NextIntlClientProvider>,
    );
    expect(labels(html)).toContain("Powiadomienia, 5 nieprzeczytanych");
    expect(html).toContain(">5</span>");
    expect(html).not.toContain('href="/notifications"');
  });

  it("shows the unread conversations by Messages (task 85)", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="pl" messages={pl}>
        <TooltipProvider>
          <AppSidebar
            defaultCollapsed={false}
            toolsAvailable
            initialUnreadMessages={3}
          />
        </TooltipProvider>
      </NextIntlClientProvider>,
    );
    expect(labels(html)).toContain("Wiadomości, 3 nieprzeczytane rozmowy");
    expect(html).toContain('href="/messages"');
    expect(html).toContain(">3</span>");
  });

  it("links each entry to its page", () => {
    expect(render("en")).toContain('href="/library"');
  });

  it("marks My profile as current on the account's own profile, in any case", () => {
    const current = (html: string) =>
      html.match(/aria-label="([^"]+)" aria-current="page"/)?.[1];
    location.pathname = "/p/alice";
    expect(current(render("en", { profilePath: "/p/Alice" }))).toBe(
      en.sidebar.profile,
    );
    location.pathname = "/p/Bob";
    expect(current(render("en", { profilePath: "/p/Alice" }))).toBeUndefined();
  });
});
