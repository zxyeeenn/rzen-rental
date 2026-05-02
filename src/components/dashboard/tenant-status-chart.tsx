"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ACTIVE = "#4f46e5";
const ENDED = "#6366f1";

type Row = { status: string; count: number };

export function TenantStatusChart({
  activeCount,
  endedCount,
}: {
  activeCount: number;
  endedCount: number;
}) {
  const data: Row[] = [
    { status: "Active", count: activeCount },
    { status: "Ended", count: endedCount },
  ];

  if (activeCount === 0 && endedCount === 0) {
    return (
      <p className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-indigo-400 dark:text-muted-foreground">
        Tenant distribution appears when lease records exist.
      </p>
    );
  }

  return (
    <div className="h-[280px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="status"
            width={52}
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => [String(v), "Leases"]}
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid rgb(199 210 254)",
            }}
          />
          <Bar
            dataKey="count"
            name="Leases"
            radius={[0, 6, 6, 0]}
            barSize={28}
          >
            {data.map((entry) => (
              <Cell
                key={entry.status}
                fill={entry.status === "Active" ? ACTIVE : ENDED}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
