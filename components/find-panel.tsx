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
import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="aria-pressed:bg-muted"
    >
      {children}
    </Button>
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
  const none = matchCount === 0;
  const status = invalid
    ? "Invalid regular expression"
    : !options.query
      ? ""
      : none
        ? "No results"
        : `${current + 1} of ${matchCount}`;

  const toggles = [
    { key: "matchCase", label: "Match case", icon: CaseSensitiveIcon },
    { key: "wholeWord", label: "Whole word", icon: WholeWordIcon },
    { key: "regex", label: "Regular expression", icon: RegexIcon },
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
          aria-label="Find"
          aria-invalid={invalid}
          placeholder="Find"
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
          label="Previous match"
          disabled={none}
          onClick={() => onStep(-1)}
        >
          <ChevronUpIcon />
        </PanelButton>
        <PanelButton
          label="Next match"
          disabled={none}
          onClick={() => onStep(1)}
        >
          <ChevronDownIcon />
        </PanelButton>
        <PanelButton label="Close find" onClick={onClose}>
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
            aria-label="Replace with"
            placeholder="Replace"
            autoComplete="off"
            spellCheck={false}
            className="h-7 w-48 min-w-0 flex-1 md:flex-none"
          />
          <PanelButton label="Replace" disabled={none} onClick={onReplace}>
            <ReplaceIcon />
          </PanelButton>
          <PanelButton
            label="Replace all"
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
