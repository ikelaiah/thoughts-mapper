import type { ColumnOptions, LinkRelation, MapSettings, NodeBox, Point, PositionMap, RowOptions, Thought } from "./types";

export function getCurvePath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const bend = clamp(distance * 0.08, 18, 56);
  const direction = dx >= 0 ? 1 : -1;
  const verticalBias = Math.abs(dy) > Math.abs(dx) ? 0.18 : 0.08;
  const c1 = {
    x: from.x + dx * 0.38 + direction * bend,
    y: from.y + dy * verticalBias,
  };
  const c2 = {
    x: from.x + dx * 0.62 - direction * bend,
    y: to.y - dy * verticalBias,
  };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

export function getNodeBox({
  id,
  selectedId,
  thought,
  isConnected,
  depthEffects,
  mobile,
  isInboxThought,
  getKindName,
}: {
  id: string;
  selectedId: string | null;
  thought: Thought | undefined;
  isConnected: boolean;
  depthEffects: boolean;
  mobile: boolean;
  isInboxThought: (id: string) => boolean;
  getKindName: (id: string) => string;
}): NodeBox {
  const isActive = depthEffects && id === selectedId;
  const isNear = depthEffects && isConnected;
  const scale = depthEffects
    ? mobile ? (isActive ? 1.04 : isNear ? 0.94 : 0.86) : isActive ? 1.08 : isNear ? 0.98 : 0.88
    : 1;
  const baseWidth = getContentNodeWidth(thought, {
    min: depthEffects
      ? mobile ? (isActive ? 146 : isNear ? 126 : 114) : isActive ? 164 : isNear ? 142 : 124
      : mobile ? 126 : 142,
    max: depthEffects
      ? mobile ? (isActive ? 210 : isNear ? 184 : 160) : isActive ? 228 : isNear ? 210 : 184
      : mobile ? 184 : 210,
    titleLimit: depthEffects ? isActive ? 24 : isNear ? 18 : 15 : 18,
    isInboxThought,
    getKindName,
  });
  const baseHeight = depthEffects
    ? mobile ? (isActive ? 62 : isNear ? 58 : 54) : isActive ? 66 : isNear ? 62 : 58
    : mobile ? 58 : 62;
  const hitBaseWidth = mobile ? Math.max(baseWidth + 28, 72 / scale) : baseWidth;
  const hitBaseHeight = mobile ? Math.max(baseHeight + 22, 56 / scale) : baseHeight;
  return {
    baseWidth,
    baseHeight,
    hitBaseWidth,
    hitBaseHeight,
    width: baseWidth * scale,
    height: baseHeight * scale,
    scale,
  };
}

function getContentNodeWidth(
  thought: Thought | undefined,
  {
    min,
    max,
    titleLimit,
    isInboxThought,
    getKindName,
  }: {
    min: number;
    max: number;
    titleLimit: number;
    isInboxThought: (id: string) => boolean;
    getKindName: (id: string) => string;
  },
): number {
  if (!thought) return min;
  const title = trimLabel(thought.title, titleLimit);
  const kind = isInboxThought(thought.id) ? "inbox" : getKindName(thought.kind);
  const titleWidth = estimateNodeTitleWidth(title);
  const kindWidth = kind.length * 6.3;
  return Math.round(clamp(Math.max(titleWidth, kindWidth) + 34, min, max));
}

function estimateNodeTitleWidth(title: string): number {
  return String(title || "").length * 8.4;
}

export function getTrimmedLinkEndpoints(
  from: Point,
  to: Point,
  fromBox: NodeBox,
  toBox: NodeBox,
  settings: Pick<MapSettings, "lineEndpoint" | "lineThickness">,
): { from: Point; to: Point } {
  const baseFrom = trimPointToBox(from, to, fromBox, settings, 0);
  const baseTo = trimPointToBox(to, from, toBox, settings, 0);
  if (settings.lineEndpoint === "touching") {
    return { from: baseFrom, to: baseTo };
  }

  const dx = baseTo.x - baseFrom.x;
  const dy = baseTo.y - baseFrom.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1) {
    return getMinimalLinkEndpoints(from, to, settings);
  }

  const floatingGap = clamp(10 + settings.lineThickness * 1.25, 11, 16);
  const gapPerSide = Math.min(floatingGap, length * 0.18);
  const unitX = dx / length;
  const unitY = dy / length;
  return {
    from: {
      x: baseFrom.x + unitX * gapPerSide,
      y: baseFrom.y + unitY * gapPerSide,
    },
    to: {
      x: baseTo.x - unitX * gapPerSide,
      y: baseTo.y - unitY * gapPerSide,
    },
  };
}

