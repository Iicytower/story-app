import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { ArrowLeftIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { profilePath, UserLink } from "@/components/user-link";
import { Link, redirect } from "@/i18n/navigation";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import {
  type FollowSide,
  getPublicProfile,
  listFollows,
} from "@/lib/profiles/queries";

async function viewerId(): Promise<string | null> {
  const user = await requireUser();
  return user.ok ? user.userId : null;
}

function pageNumber(value: string | string[] | undefined): number {
  const page = Math.floor(Number(value));
  return Number.isSafeInteger(page) && page > 1 ? page : 1;
}

const listPath = (nickname: string, side: FollowSide, page = 1) =>
  `${profilePath(nickname)}/${side}${page > 1 ? `?page=${page}` : ""}`;

export async function followListMetadata(
  nickname: string,
  side: FollowSide,
): Promise<Metadata> {
  const profile = await getPublicProfile(nickname, await viewerId());
  const t = await getTranslations();
  if (!profile) return { title: t("common.appName") };
  return {
    title: t(
      side === "followers"
        ? "profile.followersTitle"
        : "profile.followingTitle",
      { nickname: profile.nickname },
    ),
    alternates: languageAlternates(
      await requestOrigin(),
      listPath(profile.nickname, side),
    ),
  };
}

export async function FollowList({
  nickname,
  side,
  page: pageParam,
}: {
  nickname: string;
  side: FollowSide;
  page: string | string[] | undefined;
}) {
  // Without a request-time API the page could be cached and outlive a new follow.
  await connection();
  const viewer = await viewerId();
  const profile = await getPublicProfile(nickname, viewer);
  if (!profile) notFound();
  const page = pageNumber(pageParam);
  if (profile.nickname !== nickname)
    redirect({
      href: listPath(profile.nickname, side, page),
      locale: await getLocale(),
    });
  const { accounts, hasMore } = await listFollows(
    profile.userId,
    side,
    viewer,
    page,
  );
  const t = await getTranslations("profile");
  const heading = side === "followers" ? t("followers") : t("followedAccounts");

  const content = (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Button variant="link" asChild className="self-start px-0">
          <Link href={profilePath(profile.nickname)}>
            <ArrowLeftIcon aria-hidden />
            <span className="break-all whitespace-normal">
              {profile.nickname}
            </span>
          </Link>
        </Button>
        <h1 id="follow-list" className="text-3xl font-bold">
          {heading}
        </h1>
      </header>
      {accounts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {side === "followers" ? t("noFollowers") : t("noFollowing")}
        </p>
      ) : (
        <ul aria-labelledby="follow-list" className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li
              key={account.nickname}
              className="flex min-w-0 items-center gap-3"
            >
              <UserAvatar
                nickname={account.nickname}
                src={account.avatar}
                alt=""
              />
              <UserLink nickname={account.nickname} className="break-all" />
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || hasMore) && (
        <nav
          aria-label={t("pages")}
          className="flex items-center gap-3 text-sm"
        >
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={listPath(profile.nickname, side, page - 1)}>
                {t("previousPage")}
              </Link>
            </Button>
          )}
          <span className="text-muted-foreground">
            {t("pageNumber", { page })}
          </span>
          {hasMore && (
            <Button variant="outline" size="sm" asChild>
              <Link href={listPath(profile.nickname, side, page + 1)}>
                {t("nextPage")}
              </Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );

  return viewer ? (
    <AppShell userId={viewer}>{content}</AppShell>
  ) : (
    <main className="flex flex-1 flex-col">{content}</main>
  );
}
