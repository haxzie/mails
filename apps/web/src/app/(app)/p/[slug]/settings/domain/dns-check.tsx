import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import {
  analyzeDomainDns,
  fetchDomainDns,
  type BimiConfig,
  type DnsFinding,
} from "@mails/core";
import { cx } from "@/components/shell";

const LEVELS: Record<
  DnsFinding["level"],
  { icon: typeof CircleCheck; className: string }
> = {
  ok: { icon: CircleCheck, className: "text-positive" },
  warning: { icon: TriangleAlert, className: "text-warning" },
  error: { icon: CircleAlert, className: "text-negative" },
};

/**
 * Reads what the domain actually publishes right now and reports on it.
 * Rendered inside a Suspense boundary: it makes live DNS queries.
 */
export async function DnsCheck({
  domain,
  dkimTokens,
  bimi,
}: {
  domain: string;
  dkimTokens: string[];
  bimi: BimiConfig;
}) {
  const snapshot = await fetchDomainDns(domain, dkimTokens);
  const findings = analyzeDomainDns(domain, snapshot, bimi);

  return (
    <ul className="divide-y divide-line">
      {findings.map((finding) => {
        const { icon: Icon, className } = LEVELS[finding.level];
        return (
          <li key={finding.title} className="flex gap-2.5 px-4 py-3">
            <Icon
              className={cx("mt-px size-4 shrink-0", className)}
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{finding.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed break-words text-ink-muted">
                {finding.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DnsCheckSkeleton() {
  return (
    <div className="space-y-2 px-4 py-3.5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-3 animate-pulse rounded bg-canvas" />
      ))}
    </div>
  );
}
