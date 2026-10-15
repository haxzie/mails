import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { transactionals } from "@mails/db/schema";
import { createTransactionalAction } from "@/app/actions/transactional";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Badge,
  Card,
  CardHeader,
  Content,
  EmptyState,
  Field,
  Input,
  Mono,
  Table,
  Td,
  Th,
  TopBar,
} from "@/components/ui";
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
      />

      <Content className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Templates" />
          {rows.length === 0 ? (
            <EmptyState
              title="No transactional emails yet"
              description="Create one, give it an event name, then POST that event from your app."
            />
          ) : (
            <Table>
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
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="New template" />
            <ActionForm action={createTransactionalAction} className="space-y-3 p-5">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Name">
                <Input name="name" placeholder="Welcome email" required />
              </Field>
              <Field
                label="Event name"
                hint="Your app posts this string to /v1/events."
              >
                <Input name="event" placeholder="user.signup" required />
              </Field>
              <SubmitButton>Create template</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Trigger it" description="From your own backend." />
            <pre className="overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-relaxed text-ink-soft">
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
          </Card>
        </div>
      </Content>
    </>
  );
}
