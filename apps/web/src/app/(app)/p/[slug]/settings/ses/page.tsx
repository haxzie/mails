import { testSesAction, updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Content,
  Input,
  Select,
  SettingRow,
  SettingsSection,
} from "@/components/shell";
import { requireProject } from "@/lib/projects";
import { SES_REGIONS } from "@/lib/regions";

export default async function SesSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/ses">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-3xl space-y-7">
      <ActionForm action={updateProjectAction}>
        <input type="hidden" name="slug" value={slug} />
        <SettingsSection
          title="Amazon SES"
          description="The IAM credentials this project sends with. The secret is encrypted before it is stored."
          footer={<SubmitButton size="sm">Save changes</SubmitButton>}
        >
          <SettingRow
            label="Region"
            description="Where your SES identity lives."
          >
            <Select name="sesRegion" defaultValue={project.sesRegion}>
              {SES_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow
            label="Configuration set"
            description="Required for bounce, complaint, open and click events to reach the webhook."
          >
            <Input
              name="sesConfigurationSet"
              defaultValue={project.sesConfigurationSet ?? ""}
              placeholder="mails-events"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              spellCheck={false}
            />
          </SettingRow>

          <SettingRow
            label="Access key id"
            description="An IAM user with ses:SendEmail and the identity read permissions."
          >
            <Input
              name="sesAccessKeyId"
              defaultValue={project.sesAccessKeyId ?? ""}
              placeholder="AKIA…"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              spellCheck={false}
            />
          </SettingRow>

          <SettingRow
            label="Secret access key"
            description={
              project.sesSecretKey
                ? "A key is stored. Leave this empty to keep it."
                : "Encrypted with ENCRYPTION_KEY before it is stored."
            }
          >
            <Input
              name="sesSecretKey"
              type="password"
              placeholder={project.sesSecretKey ? "••••••••" : ""}
              // "new-password" is what keeps Chrome from offering a saved
              // login here; plain "off" is ignored for password inputs.
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
            />
          </SettingRow>

          <SettingRow
            label="Max send rate"
            description="Messages per second handed to SES. Keep it at or below your account quota."
            control="w-[120px]"
          >
            <Input
              name="sendRate"
              type="number"
              min={1}
              defaultValue={project.sendRate}
            />
          </SettingRow>
        </SettingsSection>
      </ActionForm>

      <ActionForm action={testSesAction}>
        <input type="hidden" name="slug" value={slug} />
        <SettingsSection title="Connection">
          <SettingRow
            label="Test credentials"
            description="Calls the SES account API and reports your sending quota and whether you are out of the sandbox."
            control="w-auto"
          >
            <SubmitButton variant="secondary" size="sm">
              Test connection
            </SubmitButton>
          </SettingRow>
        </SettingsSection>
      </ActionForm>
    </Content>
  );
}
