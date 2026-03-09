"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PricePoint {
  timestamp: string;
  prices: Record<string, number>;
}

interface PriceChartProps {
  data: PricePoint[];
  outcomes: { id: string; label: string }[];
}

const CHART_COLORS = [
  "#22C55E",
  "#EF4444",
  "#3B82F6",
  "#FBBF24",
  "#A855F7",
  "#06B6D4",
  "#F97316",
  "#EC4899",
];

export function PriceChart({ data, outcomes }: PriceChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted rounded-xl bg-surface-2">
        Chart will appear after the first bet
      </div>
    );
  }

  const chartData = data.map((point) => {
    const entry: Record<string, string | number> = {
      time: new Date(point.timestamp).getTime(),
    };
    for (const outcome of outcomes) {
      entry[outcome.label] = Math.round((point.prices[outcome.id] ?? 0) * 100);
    }
    return entry;
  });

  const showDots = data.length <= 5;

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A2A" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A2A" }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A1A1A",
              border: "1px solid #2A2A2A",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={(ts) => formatTime(ts as number)}
            formatter={(value, name) => [`${value}%`, name]}
          />
          {outcomes.map((outcome, i) => (
            <Line
              key={outcome.id}
              type="stepAfter"
              dataKey={outcome.label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={showDots ? { r: 4 } : false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
