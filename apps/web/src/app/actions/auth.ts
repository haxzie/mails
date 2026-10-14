"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  AuthError,
  SESSION_COOKIE,
  consumeLogin,
  createSession,
  deleteSession,
  requestLogin,
} from "@mails/core";
import type { ActionState } from "@/components/client";
import { getDb, getEnv } from "@/lib/cloudflare";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export async function requestLoginAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  try {
    const result = await requestLogin(await getEnv(), email);
    // Without a system SES identity (local dev) the link is logged and the
    // code is handed straight back so you can still sign in.
    const query = new URLSearchParams({ email: result.email });
    if (result.devCode) query.set("dev_code", result.devCode);
    redirect(`/login/verify?${query.toString()}`);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function verifyCodeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  try {
    const user = await consumeLogin(await getEnv(), { email, code });
    const db = await getDb();
    const session = await createSession(db, user.id);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  await clearSessionCookie();
  redirect("/login");
}
