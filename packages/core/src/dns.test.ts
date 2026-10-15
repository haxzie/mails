import { describe, expect, it } from "vitest";
import { bindZoneFile, dnsRecordsFor } from "./dns";

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
