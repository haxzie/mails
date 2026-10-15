import { CopyButton } from "@/components/client";
import {
  Callout,
  Content,
  SettingRow,
  SettingsSection,
} from "@/components/shell";
import { getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

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
    <Content className="max-w-3xl space-y-7">
      <SettingsSection
        title="SES event webhook"
        description="Point an SNS topic at this URL from your SES configuration set to receive bounces, complaints, deliveries, opens and clicks."
      >
        <SettingRow
          label="Endpoint"
          description="Subscribe the topic with the full URL including the secret — the endpoint confirms the subscription itself and rejects anything without it."
          stacked
        >
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12px] text-ink-soft">
              {display}
            </p>
            {env.SNS_WEBHOOK_SECRET ? (
              <CopyButton value={url} label="Copy" />
            ) : null}
          </div>
        </SettingRow>
      </SettingsSection>

      {project.sesConfigurationSet ? null : (
        <Callout tone="warning" title="No configuration set">
          Set one under Amazon SES. Without it, SES has nowhere to publish these
          events and delivery stays unknown.
        </Callout>
      )}
    </Content>
  );
}
