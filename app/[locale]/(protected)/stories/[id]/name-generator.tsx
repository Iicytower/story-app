"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearedBy,
  clearValue,
  type FilterKey,
  labelKey,
  selectValue,
} from "@/lib/name-generator/conflicts";
import {
  CRUDE_OPTIONS,
  DEFAULT_FILTERS,
  type Filters,
  hasAlliteration,
  hasGender,
  hasWordCount,
  loadFilters,
  saveFilters,
  SINGLE_GROUPS,
  type SingleGroup,
  STYLES,
  type Toggle,
  TYPE_GROUPS,
} from "@/lib/name-generator/filters";
import { generate } from "@/lib/name-generator/generate";
import { randomSeed } from "@/lib/name-generator/rng";

function Choice({
  label,
  pressed,
  round,
  clears,
  disabled,
  onClick,
}: {
  label: string;
  pressed: boolean;
  round: boolean;
  clears?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={clears}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border px-2.5 py-1 text-xs disabled:opacity-50",
        round ? "rounded-full" : "rounded-md",
        clears && "border-dashed",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="grid gap-1">
      <span id={id} className="text-muted-foreground text-xs">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function CopyButton({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  children?: string;
}) {
  const t = useTranslations("nameGenerator");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="xs"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      onMouseLeave={() => setCopied(false)}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {children ?? t("copy")}
    </Button>
  );
}

const TEXT_FIELDS = ["startsWith", "endsWith", "contains", "excludes"] as const;

function persist(filters: Filters) {
  saveFilters(window.localStorage, filters, Date.now());
}

function restore(): Filters {
  return loadFilters(window.localStorage, Date.now());
}

export function NameGenerator() {
  const [filters, setFilters] = useState(restore);
  const [names, setNames] = useState<string[] | null>(null);
  const seen = useRef(new Set<string>());
  const t = useTranslations("nameGenerator");
  // Paths built from filter values, which match the dictionary's keys.
  const label = (path: string) => t(path as Parameters<typeof t>[0]);

  function update(next: Filters) {
    setFilters(next);
    persist(next);
  }

  function run() {
    const result = generate({
      filters,
      seed: randomSeed(),
      seen: seen.current,
    }).map((name) => name.text);
    for (const name of result) seen.current.add(name.toLowerCase());
    setNames(result);
  }

  function clearsOf(key: FilterKey) {
    const cleared = clearedBy(filters, key);
    return cleared.length > 0
      ? t("clears", {
          labels: cleared.map((k) => label(labelKey(k))).join(", "),
        })
      : undefined;
  }

  function single(group: SingleGroup) {
    const { options } = SINGLE_GROUPS[group];
    const current = filters[group];
    return (
      <Group label={t(`groups.${group}.label`)}>
        <Choice
          label={t("any")}
          round
          pressed={current === "any"}
          onClick={() => update(clearValue(filters, `${group}:${current}`))}
        />
        {(options as readonly { value: string }[]).map((option) => {
          const key = `${group}:${option.value}`;
          const pressed = current === option.value;
          return (
            <Choice
              key={key}
              label={label(`groups.${group}.options.${option.value}`)}
              round
              pressed={pressed}
              clears={pressed ? undefined : clearsOf(key)}
              onClick={() => update(selectValue(filters, key))}
            />
          );
        })}
      </Group>
    );
  }

  function toggle(name: Toggle, disabled?: boolean) {
    const key = `${name}:on`;
    return (
      <Choice
        label={t(`toggles.${name}`)}
        round={false}
        pressed={filters[name]}
        disabled={disabled}
        clears={filters[name] ? undefined : clearsOf(key)}
        onClick={() =>
          update(
            filters[name]
              ? clearValue(filters, key)
              : selectValue(filters, key),
          )
        }
      />
    );
  }

  return (
    <div className="grid min-w-0 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="grid min-w-0 gap-3">
        {TYPE_GROUPS.map((group) => (
          <Group key={group.id} label={t(`typeGroups.${group.id}`)}>
            {group.types.map((type) => (
              <Choice
                key={type.value}
                label={t(`types.${type.value}`)}
                round
                pressed={filters.type === type.value}
                onClick={() => update({ ...filters, type: type.value })}
              />
            ))}
          </Group>
        ))}

        {hasGender(filters.type) && single("gender")}

        <Group label={t("style")}>
          <Choice
            label={t("any")}
            round={false}
            pressed={filters.styles.length === 0}
            onClick={() => update({ ...filters, styles: [] })}
          />
          {STYLES.map((style) => {
            const key = `style:${style.value}`;
            const pressed = filters.styles.includes(style.value);
            return (
              <Choice
                key={key}
                label={t(`styles.${style.value}`)}
                round={false}
                pressed={pressed}
                clears={pressed ? undefined : clearsOf(key)}
                onClick={() =>
                  update(
                    pressed
                      ? clearValue(filters, key)
                      : selectValue(filters, key),
                  )
                }
              />
            );
          })}
          {toggle("mixStyles", filters.styles.length === 1)}
        </Group>

        {single("sound")}
        {single("length")}
        {single("pronunciation")}

        <Group label={t("crudePart")}>
          {CRUDE_OPTIONS.map((option) => (
            <Choice
              key={option.value}
              label={t(`crude.${option.value}`)}
              round
              pressed={filters.crude === option.value}
              onClick={() => update({ ...filters, crude: option.value })}
            />
          ))}
        </Group>

        {single("balance")}
        {single("mood")}
        {hasWordCount(filters.type) && single("wordCount")}

        <Group label={t("options")}>
          {hasAlliteration(filters.type) && toggle("alliteration")}
          {toggle("repeatedSyllable")}
          <Choice
            label={t("polishLetters")}
            round={false}
            pressed={filters.polishLetters}
            onClick={() =>
              update(
                filters.polishLetters
                  ? selectValue(filters, "polishLetters:off")
                  : clearValue(filters, "polishLetters:off"),
              )
            }
          />
          {toggle("punctuation")}
          {toggle("easyInflect")}
        </Group>

        <div className="grid grid-cols-2 gap-2">
          {TEXT_FIELDS.map((key) => (
            <div key={key} className="grid gap-1">
              <Label htmlFor={`name-${key}`} className="text-xs font-normal">
                {t(`textFields.${key}`)}
              </Label>
              <Input
                id={`name-${key}`}
                value={filters[key]}
                onChange={(event) =>
                  update({ ...filters, [key]: event.target.value })
                }
              />
            </div>
          ))}
        </div>

        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => update(DEFAULT_FILTERS)}
          >
            {t("reset")}
          </Button>
        </div>
      </div>

      <div className="order-first grid min-w-0 gap-2 sm:sticky sm:top-0 sm:order-none">
        <div className="flex gap-2">
          <Button onClick={run}>{t("generate")}</Button>
          {names !== null && names.length > 0 && (
            <Button variant="outline" onClick={run}>
              {t("next")}
            </Button>
          )}
        </div>
        {names !== null && names.length < 10 && (
          <p role="status" className="text-muted-foreground text-xs">
            {names.length === 0
              ? t("noMatch")
              : t("fewMatch", { count: names.length })}
          </p>
        )}
        {names !== null && names.length > 0 && (
          <>
            <ol aria-label={t("names")} className="grid gap-0.5">
              {names.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 break-words">{name}</span>
                  <CopyButton label={t("copyName", { name })} text={name} />
                </li>
              ))}
            </ol>
            <div>
              <CopyButton label={t("copyAll")} text={names.join("\n")}>
                {t("copyAll")}
              </CopyButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
