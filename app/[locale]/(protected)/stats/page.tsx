import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { cn } from "cn";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getAuthorStats,
  hasPublication,
  parseStatsRange,
  STATS_RANGES,
  type StatsRow,
} from "@/lib/social/author-stats";
import { ratingAverage } from "@/lib/social/ratings";
import { StatsChart } from "./stats-chart";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("stats") };
}

const CELL = "px-3 py-2 text-right tabular-nums";

export default async function StatsPage({
  searchParams,
}: PageProps<"/[locale]/stats">) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale });
  if (!(await hasPublication(user.userId))) notFound();
  const range = parseStatsRange((await searchParams).range);
  const stats = await getAuthorStats(user.userId, range, locale);
  const t = await getTranslations("stats");
  const dayLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const average = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const total = stats.days.reduce((sum, { readers }) => sum + readers, 0);

  const cells = (row: StatsRow) => {
    const mean = ratingAverage({
      count: row.ratingCount,
      sum: row.ratingSum,
      mine: null,
    });
    return (
      <>
        <td className={CELL}>{row.readers}</td>
        <td className={CELL}>{row.reactions}</td>
        <td className={CELL}>{mean === null ? "–" : average.format(mean)}</td>
        <td className={CELL}>{row.ratingCount}</td>
        <td className={CELL}>{row.comments}</td>
      </>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="mr-auto text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("followers", { count: stats.followers })}
        </p>
      </div>
      <nav aria-label={t("range")}>
        <ul className="flex flex-wrap gap-1 border-b pb-2">
          {STATS_RANGES.map((days) => {
            const current = days === range;
            return (
              <li key={days}>
                <Link
                  href={{ pathname: "/stats", query: { range: days } }}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "hover:bg-accent block rounded-md px-3 py-1.5 text-sm",
                    current && "bg-accent font-medium",
                  )}
                >
                  {t("days", { count: days })}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <section
        aria-labelledby="stats-chart-title"
        className="flex flex-col gap-2"
      >
        <h2 id="stats-chart-title" className="text-lg font-medium">
          {t("chartTitle")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("chartTotal", { count: total })}
        </p>
        <StatsChart
          label={t("chartLabel", { count: total, days: range })}
          days={stats.days.map(({ day, readers }) => ({
            label: dayLabel.format(new Date(`${day}T00:00:00Z`)),
            readers,
          }))}
        />
      </section>
      <section
        aria-labelledby="stats-table-title"
        className="flex min-w-0 flex-col gap-2"
      >
        <h2 id="stats-table-title" className="text-lg font-medium">
          {t("tableTitle")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("tableNote")}</p>
        {/* A wide table scrolls in its own box, not the page (375 px); "relative" keeps the
            sr-only cells inside it. */}
        <div className="relative overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("text")}
                </th>
                <th scope="col" className={cn(CELL, "font-medium")}>
                  {t("readers")}
                </th>
                <th scope="col" className={cn(CELL, "font-medium")}>
                  {t("reactions")}
                </th>
                <th scope="col" className={cn(CELL, "font-medium")}>
                  {t("averageRating")}
                </th>
                <th scope="col" className={cn(CELL, "font-medium")}>
                  {t("ratings")}
                </th>
                <th scope="col" className={cn(CELL, "font-medium")}>
                  {t("comments")}
                </th>
                <th scope="col" className={cn(CELL, "font-medium")}>
                  {t("library")}
                </th>
              </tr>
            </thead>
            {stats.books.map((book) => (
              <tbody key={book.id} className="border-t">
                <tr className="bg-muted/20 font-medium">
                  <th
                    scope="row"
                    className="max-w-72 px-3 py-2 text-left [overflow-wrap:anywhere]"
                  >
                    {book.title}
                  </th>
                  {cells(book)}
                  <td className={CELL}>{book.library}</td>
                </tr>
                {book.chapters.map((chapter) => (
                  <tr key={chapter.id} className="border-t">
                    <th
                      scope="row"
                      className="max-w-72 py-2 pr-3 pl-7 text-left font-normal [overflow-wrap:anywhere]"
                    >
                      {chapter.title}
                    </th>
                    {cells(chapter)}
                    <td className={CELL}>
                      <span aria-hidden>–</span>
                      <span className="sr-only">{t("notApplicable")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}
