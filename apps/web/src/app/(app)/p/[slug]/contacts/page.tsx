import { and, desc, eq, exists, like, or, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { contacts, listMembers, lists } from "@mails/db/schema";
import {
  createContactAction,
  deleteContactAction,
  importContactsAction,
  toggleSubscriptionAction,
} from "@/app/actions/contacts";
import { SubmitButton } from "@/components/client";
import { ModalButton, ModalCancel, ModalForm } from "@/components/modal";
import {
  Badge,
  EmptyState,
  Field,
  FilterBar,
  FilterTab,
  Input,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  TopBar,
} from "@/components/shell";
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
  // A correlated subquery, not the relational query builder: findMany()
  // aliases the outer table and rewrites every column in a raw `sql`
  // fragment to that alias, which breaks the join back to list_members.
  const listCondition = listFilter
    ? exists(
        db
          .select({ one: sql`1` })
          .from(listMembers)
          .where(
            and(
              eq(listMembers.contactId, contacts.id),
              eq(listMembers.listId, listFilter),
            ),
          ),
      )
    : undefined;

  const [rows, projectLists, totals] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.projectId, project.id), searchFilter, listCondition),
      )
      .orderBy(desc(contacts.createdAt))
      .limit(PAGE_SIZE),
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
  const listOptions = projectLists.map((list) => (
    <option key={list.id} value={list.id}>
      {list.name}
    </option>
  ));

  return (
    <>
      <TopBar
        title="Contacts"
        description={`${formatNumber(subscribed)} subscribed of ${formatNumber(
          total,
        )} total`}
        action={
          <>
            <ModalButton
              label="Import"
              title="Import contacts"
              description="CSV with an email column. Other columns become merge data."
              variant="secondary"
              width="md"
            >
              <ModalForm action={importContactsAction} className="space-y-3">
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
                    rows={6}
                    className="code"
                    placeholder={"email,firstName,plan\nada@example.com,Ada,pro"}
                  />
                </Field>
                {projectLists.length ? (
                  <Field label="Add everyone to a list">
                    <Select name="listId" defaultValue="">
                      <option value="">No list</option>
                      {listOptions}
                    </Select>
                  </Field>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <SubmitButton>Import</SubmitButton>
                  <ModalCancel />
                </div>
              </ModalForm>
            </ModalButton>

            <ModalButton
              label="Add contact"
              title="Add a contact"
              icon={<Plus className="size-3.5" strokeWidth={2} />}
            >
              <ModalForm action={createContactAction} className="space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <Field label="Email">
                  <Input
                    name="email"
                    type="email"
                    required
                    autoFocus
                    placeholder="ada@example.com"
                  />
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
                      {listOptions}
                    </Select>
                  </Field>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <SubmitButton>Add contact</SubmitButton>
                  <ModalCancel />
                </div>
              </ModalForm>
            </ModalButton>
          </>
        }
      />

      <FilterBar
        action={
          <form className="flex gap-1.5" action={`/p/${slug}/contacts`}>
            {listFilter ? (
              <input type="hidden" name="list" value={listFilter} />
            ) : null}
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search contacts…"
              className="h-7 w-52 py-0.5 text-[12.5px]"
            />
            <SubmitButton variant="secondary" size="sm">
              Search
            </SubmitButton>
          </form>
        }
      >
        <FilterTab
          href={`/p/${slug}/contacts`}
          active={!listFilter}
          count={total}
        >
          Everyone
        </FilterTab>
        {projectLists.map((list) => (
          <FilterTab
            key={list.id}
            href={`/p/${slug}/contacts?list=${list.id}`}
            active={listFilter === list.id}
            count={list.members}
          >
            {list.name}
          </FilterTab>
        ))}
      </FilterBar>

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
        <Table hover flush>
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
                      <input type="hidden" name="contactId" value={contact.id} />
                      <SubmitButton variant="ghost" size="sm">
                        {contact.subscribed ? "Unsubscribe" : "Resubscribe"}
                      </SubmitButton>
                    </form>
                    <form action={deleteContactAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="contactId" value={contact.id} />
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
        <p className="px-5 py-3 text-[12px] text-ink-muted">
          Showing the {PAGE_SIZE} most recent. Use search to narrow it down.
        </p>
      ) : null}
    </>
  );
}
