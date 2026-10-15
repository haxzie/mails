import { describe, expect, it } from "vitest";
import { QueryBuilder } from "drizzle-orm/sqlite-core";
import { contacts } from "@mails/db/schema";
import { recipientFilter } from "./campaigns";

/**
 * Renders the filter to SQL so the conditions can be asserted directly.
 * The casing has to match the one the runtime client is created with.
 */
function toSql(filter: ReturnType<typeof recipientFilter>) {
  return new QueryBuilder({ casing: "snake_case" })
    .select({ id: contacts.id })
    .from(contacts)
    .where(filter)
    .toSQL();
}

describe("recipientFilter", () => {
  const startedAt = new Date("2026-10-15T16:00:00Z");

  it("only takes subscribed contacts of the project", () => {
    const { sql, params } = toSql(recipientFilter({ projectId: "prj_1" }));
    expect(sql).toContain('"project_id" = ?');
    expect(sql).toContain('"subscribed" = ?');
    expect(params).toContain("prj_1");
  });

  it("freezes the audience at the cutoff, so later contacts are excluded", () => {
    const { sql, params } = toSql(
      recipientFilter({ projectId: "prj_1", cutoff: startedAt }),
    );
    expect(sql).toContain('"created_at" <= ?');
    expect(params).toContain(startedAt.getTime());
  });

  it("has no time condition when no cutoff is given, for the live count", () => {
    const { sql } = toSql(recipientFilter({ projectId: "prj_1" }));
    expect(sql).not.toContain('"created_at" <=');
  });

  it("excludes suppressed addresses", () => {
    const { sql } = toSql(recipientFilter({ projectId: "prj_1" }));
    expect(sql).toMatch(/not exists \(select 1 from "suppressions"/);
  });

  it("restricts to a list only when one is given", () => {
    expect(toSql(recipientFilter({ projectId: "prj_1", listId: "lst_1" })).sql).toMatch(
      /exists \(select 1 from "list_members"/,
    );
    expect(toSql(recipientFilter({ projectId: "prj_1" })).sql).not.toContain(
      "list_members",
    );
  });

  it("pages with a cursor without losing the cutoff", () => {
    const { sql } = toSql(
      recipientFilter({ projectId: "prj_1", cutoff: startedAt, after: "con_5" }),
    );
    expect(sql).toContain('"id" > ?');
    expect(sql).toContain('"created_at" <= ?');
  });
});
