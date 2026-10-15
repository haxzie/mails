import {
  dnsRecordsFor,
  getSesIdentity,
  projectSesCredentials,
  type SesIdentity,
} from "@mails/core";
import { verifyDomainAction } from "@/app/actions/projects";
import { ActionForm, CopyButton, SubmitButton } from "@/components/client";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  Content,
  Mono,
  Table,
  Td,
  Th,
} from "@/components/shell";
import { getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

export const instant = false;

export default async function DomainSettingsPage({
  params,
}: PageProps<"/p/[slug]/settings/domain">) {
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
    <Content className="space-y-5">
      <Card>
        <CardHeader
          title="Domain verification"
          description="Registers the domain with SES and turns on Easy DKIM."
          action={
            identity?.verifiedForSending ? (
              <Badge tone="positive">verified</Badge>
            ) : (
              <Badge tone="warning">pending</Badge>
            )
          }
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
                : "Set a sending domain and SES credentials first."}
          </p>
          <SubmitButton variant="secondary">
            {identity ? "Re-check domain" : "Verify domain"}
          </SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader
          title="DNS records"
          description="Publish all of these. Without DKIM and DMARC alignment, Gmail and Outlook will throttle or spam-folder bulk mail."
        />
        {records.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-ink-muted">
            Set a sending domain in{" "}
            <span className="text-ink">Sending identity</span> to see the records
            you need.
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

      {project.sendingDomain ? null : (
        <Callout tone="warning" title="No sending domain">
          Add one under Sending identity — without it you cannot align SPF and
          DKIM with your From address.
        </Callout>
      )}
    </Content>
  );
}
