"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, Plus } from "lucide-react";
import { createProjectAction } from "@/app/actions/projects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SubmitButton } from "./client";
import { Modal, ModalCancel, ModalForm } from "./modal";
import { Field, Input, Select } from "./shell";
import { SES_REGIONS } from "@/lib/regions";

export interface SidebarProject {
  id: string;
  name: string;
  slug: string;
}

/**
 * Project picker. Radix owns the open state, so it closes on an outside
 * click, on Escape and on selection — which a <details> element never did.
 */
export function ProjectSwitcher({
  projects,
  currentSlug,
}: {
  projects: SidebarProject[];
  currentSlug: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const current = projects.find((project) => project.slug === currentSlug);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-hover">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-ink text-[11px] font-semibold text-white">
            {(current?.name ?? "M").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
            {current?.name ?? "Select a project"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-ink-muted" strokeWidth={1.75} />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[204px]">
          {projects.map((project) => (
            <DropdownMenuItem key={project.id} asChild>
              <Link href={`/p/${project.slug}`} className="truncate">
                {project.name}
              </Link>
            </DropdownMenuItem>
          ))}
          {projects.length ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            onSelect={(event) => {
              // Radix would unmount the dialog with the menu, so close the
              // menu by hand and open the dialog after it.
              event.preventDefault();
              setMenuOpen(false);
              setCreating(true);
            }}
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title="New project"
        description="One project per product you send email for — its own SES identity, contacts and API keys."
      >
        <ModalForm action={createProjectAction} className="space-y-3">
          <Field label="Project name" hint="Shown in the sidebar and email footers.">
            <Input name="name" placeholder="Acme Analytics" required autoFocus />
          </Field>
          <Field label="From address" hint="You can change this later in settings.">
            <Input name="fromEmail" type="email" placeholder="hello@acme.com" />
          </Field>
          <Field label="Sending domain" hint="Used for DKIM, SPF and DMARC checks.">
            <Input name="sendingDomain" placeholder="acme.com" />
          </Field>
          <Field label="Amazon SES region">
            <Select name="sesRegion" defaultValue="us-east-1">
              {SES_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2 pt-1">
            <SubmitButton>Create project</SubmitButton>
            <ModalCancel />
          </div>
        </ModalForm>
      </Modal>
    </>
  );
}
