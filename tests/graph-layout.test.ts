import { describe, expect, it } from "vitest";

import { calculateFitView, getNodeBox, getTrimmedLinkEndpoints, resolveThoughtOverlaps } from "../src/graph-layout";
import type { NodeBox, PositionMap, Thought } from "../src/types";

const box: NodeBox = {
  scale: 1,
  baseWidth: 120,
  baseHeight: 60,
  hitBaseWidth: 120,
  hitBaseHeight: 60,
  width: 120,
  height: 60,
};

describe("getTrimmedLinkEndpoints", () => {
  it("keeps floating lines close to node edges", () => {
    const endpoints = getTrimmedLinkEndpoints(
      { x: 0, y: 0 },
      { x: 260, y: 0 },
      box,
      box,
      { lineEndpoint: "floating", lineThickness: 1.5 },
    );

    expect(endpoints.from.x - box.width / 2).toBeGreaterThan(10);
    expect(endpoints.from.x - box.width / 2).toBeLessThan(16);
    expect(260 - box.width / 2 - endpoints.to.x).toBeGreaterThan(10);
    expect(260 - box.width / 2 - endpoints.to.x).toBeLessThan(16);
  });
});

describe("getNodeBox", () => {
  it("uses one size tier when depth effects are disabled", () => {
    const getBox = (id: string, isConnected: boolean) => getNodeBox({
      id,
      selectedId: "selected",
      thought: { id, title: "Same title", kind: "thought", note: "", tags: [], attachments: [], x: 0, y: 0 },
      isConnected,
      depthEffects: false,
      mobile: false,
      isInboxThought: () => false,
      getKindName: () => "Thought",
    });

    const selected = getBox("selected", false);
    const connected = getBox("connected", true);
    const distant = getBox("distant", false);

    expect(selected).toMatchObject({ scale: 1, baseHeight: 62 });
    expect(connected).toMatchObject({ scale: 1, baseHeight: 62 });
    expect(distant).toMatchObject({ scale: 1, baseHeight: 62 });
    expect(selected.width).toBe(connected.width);
    expect(connected.width).toBe(distant.width);
  });
});

describe("calculateFitView", () => {
  const makeThought = (id: string, x: number, y: number): Thought => ({
    id,
    title: id,
    kind: "thought",
    note: "",
    tags: [],
    attachments: [],
    x,
    y,
  });

  it("fits the target visual positions instead of stale stored coordinates", () => {
    const thoughts = [
      makeThought("a", -1000, -1000),
      makeThought("b", -900, -1000),
    ];
    const positions: PositionMap = new Map([
      ["a", { x: 100, y: 0 }],
      ["b", { x: 300, y: 0 }],
    ]);

    const view = calculateFitView(thoughts, positions, () => box, { width: 1000, height: 600 }, { padding: 100 });

    expect(view?.scale).toBe(1.7);
    expect(view?.x).toBe(-340);
    expect(view?.y).toBeCloseTo(0);
  });

  it("centers the rendered node edges, including asymmetric node widths", () => {
    const thoughts = [
      makeThought("a", 0, 0),
      makeThought("b", 300, 0),
    ];
    const positions: PositionMap = new Map(thoughts.map((thought) => [thought.id, { x: thought.x, y: thought.y }]));
    const wideBox = { ...box, baseWidth: 240, hitBaseWidth: 240, width: 240 };

    const view = calculateFitView(
      thoughts,
      positions,
      (id) => id === "b" ? wideBox : box,
      { width: 1000, height: 500 },
      { padding: 100 },
    );

    expect(view?.scale).toBeCloseTo(1000 / 680);
    expect(view?.x).toBeCloseTo(-180 * (1000 / 680));
    expect(view?.y).toBeCloseTo(0);
  });
});

describe("resolveThoughtOverlaps", () => {
  const makeThought = (id: string): Thought => ({
    id,
    title: id,
    kind: "thought",
    note: "",
    tags: [],
    attachments: [],
    x: 0,
    y: 0,
  });

  it("separates a dense cluster while keeping the selected thought fixed", () => {
    const thoughts = ["selected", "a", "b", "c"].map(makeThought);
    const positions: PositionMap = new Map(thoughts.map((thought) => [thought.id, { x: 0, y: 0 }]));

    resolveThoughtOverlaps(positions, thoughts, () => box, {
      gap: 20,
      lockedIds: ["selected"],
    });

    expect(positions.get("selected")).toEqual({ x: 0, y: 0 });
    thoughts.forEach((first, firstIndex) => {
      thoughts.slice(firstIndex + 1).forEach((second) => {
        const firstPosition = positions.get(first.id)!;
        const secondPosition = positions.get(second.id)!;
        const separatedX = Math.abs(secondPosition.x - firstPosition.x) >= box.width + 19.99;
        const separatedY = Math.abs(secondPosition.y - firstPosition.y) >= box.height + 19.99;
        expect(separatedX || separatedY).toBe(true);
      });
    });
  });

  it("uses the smallest displacement axis", () => {
    const thoughts = [makeThought("a"), makeThought("b")];
    const positions: PositionMap = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 100, y: 0 }],
    ]);

    resolveThoughtOverlaps(positions, thoughts, () => box, { gap: 20 });

    expect(positions.get("a")?.y).toBe(0);
    expect(positions.get("b")?.y).toBe(0);
    const horizontalDistance = Math.abs(positions.get("b")!.x - positions.get("a")!.x);
    expect(horizontalDistance).toBeGreaterThanOrEqual(140);
    expect(horizontalDistance).toBeLessThan(140.02);
  });
});
