import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { after, connection } from "next/server";
import { AdultBadge } from "@/components/adult";
import { PublicCover } from "@/components/cover";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { retryDueCovers } from "@/lib/covers/mutations";
import {
  isLibraryPublic,
  listLibraryBooks,
  listShelves,
} from "@/lib/library/queries";
import { libraryReading, type BookReading } from "@/lib/reading/queries";
import { cn } from "@/lib/utils";
import { LibraryPicker } from "./library-picker";
import { LibraryPublic } from "./library-public";
import { ManageShelves } from "./manage-shelves";
import { seedShelves } from "./starter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("library") };
}

function BookProgress({
  reading,
  newLabel,
  continueLabel,
}: {
  reading: BookReading | undefined;
  newLabel: (count: number) => string;
  continueLabel: (title: string) => string;
}) {
  const count = reading?.newChapterIds.length ?? 0;
  if (!reading?.continueAt && count === 0) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      {count > 0 && (
        <span className="bg-primary text-primary-foreground shrink-0 rounded-sm px-1.5 text-xs leading-5 font-medium">
          {newLabel(count)}
        </span>
      )}
      {reading?.continueAt && (
        <Link
          href={reading.continueAt.path}
          className="min-w-0 [overflow-wrap:anywhere] underline underline-offset-4"
        >
          {continueLabel(reading.continueAt.title)}
        </Link>
      )}
    </div>
  );
}

export default async function LibraryPage({
  searchParams,
}: PageProps<"/[locale]/library">) {
  await connection();
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });
  after(() => retryDueCovers());
  await seedShelves(user.userId);
  const [shelves, books, libraryPublic] = await Promise.all([
    listShelves(user.userId),
    listLibraryBooks(user.userId, user.userId),
    isLibraryPublic(user.userId),
  ]);
  const reading = await libraryReading(user.userId, books);
  const { shelf: shelfParam } = await searchParams;
  const shelf = shelves.find(({ id }) => id === shelfParam) ?? null;
  const shown = shelf
    ? books.filter(({ shelfIds }) => shelfIds.includes(shelf.id))
    : books;
  const t = await getTranslations("library");
  const tPublic = await getTranslations("public");
  const tCovers = await getTranslations("covers");

  const tabs = [
    { id: null, name: t("all"), count: books.length },
    ...shelves.map(({ id, name }) => ({
      id,
      name,
      count: books.filter(({ shelfIds }) => shelfIds.includes(id)).length,
    })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-start gap-4">
        <h1 className="mr-auto text-2xl font-semibold">{t("title")}</h1>
        <ManageShelves shelves={shelves} />
      </div>
      <LibraryPublic value={libraryPublic} />
      <nav aria-label={t("shelves")}>
        <ul className="flex flex-wrap gap-1 border-b pb-2">
          {tabs.map((tab) => {
            const current = tab.id === (shelf?.id ?? null);
            return (
              <li key={tab.id ?? "all"} className="min-w-0">
                <Link
                  href={
                    tab.id
                      ? { pathname: "/library", query: { shelf: tab.id } }
                      : "/library"
                  }
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "hover:bg-accent block rounded-md px-3 py-1.5 text-sm break-words",
                    current && "bg-accent font-medium",
                  )}
                >
                  {t("tab", { name: tab.name, count: tab.count })}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {shelf ? t("emptyShelf") : t("empty")}
        </p>
      ) : (
        <ul
          aria-label={shelf?.name ?? t("all")}
          className="flex flex-col gap-4"
        >
          {shown.map((book) => (
            <li key={book.folderId} className="flex min-w-0 items-start gap-3">
              {book.cover && (
                <PublicCover
                  cover={book.cover}
                  alt={tCovers("alt", { name: book.name })}
                  size="sm"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={book.path}
                    className="min-w-0 font-medium break-words hover:underline"
                  >
                    {book.name}
                  </Link>
                  {book.adult && <AdultBadge />}
                </div>
                <p className="text-muted-foreground text-sm">
                  {tPublic("by", { nickname: book.nickname })}
                </p>
                <BookProgress
                  reading={reading.get(book.folderId)}
                  newLabel={(count) => t("newChapters", { count })}
                  continueLabel={(title) => tPublic("continue", { title })}
                />
              </div>
              <LibraryPicker
                folderId={book.folderId}
                shelves={shelves}
                shelfIds={book.shelfIds}
                bookName={book.name}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
