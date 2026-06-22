import { describe, expect, it } from "vitest";

import { jsonCanvasToState, markdownFilesToState, projectToJsonCanvas, projectToMarkdownFiles } from "../src/interoperability";
import { sanitizeState } from "../src/app-data";

describe("interoperability", () => {
  it("exports and imports JSON Canvas nodes and edges", () => {
    const state = sanitizeState({
      thoughts: [
        { id: "a", title: "Alpha", note: "Root note", x: 10, y: 20 },
        { id: "b", title: "Beta", note: "Child note", x: 240, y: 180 },
      ],
      links: [{ id: "l1", from: "a", to: "b", type: "parent", name: "next" }],
    });

    const canvas = projectToJsonCanvas(state);
    const restored = sanitizeState(jsonCanvasToState(canvas, state));

    expect(canvas.nodes).toHaveLength(2);
    expect(canvas.edges?.[0]).toMatchObject({ fromNode: "a", toNode: "b" });
    expect(restored.thoughts.map((thought) => thought.title)).toEqual(["Alpha", "Beta"]);
    expect(restored.links[0]).toMatchObject({ from: "a", to: "b", type: "parent" });
  });

  it("builds a Markdown folder export and restores wiki links as related links", () => {
    const state = sanitizeState({
      thoughts: [
        { id: "a", title: "Alpha", note: "See [[Beta]]", tags: ["research"] },
        { id: "b", title: "Beta", note: "Reference note" },
      ],
    });

    const files = projectToMarkdownFiles("Research map", state);
    const restored = sanitizeState(markdownFilesToState(files, state));

    expect(files.map((file) => file.name)).toContain("index.md");
    expect(files.some((file) => file.name === "alpha.md")).toBe(true);
    expect(restored.thoughts.map((thought) => thought.title).sort()).toEqual(["Alpha", "Beta"]);
    expect(restored.links).toHaveLength(1);
    expect(restored.links[0].type).toBe("related");
  });
});
