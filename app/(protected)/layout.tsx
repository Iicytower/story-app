import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  if (!user.ok) redirect("/");
  return <AppShell userId={user.userId}>{children}</AppShell>;
}
