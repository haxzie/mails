import { updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Content,
  SettingRow,
  SettingsSection,
  Switch,
} from "@/components/shell";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function TrackingSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/tracking">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-3xl space-y-7">
      <ActionForm action={updateProjectAction}>
        <input type="hidden" name="slug" value={slug} />
        {/* Switches that are off submit nothing, so each ships an "off". */}
        <input type="hidden" name="trackOpens" value="off" />
        <input type="hidden" name="trackClicks" value="off" />

        <SettingsSection
          title="Tracking"
          description="Measured by this app, independently of the SES open and click events."
          footer={<SubmitButton size="sm">Save changes</SubmitButton>}
        >
          <SettingRow
            label="Track opens"
            description="Adds a 1×1 pixel to the HTML part. Blocked by Apple Mail Privacy Protection, so treat open rates as directional."
            control="w-auto"
          >
            <Switch name="trackOpens" defaultChecked={project.trackOpens} />
          </SettingRow>

          <SettingRow
            label="Track clicks"
            description="Rewrites links through a signed redirect. The unsubscribe link is never rewritten."
            control="w-auto"
          >
            <Switch name="trackClicks" defaultChecked={project.trackClicks} />
          </SettingRow>
        </SettingsSection>
      </ActionForm>
    </Content>
  );
}
