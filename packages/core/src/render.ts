/** Template rendering, plain text generation and link tracking. */

export type MergeData = Record<string, unknown>;

const escapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => escapeMap[char]!);
}

function lookup(data: MergeData, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      data,
    );
}

/**
 * Replaces `{{ name }}` with values from `data`, and
 * `{{ name | Fallback }}` when the value is missing.
 * Values are HTML escaped unless `escape` is false (plain text parts).
 */
export function renderTemplate(
  template: string,
  data: MergeData,
  { escape = true }: { escape?: boolean } = {},
): string {
  return template.replace(
    /\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g,
    (_match, path: string, fallback = "") => {
      const value = lookup(data, path);
      const resolved =
        value === undefined || value === null || value === ""
          ? fallback
          : String(value);
      return escape ? escapeHtml(resolved) : resolved;
    },
  );
}

/** Lists merge tags used by a template, so the UI can warn about typos. */
export function usedMergeTags(template: string): string[] {
  const tags = new Set<string>();
  for (const match of template.matchAll(/\{\{\s*([\w.]+)/g)) {
    tags.add(match[1]!);
  }
  return [...tags];
}

const blockTags =
  /<\/?(?:p|div|br|tr|li|h[1-6]|table|ul|ol|blockquote|section|header|footer)[^>]*>/gi;

/** Good-enough HTML to text conversion for the multipart/alternative part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(blockTags, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const UNSUBSCRIBE_TAG = "unsubscribe_url";

export function hasUnsubscribeLink(html: string): boolean {
  return (
    html.includes(UNSUBSCRIBE_TAG) || /\/u\/[A-Za-z0-9._-]+/.test(html)
  );
}

/**
 * Wraps a body fragment in a complete HTML document, adds the hidden
 * preview text and an unsubscribe footer when the body has no
 * `{{unsubscribe_url}}` of its own.
 */
export function buildHtmlDocument({
  body,
  previewText,
  unsubscribeUrl,
  footerAddress,
  projectName,
}: {
  body: string;
  previewText?: string | null;
  unsubscribeUrl?: string | null;
  footerAddress?: string | null;
  projectName?: string | null;
}): string {
  const preview = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(
        previewText,
      )}</div>`
    : "";
  const needsFooter = Boolean(unsubscribeUrl) && !hasUnsubscribeLink(body);
  const footer = needsFooter
    ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;color:#8a8a8a;font-size:12px;line-height:18px">
  ${projectName ? `${escapeHtml(projectName)}<br/>` : ""}${
        footerAddress ? `${escapeHtml(footerAddress)}<br/>` : ""
      }<a href="${unsubscribeUrl}" style="color:#8a8a8a;text-decoration:underline">Unsubscribe</a>
</div>`
    : "";

  const alreadyDocument = /<html[\s>]/i.test(body);
  if (alreadyDocument) {
    return footer ? body.replace(/<\/body>/i, `${footer}</body>`) : body;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
</head>
<body style="margin:0;padding:0;background:#f6f6f6">
${preview}
<div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#1a1a1a;background:#ffffff">
${body}
${footer}
</div>
</body>
</html>`;
}

/** Rewrites every http(s) link so clicks are counted, then redirected. */
export function rewriteLinksForClickTracking(
  html: string,
  buildUrl: (target: string) => string,
): string {
  return html.replace(
    /(<a\b[^>]*\bhref=["'])(https?:\/\/[^"']+)(["'])/gi,
    (match, prefix: string, url: string, suffix: string) => {
      // Never rewrite the unsubscribe link: one-click unsubscribe must hit
      // the real endpoint, and mailbox providers check the target.
      if (/\/u\//.test(url)) return match;
      return `${prefix}${buildUrl(url)}${suffix}`;
    },
  );
}

export function appendOpenPixel(html: string, pixelUrl: string): string {
  const pixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0"/>`;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${pixel}</body>`)
    : html + pixel;
}

/** RFC 5322 display name + address, with a quoted name when needed. */
export function formatAddress(name: string | null | undefined, email: string) {
  if (!name) return email;
  const needsQuotes = /[^\w \-.]/.test(name);
  const display = needsQuotes ? `"${name.replace(/"/g, '\\"')}"` : name;
  return `${display} <${email}>`;
}
