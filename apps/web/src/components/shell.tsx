import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button as ShadButton, buttonVariants } from "@/components/ui/button";
import { Checkbox as ShadCheckbox } from "@/components/ui/checkbox";
import { Input as ShadInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea as ShadTextarea } from "@/components/ui/textarea";

/** Alias kept so existing call sites don't all have to change. */
export const cx = cn;

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md";

/** Maps our semantic names onto the shadcn button variants. */
const VARIANTS: Record<Variant, "default" | "outline" | "ghost" | "destructive"> =
  {
    primary: "default",
    accent: "default",
    secondary: "outline",
    ghost: "ghost",
    danger: "destructive",
  };

const SIZES: Record<Size, "sm" | "default"> = { sm: "sm", md: "default" };

export type ButtonVariant = Variant;

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(
    buttonVariants({ variant: VARIANTS[variant], size: SIZES[size] }),
    variant === "accent" && "bg-brand text-white hover:bg-brand/90",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: Omit<ComponentProps<typeof ShadButton>, "variant" | "size"> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <ShadButton
      variant={VARIANTS[variant]}
      size={SIZES[size]}
      className={cn(
        variant === "accent" && "bg-brand text-white hover:bg-brand/90",
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
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

/**
 * The secondary bar under the top bar: filter tabs on the left, an optional
 * control (search, sort) on the right.
 */
export function FilterBar({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-10 items-center gap-1 border-b border-line px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {children}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** One tab inside a <FilterBar>. */
export function FilterTab({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active?: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] transition-colors",
        active
          ? "bg-active font-medium text-ink"
          : "text-ink-muted hover:bg-hover hover:text-ink",
      )}
    >
      {children}
      {count === undefined ? null : (
        <span className="tabular-nums text-ink-muted">{count}</span>
      )}
    </a>
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
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-[12.5px] text-ink-soft">{label}</Label>
      {children}
      {hint ? <p className="text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <ShadInput className={cn("h-9 text-[13.5px]", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <ShadTextarea className={cn("text-[13.5px]", className)} {...props} />;
}

/**
 * A native <select>, styled like the shadcn input. Server actions read it
 * straight out of the submitted FormData, which the Radix select can only
 * do through a hidden mirror.
 */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-9 w-full appearance-none rounded-lg border border-input bg-surface bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22%238a8d98%22%20stroke-width%3D%221.5%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_0.6rem_center] bg-no-repeat px-2.5 py-1 pr-8 text-[13.5px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof ShadCheckbox>) {
  return <ShadCheckbox className={cn(className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-canvas text-ink-soft border-line",
  accent: "bg-brand-soft text-brand border-brand/15",
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

export function Table({
  children,
  hover = false,
  flush = false,
}: {
  children: ReactNode;
  /** Highlights rows on hover, for lists whose rows open something. */
  hover?: boolean;
  /** Keeps the last row's divider, for full-width lists that end the page. */
  flush?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cx(
          "w-full border-collapse text-[13px]",
          // The last row sits flush with the card edge, like Linear's lists.
          flush ? "" : "[&_tbody_tr:last-child_td]:border-b-0",
          hover ? "[&_tbody_tr:hover]:bg-hover" : "",
        )}
      >
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
  info: "border-brand/20 bg-brand-soft text-brand",
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
