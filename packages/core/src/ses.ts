import { AwsClient } from "aws4fetch";

export interface SesCredentials {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  configurationSet?: string | null;
}

export interface SesMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
}

export class SesError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly type?: string,
  ) {
    super(message);
    this.name = "SesError";
  }

  /** 4xx other than throttling will never succeed on a retry. */
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

function client(credentials: SesCredentials): AwsClient {
  return new AwsClient({
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    region: credentials.region,
    service: "ses",
  });
}

function endpoint(region: string, path: string): string {
  return `https://email.${region}.amazonaws.com${path}`;
}

async function call(
  credentials: SesCredentials,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const response = await client(credentials).fetch(
    endpoint(credentials.region, path),
    {
      method: init?.method ?? "GET",
      headers: { "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    },
  );

  const raw = await response.text();
  const parsed = raw ? safeJson(raw) : {};

  if (!response.ok) {
    const detail = parsed as { message?: string; Message?: string; type?: string };
    throw new SesError(
      detail.message ?? detail.Message ?? raw ?? response.statusText,
      response.status,
      detail.type,
    );
  }
  return parsed;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
}

/** Sends one message through the SES v2 API. Returns the SES message id. */
export async function sendViaSes(
  credentials: SesCredentials,
  message: SesMessage,
): Promise<string> {
  const body = {
    FromEmailAddress: message.from,
    Destination: { ToAddresses: [message.to] },
    ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
    ConfigurationSetName: credentials.configurationSet || undefined,
    EmailTags: message.tags
      ? Object.entries(message.tags).map(([Name, Value]) => ({
          Name,
          // SES only allows these characters in tag values.
          Value: Value.replace(/[^\w-]/g, "-").slice(0, 256),
        }))
      : undefined,
    Content: {
      Simple: {
        Subject: { Data: message.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: message.html, Charset: "UTF-8" },
          Text: { Data: message.text, Charset: "UTF-8" },
        },
        Headers: message.headers
          ? Object.entries(message.headers).map(([Name, Value]) => ({
              Name,
              Value,
            }))
          : undefined,
      },
    },
  };

  const result = (await call(credentials, "/v2/email/outbound-emails", {
    method: "POST",
    body,
  })) as { MessageId?: string };

  if (!result.MessageId) throw new SesError("SES returned no MessageId", 502);
  return result.MessageId;
}

export interface SesAccountInfo {
  sendingEnabled: boolean;
  productionAccess: boolean;
  maxSendRate: number;
  max24HourSend: number;
  sentLast24Hours: number;
}

/** Used by the settings screen to validate credentials and show quotas. */
export async function getSesAccount(
  credentials: SesCredentials,
): Promise<SesAccountInfo> {
  const result = (await call(credentials, "/v2/email/account")) as {
    SendingEnabled?: boolean;
    ProductionAccessEnabled?: boolean;
    SendQuota?: {
      MaxSendRate?: number;
      Max24HourSend?: number;
      SentLast24Hours?: number;
    };
  };
  return {
    sendingEnabled: result.SendingEnabled ?? false,
    productionAccess: result.ProductionAccessEnabled ?? false,
    maxSendRate: result.SendQuota?.MaxSendRate ?? 0,
    max24HourSend: result.SendQuota?.Max24HourSend ?? 0,
    sentLast24Hours: result.SendQuota?.SentLast24Hours ?? 0,
  };
}

export interface SesIdentity {
  identity: string;
  verifiedForSending: boolean;
  dkimStatus?: string;
  dkimTokens: string[];
  mailFromDomain?: string;
}

/** Reads a domain identity, including the DKIM CNAMEs to publish. */
export async function getSesIdentity(
  credentials: SesCredentials,
  identity: string,
): Promise<SesIdentity> {
  const result = (await call(
    credentials,
    `/v2/email/identities/${encodeURIComponent(identity)}`,
  )) as {
    VerifiedForSendingStatus?: boolean;
    DkimAttributes?: { Status?: string; Tokens?: string[] };
    MailFromAttributes?: { MailFromDomain?: string };
  };
  return {
    identity,
    verifiedForSending: result.VerifiedForSendingStatus ?? false,
    dkimStatus: result.DkimAttributes?.Status,
    dkimTokens: result.DkimAttributes?.Tokens ?? [],
    mailFromDomain: result.MailFromAttributes?.MailFromDomain,
  };
}

/** Creates a domain identity with Easy DKIM, returning the CNAME tokens. */
export async function createSesDomainIdentity(
  credentials: SesCredentials,
  domain: string,
): Promise<string[]> {
  const result = (await call(credentials, "/v2/email/identities", {
    method: "POST",
    body: {
      EmailIdentity: domain,
      DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
      ConfigurationSetName: credentials.configurationSet || undefined,
    },
  })) as { DkimAttributes?: { Tokens?: string[] } };
  return result.DkimAttributes?.Tokens ?? [];
}
