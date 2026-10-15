"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AtSign,
  Building2,
  Cloud,
  Globe,
  MousePointerClick,
  TriangleAlert,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./shell";

const SECTIONS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
}> = [
  { href: "", label: "General", icon: Building2 },
  { href: "/identity", label: "Sending identity", icon: AtSign },
  { href: "/ses", label: "Amazon SES", icon: Cloud },
  { href: "/domain", label: "Domain & DNS", icon: Globe },
  { href: "/tracking", label: "Tracking", icon: MousePointerClick },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/danger", label: "Danger zone", icon: TriangleAlert, danger: true },
];

export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/p/${slug}/settings`;

  return (
    <nav className="w-[200px] shrink-0 border-r border-line p-3">
      <div className="sticky top-[60px] space-y-px">
        {SECTIONS.map((section) => {
          const href = `${base}${section.href}`;
          const active = pathname === href;
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-active font-medium text-ink"
                  : "text-ink-soft hover:bg-hover hover:text-ink",
                section.danger && !active && "text-negative/80 hover:text-negative",
              )}
            >
              <Icon
                className={cx(
                  "size-4 shrink-0",
                  active ? "text-ink" : section.danger ? "text-negative/70" : "text-ink-muted",
                )}
                strokeWidth={1.75}
              />
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
