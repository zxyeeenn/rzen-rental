"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { formatPHP } from "@/lib/format-php";

const PAID = "#22c55e";
const PENDING = "#f59e0b";

type Slice = { name: string; value: number; fill: string };

export function PaymentStatusChart({
  paidPhp,
  pendingPhp,
}: {
  paidPhp: number;
  pendingPhp: number;
}) {
  const data: Slice[] = [];
  if (paidPhp > 0) {
    data.push({ name: "Paid", value: paidPhp, fill: PAID });
  }
  if (pendingPhp > 0) {
    data.push({ name: "Pending", value: pendingPhp, fill: PENDING });
  }

  if (!data.length) {
    return (
      <p className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-indigo-400 dark:text-muted-foreground">
        Payment status chart appears once you have paid or pending amounts on
        record.
      </p>
    );
  }

  return (
    <div className="h-[280px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={88}
            paddingAngle={2}
            labelLine={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              formatPHP(typeof value === "number" ? value : Number(value) || 0)
            }
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid rgb(199 210 254)",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={40}
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            formatter={(value) => {
              if (value === "Paid") return `Paid (${formatPHP(paidPhp)})`;
              if (value === "Pending")
                return `Pending (${formatPHP(pendingPhp)})`;
              return String(value);
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
