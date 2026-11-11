"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface ChartDay {
  label: string;
  readers: number;
}

export function StatsChart({
  days,
  label,
}: {
  days: ChartDay[];
  label: string;
}) {
  const t = useTranslations("stats");
  // --primary follows the accent and dark mode (lib/theme.ts).
  const config = {
    readers: { label: t("readers"), color: "var(--primary)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-64 w-full"
      data-testid="stats-chart"
      // Days with at least one reader, for tests and assistive checks.
      data-points={days.filter(({ readers }) => readers > 0).length}
      role="img"
      aria-label={label}
    >
      {/* The image is described by its label; bars are not focusable one by one. */}
      <BarChart
        data={days}
        margin={{ left: 0, right: 8 }}
        accessibilityLayer={false}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="readers" fill="var(--color-readers)" radius={2} />
      </BarChart>
    </ChartContainer>
  );
}
