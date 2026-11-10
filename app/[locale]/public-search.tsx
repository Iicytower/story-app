import Form from "next/form";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { TagFilter } from "@/components/tag-filter";
import { Input } from "@/components/ui/input";
import { connectDB } from "@/lib/db";
import {
  listPublicTags,
  type PublicSearchResult,
  searchPublishedChapters,
} from "@/lib/publish/queries";
import { MAX_QUERY_LENGTH } from "@/lib/publish/search";
import { SEARCH_LIMIT, takeIpAttempt } from "@/lib/rate-limit";
import { MAX_TAGS, parseTagFilter } from "@/lib/tags/tags";
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
    !searching || (await takeIpAttempt(SEARCH_LIMIT, await headers())) !== null;

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
      {/* A prefetched search would use up the visitor's limit. */}
      <TagFilter
        tags={tags}
        selected={selectedTags}
        query={query}
        path="/"
        label={t("filterByTag")}
        prefetch={false}
      />
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
  const tCovers = await getTranslations("covers");
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
          coverAlt={tCovers("alt", { name: folderName })}
        />
      ))}
    </ul>
  );
}
