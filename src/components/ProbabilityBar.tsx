"use client";

interface Segment {
  label: string;
  probability: number;
  color: string;
}

const COLORS = [
  "bg-green",
  "bg-red",
  "bg-blue",
  "bg-gold",
  "bg-purple-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
];

export function ProbabilityBar({
  outcomes,
}: {
  outcomes: { label: string; probability: number }[];
}) {
  const segments: Segment[] = outcomes.map((o, i) => ({
    label: o.label,
    probability: o.probability,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="w-full">
      <div className="flex h-8 w-full overflow-hidden rounded-md">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`${seg.color} flex items-center justify-center text-xs font-semibold text-white transition-all duration-300`}
            style={{ width: `${Math.max(seg.probability * 100, 2)}%` }}
          >
            {seg.probability >= 0.08 && (
              <span className="drop-shadow-md">
                {Math.round(seg.probability * 100)}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        {segments.map((seg, i) => (
          <span key={i}>
            {seg.label} {Math.round(seg.probability * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
