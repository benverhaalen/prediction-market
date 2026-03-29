"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
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
        Chart will appear after the first prediction
      </div>
    );
  }

  // Sort ascending by time
  const sorted = [...data].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Forward-fill missing outcome prices so staggered snapshot timestamps
  // don't create vertical spikes between 0 and the real value
  const lastKnown: Record<string, number> = {};
  const chartData = sorted.map((point) => {
    const entry: Record<string, string | number> = {
      time: new Date(point.timestamp).getTime(),
    };
    for (const outcome of outcomes) {
      const raw = point.prices[outcome.id];
      if (raw !== undefined) {
        lastKnown[outcome.id] = raw;
      }
      entry[outcome.label] = Math.round((lastKnown[outcome.id] ?? 0) * 100);
    }
    return entry;
  });

  const showDots = chartData.length <= 10;
  const isBinary = outcomes.length === 2;

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#2A2A2A"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A2A" }}
            minTickGap={60}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A2A" }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            width={36}
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
            cursor={{ stroke: "#444", strokeWidth: 1 }}
          />
          <Legend
            wrapperStyle={{
              fontSize: "12px",
              color: "#888",
              paddingTop: "4px",
            }}
          />
          {isBinary && (
            <ReferenceLine
              y={50}
              stroke="#444"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          {outcomes.map((outcome, i) => (
            <Line
              key={outcome.id}
              type="monotone"
              dataKey={outcome.label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={showDots ? { r: 3, strokeWidth: 0 } : false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
