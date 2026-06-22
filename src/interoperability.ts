import { defaultKindDefinitions, seedState } from "./constants";
import { normalizeTags } from "./normalizers";
import type { Link, ProjectState, Thought, ThoughtAttachment } from "./types";
import { clone, makeId } from "./utils";

export type TextFile = {
  name: string;
  text: string;
};

export type JsonCanvasDocument = {
  nodes?: JsonCanvasNode[];
  edges?: JsonCanvasEdge[];
};

type JsonCanvasNode = {
  id?: string;
  type?: string;
  text?: string;
  file?: string;
  url?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
};

type JsonCanvasEdge = {
  id?: string;
  fromNode?: string;
  toNode?: string;
  label?: string;
};

const MARKDOWN_EXTENSION = /\.(md|markdown)$/i;

export function slugifyFilename(value: unknown, fallback = "thought"): string {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

export function projectToMarkdownFiles(projectName: string, state: ProjectState): TextFile[] {
  const used = new Set<string>();
  const files = state.thoughts
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((thought) => {
      const base = slugifyFilename(thought.title, thought.id);
      let filename = `${base}.md`;
      let suffix = 2;
      while (used.has(filename)) {
        filename = `${base}-${suffix}.md`;
        suffix += 1;
      }
      used.add(filename);
      return {
        name: filename,
        text: thoughtToMarkdown(thought, state),
      };
    });

  return [
    {
      name: "index.md",
      text: createMarkdownIndex(projectName, state),
    },
    ...files,
  ];
}

export function projectToMarkdownBundle(projectName: string, state: ProjectState): string {
  return projectToMarkdownFiles(projectName, state)
    .map((file) => `<!-- ${file.name} -->\n\n${file.text.trim()}`)
    .join("\n\n---\n\n");
}

export function markdownFilesToState(files: TextFile[], base: ProjectState = seedState): ProjectState {
  const markdownFiles = files
    .filter((file) => MARKDOWN_EXTENSION.test(file.name) && !/^index\.md$/i.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const thoughts = markdownFiles.map((file, index) => markdownFileToThought(file, index));
  const byTitle = new Map(thoughts.map((thought) => [thought.title.toLowerCase(), thought]));
  const links: Link[] = [];
  const seenLinks = new Set<string>();
  const addLink = (from: string, to: string, type: "parent" | "related") => {
    const key = type === "related" ? `related:${[from, to].sort().join(":")}` : `parent:${from}:${to}`;
    if (seenLinks.has(key) || from === to) return;
    seenLinks.add(key);
    links.push({ id: makeId("l"), from, to, type });
  };

  thoughts.forEach((thought) => {
    getMarkdownConnectionEntries(thought.note).forEach((entry) => {
      const target = byTitle.get(entry.title.toLowerCase());
      if (!target || target.id === thought.id) return;
      if (entry.role === "parent") addLink(target.id, thought.id, "parent");
      else if (entry.role === "child") addLink(thought.id, target.id, "parent");
      else addLink(thought.id, target.id, "related");
    });
    getWikiMentions(removeMarkdownConnectionLines(thought.note)).forEach((title) => {
      const target = byTitle.get(title.toLowerCase());
      if (!target || target.id === thought.id) return;
      addLink(thought.id, target.id, "related");
    });
  });

  return {
    kinds: clone(base.kinds || defaultKindDefinitions),
    defaultKindId: base.defaultKindId || defaultKindDefinitions[0].id,
    thoughts,
    links,
    selectedId: thoughts[0]?.id || null,
    view: { x: 0, y: 0, scale: 1 },
    settings: clone(base.settings || seedState.settings),
  };
}

export function projectToJsonCanvas(state: ProjectState): JsonCanvasDocument {
  return {
    nodes: state.thoughts.map((thought) => ({
      id: thought.id,
      type: "text",
      text: [`# ${thought.title}`, "", thought.note.trim()].filter(Boolean).join("\n"),
      x: Math.round(thought.x),
      y: Math.round(thought.y),
      width: 260,
      height: Math.max(120, Math.min(360, 120 + thought.note.length / 4)),
    })),
    edges: state.links.map((link) => ({
      id: link.id,
      fromNode: link.from,
      toNode: link.to,
      label: link.type === "related" ? "related" : link.name || "",
    })),
  };
}

export function jsonCanvasToState(canvas: JsonCanvasDocument, base: ProjectState = seedState): ProjectState {
  const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes : [];
  const thoughts: Thought[] = nodes
    .map((node, index) => jsonCanvasNodeToThought(node, index))
    .filter((thought): thought is Thought => Boolean(thought));
  const ids = new Set(thoughts.map((thought) => thought.id));
  const links: Link[] = (Array.isArray(canvas?.edges) ? canvas.edges : [])
    .filter((edge) => edge?.fromNode && edge?.toNode && ids.has(edge.fromNode) && ids.has(edge.toNode) && edge.fromNode !== edge.toNode)
    .map((edge) => ({
      id: edge.id || makeId("l"),
      from: String(edge.fromNode),
      to: String(edge.toNode),
      type: String(edge.label || "").toLowerCase().includes("related") ? "related" : "parent",
      name: String(edge.label || "").toLowerCase().includes("related") ? "" : String(edge.label || "").slice(0, 80),
    }));

  return {
    kinds: clone(base.kinds || defaultKindDefinitions),
    defaultKindId: base.defaultKindId || defaultKindDefinitions[0].id,
    thoughts,
    links,
    selectedId: thoughts[0]?.id || null,
    view: { x: 0, y: 0, scale: 1 },
    settings: clone(base.settings || seedState.settings),
  };
}

export function projectToOpml(projectName: string, state: ProjectState): string {
  const roots = getHierarchyRoots(state);
  const placed = new Set<string>();
  const body = roots.map((thought) => thoughtToOpmlOutline(thought, state, placed, 4)).join("\n");
  const orphaned = state.thoughts
    .filter((thought) => !placed.has(thought.id))
    .map((thought) => thoughtToOpmlOutline(thought, state, placed, 4))
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    `    <title>${escapeXml(projectName || "Thoughts Mapper")}</title>`,
    "  </head>",
    "  <body>",
    body,
    orphaned,
    "  </body>",
    "</opml>",
    "",
  ].filter((line) => line !== "").join("\n");
}

export function opmlDocumentToState(document: Document, base: ProjectState = seedState): ProjectState {
  const body = document.querySelector("body");
  const roots = body ? Array.from(body.children).filter((element) => element.tagName.toLowerCase() === "outline") : [];
  const thoughts: Thought[] = [];
  const links: Link[] = [];
  const walk = (element: Element, parentId: string | null, depth: number, siblingIndex: number): void => {
    const id = element.getAttribute("_id") || makeId("t");
    const note = element.getAttribute("_note") || element.getAttribute("note") || "";
    const tags = normalizeTags(element.getAttribute("_tags") || "");
    const ref = element.getAttribute("url") || element.getAttribute("xmlUrl") || "";
    const attachments: ThoughtAttachment[] = ref
      ? [{ id: makeId("source"), kind: "url", title: "OPML source", ref, preview: "" }]
      : [];
    thoughts.push({
      id,
      title: (element.getAttribute("text") || element.getAttribute("title") || "Untitled").slice(0, 80),
      kind: element.getAttribute("_kind") || base.defaultKindId || defaultKindDefinitions[0].id,
      note,
      tags,
      attachments,
      updatedAt: new Date().toISOString(),
      x: siblingIndex * 230 - 230,
      y: depth * 180,
    });
    if (parentId) links.push({ id: makeId("l"), from: parentId, to: id, type: "parent" });
    Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "outline")
      .forEach((child, index) => walk(child, id, depth + 1, index));
  };

  roots.forEach((root, index) => walk(root, null, 0, index));
  return {
    kinds: clone(base.kinds || defaultKindDefinitions),
    defaultKindId: base.defaultKindId || defaultKindDefinitions[0].id,
    thoughts,
    links,
    selectedId: thoughts[0]?.id || null,
    view: { x: 0, y: 0, scale: 1 },
    settings: clone(base.settings || seedState.settings),
  };
}

