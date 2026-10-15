import { updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Content,
  Input,
  SettingRow,
  SettingsSection,
} from "@/components/shell";
import { requireProject } from "@/lib/projects";

export default async function GeneralSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-3xl space-y-7">
      <ActionForm action={updateProjectAction}>
        <input type="hidden" name="slug" value={slug} />
        <SettingsSection
          title="General"
          description="What this project is called and where you can be reached."
          footer={<SubmitButton size="sm">Save changes</SubmitButton>}
        >
          <SettingRow
            label="Project name"
            description="Shown in the sidebar and in the footer of your email."
          >
            <Input name="name" defaultValue={project.name} required />
          </SettingRow>

          <SettingRow
            label="URL slug"
            description="Fixed once the project is created."
          >
            <Input defaultValue={project.slug} disabled />
          </SettingRow>

          <SettingRow
            label="Postal address"
            description="Rendered in the footer of bulk email. CAN-SPAM requires a physical mailing address."
            stacked
          >
            <Input
              name="postalAddress"
              defaultValue={project.postalAddress ?? ""}
              placeholder="Acme Inc, 1 Market St, San Francisco, CA 94105"
            />
          </SettingRow>
        </SettingsSection>
      </ActionForm>
    </Content>
  );
}
