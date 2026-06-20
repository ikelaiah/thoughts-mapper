import { NODE_CREATE_HANDLE_GAP } from "./constants";
import { getCurvePath, getTrimmedLinkEndpoints } from "./graph-layout";
import type { AppElements, CreateHandlePreview, GraphEffects, Link, NodeBox, PositionMap, ProjectState, SvgAttrs, Thought } from "./types";

type RenderItem = {
  element: SVGElement;
  priority: number;
};

export type GraphRenderContext = {
  state: ProjectState;
  els: Pick<AppElements, "viewport" | "linksLayer" | "nodesLayer">;
  graphRect: { width: number; height: number };
  graphEffects: GraphEffects;
  createHandlePreview: CreateHandlePreview | null;
  hoverThoughtId: string | null;
  selectedLinkId: string | null;
  getVisualPositions: () => PositionMap;
  getGraphFocusId: () => string | null;
  getDirectFocusFamilyIds: (id: string | null) => string[];
  getSecondaryFocusFamilyIds: (id: string | null) => string[];
  getFocusFamilyIds: (id: string | null) => string[];
  getPreviewFamilyIds: (id: string | null) => string[];
  getGraphRenderThought: (id: string) => Thought | undefined;
  getGraphRenderThoughts: () => Thought[];
  getGraphRenderNodeBox: (id: string) => NodeBox;
  getLinkDirectionText: (link: Link) => string;
  getKindName: (id: string) => string;
  getKindColor: (id: string) => string;
  isCalmMode: () => boolean;
  isMobileLayout: () => boolean;
  isInboxThought: (id: string) => boolean;
  trimLabel: (label: string, length: number) => string;
  svg: (tag: string, attrs?: SvgAttrs, text?: string) => SVGElement;
};

