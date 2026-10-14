import { redirect } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/session";

export const instant = false;

export default async function RootPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const projects = await listProjects(user.id);
  if (projects.length === 0) redirect("/projects/new");
  redirect(`/p/${projects[0]!.slug}`);
}
