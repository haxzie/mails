"use client";

import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buttonClass, cx, type ButtonVariant } from "./shell";

/**
 * A button that slides its children in from the right, for reference content
 * that is read alongside the page rather than filled in like a form.
 */
export function PanelButton({
  label,
  title,
  description,
  children,
  variant = "secondary",
  size = "sm",
  width = "md",
  icon,
}: {
  label: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  width?: "sm" | "md" | "lg";
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass(variant, size)}
      >
        {icon}
        {label}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className={cx(
            "gap-0 p-0 sm:max-w-none",
            width === "lg"
              ? "w-[min(100vw,760px)]"
              : width === "md"
                ? "w-[min(100vw,560px)]"
                : "w-[min(100vw,420px)]",
          )}
        >
          <SheetHeader className="border-b border-line px-5 py-3.5">
            <SheetTitle className="text-[13.5px] font-medium">{title}</SheetTitle>
            {description ? (
              <SheetDescription className="text-[12.5px]">
                {description}
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title}</SheetDescription>
            )}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
