import { Sidebar } from "@/components/sidebar";
import { listProjects } from "@/lib/projects";
import { requireUser } from "@/lib/session";

// The whole dashboard is per-user and read at request time, so it blocks on
// the server instead of prerendering a static shell.
export const instant = false;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const projects = await listProjects(user.id);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar
        email={user.email}
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          slug: project.slug,
        }))}
      />
      {/* The content panel floats over the tinted page background. */}
      <main className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-line bg-surface shadow-[0_1px_3px_rgba(20,20,30,0.04)] md:my-2 md:mr-2">
        {children}
      </main>
    </div>
  );
}
