import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { LocalDate } from "@/components/local-date";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/social/direct-messages";
import { cn } from "@/lib/utils";
import { NewMessageButton } from "./new-message-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("messages") };
}

export default async function MessagesPage() {
  await connection();
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });
  const conversations = await listConversations(user.userId);
  const t = await getTranslations("messages");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <NewMessageButton />
      </div>
      {conversations.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul aria-label={t("list")} className="flex flex-col divide-y">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className={cn(
                  "hover:bg-accent flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-3",
                  conversation.unread && "bg-accent/40",
                )}
              >
                <span
                  className={cn(
                    "min-w-0 [overflow-wrap:anywhere]",
                    conversation.unread && "font-semibold",
                  )}
                >
                  {conversation.nickname ?? t("deletedAccount")}
                </span>
                {conversation.unread && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 text-xs leading-5">
                    {t("unread")}
                  </span>
                )}
                {conversation.closed && (
                  <span className="text-muted-foreground rounded-full border px-2 text-xs leading-5">
                    {t("closed")}
                  </span>
                )}
                <span className="text-muted-foreground ml-auto text-sm">
                  <span className="sr-only">{t("lastMessage")}: </span>
                  <LocalDate iso={conversation.lastMessageAt} relative />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
