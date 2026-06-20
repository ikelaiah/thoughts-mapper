import {
  APP_DATA_VERSION,
  DEFAULT_KIND_ID,
  defaultKindDefinitions,
  kindColourPalette,
  legacyKindStyles,
  seedState,
} from "./constants";
import { normalizeKindName, normalizeTags, sanitizeKindColor, sanitizeKindId } from "./normalizers";
import type { AppData, KindDefinition, Link, LinkType, MapSettings, Project, ProjectState, Thought, ViewState } from "./types";
import { clamp, clone, makeId } from "./utils";

const backgroundIds = [
  "pastel-mint",
  "calm",
  "pastel-sky",
  "pastel-blush",
  "fireflies",
  "leaves",
  "blackhole",
  "aurora",
  "rain",
  "snow",
  "nebula",
  "starfield",
  "ocean",
];

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? value as UnknownRecord : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sanitizeAppData(raw: unknown): AppData {
  const data = asRecord(raw);
  if (data && Array.isArray(data.projects)) {
    const projects = data.projects
      .map((project, index) => sanitizeProject(project, index))
      .filter((project): project is Project => Boolean(project));
    if (!projects.length) projects.push(createProject("Thoughts Mapper", seedState));
    const activeProjectId = projects.some((project) => project.id === data.activeProjectId)
      ? stringOrEmpty(data.activeProjectId)
      : projects[0].id;
    return {
      version: APP_DATA_VERSION,
      activeProjectId,
      projects,
    };
  }

  return {
    version: APP_DATA_VERSION,
    activeProjectId: "project-main",
    projects: [
      {
        id: "project-main",
        name: "My first map",
        updatedAt: new Date().toISOString(),
        state: sanitizeState(raw || seedState),
      },
    ],
  };
}

export function sanitizeProject(project: unknown, index = 0): Project | null {
  const source = asRecord(project);
  if (!source) return null;
  return {
    id: String(source.id || makeId("project")),
    name: String(source.name || `Project ${index + 1}`).slice(0, 80),
    updatedAt: stringOrEmpty(source.updatedAt) || new Date().toISOString(),
    state: sanitizeState(source.state || seedState),
  };
}

export function createProject(name: unknown, projectState: unknown = seedState): Project {
  return {
    id: makeId("project"),
    name: String(name || "Untitled project").slice(0, 80),
    updatedAt: new Date().toISOString(),
    state: sanitizeState(projectState || seedState),
  };
}

export function sanitizeKindDefinitions(kinds: unknown, thoughts: unknown[] = []): KindDefinition[] {
  const byId = new Map<string, KindDefinition>();
  const sourceKinds = Array.isArray(kinds) && kinds.length ? kinds : defaultKindDefinitions;
  sourceKinds.forEach((value, index) => {
    const kind = asRecord(value) || {};
    const name = normalizeKindName(kind.name || kind.id || `Kind ${index + 1}`);
    const id = sanitizeKindId(kind.id || name);
    if (!id) return;
    if (byId.has(id)) {
      const existing = byId.get(id);
      if (!existing) return;
      byId.set(id, {
        ...existing,
        name,
        color: sanitizeKindColor(kind.color, existing.color),
      });
      return;
    }
    byId.set(id, {
      id,
      name,
      color: sanitizeKindColor(kind.color, kindColourPalette[index % kindColourPalette.length]),
    });
  });
  thoughts.forEach((value) => {
    const thought = asRecord(value) || {};
    const id = sanitizeKindId(thought.kind);
    if (!id || byId.has(id)) return;
    byId.set(id, {
      id,
      name: normalizeKindName(id),
      color: sanitizeKindColor(legacyKindStyles[id], kindColourPalette[byId.size % kindColourPalette.length]),
    });
  });
  if (!byId.size) byId.set(DEFAULT_KIND_ID, { ...defaultKindDefinitions[0] });
  return [...byId.values()].slice(0, 32);
}

export function sanitizeState(nextState: unknown): ProjectState {
  const source = asRecord(clone(nextState || seedState)) || clone(seedState) as unknown as UnknownRecord;
  const sourceThoughts = Array.isArray(source.thoughts) ? source.thoughts : [];
  const sourceLinks = Array.isArray(source.links) ? source.links : [];
  const sourceView = asRecord(source.view);
  const sourceSettings = asRecord(source.settings) || {};
  const kinds = sanitizeKindDefinitions(source.kinds, sourceThoughts);
  const defaultKindId = kinds.some((kind) => kind.id === source.defaultKindId)
    ? stringOrEmpty(source.defaultKindId)
    : kinds[0]?.id || DEFAULT_KIND_ID;

  const settings: MapSettings = {
    theme: ["light", "dark"].includes(stringOrEmpty(sourceSettings.theme)) ? stringOrEmpty(sourceSettings.theme) : "light",
    background: backgroundIds.includes(stringOrEmpty(sourceSettings.background))
      ? stringOrEmpty(sourceSettings.background)
      : "calm",
    calmMode: true,
    lineThickness: clamp(Number(sourceSettings.lineThickness) || 1.5, 1, 8),
    connectionType: ["straight", "curve"].includes(stringOrEmpty(sourceSettings.connectionType))
      ? stringOrEmpty(sourceSettings.connectionType) as MapSettings["connectionType"]
      : "curve",
    lineEndpoint: ["floating", "touching"].includes(stringOrEmpty(sourceSettings.lineEndpoint))
      ? stringOrEmpty(sourceSettings.lineEndpoint) as MapSettings["lineEndpoint"]
      : "floating",
  };

  const view: ViewState = {
    x: finiteNumber(sourceView?.x) ? sourceView.x : 0,
    y: finiteNumber(sourceView?.y) ? sourceView.y : 0,
    scale: finiteNumber(sourceView?.scale) ? sourceView.scale : 1,
  };

  const thoughts: Thought[] = sourceThoughts.map((value, index) => {
    const thought = asRecord(value) || {};
    const kind = stringOrEmpty(thought.kind);
    return {
      id: stringOrEmpty(thought.id) || makeId("t"),
      title: String(thought.title || "Untitled").slice(0, 80),
      kind: kinds.some((item) => item.id === kind) ? kind : defaultKindId,
      note: String(thought.note || ""),
      tags: normalizeTags(thought.tags),
      x: finiteNumber(thought.x) ? thought.x : index * 120,
      y: finiteNumber(thought.y) ? thought.y : index * 80,
    };
  });

  const ids = new Set(thoughts.map((thought) => thought.id));
  const links: Link[] = sourceLinks
    .filter((value) => {
      const link = asRecord(value) || {};
      return ids.has(stringOrEmpty(link.from)) && ids.has(stringOrEmpty(link.to)) && link.from !== link.to;
    })
    .map((value) => {
      const link = asRecord(value) || {};
      const type: LinkType = link.type === "related" ? "related" : "parent";
      return {
        id: stringOrEmpty(link.id) || makeId("l"),
        from: stringOrEmpty(link.from),
        to: stringOrEmpty(link.to),
        type,
        name: String(link.name || "").slice(0, 80),
      };
    });
  const selectedId = ids.has(stringOrEmpty(source.selectedId))
    ? stringOrEmpty(source.selectedId)
    : thoughts[0]?.id || null;

  return {
    kinds,
    defaultKindId,
    thoughts,
    links,
    selectedId,
    view,
    settings,
  };
}
