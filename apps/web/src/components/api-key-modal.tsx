"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createApiKeyAction } from "@/app/actions/keys";
import { CopyButton, FormMessage, SubmitButton } from "./client";
import { Modal } from "./modal";
import { Button, Callout, Field, Input, buttonClass } from "./shell";

/**
 * Creating a key swaps the form for the key itself: it is hashed on the way
 * into the database, so this is the only time it can be read.
 */
export function NewApiKeyModal({ slug }: { slug: string }) {
  // Remounting after a key has been shown is what clears the action result,
  // so the next click opens a blank form rather than the old key.
  const [generation, setGeneration] = useState(0);
  return (
    <KeyDialog
      key={generation}
      slug={slug}
      onDismissed={() => setGeneration((value) => value + 1)}
    />
  );
}

function KeyDialog({
  slug,
  onDismissed,
}: {
  slug: string;
  onDismissed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createApiKeyAction, null);
  const created = state?.value ?? null;

  const close = () => {
    setOpen(false);
    if (created) onDismissed();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("primary", "sm")}
      >
        <Plus className="size-3.5" strokeWidth={2} />
        New key
      </button>

      <Modal
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={created ? "API key created" : "New API key"}
        description={
          created
            ? undefined
            : "The full key is shown once, right after you create it."
        }
      >
        {created ? (
          <div className="space-y-4">
            <Field
              label="Your API key"
              hint="Put it in your backend's environment now."
            >
              <Input
                readOnly
                value={created}
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-[12.5px]"
              />
            </Field>

            <Callout tone="warning">
              This is the only time the key can be read — only a hash of it is
              stored. If you lose it, revoke it and create another.
            </Callout>

            <div className="flex gap-2">
              <CopyButton
                value={created}
                label="Copy key"
                variant="primary"
                size="md"
              />
              <Button variant="secondary" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Name" hint="So you can tell your keys apart later.">
              <Input name="name" placeholder="Production backend" autoFocus />
            </Field>
            <div className="flex gap-2 pt-1">
              <SubmitButton>Create key</SubmitButton>
              <Button variant="secondary" type="button" onClick={close}>
                Cancel
              </Button>
            </div>
            <FormMessage state={state} />
          </form>
        )}
      </Modal>
    </>
  );
}
