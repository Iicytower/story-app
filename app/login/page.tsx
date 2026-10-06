import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in – Story App" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user?.id) redirect("/stories");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <LoginForm
          callbackUrl={
            typeof callbackUrl === "string" ? callbackUrl : "/stories"
          }
        />
      </div>
    </main>
  );
}
