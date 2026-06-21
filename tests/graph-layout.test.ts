import { describe, expect, it } from "vitest";

import { getTrimmedLinkEndpoints } from "../src/graph-layout";
import type { NodeBox } from "../src/types";

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
