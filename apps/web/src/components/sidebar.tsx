"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  KeyRound,
  LayoutGrid,
  LogOut,
  Plus,
  ScrollText,
  Send,
  Settings,
  SquareTerminal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cx } from "./ui";

export interface SidebarProject {
  id: string;
  name: string;
  slug: string;
}

const NAV: Array<{ href: string; label: string; icon: LucideIcon; exact?: boolean }> =
  [
    { href: "", label: "Dashboard", icon: LayoutGrid, exact: true },
    { href: "/campaigns", label: "Campaigns", icon: Send },
    { href: "/contacts", label: "Contacts", icon: Users },
    { href: "/transactional", label: "Transactional", icon: SquareTerminal },
    { href: "/logs", label: "Logs", icon: ScrollText },
    { href: "/api", label: "API & keys", icon: KeyRound },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

export function Sidebar({
  projects,
  email,
}: {
  projects: SidebarProject[];
  email: string;
}) {
  const pathname = usePathname();
  const match = /^\/p\/([^/]+)/.exec(pathname);
  const slug = match?.[1] ?? projects[0]?.slug ?? null;
  const current = projects.find((project) => project.slug === slug);

  return (
    <aside className="flex w-[228px] shrink-0 flex-col">
      <div className="px-3 pt-3">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-hover">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-ink text-[11px] font-semibold text-white">
              {(current?.name ?? "M").slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
              {current?.name ?? "Select a project"}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-ink-muted" strokeWidth={1.75} />
          </summary>
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/p/${project.slug}`}
                className={cx(
                  "block truncate rounded-lg px-2.5 py-1.5 text-[13px]",
                  project.slug === slug
                    ? "bg-active font-medium"
                    : "text-ink-soft hover:bg-hover",
                )}
              >
                {project.name}
              </Link>
            ))}
            <Link
              href="/projects/new"
              className="mt-1 flex items-center gap-1.5 rounded-lg border-t border-line px-2.5 py-1.5 text-[13px] text-ink-soft hover:bg-hover"
            >
              <Plus className="size-3.5" strokeWidth={1.75} />
              New project
            </Link>
          </div>
        </details>
      </div>

      {slug ? (
        <nav className="mt-3 flex-1 space-y-px px-3">
          {NAV.map((item) => (
            <SidebarLink
              key={item.href}
              href={`/p/${slug}${item.href}`}
              icon={item.icon}
              exact={item.exact}
            >
              {item.label}
            </SidebarLink>
          ))}
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      <div className="p-3">
        <p className="truncate px-2 pb-1.5 text-[11.5px] text-ink-muted">{email}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] text-ink-soft transition-colors hover:bg-hover hover:text-ink"
          >
            <LogOut className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  exact,
  children,
}: {
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] transition-colors",
        active
          ? "bg-active font-medium text-ink"
          : "text-ink-soft hover:bg-hover hover:text-ink",
      )}
    >
      <Icon
        className={cx("size-4 shrink-0", active ? "text-ink" : "text-ink-muted")}
        strokeWidth={1.75}
      />
      {children}
    </Link>
  );
}
