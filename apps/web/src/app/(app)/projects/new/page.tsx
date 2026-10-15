import { createProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Content, Field, Input, Select, TopBar } from "@/components/ui";
import { SES_REGIONS } from "@/lib/regions";

export const instant = false;

export default function NewProjectPage() {
  return (
    <>
      <TopBar
        title="New project"
        description="One project per product you send email for — its own SES identity, contacts and API keys."
      />
      <Content>
      <Card className="max-w-xl p-5">
        <ActionForm action={createProjectAction} className="space-y-4">
          <Field label="Project name" hint="Shown in the sidebar and email footers.">
            <Input name="name" placeholder="Acme Analytics" required autoFocus />
          </Field>
          <Field
            label="From address"
            hint="The address your email is sent from. You can change it later."
          >
            <Input
              name="fromEmail"
              type="email"
              placeholder="hello@acme.com"
            />
          </Field>
          <Field label="Sending domain" hint="Used for DKIM, SPF and DMARC checks.">
            <Input name="sendingDomain" placeholder="acme.com" />
          </Field>
          <Field label="Amazon SES region">
            <Select name="sesRegion" defaultValue="us-east-1">
              {SES_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton>Create project</SubmitButton>
        </ActionForm>
      </Card>
      </Content>
    </>
  );
}
