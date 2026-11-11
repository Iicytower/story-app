import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Types } from "mongoose";
import { UserLink } from "@/components/user-link";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { getConversation, listMessages } from "@/lib/social/direct-messages";
import { Thread } from "./thread";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/messages/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const conversation = user.ok ? await getConversation(user.userId, id) : null;
  const t = await getTranslations();
  if (!conversation) return { title: t("metadata.messages") };
  return {
    title: t("metadata.conversation", {
      nickname: conversation.nickname ?? t("messages.deletedAccount"),
    }),
  };
}

export default async function ConversationPage({
  params,
}: PageProps<"/[locale]/messages/[id]">) {
  await connection();
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale: await getLocale() });
  const { id } = await params;
  // Another account's conversation is not there for this one (D1).
  const conversation = await getConversation(user.userId, id);
  if (!conversation) notFound();
  const page = await listMessages(
    user.userId,
    new Types.ObjectId(conversation.id),
    null,
  );
  const t = await getTranslations("messages");
  const nickname = conversation.nickname ?? t("deletedAccount");

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 px-4 py-8 sm:px-6">
      <Link
        href="/messages"
        className="text-muted-foreground self-start text-sm hover:underline"
      >
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">
        {t.rich("heading", {
          nickname,
          user: (chunks) =>
            conversation.nickname && conversation.visible ? (
              <UserLink nickname={conversation.nickname}>{chunks}</UserLink>
            ) : (
              chunks
            ),
        })}
      </h1>
      <Thread
        conversationId={conversation.id}
        nickname={nickname}
        initialMessages={page!.messages}
        initialHasOlder={page!.hasOlder}
        initialClosed={conversation.closed}
      />
    </div>
  );
}
