import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const buttonSizes = {
  sm: "h-7 px-2.5",
  md: "h-9 px-3.5",
};

const buttonVariants = {
  primary: "bg-ink text-white hover:bg-ink/90",
  accent: "bg-accent text-white hover:bg-accent/90",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-canvas shadow-[0_1px_1px_rgba(0,0,0,0.02)]",
  ghost: "text-ink-soft hover:bg-canvas hover:text-ink",
  danger: "bg-negative-soft text-negative border border-negative/20 hover:bg-negative/10",
};

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: keyof typeof buttonSizes = "md",
  className?: string,
) {
  return cx(buttonBase, buttonSizes[size], buttonVariants[variant], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-(--radius-card) border border-line bg-surface shadow-[0_1px_2px_rgba(16,16,22,0.03)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
      <div>
        <h2 className="text-[13px] font-medium">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * The bar pinned to the top of the content panel: page title on the left,
 * actions on the right, matching the app-frame layout.
 */
export function TopBar({
  title,
  description,
  badge,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2.5 border-b border-line bg-surface/85 px-5 backdrop-blur">
      <h1 className="shrink-0 text-[13.5px] font-medium tracking-[-0.005em]">
        {title}
      </h1>
      {badge}
      {description ? (
        <p className="hidden truncate text-[12.5px] text-ink-muted md:block">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </header>
  );
}

/** Padded body of a page, below the top bar. */
export function Content({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("px-5 py-5", className)}>{children}</div>;
}

/** Section heading inside a page body. */
export function SectionTitle({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="pb-3">
      <h2 className="text-[13.5px] font-medium">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[12px] text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(controlClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(controlClass, "appearance-none pr-8", className)} {...props} />
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cx("size-4 rounded border-line-strong accent-accent", className)}
      {...props}
    />
  );
}

const badgeTones = {
  neutral: "bg-canvas text-ink-soft border-line",
  accent: "bg-accent-soft text-accent border-accent/15",
  positive: "bg-positive-soft text-positive border-positive/15",
  warning: "bg-warning-soft text-warning border-warning/15",
  negative: "bg-negative-soft text-negative border-negative/15",
};

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium",
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

const statusTones: Record<string, BadgeTone> = {
  draft: "neutral",
  scheduled: "accent",
  sending: "warning",
  sent: "positive",
  failed: "negative",
  queued: "neutral",
  delivered: "positive",
  bounced: "negative",
  complained: "negative",
  skipped: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTones[status] ?? "neutral"}>{status}</Badge>;
}

export function StatTile({
  label,
  value,
  sub,
  swatch,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Ties the tile to its series color in the chart. */
  swatch?: string;
}) {
  return (
    <div className="rounded-(--radius-card) border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        {swatch ? (
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: swatch }}
          />
        ) : null}
        <span className="text-[12px] font-medium text-ink-muted">{label}</span>
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[12px] text-ink-muted">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-[13px] text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      {/* The last row sits flush with the card edge, like Linear's lists. */}
      <table className="w-full border-collapse text-[13px] [&_tbody_tr:last-child_td]:border-b-0">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        "border-b border-line px-5 py-2 text-left text-[11.5px] font-normal text-ink-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cx("border-b border-line px-5 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}

const calloutTones = {
  info: "border-accent/20 bg-accent-soft text-accent",
  warning: "border-warning/20 bg-warning-soft text-warning",
  danger: "border-negative/20 bg-negative-soft text-negative",
  positive: "border-positive/20 bg-positive-soft text-positive",
};

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof calloutTones;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed",
        calloutTones[tone],
      )}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-canvas px-1.5 py-0.5 font-mono text-[12px] text-ink-soft">
      {children}
    </code>
  );
}
