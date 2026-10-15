import { testSesAction, updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Card,
  CardHeader,
  Content,
  Field,
  Input,
  Select,
} from "@/components/shell";
import { requireProject } from "@/lib/projects";
import { SES_REGIONS } from "@/lib/regions";

export const instant = false;

export default async function SesSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/ses">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-2xl space-y-5">
      <Card>
        <CardHeader
          title="Amazon SES"
          description="The IAM credentials this project sends with. The secret is encrypted before it is stored."
        />
        <ActionForm action={updateProjectAction} className="space-y-4 p-5">
          <input type="hidden" name="slug" value={slug} />

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="SES region">
              <Select name="sesRegion" defaultValue={project.sesRegion}>
                {SES_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Configuration set"
              hint="Required for bounce, complaint, open and click events."
            >
              <Input
                name="sesConfigurationSet"
                defaultValue={project.sesConfigurationSet ?? ""}
                placeholder="mails-events"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Access key id">
              <Input
                name="sesAccessKeyId"
                defaultValue={project.sesAccessKeyId ?? ""}
                placeholder="AKIA…"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Secret access key"
              hint={
                project.sesSecretKey
                  ? "A key is stored. Leave empty to keep it."
                  : "Encrypted with ENCRYPTION_KEY before it is stored."
              }
            >
              <Input
                name="sesSecretKey"
                type="password"
                placeholder={project.sesSecretKey ? "••••••••" : ""}
                autoComplete="off"
              />
            </Field>
          </div>

          <Field
            label="Max send rate"
            hint="Messages per second. Keep it at or below your SES quota."
          >
            <Input
              name="sendRate"
              type="number"
              min={1}
              defaultValue={project.sendRate}
              className="max-w-32"
            />
          </Field>

          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader
          title="Connection"
          description="Checks the credentials against the SES account API and reports your quota."
        />
        <ActionForm action={testSesAction} className="space-y-3 p-5">
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton variant="secondary">Test connection</SubmitButton>
        </ActionForm>
      </Card>
    </Content>
  );
}
