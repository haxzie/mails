import { updateProjectAction } from "@/app/actions/projects";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, CardHeader, Content, Field, Input } from "@/components/shell";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function GeneralSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <Content className="max-w-2xl space-y-5">
      <Card>
        <CardHeader
          title="General"
          description="What this project is called and where you can be reached."
        />
        <ActionForm action={updateProjectAction} className="space-y-4 p-5">
          <input type="hidden" name="slug" value={slug} />

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Project name">
              <Input name="name" defaultValue={project.name} required />
            </Field>
            <Field label="URL slug" hint="Fixed once the project is created.">
              <Input defaultValue={project.slug} disabled />
            </Field>
          </div>

          <Field
            label="Postal address"
            hint="Rendered in the footer of bulk email. CAN-SPAM requires a physical mailing address."
          >
            <Input
              name="postalAddress"
              defaultValue={project.postalAddress ?? ""}
              placeholder="Acme Inc, 1 Market St, San Francisco, CA 94105"
            />
          </Field>

          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </Card>
    </Content>
  );
}
