"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPHP } from "@/lib/format-php";
import type { PaymentMonthBucket } from "@/lib/types/payment";

type Row = { month: string; Paid: number; Pending: number };

export function PaymentsByMonthChart({
  data,
}: {
  data: PaymentMonthBucket[];
}) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Chart appears once you have payment rows with billing months.
      </p>
    );
  }

  const chartData: Row[] = data.map((d) => ({
    month: d.month,
    Paid: d.paidPhp,
    Pending: d.pendingPhp,
  }));

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          barGap={6}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ className: "stroke-border" }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ className: "stroke-border" }}
            tickFormatter={(v) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <Tooltip
            formatter={(value) =>
              formatPHP(typeof value === "number" ? value : Number(value) || 0)
            }
            labelFormatter={(label) => `Billing month ${label}`}
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid oklch(0.922 0 0)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar
            dataKey="Paid"
            name="Paid"
            fill="#22c55e"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="Pending"
            name="Pending"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
