import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { LocalDate } from "@/components/local-date";
import { localDateTag } from "@/components/local-date-tag";
import { Button } from "@/components/ui/button";
import { ReportModerationButtons } from "@/components/moderation-controls";
import { UserLink } from "@/components/user-link";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { MAX_MODERATORS } from "@/lib/limits";
import {
  getModerationOverview,
  listCommunityBans,
  listCommunityReports,
  listHiddenComments,
  listModerationLog,
  listModerators,
  MODERATION_TABS,
  type ModerationTab,
  tabsFor,
} from "@/lib/social/moderation";
import { BanForm, InviteForm, ModerationButton } from "./moderation-forms";
import { PageContainer } from "@/components/page-container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("moderation") };
}

const PATH = "/moderation";

function Name({ nickname }: { nickname: string | null }) {
  return nickname ? (
    <UserLink nickname={nickname} className="[overflow-wrap:anywhere]" />
  ) : (
    <DeletedAccount />
  );
}

async function DeletedAccount() {
  const t = await getTranslations("moderation");
  return (
    <span className="text-muted-foreground italic">{t("deletedAccount")}</span>
  );
}

function Section({
  label,
  empty,
  emptyText,
  children,
}: {
  label: string;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return empty ? (
    <p className="text-muted-foreground">{emptyText}</p>
  ) : (
    <ul aria-label={label} className="flex flex-col gap-3">
      {children}
    </ul>
  );
}

const ITEM = "flex min-w-0 flex-col gap-2 rounded-lg border p-4 text-sm";

export default async function ModerationPage({
  searchParams,
}: PageProps<"/[locale]/moderation">) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!user.ok) redirect({ href: "/", locale });
  const t = await getTranslations("moderation");
  const { communities, invitations } = await getModerationOverview(user.userId);
  const query = await searchParams;
  const current =
    communities.find(({ authorId }) => authorId === query.community) ??
    communities[0];
  const tabs = current ? tabsFor(current.role) : [];
  const tab: ModerationTab =
    tabs.find((value) => value === query.tab) ?? MODERATION_TABS[0];
  const fullDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });
  // Labels of buttons are strings: they keep the server's UTC.
  const date = (value: string) => fullDate.format(new Date(value));
  const href = (authorId: string, next: ModerationTab) =>
    `${PATH}?community=${authorId}&tab=${next}`;

  let content: ReactNode = null;
  if (current && tab === "hidden") {
    const hidden = await listHiddenComments(current.authorId);
    content = (
      <Section
        label={t("hiddenList")}
        empty={hidden.length === 0}
        emptyText={t("noHidden")}
      >
        {hidden.map((comment) => (
          <li key={comment.id} className={ITEM}>
            <p className="font-medium [overflow-wrap:anywhere]">
              {comment.writer ? (
                t("writtenBy", { nickname: comment.writer })
              ) : (
                <DeletedAccount />
              )}
            </p>
            <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
              {comment.body}
            </p>
            <p className="text-muted-foreground">
              {t.rich("hiddenBy", {
                nickname: comment.hiddenBy ?? t("deletedAccount"),
                date: localDateTag(comment.hiddenAt),
              })}
            </p>
            {comment.reason && (
              <p className="[overflow-wrap:anywhere]">
                {t("reason", { reason: comment.reason })}
              </p>
            )}
            {comment.purgeAt && (
              <p className="text-muted-foreground">
                {t.rich("purgeAt", {
                  date: localDateTag(comment.purgeAt),
                })}
              </p>
            )}
            <div className="flex flex-wrap items-start gap-2">
              <ModerationButton
                kind={{ action: "restore", commentId: comment.id }}
                label={t("restore")}
              />
              <Button asChild size="sm" variant="ghost">
                <Link href={comment.path}>{t("showInPlace")}</Link>
              </Button>
            </div>
          </li>
        ))}
      </Section>
    );
  } else if (current && tab === "reports") {
    const reports = await listCommunityReports(user.userId, current.authorId);
    content = (
      <Section
        label={t("reportList")}
        empty={reports.length === 0}
        emptyText={t("noReports")}
      >
        {reports.map((report) => {
          const at = date(report.createdAt);
          return (
            <li key={report.id} className={ITEM}>
              <p className="font-medium [overflow-wrap:anywhere]">
                {report.writer ? (
                  t("reportedComment", { nickname: report.writer })
                ) : (
                  <DeletedAccount />
                )}
              </p>
              {report.comment ? (
                <>
                  <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                    {report.comment.body}
                  </p>
                  {report.comment.state === "hidden" && (
                    <p className="text-muted-foreground">
                      {t("reportedHidden")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground italic">
                  {t("reportedGone")}
                </p>
              )}
              <p>{t("reportReason", { reason: report.reason })}</p>
              {report.details && (
                <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                  {t("reportDetails", { details: report.details })}
                </p>
              )}
              <p className="text-muted-foreground">
                {t.rich("reportedAt", {
                  date: localDateTag(report.createdAt),
                })}
              </p>
              <div className="flex flex-wrap items-start gap-2">
                <ModerationButton
                  kind={{ action: "resolved", reportId: report.id }}
                  label={t("resolve")}
                  ariaLabel={t("resolveFor", { date: at })}
                  variant="default"
                />
                <ModerationButton
                  kind={{ action: "dismissed", reportId: report.id }}
                  label={t("dismiss")}
                  ariaLabel={t("dismissFor", { date: at })}
                />
                {report.comment && (
                  <>
                    <ReportModerationButtons
                      commentId={report.comment.id}
                      nickname={report.writer}
                      authorId={current.authorId}
                      canHide={report.comment.canHide}
                      canBan={report.comment.canBan}
                      hideLabel={t("hideFor", { date: at })}
                      banLabel={t("banFor", {
                        nickname: report.writer ?? "",
                        date: at,
                      })}
                    />
                    <Button asChild size="sm" variant="ghost">
                      <Link href={report.comment.path}>{t("showInPlace")}</Link>
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </Section>
    );
  } else if (current && tab === "bans") {
    const bans = await listCommunityBans(current.authorId);
    content = (
      <div className="flex flex-col gap-6">
        <BanForm authorId={current.authorId} />
        <Section
          label={t("banList")}
          empty={bans.length === 0}
          emptyText={t("noBans")}
        >
          {bans.map((ban) => (
            <li key={ban.nickname} className={ITEM}>
              <p className="font-medium">
                <Name nickname={ban.nickname} />
              </p>
              <p>
                {ban.until
                  ? t.rich("bannedUntil", {
                      date: localDateTag(ban.until),
                    })
                  : t("bannedForever")}
              </p>
              <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                {t("reason", { reason: ban.reason })}
              </p>
              <p className="text-muted-foreground">
                {t("bannedBy", { nickname: ban.by ?? t("deletedAccount") })}
              </p>
              <div className="flex">
                <ModerationButton
                  kind={{
                    action: "lift",
                    authorId: current.authorId,
                    nickname: ban.nickname,
                  }}
                  label={t("lift")}
                  ariaLabel={t("liftFor", { nickname: ban.nickname })}
                  confirm={{
                    title: t("liftTitle", { nickname: ban.nickname }),
                    description: t("liftDescription", {
                      nickname: ban.nickname,
                    }),
                  }}
                />
              </div>
            </li>
          ))}
        </Section>
      </div>
    );
  } else if (current && tab === "moderators") {
    const moderators = await listModerators(current.authorId);
    content = (
      <div className="flex flex-col gap-6">
        <InviteForm />
        <p className="text-muted-foreground text-sm">
          {t("moderatorCount", {
            count: moderators.length,
            max: MAX_MODERATORS,
          })}
        </p>
        <Section
          label={t("moderatorList")}
          empty={moderators.length === 0}
          emptyText={t("noModerators")}
        >
          {moderators.map((moderator) => (
            <li
              key={moderator.nickname}
              className={`${ITEM} sm:flex-row sm:items-center sm:justify-between`}
            >
              <p className="flex min-w-0 flex-wrap items-baseline gap-2">
                <Name nickname={moderator.nickname} />
                <span className="text-muted-foreground text-xs">
                  {moderator.state === "active" ? t("active") : t("invited")}
                </span>
              </p>
              <ModerationButton
                kind={{ action: "remove", nickname: moderator.nickname }}
                label={t("remove")}
                ariaLabel={t("removeFor", { nickname: moderator.nickname })}
                confirm={{
                  title: t("removeTitle", { nickname: moderator.nickname }),
                  description: t("removeDescription", {
                    nickname: moderator.nickname,
                  }),
                }}
              />
            </li>
          ))}
        </Section>
      </div>
    );
  } else if (current && tab === "log") {
    const entries = await listModerationLog(current.authorId);
    content = (
      <Section
        label={t("logList")}
        empty={entries.length === 0}
        emptyText={t("noLog")}
      >
        {entries.map((entry) => (
          <li key={entry.id} className={ITEM}>
            <p className="[overflow-wrap:anywhere]">
              {t("log", {
                action: entry.action,
                targetType: entry.targetType,
                actor: entry.actor ?? t("deletedAccount"),
                target: entry.target ?? t("deletedAccount"),
              })}
            </p>
            {entry.reason && (
              <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                {t("reason", { reason: entry.reason })}
              </p>
            )}
            <LocalDate
              iso={entry.createdAt}
              withTime
              className="text-muted-foreground text-xs"
            />
          </li>
        ))}
      </Section>
    );
  }

  return (
    <PageContainer width="narrow">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {invitations.length > 0 && (
        <section
          aria-labelledby="moderation-invitations"
          className="flex flex-col gap-3"
        >
          <h2 id="moderation-invitations" className="text-lg font-medium">
            {t("invitations")}
          </h2>
          <ul className="flex flex-col gap-3">
            {invitations.map((invitation) => (
              <li
                key={invitation.authorId}
                className={`${ITEM} sm:flex-row sm:items-center sm:justify-between`}
              >
                <p className="[overflow-wrap:anywhere]">
                  {t("invitation", { nickname: invitation.nickname })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ModerationButton
                    kind={{ action: "accept", authorId: invitation.authorId }}
                    label={t("accept")}
                    variant="default"
                  />
                  <ModerationButton
                    kind={{ action: "decline", authorId: invitation.authorId }}
                    label={t("decline")}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!current ? (
        invitations.length === 0 && (
          <p className="text-muted-foreground">{t("empty")}</p>
        )
      ) : (
        <section
          aria-labelledby="moderation-community"
          className="flex min-w-0 flex-col gap-4"
        >
          {communities.length > 1 && (
            <nav aria-label={t("communities")} className="flex flex-wrap gap-2">
              {communities.map((community) => (
                <Button
                  key={community.authorId}
                  asChild
                  size="sm"
                  variant={
                    community.authorId === current.authorId
                      ? "secondary"
                      : "ghost"
                  }
                >
                  <Link
                    href={href(community.authorId, "hidden")}
                    aria-current={
                      community.authorId === current.authorId
                        ? "page"
                        : undefined
                    }
                    className="[overflow-wrap:anywhere]"
                  >
                    {community.role === "author"
                      ? t("ownCommunity")
                      : t("communityOf", { nickname: community.nickname })}
                  </Link>
                </Button>
              ))}
            </nav>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="moderation-community"
              className="text-lg font-medium [overflow-wrap:anywhere]"
            >
              {current.role === "author"
                ? t("ownCommunity")
                : t("communityOf", { nickname: current.nickname })}
            </h2>
            {current.role === "moderator" && (
              <ModerationButton
                kind={{ action: "resign", authorId: current.authorId }}
                label={t("resign")}
                confirm={{
                  title: t("resignTitle"),
                  description: t("resignDescription", {
                    nickname: current.nickname,
                  }),
                }}
              />
            )}
          </div>
          <nav
            aria-label={t("tabs")}
            className="flex flex-wrap gap-1 border-b pb-2"
          >
            {tabs.map((value) => (
              <Button
                key={value}
                asChild
                size="sm"
                variant={value === tab ? "secondary" : "ghost"}
              >
                <Link
                  href={href(current.authorId, value)}
                  aria-current={value === tab ? "page" : undefined}
                >
                  {t("tab", { tab: value })}
                </Link>
              </Button>
            ))}
          </nav>
          {content}
        </section>
      )}
    </PageContainer>
  );
}
