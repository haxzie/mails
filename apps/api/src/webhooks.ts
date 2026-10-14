import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { emails as emailsTable, contacts } from "@mails/db/schema";
import { and } from "drizzle-orm";
import {
  bumpCampaignStats,
  createDbFromEnv,
  recordEvent,
  safeEqual,
  suppress,
  unsubscribeContact,
} from "./deps";
import type { HonoEnv } from "./types";

export const webhooks = new Hono<HonoEnv>();

interface SnsEnvelope {
  Type?: string;
  Message?: string;
  SubscribeURL?: string;
  TopicArn?: string;
}

interface SesEvent {
  eventType?: string;
  notificationType?: string;
  mail?: { messageId?: string; destination?: string[] };
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: { emailAddress?: string; diagnosticCode?: string }[];
  };
  complaint?: {
    complaintFeedbackType?: string;
    complainedRecipients?: { emailAddress?: string }[];
  };
  delivery?: { timestamp?: string };
  click?: { link?: string };
  reject?: { reason?: string };
  deliveryDelay?: { delayType?: string };
}

/**
 * SES event destination → SNS → here. SNS message signatures are not
 * verifiable cheaply in a Worker, so the endpoint is protected with a shared
 * secret in the URL: `/webhooks/ses?secret=$SNS_WEBHOOK_SECRET`.
 */
webhooks.post("/ses", async (c) => {
  const expected = c.env.SNS_WEBHOOK_SECRET;
  const provided = c.req.query("secret") ?? "";
  if (!expected || !safeEqual(expected, provided)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const envelope = (await c.req.json().catch(() => null)) as SnsEnvelope | null;
  if (!envelope) return c.json({ error: "Invalid JSON" }, 400);

  if (envelope.Type === "SubscriptionConfirmation" && envelope.SubscribeURL) {
    const url = new URL(envelope.SubscribeURL);
    // Only ever call back into SNS itself.
    if (!/(^|\.)amazonaws\.com$/.test(url.hostname)) {
      return c.json({ error: "Unexpected SubscribeURL" }, 400);
    }
    await fetch(url.toString());
    return c.json({ confirmed: true });
  }

  if (envelope.Type && envelope.Type !== "Notification") {
    return c.json({ ignored: envelope.Type });
  }

  const event: SesEvent = envelope.Message
    ? JSON.parse(envelope.Message)
    : (envelope as unknown as SesEvent);

  const messageId = event.mail?.messageId;
  if (!messageId) return c.json({ ignored: "no messageId" });

  const db = createDbFromEnv(c.env);
  const email = await db.query.emails.findFirst({
    where: eq(emailsTable.providerMessageId, messageId),
  });
  if (!email) return c.json({ ignored: "unknown messageId" });

  const type = (event.eventType ?? event.notificationType ?? "").toLowerCase();
  const now = new Date();

  switch (type) {
    case "delivery": {
      await db
        .update(emailsTable)
        .set({ status: "delivered", deliveredAt: now })
        .where(eq(emailsTable.id, email.id));
      await recordEvent(db, email.id, email.projectId, "delivery");
      break;
    }
    case "bounce": {
      const permanent = event.bounce?.bounceType === "Permanent";
      const detail = [
        event.bounce?.bounceType,
        event.bounce?.bounceSubType,
        event.bounce?.bouncedRecipients?.[0]?.diagnosticCode,
      ]
        .filter(Boolean)
        .join(" / ");
      await recordEvent(db, email.id, email.projectId, "bounce", detail);
      if (permanent) {
        await db
          .update(emailsTable)
          .set({ status: "bounced", error: detail })
          .where(eq(emailsTable.id, email.id));
        // A hard bounce must never be mailed again.
        await suppress(db, email.projectId, email.to, "bounce", detail);
        if (email.contactId) {
          await db
            .update(contacts)
            .set({ subscribed: false, unsubscribedAt: now })
            .where(
              and(
                eq(contacts.id, email.contactId),
                eq(contacts.projectId, email.projectId),
              ),
            );
        }
      }
      break;
    }
    case "complaint": {
      const detail = event.complaint?.complaintFeedbackType ?? "complaint";
      await db
        .update(emailsTable)
        .set({ status: "complained", error: detail })
        .where(eq(emailsTable.id, email.id));
      await recordEvent(db, email.id, email.projectId, "complaint", detail);
      if (email.contactId) {
        await unsubscribeContact(db, email.projectId, email.contactId, "complaint");
      } else {
        await suppress(db, email.projectId, email.to, "complaint", detail);
      }
      break;
    }
    case "open": {
      await db
        .update(emailsTable)
        .set({
          openCount: sql`${emailsTable.openCount} + 1`,
          firstOpenedAt: email.firstOpenedAt ?? now,
        })
        .where(eq(emailsTable.id, email.id));
      await recordEvent(db, email.id, email.projectId, "open", "ses");
      break;
    }
    case "click": {
      await db
        .update(emailsTable)
        .set({
          clickCount: sql`${emailsTable.clickCount} + 1`,
          firstClickedAt: email.firstClickedAt ?? now,
        })
        .where(eq(emailsTable.id, email.id));
      await recordEvent(
        db,
        email.id,
        email.projectId,
        "click",
        "ses",
        event.click?.link,
      );
      break;
    }
    case "reject": {
      await db
        .update(emailsTable)
        .set({ status: "failed", error: event.reject?.reason ?? "rejected" })
        .where(eq(emailsTable.id, email.id));
      await recordEvent(
        db,
        email.id,
        email.projectId,
        "reject",
        event.reject?.reason,
      );
      break;
    }
    case "deliverydelay": {
      await recordEvent(
        db,
        email.id,
        email.projectId,
        "failure",
        `delayed: ${event.deliveryDelay?.delayType ?? "unknown"}`,
      );
      break;
    }
    default:
      await recordEvent(db, email.id, email.projectId, "failure", `ses:${type}`);
  }

  if (email.campaignId) await bumpCampaignStats(db, email.campaignId);
  return c.json({ ok: true });
});
