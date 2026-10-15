import { desc, eq } from "drizzle-orm";
import { apiKeys } from "@mails/db/schema";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions/keys";
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
import { formatDate, requireProject } from "@/lib/projects";

export const instant = false;

export default async function ApiPage({ params }: PageProps<"/p/[slug]/api">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();
  const env = await getEnv();
  const keys = await db.query.apiKeys.findMany({
    where: eq(apiKeys.projectId, project.id),
    orderBy: desc(apiKeys.createdAt),
  });

  return (
    <>
      <TopBar
        title="API & keys"
        description="Hook your product into this project"
      />

      <Content className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="API keys" />
            {keys.length === 0 ? (
              <EmptyState
                title="No keys yet"
                description="Create one to start calling the API from your app."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Key</Th>
                    <Th>Last used</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id}>
                      <Td className="font-medium">{key.name}</Td>
                      <Td>
                        <Mono>{key.prefix}…</Mono>{" "}
                        {key.revokedAt ? <Badge tone="negative">revoked</Badge> : null}
                      </Td>
                      <Td className="text-[12px] text-ink-muted">
                        {formatDate(key.lastUsedAt)}
                      </Td>
                      <Td className="text-right">
                        {key.revokedAt ? null : (
                          <form action={revokeApiKeyAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="keyId" value={key.id} />
                            <SubmitButton
                              variant="ghost"
                              size="sm"
                              confirm={`Revoke “${key.name}”? Anything using it stops working.`}
                            >
                              Revoke
                            </SubmitButton>
                          </form>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Endpoints"
              description={`Base URL: ${env.API_URL}`}
            />
            <div className="space-y-5 p-5 text-[12.5px]">
              <Endpoint
                method="POST"
                path="/v1/events"
                body={`{"event":"user.signup","email":"ada@example.com","contact":{"firstName":"Ada"},"data":{"plan":"pro"}}`}
                note="Upserts the contact and sends the transactional template wired to that event. This is the one to call when a user signs up."
              />
              <Endpoint
                method="POST"
                path="/v1/contacts"
                body={`{"email":"ada@example.com","firstName":"Ada","properties":{"plan":"pro"},"lists":["lst_…"]}`}
                note="Create or update a contact without sending anything."
              />
              <Endpoint
                method="POST"
                path="/v1/emails"
                body={`{"to":"ada@example.com","subject":"Your receipt","html":"<p>Thanks!</p>"}`}
                note="One-off transactional send with inline content, or pass transactionalId to use a stored template."
              />
              <Endpoint
                method="GET"
                path="/v1/emails/:id"
                note="Delivery status, opens and clicks for one message."
              />
              <Endpoint
                method="POST"
                path="/v1/contacts/:email/unsubscribe"
                note="Unsubscribe from your own settings screen."
              />
              <Endpoint method="GET" path="/v1/stats?days=30" note="Aggregate counters." />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="New key" />
            <ActionForm action={createApiKeyAction} className="space-y-3 p-5">
              <input type="hidden" name="slug" value={slug} />
              <Field
                label="Name"
                hint="The full key is shown once, right here, after you create it."
              >
                <Input name="name" placeholder="Production backend" />
              </Field>
              <SubmitButton>Create key</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Node example" />
            <pre className="overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-relaxed text-ink-soft">
{`await fetch("${env.API_URL}/v1/events", {
  method: "POST",
  headers: {
    authorization: \`Bearer \${process.env.MAILS_API_KEY}\`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    event: "user.signup",
    email: user.email,
    contact: { firstName: user.firstName },
  }),
});`}
            </pre>
          </Card>
        </div>
      </Content>
    </>
  );
}

function Endpoint({
  method,
  path,
  body,
  note,
}: {
  method: string;
  path: string;
  body?: string;
  note: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2">
        <Badge tone={method === "GET" ? "neutral" : "accent"}>{method}</Badge>
        <span className="font-mono text-[12px]">{path}</span>
      </p>
      <p className="mt-1 text-ink-muted">{note}</p>
      {body ? (
        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-canvas px-3 py-2 font-mono text-[11.5px] text-ink-soft">
          {body}
        </pre>
      ) : null}
    </div>
  );
}
