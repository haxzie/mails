"use client";

import { useId, useState } from "react";

export interface SeriesPoint {
  day: string;
  sent: number;
  opened: number;
  clicked: number;
}

/**
 * Categorical slots 1-3 of the validated default palette
 * (CVD ΔE 9.2 deutan, normal-vision ΔE 27.6, both above the floors).
 * Aqua sits below 3:1 against the surface, so every series is also
 * directly labelled in the legend and repeated as a numeric tile.
 */
export const SERIES_COLORS = {
  sent: "#2a78d6",
  opened: "#eb6834",
  clicked: "#1baf7a",
} as const;

const SERIES: Array<{ key: keyof typeof SERIES_COLORS; label: string }> = [
  { key: "sent", label: "Sent" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
];

const WIDTH = 760;
const HEIGHT = 200;
const PAD = { top: 12, right: 16, bottom: 22, left: 34 };

export function SendsChart({ data }: { data: SeriesPoint[] }) {
  const clipId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(
    4,
    ...data.flatMap((point) => [point.sent, point.opened, point.clicked]),
  );
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left +
    (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight;

  const ticks = [0, max / 2, max].map((value) => Math.round(value));
  const active = hover === null ? null : data[hover];

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5 text-[12px]">
            <span
              aria-hidden
              className="h-[3px] w-4 rounded-full"
              style={{ background: SERIES_COLORS[series.key] }}
            />
            <span className="text-ink-soft">{series.label}</span>
            <span className="font-medium tabular-nums">
              {data.reduce((total, point) => total + point[series.key], 0)}
            </span>
          </span>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Emails sent, opened and clicked per day over the selected range"
          onPointerLeave={() => setHover(null)}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio =
              ((event.clientX - box.left) / box.width) * WIDTH - PAD.left;
            const index = Math.round((ratio / innerWidth) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, index)));
          }}
        >
          <clipPath id={clipId}>
            <rect x={PAD.left} y={0} width={innerWidth} height={HEIGHT} />
          </clipPath>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 3.5}
                textAnchor="end"
                className="fill-[var(--color-ink-muted)] text-[9px] tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}

          {SERIES.map((series) => (
            <polyline
              key={series.key}
              clipPath={`url(#${clipId})`}
              fill="none"
              stroke={SERIES_COLORS[series.key]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={data
                .map((point, index) => `${x(index)},${y(point[series.key])}`)
                .join(" ")}
            />
          ))}

          {hover !== null && active ? (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="var(--color-line-strong)"
                strokeWidth={1}
              />
              {SERIES.map((series) => (
                <circle
                  key={series.key}
                  cx={x(hover)}
                  cy={y(active[series.key])}
                  r={4}
                  fill={SERIES_COLORS[series.key]}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          ) : null}

          {data.length > 1 ? (
            <>
              <text
                x={PAD.left}
                y={HEIGHT - 6}
                className="fill-[var(--color-ink-muted)] text-[9px]"
              >
                {formatDay(data[0]!.day)}
              </text>
              <text
                x={WIDTH - PAD.right}
                y={HEIGHT - 6}
                textAnchor="end"
                className="fill-[var(--color-ink-muted)] text-[9px]"
              >
                {formatDay(data[data.length - 1]!.day)}
              </text>
            </>
          ) : null}
        </svg>

        {active ? (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-2.5 py-2 text-[11.5px] shadow-md"
            style={{
              left: `calc(${(x(hover!) / WIDTH) * 100}% + 8px)`,
              transform:
                x(hover!) / WIDTH > 0.75 ? "translateX(calc(-100% - 16px))" : undefined,
            }}
          >
            <p className="mb-1 font-medium">{formatDay(active.day)}</p>
            {SERIES.map((series) => (
              <p key={series.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: SERIES_COLORS[series.key] }}
                />
                <span className="text-ink-soft">{series.label}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {active[series.key]}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}

function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(Date.UTC(2000, Number(month) - 1, Number(date))),
  );
}

/** Horizontal funnel for a single campaign: delivered → opened → clicked. */
export function FunnelBars({
  rows,
}: {
  rows: Array<{ label: string; value: number; total: number; color: string }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const share = row.total ? (row.value / row.total) * 100 : 0;
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-baseline justify-between text-[12px]">
              <span className="text-ink-soft">{row.label}</span>
              <span className="font-medium tabular-nums">
                {row.value} · {share.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-canvas">
              <div
                className="h-2 rounded-full"
                style={{ width: `${Math.max(share, row.value ? 1.5 : 0)}%`, background: row.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
