import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { campaigns, contacts } from "@mails/db/schema";
import { dailySeries, projectStats, rate, recentEvents } from "@mails/core";
import { SendsChart, SERIES_COLORS } from "@/components/chart";
import {
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  StatTile,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getDb } from "@/lib/cloudflare";
import { formatDate, formatNumber, requireProject } from "@/lib/projects";

export const instant = false;

export default async function DashboardPage({
  params,
}: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();

  const [stats, series, events, recentCampaigns, contactCounts] = await Promise.all([
    projectStats(db, project.id, 30),
    dailySeries(db, project.id, 30),
    recentEvents(db, project.id, 8),
    db.query.campaigns.findMany({
      where: eq(campaigns.projectId, project.id),
      orderBy: desc(campaigns.createdAt),
      limit: 5,
    }),
    db
      .select({ total: count(), subscribed: contacts.subscribed })
      .from(contacts)
      .where(eq(contacts.projectId, project.id))
      .groupBy(contacts.subscribed),
  ]);

  const subscribed =
    contactCounts.find((row) => row.subscribed)?.total ?? 0;
  const unsubscribed =
    contactCounts.find((row) => !row.subscribed)?.total ?? 0;

  const needsSetup = !project.sesAccessKeyId || !project.fromEmail;

  return (
    <>
      <PageHead slug={slug} name={project.name} />

      {needsSetup ? (
        <div className="mb-5">
          <Callout tone="warning" title="Finish setting up sending">
            Add your Amazon SES credentials and a From address in{" "}
            <Link href={`/p/${slug}/settings`} className="underline">
              settings
            </Link>{" "}
            before sending anything.
          </Callout>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Sent · 30 days"
          value={formatNumber(stats.sent)}
          sub={`${formatNumber(stats.queued)} in the queue`}
          swatch={SERIES_COLORS.sent}
        />
        <StatTile
          label="Delivered"
          value={`${rate(stats.delivered, stats.sent)}%`}
          sub={`${formatNumber(stats.delivered)} confirmed`}
        />
        <StatTile
          label="Opened"
          value={`${rate(stats.opened, stats.sent)}%`}
          sub={`${formatNumber(stats.opened)} unique`}
          swatch={SERIES_COLORS.opened}
        />
        <StatTile
          label="Clicked"
          value={`${rate(stats.clicked, stats.sent)}%`}
          sub={`${formatNumber(stats.clicked)} unique`}
          swatch={SERIES_COLORS.clicked}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Bounced"
          value={`${rate(stats.bounced, stats.sent)}%`}
          sub={`${formatNumber(stats.bounced)} hard bounces`}
        />
        <StatTile
          label="Complaints"
          value={`${rate(stats.complained, stats.sent)}%`}
          sub="Keep this under 0.1%"
        />
        <StatTile
          label="Subscribed"
          value={formatNumber(subscribed)}
          sub={`${formatNumber(unsubscribed)} unsubscribed`}
        />
        <StatTile
          label="Failed"
          value={formatNumber(stats.failed)}
          sub="Rejected before sending"
        />
      </div>

      <div className="mt-5">
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">
            Last 30 days
          </h2>
          <p className="mb-4 text-[12.5px] text-ink-muted">
            Daily sends, unique opens and unique clicks.
          </p>
          <SendsChart data={series} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent campaigns"
            action={
              <ButtonLink
                href={`/p/${slug}/campaigns`}
                variant="secondary"
                size="sm"
              >
                All campaigns
              </ButtonLink>
            }
          />
          {recentCampaigns.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              description="Write your first broadcast and send it to a list of contacts."
              action={
                <ButtonLink href={`/p/${slug}/campaigns`} size="sm">
                  New campaign
                </ButtonLink>
              }
            />
          ) : (
            <Table>
              <tbody>
                {recentCampaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <Td>
                      <Link
                        href={`/p/${slug}/campaigns/${campaign.id}`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-[12px] text-ink-muted">
                        {campaign.subject || "No subject"}
                      </p>
                    </Td>
                    <Td className="text-right">
                      <StatusBadge status={campaign.status} />
                      <p className="mt-1 text-[11.5px] text-ink-muted">
                        {formatNumber(campaign.recipientCount)} recipients
                      </p>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Latest activity" description="Delivery events as they arrive from SES." />
          {events.length === 0 ? (
            <EmptyState title="Nothing yet" description="Events show up here once you start sending." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th>Recipient</Th>
                  <Th className="text-right">When</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <Td>
                      <StatusBadge status={eventStatus(event.type)} />
                    </Td>
                    <Td className="text-ink-soft">{event.to}</Td>
                    <Td className="text-right text-[12px] text-ink-muted">
                      {formatDate(event.createdAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function eventStatus(type: string): string {
  if (type === "delivery") return "delivered";
  if (type === "bounce") return "bounced";
  if (type === "complaint") return "complained";
  if (type === "send") return "sent";
  return type;
}

function PageHead({ slug, name }: { slug: string; name: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 pb-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{name}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Sending health and recent activity.
        </p>
      </div>
      <div className="flex gap-2">
        <ButtonLink href={`/p/${slug}/campaigns`} variant="secondary">
          Campaigns
        </ButtonLink>
        <ButtonLink href={`/p/${slug}/contacts`}>Add contacts</ButtonLink>
      </div>
    </header>
  );
}
