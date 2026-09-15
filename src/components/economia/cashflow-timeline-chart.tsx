"use client";

import { Bar, ComposedChart, Line, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { currencyFormatter } from "@/lib/money";

const chartConfig = {
  income: { label: "income", color: "var(--chart-2)" },
  expense: { label: "expense", color: "var(--chart-1)" },
  projectedBalance: { label: "projectedBalance", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function CashflowTimelineChart({
  data,
  locale,
  incomeLabel,
  expenseLabel,
  projectedBalanceLabel,
}: {
  data: { weekLabel: string; incomeCents: number; expenseCents: number; projectedBalanceCents: number }[];
  locale: string;
  incomeLabel: string;
  expenseLabel: string;
  projectedBalanceLabel: string;
}) {
  const fmt = currencyFormatter(locale);
  const chartData = data.map((row) => ({
    week: row.weekLabel,
    income: row.incomeCents / 100,
    expense: -(row.expenseCents / 100),
    projectedBalance: row.projectedBalanceCents / 100,
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
      <ComposedChart data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {name === "income"
                      ? incomeLabel
                      : name === "expense"
                        ? expenseLabel
                        : projectedBalanceLabel}
                  </span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {fmt.format(name === "expense" ? -Number(value) : Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={2} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={2} />
        <Line
          dataKey="projectedBalance"
          type="monotone"
          stroke="var(--color-projectedBalance)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