export function renderGraphView(ctx: GraphRenderContext): void {
  const {
    state,
    els,
    graphRect,
    graphEffects,
    createHandlePreview,
    hoverThoughtId,
    selectedLinkId,
    getVisualPositions,
    getGraphFocusId,
    getDirectFocusFamilyIds,
    getSecondaryFocusFamilyIds,
    getFocusFamilyIds,
    getPreviewFamilyIds,
    getGraphRenderThought,
    getGraphRenderThoughts,
    getGraphRenderNodeBox,
    getLinkDirectionText,
    getKindName,
    getKindColor,
    isCalmMode,
    isMobileLayout,
    isInboxThought,
    trimLabel,
    svg,
  } = ctx;

  els.viewport.setAttribute(
    "transform",
    `translate(${graphRect.width / 2 + state.view.x} ${graphRect.height / 2 + state.view.y}) scale(${state.view.scale})`,
  );

  const positions = getVisualPositions();
  const graphFocusId = getGraphFocusId();
  const directFocusIds = new Set(getDirectFocusFamilyIds(graphFocusId));
  const secondaryFocusIds = new Set(getSecondaryFocusFamilyIds(graphFocusId));
  const visibleFocusIds = new Set(getFocusFamilyIds(graphFocusId));
  const hiddenFocusIds = new Set(isCalmMode() ? secondaryFocusIds : []);
  const hideNonFocusInCalm = Boolean(isCalmMode() && graphFocusId);
  const shouldHideThought = (id: string): boolean => hiddenFocusIds.has(id) || (hideNonFocusInCalm && !directFocusIds.has(id));
  const previewId = hoverThoughtId && hoverThoughtId !== graphFocusId ? hoverThoughtId : null;
  const previewIds = new Set(getPreviewFamilyIds(previewId));
  const linkRenderItems = [
    ...state.links.map((link) => ({
      link,
      effect: graphEffects.appearingLinkIds.has(link.id) ? "appearing" : "",
      visualId: link.id,
    })),
    ...graphEffects.leavingLinks.map((effect) => ({
      link: effect.link,
      effect: "leaving",
      visualId: effect.id,
    })),
  ];

  const linkElements = linkRenderItems
    .map(({ link, effect, visualId }): RenderItem | null => {
      const from = getGraphRenderThought(link.from);
      const to = getGraphRenderThought(link.to);
      if (!from || !to) return null;
      if (shouldHideThought(link.from) || shouldHideThought(link.to)) return null;
      const fromPos = positions.get(from.id) || from;
      const toPos = positions.get(to.id) || to;
      const isActiveLink = link.from === state.selectedId || link.to === state.selectedId;
      const isSelectedLink = link.id === selectedLinkId;
      const isFocusLink = visibleFocusIds.has(link.from) && visibleFocusIds.has(link.to);
      const isPreviewLink = Boolean(previewId && previewIds.has(link.from) && previewIds.has(link.to));
      const isAppearing = effect === "appearing";
      const isLeaving = effect === "leaving";
      const fromNodeBox = getGraphRenderNodeBox(link.from);
      const toNodeBox = getGraphRenderNodeBox(link.to);
      const endpoints = getTrimmedLinkEndpoints(fromPos, toPos, fromNodeBox, toNodeBox, state.settings);
      const thickness = state.settings.lineThickness + (isActiveLink || isPreviewLink || isSelectedLink ? 0.8 : 0);
      const group = svg("g", {
        class: `link-group${isActiveLink ? " active" : ""}${isSelectedLink ? " selected" : ""}${isPreviewLink ? " preview" : ""}${isAppearing ? " appearing" : ""}${isLeaving ? " leaving" : ""}${
          isFocusLink && !isActiveLink ? " context" : ""
        }${
          state.selectedId && !isFocusLink && !isSelectedLink && !isLeaving ? " dimmed" : ""
        }`,
        "data-link-id": visualId,
      });
      group.append(svg("title", {}, `${from.title} ${getLinkDirectionText(link)} ${to.title}`));
      const linkAttrs: SvgAttrs = {
        class: `link-line ${link.type === "related" ? "related" : "parent"}${isActiveLink ? " active" : ""}${isSelectedLink ? " selected" : ""}${isPreviewLink ? " preview" : ""}${isAppearing ? " appearing" : ""}${
          isFocusLink && !isActiveLink ? " context" : ""
        }`,
        style: `stroke-width: ${thickness}px`,
      };
      if (isAppearing) linkAttrs.pathLength = 1;
      const hitAttrs: SvgAttrs = {
        class: "link-hit",
        "data-link-id": visualId,
      };
      const linkElement =
        state.settings.connectionType === "curve"
          ? svg("path", {
              ...linkAttrs,
              d: getCurvePath(endpoints.from, endpoints.to),
            })
          : svg("line", {
              ...linkAttrs,
              x1: endpoints.from.x,
              y1: endpoints.from.y,
              x2: endpoints.to.x,
              y2: endpoints.to.y,
            });
      const hitElement =
        state.settings.connectionType === "curve"
          ? svg("path", {
              ...hitAttrs,
              d: getCurvePath(endpoints.from, endpoints.to),
            })
          : svg("line", {
              ...hitAttrs,
              x1: endpoints.from.x,
              y1: endpoints.from.y,
              x2: endpoints.to.x,
              y2: endpoints.to.y,
            });
      group.append(hitElement);
      group.append(linkElement);

      if (!isLeaving && link.name) {
        const label = svg(
          "text",
          {
            class: `relation-label${isActiveLink || isSelectedLink ? " active" : ""}`,
            x: (fromPos.x + toPos.x) / 2,
            y: (fromPos.y + toPos.y) / 2 - 8,
          },
          link.name,
        );
        group.append(label);
      }
      const priority = isLeaving ? 1 : isSelectedLink ? 5 : isAppearing ? 4 : isActiveLink ? 3 : isPreviewLink ? 2 : isFocusLink ? 1 : 0;
      return { element: group, priority };
    })
    .filter((item): item is RenderItem => Boolean(item))
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.element);
  if (createHandlePreview) {
    const previewAttrs: SvgAttrs = {
      class: `create-drag-line${createHandlePreview.ready ? " ready" : ""}`,
    };
    const previewLine = state.settings.connectionType === "curve"
      ? svg("path", {
          ...previewAttrs,
          d: getCurvePath(createHandlePreview.from, createHandlePreview.to),
        })
      : svg("line", {
          ...previewAttrs,
          x1: createHandlePreview.from.x,
          y1: createHandlePreview.from.y,
          x2: createHandlePreview.to.x,
          y2: createHandlePreview.to.y,
        });
    const previewGroup = svg("g", {
      class: `create-drag-preview${createHandlePreview.ready ? " ready" : ""}`,
    });
    previewGroup.append(
      previewLine,
      svg("circle", {
        class: "create-drag-end",
        cx: createHandlePreview.to.x,
        cy: createHandlePreview.to.y,
        r: createHandlePreview.ready ? 6 : 4.5,
      }),
    );
    linkElements.push(previewGroup);
  }
  els.linksLayer.replaceChildren(...linkElements);

  const nodeElements = getGraphRenderThoughts()
    .map((thought): RenderItem | null => {
      if (shouldHideThought(thought.id)) return null;
      const thoughtEffect = graphEffects.dimThoughts.get(thought.id);
      const position = thoughtEffect?.position || positions.get(thought.id) || thought;
      const isActive = thought.id === graphFocusId;
      const isConnected = directFocusIds.has(thought.id) && !isActive;
      const isSecondaryFocus = secondaryFocusIds.has(thought.id);
      const isDimmed = Boolean(graphFocusId && (!directFocusIds.has(thought.id) || isSecondaryFocus));
      const isPreview = thought.id === previewId;
      const isPreviewRelated = previewIds.has(thought.id) && !isPreview;
      const isDeleting = thoughtEffect?.mode === "deleting";
      const isSoftDisconnected = graphEffects.dimThoughts.has(thought.id) && !isDeleting;
      const box = getGraphRenderNodeBox(thought.id);
      const scale = box.scale;
      const nodeWidth = box.baseWidth;
      const nodeHeight = box.baseHeight;
      const nodeHitWidth = box.hitBaseWidth;
      const nodeHitHeight = box.hitBaseHeight;
      const showKindLabel = isActive || isConnected || isPreview || isPreviewRelated || state.view.scale >= 1.2;
      const titleY = isMobileLayout() && showKindLabel ? -5 : showKindLabel ? -2 : 5;
      const kindY = isMobileLayout() ? 14 : 16;
      const nodeRadius = isActive ? 14 : 18;
      const titleText = trimLabel(thought.title, isActive ? 18 : 13);
      const ribbonWidth = isActive ? 6 : 5;
      const ribbonHeight = Math.max(nodeHeight - (isActive ? 22 : 20), 26);
      const ribbonX = -nodeWidth / 2 + 13;
      const showCreateHandles = !isDeleting && !isSoftDisconnected && (isActive || isPreview);
      const group = svg("g", {
        class: `node${isActive ? " active" : ""}${isConnected ? " connected" : ""}${isDimmed ? " dimmed" : ""}${isSoftDisconnected ? " soft-disconnected" : ""}${isDeleting ? " deleting" : ""}${
          isPreview ? " preview" : ""
        }${isPreviewRelated ? " preview-related" : ""}`,
        transform: `translate(${position.x} ${position.y}) scale(${scale})`,
        "data-id": thought.id,
        opacity: isDeleting ? 1 : isSoftDisconnected ? 0.3 : isDimmed && !isPreview && !isPreviewRelated ? 0.36 : 1,
      });
      group.append(svg("title", {}, `${thought.title} · ${isInboxThought(thought.id) ? "Inbox" : getKindName(thought.kind)}`));

      if (isActive) {
        group.append(
          svg("circle", { class: "node-orbit orbit-one", r: 58 }),
          svg("circle", { class: "node-orbit orbit-two", r: 72 }),
        );
      }

      group.append(
        svg("rect", {
          class: "node-hit",
          x: -nodeHitWidth / 2,
          y: -nodeHitHeight / 2,
          width: nodeHitWidth,
          height: nodeHitHeight,
          rx: 22,
          ry: 22,
        }),
      );
      group.append(
        svg("rect", {
          class: "node-shell",
          x: -nodeWidth / 2,
          y: -nodeHeight / 2,
          width: nodeWidth,
          height: nodeHeight,
          rx: nodeRadius,
          ry: nodeRadius,
        }),
      );
      group.append(
        svg("rect", {
          class: "node-ribbon",
          x: ribbonX,
          y: -ribbonHeight / 2,
          width: ribbonWidth,
          height: ribbonHeight,
          rx: ribbonWidth / 2,
          ry: ribbonWidth / 2,
          fill: getKindColor(thought.kind),
        }),
      );
      const textElements = [
        svg("text", { class: "node-title", y: titleY }, titleText),
      ];
      if (showKindLabel) {
        textElements.push(svg("text", { class: "node-kind", y: kindY }, isInboxThought(thought.id) ? "inbox" : getKindName(thought.kind)));
      }
      group.append(...textElements);
      if (showCreateHandles) {
        const handleGap = NODE_CREATE_HANDLE_GAP;
        const handles = [
          { direction: "top", relation: "child-of", x: 0, y: -nodeHeight / 2 - handleGap, label: "Add above" },
          { direction: "right", relation: "related", x: nodeWidth / 2 + handleGap, y: 0, label: "Add beside" },
          { direction: "bottom", relation: "parent-of", x: 0, y: nodeHeight / 2 + handleGap, label: "Add below" },
          { direction: "left", relation: "related", x: -nodeWidth / 2 - handleGap, y: 0, label: "Add beside" },
        ];
        const handleGroup = svg("g", { class: "node-create-handles" });
        handles.forEach((handle) => {
          const handleElement = svg("g", {
            class: "node-create-handle",
            transform: `translate(${handle.x} ${handle.y})`,
            "data-id": thought.id,
            "data-direction": handle.direction,
            "data-relation": handle.relation,
          });
          handleElement.append(
            svg("title", {}, handle.label),
            svg("circle", { class: "node-handle-hit", r: 14 }),
            svg("circle", { class: "node-handle-dot", r: 5.8 }),
          );
          handleGroup.append(handleElement);
        });
        group.append(handleGroup);
      }
      const priority = isActive ? 4 : isPreview ? 3 : isConnected || isPreviewRelated ? 2 : isDimmed ? 0 : 1;
      return { element: group, priority };
    })
    .filter((item): item is RenderItem => Boolean(item))
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.element);
  els.nodesLayer.replaceChildren(...nodeElements);
}
