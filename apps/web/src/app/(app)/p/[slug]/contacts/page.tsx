import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { contacts, listMembers, lists } from "@mails/db/schema";
import {
  createContactAction,
  createListAction,
  deleteContactAction,
  deleteListAction,
  importContactsAction,
  toggleSubscriptionAction,
} from "@/app/actions/contacts";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Content,
  Input,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  TopBar,
} from "@/components/ui";
import { getDb } from "@/lib/cloudflare";
import { formatDate, formatNumber, requireProject } from "@/lib/projects";

export const instant = false;

const PAGE_SIZE = 50;

export default async function ContactsPage({
  params,
  searchParams,
}: PageProps<"/p/[slug]/contacts">) {
  const { slug } = await params;
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const listFilter = typeof query.list === "string" ? query.list : "";

  const { project } = await requireProject(slug);
  const db = await getDb();

  const searchFilter = search
    ? or(
        like(contacts.email, `%${search.toLowerCase()}%`),
        like(contacts.firstName, `%${search}%`),
        like(contacts.lastName, `%${search}%`),
      )
    : undefined;
  const listCondition = listFilter
    ? sql`exists (select 1 from ${listMembers} where ${listMembers.contactId} = ${contacts.id} and ${listMembers.listId} = ${listFilter})`
    : undefined;

  const [rows, projectLists, totals] = await Promise.all([
    db.query.contacts.findMany({
      where: and(eq(contacts.projectId, project.id), searchFilter, listCondition),
      orderBy: desc(contacts.createdAt),
      limit: PAGE_SIZE,
    }),
    db
      .select({
        id: lists.id,
        name: lists.name,
        members: sql<number>`(select count(*) from ${listMembers} where ${listMembers.listId} = ${lists.id})`,
      })
      .from(lists)
      .where(eq(lists.projectId, project.id))
      .orderBy(lists.name),
    db
      .select({
        total: sql<number>`count(*)`,
        subscribed: sql<number>`coalesce(sum(case when ${contacts.subscribed} then 1 else 0 end), 0)`,
      })
      .from(contacts)
      .where(eq(contacts.projectId, project.id)),
  ]);

  const total = totals[0]?.total ?? 0;
  const subscribed = totals[0]?.subscribed ?? 0;

  return (
    <>
      <TopBar
        title="Contacts"
        description={`${formatNumber(subscribed)} subscribed of ${formatNumber(
          total,
        )} total`}
      />

      <Content className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="All contacts"
              description="Newest first. Unsubscribed contacts are never mailed again."
              action={
                <form className="flex gap-2" action={`/p/${slug}/contacts`}>
                  {listFilter ? (
                    <input type="hidden" name="list" value={listFilter} />
                  ) : null}
                  <Input
                    name="q"
                    defaultValue={search}
                    placeholder="Search…"
                    className="h-8 w-48 py-1"
                  />
                  <SubmitButton variant="secondary" size="sm">
                    Search
                  </SubmitButton>
                </form>
              }
            />
            {rows.length === 0 ? (
              <EmptyState
                title={search ? "No matches" : "No contacts yet"}
                description={
                  search
                    ? "Try a different search."
                    : "Add one by hand, import a CSV, or POST to /v1/contacts from your app."
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Contact</Th>
                    <Th>Status</Th>
                    <Th>Added</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((contact) => (
                    <tr key={contact.id}>
                      <Td>
                        <p className="font-medium">{contact.email}</p>
                        <p className="text-[12px] text-ink-muted">
                          {[contact.firstName, contact.lastName]
                            .filter(Boolean)
                            .join(" ") || contact.source}
                        </p>
                      </Td>
                      <Td>
                        {contact.subscribed ? (
                          <Badge tone="positive">subscribed</Badge>
                        ) : (
                          <Badge tone="negative">unsubscribed</Badge>
                        )}
                      </Td>
                      <Td className="text-[12px] text-ink-muted">
                        {formatDate(contact.createdAt)}
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <form action={toggleSubscriptionAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input
                              type="hidden"
                              name="contactId"
                              value={contact.id}
                            />
                            <SubmitButton variant="ghost" size="sm">
                              {contact.subscribed ? "Unsubscribe" : "Resubscribe"}
                            </SubmitButton>
                          </form>
                          <form action={deleteContactAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input
                              type="hidden"
                              name="contactId"
                              value={contact.id}
                            />
                            <SubmitButton
                              variant="ghost"
                              size="sm"
                              confirm={`Delete ${contact.email}?`}
                            >
                              Delete
                            </SubmitButton>
                          </form>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {rows.length === PAGE_SIZE ? (
              <p className="border-t border-line px-5 py-3 text-[12px] text-ink-muted">
                Showing the {PAGE_SIZE} most recent. Use search to narrow it down.
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title="Import CSV"
              description="Needs an email column. firstName, lastName and any other column become merge data."
            />
            <ActionForm action={importContactsAction} className="space-y-3 p-5">
              <input type="hidden" name="slug" value={slug} />
              <Field label="CSV file">
                <input
                  type="file"
                  name="file"
                  accept=".csv,text/csv"
                  className="text-[13px]"
                />
              </Field>
              <Field label="…or paste rows">
                <Textarea
                  name="csv"
                  rows={4}
                  className="code"
                  placeholder={"email,firstName,plan\nada@example.com,Ada,pro"}
                />
              </Field>
              {projectLists.length ? (
                <Field label="Add everyone to a list">
                  <Select name="listId" defaultValue="">
                    <option value="">No list</option>
                    {projectLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <SubmitButton variant="secondary">Import</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Add a contact" />
            <ActionForm action={createContactAction} className="space-y-3 p-5">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Email">
                <Input name="email" type="email" required placeholder="ada@example.com" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="First name">
                  <Input name="firstName" placeholder="Ada" />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" placeholder="Lovelace" />
                </Field>
              </div>
              {projectLists.length ? (
                <Field label="List">
                  <Select name="listId" defaultValue="">
                    <option value="">No list</option>
                    {projectLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <SubmitButton>Add contact</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Lists" description="Audiences you can target with a campaign." />
            <ul className="divide-y divide-line">
              <li>
                <a
                  href={`/p/${slug}/contacts`}
                  className="flex items-center justify-between px-5 py-2.5 text-[13px] hover:bg-canvas"
                >
                  <span className={listFilter ? "text-ink-soft" : "font-medium"}>
                    Everyone
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    {formatNumber(total)}
                  </span>
                </a>
              </li>
              {projectLists.map((list) => (
                <li key={list.id} className="flex items-center gap-1 pr-3">
                  <a
                    href={`/p/${slug}/contacts?list=${list.id}`}
                    className="flex flex-1 items-center justify-between px-5 py-2.5 text-[13px] hover:bg-canvas"
                  >
                    <span
                      className={
                        listFilter === list.id ? "font-medium" : "text-ink-soft"
                      }
                    >
                      {list.name}
                    </span>
                    <span className="text-[12px] text-ink-muted">
                      {formatNumber(list.members)}
                    </span>
                  </a>
                  <form action={deleteListAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="listId" value={list.id} />
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      confirm={`Delete the list “${list.name}”? Contacts are kept.`}
                    >
                      ×
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            <ActionForm action={createListAction} className="space-y-2 border-t border-line p-5">
              <input type="hidden" name="slug" value={slug} />
              <Field label="New list">
                <Input name="name" placeholder="Product updates" required />
              </Field>
              <SubmitButton variant="secondary" size="sm">
                Create list
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </Content>
    </>
  );
}
