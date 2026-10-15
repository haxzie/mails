import {
  bindZoneFile,
  dnsRecordsFor,
  getSesIdentity,
  projectSesCredentials,
  type SesIdentity,
} from "@mails/core";
import { FileCode } from "lucide-react";
import { verifyDomainAction } from "@/app/actions/projects";
import {
  ActionForm,
  CopyButton,
  CopyValue,
  DownloadButton,
  SubmitButton,
} from "@/components/client";
import { PanelButton } from "@/components/panel";
import {
  Badge,
  Content,
  Mono,
  SettingRow,
  SettingsSection,
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
  const zone = project.sendingDomain
    ? bindZoneFile(project.sendingDomain, records)
    : "";

  return (
    <Content className="max-w-4xl space-y-7">
      <ActionForm action={verifyDomainAction}>
        <input type="hidden" name="slug" value={slug} />
        <SettingsSection
          title="Domain verification"
          description="Registers the domain with SES and turns on Easy DKIM."
        >
          <SettingRow
            label={project.sendingDomain ?? "No sending domain set"}
            description={
              identity
                ? `SES status: DKIM ${identity.dkimStatus ?? "unknown"}, sending ${
                    identity.verifiedForSending ? "verified" : "not verified"
                  }.`
                : identityError
                  ? `SES says: ${identityError}`
                  : "Set a sending domain under Sending identity, and SES credentials under Amazon SES, first."
            }
            control="w-auto"
          >
            <div className="flex items-center gap-2">
              {identity?.verifiedForSending ? (
                <Badge tone="positive">verified</Badge>
              ) : (
                <Badge tone="warning">pending</Badge>
              )}
              <SubmitButton variant="secondary" size="sm">
                {identity ? "Re-check" : "Verify domain"}
              </SubmitButton>
            </div>
          </SettingRow>
        </SettingsSection>
      </ActionForm>

      <SettingsSection
        title="DNS records"
        description="Publish all of these. Without DKIM and DMARC alignment, Gmail and Outlook throttle or spam-folder bulk mail."
        action={
          records.length ? (
            <PanelButton
              label="BIND zone file"
              title="BIND zone file"
              description={`Import this into your DNS provider, or add the records by hand.`}
              width="lg"
              icon={<FileCode className="size-3.5" strokeWidth={1.75} />}
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  <CopyButton value={zone} label="Copy zone file" />
                  <DownloadButton
                    content={zone}
                    filename={`${project.sendingDomain}.zone`}
                    label="Download .zone"
                  />
                </div>
                <pre className="block w-full max-w-full overflow-x-auto rounded-lg border border-line bg-canvas px-3 py-3 font-mono text-[11.5px] leading-relaxed text-ink-soft">
                  {zone}
                </pre>
                <p className="text-[12.5px] text-ink-muted">
                  Records SES has not issued yet are left as comments. TTLs are
                  one hour; lower them while you are still changing records.
                </p>
              </div>
            </PanelButton>
          ) : null
        }
      >
        {records.length === 0 ? (
          <SettingRow
            label="Nothing to publish yet"
            description="Set a sending domain to generate the records you need."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Purpose</Th>
                <Th>Type</Th>
                <Th>Name</Th>
                <Th>Value</Th>
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
                  <Td>
                    <CopyValue value={record.name} />
                  </Td>
                  <Td>
                    <CopyValue value={record.value} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SettingsSection>
    </Content>
  );
}
