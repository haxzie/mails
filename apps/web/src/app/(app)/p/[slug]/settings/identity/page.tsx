import { updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Content,
  Input,
  SettingRow,
  SettingsSection,
} from "@/components/shell";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function IdentitySettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/identity">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-3xl space-y-7">
      <ActionForm action={updateProjectAction}>
        <input type="hidden" name="slug" value={slug} />
        <SettingsSection
          title="Sending identity"
          description="Who your email appears to come from, for campaigns and transactional alike."
          footer={<SubmitButton size="sm">Save changes</SubmitButton>}
        >
          <SettingRow
            label="From name"
            description="The display name beside your address in the inbox."
          >
            <Input
              name="fromName"
              defaultValue={project.fromName}
              placeholder={project.name}
            />
          </SettingRow>

          <SettingRow
            label="From email"
            description="Must be an identity you have verified in Amazon SES."
          >
            <Input
              name="fromEmail"
              type="email"
              defaultValue={project.fromEmail}
              placeholder="hello@acme.com"
            />
          </SettingRow>

          <SettingRow
            label="Reply-to"
            description="Optional. Where replies land if it is not the From address."
          >
            <Input
              name="replyTo"
              type="email"
              defaultValue={project.replyTo ?? ""}
            />
          </SettingRow>

          <SettingRow
            label="Sending domain"
            description="Used for DKIM, SPF alignment and the unsubscribe mailbox."
          >
            <Input
              name="sendingDomain"
              defaultValue={project.sendingDomain ?? ""}
              placeholder="acme.com"
            />
          </SettingRow>
        </SettingsSection>
      </ActionForm>
    </Content>
  );
}
