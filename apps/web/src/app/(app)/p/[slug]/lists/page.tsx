import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listMembers, lists } from "@mails/db/schema";
import { createListAction, deleteListAction } from "@/app/actions/contacts";
import { SubmitButton } from "@/components/client";
import { ModalButton, ModalCancel, ModalForm } from "@/components/modal";
import {
  EmptyState,
  Field,
  Input,
  Table,
  Td,
  Th,
  TopBar,
} from "@/components/shell";
import { getDb } from "@/lib/cloudflare";
import { formatDate, formatNumber, requireProject } from "@/lib/projects";

export default async function ListsPage({
  params,
}: PageProps<"/p/[slug]/lists">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();

  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      description: lists.description,
      createdAt: lists.createdAt,
      members: sql<number>`(select count(*) from ${listMembers} where ${listMembers.listId} = ${lists.id})`,
    })
    .from(lists)
    .where(eq(lists.projectId, project.id))
    .orderBy(lists.name);

  return (
    <>
      <TopBar
        title="Lists"
        description="Audiences you can target with a campaign"
        action={
          <ModalButton
            label="New list"
            title="New list"
            description="Add contacts to it from the contacts screen, a CSV import or the API."
            icon={<Plus className="size-3.5" strokeWidth={2} />}
          >
            <ModalForm action={createListAction} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Name">
                <Input name="name" placeholder="Product updates" required autoFocus />
              </Field>
              <Field label="Description" hint="Optional, for your own reference.">
                <Input name="description" placeholder="Everyone who opted into release notes" />
              </Field>
              <div className="flex gap-2 pt-1">
                <SubmitButton>Create list</SubmitButton>
                <ModalCancel />
              </div>
            </ModalForm>
          </ModalButton>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No lists yet"
          description="Without a list, a campaign goes to everyone subscribed. Create one to send to a slice of your audience."
        />
      ) : (
        <Table hover flush>
          <thead>
            <tr>
              <Th>List</Th>
              <Th>Contacts</Th>
              <Th>Created</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((list) => (
              <tr key={list.id}>
                <Td>
                  <Link
                    href={`/p/${slug}/contacts?list=${list.id}`}
                    className="font-medium hover:underline"
                  >
                    {list.name}
                  </Link>
                  {list.description ? (
                    <p className="text-[12px] text-ink-muted">{list.description}</p>
                  ) : null}
                </Td>
                <Td className="tabular-nums">{formatNumber(list.members)}</Td>
                <Td className="text-[12px] text-ink-muted">
                  {formatDate(list.createdAt)}
                </Td>
                <Td className="text-right">
                  <form action={deleteListAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="listId" value={list.id} />
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      confirm={`Delete the list “${list.name}”? Contacts are kept.`}
                    >
                      Delete
                    </SubmitButton>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
