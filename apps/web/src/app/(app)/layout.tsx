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
    <div className="flex min-h-dvh">
      <Sidebar
        email={user.email}
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          slug: project.slug,
        }))}
      />
      <main className="min-w-0 flex-1 px-8 py-7">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
