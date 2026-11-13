import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { after, connection } from "next/server";
import { AdultBadge } from "@/components/adult";
import { AppShell } from "@/components/app-shell";
import { PublicCover } from "@/components/cover";
import { SocialMarkdown } from "@/components/social-markdown";
import { UserAvatar } from "@/components/user-avatar";
import { profilePath } from "@/components/user-link";
import { Link, redirect } from "@/i18n/navigation";
import { requestOrigin } from "@/i18n/request-origin";
import { languageAlternates } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { retryDueCovers } from "@/lib/covers/mutations";
import { getPublicLibrary, getPublicProfile } from "@/lib/profiles/queries";
import type { LibraryBook } from "@/lib/library/queries";
import { BlockButton } from "./block-button";
import { EditProfileButton } from "./edit-profile-button";
import { FollowButton } from "./follow-button";
import { MessageButton } from "./message-button";
import { ReportButton } from "@/components/report-dialog";
import { activeCommunityBan } from "@/lib/social/moderation";
import { CommunityBanNotice } from "./[folder]/community-ban-notice";
import { PageContainer } from "@/components/page-container";

async function viewerId(): Promise<string | null> {
  const user = await requireUser();
  return user.ok ? user.userId : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]">): Promise<Metadata> {
  const { nickname } = await params;
  const profile = await getPublicProfile(nickname, await viewerId());
  const t = await getTranslations();
  if (!profile) return { title: t("common.appName") };
  return {
    title: t("profile.title", { nickname: profile.nickname }),
    alternates: languageAlternates(
      await requestOrigin(),
      profilePath(profile.nickname),
    ),
  };
}

export default async function ProfilePage({
  params,
}: PageProps<"/[locale]/p/[nickname]">) {
  // Without a request-time API the page could be cached and outlive a change of the profile.
  await connection();
  after(() => retryDueCovers());
  const { nickname } = await params;
  const viewer = await viewerId();
  const profile = await getPublicProfile(nickname, viewer);
  if (!profile) notFound();
  if (profile.nickname !== nickname)
    redirect({
      href: profilePath(profile.nickname),
      locale: await getLocale(),
    });
  const library = profile.libraryPublic
    ? await getPublicLibrary(profile.userId, viewer)
    : null;
  const t = await getTranslations("profile");
  const tReports = await getTranslations("reports");

  const content = (
    <PageContainer width="narrow" className="gap-8">
      <header className="flex flex-wrap items-center gap-4">
        <UserAvatar
          nickname={profile.nickname}
          src={profile.avatar}
          alt={t("avatarAlt", { nickname: profile.nickname })}
          size={96}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-bold break-all">{profile.nickname}</h1>
          <p className="text-muted-foreground flex gap-4 text-sm">
            <Link
              href={`${profilePath(profile.nickname)}/followers`}
              className="hover:underline"
            >
              {t("followersCount", { count: profile.followers })}
            </Link>
            <Link
              href={`${profilePath(profile.nickname)}/following`}
              className="hover:underline"
            >
              {t("followingCount", { count: profile.following })}
            </Link>
          </p>
          {profile.owner && <EditProfileButton />}
          {!profile.owner && !profile.blockedEitherWay && (
            <FollowButton
              nickname={profile.nickname}
              followed={profile.followed}
            />
          )}
          {!profile.owner && (
            <MessageButton
              nickname={profile.nickname}
              signedIn={viewer !== null}
            />
          )}
          {!profile.owner && (
            <ReportButton
              target={viewer ? { type: "profile", id: profile.nickname } : null}
              label={tReports("reportProfile", { nickname: profile.nickname })}
              className="h-auto max-w-full [overflow-wrap:anywhere] whitespace-normal"
              callbackUrl={`/${await getLocale()}${profilePath(profile.nickname)}`}
            />
          )}
          {profile.blocking !== null && (
            <BlockButton
              nickname={profile.nickname}
              blocking={profile.blocking}
            />
          )}
        </div>
      </header>
      {profile.bio && (
        <section aria-label={t("bio")}>
          <SocialMarkdown content={profile.bio} />
        </section>
      )}
      <CommunityBanNotice
        ban={await activeCommunityBan(viewer, profile.userId.toString())}
      />
      <section aria-labelledby="profile-books" className="flex flex-col gap-3">
        <h2 id="profile-books" className="text-xl font-semibold">
          {t("books")}
        </h2>
        {profile.books.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noBooks")}</p>
        ) : (
          <ul aria-labelledby="profile-books" className="flex flex-col gap-3">
            {profile.books.map((book) => (
              <li key={book.path} className="flex min-w-0 items-center gap-3">
                {book.cover && (
                  <PublicCover
                    cover={book.cover}
                    alt={t("coverAlt", { name: book.name })}
                    size="sm"
                    reveal={profile.owner}
                  />
                )}
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={book.path}
                    className="min-w-0 break-words hover:underline"
                  >
                    {book.name}
                  </Link>
                  {book.adult && <AdultBadge />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {profile.owner && !profile.libraryPublic && (
        <p className="text-muted-foreground text-sm">
          {t("libraryPrivate")}{" "}
          <Link href="/library" className="text-foreground underline">
            {t("libraryPrivateLink")}
          </Link>
        </p>
      )}
      {library && (
        <section
          aria-labelledby="profile-library"
          className="flex flex-col gap-4"
        >
          <h2 id="profile-library" className="text-xl font-semibold">
            {t("library")}
          </h2>
          {library.shelves.length === 0 && library.other.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("noLibraryBooks")}
            </p>
          ) : (
            <>
              {library.shelves.map((shelf, i) => (
                <LibraryShelf
                  key={shelf.id}
                  id={`shelf-${i}`}
                  name={shelf.name}
                  books={shelf.books}
                />
              ))}
              {library.other.length > 0 && (
                <LibraryShelf
                  id="shelf-other"
                  name={t("notOnShelf")}
                  books={library.other}
                />
              )}
            </>
          )}
        </section>
      )}
    </PageContainer>
  );

  return viewer ? (
    <AppShell userId={viewer}>{content}</AppShell>
  ) : (
    <main className="flex flex-1 flex-col">{content}</main>
  );
}

async function LibraryShelf({
  id,
  name,
  books,
}: {
  id: string;
  name: string;
  books: LibraryBook[];
}) {
  const t = await getTranslations("profile");
  const tPublic = await getTranslations("public");
  return (
    <div className="flex flex-col gap-2">
      <h3 id={id} className="font-medium break-words">
        {name}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col gap-3">
        {books.map((book) => (
          <li key={book.folderId} className="flex min-w-0 items-center gap-3">
            {book.cover && (
              <PublicCover
                cover={book.cover}
                alt={t("coverAlt", { name: book.name })}
                size="sm"
              />
            )}
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link
                  href={book.path}
                  className="min-w-0 break-words hover:underline"
                >
                  {book.name}
                </Link>
                {book.adult && <AdultBadge />}
              </div>
              <span className="text-muted-foreground text-sm">
                {tPublic("by", { nickname: book.nickname })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
