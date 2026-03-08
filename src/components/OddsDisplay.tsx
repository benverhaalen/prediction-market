"use client";

import { formatMultiplier } from "@/lib/utils";

interface OddsDisplayProps {
  outcomes: {
    id: string;
    label: string;
    probability: number;
    initialProbability?: number;
  }[];
  isBinary?: boolean;
}

export function OddsDisplay({ outcomes, isBinary }: OddsDisplayProps) {
  if (isBinary && outcomes.length === 2) {
    return <BinaryOddsDisplay outcomes={outcomes} />;
  }
  return <MultiOddsDisplay outcomes={outcomes} />;
}

function BinaryOddsDisplay({
  outcomes,
}: {
  outcomes: OddsDisplayProps["outcomes"];
}) {
  const yes = outcomes[0];
  const no = outcomes[1];
  const yesPercent = Math.round(yes.probability * 100);
  const noPercent = Math.round(no.probability * 100);

  return (
    <div className="flex gap-3">
      <div className="flex-1 rounded-xl bg-green-dim/30 border border-green/20 p-4 text-center">
        <div className="font-display text-4xl font-bold text-green">
          {yesPercent}%
        </div>
        <div className="mt-1 text-sm font-medium text-green/80">{yes.label}</div>
        <div className="mt-0.5 text-xs text-muted">{formatMultiplier(yes.probability)}</div>
        <PriceDelta current={yes.probability} initial={yes.initialProbability} />
      </div>
      <div className="flex-1 rounded-xl bg-red-dim/30 border border-red/20 p-4 text-center">
        <div className="font-display text-4xl font-bold text-red">
          {noPercent}%
        </div>
        <div className="mt-1 text-sm font-medium text-red/80">{no.label}</div>
        <div className="mt-0.5 text-xs text-muted">{formatMultiplier(no.probability)}</div>
        <PriceDelta current={no.probability} initial={no.initialProbability} />
      </div>
    </div>
  );
}

function MultiOddsDisplay({
  outcomes,
}: {
  outcomes: OddsDisplayProps["outcomes"];
}) {
  const sorted = [...outcomes].sort((a, b) => b.probability - a.probability);

  return (
    <div className="space-y-2">
      {sorted.map((outcome) => {
        const percent = Math.round(outcome.probability * 100);
        return (
          <div key={outcome.id} className="rounded-lg bg-surface-2 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">{outcome.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold">{percent}%</span>
                <span className="text-xs text-muted">
                  {formatMultiplier(outcome.probability)}
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-blue transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <PriceDelta
              current={outcome.probability}
              initial={outcome.initialProbability}
            />
          </div>
        );
      })}
    </div>
  );
}

function PriceDelta({
  current,
  initial,
}: {
  current: number;
  initial?: number;
}) {
  if (initial === undefined) return null;
  const delta = Math.round((current - initial) * 100);
  if (delta === 0) return null;

  return (
    <span
      className={`mt-1 inline-block text-xs font-medium ${
        delta > 0 ? "text-green" : "text-red"
      }`}
    >
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}
