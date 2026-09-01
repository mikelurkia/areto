"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { currencyFormatter } from "@/lib/money";

export function TierBreakdownChart({
  data,
  config,
  locale,
}: {
  data: { key: string; label: string; amount: number; fill: string }[];
  config: ChartConfig;
  locale: string;
}) {
  const currencyFmt = currencyFormatter(locale);

  return (
    <ChartContainer config={config} className="w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(value: number) => currencyFmt.format(value)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {(item.payload as { label: string }).label}
                  </span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {currencyFmt.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="amount" radius={4}>
          {data.map((row) => (
            <Cell key={row.key} fill={row.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
