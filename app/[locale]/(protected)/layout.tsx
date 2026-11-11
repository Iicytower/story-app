import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { resumeAccountCleanup } from "@/lib/account-deletion";
import { requireUser } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });
  // An account deletion whose cleanup stopped is finished by a later request (task 89).
  after(() => resumeAccountCleanup());
  return <AppShell userId={user.userId}>{children}</AppShell>;
}
