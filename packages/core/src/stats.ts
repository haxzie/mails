import { and, desc, eq, gte, sql } from "drizzle-orm";
import { emailEvents, emails } from "@mails/db/schema";
import type { Database } from "@mails/db";

export interface SendStats {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  queued: number;
  opened: number;
  clicked: number;
}

const aggregate = {
  total: sql<number>`count(*)`,
  sent: sql<number>`coalesce(sum(case when ${emails.status} in ('sent','delivered','bounced','complained') then 1 else 0 end), 0)`,
  delivered: sql<number>`coalesce(sum(case when ${emails.status} = 'delivered' then 1 else 0 end), 0)`,
  bounced: sql<number>`coalesce(sum(case when ${emails.status} = 'bounced' then 1 else 0 end), 0)`,
  complained: sql<number>`coalesce(sum(case when ${emails.status} = 'complained' then 1 else 0 end), 0)`,
  failed: sql<number>`coalesce(sum(case when ${emails.status} = 'failed' then 1 else 0 end), 0)`,
  queued: sql<number>`coalesce(sum(case when ${emails.status} = 'queued' then 1 else 0 end), 0)`,
  opened: sql<number>`coalesce(sum(case when ${emails.firstOpenedAt} is not null then 1 else 0 end), 0)`,
  clicked: sql<number>`coalesce(sum(case when ${emails.firstClickedAt} is not null then 1 else 0 end), 0)`,
};

function empty(): SendStats {
  return {
    total: 0,
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
    queued: 0,
    opened: 0,
    clicked: 0,
  };
}

/** Aggregates over the last `days` (all time when omitted). */
export async function projectStats(
  db: Database,
  projectId: string,
  days?: number,
): Promise<SendStats> {
  const since = days ? new Date(Date.now() - days * 86_400_000) : undefined;
  const [row] = await db
    .select(aggregate)
    .from(emails)
    .where(
      and(
        eq(emails.projectId, projectId),
        since ? gte(emails.createdAt, since) : undefined,
      ),
    );
  return { ...empty(), ...(row ?? {}) };
}

export async function campaignStats(
  db: Database,
  campaignId: string,
): Promise<SendStats> {
  const [row] = await db
    .select(aggregate)
    .from(emails)
    .where(eq(emails.campaignId, campaignId));
  return { ...empty(), ...(row ?? {}) };
}

export interface DailyPoint {
  day: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

/** One row per day for the dashboard chart, oldest first. */
export async function dailySeries(
  db: Database,
  projectId: string,
  days = 30,
): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const day = sql<string>`strftime('%Y-%m-%d', ${emails.createdAt} / 1000, 'unixepoch')`;
  const rows = await db
    .select({
      day,
      sent: aggregate.sent,
      opened: aggregate.opened,
      clicked: aggregate.clicked,
      bounced: aggregate.bounced,
    })
    .from(emails)
    .where(and(eq(emails.projectId, projectId), gte(emails.createdAt, since)))
    .groupBy(day)
    .orderBy(day);

  const byDay = new Map(rows.map((row) => [row.day, row]));
  const series: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const row = byDay.get(date);
    series.push({
      day: date,
      sent: row?.sent ?? 0,
      opened: row?.opened ?? 0,
      clicked: row?.clicked ?? 0,
      bounced: row?.bounced ?? 0,
    });
  }
  return series;
}

export async function recentEvents(
  db: Database,
  projectId: string,
  limit = 20,
) {
  return db
    .select({
      id: emailEvents.id,
      type: emailEvents.type,
      detail: emailEvents.detail,
      url: emailEvents.url,
      createdAt: emailEvents.createdAt,
      to: emails.to,
      subject: emails.subject,
    })
    .from(emailEvents)
    .innerJoin(emails, eq(emails.id, emailEvents.emailId))
    .where(eq(emailEvents.projectId, projectId))
    .orderBy(desc(emailEvents.createdAt))
    .limit(limit);
}

export function rate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
