import { updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, CardHeader, Checkbox, Content } from "@/components/shell";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function TrackingSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/tracking">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-2xl space-y-5">
      <Card>
        <CardHeader
          title="Tracking"
          description="Both are measured by this app, independently of the SES open and click events."
        />
        <ActionForm action={updateProjectAction} className="space-y-4 p-5">
          <input type="hidden" name="slug" value={slug} />
          {/* Unchecked boxes are not submitted; these carry the "off" state. */}
          <input type="hidden" name="trackOpens" value="off" />
          <input type="hidden" name="trackClicks" value="off" />

          <label className="flex items-start gap-2.5 text-[13px]">
            <Checkbox
              name="trackOpens"
              defaultChecked={project.trackOpens}
              className="mt-0.5"
            />
            <span>
              Track opens
              <span className="block text-[12px] text-ink-muted">
                Adds a 1×1 pixel to the HTML part. Blocked by Apple Mail
                Privacy Protection, so treat open rates as directional.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-[13px]">
            <Checkbox
              name="trackClicks"
              defaultChecked={project.trackClicks}
              className="mt-0.5"
            />
            <span>
              Track clicks
              <span className="block text-[12px] text-ink-muted">
                Rewrites links through a signed redirect. The unsubscribe link
                is never rewritten.
              </span>
            </span>
          </label>

          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </Card>
    </Content>
  );
}
