"use client";

import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { suggestNicknames } from "@/app/[locale]/mention-actions";
import { CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";

// The @prefix being typed just before the caret, as MENTION in lib/social/mention-text.ts finds it.
const TYPING = /(?<![A-Za-z0-9_./@-])@([A-Za-z0-9_-]{1,30})$/;
const DEBOUNCE_MS = 150;

interface Typed {
  prefix: string;
  start: number;
  end: number;
}

function typedAt(text: string, caret: number): Typed | null {
  const match = TYPING.exec(text.slice(0, caret));
  if (!match) return null;
  return { prefix: match[1], start: caret - match[0].length, end: caret };
}

// A textarea that suggests nicknames after @ (task 82). It stays a textbox with the focus; the
// list is a listbox whose option the arrows choose (aria-activedescendant), Enter or Tab takes
// it and Escape closes it.
export function MentionTextarea({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<"textarea">, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations("mentions");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState<Typed | null>(null);
  const [nicknames, setNicknames] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [activeId, setActiveId] = useState<string | undefined>();
  const [listId, setListId] = useState<string | undefined>();
  const caret = useRef<number | null>(null);
  // Only what fits the prefix typed now: Enter right after another key never takes a suggestion
  // of the previous prefix.
  const shown = typed
    ? nicknames.filter((nickname) =>
        nickname.toLowerCase().startsWith(typed.prefix.toLowerCase()),
      )
    : [];
  const current = shown.includes(selected) ? selected : (shown[0] ?? "");
  const open = shown.length > 0;

  useEffect(() => {
    if (!typed) return;
    let active = true;
    const timer = setTimeout(async () => {
      const result = await suggestNicknames(typed.prefix);
      if (!active) return;
      const found = result.ok ? result.nicknames : [];
      setNicknames(found);
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [typed]);

  // cmdk marks the chosen option itself, after its own render.
  useEffect(() => {
    const element = list.current;
    if (!open || !element) return;
    const update = () => {
      setListId(element.id);
      setActiveId(
        element.querySelector<HTMLElement>('[aria-selected="true"]')?.id,
      );
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributeFilter: ["aria-selected"],
    });
    return () => {
      observer.disconnect();
      setListId(undefined);
      setActiveId(undefined);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (caret.current === null || !textarea.current) return;
    textarea.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);

  function follow(element: HTMLTextAreaElement) {
    const next = typedAt(element.value, element.selectionStart);
    setTyped((current) =>
      current?.prefix === next?.prefix && current?.start === next?.start
        ? current
        : next,
    );
    if (!next) setNicknames([]);
  }

  function close() {
    setTyped(null);
    setNicknames([]);
  }

  function choose(nickname: string) {
    if (!typed) return;
    const inserted = `@${nickname} `;
    caret.current = typed.start + inserted.length;
    onValueChange(
      value.slice(0, typed.start) + inserted + value.slice(typed.end),
    );
    close();
    textarea.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Closed, the keys belong to the textarea, not to the list.
    if (!open) {
      event.stopPropagation();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab" && current) {
      event.preventDefault();
      choose(current);
    }
  }

  return (
    <CommandPrimitive
      shouldFilter={false}
      vimBindings={false}
      loop
      value={current}
      onValueChange={setSelected}
      className="relative"
    >
      <Textarea
        {...props}
        ref={textarea}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          follow(event.target);
        }}
        onSelect={(event) => follow(event.currentTarget)}
        onBlur={close}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
      />
      {open && (
        <CommandList
          ref={list}
          label={t("suggestions")}
          // The textarea keeps the focus when an option is clicked.
          onMouseDown={(event) => event.preventDefault()}
          className="bg-popover text-popover-foreground absolute top-full left-0 z-20 mt-1 w-full max-w-xs rounded-md border p-1 shadow-md"
        >
          {shown.map((nickname) => (
            <CommandItem
              key={nickname}
              value={nickname}
              onSelect={() => choose(nickname)}
              className="[overflow-wrap:anywhere]"
            >
              {nickname}
            </CommandItem>
          ))}
        </CommandList>
      )}
      <span role="status" className="sr-only">
        {open ? t("count", { count: shown.length }) : ""}
      </span>
    </CommandPrimitive>
  );
}
