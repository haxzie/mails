"use client";

import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const CHEVRON =
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22%238a8d98%22%20stroke-width%3D%221.5%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_0.6rem_center] bg-no-repeat";

/**
 * A native <select>, styled like the shadcn input, that a server action can
 * read straight out of FormData.
 *
 * It tracks the choice in state on purpose. Left uncontrolled, re-rendering
 * the tree after a server action re-applied `defaultValue` and snapped the
 * selection back to the stored value; tracking the last `defaultValue` lets
 * a genuinely new server value through while keeping the user's pick.
 */
export function Select({
  className,
  defaultValue,
  value,
  onChange,
  ...props
}: ComponentProps<"select">) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [lastFromServer, setLastFromServer] = useState(defaultValue ?? "");

  if (defaultValue !== undefined && defaultValue !== lastFromServer) {
    setLastFromServer(defaultValue);
    setSelected(defaultValue);
  }

  return (
    <select
      data-slot="select"
      value={value ?? selected}
      onChange={(event) => {
        setSelected(event.target.value);
        onChange?.(event);
      }}
      className={cn(
        "h-9 w-full appearance-none rounded-lg border border-input bg-surface px-2.5 py-1 pr-8 text-[13.5px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        CHEVRON,
        className,
      )}
      {...props}
    />
  );
}
