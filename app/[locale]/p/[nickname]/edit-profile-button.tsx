"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { openSettings } from "@/lib/settings/open-settings";

export function EditProfileButton() {
  const t = useTranslations("profile");
  return (
    <Button
      variant="outline"
      className="self-start"
      onClick={() => openSettings("profile")}
    >
      <PencilIcon />
      {t("editProfile")}
    </Button>
  );
}
