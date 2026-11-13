import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { LocalDate } from "@/components/local-date";
import { localDateTag } from "@/components/local-date-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserLink } from "@/components/user-link";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import {
  ADMIN_TABS,
  type AdminTab,
  findAdultTarget,
  isActiveAdmin,
  listAdminCategories,
  listAdminLog,
  listAdminQueue,
  listGlobalBans,
} from "@/lib/social/admin";
import { listPredefinedTags } from "@/lib/tags/queries";
import {
  AdminButton,
  CategoryForm,
  CategoryModeratorForm,
  GlobalBanForm,
  TagForm,
} from "./admin-forms";
import { PageContainer } from "@/components/page-container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("admin") };
}

const ITEM = "flex min-w-0 flex-col gap-2 rounded-lg border p-4 text-sm";

function List({
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

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

// Admins only (D80): everyone else gets the 404 of a page that is not there.
export default async function AdminPage({
  searchParams,
}: PageProps<"/[locale]/admin">) {
  await connection();
  const user = await requireUser();
  if (!user.ok || !(await isActiveAdmin(user.userId))) notFound();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("admin");
  const tModeration = await getTranslations("moderation");
  const query = await searchParams;
  const tab: AdminTab =
    ADMIN_TABS.find((value) => value === query.tab) ?? ADMIN_TABS[0];
  const fullDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });
  // Labels of buttons are strings: they keep the server's UTC.
  const date = (value: string) => fullDate.format(new Date(value));
  const deleted = tModeration("deletedAccount");

  let content: ReactNode = null;
  if (tab === "reports") {
    const reports = await listAdminQueue();
    content = (
      <List
        label={tModeration("reportList")}
        empty={reports.length === 0}
        emptyText={tModeration("noReports")}
      >
        {reports.map((report) => {
          const at = date(report.createdAt);
          return (
            <li key={report.id} className={ITEM}>
              <p className="font-medium [overflow-wrap:anywhere]">
                {t("reported", {
                  type: report.targetType,
                  nickname: report.target ?? deleted,
                })}
              </p>
              {report.text !== null ? (
                <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                  {report.text}
                </p>
              ) : (
                report.targetType !== "profile" && (
                  <p className="text-muted-foreground italic">
                    {t("reportedGone")}
                  </p>
                )
              )}
              {report.hidden && (
                <p className="text-muted-foreground">
                  {tModeration("reportedHidden")}
                </p>
              )}
              <p>{tModeration("reportReason", { reason: report.reason })}</p>
              {report.details && (
                <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                  {tModeration("reportDetails", { details: report.details })}
                </p>
              )}
              <p className="text-muted-foreground [overflow-wrap:anywhere]">
                {t.rich("reportedBy", {
                  nickname: report.reporter ?? deleted,
                  date: localDateTag(report.createdAt),
                })}
              </p>
              <div className="flex flex-wrap items-start gap-2">
                <AdminButton
                  kind={{ action: "resolved", reportId: report.id }}
                  label={tModeration("resolve")}
                  ariaLabel={tModeration("resolveFor", { date: at })}
                  variant="default"
                />
                <AdminButton
                  kind={{ action: "dismissed", reportId: report.id }}
                  label={tModeration("dismiss")}
                  ariaLabel={tModeration("dismissFor", { date: at })}
                />
                {report.canHide &&
                  (report.targetType === "comment" ||
                    report.targetType === "post") && (
                    <AdminButton
                      kind={{
                        action: "hide",
                        targetType: report.targetType,
                        id: report.targetId,
                      }}
                      label={tModeration("hide")}
                      ariaLabel={t("hideFor", { date: at })}
                      confirm={{
                        title: t("hideTitle"),
                        description: t("hideDescription"),
                      }}
                    />
                  )}
                {report.target && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50 dark:hover:bg-destructive/20 h-auto max-w-full [overflow-wrap:anywhere] whitespace-normal"
                  >
                    <Link
                      href={`/admin?tab=bans&nickname=${encodeURIComponent(report.target)}`}
                    >
                      {t("banFor", { nickname: report.target })}
                    </Link>
                  </Button>
                )}
                {report.path && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={report.path}>{tModeration("showInPlace")}</Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </List>
    );
  } else if (tab === "bans") {
    const bans = await listGlobalBans();
    content = (
      <div className="flex flex-col gap-6">
        <GlobalBanForm initialNickname={param(query.nickname)} />
        <List
          label={t("banList")}
          empty={bans.length === 0}
          emptyText={t("noBans")}
        >
          {bans.map((ban) => (
            <li key={ban.nickname} className={ITEM}>
              <p className="font-medium">
                <UserLink
                  nickname={ban.nickname}
                  className="[overflow-wrap:anywhere]"
                />
              </p>
              <p>
                {ban.until
                  ? tModeration.rich("bannedUntil", {
                      date: localDateTag(ban.until),
                    })
                  : tModeration("bannedForever")}
              </p>
              <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                {tModeration("reason", { reason: ban.reason })}
              </p>
              <p className="text-muted-foreground">
                {tModeration("bannedBy", { nickname: ban.by ?? deleted })}
              </p>
              <div className="flex">
                <AdminButton
                  kind={{ action: "lift", nickname: ban.nickname }}
                  label={tModeration("lift")}
                  ariaLabel={tModeration("liftFor", { nickname: ban.nickname })}
                  confirm={{
                    title: tModeration("liftTitle", { nickname: ban.nickname }),
                    description: t("liftDescription", {
                      nickname: ban.nickname,
                    }),
                  }}
                />
              </div>
            </li>
          ))}
        </List>
      </div>
    );
  } else if (tab === "adult") {
    const address = param(query.address).trim();
    const target = address ? await findAdultTarget(address) : null;
    content = (
      <div className="flex flex-col gap-6">
        <form
          method="get"
          className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
        >
          <input type="hidden" name="tab" value="adult" />
          <Label htmlFor="admin-address">{t("address")}</Label>
          <Input
            id="admin-address"
            name="address"
            defaultValue={address}
            autoComplete="off"
            aria-describedby="admin-address-hint"
            required
          />
          <p id="admin-address-hint" className="text-muted-foreground text-xs">
            {t("addressHint")}
          </p>
          <Button type="submit" size="sm" className="self-start">
            {t("find")}
          </Button>
        </form>
        {address &&
          (target ? (
            <section aria-labelledby="admin-adult-target" className={ITEM}>
              <h2
                id="admin-adult-target"
                className="font-medium [overflow-wrap:anywhere]"
              >
                {t("target", { type: target.type, name: target.name })}
              </h2>
              <p>
                {t("adminMark", {
                  state: target.admin === null ? "none" : String(target.admin),
                })}
              </p>
              <div className="flex flex-wrap items-start gap-2">
                <AdminButton
                  kind={{ action: "adult", address, value: true }}
                  label={t("markAdult")}
                  variant="destructive"
                  disabled={target.admin === true}
                />
                <AdminButton
                  kind={{ action: "adult", address, value: false }}
                  label={t("unmarkAdult")}
                  disabled={target.admin === false}
                />
                <AdminButton
                  kind={{ action: "adult", address, value: null }}
                  label={t("clearAdult")}
                  variant="ghost"
                  disabled={target.admin === null}
                />
              </div>
            </section>
          ) : (
            <p role="alert" className="text-destructive text-sm">
              {t("notFound")}
            </p>
          ))}
      </div>
    );
  } else if (tab === "categories") {
    const categories = await listAdminCategories();
    content = (
      <div className="flex flex-col gap-6">
        <CategoryForm />
        <ul aria-label={t("categoryList")} className="flex flex-col gap-3">
          {categories.map((category, index) => {
            const name = category.labels[locale];
            return (
              <li key={category.key} className={ITEM}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium [overflow-wrap:anywhere]">
                    {name}{" "}
                    <span className="text-muted-foreground text-xs">
                      {category.key}
                    </span>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton
                      kind={{ action: "up", key: category.key }}
                      label={t("up")}
                      ariaLabel={t("upFor", { name })}
                      variant="ghost"
                      disabled={index === 0}
                    />
                    <AdminButton
                      kind={{ action: "down", key: category.key }}
                      label={t("down")}
                      ariaLabel={t("downFor", { name })}
                      variant="ghost"
                      disabled={index === categories.length - 1}
                    />
                    <AdminButton
                      kind={{ action: "deleteCategory", key: category.key }}
                      label={t("delete")}
                      ariaLabel={t("deleteFor", { name })}
                      confirm={{
                        title: t("deleteCategoryTitle", { name }),
                        description: t("deleteCategoryDescription"),
                      }}
                    />
                  </div>
                </div>
                <CategoryForm category={category} />
                <h3 className="font-medium">{t("moderators")}</h3>
                {category.moderators.length === 0 ? (
                  <p className="text-muted-foreground">{t("noModerators")}</p>
                ) : (
                  <ul
                    aria-label={t("moderatorsOf", { name })}
                    className="flex flex-col gap-2"
                  >
                    {category.moderators.map((nickname) => (
                      <li
                        key={nickname}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <UserLink
                          nickname={nickname}
                          className="[overflow-wrap:anywhere]"
                        />
                        <AdminButton
                          kind={{
                            action: "removeModerator",
                            key: category.key,
                            nickname,
                          }}
                          label={tModeration("remove")}
                          ariaLabel={t("removeModeratorFor", {
                            nickname,
                            name,
                          })}
                          variant="ghost"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <CategoryModeratorForm categoryKey={category.key} name={name} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  } else if (tab === "tags") {
    const tags = await listPredefinedTags();
    content = (
      <div className="flex flex-col gap-6">
        <TagForm />
        <List
          label={t("tagList")}
          empty={tags.length === 0}
          emptyText={t("noTags")}
        >
          {tags.map((tag) => (
            <li key={tag.key} className={ITEM}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium [overflow-wrap:anywhere]">
                  {tag.key}
                </h2>
                <AdminButton
                  kind={{ action: "removeTag", key: tag.key }}
                  label={t("delete")}
                  ariaLabel={t("deleteFor", { name: tag.key })}
                  confirm={{
                    title: t("deleteTagTitle", { key: tag.key }),
                    description: t("deleteTagDescription"),
                  }}
                />
              </div>
              <TagForm tag={tag} />
            </li>
          ))}
        </List>
      </div>
    );
  } else {
    const author = param(query.author).trim();
    const page = Math.max(0, Math.floor(Number(param(query.page)) || 0));
    const { entries, more } = await listAdminLog({
      author: author || undefined,
      page,
    });
    const pageHref = (next: number) =>
      `/admin?tab=log${author ? `&author=${encodeURIComponent(author)}` : ""}&page=${next}`;
    content = (
      <div className="flex flex-col gap-4">
        <form method="get" className="flex min-w-0 flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value="log" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="admin-log-author">{t("logAuthor")}</Label>
            <Input
              id="admin-log-author"
              name="author"
              defaultValue={author}
              autoComplete="off"
            />
          </div>
          <Button type="submit" size="sm">
            {t("filter")}
          </Button>
        </form>
        <List
          label={tModeration("logList")}
          empty={entries.length === 0}
          emptyText={tModeration("noLog")}
        >
          {entries.map((entry) => (
            <li key={entry.id} className={ITEM}>
              <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
                {entry.community === null
                  ? t("logGlobal")
                  : t("logCommunity", { nickname: entry.community || deleted })}
              </p>
              <p className="[overflow-wrap:anywhere]">
                {t("log", {
                  action: entry.action,
                  targetType: entry.targetType,
                  actor: entry.actor ?? deleted,
                  target: entry.target ?? entry.targetKey ?? deleted,
                  key: entry.targetKey ?? "",
                })}
              </p>
              {entry.reason && (
                <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                  {tModeration("reason", { reason: entry.reason })}
                </p>
              )}
              <LocalDate
                iso={entry.createdAt}
                withTime
                className="text-muted-foreground text-xs"
              />
            </li>
          ))}
        </List>
        {(page > 0 || more) && (
          <nav aria-label={t("pages")} className="flex gap-2">
            {page > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(page - 1)}>{t("newer")}</Link>
              </Button>
            )}
            {more && (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(page + 1)}>{t("older")}</Link>
              </Button>
            )}
          </nav>
        )}
      </div>
    );
  }

  return (
    <PageContainer width="wide">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <nav
        aria-label={t("tabs")}
        className="flex flex-wrap gap-1 border-b pb-2"
      >
        {ADMIN_TABS.map((value) => (
          <Button
            key={value}
            asChild
            size="sm"
            variant={value === tab ? "secondary" : "ghost"}
          >
            <Link
              href={`/admin?tab=${value}`}
              aria-current={value === tab ? "page" : undefined}
            >
              {t("tab", { tab: value })}
            </Link>
          </Button>
        ))}
      </nav>
      {content}
    </PageContainer>
  );
}
