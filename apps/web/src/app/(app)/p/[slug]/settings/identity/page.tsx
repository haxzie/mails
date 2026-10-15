import { updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, CardHeader, Content, Field, Input } from "@/components/shell";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function IdentitySettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/identity">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-2xl space-y-5">
      <Card>
        <CardHeader
          title="Sending identity"
          description="Who your email appears to come from. Used for every campaign and transactional send."
        />
        <ActionForm action={updateProjectAction} className="space-y-4 p-5">
          <input type="hidden" name="slug" value={slug} />

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="From name">
              <Input
                name="fromName"
                defaultValue={project.fromName}
                placeholder={project.name}
              />
            </Field>
            <Field label="From email" hint="Must be a verified SES identity.">
              <Input
                name="fromEmail"
                type="email"
                defaultValue={project.fromEmail}
                placeholder="hello@acme.com"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Reply-to" hint="Optional. Where replies should land.">
              <Input
                name="replyTo"
                type="email"
                defaultValue={project.replyTo ?? ""}
              />
            </Field>
            <Field
              label="Sending domain"
              hint="Used for DKIM, SPF alignment and the unsubscribe mailbox."
            >
              <Input
                name="sendingDomain"
                defaultValue={project.sendingDomain ?? ""}
                placeholder="acme.com"
              />
            </Field>
          </div>

          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </Card>
    </Content>
  );
}
