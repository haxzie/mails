import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { emails as emailsTable } from "@mails/db/schema";
import {
  createDbFromEnv,
  parseClickToken,
  parseOpenToken,
  parseUnsubscribeToken,
  recordEvent,
  unsubscribeContact,
} from "./deps";
import type { HonoEnv } from "./types";

export const publicRoutes = new Hono<HonoEnv>();

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title><style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f7;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#18181b}
.card{background:#fff;max-width:420px;padding:32px;border-radius:14px;border:1px solid #e9e9ec;box-shadow:0 1px 2px rgba(0,0,0,.04);text-align:center}
h1{font-size:18px;margin:0 0 8px}p{margin:0 0 16px;color:#6b7280}
button{font:inherit;background:#18181b;color:#fff;border:0;border-radius:9px;padding:10px 16px;cursor:pointer}
</style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/* --------------------------------------------------------- unsubscribe */

publicRoutes.get("/u/:token", async (c) => {
  const parsed = await parseUnsubscribeToken(
    c.req.param("token"),
    c.env.AUTH_SECRET,
  );
  if (!parsed) return page("Invalid link", "<h1>This link is not valid</h1>", 400);

  const db = createDbFromEnv(c.env);
  const contact = await db.query.contacts.findFirst({
    where: (table, { eq: equals }) => equals(table.id, parsed.contactId),
  });
  if (!contact) return page("Invalid link", "<h1>This link is not valid</h1>", 400);

  if (!contact.subscribed) {
    return page(
      "Unsubscribed",
      `<h1>You're unsubscribed</h1><p>${contact.email} will not receive any more emails from us.</p>`,
    );
  }

  return page(
    "Unsubscribe",
    `<h1>Unsubscribe</h1><p>Stop sending emails to <strong>${contact.email}</strong>?</p>
<form method="post"><button type="submit">Unsubscribe me</button></form>`,
  );
});

/**
 * Handles both the confirmation form and RFC 8058 one-click unsubscribe
 * (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`), which Gmail and
 * Yahoo require from bulk senders.
 */
publicRoutes.post("/u/:token", async (c) => {
  const parsed = await parseUnsubscribeToken(
    c.req.param("token"),
    c.env.AUTH_SECRET,
  );
  if (!parsed) return c.text("Invalid link", 400);

  const db = createDbFromEnv(c.env);
  const contact = await unsubscribeContact(
    db,
    parsed.projectId,
    parsed.contactId,
  );
  if (!contact) return c.text("Invalid link", 400);

  const oneClick = (c.req.header("content-type") ?? "").includes(
    "application/x-www-form-urlencoded",
  );
  const formBody = oneClick ? await c.req.text() : "";
  if (formBody.includes("List-Unsubscribe=One-Click")) {
    return c.text("OK", 200);
  }

  return page(
    "Unsubscribed",
    `<h1>You're unsubscribed</h1><p>${contact.email} will not receive any more emails from us.</p>`,
  );
});

/* ------------------------------------------------------------- tracking */

publicRoutes.get("/t/o/:token", async (c) => {
  const parsed = await parseOpenToken(c.req.param("token"), c.env.AUTH_SECRET);
  if (parsed) {
    const db = createDbFromEnv(c.env);
    const email = await db.query.emails.findFirst({
      where: eq(emailsTable.id, parsed.emailId),
    });
    if (email) {
      await db
        .update(emailsTable)
        .set({
          openCount: sql`${emailsTable.openCount} + 1`,
          firstOpenedAt: email.firstOpenedAt ?? new Date(),
        })
        .where(eq(emailsTable.id, email.id));
      await recordEvent(db, email.id, email.projectId, "open");
    }
  }
  return new Response(PIXEL, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate, private",
    },
  });
});

publicRoutes.get("/t/c/:token", async (c) => {
  const parsed = await parseClickToken(c.req.param("token"), c.env.AUTH_SECRET);
  if (!parsed) return c.text("Invalid link", 400);

  const db = createDbFromEnv(c.env);
  const email = await db.query.emails.findFirst({
    where: eq(emailsTable.id, parsed.emailId),
  });
  if (email) {
    await db
      .update(emailsTable)
      .set({
        clickCount: sql`${emailsTable.clickCount} + 1`,
        firstClickedAt: email.firstClickedAt ?? new Date(),
        firstOpenedAt: email.firstOpenedAt ?? new Date(),
      })
      .where(eq(emailsTable.id, email.id));
    await recordEvent(db, email.id, email.projectId, "click", undefined, parsed.target);
  }
  return c.redirect(parsed.target, 302);
});
