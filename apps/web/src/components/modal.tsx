"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormMessage, type ActionState } from "./client";
import { buttonClass, cx, type ButtonVariant } from "./shell";

/** Lets content inside a modal dismiss it. */
const CloseContext = createContext<(() => void) | null>(null);

/** A button that opens its children in a shadcn (Radix) dialog. */
export function ModalButton({
  label,
  title,
  description,
  children,
  variant = "primary",
  size = "sm",
  width = "sm",
  icon,
  className,
}: {
  label: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  width?: "sm" | "md" | "lg";
  icon?: ReactNode;
  /** Replaces the button styling entirely, e.g. for a menu row. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={className ?? buttonClass(variant, size)}>
        {icon}
        {label}
      </DialogTrigger>
      <DialogContent
        className={cx(
          "max-h-[85vh] overflow-y-auto",
          width === "lg"
            ? "sm:max-w-[720px]"
            : width === "md"
              ? "sm:max-w-[560px]"
              : "sm:max-w-[440px]",
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            // Radix wants a description for the accessible name chain.
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <CloseContext value={() => setOpen(false)}>{children}</CloseContext>
      </DialogContent>
    </Dialog>
  );
}

/** Dismisses the surrounding modal, for Cancel buttons inside its content. */
export function ModalCancel({ children = "Cancel" }: { children?: ReactNode }) {
  const close = useContext(CloseContext);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "md")}
      onClick={() => close?.()}
    >
      {children}
    </button>
  );
}

/**
 * A form inside a modal: runs the server action, shows its error inline and
 * closes the modal once it succeeds.
 */
export function ModalForm({
  action,
  children,
  className,
  keepOpenOnSuccess = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** For results that must stay readable, like a freshly created API key. */
  keepOpenOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const close = useContext(CloseContext);

  useEffect(() => {
    if (state?.success && !keepOpenOnSuccess) close?.();
  }, [state, keepOpenOnSuccess, close]);

  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}
