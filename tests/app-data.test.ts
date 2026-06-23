import { describe, expect, it } from "vitest";

import { sanitizeAppData, sanitizeState } from "../src/app-data";

describe("sanitizeState", () => {
  it("repairs invalid state while preserving valid thoughts and links", () => {
    const state = sanitizeState({
      thoughts: [
        { id: "a", title: "Alpha", kind: "idea", tags: "Work, #Next Step", x: 10, y: 20 },
        { id: "b", title: "", kind: "missing", tags: ["Work", "later"], x: "bad", y: 50 },
      ],
      links: [
        { id: "l1", from: "a", to: "b", type: "related", name: "Relates to" },
        { id: "l2", from: "a", to: "missing", type: "parent" },
      ],
      selectedId: "missing",
      settings: {
        theme: "neon",
        background: "void",
        calmMode: false,
        lineThickness: 20,
        connectionType: "diagonal",
        lineEndpoint: "edge",
      },
    });

    expect(state.thoughts).toHaveLength(2);
    expect(state.thoughts[0]).toMatchObject({ id: "a", title: "Alpha", kind: "idea", tags: ["work", "next-step"], x: 10, y: 20 });
    expect(state.kinds.some((kind) => kind.id === "missing")).toBe(true);
    expect(state.thoughts[1]).toMatchObject({ id: "b", title: "Untitled", kind: "missing", tags: ["work", "later"], x: 120, y: 50 });
    expect(state.links).toEqual([{ id: "l1", from: "a", to: "b", type: "related", name: "Relates to" }]);
    expect(state.selectedId).toBe("a");
    expect(state.settings).toMatchObject({
      theme: "light",
      background: "calm",
      calmMode: false,
      lineThickness: 8,
      connectionType: "curve",
      lineEndpoint: "floating",
    });
  });

  it("defaults calm mode on when the setting is missing", () => {
    const state = sanitizeState({
      thoughts: [{ id: "a", title: "Alpha" }],
      settings: {},
    });

    expect(state.settings.calmMode).toBe(true);
  });

  it("preserves e-ink theme settings", () => {
    const state = sanitizeState({
      thoughts: [{ id: "a", title: "Alpha" }],
      settings: {
        theme: "dark",
        background: "eink",
      },
    });

    expect(state.settings).toMatchObject({
      theme: "dark",
      background: "eink",
    });
  });

  it("removes retired decorative backgrounds from restored maps", () => {
    const state = sanitizeState({
      thoughts: [{ id: "a", title: "Alpha" }],
      settings: {
        theme: "dark",
        background: "nebula",
      },
    });

    expect(state.settings.background).toBe("calm");
  });

  it("keeps current public background presets", () => {
    const state = sanitizeState({
      thoughts: [{ id: "a", title: "Alpha" }],
      settings: {
        theme: "dark",
        background: "high-contrast",
      },
    });

    expect(state.settings).toMatchObject({
      theme: "dark",
      background: "high-contrast",
    });
  });
});

describe("sanitizeAppData", () => {
  it("keeps a valid active project from a backup", () => {
    const data = sanitizeAppData({
      activeProjectId: "p2",
      projects: [
        { id: "p1", name: "One", state: { thoughts: [] } },
        { id: "p2", name: "Two", state: { thoughts: [{ id: "a", title: "Alpha" }] } },
      ],
    });

    expect(data.activeProjectId).toBe("p2");
    expect(data.projects.map((project) => project.name)).toEqual(["One", "Two"]);
    expect(data.projects[1].state.thoughts[0].title).toBe("Alpha");
  });

  it("wraps a legacy single-map export in app data", () => {
    const data = sanitizeAppData({
      thoughts: [{ id: "legacy", title: "Legacy map" }],
      links: [],
    });

    expect(data.activeProjectId).toBe("project-main");
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].state.thoughts[0].title).toBe("Legacy map");
  });
});
