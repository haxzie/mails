"use client";

import { useState } from "react";
import { cx } from "./shell";

/**
 * HTML body editor with a live preview. The preview renders in a sandboxed
 * iframe so campaign markup can never touch the dashboard.
 */
export function HtmlEditor({
  name,
  defaultValue,
  rows = 18,
}: {
  name: string;
  defaultValue: string;
  rows?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"html" | "preview">("html");

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong">
      <div className="flex items-center gap-1 border-b border-line bg-canvas px-2 py-1.5">
        {(["html", "preview"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cx(
              "rounded-md px-2 py-1 text-[12px] font-medium capitalize",
              tab === key ? "bg-surface text-ink shadow-sm" : "text-ink-muted",
            )}
          >
            {key}
          </button>
        ))}
        <span className="ml-auto text-[11.5px] text-ink-muted">
          Merge tags: {"{{firstName | there}}"}, {"{{email}}"},{" "}
          {"{{unsubscribe_url}}"}
        </span>
      </div>

      {tab === "html" ? (
        <textarea
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={rows}
          spellCheck={false}
          className="code block w-full resize-y bg-surface px-3 py-2.5 outline-none"
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={value}
            className="h-[420px] w-full bg-white"
          />
        </>
      )}
    </div>
  );
}
