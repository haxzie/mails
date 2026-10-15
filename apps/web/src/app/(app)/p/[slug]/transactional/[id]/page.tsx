import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { transactionals } from "@mails/db/schema";
import {
  deleteTransactionalAction,
  saveTransactionalAction,
  testTransactionalAction,
} from "@/app/actions/transactional";
import { ActionForm, SubmitButton } from "@/components/client";
import { HtmlEditor } from "@/components/editor";
import { ModalButton, ModalCancel, ModalForm } from "@/components/modal";
import {
  Callout,
  Card,
  CardHeader,
  Checkbox,
  Content,
  Field,
  Input,
  Textarea,
  TopBar,
} from "@/components/shell";
import { getDb, getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function TransactionalDetailPage({
  params,
}: PageProps<"/p/[slug]/transactional/[id]">) {
  const { slug, id } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();
  const env = await getEnv();

  const template = await db.query.transactionals.findFirst({
    where: and(
      eq(transactionals.id, id),
      eq(transactionals.projectId, project.id),
    ),
  });
  if (!template) notFound();

  return (
    <>
      <TopBar
        title={template.name}
        description={`Triggered by “${template.event}”`}
        action={
          <>
            <form action={deleteTransactionalAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={template.id} />
              <SubmitButton
                variant="ghost"
                size="sm"
                confirm={`Delete “${template.name}”?`}
              >
                Delete
              </SubmitButton>
            </form>

            <ModalButton
              label="Trigger example"
              title="Trigger this template"
              variant="secondary"
              width="md"
            >
              <pre className="overflow-x-auto rounded-lg bg-canvas px-3 py-3 font-mono text-[11.5px] leading-relaxed text-ink-soft">
{`curl -X POST ${env.API_URL}/v1/events \\
  -H "Authorization: Bearer $MAILS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"event":"${template.event}","email":"ada@example.com"}'`}
              </pre>
            </ModalButton>

            <ModalButton
              label="Send test"
              title="Send a test"
              description="Rendered with empty merge data unless the contact exists."
            >
              <ModalForm action={testTransactionalAction} className="space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={template.id} />
                <Field label="Test recipient">
                  <Input
                    name="to"
                    type="email"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </Field>
                <div className="flex gap-2 pt-1">
                  <SubmitButton>Send test</SubmitButton>
                  <ModalCancel />
                </div>
              </ModalForm>
            </ModalButton>
          </>
        }
      />

      <Content className="space-y-5">
        {template.ignoreUnsubscribes ? (
          <Callout tone="warning" title="No unsubscribe link">
            This template skips consent checks and is sent without an
            unsubscribe footer. Only use it for mail a user asked for.
          </Callout>
        ) : null}

        <Card>
          <CardHeader title="Content" />
          <ActionForm action={saveTransactionalAction} className="space-y-4 p-5">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={template.id} />

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name">
                <Input name="name" defaultValue={template.name} />
              </Field>
              <Field label="Event" hint="Lowercase, dotted, e.g. user.signup">
                <Input name="event" defaultValue={template.event} />
              </Field>
            </div>

            <Field label="Subject line">
              <Input name="subject" defaultValue={template.subject} />
            </Field>

            <div>
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">
                HTML body
              </span>
              <HtmlEditor name="html" defaultValue={template.html} rows={14} />
            </div>

            <Field
              label="Plain text version"
              hint="Generated from the HTML when empty."
            >
              <Textarea
                name="text"
                rows={4}
                className="code"
                defaultValue={template.text ?? ""}
              />
            </Field>

            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox name="enabled" defaultChecked={template.enabled} />
              Enabled — events for this template are sent
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox
                name="ignoreUnsubscribes"
                defaultChecked={template.ignoreUnsubscribes}
              />
              Send even to unsubscribed contacts (receipts and password resets
              only)
            </label>

            <SubmitButton>Save changes</SubmitButton>
          </ActionForm>
        </Card>
      </Content>
    </>
  );
}
