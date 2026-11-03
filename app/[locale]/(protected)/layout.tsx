import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });
  return <AppShell userId={user.userId}>{children}</AppShell>;
}
