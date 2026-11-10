import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { myProfilePath } from "@/lib/profiles/queries";

// "My profile" in the sidebar; the layout already sent signed-out visitors away.
export default async function MyProfilePage() {
  const user = await requireUser();
  if (!user.ok) notFound();
  const path = await myProfilePath(user.userId);
  if (!path) notFound();
  redirect({ href: path, locale: await getLocale() });
}
