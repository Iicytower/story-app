import Form from "next/form";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { connectDB } from "@/lib/db";
import {
  listPublicTags,
  type PublicSearchResult,
  searchPublishedChapters,
} from "@/lib/publish/queries";
import { MAX_QUERY_LENGTH } from "@/lib/publish/search";
import { clientIp, SEARCH_LIMIT, takeAttempt } from "@/lib/rate-limit";
import { MAX_TAGS, parseTagFilter, tagFilterHref } from "@/lib/tags/tags";
import { ChapterItem } from "./chapter-item";

export async function PublicSearch({
  q,
  tag,
  heading: Heading,
}: {
  q: string | string[] | undefined;
  tag: string | string[] | undefined;
  // h2 under the guest's hero, h1 otherwise.
  heading: "h1" | "h2";
}) {
  const query =
    typeof q === "string" ? q.trim().slice(0, MAX_QUERY_LENGTH) : "";
  const selectedTags = parseTagFilter(tag).slice(0, MAX_TAGS);
  const searching = query !== "" || selectedTags.length > 0;

  await connectDB();
  const tags = await listPublicTags();
  // An empty form is free: only an actual search reads chapter text.
  const allowed =
    !searching ||
    (await takeAttempt(SEARCH_LIMIT, clientIp(await headers()))) !== null;
  const filterTags = [...new Set([...tags, ...selectedTags])];

  const searchPath = getPathname({ href: "/", locale: await getLocale() });
  const t = await getTranslations("search");
  return (
    <section className="flex flex-col gap-6">
      <Heading className="text-2xl font-semibold">{t("title")}</Heading>
      <Form action={searchPath} role="search">
        <Input
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          maxLength={MAX_QUERY_LENGTH}
          placeholder={t("placeholder")}
          aria-label={t("label")}
        />
        {selectedTags.map((selected) => (
          <input key={selected} type="hidden" name="tag" value={selected} />
        ))}
      </Form>
      {filterTags.length > 0 && (
        <nav aria-label={t("filterByTag")} className="flex flex-wrap gap-1">
          {filterTags.map((filterTag) => {
            const active = selectedTags.includes(filterTag);
            return (
              // A prefetched search would use up the visitor's limit.
              <Link
                key={filterTag}
                prefetch={false}
                href={tagFilterHref(query, selectedTags, filterTag, "/")}
                aria-current={active ? "true" : undefined}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/70"
                }`}
              >
                {filterTag}
              </Link>
            );
          })}
        </nav>
      )}
      {!allowed ? (
        <p role="alert" className="text-destructive">
          {t("tooMany")}
        </p>
      ) : (
        searching && (
          <Results
            results={await searchPublishedChapters(query, selectedTags)}
          />
        )
      )}
    </section>
  );
}

async function Results({ results }: { results: PublicSearchResult[] }) {
  const t = await getTranslations("search");
  if (results.length === 0) {
    return <p className="text-muted-foreground">{t("none")}</p>;
  }
  return (
    <ul
      aria-label={t("results")}
      className="flex flex-col divide-y rounded-lg border"
    >
      {results.map(({ folderName, nickname, ...result }) => (
        <ChapterItem
          key={result.path}
          {...result}
          byline={t("inFolderBy", { folder: folderName, nickname })}
        />
      ))}
    </ul>
  );
}
