import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getLastEditedChapter } from "@/lib/stories/queries";
import { NewBookButton } from "./(protected)/books/new-book-button";
import { AuthDialog } from "./auth/auth-dialog";
import { PublicSearch } from "./public-search";
import { Rankings } from "./rankings";
import { RecentlyPublished } from "./recently-published";

export async function generateMetadata(): Promise<Metadata> {
  const [t, tHome] = await Promise.all([
    getTranslations("metadata"),
    getTranslations("home"),
  ]);
  return { title: t("home"), description: tHome("heroDescription") };
}

// D83: the way back to writing; the user id comes from the session.
async function WritingShortcut({ userId }: { userId: string }) {
  const [chapter, t] = await Promise.all([
    getLastEditedChapter(userId),
    getTranslations("home"),
  ]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {chapter && (
        <>
          <p className="min-w-0 flex-1 basis-48 text-sm [overflow-wrap:anywhere]">
            {t.rich("lastEdited", {
              chapter: chapter.title,
              book: chapter.bookName,
              strong: (text) => <strong className="font-medium">{text}</strong>,
            })}
          </p>
          <Button asChild>
            <Link href={`/chapters/${chapter.id}`}>
              {t("continue")}
              <ArrowRightIcon />
            </Link>
          </Button>
        </>
      )}
      <NewBookButton variant={chapter ? "outline" : "default"} />
    </div>
  );
}

export default async function HomePage({
  params,
  searchParams,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  const { q, tag, auth: authParam, callbackUrl } = await searchParams;
  const userId = (await auth())?.user?.id;
  if (userId) {
    return (
      <AppShell userId={userId}>
        <PageContainer width="narrow" className="gap-10">
          <WritingShortcut userId={userId} />
          <PublicSearch q={q} tag={tag} heading="h1" />
          <RecentlyPublished />
          <Rankings viewerId={userId} />
        </PageContainer>
      </AppShell>
    );
  }

  const [t, tCommon] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
  ]);
  const afterLogin =
    typeof callbackUrl === "string" ? callbackUrl : `/${locale}`;
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center justify-between p-2">
        <Link href="/" className="px-2 font-semibold">
          {tCommon("appName")}
        </Link>
        <AuthDialog
          defaultOpen={authParam === "login" || callbackUrl !== undefined}
          callbackUrl={afterLogin}
        />
      </div>
      <PageContainer width="narrow" className="gap-10">
        <section className="flex flex-col gap-4 pt-4 sm:pt-8">
          <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
            {t("heroTitle")}
          </h1>
          <p className="text-muted-foreground max-w-prose text-lg">
            {t("heroDescription")}
          </p>
          <div className="flex flex-wrap gap-2">
            <AuthDialog
              callbackUrl={afterLogin}
              initialMode="register"
              trigger={<Button size="lg">{t("createAccount")}</Button>}
            />
            <AuthDialog
              callbackUrl={afterLogin}
              trigger={
                <Button size="lg" variant="outline">
                  {t("logIn")}
                </Button>
              }
            />
          </div>
        </section>
        <PublicSearch q={q} tag={tag} heading="h2" />
        <RecentlyPublished />
        <Rankings viewerId={null} />
      </PageContainer>
    </main>
  );
}
