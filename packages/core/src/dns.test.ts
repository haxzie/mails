import { describe, expect, it } from "vitest";
import { analyzeDomainDns, bindZoneFile, dnsRecordsFor } from "./dns";

const identity = {
  identity: "acme.com",
  verifiedForSending: true,
  dkimTokens: ["tok1", "tok2", "tok3"],
};

describe("bindZoneFile", () => {
  const zone = bindZoneFile(
    "acme.com",
    dnsRecordsFor("acme.com", "us-east-1", identity),
    { generatedAt: new Date("2026-10-15T00:00:00Z") },
  );

  it("declares a default TTL", () => {
    expect(zone).toContain("$TTL 3600");
  });

  it("writes fully qualified CNAMEs for every DKIM token", () => {
    expect(zone).toContain(
      "tok1._domainkey.acme.com.\t3600\tIN\tCNAME\ttok1.dkim.amazonses.com.",
    );
    expect(zone.match(/IN\tCNAME/g)).toHaveLength(3);
  });

  it("keeps the MX priority and terminates the target", () => {
    expect(zone).toContain(
      "mail.acme.com.\t3600\tIN\tMX\t10 feedback-smtp.us-east-1.amazonses.com.",
    );
  });

  it("quotes TXT data exactly once", () => {
    expect(zone).toContain(
      'mail.acme.com.\t3600\tIN\tTXT\t"v=spf1 include:amazonses.com ~all"',
    );
    expect(zone).not.toContain('""v=spf1');
  });

  it("splits TXT values longer than 255 characters", () => {
    const long = "x".repeat(300);
    const zone = bindZoneFile("acme.com", [
      { purpose: "Long", type: "TXT", name: "long.acme.com", value: `"${long}"` },
    ]);
    expect(zone).toContain(`"${"x".repeat(255)}" "${"x".repeat(45)}"`);
  });

  it("comments out records SES has not issued yet", () => {
    const zone = bindZoneFile(
      "acme.com",
      dnsRecordsFor("acme.com", "us-east-1", null),
    );
    expect(zone).toContain("; DKIM: not available yet");
    expect(zone).not.toContain("<token>._domainkey.acme.com.\t");
  });

  it("ends with a newline", () => {
    expect(zone.endsWith("\n")).toBe(true);
  });
});

describe("BIMI records", () => {
  it("is left out until a logo is configured", () => {
    const records = dnsRecordsFor("acme.com", "us-east-1", identity);
    expect(records.some((record) => record.purpose === "BIMI")).toBe(false);
    expect(records.find((r) => r.purpose === "DMARC")?.value).toContain("p=none");
  });

  it("publishes the logo and raises the recommended DMARC policy", () => {
    const records = dnsRecordsFor("acme.com", "us-east-1", identity, {
      logoUrl: "https://acme.com/bimi/logo.svg",
      certificateUrl: "https://acme.com/bimi/vmc.pem",
    });
    const bimi = records.find((record) => record.purpose === "BIMI");
    expect(bimi?.name).toBe("default._bimi.acme.com");
    expect(bimi?.value).toBe(
      '"v=BIMI1; l=https://acme.com/bimi/logo.svg; a=https://acme.com/bimi/vmc.pem"',
    );
    expect(records.find((r) => r.purpose === "DMARC")?.value).toContain(
      "p=quarantine",
    );
  });

  it("omits a= and warns when there is no certificate", () => {
    const bimi = dnsRecordsFor("acme.com", "us-east-1", identity, {
      logoUrl: "https://acme.com/bimi/logo.svg",
    }).find((record) => record.purpose === "BIMI");
    expect(bimi?.value).toBe('"v=BIMI1; l=https://acme.com/bimi/logo.svg"');
    expect(bimi?.note).toContain("Gmail");
  });
});

describe("analyzeDomainDns", () => {
  const healthy = {
    dmarc: ["v=DMARC1; p=quarantine; rua=mailto:dmarc@acme.com"],
    spf: ["v=spf1 include:amazonses.com ~all"],
    bimi: [],
    dkim: [{ token: "tok1", targets: ["tok1.dkim.amazonses.com."] }],
  };

  const find = (findings: ReturnType<typeof analyzeDomainDns>, title: string) =>
    findings.find((finding) => finding.title.includes(title));

  it("passes a correctly configured domain", () => {
    const findings = analyzeDomainDns("acme.com", healthy);
    expect(findings.every((finding) => finding.level === "ok")).toBe(true);
  });

  it("treats two DMARC records as an error, not a duplicate", () => {
    const findings = analyzeDomainDns("acme.com", {
      ...healthy,
      dmarc: ["v=DMARC1; p=reject; rua=mailto:a@acme.com", "v=DMARC1; p=none;"],
    });
    expect(find(findings, "DMARC records published")?.level).toBe("error");
  });

  it("flags a missing DMARC record", () => {
    const findings = analyzeDomainDns("acme.com", { ...healthy, dmarc: [] });
    expect(find(findings, "No DMARC record")?.level).toBe("error");
  });

  it("escalates p=none from a warning to an error once BIMI is configured", () => {
    const monitoring = { ...healthy, dmarc: ["v=DMARC1; p=none;"] };
    expect(find(analyzeDomainDns("acme.com", monitoring), "p=none")?.level).toBe(
      "warning",
    );
    expect(
      find(
        analyzeDomainDns("acme.com", monitoring, {
          logoUrl: "https://acme.com/logo.svg",
        }),
        "p=none",
      )?.level,
    ).toBe("error");
  });

  it("catches SPF that forgets SES, and duplicate SPF records", () => {
    expect(
      find(
        analyzeDomainDns("acme.com", { ...healthy, spf: ["v=spf1 include:_spf.google.com ~all"] }),
        "does not include Amazon SES",
      )?.level,
    ).toBe("error");
    expect(
      find(
        analyzeDomainDns("acme.com", {
          ...healthy,
          spf: ["v=spf1 include:amazonses.com ~all", "v=spf1 ~all"],
        }),
        "More than one SPF record",
      )?.level,
    ).toBe("error");
  });

  it("names the DKIM tokens that are not published", () => {
    const findings = analyzeDomainDns("acme.com", {
      ...healthy,
      dkim: [
        { token: "tok1", targets: ["tok1.dkim.amazonses.com."] },
        { token: "tok2", targets: [] },
      ],
    });
    expect(find(findings, "DKIM records missing")?.detail).toContain("tok2");
  });

  it("warns when a published BIMI record has no certificate", () => {
    const findings = analyzeDomainDns(
      "acme.com",
      { ...healthy, bimi: ["v=BIMI1; l=https://acme.com/logo.svg"] },
      { logoUrl: "https://acme.com/logo.svg" },
    );
    expect(find(findings, "no certificate")?.level).toBe("warning");
  });
});
