import type { Metadata } from "next";
import { requestLoginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/client";
import { Field, Input } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in · Mails" };
export const instant = false;

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <div className="rounded-(--radius-card) border border-line bg-surface p-7 shadow-[0_1px_2px_rgba(16,16,22,0.04)]">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]">
          Sign in to Mails
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          We’ll email you a sign-in link and a one-time code. No password.
        </p>

        <ActionForm action={requestLoginAction} className="mt-5 space-y-3">
          <Field label="Email address">
            <Input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              autoFocus
            />
          </Field>
          <SubmitButton className="w-full">Email me a link</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-[12px] text-ink-muted">
        Access is limited to the addresses in <code>ALLOWED_EMAILS</code>.
      </p>
    </main>
  );
}
