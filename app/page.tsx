import type { Metadata } from "next";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { AuthDialog } from "./auth/auth-dialog";
import { PublicSearch } from "./public-search";

export const metadata: Metadata = { title: "Search stories – Story App" };

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { q, tag, auth: authParam, callbackUrl } = await searchParams;
  const userId = (await auth())?.user?.id;
  const search = <PublicSearch q={q} tag={tag} />;
  if (userId) return <AppShell userId={userId}>{search}</AppShell>;

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex justify-end p-2">
        <AuthDialog
          defaultOpen={authParam === "login" || callbackUrl !== undefined}
          callbackUrl={typeof callbackUrl === "string" ? callbackUrl : "/"}
        />
      </div>
      {search}
    </main>
  );
}
