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
import { getPublicProfile } from "@/lib/profiles/queries";

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
  const t = await getTranslations("profile");

  const content = (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center gap-4">
        <UserAvatar
          nickname={profile.nickname}
          src={profile.avatar}
          alt={t("avatarAlt", { nickname: profile.nickname })}
          size={96}
        />
        <h1 className="text-3xl font-bold break-all">{profile.nickname}</h1>
        {/* Follow (71), Message (83), Block (84) and Report (80) go here. */}
      </header>
      {profile.bio && (
        <section aria-label={t("bio")}>
          <SocialMarkdown content={profile.bio} />
        </section>
      )}
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
                <Link
                  href={book.path}
                  className="min-w-0 break-words hover:underline"
                >
                  {book.name}
                </Link>
                {book.adult && <AdultBadge />}
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Followers and following (71), then the public library (72). */}
    </div>
  );

  return viewer ? (
    <AppShell userId={viewer}>{content}</AppShell>
  ) : (
    <main className="flex flex-1 flex-col">{content}</main>
  );
}