function getMinimalLinkEndpoints(from: Point, to: Point, settings: Pick<MapSettings, "lineEndpoint">): { from: Point; to: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const size = settings.lineEndpoint === "floating" ? 22 : 12;
  const center = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
  return {
    from: { x: center.x - unitX * size * 0.5, y: center.y - unitY * size * 0.5 },
    to: { x: center.x + unitX * size * 0.5, y: center.y + unitY * size * 0.5 },
  };
}

function trimPointToBox(
  center: Point,
  target: Point,
  box: NodeBox,
  settings: Pick<MapSettings, "lineEndpoint" | "lineThickness">,
  extraGap = 0,
): Point {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const edgeInset = settings.lineEndpoint === "touching" ? -0.5 : settings.lineThickness;
  const halfWidth = box.width / 2 + edgeInset + extraGap;
  const halfHeight = box.height / 2 + edgeInset + extraGap;
  const scale = Math.min(Math.abs(halfWidth / dx) || Infinity, Math.abs(halfHeight / dy) || Infinity);
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

export function interpolatePositions(thoughts: Thought[], fromPositions: PositionMap, toPositions: PositionMap, progress: number): PositionMap {
  const positions: PositionMap = new Map();
  thoughts.forEach((thought) => {
    const from = fromPositions.get(thought.id) || thought;
    const to = toPositions.get(thought.id) || thought;
    positions.set(thought.id, {
      x: interpolate(from.x, to.x, progress),
      y: interpolate(from.y, to.y, progress),
    });
  });
  return positions;
}

export function arrangeHorizontalThoughtRow(
  positions: PositionMap,
  thoughts: Thought[],
  centerX: number,
  y: number,
  getThoughtNodeBox: (id: string) => NodeBox,
  options: RowOptions = {},
): void {
  if (!thoughts.length) return;
  const gap = options.gap ?? 34;
  const ordered = [...thoughts].sort((a, b) => a.x - b.x || a.title.localeCompare(b.title));
  const widths = ordered.map((thought) => getThoughtNodeBox(thought.id).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(ordered.length - 1, 0);
  let cursor = centerX - totalWidth / 2;
  ordered.forEach((thought, index) => {
    const width = widths[index];
    positions.set(thought.id, { x: cursor + width / 2, y });
    cursor += width + gap;
  });
}

export function arrangeVerticalThoughtColumn(
  positions: PositionMap,
  thoughts: Thought[],
  edgeX: number,
  centerY: number,
  getThoughtNodeBox: (id: string) => NodeBox,
  options: ColumnOptions = {},
): void {
  if (!thoughts.length) return;
  const gap = options.gap ?? 34;
  const side = options.side || "left";
  const ordered = [...thoughts].sort((a, b) => a.y - b.y || a.title.localeCompare(b.title));
  const boxes = ordered.map((thought) => getThoughtNodeBox(thought.id));
  const totalHeight = boxes.reduce((sum, box) => sum + box.height, 0) + gap * Math.max(ordered.length - 1, 0);
  let cursor = centerY - totalHeight / 2;
  ordered.forEach((thought, index) => {
    const box = boxes[index];
    const x = side === "left" ? edgeX - box.width / 2 : edgeX + box.width / 2;
    positions.set(thought.id, { x, y: cursor + box.height / 2 });
    cursor += box.height + gap;
  });
}

export function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function trimLabel(label: string, length: number): string {
  return label.length > length ? `${label.slice(0, length - 1)}...` : label;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
