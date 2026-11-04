"use client";

import {
  ArrowDownUpIcon,
  EllipsisVerticalIcon,
  GlobeIcon,
  GlobeLockIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WithTooltip } from "@/components/ui/tooltip";

// The ⋮ button and its menu. Dialogs opened from items must be rendered next to it, not
// inside: the menu content unmounts when the menu closes.
export function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <WithTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={label}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SortSubmenu({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const t = useTranslations("menu");
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ArrowDownUpIcon />
        {t("sort")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function PublicationIcon({ isPublic }: { isPublic: boolean }) {
  const t = useTranslations("menu");
  const label = isPublic ? t("statusPublic") : t("statusPrivate");
  return (
    <WithTooltip label={label}>
      <span
        role="img"
        aria-label={label}
        // Focusable, so keyboard users get the tooltip too.
        tabIndex={0}
        className="text-muted-foreground focus-visible:ring-ring/50 flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-3 [&_svg]:size-4"
      >
        {isPublic ? <GlobeIcon /> : <GlobeLockIcon />}
      </span>
    </WithTooltip>
  );
}
