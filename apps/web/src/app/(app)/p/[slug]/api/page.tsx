import { desc, eq } from "drizzle-orm";
import { BookOpen, Plus } from "lucide-react";
import { apiKeys } from "@mails/db/schema";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions/keys";
import { SubmitButton } from "@/components/client";
import { ModalButton, ModalCancel, ModalForm } from "@/components/modal";
import { PanelButton } from "@/components/panel";
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
        description={`Base URL ${env.API_URL}`}
        action={
          <>
            <PanelButton
              label="API reference"
              title="API reference"
              description={`Authorization: Bearer mls_… · ${env.API_URL}`}
              width="md"
              icon={<BookOpen className="size-3.5" strokeWidth={1.75} />}
            >
              <div className="space-y-6 text-[12.5px]">
                <section className="space-y-4">
                  <h3 className="text-[12px] font-medium tracking-[0.02em] text-ink-muted uppercase">
                    Contacts
                  </h3>
                  <Endpoint
                    method="POST"
                    path="/v1/contacts"
                    body={`{"email":"ada@example.com","firstName":"Ada","properties":{"plan":"free"},"lists":["lst_…"]}`}
                    note="Create or overwrite a contact. Sending properties replaces the stored object."
                  />
                  <Endpoint
                    method="PATCH"
                    path="/v1/contacts/:email"
                    body={`{"properties":{"plan":"pro","mrr":49}}`}
                    note="Partial update, and the one to call when a customer starts paying: properties are merged into what you already stored, so other keys survive. Send a key as null to remove it. Also accepts firstName, lastName and subscribed."
                  />
                  <Endpoint
                    method="GET"
                    path="/v1/contacts/:email"
                    note="Read one contact, including its properties and consent state."
                  />
                  <Endpoint
                    method="GET"
                    path="/v1/contacts?limit=50"
                    note="Most recently added contacts first."
                  />
                  <Endpoint
                    method="POST"
                    path="/v1/contacts/:email/unsubscribe"
                    note="Unsubscribe from your own settings screen. Adds the address to the suppression list."
                  />
                  <Endpoint
                    method="POST"
                    path="/v1/contacts/:email/resubscribe"
                    note="Reverses an unsubscribe. Bounces and complaints stay suppressed and cannot be undone this way."
                  />
                  <Endpoint
                    method="DELETE"
                    path="/v1/contacts/:email"
                    note="Deletes the contact. Their message history is kept."
                  />
                </section>

                <section className="space-y-4">
                  <h3 className="text-[12px] font-medium tracking-[0.02em] text-ink-muted uppercase">
                    Sending
                  </h3>
                  <Endpoint
                    method="POST"
                    path="/v1/events"
                    body={`{"event":"user.signup","email":"ada@example.com","contact":{"firstName":"Ada"},"data":{"plan":"pro"}}`}
                    note="Upserts the contact and sends the transactional template wired to that event. This is the one to call when a user signs up."
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
                </section>

                <section className="space-y-4">
                  <h3 className="text-[12px] font-medium tracking-[0.02em] text-ink-muted uppercase">
                    Lists & stats
                  </h3>
                  <Endpoint method="GET" path="/v1/lists" note="Every list in this project." />
                  <Endpoint
                    method="POST"
                    path="/v1/lists"
                    body={`{"name":"Paid customers"}`}
                    note="Create a list, then pass its id in the lists array when upserting a contact."
                  />
                  <Endpoint
                    method="GET"
                    path="/v1/stats?days=30"
                    note="Aggregate counters for the period."
                  />
                </section>

                <section>
                  <p className="mb-1.5 font-medium">Mark a signup as paid</p>
                  <pre className="overflow-x-auto rounded-lg bg-canvas px-3 py-3 font-mono text-[11.5px] leading-relaxed text-ink-soft">
{`await fetch(
  \`${env.API_URL}/v1/contacts/\${encodeURIComponent(user.email)}\`,
  {
    method: "PATCH",
    headers: {
      authorization: \`Bearer \${process.env.MAILS_API_KEY}\`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ properties: { plan: "pro", mrr: 49 } }),
  },
);`}
                  </pre>
                  <p className="mt-1.5 text-ink-muted">
                    Anything you store shows up in templates as{" "}
                    <Mono>{"{{plan}}"}</Mono>, and lets you build a paid-only
                    list to target with a campaign.
                  </p>
                </section>
              </div>
            </PanelButton>

            <ModalButton
              label="New key"
              title="New API key"
              description="The full key is shown once, right after you create it."
              icon={<Plus className="size-3.5" strokeWidth={2} />}
            >
              <ModalForm
                action={createApiKeyAction}
                className="space-y-3"
                keepOpenOnSuccess
              >
                <input type="hidden" name="slug" value={slug} />
                <Field label="Name">
                  <Input name="name" placeholder="Production backend" autoFocus />
                </Field>
                <div className="flex gap-2 pt-1">
                  <SubmitButton>Create key</SubmitButton>
                  <ModalCancel />
                </div>
              </ModalForm>
            </ModalButton>
          </>
        }
      />

      {keys.length === 0 ? (
        <EmptyState
          title="No API keys yet"
          description="Create one to call the API from your app."
        />
      ) : (
        <Table flush>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Key</Th>
              <Th>Created</Th>
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
                  {formatDate(key.createdAt)}
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
