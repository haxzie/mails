import type { SesIdentity } from "./ses";

export interface DnsRecord {
  purpose: string;
  type: "TXT" | "CNAME" | "MX";
  name: string;
  value: string;
  note?: string;
}

export interface BimiConfig {
  logoUrl?: string | null;
  certificateUrl?: string | null;
}

/**
 * The records a sending domain needs for inbox placement:
 * SPF (envelope alignment via a custom MAIL FROM), DKIM (SES Easy DKIM),
 * DMARC, and BIMI when a logo is configured.
 */
export function dnsRecordsFor(
  domain: string,
  region: string,
  identity?: SesIdentity | null,
  bimi?: BimiConfig | null,
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
      // BIMI is ignored unless DMARC is at enforcement, so the recommended
      // policy follows whether a logo is configured.
      value: bimi?.logoUrl
        ? `"v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; fo=1; pct=100"`
        : `"v=DMARC1; p=none; rua=mailto:dmarc@${domain}; fo=1; pct=100"`,
      note: bimi?.logoUrl
        ? "BIMI needs p=quarantine or p=reject — publish exactly one DMARC record"
        : "Start at p=none, review the aggregate reports, then move to quarantine and reject",
    },
  );

  if (bimi?.logoUrl) {
    const certificate = bimi.certificateUrl
      ? `; a=${bimi.certificateUrl}`
      : "";
    records.push({
      purpose: "BIMI",
      type: "TXT",
      name: `default._bimi.${domain}`,
      value: `"v=BIMI1; l=${bimi.logoUrl}${certificate}"`,
      note: bimi.certificateUrl
        ? "The logo mailbox providers show next to your name"
        : "Without a VMC or CMC in a=, Gmail, Yahoo and Apple Mail will not render the logo",
    });
  }

  return records;
}

/* ------------------------------------------------------------- dns check */

export interface DnsFinding {
  level: "ok" | "warning" | "error";
  title: string;
  detail: string;
}

export interface DomainDnsSnapshot {
  dmarc: string[];
  spf: string[];
  bimi: string[];
  dkim: { token: string; targets: string[] }[];
}

/**
 * Turns what is actually published into a list of findings. Pure, so the
 * rules can be tested without touching the network.
 */
export function analyzeDomainDns(
  domain: string,
  snapshot: DomainDnsSnapshot,
  bimi?: BimiConfig | null,
): DnsFinding[] {
  const findings: DnsFinding[] = [];

  const dmarcRecords = snapshot.dmarc.filter((record) =>
    /^v=DMARC1\b/i.test(record.trim()),
  );
  if (dmarcRecords.length === 0) {
    findings.push({
      level: "error",
      title: "No DMARC record",
      detail: `Nothing at _dmarc.${domain}. Without DMARC, receivers cannot tell your mail from a forgery, and BIMI is off the table.`,
    });
  } else if (dmarcRecords.length > 1) {
    findings.push({
      level: "error",
      title: `${dmarcRecords.length} DMARC records published`,
      detail:
        "RFC 7489 says a domain with more than one DMARC record is treated as having none at all. Delete the extras so exactly one is left.",
    });
  } else {
    const policy = /\bp\s*=\s*(none|quarantine|reject)/i.exec(
      dmarcRecords[0]!,
    )?.[1]?.toLowerCase();
    if (policy === "none") {
      findings.push({
        level: bimi?.logoUrl ? "error" : "warning",
        title: "DMARC is at p=none",
        detail: bimi?.logoUrl
          ? "BIMI is ignored below p=quarantine, so your logo will never be shown. Review your aggregate reports, then raise the policy."
          : "Monitoring only — nothing is enforced. Once the aggregate reports look clean, move to p=quarantine.",
      });
    } else {
      findings.push({
        level: "ok",
        title: `DMARC is at p=${policy ?? "unknown"}`,
        detail: "Receivers will act on messages that fail authentication.",
      });
    }
  }

  const spfRecords = snapshot.spf.filter((record) =>
    /^v=spf1\b/i.test(record.trim()),
  );
  if (spfRecords.length === 0) {
    findings.push({
      level: "warning",
      title: "No SPF record on the MAIL FROM subdomain",
      detail: `Publish "v=spf1 include:amazonses.com ~all" at mail.${domain} so SPF aligns with your From address.`,
    });
  } else if (spfRecords.length > 1) {
    findings.push({
      level: "error",
      title: "More than one SPF record",
      detail:
        "Two SPF records is a permanent error for receivers; merge them into one.",
    });
  } else if (!/include:amazonses\.com/i.test(spfRecords[0]!)) {
    findings.push({
      level: "error",
      title: "SPF does not include Amazon SES",
      detail: "Add include:amazonses.com, or SES mail will fail SPF.",
    });
  } else {
    findings.push({
      level: "ok",
      title: "SPF includes Amazon SES",
      detail: spfRecords[0]!,
    });
  }

  const missingDkim = snapshot.dkim.filter(
    (entry) =>
      !entry.targets.some((target) =>
        target.replace(/\.$/, "").endsWith("dkim.amazonses.com"),
      ),
  );
  if (snapshot.dkim.length === 0) {
    findings.push({
      level: "warning",
      title: "No DKIM tokens to check",
      detail: "Verify the domain with SES first — it issues three CNAMEs.",
    });
  } else if (missingDkim.length > 0) {
    findings.push({
      level: "error",
      title: `${missingDkim.length} of ${snapshot.dkim.length} DKIM records missing`,
      detail: `Publish the CNAME for ${missingDkim
        .map((entry) => entry.token)
        .join(", ")}. Unsigned mail is treated as suspicious.`,
    });
  } else {
    findings.push({
      level: "ok",
      title: "All three DKIM records resolve",
      detail: "Your mail is signed with your own domain.",
    });
  }

  const bimiRecords = snapshot.bimi.filter((record) =>
    /^v=BIMI1\b/i.test(record.trim()),
  );
  if (bimi?.logoUrl && bimiRecords.length === 0) {
    findings.push({
      level: "warning",
      title: "BIMI record not published yet",
      detail: `Add the TXT record at default._bimi.${domain} from the table below.`,
    });
  } else if (bimiRecords.length > 1) {
    findings.push({
      level: "error",
      title: "More than one BIMI record",
      detail: "Keep exactly one record at default._bimi.",
    });
  } else if (bimiRecords.length === 1) {
    const record = bimiRecords[0]!;
    if (!/\bl\s*=\s*https:/i.test(record)) {
      findings.push({
        level: "error",
        title: "BIMI record has no logo",
        detail: "The l= tag must be an https URL to an SVG Tiny P/S file.",
      });
    } else if (!/\ba\s*=\s*https:/i.test(record)) {
      findings.push({
        level: "warning",
        title: "BIMI record has no certificate",
        detail:
          "Gmail, Yahoo and Apple Mail only render the logo when a= points at a VMC or CMC. Other providers will show it without one.",
      });
    } else {
      findings.push({
        level: "ok",
        title: "BIMI record published with a certificate",
        detail: record,
      });
    }
  }

  return findings;
}

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

