import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { loginTokens, sessions, users, type User } from "@mails/db/schema";
import { createId, type Database } from "@mails/db";
import { randomCode, randomToken, safeEqual, sha256 } from "./crypto";
import { isEmailAllowed, isLocalDeployment, type AppEnv } from "./env";
import { escapeHtml } from "./render";
import { db, sendSystemEmail, systemSesCredentials } from "./send";

export const SESSION_COOKIE = "mails_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const LOGIN_TTL = 1000 * 60 * 15; // 15 minutes
const MAX_ATTEMPTS = 5;

export class AuthError extends Error {}

/**
 * Issues a magic link + 6 digit code and mails it. Sign-in is restricted to
 * `ALLOWED_EMAILS`, so this doubles as the sign-up gate.
 */
export async function requestLogin(
  env: AppEnv,
  rawEmail: string,
): Promise<{ email: string; devToken?: string; devCode?: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) throw new AuthError("Enter a valid email address");
  if (!isEmailAllowed(env, email)) {
    throw new AuthError(
      "This address is not on the allowlist for this instance.",
    );
  }

  const database = db(env);
  const token = randomToken(32);
  const code = randomCode(6);
  const expiresAt = new Date(Date.now() + LOGIN_TTL);

  // Older pending tokens for this address are no longer usable.
  await database
    .update(loginTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(loginTokens.email, email), isNull(loginTokens.consumedAt)));

  await database.insert(loginTokens).values({
    id: createId("lgn"),
    email,
    tokenHash: await sha256(token),
    code,
    expiresAt,
  });

  const link = `${env.APP_URL}/auth/callback?token=${encodeURIComponent(token)}`;

  await sendSystemEmail(env, {
    to: email,
    subject: `Your Mails sign-in code: ${code}`,
    html: `<p style="font:15px/24px -apple-system,sans-serif">Click to sign in:</p>
<p><a href="${escapeHtml(link)}" style="font:15px/24px -apple-system,sans-serif">Sign in to Mails</a></p>
<p style="font:15px/24px -apple-system,sans-serif">Or enter this code: <strong style="font-size:20px;letter-spacing:2px">${code}</strong></p>
<p style="font:13px/20px -apple-system,sans-serif;color:#777">This link expires in 15 minutes. If you did not request it, ignore this email.</p>`,
  });

  // Handing the code back is a local-development convenience. On a deployed
  // instance it would let anyone who knows an allowlisted address sign in, so
  // it is gated on the app running locally, not on SES being unconfigured.
  if (isLocalDeployment(env)) {
    return { email, devToken: token, devCode: code };
  }
  if (!systemSesCredentials(env)) {
    throw new AuthError(
      "This instance cannot send sign-in emails yet: set the SYSTEM_SES_* secrets.",
    );
  }
  return { email };
}

async function findOrCreateUser(
  database: Database,
  email: string,
): Promise<User> {
  const existing = await database.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) return existing;
  const id = createId("usr");
  await database.insert(users).values({ id, email });
  const created = await database.query.users.findFirst({
    where: eq(users.id, id),
  });
  return created!;
}

/** Verifies a magic link token or an emailed code and returns the user. */
export async function consumeLogin(
  env: AppEnv,
  input: { token?: string; email?: string; code?: string },
): Promise<User> {
  const database = db(env);
  const now = new Date();

  if (input.token) {
    const hash = await sha256(input.token);
    const row = await database.query.loginTokens.findFirst({
      where: and(
        eq(loginTokens.tokenHash, hash),
        isNull(loginTokens.consumedAt),
        gt(loginTokens.expiresAt, now),
      ),
    });
    if (!row) throw new AuthError("This sign-in link is invalid or expired");
    await database
      .update(loginTokens)
      .set({ consumedAt: now })
      .where(eq(loginTokens.id, row.id));
    return findOrCreateUser(database, row.email);
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !input.code) throw new AuthError("Enter the code we emailed you");

  const row = await database.query.loginTokens.findFirst({
    where: and(
      eq(loginTokens.email, email),
      isNull(loginTokens.consumedAt),
      gt(loginTokens.expiresAt, now),
    ),
    orderBy: (table, { desc }) => desc(table.createdAt),
  });
  if (!row) throw new AuthError("That code is invalid or expired");
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new AuthError("Too many attempts — request a new code");
  }
  if (!safeEqual(row.code, input.code.trim())) {
    await database
      .update(loginTokens)
      .set({ attempts: row.attempts + 1 })
      .where(eq(loginTokens.id, row.id));
    throw new AuthError("That code is incorrect");
  }
  await database
    .update(loginTokens)
    .set({ consumedAt: now })
    .where(eq(loginTokens.id, row.id));
  return findOrCreateUser(database, email);
}

export async function createSession(
  database: Database,
  userId: string,
  userAgent?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL);
  await database.insert(sessions).values({
    id: await sha256(token),
    userId,
    expiresAt,
    userAgent: userAgent ?? null,
  });
  // Opportunistic cleanup of this user's expired sessions.
  await database
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  return { token, expiresAt };
}

export async function validateSession(
  database: Database,
  token: string,
): Promise<User | null> {
  const id = await sha256(token);
  const session = await database.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await database.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  const user = await database.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  return user ?? null;
}

export async function deleteSession(
  database: Database,
  token: string,
): Promise<void> {
  await database.delete(sessions).where(eq(sessions.id, await sha256(token)));
}
