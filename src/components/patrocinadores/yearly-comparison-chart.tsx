"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export function YearlyComparisonChart({
  data,
  config,
  locale,
}: {
  data: { year: string; committed: number; collected: number }[];
  config: ChartConfig;
  locale: string;
}) {
  const currencyFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  });

  return (
    <ChartContainer config={config} className="w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="year" tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(value: number) => currencyFmt.format(value)}
          width={70}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {currencyFmt.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="committed" fill="var(--color-committed)" radius={4} />
        <Bar dataKey="collected" fill="var(--color-collected)" radius={4} />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}
