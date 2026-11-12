import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function PublicBreadcrumb({
  nickname,
  folder,
}: {
  nickname: string;
  folder?: { name: string; path: string };
}) {
  const t = await getTranslations("public");
  const items = [
    { label: t("home"), href: "/" },
    { label: nickname, href: `/p/${nickname}` },
    ...(folder ? [{ label: folder.name, href: folder.path }] : []),
  ];

  return (
    <nav aria-label={t("breadcrumb")} className="text-muted-foreground text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li
            key={item.href}
            className="flex items-center gap-1.5 [overflow-wrap:anywhere]"
          >
            {index > 0 && <span aria-hidden="true">/</span>}
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
