import { count, eq } from "drizzle-orm";
import { campaigns, contacts, emails } from "@mails/db/schema";
import { deleteProjectAction } from "@/app/actions/projects";
import { SubmitButton } from "@/components/client";
import { Content, SettingRow, SettingsSection } from "@/components/shell";
import { getDb } from "@/lib/cloudflare";
import { formatNumber, requireProject } from "@/lib/projects";

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
    <Content className="max-w-3xl space-y-7">
      <SettingsSection
        title="Danger zone"
        description="Irreversible, and not limited to this screen's settings."
      >
        <SettingRow
          label={`Delete ${project.name}`}
          description={`Removes ${formatNumber(
            contactCount?.value ?? 0,
          )} contact(s), ${formatNumber(
            campaignCount?.value ?? 0,
          )} campaign(s) and ${formatNumber(
            emailCount?.value ?? 0,
          )} message log(s). The suppression list goes too, so addresses that unsubscribed would be mailable again if you recreate the project.`}
          control="w-auto"
        >
          <form action={deleteProjectAction}>
            <input type="hidden" name="slug" value={slug} />
            <SubmitButton
              variant="danger"
              size="sm"
              confirm={`Delete “${project.name}” and everything in it?`}
            >
              Delete project
            </SubmitButton>
          </form>
        </SettingRow>
      </SettingsSection>
    </Content>
  );
}
