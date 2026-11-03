"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearedBy,
  clearsLabel,
  clearValue,
  type FilterKey,
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
  TOGGLES,
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
  children = "Copy",
}: {
  label: string;
  text: string;
  children?: string;
}) {
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
      {children}
    </Button>
  );
}

const TEXT_FIELDS = [
  { key: "startsWith", label: "Starts with" },
  { key: "endsWith", label: "Ends with" },
  { key: "contains", label: "Contains" },
  { key: "excludes", label: "Excludes (comma-separated)" },
] as const;

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

  const clearsOf = (key: FilterKey) => clearsLabel(clearedBy(filters, key));

  function single(group: SingleGroup) {
    const { label, options } = SINGLE_GROUPS[group];
    const current = filters[group];
    return (
      <Group label={label}>
        <Choice
          label="Any"
          round
          pressed={current === "any"}
          onClick={() => update(clearValue(filters, `${group}:${current}`))}
        />
        {(options as readonly { value: string; label: string }[]).map(
          (option) => {
            const key = `${group}:${option.value}`;
            const pressed = current === option.value;
            return (
              <Choice
                key={key}
                label={option.label}
                round
                pressed={pressed}
                clears={pressed ? undefined : clearsOf(key)}
                onClick={() => update(selectValue(filters, key))}
              />
            );
          },
        )}
      </Group>
    );
  }

  function toggle(name: Toggle, disabled?: boolean) {
    const key = `${name}:on`;
    return (
      <Choice
        label={TOGGLES[name]}
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
          <Group key={group.label} label={group.label}>
            {group.types.map((type) => (
              <Choice
                key={type.value}
                label={type.label}
                round
                pressed={filters.type === type.value}
                onClick={() => update({ ...filters, type: type.value })}
              />
            ))}
          </Group>
        ))}

        {hasGender(filters.type) && single("gender")}

        <Group label="Style">
          <Choice
            label="Any"
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
                label={style.label}
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

        <Group label="Crude part">
          {CRUDE_OPTIONS.map((option) => (
            <Choice
              key={option.value}
              label={option.label}
              round
              pressed={filters.crude === option.value}
              onClick={() => update({ ...filters, crude: option.value })}
            />
          ))}
        </Group>

        {single("balance")}
        {single("mood")}
        {hasWordCount(filters.type) && single("wordCount")}

        <Group label="Options">
          {hasAlliteration(filters.type) && toggle("alliteration")}
          {toggle("repeatedSyllable")}
          <Choice
            label="Polish letters"
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
          {TEXT_FIELDS.map(({ key, label }) => (
            <div key={key} className="grid gap-1">
              <Label htmlFor={`name-${key}`} className="text-xs font-normal">
                {label}
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
            Reset filters
          </Button>
        </div>
      </div>

      <div className="order-first grid min-w-0 gap-2 sm:sticky sm:top-0 sm:order-none">
        <div className="flex gap-2">
          <Button onClick={run}>Generate</Button>
          {names !== null && names.length > 0 && (
            <Button variant="outline" onClick={run}>
              Next 10
            </Button>
          )}
        </div>
        {names !== null && names.length < 10 && (
          <p role="status" className="text-muted-foreground text-xs">
            {names.length === 0
              ? "No names match these filters."
              : `Only ${names.length} ${
                  names.length === 1 ? "name matches" : "names match"
                } these filters.`}
          </p>
        )}
        {names !== null && names.length > 0 && (
          <>
            <ol aria-label="Names" className="grid gap-0.5">
              {names.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 break-words">{name}</span>
                  <CopyButton label={`Copy ${name}`} text={name} />
                </li>
              ))}
            </ol>
            <div>
              <CopyButton label="Copy all" text={names.join("\n")}>
                Copy all
              </CopyButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
