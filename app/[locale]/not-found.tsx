import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="flex flex-1 items-center justify-center">
      <p>{t("text")}</p>
    </main>
  );
}
