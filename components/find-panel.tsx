import {
  CaseSensitiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RegexIcon,
  ReplaceAllIcon,
  ReplaceIcon,
  WholeWordIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import type { FindOptions } from "@/lib/editor/find";

function PanelButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <WithTooltip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className="aria-pressed:bg-muted"
      >
        {children}
      </Button>
    </WithTooltip>
  );
}

export function FindPanel({
  options,
  onOptionsChange,
  replacement,
  onReplacementChange,
  showReplace,
  matchCount,
  current,
  invalid,
  findInputRef,
  onStep,
  onReplace,
  onReplaceAll,
  onClose,
}: {
  options: FindOptions;
  onOptionsChange: (options: FindOptions) => void;
  replacement: string;
  onReplacementChange: (replacement: string) => void;
  showReplace: boolean;
  matchCount: number;
  current: number;
  invalid: boolean;
  findInputRef: RefObject<HTMLInputElement | null>;
  onStep: (direction: 1 | -1) => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("find");
  const none = matchCount === 0;
  const status = invalid
    ? t("invalidRegex")
    : !options.query
      ? ""
      : none
        ? t("noResults")
        : t("position", { current: current + 1, total: matchCount });

  const toggles = [
    { key: "matchCase", label: t("matchCase"), icon: CaseSensitiveIcon },
    { key: "wholeWord", label: t("wholeWord"), icon: WholeWordIcon },
    { key: "regex", label: t("regex"), icon: RegexIcon },
  ] as const;

  return (
    <div className="flex flex-col gap-1 border-b px-2 py-1">
      <div className="flex flex-wrap items-center gap-0.5">
        <Input
          ref={findInputRef}
          value={options.query}
          onChange={(event) =>
            onOptionsChange({ ...options, query: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onStep(event.shiftKey ? -1 : 1);
          }}
          aria-label={t("find")}
          aria-invalid={invalid}
          placeholder={t("find")}
          autoComplete="off"
          spellCheck={false}
          className="h-7 w-48 min-w-0 flex-1 md:flex-none"
        />
        {toggles.map(({ key, label, icon: Icon }) => (
          <PanelButton
            key={key}
            label={label}
            pressed={options[key]}
            onClick={() =>
              onOptionsChange({ ...options, [key]: !options[key] })
            }
          >
            <Icon />
          </PanelButton>
        ))}
        <span
          aria-live="polite"
          className="text-muted-foreground mx-1 text-xs whitespace-nowrap"
        >
          {status}
        </span>
        <PanelButton
          label={t("previous")}
          disabled={none}
          onClick={() => onStep(-1)}
        >
          <ChevronUpIcon />
        </PanelButton>
        <PanelButton
          label={t("next")}
          disabled={none}
          onClick={() => onStep(1)}
        >
          <ChevronDownIcon />
        </PanelButton>
        <PanelButton label={t("close")} onClick={onClose}>
          <XIcon />
        </PanelButton>
      </div>
      {showReplace && (
        <div className="flex flex-wrap items-center gap-0.5">
          <Input
            value={replacement}
            onChange={(event) => onReplacementChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!none) onReplace();
            }}
            aria-label={t("replaceWith")}
            placeholder={t("replacePlaceholder")}
            autoComplete="off"
            spellCheck={false}
            className="h-7 w-48 min-w-0 flex-1 md:flex-none"
          />
          <PanelButton label={t("replace")} disabled={none} onClick={onReplace}>
            <ReplaceIcon />
          </PanelButton>
          <PanelButton
            label={t("replaceAll")}
            disabled={none}
            onClick={onReplaceAll}
          >
            <ReplaceAllIcon />
          </PanelButton>
        </div>
      )}
    </div>
  );
}
