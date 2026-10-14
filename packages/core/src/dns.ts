import type { SesIdentity } from "./ses";

export interface DnsRecord {
  purpose: string;
  type: "TXT" | "CNAME" | "MX";
  name: string;
  value: string;
  note?: string;
}

/**
 * The records a sending domain needs for inbox placement:
 * SPF (envelope alignment via a custom MAIL FROM), DKIM (SES Easy DKIM)
 * and DMARC. Shown as a checklist in project settings.
 */
export function dnsRecordsFor(
  domain: string,
  region: string,
  identity?: SesIdentity | null,
): DnsRecord[] {
  const mailFrom = `mail.${domain}`;
  const records: DnsRecord[] = [];

  for (const token of identity?.dkimTokens ?? []) {
    records.push({
      purpose: "DKIM",
      type: "CNAME",
      name: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
      note: "SES Easy DKIM — signs every message with your domain",
    });
  }
  if (!identity?.dkimTokens.length) {
    records.push({
      purpose: "DKIM",
      type: "CNAME",
      name: `<token>._domainkey.${domain}`,
      value: "<token>.dkim.amazonses.com",
      note: "Save your SES credentials and verify the domain to generate the three DKIM tokens",
    });
  }

  records.push(
    {
      purpose: "Custom MAIL FROM (SPF alignment)",
      type: "MX",
      name: mailFrom,
      value: `10 feedback-smtp.${region}.amazonses.com`,
      note: "Lets SES use your subdomain as the bounce domain so SPF aligns with your From address",
    },
    {
      purpose: "SPF",
      type: "TXT",
      name: mailFrom,
      value: '"v=spf1 include:amazonses.com ~all"',
    },
    {
      purpose: "DMARC",
      type: "TXT",
      name: `_dmarc.${domain}`,
      value: `"v=DMARC1; p=none; rua=mailto:dmarc@${domain}; fo=1; pct=100"`,
      note: "Start at p=none, review the aggregate reports, then move to quarantine and reject",
    },
  );

  return records;
}
