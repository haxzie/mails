import { deleteProjectAction } from "@/app/actions/projects";
import { SubmitButton } from "@/components/client";
import { Card, CardHeader, Content } from "@/components/shell";
import { formatNumber, requireProject } from "@/lib/projects";
import { getDb } from "@/lib/cloudflare";
import { contacts, campaigns, emails } from "@mails/db/schema";
import { count, eq } from "drizzle-orm";

export const instant = false;

export default async function DangerSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/danger">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();

  const [[contactCount], [campaignCount], [emailCount]] = await Promise.all([
    db.select({ value: count() }).from(contacts).where(eq(contacts.projectId, project.id)),
    db.select({ value: count() }).from(campaigns).where(eq(campaigns.projectId, project.id)),
    db.select({ value: count() }).from(emails).where(eq(emails.projectId, project.id)),
  ]);

  return (
    <Content className="max-w-2xl space-y-5">
      <Card>
        <CardHeader
          title="Delete project"
          description="This cannot be undone. Suppression lists go with it, so previously unsubscribed addresses would be mailable again if you recreate the project."
        />
        <div className="space-y-4 p-5">
          <p className="text-[13px] text-ink-soft">
            Deleting <span className="font-medium text-ink">{project.name}</span>{" "}
            removes {formatNumber(contactCount?.value ?? 0)} contact(s),{" "}
            {formatNumber(campaignCount?.value ?? 0)} campaign(s) and{" "}
            {formatNumber(emailCount?.value ?? 0)} message log(s).
          </p>
          <form action={deleteProjectAction}>
            <input type="hidden" name="slug" value={slug} />
            <SubmitButton
              variant="danger"
              confirm={`Delete “${project.name}” and everything in it?`}
            >
              Delete project
            </SubmitButton>
          </form>
        </div>
      </Card>
    </Content>
  );
}
