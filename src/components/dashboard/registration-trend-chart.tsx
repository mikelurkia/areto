"use client";

import { Area, AreaChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  count: { label: "count", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RegistrationTrendChart({
  data,
  countLabel,
}: {
  data: { month: string; label: string; count: number }[];
  countLabel: string;
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-32 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{countLabel}</span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {value}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="count"
          type="monotone"
          fill="var(--color-count)"
          fillOpacity={0.15}
          stroke="var(--color-count)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
