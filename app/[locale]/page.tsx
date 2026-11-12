import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
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

const COLUMN =
  "mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6";

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
        <div className={COLUMN}>
          <PublicSearch q={q} tag={tag} heading="h1" />
          <RecentlyPublished />
          <Rankings viewerId={userId} />
        </div>
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
      <div className={COLUMN}>
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
      </div>
    </main>
  );
}
