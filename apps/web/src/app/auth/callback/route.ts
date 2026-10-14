import { AuthError, consumeLogin, createSession } from "@mails/core";
import { getDb, getEnv } from "@/lib/cloudflare";
import { setSessionCookie } from "@/lib/session";

/** Target of the magic link: verifies the token and opens a session. */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  const env = await getEnv();
  if (!token) return Response.redirect(`${env.APP_URL}/login`, 302);

  try {
    const user = await consumeLogin(env, { token });
    const session = await createSession(await getDb(), user.id);
    await setSessionCookie(session.token, session.expiresAt);
    return Response.redirect(`${env.APP_URL}/`, 302);
  } catch (error) {
    const message =
      error instanceof AuthError ? error.message : "Could not sign you in";
    return Response.redirect(
      `${env.APP_URL}/login?error=${encodeURIComponent(message)}`,
      302,
    );
  }
}
