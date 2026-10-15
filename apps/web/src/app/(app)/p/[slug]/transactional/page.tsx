import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { transactionals } from "@mails/db/schema";
import { createTransactionalAction } from "@/app/actions/transactional";
import { SubmitButton } from "@/components/client";
import { ModalButton, ModalCancel, ModalForm } from "@/components/modal";
import {
  Badge,
  EmptyState,
  Field,
  Input,
  Mono,
  Table,
  Td,
  Th,
  TopBar,
} from "@/components/shell";
import { getDb, getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function TransactionalPage({
  params,
}: PageProps<"/p/[slug]/transactional">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();
  const env = await getEnv();
  const rows = await db.query.transactionals.findMany({
    where: eq(transactionals.projectId, project.id),
    orderBy: desc(transactionals.createdAt),
  });

  return (
    <>
      <TopBar
        title="Transactional"
        description="Templates your product triggers over the API"
        action={
          <>
          <ModalButton
            label="Trigger example"
            title="Trigger an event"
            description="Call this from your backend with a project API key."
            variant="secondary"
            width="md"
          >
            <pre className="overflow-x-auto rounded-lg bg-canvas px-3 py-3 font-mono text-[11.5px] leading-relaxed text-ink-soft">
{`curl -X POST ${env.API_URL}/v1/events \\
  -H "Authorization: Bearer $MAILS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "event": "user.signup",
    "email": "ada@example.com",
    "contact": { "firstName": "Ada" },
    "data": { "plan": "pro" }
  }'`}
            </pre>
          </ModalButton>
          <ModalButton
            label="New template"
            title="New transactional email"
            description="Pick the event your backend will post to trigger it."
            icon={<Plus className="size-3.5" strokeWidth={2} />}
          >
            <ModalForm action={createTransactionalAction} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Name">
                <Input name="name" placeholder="Welcome email" required autoFocus />
              </Field>
              <Field
                label="Event name"
                hint="Your app posts this string to /v1/events."
              >
                <Input name="event" placeholder="user.signup" required />
              </Field>
              <div className="flex gap-2 pt-1">
                <SubmitButton>Create template</SubmitButton>
                <ModalCancel />
              </div>
            </ModalForm>
          </ModalButton>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No transactional emails yet"
          description="Create one, give it an event name, then post that event from your app."
        />
      ) : (
        <Table hover flush>
          <thead>
            <tr>
              <Th>Template</Th>
              <Th>Event</Th>
              <Th className="text-right">State</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((template) => (
              <tr key={template.id}>
                <Td>
                  <Link
                    href={`/p/${slug}/transactional/${template.id}`}
                    className="font-medium hover:underline"
                  >
                    {template.name}
                  </Link>
                  <p className="text-[12px] text-ink-muted">
                    {template.subject || "No subject"}
                  </p>
                </Td>
                <Td>
                  <Mono>{template.event}</Mono>
                </Td>
                <Td className="text-right">
                  {template.enabled ? (
                    <Badge tone="positive">enabled</Badge>
                  ) : (
                    <Badge>paused</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

    </>
  );
}
