"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, cx, type ButtonVariant } from "./shell";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  confirm,
  className,
  name,
  value,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  confirm?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm")}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/** Wraps a server action so its error message can be rendered inline. */
export function FormMessage({
  state,
}: {
  state: { error?: string; success?: string } | null;
}) {
  if (!state?.error && !state?.success) return null;
  return (
    <p
      className={cx(
        "rounded-lg border px-3 py-2 text-[12.5px]",
        state.error
          ? "border-negative/20 bg-negative-soft text-negative"
          : "border-positive/20 bg-positive-soft text-positive",
      )}
    >
      {state.error ?? state.success}
    </p>
  );
}

export type ActionState = { error?: string; success?: string } | null;

/**
 * A form bound to a server action that renders the action's result inline,
 * so pages stay server components and still show validation errors.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

