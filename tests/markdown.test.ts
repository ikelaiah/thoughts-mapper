import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../src/markdown";

describe("renderMarkdown", () => {
  it("escapes raw HTML before applying markdown", () => {
    const html = renderMarkdown("<script>alert('x')</script>\n\n**safe**");

    expect(html).toContain("&lt;script&gt;alert('x')&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<strong>safe</strong>");
  });

  it("renders resolved and missing thought mentions", () => {
    const html = renderMarkdown("[[Alpha]] and [[Missing]]", (title) => title === "Alpha" ? { id: "thought-alpha" } : null);

    expect(html).toContain('data-mention-id="thought-alpha"');
    expect(html).toContain('<span class="mention-missing">[[Missing]]</span>');
  });

  it("keeps unsafe markdown links inert", () => {
    const html = renderMarkdown("[safe](https://example.com) [bad](javascript:alert(1))");

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="#"');
    expect(html).not.toContain("javascript:alert");
  });
});
