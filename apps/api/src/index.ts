import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, eq, lte } from "drizzle-orm";
import { campaigns, loginTokens, sessions } from "@mails/db/schema";
import { lt } from "drizzle-orm";
import {
  bumpCampaignStats,
  createDbFromEnv,
  deliverEmail,
  materializeRecipients,
  startCampaign,
  type AppEnv,
  type QueueMessage,
} from "./deps";
import { publicRoutes } from "./public";
import type { HonoEnv } from "./types";
import { v1 } from "./v1";
import { webhooks } from "./webhooks";

const app = new Hono<HonoEnv>();

app.use("/v1/*", cors({ origin: "*", allowHeaders: ["authorization", "content-type"] }));

app.get("/", (c) =>
  c.json({
    service: "mails-api",
    docs: `${c.env.APP_URL}/docs`,
    endpoints: [
      "POST /v1/events",
      "POST /v1/emails",
      "POST /v1/contacts",
      "GET  /v1/contacts/:email",
      "GET  /v1/stats",
    ],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/v1", v1);
app.route("/webhooks", webhooks);
app.route("/", publicRoutes);

app.onError((error, c) => {
  console.error("api error", error);
  return c.json({ error: "Internal error" }, 500);
});

export default {
  fetch: app.fetch,

  /** Sends every queued email and materializes campaign recipients. */
  async queue(batch: MessageBatch<QueueMessage>, env: AppEnv): Promise<void> {
    for (const message of batch.messages) {
      try {
        const payload = message.body;
        if (payload.type === "campaign.start") {
          const cursor = await materializeRecipients(
            env,
            payload.campaignId,
            payload.cursor,
          );
          if (cursor) {
            await env.SEND_QUEUE.send({
              type: "campaign.start",
              campaignId: payload.campaignId,
              cursor,
            });
          }
        } else {
          await deliverEmail(env, payload.emailId);
          const db = createDbFromEnv(env);
          const row = await db.query.emails.findFirst({
            where: (table, { eq: equals }) => equals(table.id, payload.emailId),
          });
          if (row?.campaignId) await bumpCampaignStats(db, row.campaignId);
        }
        message.ack();
      } catch (error) {
        console.error("queue message failed", message.body, error);
        // Exponential-ish backoff, mostly for SES throttling.
        message.retry({ delaySeconds: Math.min(60 * 2 ** message.attempts, 900) });
      }
    }
  },

  /** Every minute: start due campaigns, finish stalled ones, prune auth rows. */
  async scheduled(_event: ScheduledController, env: AppEnv): Promise<void> {
    const db = createDbFromEnv(env);
    const now = new Date();

    const due = await db.query.campaigns.findMany({
      where: and(
        eq(campaigns.status, "scheduled"),
        lte(campaigns.scheduledAt, now),
      ),
      limit: 10,
    });
    for (const campaign of due) {
      try {
        await startCampaign(env, campaign.id);
      } catch (error) {
        await db
          .update(campaigns)
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          })
          .where(eq(campaigns.id, campaign.id));
      }
    }

    // Safety net: a campaign whose last email finished while another worker
    // was still writing rows.
    const sending = await db.query.campaigns.findMany({
      where: eq(campaigns.status, "sending"),
      limit: 20,
    });
    for (const campaign of sending) await bumpCampaignStats(db, campaign.id);

    await db.delete(sessions).where(lt(sessions.expiresAt, now));
    await db.delete(loginTokens).where(lt(loginTokens.expiresAt, now));
  },
};
