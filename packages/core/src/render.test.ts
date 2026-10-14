import { describe, expect, it } from "vitest";
import {
  appendOpenPixel,
  buildHtmlDocument,
  escapeHtml,
  formatAddress,
  htmlToText,
  renderTemplate,
  rewriteLinksForClickTracking,
  usedMergeTags,
} from "./render";

describe("renderTemplate", () => {
  it("fills merge tags and nested paths", () => {
    expect(
      renderTemplate("Hi {{firstName}} on {{properties.plan}}", {
        firstName: "Ada",
        properties: { plan: "pro" },
      }),
    ).toBe("Hi Ada on pro");
  });

  it("uses the fallback when a value is missing or empty", () => {
    expect(renderTemplate("Hi {{firstName | there}}", {})).toBe("Hi there");
    expect(renderTemplate("Hi {{firstName | there}}", { firstName: "" })).toBe(
      "Hi there",
    );
  });

  it("escapes values in HTML but not in the text part", () => {
    const data = { firstName: '<script>"x"' };
    expect(renderTemplate("{{firstName}}", data)).toBe(
      "&lt;script&gt;&quot;x&quot;",
    );
    expect(renderTemplate("{{firstName}}", data, { escape: false })).toBe(
      '<script>"x"',
    );
  });

  it("lists the tags a template uses", () => {
    expect(usedMergeTags("{{a}} {{ b.c | x }} {{a}}")).toEqual(["a", "b.c"]);
  });
});

describe("htmlToText", () => {
  it("keeps link targets and drops markup", () => {
    expect(
      htmlToText('<p>Hello <a href="https://x.test">site</a></p><p>Bye</p>'),
    ).toBe("Hello site (https://x.test)\n\nBye");
  });

  it("strips scripts and decodes entities", () => {
    expect(htmlToText("<script>evil()</script><p>a &amp; b</p>")).toBe("a & b");
  });
});

describe("buildHtmlDocument", () => {
  it("adds an unsubscribe footer when the body has no link of its own", () => {
    const html = buildHtmlDocument({
      body: "<p>Hi</p>",
      unsubscribeUrl: "https://api.test/u/tok",
      footerAddress: "1 Market St",
      projectName: "Acme",
    });
    expect(html).toContain("https://api.test/u/tok");
    expect(html).toContain("1 Market St");
    expect(html).toContain("<!doctype html>");
  });

  it("does not duplicate the footer when the body already unsubscribes", () => {
    const html = buildHtmlDocument({
      body: '<a href="{{unsubscribe_url}}">leave</a>',
      unsubscribeUrl: "https://api.test/u/tok",
    });
    expect(html.match(/unsubscribe/gi)?.length).toBe(1);
  });

  it("hides the preview text", () => {
    expect(
      buildHtmlDocument({ body: "<p>Hi</p>", previewText: "Peek" }),
    ).toContain("display:none");
  });
});

describe("click tracking", () => {
  it("rewrites ordinary links", () => {
    const html = '<a href="https://acme.test/a">a</a>';
    expect(
      rewriteLinksForClickTracking(html, (url) => `https://t.test/c?u=${url}`),
    ).toBe('<a href="https://t.test/c?u=https://acme.test/a">a</a>');
  });

  it("never rewrites the unsubscribe link", () => {
    const html = '<a href="https://api.test/u/tok">x</a>';
    expect(rewriteLinksForClickTracking(html, () => "https://evil.test")).toBe(
      html,
    );
  });

  it("appends the open pixel inside the body", () => {
    expect(
      appendOpenPixel("<html><body><p>x</p></body></html>", "https://t.test/o"),
    ).toContain('<img src="https://t.test/o"');
  });
});

describe("addresses", () => {
  it("quotes display names that need it", () => {
    expect(formatAddress("Acme, Inc", "a@b.test")).toBe(
      '"Acme, Inc" <a@b.test>',
    );
    expect(formatAddress("Acme", "a@b.test")).toBe("Acme <a@b.test>");
    expect(formatAddress(null, "a@b.test")).toBe("a@b.test");
  });

  it("escapes html", () => {
    expect(escapeHtml("<a>&")).toBe("&lt;a&gt;&amp;");
  });
});
