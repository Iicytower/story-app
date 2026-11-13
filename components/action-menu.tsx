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
  triggerRef,
  children,
}: {
  label: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <WithTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            aria-label={label}
          >
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

type RadioSubmenuProps = {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

export function RadioSubmenu({
  icon,
  label,
  value,
  options,
  onChange,
}: RadioSubmenuProps & { icon: React.ReactNode; label: string }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {icon}
        {label}
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

export function SortSubmenu(props: RadioSubmenuProps) {
  const t = useTranslations("menu");
  return (
    <RadioSubmenu icon={<ArrowDownUpIcon />} label={t("sort")} {...props} />
  );
}

export function PublicationStatus({ isPublic }: { isPublic: boolean }) {
  const t = useTranslations("menu");
  return (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs whitespace-nowrap [&_svg]:size-3.5">
      {isPublic ? <GlobeIcon /> : <GlobeLockIcon />}
      {isPublic ? t("statusPublic") : t("statusPrivate")}
    </span>
  );
}
