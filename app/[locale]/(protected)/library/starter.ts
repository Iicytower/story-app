import { getTranslations } from "next-intl/server";
import { ensureStarterShelves } from "@/lib/library/queries";

export async function seedShelves(userId: string): Promise<void> {
  const t = await getTranslations("library.starter");
  await ensureStarterShelves(userId, [t("reading"), t("later"), t("read")]);
}
