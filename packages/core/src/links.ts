import { signPayload, verifyPayload } from "./crypto";

/** Signed, stateless links for unsubscribe and tracking. */

export async function unsubscribeUrl(
  apiUrl: string,
  secret: string,
  projectId: string,
  contactId: string,
): Promise<string> {
  const token = await signPayload(`u:${projectId}:${contactId}`, secret);
  return `${apiUrl}/u/${token}`;
}

export async function parseUnsubscribeToken(token: string, secret: string) {
  const payload = await verifyPayload(token, secret);
  if (!payload) return null;
  const [kind, projectId, contactId] = payload.split(":");
  if (kind !== "u" || !projectId || !contactId) return null;
  return { projectId, contactId };
}

export async function openUrl(
  apiUrl: string,
  secret: string,
  emailId: string,
): Promise<string> {
  const token = await signPayload(`o:${emailId}`, secret);
  return `${apiUrl}/t/o/${token}`;
}

export async function parseOpenToken(token: string, secret: string) {
  const payload = await verifyPayload(token, secret);
  if (!payload) return null;
  const [kind, emailId] = payload.split(":");
  if (kind !== "o" || !emailId) return null;
  return { emailId };
}

export async function clickUrl(
  apiUrl: string,
  secret: string,
  emailId: string,
  target: string,
): Promise<string> {
  // The target is part of the signed payload, so the redirect can never be
  // pointed somewhere else by editing the link.
  const token = await signPayload(`c:${emailId}:${target}`, secret);
  return `${apiUrl}/t/c/${token}`;
}

export async function parseClickToken(token: string, secret: string) {
  const payload = await verifyPayload(token, secret);
  if (!payload) return null;
  const parts = payload.split(":");
  const kind = parts.shift();
  const emailId = parts.shift();
  const target = parts.join(":");
  if (kind !== "c" || !emailId || !target) return null;
  return { emailId, target };
}
