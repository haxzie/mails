import Link from "next/link";
import { verifyCodeAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/client";
import { Callout, Field, Input } from "@/components/shell";

export const instant = false;

export default async function VerifyPage({
  searchParams,
}: PageProps<"/login/verify">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const devCode = typeof params.dev_code === "string" ? params.dev_code : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <div className="rounded-(--radius-card) border border-line bg-surface p-7 shadow-[0_1px_2px_rgba(16,16,22,0.04)]">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]">
          Check your email
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          We sent a link and a 6-digit code to{" "}
          <span className="font-medium text-ink">{email || "your inbox"}</span>.
        </p>

        {devCode ? (
          <div className="mt-4">
            <Callout tone="warning" title="Development mode">
              No SYSTEM_SES_* credentials are configured, so nothing was
              emailed. Your code is <strong>{devCode}</strong>.
            </Callout>
          </div>
        ) : null}

        <ActionForm action={verifyCodeAction} className="mt-5 space-y-3">
          <input type="hidden" name="email" value={email} />
          <Field label="One-time code">
            <Input
              name="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              defaultValue={devCode ?? ""}
              required
              autoFocus
              className="text-center text-[18px] tracking-[0.3em]"
            />
          </Field>
          <SubmitButton className="w-full">Sign in</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-[12px] text-ink-muted">
        <Link href="/login" className="underline">
          Use a different address
        </Link>
      </p>
    </main>
  );
}
