import { describe, expect, it } from "vitest";

import { createGraphQueries, uniqueThoughts } from "../src/graph-queries";
import type { ProjectState, Thought } from "../src/types";

const makeThought = (id: string, title = id): Thought => ({
  id,
  title,
  kind: "thought",
  note: "",
  tags: [],
  attachments: [],
  x: 0,
  y: 0,
});

const state: ProjectState = {
  kinds: [{ id: "thought", name: "Thought", color: "#4c7fb8" }],
  defaultKindId: "thought",
  thoughts: [
    makeThought("root", "Root"),
    makeThought("child", "Child"),
    makeThought("grandchild", "Grandchild"),
    makeThought("sibling", "Sibling"),
    makeThought("related", "Related"),
    makeThought("inbox", "Inbox"),
  ],
  links: [
    { id: "root-child", from: "root", to: "child", type: "parent" },
    { id: "child-grandchild", from: "child", to: "grandchild", type: "parent" },
    { id: "root-sibling", from: "root", to: "sibling", type: "parent" },
    { id: "child-related", from: "related", to: "child", type: "related" },
  ],
  selectedId: "child",
  view: { x: 0, y: 0, scale: 1 },
  settings: {
    theme: "light",
    background: "calm",
    calmMode: true,
    lineThickness: 1.5,
    connectionType: "curve",
    lineEndpoint: "floating",
  },
};

describe("createGraphQueries", () => {
  it("keeps hierarchical direction separate from undirected related links", () => {
    const graph = createGraphQueries(() => state);

    expect(graph.getParentThoughts("child").map((thought) => thought.id)).toEqual(["root"]);
    expect(graph.getChildThoughts("child").map((thought) => thought.id)).toEqual(["grandchild"]);
    expect(graph.getRelatedThoughts("child").map((thought) => thought.id)).toEqual(["related"]);
    expect(graph.getSiblingThoughts("child").map((thought) => thought.id)).toEqual(["sibling"]);
  });

  it("derives inbox and placed thoughts from connection presence", () => {
    const graph = createGraphQueries(() => state);

    expect(graph.getInboxThoughts().map((thought) => thought.id)).toEqual(["inbox"]);
    expect(graph.getGraphThoughts().map((thought) => thought.id)).not.toContain("inbox");
  });

  it("traverses ancestors and descendants breadth-first without revisiting cycles", () => {
    let currentState = state;
    const graph = createGraphQueries(() => currentState);
    currentState = {
      ...state,
      links: [
        ...state.links,
        { id: "cycle", from: "grandchild", to: "root", type: "parent" },
      ],
    };

    expect(graph.getAncestorEntries("grandchild", 4).map(({ thought, depth }) => [thought.id, depth])).toEqual([
      ["child", 1],
      ["root", 2],
    ]);
    expect(graph.getDescendantEntries("root", 4).map(({ thought, depth }) => [thought.id, depth])).toEqual([
      ["child", 1],
      ["sibling", 1],
      ["grandchild", 2],
    ]);
  });

  it("reads replaced state objects through the getter", () => {
    let currentState = state;
    const graph = createGraphQueries(() => currentState);

    currentState = {
      ...state,
      thoughts: [...state.thoughts, makeThought("new", "New thought")],
    };

    expect(graph.getThought("new")?.title).toBe("New thought");
    expect(graph.getThoughtByTitle(" new THOUGHT ")?.id).toBe("new");
  });
});

describe("uniqueThoughts", () => {
  it("removes missing and duplicate thoughts while preserving order", () => {
    const first = makeThought("first");
    const second = makeThought("second");

    expect(uniqueThoughts([first, null, second, first, undefined])).toEqual([first, second]);
  });
});
