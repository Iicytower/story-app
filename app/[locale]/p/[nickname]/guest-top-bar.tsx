import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthDialog } from "../../auth/auth-dialog";

// A guest has no sidebar on a public book or chapter, so the way to sign in is the same as on the home page (D83).
export async function GuestTopBar({ path }: { path: string }) {
  const [t, locale] = await Promise.all([
    getTranslations("common"),
    getLocale(),
  ]);
  return (
    <div className="flex items-center justify-between p-2">
      <Link href="/" className="px-2 font-semibold">
        {t("appName")}
      </Link>
      <AuthDialog callbackUrl={`/${locale}${path}`} />
    </div>
  );
}
