"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { NavLink, SubmitButton } from "./client";
import { cx } from "./ui";

export interface SidebarProject {
  id: string;
  name: string;
  slug: string;
}

const NAV = [
  { href: "", label: "Dashboard", exact: true },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/contacts", label: "Contacts" },
  { href: "/transactional", label: "Transactional" },
  { href: "/logs", label: "Logs" },
  { href: "/api", label: "API & keys" },
  { href: "/settings", label: "Settings" },
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
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-3 py-3">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-canvas">
            <span className="grid size-6 place-items-center rounded-md bg-ink text-[11px] font-semibold text-white">
              {(current?.name ?? "M").slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
              {current?.name ?? "Select a project"}
            </span>
            <span aria-hidden className="text-ink-muted">
              ⌄
            </span>
          </summary>
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/p/${project.slug}`}
                className={cx(
                  "block truncate rounded-lg px-2.5 py-1.5 text-[13px]",
                  project.slug === slug
                    ? "bg-canvas font-medium"
                    : "text-ink-soft hover:bg-canvas",
                )}
              >
                {project.name}
              </Link>
            ))}
            <Link
              href="/projects/new"
              className="mt-1 block rounded-lg border-t border-line px-2.5 py-1.5 text-[13px] text-accent"
            >
              New project
            </Link>
          </div>
        </details>
      </div>

      {slug ? (
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={`/p/${slug}${item.href}`}
              exact={item.exact}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      <div className="border-t border-line p-3">
        <p className="truncate px-2 pb-2 text-[12px] text-ink-muted">{email}</p>
        <form action={logoutAction}>
          <SubmitButton variant="ghost" size="sm" className="w-full justify-start">
            Sign out
          </SubmitButton>
        </form>
      </div>
    </aside>
  );
}