function thoughtToMarkdown(thought: Thought, state: ProjectState): string {
  const connections = state.links
    .filter((link) => link.from === thought.id || link.to === thought.id)
    .map((link) => {
      const otherId = link.from === thought.id ? link.to : link.from;
      const other = state.thoughts.find((item) => item.id === otherId);
      if (!other) return "";
      const label = link.type === "related" ? "related" : link.from === thought.id ? "child" : "parent";
      return `- ${label}: [[${other.title}]]`;
    })
    .filter(Boolean);
  const metadata = [
    `kind: ${thought.kind}`,
    thought.tags.length ? `tags: ${thought.tags.map((tag) => `#${tag}`).join(" ")}` : "",
    thought.attachments?.length ? "sources:" : "",
    ...(thought.attachments || []).map((source) => `- ${source.kind}: ${source.title} <${source.ref}>`),
  ].filter(Boolean);
  return [
    `# ${thought.title}`,
    "",
    ...metadata,
    "",
    connections.length ? "## Connections" : "",
    ...connections,
    connections.length ? "" : "",
    thought.note.trim(),
    "",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

function createMarkdownIndex(projectName: string, state: ProjectState): string {
  return [
    `# ${projectName || "Thoughts Mapper"}`,
    "",
    ...state.thoughts
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((thought) => `- [[${thought.title}]]${thought.tags.length ? ` ${thought.tags.map((tag) => `#${tag}`).join(" ")}` : ""}`),
    "",
  ].join("\n");
}

function markdownFileToThought(file: TextFile, index: number): Thought {
  const text = stripFrontMatter(file.text).trim();
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = (titleMatch?.[1] || filenameToTitle(file.name)).trim().slice(0, 80) || "Untitled";
  const note = titleMatch ? text.replace(titleMatch[0], "").trim() : text;
  const tags = normalizeTags([...text.matchAll(/(^|\s)#([a-z0-9][a-z0-9-]{0,31})/gi)].map((match) => match[2]));
  const columns = 4;
  return {
    id: makeId("t"),
    title,
    kind: defaultKindDefinitions[0].id,
    note,
    tags,
    attachments: [],
    updatedAt: new Date().toISOString(),
    x: (index % columns) * 250 - 375,
    y: Math.floor(index / columns) * 180,
  };
}

function jsonCanvasNodeToThought(node: JsonCanvasNode, index: number): Thought | null {
  if (!node || (node.type && !["text", "file", "link"].includes(node.type))) return null;
  const text = String(node.text || "");
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const firstLine = text.split(/\r?\n/).find((line) => line.trim());
  const ref = node.url || node.file || "";
  const attachments: ThoughtAttachment[] = ref
    ? [{ id: makeId("source"), kind: node.file ? "file" : "url", title: node.file ? "Canvas file" : "Canvas link", ref, preview: "" }]
    : [];
  return {
    id: node.id || makeId("t"),
    title: (titleMatch?.[1] || firstLine || ref || "Untitled").replace(/^#+\s*/, "").slice(0, 80),
    kind: defaultKindDefinitions[0].id,
    note: titleMatch ? text.replace(titleMatch[0], "").trim() : text.trim(),
    tags: [],
    attachments,
    updatedAt: new Date().toISOString(),
    x: Number.isFinite(node.x) ? Number(node.x) : (index % 4) * 250 - 375,
    y: Number.isFinite(node.y) ? Number(node.y) : Math.floor(index / 4) * 180,
  };
}

function getHierarchyRoots(state: ProjectState): Thought[] {
  const childIds = new Set(state.links.filter((link) => link.type !== "related").map((link) => link.to));
  const roots = state.thoughts.filter((thought) => !childIds.has(thought.id));
  return roots.length ? roots : state.thoughts.slice(0, 1);
}

function thoughtToOpmlOutline(thought: Thought, state: ProjectState, placed: Set<string>, indent: number): string {
  if (placed.has(thought.id)) return "";
  placed.add(thought.id);
  const padding = " ".repeat(indent);
  const attrs = [
    `text="${escapeXml(thought.title)}"`,
    `_id="${escapeXml(thought.id)}"`,
    `_kind="${escapeXml(thought.kind)}"`,
    thought.note ? `_note="${escapeXml(thought.note)}"` : "",
    thought.tags.length ? `_tags="${escapeXml(thought.tags.join(","))}"` : "",
  ].filter(Boolean).join(" ");
  const children = state.links
    .filter((link) => link.type !== "related" && link.from === thought.id)
    .map((link) => state.thoughts.find((item) => item.id === link.to))
    .filter((child): child is Thought => Boolean(child))
    .map((child) => thoughtToOpmlOutline(child, state, placed, indent + 2))
    .filter(Boolean);
  if (!children.length) return `${padding}<outline ${attrs} />`;
  return [`${padding}<outline ${attrs}>`, ...children, `${padding}</outline>`].join("\n");
}

function stripFrontMatter(text: string): string {
  return text.replace(/^---\s*[\s\S]*?\s*---\s*/, "");
}

function filenameToTitle(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(MARKDOWN_EXTENSION, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Untitled";
}

function getWikiMentions(text: string): string[] {
  return [...new Set(
    [...String(text || "").matchAll(/\[\[([^\]]{1,80})\]\]/g)]
      .map((match) => match[1].trim())
      .filter(Boolean),
  )];
}

function getMarkdownConnectionEntries(text: string): { role: "parent" | "child" | "related"; title: string }[] {
  return [...String(text || "").matchAll(/^\s*-\s+(parent|child|related):\s+\[\[([^\]]{1,80})\]\]/gim)]
    .map((match) => ({
      role: match[1].toLowerCase() as "parent" | "child" | "related",
      title: match[2].trim(),
    }))
    .filter((entry) => entry.title);
}

function removeMarkdownConnectionLines(text: string): string {
  return String(text || "").replace(/^\s*-\s+(parent|child|related):\s+\[\[[^\]]{1,80}\]\]\s*$/gim, "");
}

function escapeXml(value: unknown): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
