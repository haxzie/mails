import {
  dnsRecordsFor,
  getSesIdentity,
  projectSesCredentials,
  type SesIdentity,
} from "@mails/core";
import {
  deleteProjectAction,
  testSesAction,
  updateProjectAction,
  verifyDomainAction,
} from "@/app/actions/projects";
import { ActionForm, CopyButton, SubmitButton } from "@/components/client";
import {
  Badge,
  Card,
  CardHeader,
  Checkbox,
  Content,
  Field,
  Input,
  Mono,
  Select,
  Table,
  Td,
  Th,
  TopBar,
} from "@/components/ui";
import { getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";
import { SES_REGIONS } from "@/lib/regions";

export const instant = false;

export default async function SettingsPage({
  params,
}: PageProps<"/p/[slug]/settings">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const env = await getEnv();

  // Best effort: show live DKIM state when SES credentials already work.
  let identity: SesIdentity | null = null;
  let identityError: string | null = null;
  if (project.sendingDomain && project.sesAccessKeyId && project.sesSecretKey) {
    try {
      identity = await getSesIdentity(
        await projectSesCredentials(env, project),
        project.sendingDomain,
      );
    } catch (error) {
      identityError = error instanceof Error ? error.message : String(error);
    }
  }

  const records = project.sendingDomain
    ? dnsRecordsFor(project.sendingDomain, project.sesRegion, identity)
    : [];

  return (
    <>
      <TopBar
        title="Settings"
        description="Sending identity, Amazon SES credentials and deliverability"
      />

      <Content className="space-y-5">
        <Card>
          <CardHeader
            title="Project"
            description="Identity used for every email this project sends."
          />
          <ActionForm action={updateProjectAction} className="space-y-4 p-5">
            <input type="hidden" name="slug" value={slug} />

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Project name">
                <Input name="name" defaultValue={project.name} required />
              </Field>
              <Field label="URL slug">
                <Input defaultValue={project.slug} disabled />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="From name">
                <Input
                  name="fromName"
                  defaultValue={project.fromName}
                  placeholder={project.name}
                />
              </Field>
              <Field label="From email" hint="Must be a verified SES identity.">
                <Input
                  name="fromEmail"
                  type="email"
                  defaultValue={project.fromEmail}
                  placeholder="hello@acme.com"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Reply-to" hint="Optional. Where replies should land.">
                <Input
                  name="replyTo"
                  type="email"
                  defaultValue={project.replyTo ?? ""}
                />
              </Field>
              <Field
                label="Sending domain"
                hint="Used for DKIM, SPF alignment and the unsubscribe mailbox."
              >
                <Input
                  name="sendingDomain"
                  defaultValue={project.sendingDomain ?? ""}
                  placeholder="acme.com"
                />
              </Field>
            </div>

            <Field
              label="Postal address"
              hint="Rendered in the footer of bulk email. CAN-SPAM requires a physical mailing address."
            >
              <Input
                name="postalAddress"
                defaultValue={project.postalAddress ?? ""}
                placeholder="Acme Inc, 1 Market St, San Francisco, CA 94105"
              />
            </Field>

            <hr className="border-line" />

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="SES region">
                <Select name="sesRegion" defaultValue={project.sesRegion}>
                  {SES_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Configuration set"
                hint="Required for bounce, complaint, open and click events."
              >
                <Input
                  name="sesConfigurationSet"
                  defaultValue={project.sesConfigurationSet ?? ""}
                  placeholder="mails-events"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="SES access key id">
                <Input
                  name="sesAccessKeyId"
                  defaultValue={project.sesAccessKeyId ?? ""}
                  placeholder="AKIA…"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="SES secret access key"
                hint={
                  project.sesSecretKey
                    ? "A key is stored (encrypted). Leave empty to keep it."
                    : "Encrypted with ENCRYPTION_KEY before it is stored."
                }
              >
                <Input
                  name="sesSecretKey"
                  type="password"
                  placeholder={project.sesSecretKey ? "••••••••" : ""}
                  autoComplete="off"
                />
              </Field>
            </div>

            <Field
              label="Max send rate"
              hint="Messages per second. Keep it at or below your SES quota."
            >
              <Input
                name="sendRate"
                type="number"
                min={1}
                defaultValue={project.sendRate}
                className="max-w-32"
              />
            </Field>

            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox name="trackOpens" defaultChecked={project.trackOpens} />
              Track opens with a tracking pixel
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox name="trackClicks" defaultChecked={project.trackClicks} />
              Track clicks by rewriting links
            </label>

            <SubmitButton>Save settings</SubmitButton>
          </ActionForm>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader
              title="Connection"
              description="Checks the credentials against the SES account API."
            />
            <ActionForm action={testSesAction} className="space-y-3 p-5">
              <input type="hidden" name="slug" value={slug} />
              <SubmitButton variant="secondary">Test SES connection</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader
              title="Domain verification"
              description="Registers the domain with SES and turns on Easy DKIM."
            />
            <ActionForm action={verifyDomainAction} className="space-y-3 p-5">
              <input type="hidden" name="slug" value={slug} />
              <p className="text-[12.5px] text-ink-muted">
                {identity
                  ? `SES status: DKIM ${identity.dkimStatus ?? "unknown"}, sending ${
                      identity.verifiedForSending ? "verified" : "not verified"
                    }.`
                  : identityError
                    ? `SES says: ${identityError}`
                    : "Save a sending domain and SES credentials first."}
              </p>
              <SubmitButton variant="secondary">
                {identity ? "Re-check domain" : "Verify domain"}
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="DNS records"
            description="Publish all of these. Without DKIM and DMARC alignment, Gmail and Outlook will throttle or spam-folder bulk mail."
            action={
              identity?.verifiedForSending ? (
                <Badge tone="positive">verified</Badge>
              ) : (
                <Badge tone="warning">pending</Badge>
              )
            }
          />
          {records.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-ink-muted">
              Set a sending domain above to see the records you need.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Purpose</Th>
                  <Th>Type</Th>
                  <Th>Name</Th>
                  <Th>Value</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={`${record.type}-${record.name}`}>
                    <Td>
                      <p className="font-medium">{record.purpose}</p>
                      {record.note ? (
                        <p className="text-[11.5px] text-ink-muted">{record.note}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <Mono>{record.type}</Mono>
                    </Td>
                    <Td className="font-mono text-[11.5px] break-all">
                      {record.name}
                    </Td>
                    <Td className="font-mono text-[11.5px] break-all">
                      {record.value}
                    </Td>
                    <Td className="text-right">
                      <CopyButton value={record.value} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="SES event webhook"
            description="Point an SNS topic at this URL from your SES configuration set to receive bounces, complaints, deliveries, opens and clicks."
          />
          <div className="space-y-2 p-5">
            <p className="font-mono text-[12px] break-all text-ink-soft">
              {env.API_URL}/webhooks/ses?secret=
              {env.SNS_WEBHOOK_SECRET ? "••••••" : "<set SNS_WEBHOOK_SECRET>"}
            </p>
            <p className="text-[12.5px] text-ink-muted">
              Subscribe the topic with the full URL including the secret — the
              endpoint confirms the SNS subscription automatically.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Danger zone"
            description="Deleting a project removes its contacts, campaigns and logs. This cannot be undone."
          />
          <form action={deleteProjectAction} className="p-5">
            <input type="hidden" name="slug" value={slug} />
            <SubmitButton
              variant="danger"
              confirm={`Delete “${project.name}” and everything in it?`}
            >
              Delete project
            </SubmitButton>
          </form>
        </Card>
      </Content>
    </>
  );
}