async function lookup(name: string, type: "TXT" | "CNAME"): Promise<string[]> {
  const response = await fetch(
    `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!response.ok) return [];
  const body = (await response.json()) as {
    Answer?: { type: number; data: string }[];
  };
  return (body.Answer ?? []).map((answer) =>
    // TXT answers arrive quoted, and long ones as several quoted strings.
    type === "TXT"
      ? answer.data
          .trim()
          .replace(/^"|"$/g, "")
          .replace(/"\s+"/g, "")
      : answer.data.trim(),
  );
}

/** Reads what the domain currently publishes, over DNS-over-HTTPS. */
export async function fetchDomainDns(
  domain: string,
  dkimTokens: string[] = [],
): Promise<DomainDnsSnapshot> {
  const [dmarc, spf, bimi, ...dkim] = await Promise.all([
    lookup(`_dmarc.${domain}`, "TXT"),
    lookup(`mail.${domain}`, "TXT"),
    lookup(`default._bimi.${domain}`, "TXT"),
    ...dkimTokens.map((token) =>
      lookup(`${token}._domainkey.${domain}`, "CNAME"),
    ),
  ]);

  return {
    dmarc,
    spf,
    bimi,
    dkim: dkimTokens.map((token, index) => ({
      token,
      targets: dkim[index] ?? [],
    })),
  };
}

export interface ZoneFileOptions {
  ttl?: number;
  generatedAt?: Date;
}

/** Splits a TXT value into the 255 character strings the protocol allows. */
function txtChunks(value: string): string {
  const unquoted = value.trim().replace(/^"(.*)"$/s, "$1");
  const chunks: string[] = [];
  for (let i = 0; i < unquoted.length; i += 255) {
    chunks.push(unquoted.slice(i, i + 255));
  }
  if (chunks.length === 0) chunks.push("");
  return chunks.map((chunk) => `"${chunk.replace(/"/g, '\\"')}"`).join(" ");
}

function fqdn(name: string): string {
  return name.endsWith(".") ? name : `${name}.`;
}

/**
 * Renders the records as a BIND master file, for registrars and DNS
 * providers that take a zone import instead of one form per record.
 */
export function bindZoneFile(
  domain: string,
  records: DnsRecord[],
  { ttl = 3600, generatedAt = new Date() }: ZoneFileOptions = {},
): string {
  const lines: string[] = [
    `; DNS records for ${domain}`,
    `; Generated by Mails on ${generatedAt.toISOString().slice(0, 10)}`,
    "; Import this zone, or add the records one by one.",
    "",
    `$TTL ${ttl}`,
    "",
  ];

  for (const record of records) {
    // Placeholder rows (DKIM before SES has issued the tokens) cannot be
    // published, so they are left as a comment rather than a broken record.
    if (record.name.includes("<") || record.value.includes("<")) {
      lines.push(
        `; ${record.purpose}: not available yet — ${record.note ?? "verify the domain with SES first"}`,
        "",
      );
      continue;
    }

    let data: string;
    if (record.type === "TXT") {
      data = txtChunks(record.value);
    } else if (record.type === "MX") {
      const [priority, ...rest] = record.value.trim().split(/\s+/);
      data = `${priority} ${fqdn(rest.join(" "))}`;
    } else {
      data = fqdn(record.value.trim());
    }

    lines.push(
      `; ${record.purpose}`,
      `${fqdn(record.name)}\t${ttl}\tIN\t${record.type}\t${data}`,
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
