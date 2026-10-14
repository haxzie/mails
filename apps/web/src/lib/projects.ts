import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { projects, type Project, type User } from "@mails/db/schema";
import { getDb } from "./cloudflare";
import { requireUser } from "./session";

export async function listProjects(userId: string): Promise<Project[]> {
  const db = await getDb();
  return db.query.projects.findMany({
    where: eq(projects.userId, userId),
    orderBy: asc(projects.createdAt),
  });
}

export interface ProjectContext {
  user: User;
  project: Project;
}

/** Loads a project the signed-in user owns, or 404s. */
export async function requireProject(slug: string): Promise<ProjectContext> {
  const user = await requireUser();
  const db = await getDb();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), eq(projects.userId, user.id)),
  });
  if (!project) notFound();
  return { user, project };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}
