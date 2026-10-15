import { CopyButton } from "@/components/client";
import { Callout, Card, CardHeader, Content } from "@/components/shell";
import { getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function WebhooksSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/webhooks">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const env = await getEnv();

  const url = `${env.API_URL}/webhooks/ses?secret=${
    env.SNS_WEBHOOK_SECRET ?? "<set SNS_WEBHOOK_SECRET>"
  }`;
  const display = `${env.API_URL}/webhooks/ses?secret=${
    env.SNS_WEBHOOK_SECRET ? "••••••" : "<set SNS_WEBHOOK_SECRET>"
  }`;

  return (
    <Content className="max-w-2xl space-y-5">
      <Card>
        <CardHeader
          title="SES event webhook"
          description="Point an SNS topic at this URL from your SES configuration set to receive bounces, complaints, deliveries, opens and clicks."
          action={
            env.SNS_WEBHOOK_SECRET ? <CopyButton value={url} label="Copy URL" /> : null
          }
        />
        <div className="space-y-2 p-5">
          <p className="font-mono text-[12px] break-all text-ink-soft">{display}</p>
          <p className="text-[12.5px] text-ink-muted">
            Subscribe the topic with the full URL including the secret — the
            endpoint confirms the SNS subscription automatically and rejects
            anything without it.
          </p>
        </div>
      </Card>

      {project.sesConfigurationSet ? null : (
        <Callout tone="warning" title="No configuration set">
          Set one under Amazon SES. Without it, SES has nowhere to publish
          these events and delivery stays unknown.
        </Callout>
      )}
    </Content>
  );
}
