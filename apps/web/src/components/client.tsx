"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check, Copy, Download } from "lucide-react";
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

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, copy] = useCopy(value);
  return (
    <button type="button" className={buttonClass("secondary", "sm")} onClick={copy}>
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * A value you are meant to paste somewhere else: the text plus a quiet copy
 * button, so each field of a DNS record can be taken on its own.
 */
export function CopyValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [copied, copy] = useCopy(value);
  return (
    <span className="flex items-start gap-1.5">
      <span className={cx("min-w-0 font-mono text-[11.5px] break-all", className)}>
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${value}`}
        title={copied ? "Copied" : "Copy"}
        className="mt-px shrink-0 rounded-md p-1 text-ink-muted transition-colors hover:bg-hover hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {copied ? (
          <Check className="size-3.5 text-positive" strokeWidth={2} />
        ) : (
          <Copy className="size-3.5" strokeWidth={1.75} />
        )}
      </button>
    </span>
  );
}

/** Saves text to a file, for anything too long to paste by hand. */
export function DownloadButton({
  content,
  filename,
  label = "Download",
  type = "text/plain",
}: {
  content: string;
  filename: string;
  label?: string;
  type?: string;
}) {
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm")}
      onClick={() => {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="size-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

/** Copies a string and reports a short-lived "copied" state. */
function useCopy(value: string): [boolean, () => Promise<void>] {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    async () => {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
  ];
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

