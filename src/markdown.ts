type MentionResolver = (title: string) => { id: string } | null | undefined;

export function escapeHtml(text: unknown): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function unescapeHtml(text: unknown): string {
  return String(text)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Inline markdown on already HTML-escaped text: code, bold, italic, strikethrough, links.
export function renderInline(text: string, resolveMention: MentionResolver = () => null): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, (_, label: string) => {
      const thought = resolveMention(unescapeHtml(label));
      if (!thought) return `<span class="mention-missing">[[${label}]]</span>`;
      return `<button type="button" class="mention-link" data-mention-id="${thought.id}">${label}</button>`;
    })
    .replace(/`([^`]+)`/g, (_, code: string) => `<code>${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
      const safe = /^(https?:|mailto:|\/|#)/i.test(url) ? url : "#";
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
}

// Minimal, dependency-free markdown -> HTML for notes. Supports headings, lists,
// blockquotes, fenced code, horizontal rules, paragraphs, and inline formatting.
// Input is HTML-escaped up front so rendered notes can't inject markup.
export function renderMarkdown(source: unknown, resolveMention: MentionResolver = () => null): string {
  const lines = escapeHtml(source).replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ol" | "ul" | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(" "), resolveMention)}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      flushParagraph();
      closeList();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        code.push(lines[i]);
        i += 1;
      }
      out.push(`<pre><code>${code.join("\n")}</code></pre>`);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push("<hr />");
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2].trim(), resolveMention)}</h${level}>`);
      continue;
    }

    const blockquote = line.match(/^\s*>\s?(.*)$/);
    if (blockquote) {
      flushParagraph();
      closeList();
      const quote = [blockquote[1]];
      while (i + 1 < lines.length && /^\s*>\s?/.test(lines[i + 1])) {
        quote.push(lines[i + 1].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote>${renderInline(quote.join(" "), resolveMention)}</blockquote>`);
      continue;
    }

    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    if (task || ordered || unordered) {
      flushParagraph();
      const type = ordered ? "ol" : "ul";
      if (listType !== type) {
        closeList();
        out.push(`<${type}>`);
        listType = type;
      }
      if (task) {
        const checked = task[1].toLowerCase() === "x" ? " checked" : "";
        out.push(`<li class="task-item"><input type="checkbox" disabled${checked} />${renderInline(task[2].trim(), resolveMention)}</li>`);
      } else {
        out.push(`<li>${renderInline((ordered ? ordered[1] : unordered[1]).trim(), resolveMention)}</li>`);
      }
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return out.join("\n");
}
