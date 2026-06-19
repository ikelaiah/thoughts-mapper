import {
  arrangeHorizontalThoughtRow,
  arrangeVerticalThoughtColumn,
  easeOutCubic,
  getNodeBox as calculateNodeBox,
  interpolate,
  interpolatePositions,
} from "./graph-layout";
import { renderGraphView } from "./graph-render";
import {
  APP_DATA_VERSION,
  DEFAULT_KIND_ID,
  HISTORY_LIMIT,
  LINK_DRAW_DURATION,
  NEW_KIND_VALUE,
  colourSchemes,
  defaultKindDefinitions,
  kindColourPalette,
  legacyKindStyles,
  seedState,
  templateCatalog,
} from "./constants";
import { loadIndexedState, loadLocalState, openDatabase, persistIndexedState, persistLocalState } from "./storage";
import { bindUiEvents } from "./ui-events";
import type {
  AddKindOptions,
  AddThoughtOptions,
  AppData,
  AppElements,
  CenterOptions,
  CreateKindOptions,
  GraphEffects,
  GraphTransitionOptions,
  Link,
  LinkRenderEffect,
  LinkRelation,
  LinkType,
  MapSettings,
  MobileLibraryOptions,
  NodeBox,
  ParentRelatedOptions,
  PointerMode,
  PointerStart,
  Point,
  PositionMap,
  ProjectState,
  RetargetRelation,
  SelectThoughtOptions,
  SvgAttrs,
  Thought,
  ThoughtRenderEffect,
  ViewState,
} from "./types";
let state: ProjectState = clone(seedState);
let appData: AppData | null = null;
let db: IDBDatabase | null = null;
let storageMode = "indexeddb";
let saveTimer: number | undefined;
let statusTimer: number | undefined;
let graphRect = { width: 1, height: 1 };
type PanelSide = "left" | "right";
const PANEL_WIDTH_RULES: Record<PanelSide, { storageKey: string; defaultValue: number; min: number; max: number }> = {
  left: { storageKey: "thoughts-mapper:left-panel-width", defaultValue: 320, min: 240, max: 460 },
  right: { storageKey: "thoughts-mapper:right-panel-width", defaultValue: 360, min: 300, max: 560 },
};
let panelWidths: Record<PanelSide, number> = {
  left: readPanelWidth("left"),
  right: readPanelWidth("right"),
};
let panelResize: { side: PanelSide; startX: number; startWidth: number; pointerId: number; handle: HTMLElement } | null = null;
let pointerMode: PointerMode | null = null;
let pointerStart: PointerStart | null = null;
let focusAnimation: number | null = null;
let focusPositions: PositionMap | null = null;
let pendingGraphTransition: number | null = null;
const graphEffects: GraphEffects = {
  appearingLinkIds: new Set<string>(),
  leavingLinks: [] as LinkRenderEffect[],
  dimThoughts: new Map<string, ThoughtRenderEffect>(),
};
let contextAnchorId: string | null = null;
let contextLinkId: string | null = null;
let hoverThoughtId: string | null = null;
let selectedLinkId: string | null = null;
let undoStack: string[] = [];
let redoStack: string[] = [];
let showInboxOnly = false;
let sidebarHidden = false;
let detailsHidden = false;
let newProjectPanelOpen = false;
let moreMenuOpen = false;
let inboxReviewOpen = false;
let inboxReviewIndex = 0;
const mobileLayoutQuery = window.matchMedia("(max-width: 720px)");
let mobileLibraryOpen = false;
let mobileDetailsOpen = false;
let mobileCaptureOpen = false;
let wasMobileLayout: boolean | null = null;
let projectControlsHome: Comment | null = null;
let sidebarActionsHome: Comment | null = null;

const els: AppElements = {
  appShell: qs("#appShell"),
  leftResizeHandle: qs("#leftResizeHandle"),
  rightResizeHandle: qs("#rightResizeHandle"),
  saveState: qs("#saveState"),
  libraryCloseButton: qs("#libraryCloseButton"),
  projectControls: qs("#projectControls"),
  projectSelect: qs("#projectSelect"),
  projectNameInput: qs("#projectNameInput"),
  newProjectToggleButton: qs("#newProjectToggleButton"),
  newProjectPanel: qs("#newProjectPanel"),
  templateSelect: qs("#templateSelect"),
  newProjectNameInput: qs("#newProjectNameInput"),
  createTemplateButton: qs("#createTemplateButton"),
  searchInput: qs("#searchInput"),
  quickCaptureForm: qs("#quickCaptureForm"),
  quickCaptureInput: qs("#quickCaptureInput"),
  tagFilterInput: qs("#tagFilterInput"),
  inboxFilterButton: qs("#inboxFilterButton"),
  inboxCount: qs("#inboxCount"),
  thoughtCount: qs("#thoughtCount"),
  thoughtList: qs("#thoughtList"),
  sidebarActions: qs(".sidebar-actions"),
  exportButton: qs("#exportButton"),
  markdownExportButton: qs("#markdownExportButton"),
  importInput: qs("#importInput"),
  sidebarToggleButton: qs("#sidebarToggleButton"),
  detailsToggleButton: qs("#detailsToggleButton"),
  moreButton: qs("#moreButton"),
  moreMenu: qs("#moreMenu"),
  undoButton: qs("#undoButton"),
  redoButton: qs("#redoButton"),
  fitButton: qs("#fitButton"),
  centerButton: qs("#centerButton"),
  resetButton: qs("#resetButton"),
  settingsButton: qs("#settingsButton"),
  settingsMenuButton: qs("#settingsMenuButton"),
  stagePrompt: qs("#stagePrompt"),
  settingsPage: qs("#settingsPage"),
  settingsCloseButton: qs("#settingsCloseButton"),
  mobileManagement: qs("#mobileManagement"),
  colourSchemeInput: qs("#colourSchemeInput"),
  lineThicknessInput: qs("#lineThicknessInput"),
  lineThicknessValue: qs("#lineThicknessValue"),
  connectionTypeInput: qs("#connectionTypeInput"),
  lineEndpointInput: qs("#lineEndpointInput"),
  calmModeInput: qs("#calmModeInput"),
  kindList: qs("#kindList"),
  newKindNameInput: qs("#newKindNameInput"),
  newKindColorInput: qs("#newKindColorInput"),
  addKindButton: qs("#addKindButton"),
  graph: qs("#graph"),
  graphBackground: qs("#graphBackground"),
  viewport: qs("#viewport"),
  linksLayer: qs("#linksLayer"),
  nodesLayer: qs("#nodesLayer"),
  detailsEmpty: qs("#detailsEmpty"),
  detailsCloseButton: qs("#detailsCloseButton"),
  detailsPanel: qs("#detailsPanel"),
  selectedType: qs("#selectedType"),
  deleteButton: qs("#deleteButton"),
  titleInput: qs("#titleInput"),
  kindInput: qs("#kindInput"),
  kindColorInput: qs("#kindColorInput"),
  kindDefaultButton: qs("#kindDefaultButton"),
  tagInput: qs("#tagInput"),
  inboxPlacementPanel: qs("#inboxPlacementPanel"),
  placeTargetInput: qs("#placeTargetInput"),
  placeRelationInput: qs("#placeRelationInput"),
  placeThoughtButton: qs("#placeThoughtButton"),
  placePreviewText: qs("#placePreviewText"),
  noteInput: qs("#noteInput"),
  notePreview: qs("#notePreview"),
  linkForm: qs("#linkForm"),
  linkTargetInput: qs("#linkTargetInput"),
  linkTargetOptions: qs("#linkTargetOptions"),
  linkRelationInput: qs("#linkRelationInput"),
  linkSubmitButton: qs("#linkSubmitButton"),
  linkPreviewText: qs("#linkPreviewText"),
  connectionCount: qs("#connectionCount"),
  connectionList: qs("#connectionList"),
  backlinkCount: qs("#backlinkCount"),
  backlinkList: qs("#backlinkList"),
  mentionCount: qs("#mentionCount"),
  mentionList: qs("#mentionList"),
  inboxReviewPanel: qs("#inboxReviewPanel"),
  inboxReviewProgress: qs("#inboxReviewProgress"),
  inboxReviewCloseButton: qs("#inboxReviewCloseButton"),
  inboxReviewPrevButton: qs("#inboxReviewPrevButton"),
  inboxReviewNextButton: qs("#inboxReviewNextButton"),
  inboxReviewTitle: qs("#inboxReviewTitle"),
  inboxReviewNote: qs("#inboxReviewNote"),
  inboxReviewTargetInput: qs("#inboxReviewTargetInput"),
  inboxReviewPreview: qs("#inboxReviewPreview"),
  inboxReviewChildButton: qs("#inboxReviewChildButton"),
  inboxReviewParentButton: qs("#inboxReviewParentButton"),
  inboxReviewRelatedButton: qs("#inboxReviewRelatedButton"),
  inboxReviewKeepButton: qs("#inboxReviewKeepButton"),
  contextMenu: qs("#contextMenu"),
  nodeCreateForm: qs("#nodeCreateForm"),
  nodeCreateInput: qs("#nodeCreateInput"),
  nodeCreateNoteInput: qs("#nodeCreateNoteInput"),
  nodeCreateRelationInput: qs("#nodeCreateRelationInput"),
  nodeCreateCancelButton: qs("#nodeCreateCancelButton"),
  linkEditForm: qs("#linkEditForm"),
  linkNameInput: qs("#linkNameInput"),
  linkDirectionInput: qs("#linkDirectionInput"),
  linkUnlinkButton: qs("#linkUnlinkButton"),
  linkKeepInput: qs("#linkKeepInput"),
  linkRetargetInput: qs("#linkRetargetInput"),
  linkRetargetRelationInput: qs("#linkRetargetRelationInput"),
  linkRetargetButton: qs("#linkRetargetButton"),
  mobileScrim: qs("#mobileScrim"),
  mobileCaptureButton: qs("#mobileCaptureButton"),
  mobileCaptureForm: qs("#mobileCaptureForm"),
  mobileCaptureInput: qs("#mobileCaptureInput"),
  mobileCaptureCancelButton: qs("#mobileCaptureCancelButton"),
};

init();

async function init() {
  try {
    db = await openDatabase();
    appData = sanitizeAppData((await loadIndexedState(db)) || seedState);
  } catch {
    storageMode = "localstorage";
    appData = sanitizeAppData(loadLocalState() || seedState);
  }
  state = clone(getActiveProject().state);
  setupResponsiveManagementSlots();
  applyPanelWidths();
  measureGraph();
  bindEvents();
  syncResponsiveLayout();
  render();
  requestAnimationFrame(fitToGraph);
}

function persistState() {
  els.saveState.textContent = "Saving";
  clearTimeout(statusTimer);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    syncActiveProject();
    if (storageMode === "localstorage") {
      persistLocalState(appData);
      els.saveState.textContent = "Saved";
      return;
    }

    if (!db) return;
    persistIndexedState(db, appData).then(() => {
      els.saveState.textContent = "Saved";
    }).catch(() => {
      els.saveState.textContent = "Save failed";
    });
  }, 180);
}

function setStatus(message, duration = 1400) {
  els.saveState.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    els.saveState.textContent = "Saved";
  }, duration);
}

function sanitizeAppData(raw) {
  if (raw && Array.isArray(raw.projects)) {
    const projects = raw.projects
      .map((project, index) => sanitizeProject(project, index))
      .filter(Boolean);
    if (!projects.length) projects.push(createProject("Thoughts Mapper", seedState));
    const activeProjectId = projects.some((project) => project.id === raw.activeProjectId)
      ? raw.activeProjectId
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

function sanitizeProject(project, index = 0) {
  if (!project) return null;
  return {
    id: String(project.id || makeId("project")),
    name: String(project.name || `Project ${index + 1}`).slice(0, 80),
    updatedAt: project.updatedAt || new Date().toISOString(),
    state: sanitizeState(project.state || seedState),
  };
}

function createProject(name, projectState) {
  return {
    id: makeId("project"),
    name: String(name || "Untitled project").slice(0, 80),
    updatedAt: new Date().toISOString(),
    state: sanitizeState(projectState || seedState),
  };
}

function getActiveProject() {
  let project = appData.projects.find((item) => item.id === appData.activeProjectId);
  if (!project) {
    project = appData.projects[0] || createProject("Thoughts Mapper", seedState);
    appData.projects = [project];
    appData.activeProjectId = project.id;
  }
  return project;
}

function syncActiveProject() {
  if (!appData) return;
  const project = getActiveProject();
  project.state = sanitizeState(state);
  project.updatedAt = new Date().toISOString();
}

function sanitizeKindDefinitions(kinds, thoughts = []) {
  const byId = new Map();
  const sourceKinds = Array.isArray(kinds) && kinds.length ? kinds : defaultKindDefinitions;
  sourceKinds.forEach((kind, index) => {
    const name = normalizeKindName(kind?.name || kind?.id || `Kind ${index + 1}`);
    const id = sanitizeKindId(kind?.id || name);
    if (!id) return;
    if (byId.has(id)) {
      const existing = byId.get(id);
      byId.set(id, {
        ...existing,
        name,
        color: sanitizeKindColor(kind?.color, existing.color),
      });
      return;
    }
    byId.set(id, {
      id,
      name,
      color: sanitizeKindColor(kind?.color, kindColourPalette[index % kindColourPalette.length]),
    });
  });
  thoughts.forEach((thought) => {
    const id = sanitizeKindId(thought?.kind);
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

function sanitizeState(nextState) {
  const clean = clone(nextState);
  clean.thoughts = Array.isArray(clean.thoughts) ? clean.thoughts : [];
  clean.links = Array.isArray(clean.links) ? clean.links : [];
  clean.view = clean.view || { x: 0, y: 0, scale: 1 };
  clean.kinds = sanitizeKindDefinitions(clean.kinds, clean.thoughts);
  clean.defaultKindId = clean.kinds.some((kind) => kind.id === clean.defaultKindId)
    ? clean.defaultKindId
    : clean.kinds[0]?.id || DEFAULT_KIND_ID;
  const previousSettings = clean.settings || {};
  clean.settings = {
    theme: ["light", "dark"].includes(previousSettings.theme) ? previousSettings.theme : "light",
    background: [
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
    ].includes(previousSettings.background)
      ? previousSettings.background
      : "calm",
    calmMode: typeof previousSettings.calmMode === "boolean" ? previousSettings.calmMode : true,
    lineThickness: clamp(Number(previousSettings.lineThickness) || 1.5, 1, 8),
    connectionType: ["straight", "curve"].includes(previousSettings.connectionType)
      ? previousSettings.connectionType
      : "curve",
    lineEndpoint: ["floating", "touching"].includes(previousSettings.lineEndpoint)
      ? previousSettings.lineEndpoint
      : "floating",
  };
  clean.thoughts = clean.thoughts.map((thought, index) => ({
    id: thought.id || makeId("t"),
    title: String(thought.title || "Untitled").slice(0, 80),
    kind: clean.kinds.some((kind) => kind.id === thought.kind) ? thought.kind : clean.defaultKindId,
    note: String(thought.note || ""),
    tags: normalizeTags(thought.tags),
    x: Number.isFinite(thought.x) ? thought.x : index * 120,
    y: Number.isFinite(thought.y) ? thought.y : index * 80,
  }));
  const ids = new Set(clean.thoughts.map((thought) => thought.id));
  clean.links = clean.links
    .filter((link) => ids.has(link.from) && ids.has(link.to) && link.from !== link.to)
    .map((link) => ({
      id: link.id || makeId("l"),
      from: link.from,
      to: link.to,
      type: link.type === "related" ? "related" : "parent",
      name: String(link.name || "").slice(0, 80),
    }));
  if (!ids.has(clean.selectedId)) {
    clean.selectedId = clean.thoughts[0]?.id || null;
  }
  return clean;
}

function bindEvents() {
  bindUiEvents(els, {
    onResize: () => {
      syncResponsiveLayout();
      applyPanelWidths();
      measureGraph();
      renderGraph();
    },
    startLeftPanelResize: (event) => startPanelResize(event, "left"),
    startRightPanelResize: (event) => startPanelResize(event, "right"),
    resetLeftPanelWidth: () => resetPanelWidth("left"),
    resetRightPanelWidth: () => resetPanelWidth("right"),
    closeMobilePanels,
    switchProject,
    renameActiveProject,
    toggleNewProjectPanel,
    createProjectFromSelectedTemplate,
    renderThoughtList,
    onQuickCaptureSubmit,
    toggleMobileCapture,
    closeMobileCapture,
    onMobileCaptureSubmit,
    handleInboxFilterClick: () => {
      const inboxThoughts = getInboxThoughts();
      if (inboxThoughts.length) {
        openInboxReview();
        return;
      }
      showInboxOnly = !showInboxOnly;
      renderThoughtList();
    },
    exportMap,
    exportMarkdown,
    importMap,
    toggleSidebar,
    toggleDetailsPanel,
    toggleMoreMenu,
    undoAndCloseMoreMenu: () => {
      undo();
      closeMoreMenu();
    },
    redoAndCloseMoreMenu: () => {
      redo();
      closeMoreMenu();
    },
    fitToGraph,
    centerAndCloseMoreMenu: () => {
      centerSelected();
      closeMoreMenu();
    },
    openSettingsAndCloseMoreMenu: () => {
      openSettings();
      closeMoreMenu();
    },
    closeSettings,
    onColourSchemeChange: () => {
      const scheme = colourSchemes[els.colourSchemeInput.value] || colourSchemes["light-mint"];
      pushHistory();
      state.settings.theme = scheme.theme;
      state.settings.background = scheme.background;
      applySettings();
      persistState();
    },
    onLineThicknessInput: () => {
      pushHistory();
      state.settings.lineThickness = Number(els.lineThicknessInput.value);
      applySettings();
      renderGraph();
      persistState();
    },
    onConnectionTypeChange: () => {
      pushHistory();
      state.settings.connectionType = els.connectionTypeInput.value as MapSettings["connectionType"];
      applySettings();
      renderGraph();
      persistState();
    },
    onLineEndpointChange: () => {
      pushHistory();
      state.settings.lineEndpoint = els.lineEndpointInput.value as MapSettings["lineEndpoint"];
      applySettings();
      renderGraph();
      persistState();
    },
    onCalmModeChange: () => {
      pushHistory();
      state.settings.calmMode = els.calmModeInput.checked;
      applySettings();
      focusPositions = computeFocusPositions(state.selectedId);
      renderGraph();
      persistState();
    },
    resetViewAndCloseMoreMenu: () => {
      resetView();
      closeMoreMenu();
    },
    onTitleInput: () => {
      const selected = getSelectedThought();
      if (!selected) return;
      pushHistory();
      selected.title = els.titleInput.value;
      render();
      persistState();
    },
    onKindChange: () => {
      const selected = getSelectedThought();
      if (!selected) return;
      if (els.kindInput.value === NEW_KIND_VALUE) {
        createKindFromPrompt({ assignToThoughtId: selected.id });
        return;
      }
      pushHistory();
      selected.kind = els.kindInput.value;
      render();
      persistState();
    },
    onKindColorChange: () => {
      const selected = getSelectedThought();
      const kind = selected ? getKindDefinition(selected.kind) : null;
      if (!kind) return;
      pushHistory();
      kind.color = sanitizeKindColor(els.kindColorInput.value, kind.color);
      render();
      persistState();
    },
    onKindDefaultClick: () => {
      const selected = getSelectedThought();
      if (!selected || state.defaultKindId === selected.kind) return;
      pushHistory();
      state.defaultKindId = selected.kind;
      render();
      persistState();
    },
    addKindFromSettings,
    onNewKindNameKeydown: (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addKindFromSettings();
    },
    onTagChange: () => {
      const selected = getSelectedThought();
      if (!selected) return;
      pushHistory();
      selected.tags = normalizeTags(els.tagInput.value);
      render();
      persistState();
    },
    onNoteInput: () => {
      const selected = getSelectedThought();
      if (!selected) return;
      pushHistory();
      selected.note = els.noteInput.value;
      renderThoughtList();
      renderMentionPanels(selected);
      persistState();
    },
    onNoteBlur: () => {
      showNotePreview(els.noteInput.value);
    },
    onNotePreviewClick: (event) => {
      const mention = getClosestElement(event.target, "[data-mention-id]");
      if (mention) {
        event.stopPropagation();
        selectThought(mention.dataset.mentionId);
        return;
      }
      startNoteEditing();
    },
    onNotePreviewKeydown: (event) => {
      const mention = getClosestElement(event.target, "[data-mention-id]");
      if (mention && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        selectThought(mention.dataset.mentionId);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startNoteEditing();
      }
    },
    onLinkSubmit: (event) => {
      event.preventDefault();
      const target = resolveLinkTarget(els.linkTargetInput.value);
      addLink(state.selectedId, target?.id || null, els.linkRelationInput.value as LinkRelation);
      if (target) els.linkTargetInput.value = "";
    },
    renderRelationshipPreviews,
    placeInboxThought,
    closeInboxReview,
    previousInboxReviewThought,
    nextInboxReviewThought,
    placeInboxReviewAsChild: () => placeInboxReviewThought("child-of"),
    placeInboxReviewAsParent: () => placeInboxReviewThought("parent-of"),
    placeInboxReviewRelated: () => placeInboxReviewThought("related"),
    keepInboxReviewThought,
    deleteSelectedThought,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    clearHoverThought,
    onGraphContextMenu,
    onWheel,
    onNodeCreateSubmit,
    closeContextMenu,
    onLinkEditSubmit,
    unlinkContextLink,
    renderLinkRetargetOptions,
    retargetContextLink,
    onDocumentPointerMove,
    onDocumentPointerUp,
    onDocumentPointerDown,
    onKeyDown: (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusQuickCapture();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && !isTextEditing(event.target)) {
        event.preventDefault();
        focusSearch();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !isTextEditing(event.target)) {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y" && !isTextEditing(event.target)) {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Escape") {
        closeContextMenu();
        closeSettings();
        closeMoreMenu();
        closeInboxReview();
        closeMobilePanels();
        closeMobileCapture();
      }
    },
  });
}
function setupResponsiveManagementSlots() {
  projectControlsHome = document.createComment("project-controls-home");
  els.projectControls.before(projectControlsHome);
  sidebarActionsHome = document.createComment("sidebar-actions-home");
  els.sidebarActions.before(sidebarActionsHome);
}

function isMobileLayout() {
  return mobileLayoutQuery.matches;
}

function syncResponsiveLayout() {
  const mobile = isMobileLayout();
  if (wasMobileLayout !== mobile) {
    if (mobile) {
      mobileLibraryOpen = false;
      mobileDetailsOpen = false;
    } else {
      mobileCaptureOpen = false;
    }
    wasMobileLayout = mobile;
  }
  moveManagementControls(mobile);
  renderPanelState();
  renderMobileCapture();
}

function moveManagementControls(mobile) {
  if (!projectControlsHome || !sidebarActionsHome) return;
  if (mobile) {
    els.mobileManagement.append(els.projectControls, els.sidebarActions);
    return;
  }

  projectControlsHome.after(els.projectControls);
  sidebarActionsHome.after(els.sidebarActions);
}

function measureGraph() {
  const bounds = els.graph.getBoundingClientRect();
  graphRect = {
    width: Math.max(bounds.width, 1),
    height: Math.max(bounds.height, 1),
  };
}

function readPanelWidth(side: PanelSide) {
  const rule = PANEL_WIDTH_RULES[side];
  try {
    const stored = Number(window.localStorage.getItem(rule.storageKey));
    if (Number.isFinite(stored)) return clamp(stored, rule.min, rule.max);
  } catch {
    // Layout preferences are optional; blocked storage should not affect the app.
  }
  return rule.defaultValue;
}

function applyPanelWidths() {
  clampPanelWidths();
  els.appShell.style.setProperty("--left-panel-width", `${panelWidths.left}px`);
  els.appShell.style.setProperty("--right-panel-width", `${panelWidths.right}px`);
  updatePanelResizeHandleValues();
}

function clampPanelWidths() {
  (Object.keys(PANEL_WIDTH_RULES) as PanelSide[]).forEach((side) => {
    const rule = PANEL_WIDTH_RULES[side];
    panelWidths[side] = clamp(panelWidths[side], rule.min, getPanelMaxWidth(side));
  });
}

function getPanelMaxWidth(side: PanelSide) {
  const rule = PANEL_WIDTH_RULES[side];
  const otherSide: PanelSide = side === "left" ? "right" : "left";
  const otherHidden = otherSide === "left" ? sidebarHidden : detailsHidden;
  const otherWidth = otherHidden || isMobileLayout() ? 0 : panelWidths[otherSide];
  const minimumStageWidth = 440;
  const available = window.innerWidth - otherWidth - minimumStageWidth;
  return Math.max(rule.min, Math.min(rule.max, available));
}

function updatePanelResizeHandleValues() {
  els.leftResizeHandle.setAttribute("aria-valuemin", String(PANEL_WIDTH_RULES.left.min));
  els.leftResizeHandle.setAttribute("aria-valuemax", String(getPanelMaxWidth("left")));
  els.leftResizeHandle.setAttribute("aria-valuenow", String(Math.round(panelWidths.left)));
  els.rightResizeHandle.setAttribute("aria-valuemin", String(PANEL_WIDTH_RULES.right.min));
  els.rightResizeHandle.setAttribute("aria-valuemax", String(getPanelMaxWidth("right")));
  els.rightResizeHandle.setAttribute("aria-valuenow", String(Math.round(panelWidths.right)));
}

function startPanelResize(event: PointerEvent, side: PanelSide) {
  if (isMobileLayout() || (side === "left" && sidebarHidden) || (side === "right" && detailsHidden)) return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement;
  panelResize = {
    side,
    startX: event.clientX,
    startWidth: panelWidths[side],
    pointerId: event.pointerId,
    handle,
  };
  handle.setPointerCapture(event.pointerId);
  document.body.classList.add("panel-resizing");
}

function onDocumentPointerMove(event: PointerEvent) {
  if (!panelResize) return;
  event.preventDefault();
  const deltaX = event.clientX - panelResize.startX;
  const width = panelResize.side === "left"
    ? panelResize.startWidth + deltaX
    : panelResize.startWidth - deltaX;
  setPanelWidth(panelResize.side, width);
}

function onDocumentPointerUp(event: PointerEvent) {
  if (!panelResize || event.pointerId !== panelResize.pointerId) return;
  try {
    panelResize.handle.releasePointerCapture(event.pointerId);
  } catch {
    // The pointer can already be released if the browser cancels the drag.
  }
  panelResize = null;
  document.body.classList.remove("panel-resizing");
  persistPanelWidths();
  refreshGraphAfterPanelChange();
}

function setPanelWidth(side: PanelSide, width: number) {
  const rule = PANEL_WIDTH_RULES[side];
  panelWidths[side] = clamp(width, rule.min, getPanelMaxWidth(side));
  applyPanelWidths();
  measureGraph();
  renderGraph();
}

function resetPanelWidth(side: PanelSide) {
  panelWidths[side] = PANEL_WIDTH_RULES[side].defaultValue;
  applyPanelWidths();
  persistPanelWidths();
  refreshGraphAfterPanelChange();
}

function persistPanelWidths() {
  try {
    (Object.keys(PANEL_WIDTH_RULES) as PanelSide[]).forEach((side) => {
      window.localStorage.setItem(PANEL_WIDTH_RULES[side].storageKey, String(Math.round(panelWidths[side])));
    });
  } catch {
    // Non-critical preference persistence.
  }
}

function render() {
  syncSelectedLink();
  renderProjectControls();
  applySettings();
  renderPanelState();
  renderMoreMenu();
  renderHistoryControls();
  renderThoughtList();
  renderDetails();
  renderKindSettings();
  renderInboxReview();
  renderGraph();
}

function applySettings() {
  document.body.dataset.theme = state.settings.theme;
  document.body.dataset.background = state.settings.background;
  els.colourSchemeInput.value = getColourSchemeId(state.settings.theme, state.settings.background);
  els.lineThicknessInput.value = String(state.settings.lineThickness);
  els.lineThicknessValue.value = state.settings.lineThickness.toFixed(1);
  els.lineThicknessValue.textContent = `${state.settings.lineThickness.toFixed(1)} px`;
  els.connectionTypeInput.value = state.settings.connectionType;
  els.lineEndpointInput.value = state.settings.lineEndpoint;
  els.calmModeInput.checked = Boolean(state.settings.calmMode);
}

function getColourSchemeId(theme, background) {
  const match = Object.entries(colourSchemes).find(([, scheme]) => scheme.theme === theme && scheme.background === background);
  return match ? match[0] : "light-mint";
}

function renderProjectControls() {
  const currentTemplate = els.templateSelect.value;
  const activeProject = getActiveProject();
  els.projectControls.classList.toggle("collapsed", !newProjectPanelOpen);
  els.newProjectPanel.hidden = !newProjectPanelOpen;
  els.newProjectToggleButton.textContent = newProjectPanelOpen ? "Cancel new project" : "New project";
  els.projectSelect.replaceChildren(
    ...appData.projects.map((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      return option;
    }),
  );
  els.projectSelect.value = appData.activeProjectId;
  if (document.activeElement !== els.projectNameInput) {
    els.projectNameInput.value = activeProject.name;
  }
  els.templateSelect.replaceChildren(
    optionElement("", "Choose template"),
    ...templateCatalog.map((template) => optionElement(template.id, template.name)),
  );
  els.templateSelect.value = templateCatalog.some((template) => template.id === currentTemplate) ? currentTemplate : "";
}

function toggleNewProjectPanel() {
  newProjectPanelOpen = !newProjectPanelOpen;
  renderProjectControls();
  if (newProjectPanelOpen) {
    requestAnimationFrame(() => els.newProjectNameInput.focus());
  }
}

function switchProject() {
  const nextProjectId = els.projectSelect.value;
  if (!nextProjectId || nextProjectId === appData.activeProjectId) return;
  syncActiveProject();
  clearTimeout(saveTimer);
  appData.activeProjectId = nextProjectId;
  state = clone(getActiveProject().state);
  resetProjectSessionState();
  render();
  requestAnimationFrame(fitToGraph);
  persistState();
  setStatus("Project switched");
}

function createProjectFromSelectedTemplate() {
  const template = templateCatalog.find((item) => item.id === els.templateSelect.value);
  if (!template) return;
  syncActiveProject();
  clearTimeout(saveTimer);
  const projectName = els.newProjectNameInput.value.trim() || template.name;
  const project = createProject(projectName, createTemplateState(template));
  appData.projects.push(project);
  appData.activeProjectId = project.id;
  state = clone(project.state);
  els.templateSelect.value = "";
  els.newProjectNameInput.value = "";
  newProjectPanelOpen = false;
  resetProjectSessionState();
  render();
  requestAnimationFrame(fitToGraph);
  persistState();
  setStatus("Project created");
}

function renameActiveProject() {
  const project = getActiveProject();
  const name = els.projectNameInput.value.trim();
  if (!name || name === project.name) {
    els.projectNameInput.value = project.name;
    return;
  }
  project.name = name.slice(0, 80);
  project.updatedAt = new Date().toISOString();
  renderProjectControls();
  persistState();
  setStatus("Project renamed");
}

function resetProjectSessionState() {
  undoStack = [];
  redoStack = [];
  showInboxOnly = false;
  focusPositions = null;
  hoverThoughtId = null;
  contextAnchorId = null;
  contextLinkId = null;
  selectedLinkId = null;
  els.searchInput.value = "";
  els.tagFilterInput.value = "";
}

function createTemplateState(template) {
  const rootId = `template-${template.id}-root`;
  const thoughts = [
    {
      id: rootId,
      title: template.root,
      kind: "project",
      note: `Starter map for ${template.name}.`,
      tags: normalizeTags(template.tags || []),
      x: 0,
      y: 0,
    },
  ];
  const links = [];
  const spacing = 210;
  const startX = -((template.children.length - 1) * spacing) / 2;

  template.children.forEach(([title, kind, note], index) => {
    const id = `template-${template.id}-${index + 1}`;
    thoughts.push({
      id,
      title,
      kind,
      note,
      tags: normalizeTags(template.tags || []),
      x: startX + index * spacing,
      y: 235,
    });
    links.push({ id: `template-${template.id}-link-${index + 1}`, from: rootId, to: id, type: "parent" });
  });

  if (template.children.length >= 4) {
    links.push({ id: `template-${template.id}-related-1`, from: `template-${template.id}-1`, to: `template-${template.id}-2`, type: "related" });
    links.push({ id: `template-${template.id}-related-2`, from: `template-${template.id}-3`, to: `template-${template.id}-4`, type: "related" });
  }

  return sanitizeState({
    kinds: clone(state?.kinds || seedState.kinds),
    defaultKindId: state?.defaultKindId || DEFAULT_KIND_ID,
    thoughts,
    links,
    selectedId: rootId,
    view: { x: 0, y: 0, scale: 1 },
    settings: clone(seedState.settings),
  });
}

function renderThoughtList() {
  const query = els.searchInput.value.trim().toLowerCase();
  const inboxThoughts = getInboxThoughts();
  const tags = getAllTags();
  const previousTag = els.tagFilterInput.value;
  els.tagFilterInput.replaceChildren(
    optionElement("", "All tags"),
    ...tags.map((tag) => optionElement(tag, `#${tag}`)),
  );
  els.tagFilterInput.value = tags.includes(previousTag) ? previousTag : "";
  const tagFilter = els.tagFilterInput.value;
  els.inboxCount.textContent = String(inboxThoughts.length);
  els.inboxFilterButton.classList.toggle("active", showInboxOnly);
  const thoughts = state.thoughts
    .filter((thought) => {
      const haystack = `${thought.title} ${getKindName(thought.kind)} ${thought.note} ${thought.tags.join(" ")}`.toLowerCase();
      const matchesQuery = haystack.includes(query);
      const matchesTag = !tagFilter || thought.tags.includes(tagFilter);
      const matchesInbox = !showInboxOnly || isInboxThought(thought.id);
      return matchesQuery && matchesTag && matchesInbox;
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  els.thoughtCount.textContent = String(state.thoughts.length);
  els.thoughtList.replaceChildren(
    ...thoughts.map((thought) => {
      const button = document.createElement("button");
      button.className = `thought-row${thought.id === state.selectedId ? " active" : ""}`;
      button.type = "button";
      button.addEventListener("click", () => selectThought(thought.id));

      const dot = document.createElement("span");
      dot.className = "thought-dot";
      dot.style.background = getKindColor(thought.kind);

      const text = document.createElement("span");
      text.className = "thought-row-text";
      const name = document.createElement("span");
      name.className = "thought-name";
      name.textContent = thought.title;
      const kind = document.createElement("span");
      kind.className = "thought-kind";
      kind.textContent = [getKindName(thought.kind), isInboxThought(thought.id) ? "inbox" : "", thought.tags[0] ? `#${thought.tags[0]}` : ""]
        .filter(Boolean)
        .join(" · ");
      text.append(name, kind);
      button.append(dot, text);
      return button;
    }),
  );
}

function renderDetails() {
  const selected = getSelectedThought();
  els.detailsEmpty.hidden = Boolean(selected);
  els.detailsPanel.hidden = !selected;
  els.stagePrompt.hidden = Boolean(selected);
  if (!selected) return;

  const selectedKind = getKindDefinition(selected.kind);
  els.selectedType.textContent = getKindName(selected.kind);
  els.selectedType.style.background = colorWithAlpha(selectedKind.color, 0.14);
  els.selectedType.style.color = selectedKind.color;
  els.titleInput.value = selected.title;
  renderKindInspector(selected);
  els.tagInput.value = selected.tags.join(", ");
  if (document.activeElement !== els.noteInput) {
    els.noteInput.value = selected.note;
    showNotePreview(selected.note);
  }

  const candidates = state.thoughts.filter((thought) => thought.id !== selected.id).sort((a, b) => a.title.localeCompare(b.title));
  const linkTargetValue = els.linkTargetInput.value;
  const placeTargetId = els.placeTargetInput.value;
  els.linkTargetOptions.replaceChildren(
    ...candidates.map((thought) => {
      const option = document.createElement("option");
      option.value = thought.title;
      option.label = getKindName(thought.kind);
      option.dataset.id = thought.id;
      return option;
    }),
  );
  if (linkTargetValue && !resolveLinkTarget(linkTargetValue, candidates)) els.linkTargetInput.value = "";
  els.placeTargetInput.replaceChildren(
    ...candidates.map((thought) => {
      const option = document.createElement("option");
      option.value = thought.id;
      option.textContent = thought.title;
      return option;
    }),
  );
  if (candidates.some((thought) => thought.id === placeTargetId)) els.placeTargetInput.value = placeTargetId;
  const isInbox = isInboxThought(selected.id);
  els.inboxPlacementPanel.hidden = !isInbox || !candidates.length;
  els.linkForm.hidden = isInbox && candidates.length > 0;
  els.linkTargetInput.disabled = !candidates.length;
  els.linkRelationInput.disabled = !candidates.length;
  els.linkSubmitButton.disabled = !candidates.length;
  els.placeTargetInput.disabled = !candidates.length;
  els.placeRelationInput.disabled = !candidates.length;
  els.placeThoughtButton.disabled = !candidates.length;
  renderRelationshipPreviews();

  const connected = getConnections(selected.id);
  els.connectionCount.textContent = String(connected.length);
  els.connectionList.replaceChildren(
    ...connected.map(({ linkId, linkName, thought, role }) => {
      const item = document.createElement("div");
      item.className = "connection-item connection-row";
      if (linkName) item.title = linkName;

      const openButton = document.createElement("button");
      openButton.className = "connection-open";
      openButton.type = "button";
      openButton.addEventListener("click", () => selectThought(thought.id));

      const dot = document.createElement("span");
      dot.className = "thought-dot";
      dot.style.background = getKindColor(thought.kind);
      const name = document.createElement("span");
      name.className = "thought-name";
      name.textContent = thought.title;
      const roleBadge = document.createElement("span");
      roleBadge.className = "relation-badge";
      roleBadge.textContent = getConnectionRoleLabel(role);
      openButton.append(dot, name, roleBadge);

      const unlinkButton = document.createElement("button");
      unlinkButton.className = "connection-unlink";
      unlinkButton.type = "button";
      unlinkButton.textContent = "Remove";
      unlinkButton.title = `Remove the connection between ${selected.title} and ${thought.title}`;
      unlinkButton.addEventListener("click", () => removeConnection(linkId));

      item.append(openButton, unlinkButton);
      return item;
    }),
  );
  renderMentionPanels(selected);
}

function renderKindInspector(selected) {
  const options = state.kinds.map((kind) => optionElement(kind.id, kind.name));
  const divider = optionElement("", "──────────");
  divider.disabled = true;
  els.kindInput.replaceChildren(...options, divider, optionElement(NEW_KIND_VALUE, "+ New type"));
  els.kindInput.value = selected.kind;
  const kind = getKindDefinition(selected.kind);
  els.kindColorInput.value = kind.color;
  const isDefault = state.defaultKindId === selected.kind;
  els.kindDefaultButton.classList.toggle("active", isDefault);
  els.kindDefaultButton.disabled = isDefault;
  els.kindDefaultButton.textContent = isDefault ? "Default" : "Set default";
}

function renderKindSettings() {
  els.newKindColorInput.value = getNextKindColor();
  els.kindList.replaceChildren(
    ...state.kinds.map((kind, index) => {
      const row = document.createElement("div");
      row.className = "kind-row";

      const defaultInput = document.createElement("input");
      defaultInput.type = "radio";
      defaultInput.name = "defaultKind";
      defaultInput.checked = kind.id === state.defaultKindId;
      defaultInput.title = `Use ${kind.name} by default`;
      defaultInput.setAttribute("aria-label", `Use ${kind.name} by default`);
      defaultInput.addEventListener("change", () => setDefaultKind(kind.id));

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = kind.color;
      colorInput.title = `${kind.name} colour`;
      colorInput.setAttribute("aria-label", `${kind.name} colour`);
      colorInput.addEventListener("change", () => updateKindColor(kind.id, colorInput.value));

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.maxLength = 32;
      nameInput.value = kind.name;
      nameInput.setAttribute("aria-label", "Type name");
      nameInput.addEventListener("change", () => renameKind(kind.id, nameInput.value));

      const upButton = document.createElement("button");
      upButton.type = "button";
      upButton.textContent = "Up";
      upButton.title = `Move ${kind.name} up`;
      upButton.disabled = index === 0;
      upButton.addEventListener("click", () => moveKind(kind.id, -1));

      const downButton = document.createElement("button");
      downButton.type = "button";
      downButton.textContent = "Down";
      downButton.title = `Move ${kind.name} down`;
      downButton.disabled = index === state.kinds.length - 1;
      downButton.addEventListener("click", () => moveKind(kind.id, 1));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "kind-delete-button";
      deleteButton.textContent = "Delete";
      deleteButton.title = `Delete ${kind.name}`;
      deleteButton.disabled = state.kinds.length <= 1;
      deleteButton.addEventListener("click", () => deleteKind(kind.id));

      row.append(defaultInput, colorInput, nameInput, upButton, downButton, deleteButton);
      return row;
    }),
  );
}

function renderGraph() {
  renderGraphView({
    state,
    els,
    graphRect,
    graphEffects,
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
  });
}
function getNodeBox(id) {
  return calculateNodeBox({
    id,
    selectedId: state.selectedId,
    thought: getThought(id),
    isConnected: Boolean(state.selectedId && getConnectedThoughts(state.selectedId).some((thought) => thought.id === id)),
    mobile: isMobileLayout(),
    isInboxThought,
    getKindName,
  });
}

function getGraphRenderNodeBox(id) {
  return graphEffects.dimThoughts.get(id)?.box || getNodeBox(id);
}

function addThought(title: string, anchorId = state.selectedId, relation: LinkRelation = "parent-of", options: AddThoughtOptions = {}) {
  pushHistory();
  const selected = getThought(anchorId);
  const connectedCount = selected ? getConnectedThoughts(selected.id).length : 0;
  const angle = selected ? connectedCount * 0.72 - 0.4 : 0;
  const inboxIndex = getInboxThoughts().length;
  const thought = {
    id: makeId("t"),
    title,
    kind: getDefaultKindId(),
    note: "",
    tags: [],
    x: selected ? selected.x + Math.cos(angle) * 150 : (inboxIndex % 4) * 170 - 255,
    y: selected ? selected.y + (relation === "child-of" ? -220 : 220) : Math.floor(inboxIndex / 4) * 120 + 260,
  };

  thought.note = String(options.note || "").trim();
  state.thoughts.push(thought);
  if (selected) {
    if (relation === "related") {
      state.links.push({ id: makeId("l"), from: selected.id, to: thought.id, type: "related" });
    } else {
      const from = relation === "child-of" ? thought.id : selected.id;
      const to = relation === "child-of" ? selected.id : thought.id;
      state.links.push({ id: makeId("l"), from, to, type: "parent" });
    }
  }
  if (options.select === false) {
    renderThoughtList();
    renderDetails();
    renderGraph();
    persistState();
    return thought;
  }

  selectThought(thought.id, { center: options.center });
  return thought;
}

function addLink(activeId: string | null, targetId: string | null, relation: LinkRelation = "parent-of") {
  if (!activeId || !targetId || activeId === targetId) return;
  const isRelated = relation === "related";
  const from = isRelated || relation !== "child-of" ? activeId : targetId;
  const to = isRelated || relation !== "child-of" ? targetId : activeId;
  const fromPositions = getVisualPositions();
  const existing = state.links.find((link) => {
    if (isRelated) return link.type === "related" && ((link.from === from && link.to === to) || (link.from === to && link.to === from));
    return link.type !== "related" && link.from === from && link.to === to;
  });
  const reverse = isRelated ? null : state.links.find((link) => link.type !== "related" && link.from === to && link.to === from);
  if (existing) return;
  pushHistory();
  let changedLink;
  if (reverse) {
    reverse.from = from;
    reverse.to = to;
    reverse.type = isRelated ? "related" : "parent";
    changedLink = reverse;
  } else {
    changedLink = { id: makeId("l"), from, to, type: isRelated ? "related" : "parent" };
    state.links.push(changedLink);
  }
  renderThoughtList();
  renderDetails();
  const toPositions = computeFocusPositions(state.selectedId);
  runGraphTransition({
    fromPositions,
    toPositions,
    toView: getFocusView(state.selectedId, toPositions),
    appearingLinkIds: [changedLink.id],
    save: true,
  });
}

function removeConnection(linkId) {
  const link = state.links.find((item) => item.id === linkId);
  if (!link) return;
  const fromPositions = getVisualPositions();
  const leavingLink = clone(link);
  const disconnectedId = link.from === state.selectedId ? link.to : link.from;
  pushHistory();
  state.links = state.links.filter((item) => item.id !== linkId);
  if (selectedLinkId === linkId) selectedLinkId = null;
  if (contextLinkId === linkId) contextLinkId = null;
  renderThoughtList();
  renderDetails();
  const toPositions = computeFocusPositions(state.selectedId);
  const dimThoughtIds = [disconnectedId];
  if (state.selectedId && isInboxThought(state.selectedId)) dimThoughtIds.push(state.selectedId);
  runGraphTransition({
    fromPositions,
    toPositions,
    toView: getFocusView(state.selectedId, toPositions),
    leavingLinks: [leavingLink],
    dimThoughtIds,
    save: true,
  });
}

function getDeleteFocusTargetId(deletedId) {
  const parent = getParentThoughts(deletedId)[0];
  if (parent) return parent.id;
  const connected = getConnections(deletedId).find((connection) => connection.thought.id !== deletedId);
  if (connected) return connected.thought.id;
  return state.thoughts.find((thought) => thought.id !== deletedId)?.id || null;
}

function deleteSelectedThought() {
  const selected = getSelectedThought();
  if (!selected) return;
  const approved = window.confirm(`Delete "${selected.title}"?`);
  if (!approved) return;
  const fromPositions = getVisualPositions();
  const deletedThought = clone(selected);
  const deletedPosition = fromPositions.get(selected.id) || selected;
  const deletedBox = getNodeBox(selected.id);
  const leavingLinks = state.links.filter((link) => link.from === selected.id || link.to === selected.id);
  const nextSelectedId = getDeleteFocusTargetId(selected.id);
  pushHistory();
  state.thoughts = state.thoughts.filter((thought) => thought.id !== selected.id);
  state.links = state.links.filter((link) => link.from !== selected.id && link.to !== selected.id);
  state.selectedId = nextSelectedId;
  selectedLinkId = null;
  contextLinkId = null;
  hoverThoughtId = null;
  renderThoughtList();
  renderDetails();
  renderKindSettings();
  renderInboxReview();
  const toPositions = computeFocusPositions(state.selectedId);
  runGraphTransition({
    fromPositions,
    toPositions,
    toView: getFocusView(state.selectedId, toPositions),
    leavingLinks,
    dimThoughts: [{ thought: deletedThought, position: deletedPosition, box: deletedBox, mode: "deleting" }],
    save: true,
  });
}

function selectThought(id: string | null, options: SelectThoughtOptions = {}) {
  clearPendingGraphTransition();
  selectedLinkId = null;
  if (id && isInboxThought(id)) {
    state.selectedId = id;
    openMobileDetails();
    renderThoughtList();
    renderDetails();
    renderGraph();
    persistState();
    return;
  }

  const fromPositions = getVisualPositions();
  state.selectedId = id;
  openMobileDetails();
  if (options.center !== false) {
    const toPositions = computeFocusPositions(id);
    renderThoughtList();
    renderDetails();
    animateFocus({
      fromPositions,
      toPositions,
      toView: getFocusView(id, toPositions),
      save: true,
    });
  } else {
    focusPositions = computeFocusPositions(id);
    stopFocusAnimation();
    render();
    persistState();
  }
}

function centerSelected(options: CenterOptions = {}) {
  const toPositions = computeFocusPositions(state.selectedId);
  const toView = getFocusView(state.selectedId, toPositions);
  if (!toView) return;
  animateCamera({
    fromPositions: getVisualPositions(),
    toPositions,
    toView,
    save: options.save !== false,
  });
}

function getCenteredView(id) {
  const selected = getThought(id);
  if (!selected) return null;
  return {
    x: -selected.x * state.view.scale,
    y: -selected.y * state.view.scale,
    scale: state.view.scale,
  };
}

function getFocusView(id, positions = computeFocusPositions(id)) {
  const selected = getThought(id);
  if (!selected) return null;
  const focusIds = getFocusFamilyIds(id);
  const paddingX = 180;
  const paddingY = 145;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  focusIds.forEach((thoughtId) => {
    const thought = getThought(thoughtId);
    const position = positions.get(thoughtId) || thought;
    if (!thought || !position) return;
    const box = getNodeBox(thoughtId);
    minX = Math.min(minX, position.x - box.width / 2);
    maxX = Math.max(maxX, position.x + box.width / 2);
    minY = Math.min(minY, position.y - box.height / 2);
    maxY = Math.max(maxY, position.y + box.height / 2);
  });

  if (!Number.isFinite(minX)) return getCenteredView(id);

  minX -= paddingX;
  maxX += paddingX;
  minY -= paddingY;
  maxY += paddingY;
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const scale = clamp(Math.min(graphRect.width / width, graphRect.height / height), 0.5, 1.35);
  return {
    scale,
    x: -((minX + maxX) / 2) * scale,
    y: -((minY + maxY) / 2) * scale,
  };
}

function runGraphTransition({
  fromPositions,
  toPositions,
  toView,
  appearingLinkIds = [],
  leavingLinks = [],
  dimThoughtIds = [],
  dimThoughts = [],
  delay = LINK_DRAW_DURATION,
  save = true,
}: GraphTransitionOptions) {
  clearPendingGraphTransition();
  stopFocusAnimation();
  graphEffects.appearingLinkIds = new Set(appearingLinkIds);
  graphEffects.leavingLinks = leavingLinks.map((link) => ({
    id: makeId("fx"),
    link: clone(link),
  }));
  graphEffects.dimThoughts = new Map();
  dimThoughts.forEach((effect) => {
    if (!effect?.thought?.id) return;
    const position = effect.position || fromPositions.get(effect.thought.id) || effect.thought;
    graphEffects.dimThoughts.set(effect.thought.id, {
      thought: clone(effect.thought),
      position: { x: position.x, y: position.y },
      box: effect.box ? { ...effect.box } : null,
      mode: effect.mode || "dim",
    });
  });
  dimThoughtIds.forEach((id) => {
    const thought = getThought(id);
    if (!thought) return;
    const position = fromPositions.get(id) || thought;
    graphEffects.dimThoughts.set(id, {
      thought: clone(thought),
      position: { x: position.x, y: position.y },
      box: null,
      mode: "dim",
    });
  });
  focusPositions = fromPositions;
  renderGraph();
  pendingGraphTransition = window.setTimeout(() => {
    pendingGraphTransition = null;
    clearGraphEffects();
    animateFocus({
      fromPositions,
      toPositions,
      toView: toView || state.view,
      save,
    });
  }, delay);
}

function clearPendingGraphTransition() {
  if (pendingGraphTransition) {
    window.clearTimeout(pendingGraphTransition);
    pendingGraphTransition = null;
  }
  clearGraphEffects();
}

function clearGraphEffects() {
  graphEffects.appearingLinkIds.clear();
  graphEffects.leavingLinks = [];
  graphEffects.dimThoughts.clear();
}

function animateFocus({
  fromPositions,
  toPositions,
  toView,
  save = true,
}: {
  fromPositions: PositionMap;
  toPositions: PositionMap;
  toView: ViewState;
  save?: boolean;
}) {
  animateCamera({ fromPositions, toPositions, toView, save });
}

function animateCamera({
  fromPositions = getVisualPositions(),
  toPositions = getVisualPositions(),
  toView,
  save = true,
}: {
  fromPositions?: PositionMap;
  toPositions?: PositionMap;
  toView: ViewState;
  save?: boolean;
}) {
  clearPendingGraphTransition();
  stopFocusAnimation();
  const fromView = { ...state.view };
  const start = performance.now();
  const duration = 560;

  focusAnimation = requestAnimationFrame(function tick(now) {
    const progress = clamp((now - start) / duration, 0, 1);
    const eased = easeOutCubic(progress);
    focusPositions = interpolatePositions(state.thoughts, fromPositions, toPositions, eased);
    state.view = {
      x: interpolate(fromView.x, toView.x, eased),
      y: interpolate(fromView.y, toView.y, eased),
      scale: interpolate(fromView.scale, toView.scale, eased),
    };
    renderGraph();

    if (progress < 1) {
      focusAnimation = requestAnimationFrame(tick);
    } else {
      focusAnimation = null;
      focusPositions = toPositions;
      state.view = toView;
      renderGraph();
      if (save) persistState();
    }
  });
}

function stopFocusAnimation() {
  if (focusAnimation) {
    cancelAnimationFrame(focusAnimation);
    focusAnimation = null;
  }
}

function computeFocusPositions(selectedId = state.selectedId) {
  const positions = new Map(state.thoughts.map((thought) => [thought.id, { x: thought.x, y: thought.y }]));
  const selected = getThought(selectedId);
  if (!selected) return positions;

  const parents = getParentThoughts(selectedId);
  const children = getChildThoughts(selectedId);
  const related = getRelatedThoughts(selectedId);
  const directIds = new Set([selectedId, ...parents.map((thought) => thought.id), ...children.map((thought) => thought.id), ...related.map((thought) => thought.id)]);
  const siblings = isCalmMode()
    ? []
    : getSiblingThoughts(selectedId).filter((thought) => !directIds.has(thought.id));
  const secondAncestors = getAncestorEntries(selectedId, 2)
    .filter((entry) => entry.depth > 1 && !directIds.has(entry.thought.id))
    .map((entry) => entry.thought);
  const secondDescendants = getDescendantEntries(selectedId, 2)
    .filter((entry) => entry.depth > 1 && !directIds.has(entry.thought.id))
    .map((entry) => entry.thought);
  const parentRelated = getParentRelatedContextEntries(selectedId, directIds);
  const selectedBox = getNodeBox(selected.id);
  const verticalGap = isMobileLayout() ? 170 : 210;
  const sideGap = isMobileLayout() ? 74 : 94;
  const secondaryGap = isMobileLayout() ? 138 : 168;
  const rowGap = isMobileLayout() ? 24 : 34;
  positions.set(selected.id, { x: selected.x, y: selected.y });

  arrangeHorizontalThoughtRow(positions, parents, selected.x, selected.y - verticalGap, getNodeBox, { gap: rowGap });
  arrangeVerticalThoughtColumn(positions, related, selected.x - selectedBox.width / 2 - sideGap, selected.y, getNodeBox, {
    gap: rowGap,
    side: "left",
  });
  arrangeVerticalThoughtColumn(positions, siblings, selected.x + selectedBox.width / 2 + sideGap, selected.y, getNodeBox, {
    gap: rowGap,
    side: "right",
  });
  arrangeHorizontalThoughtRow(positions, children, selected.x, selected.y + verticalGap, getNodeBox, { gap: rowGap });

  if (!isCalmMode()) {
    arrangeParentRelatedContext(positions, parentRelated, {
      gap: rowGap,
      sideGap: Math.max(44, sideGap * 0.72),
    });
    arrangeHorizontalThoughtRow(positions, uniqueThoughts(secondAncestors), selected.x, selected.y - verticalGap - secondaryGap, getNodeBox, {
      gap: rowGap,
    });
    arrangeHorizontalThoughtRow(positions, uniqueThoughts(secondDescendants), selected.x, selected.y + verticalGap + secondaryGap, getNodeBox, {
      gap: rowGap,
    });
  }

  if (!parents.length && !children.length && !siblings.length && !related.length) {
    positions.set(selected.id, { x: selected.x, y: selected.y });
  }
  return positions;
}

function arrangeParentRelatedContext(positions: PositionMap, entries: { parentId: string; thought: Thought }[], options: ParentRelatedOptions = {}) {
  if (!entries.length) return;
  const byParent = new Map();
  entries.forEach((entry) => {
    if (!byParent.has(entry.parentId)) byParent.set(entry.parentId, []);
    byParent.get(entry.parentId).push(entry.thought);
  });

  byParent.forEach((thoughts, parentId) => {
    const parent = getThought(parentId);
    const parentPosition = positions.get(parentId) || parent;
    if (!parent || !parentPosition) return;
    const parentBox = getNodeBox(parentId);
    arrangeVerticalThoughtColumn(positions, uniqueThoughts(thoughts), parentPosition.x - parentBox.width / 2 - (options.sideGap ?? 68), parentPosition.y, getNodeBox, {
      gap: options.gap ?? 34,
      side: "left",
    });
  });
}

function getVisualPositions() {
  return focusPositions || computeFocusPositions(state.selectedId);
}

function getLinkDirectionText(link) {
  return link.type === "related" ? "connects with" : "sits above";
}

function getConnectionRoleLabel(role) {
  if (role === "related") return "Beside";
  return role === "parent" ? "Above" : "Below";
}

function getParentThoughts(id) {
  return state.links
    .filter((link) => link.type !== "related" && link.to === id)
    .map((link) => getThought(link.from))
    .filter(Boolean);
}

function getChildThoughts(id) {
  return state.links
    .filter((link) => link.type !== "related" && link.from === id)
    .map((link) => getThought(link.to))
    .filter(Boolean);
}

function getRelatedThoughts(id) {
  return state.links
    .filter((link) => link.type === "related" && (link.from === id || link.to === id))
    .map((link) => getThought(link.from === id ? link.to : link.from))
    .filter(Boolean);
}

function getAncestorEntries(id, maxDepth = 2) {
  const entries = [];
  const visited = new Set([id]);
  let frontier = [{ id, depth: 0 }];

  while (frontier.length) {
    const next = [];
    frontier.forEach((item) => {
      if (item.depth >= maxDepth) return;
      state.links
        .filter((link) => link.type !== "related" && link.to === item.id)
        .forEach((link) => {
          const thought = getThought(link.from);
          if (!thought || visited.has(thought.id)) return;
          visited.add(thought.id);
          entries.push({ thought, depth: item.depth + 1, childId: item.id });
          next.push({ id: thought.id, depth: item.depth + 1 });
        });
    });
    frontier = next;
  }

  return entries;
}

function getDescendantEntries(id, maxDepth = 3) {
  const entries = [];
  const visited = new Set([id]);
  let frontier = [{ id, depth: 0 }];

  while (frontier.length) {
    const next = [];
    frontier.forEach((item) => {
      if (item.depth >= maxDepth) return;
      state.links
        .filter((link) => link.type !== "related" && link.from === item.id)
        .forEach((link) => {
          const thought = getThought(link.to);
          if (!thought || visited.has(thought.id)) return;
          visited.add(thought.id);
          entries.push({ thought, depth: item.depth + 1, parentId: item.id });
          next.push({ id: thought.id, depth: item.depth + 1 });
        });
    });
    frontier = next;
  }

  return entries;
}

function getSiblingThoughts(id) {
  const siblingIds = new Set();
  getParentThoughts(id).forEach((parent) => {
    getChildThoughts(parent.id).forEach((child) => {
      if (child.id !== id) siblingIds.add(child.id);
    });
  });
  return [...siblingIds].map(getThought).filter(Boolean);
}

function getParentRelatedContextEntries(id, directIds = new Set(getDirectFocusFamilyIds(id))) {
  const entries = [];
  const seen = new Set();
  getParentThoughts(id).forEach((parent) => {
    getRelatedThoughts(parent.id).forEach((thought) => {
      if (!thought || directIds.has(thought.id) || seen.has(thought.id)) return;
      seen.add(thought.id);
      entries.push({ parentId: parent.id, thought });
    });
  });
  return entries;
}

function getFocusFamilyIds(id) {
  if (!id) return [];
  return uniqueThoughts([
    ...getDirectFocusThoughts(id),
    ...(isCalmMode() ? [] : getSecondaryFocusThoughts(id)),
  ])
    .filter(Boolean)
    .map((thought) => thought.id);
}

function getDirectFocusFamilyIds(id) {
  if (!id) return [];
  return getDirectFocusThoughts(id).map((thought) => thought.id);
}

function getSecondaryFocusFamilyIds(id) {
  if (!id) return [];
  return getSecondaryFocusThoughts(id).map((thought) => thought.id);
}

function getDirectFocusThoughts(id) {
  return uniqueThoughts([
    getThought(id),
    ...getParentThoughts(id),
    ...getChildThoughts(id),
    ...getRelatedThoughts(id),
    ...(isCalmMode() ? [] : getSiblingThoughts(id)),
  ])
    .filter(Boolean);
}

function getSecondaryFocusThoughts(id) {
  const directIds = new Set(getDirectFocusFamilyIds(id));
  return uniqueThoughts([
    ...getAncestorEntries(id, 2)
      .filter((entry) => entry.depth > 1)
      .map((entry) => entry.thought),
    ...getDescendantEntries(id, 2)
      .filter((entry) => entry.depth > 1)
      .map((entry) => entry.thought),
    ...getParentRelatedContextEntries(id, directIds).map((entry) => entry.thought),
  ]).filter((thought) => thought && !directIds.has(thought.id));
}

function getPreviewFamilyIds(id) {
  if (!id) return [];
  return uniqueThoughts([getThought(id), ...getParentThoughts(id), ...getChildThoughts(id), ...getRelatedThoughts(id)])
    .filter(Boolean)
    .map((thought) => thought.id);
}

function uniqueThoughts(thoughts) {
  const seen = new Set();
  return thoughts.filter((thought) => {
    if (!thought || seen.has(thought.id)) return false;
    seen.add(thought.id);
    return true;
  });
}

function isCalmMode() {
  return Boolean(state.settings.calmMode);
}

function getConnections(id) {
  if (!id) return [];
  return state.links
    .filter((link) => link.from === id || link.to === id)
    .map((link) => {
      if (link.type === "related") {
        return {
          linkId: link.id,
          linkName: link.name || "",
          thought: getThought(link.from === id ? link.to : link.from),
          role: "related",
        };
      }
      const isParent = link.to === id;
      return {
        linkId: link.id,
        linkName: link.name || "",
        thought: getThought(isParent ? link.from : link.to),
        role: isParent ? "parent" : "child",
      };
    })
    .filter((connection) => connection.thought);
}

function getConnectedThoughts(id) {
  return getConnections(id).map((connection) => connection.thought);
}

function getGraphThoughts() {
  return state.thoughts.filter((thought) => !isInboxThought(thought.id));
}

function getGraphRenderThought(id) {
  return getThought(id) || graphEffects.dimThoughts.get(id)?.thought || null;
}

function getGraphRenderThoughts() {
  const byId = new Map(getGraphThoughts().map((thought) => [thought.id, thought]));
  graphEffects.dimThoughts.forEach((effect, id) => {
    if (!byId.has(id)) byId.set(id, effect.thought);
  });
  return [...byId.values()];
}

function getGraphFocusId() {
  return state.selectedId && !isInboxThought(state.selectedId) ? state.selectedId : null;
}

function getInboxThoughts() {
  return state.thoughts.filter((thought) => isInboxThought(thought.id));
}

function isInboxThought(id) {
  return !state.links.some((link) => link.from === id || link.to === id);
}

function getKindDefinition(id) {
  return state.kinds.find((kind) => kind.id === id) || state.kinds[0] || defaultKindDefinitions[0];
}

function getKindName(id) {
  return getKindDefinition(id).name;
}

function getKindColor(id) {
  return getKindDefinition(id).color;
}

function getDefaultKindId() {
  return state.kinds.some((kind) => kind.id === state.defaultKindId) ? state.defaultKindId : state.kinds[0]?.id || DEFAULT_KIND_ID;
}

function createKindFromPrompt(options: CreateKindOptions = {}) {
  const name = window.prompt("New type name", "Thought");
  if (!name) {
    const selected = getSelectedThought();
    if (selected) renderKindInspector(selected);
    return null;
  }
  const kindCount = state.kinds.length;
  const kind = addKind(name, els.kindColorInput?.value || getNextKindColor(), { select: false });
  if (!kind) return null;
  if (options.assignToThoughtId) {
    const thought = getThought(options.assignToThoughtId);
    if (thought && thought.kind !== kind.id) {
      if (state.kinds.length === kindCount) pushHistory();
      thought.kind = kind.id;
    }
  }
  render();
  persistState();
  return kind;
}

function addKindFromSettings() {
  const kind = addKind(els.newKindNameInput.value, els.newKindColorInput.value);
  if (!kind) return;
  els.newKindNameInput.value = "";
  render();
  persistState();
}

function addKind(name: string, color: string, options: AddKindOptions = {}) {
  const normalizedName = normalizeKindName(name);
  if (!normalizedName) return null;
  const existing = state.kinds.find((kind) => kind.name.toLowerCase() === normalizedName.toLowerCase());
  if (existing) return existing;
  pushHistory();
  const kind = {
    id: getUniqueKindId(normalizedName),
    name: normalizedName,
    color: sanitizeKindColor(color, getNextKindColor()),
  };
  state.kinds.push(kind);
  if (options.makeDefault) state.defaultKindId = kind.id;
  return kind;
}

function renameKind(id, name) {
  const kind = getKindDefinition(id);
  const normalizedName = normalizeKindName(name);
  if (!kind || !normalizedName || kind.name === normalizedName) {
    renderKindSettings();
    return;
  }
  if (state.kinds.some((item) => item.id !== id && item.name.toLowerCase() === normalizedName.toLowerCase())) {
    window.alert("That kind already exists.");
    renderKindSettings();
    return;
  }
  pushHistory();
  kind.name = normalizedName;
  render();
  persistState();
}

function updateKindColor(id, color) {
  const kind = getKindDefinition(id);
  const nextColor = sanitizeKindColor(color, kind?.color);
  if (!kind || kind.color === nextColor) return;
  pushHistory();
  kind.color = nextColor;
  render();
  persistState();
}

function setDefaultKind(id) {
  if (!state.kinds.some((kind) => kind.id === id) || state.defaultKindId === id) return;
  pushHistory();
  state.defaultKindId = id;
  render();
  persistState();
}

function moveKind(id, direction) {
  const index = state.kinds.findIndex((kind) => kind.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= state.kinds.length) return;
  pushHistory();
  const [kind] = state.kinds.splice(index, 1);
  state.kinds.splice(nextIndex, 0, kind);
  render();
  persistState();
}

function deleteKind(id) {
  if (state.kinds.length <= 1) return;
  const kind = getKindDefinition(id);
  if (!kind) return;
  const affectedCount = state.thoughts.filter((thought) => thought.kind === id).length;
  if (affectedCount) {
    const approved = window.confirm(`Delete "${kind.name}" and move ${affectedCount} thought${affectedCount === 1 ? "" : "s"} to another kind?`);
    if (!approved) return;
  }
  pushHistory();
  const fallback = state.kinds.find((item) => item.id !== id && item.id === state.defaultKindId)
    || state.kinds.find((item) => item.id !== id)
    || defaultKindDefinitions[0];
  state.kinds = state.kinds.filter((item) => item.id !== id);
  state.defaultKindId = state.defaultKindId === id ? fallback.id : state.defaultKindId;
  state.thoughts.forEach((thought) => {
    if (thought.kind === id) thought.kind = fallback.id;
  });
  render();
  persistState();
}

function getAllTags() {
  return [...new Set(state.thoughts.flatMap((thought) => thought.tags || []))].sort((a, b) => a.localeCompare(b));
}

function normalizeKindName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function sanitizeKindId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function getUniqueKindId(name) {
  const base = sanitizeKindId(name) || `kind-${state.kinds.length + 1}`;
  let id = base;
  let suffix = 2;
  while (state.kinds.some((kind) => kind.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function sanitizeKindColor(color, fallback = defaultKindDefinitions[0].color) {
  return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? String(color).toLowerCase() : fallback;
}

function getNextKindColor() {
  return kindColourPalette[state.kinds.length % kindColourPalette.length];
}

function colorWithAlpha(color, alpha) {
  const safe = sanitizeKindColor(color);
  const value = Number.parseInt(safe.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value.join(",") : String(value || "");
  return [...new Set(
    source
      .split(/[,#]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .map((tag) => tag.replace(/\s+/g, "-").slice(0, 32)),
  )].slice(0, 12);
}

function optionElement(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function resolveLinkTarget(value: string, candidates = state.thoughts.filter((thought) => thought.id !== state.selectedId)): Thought | null {
  const query = value.trim().toLowerCase();
  if (!query) return null;
  return candidates.find((thought) => thought.id === value || thought.title.toLowerCase() === query) || null;
}

function renderRelationshipPreviews() {
  renderLinkPreview();
  renderPlacePreview();
  renderInboxReviewPreview();
}

function renderLinkPreview() {
  const selected = getSelectedThought();
  const target = resolveLinkTarget(els.linkTargetInput.value);
  const selectedName = selected ? trimLabel(selected.title, 28) : "selected thought";
  setRelationOptionText(els.linkRelationInput, {
    "parent-of": "Add below",
    "child-of": "Place above",
    related: "Connect beside",
  });
  els.linkSubmitButton.disabled = !selected || !target;
  els.linkPreviewText.textContent = selected && target
    ? describeTargetRelation(selected, target, els.linkRelationInput.value as LinkRelation)
    : selected
      ? `Search for a thought to connect with ${selectedName}.`
      : "Search for a thought to connect.";
}

function renderPlacePreview() {
  const selected = getSelectedThought();
  const target = getThought(els.placeTargetInput.value);
  const targetName = target ? trimLabel(target.title, 28) : "selected thought";
  setRelationOptionText(els.placeRelationInput, {
    "child-of": `Place below ${targetName}`,
    "parent-of": `Place above ${targetName}`,
    related: `Connect beside ${targetName}`,
  });
  els.placePreviewText.textContent = selected && target
    ? describeActiveRelation(selected, target, els.placeRelationInput.value as LinkRelation)
    : "Choose where this thought belongs.";
}

function renderInboxReviewPreview() {
  const current = getCurrentInboxReviewThought();
  const target = getThought(els.inboxReviewTargetInput.value);
  const targetName = target ? trimLabel(target.title, 22) : "selected thought";
  els.inboxReviewChildButton.textContent = `Place below ${targetName}`;
  els.inboxReviewParentButton.textContent = `Place above ${targetName}`;
  els.inboxReviewRelatedButton.textContent = `Connect beside ${targetName}`;
  els.inboxReviewChildButton.title = current && target ? describeActiveRelation(current, target, "child-of") : "";
  els.inboxReviewParentButton.title = current && target ? describeActiveRelation(current, target, "parent-of") : "";
  els.inboxReviewRelatedButton.title = current && target ? describeActiveRelation(current, target, "related") : "";
  els.inboxReviewPreview.textContent = current && target
    ? `${current.title} will be placed with ${target.title}.`
    : "Choose a thought to connect.";
}

function setRelationOptionText(select: HTMLSelectElement, labels: Partial<Record<LinkRelation, string>>) {
  Array.from(select.options).forEach((option) => {
    const label = labels[option.value as LinkRelation];
    if (label) option.textContent = label;
  });
}

function describeTargetRelation(active: Thought, target: Thought, relation: LinkRelation) {
  if (relation === "child-of") return `${target.title} will sit above ${active.title}.`;
  if (relation === "related") return `${target.title} will connect beside ${active.title}.`;
  return `${target.title} will sit below ${active.title}.`;
}

function describeActiveRelation(active: Thought, target: Thought, relation: LinkRelation) {
  if (relation === "child-of") return `${active.title} will sit below ${target.title}.`;
  if (relation === "related") return `${active.title} will connect beside ${target.title}.`;
  return `${active.title} will sit above ${target.title}.`;
}

function openInboxReview() {
  inboxReviewOpen = true;
  inboxReviewIndex = clamp(inboxReviewIndex, 0, Math.max(getInboxThoughts().length - 1, 0));
  renderInboxReview();
}

function closeInboxReview() {
  if (!inboxReviewOpen) return;
  inboxReviewOpen = false;
  renderInboxReview();
}

function getCurrentInboxReviewThought() {
  const inboxThoughts = getInboxThoughts();
  if (!inboxThoughts.length) return null;
  inboxReviewIndex = clamp(inboxReviewIndex, 0, inboxThoughts.length - 1);
  return inboxThoughts[inboxReviewIndex];
}

function renderInboxReview() {
  els.inboxReviewPanel.hidden = !inboxReviewOpen;
  if (!inboxReviewOpen) return;

  const inboxThoughts = getInboxThoughts();
  const current = getCurrentInboxReviewThought();
  const candidates = state.thoughts.filter((thought) => thought.id !== current?.id);
  const targetId = els.inboxReviewTargetInput.value;
  els.inboxReviewProgress.textContent = inboxThoughts.length
    ? `${inboxReviewIndex + 1} of ${inboxThoughts.length} unplaced thoughts`
    : "No unplaced thoughts.";
  els.inboxReviewTitle.textContent = current?.title || "Inbox clear";
  els.inboxReviewNote.textContent = current?.note?.trim() || "Captured thoughts will appear here until you connect them.";
  els.inboxReviewTargetInput.replaceChildren(
    ...candidates.map((thought) => optionElement(thought.id, thought.title)),
  );
  if (candidates.some((thought) => thought.id === targetId)) els.inboxReviewTargetInput.value = targetId;
  const disabled = !current || !candidates.length;
  [els.inboxReviewTargetInput, els.inboxReviewChildButton, els.inboxReviewParentButton, els.inboxReviewRelatedButton].forEach((element) => {
    element.disabled = disabled;
  });
  els.inboxReviewPrevButton.disabled = inboxThoughts.length < 2;
  els.inboxReviewNextButton.disabled = inboxThoughts.length < 2;
  els.inboxReviewKeepButton.disabled = !current;
  renderInboxReviewPreview();
}

function previousInboxReviewThought() {
  moveInboxReviewThought(-1);
}

function nextInboxReviewThought() {
  moveInboxReviewThought(1);
}

function moveInboxReviewThought(direction: number) {
  const inboxThoughts = getInboxThoughts();
  if (inboxThoughts.length < 2) return;
  inboxReviewIndex = (inboxReviewIndex + direction + inboxThoughts.length) % inboxThoughts.length;
  renderInboxReview();
}

function placeInboxReviewThought(relation) {
  const current = getCurrentInboxReviewThought();
  const targetId = els.inboxReviewTargetInput.value;
  if (!current || !targetId) return;
  selectThought(current.id, { center: false });
  addLink(current.id, targetId, relation);
  inboxReviewIndex = Math.min(inboxReviewIndex, Math.max(getInboxThoughts().length - 1, 0));
  renderInboxReview();
  setStatus("Thought placed");
}

function keepInboxReviewThought() {
  const inboxThoughts = getInboxThoughts();
  if (!inboxThoughts.length) return;
  inboxReviewIndex = (inboxReviewIndex + 1) % inboxThoughts.length;
  renderInboxReview();
}

function focusQuickCapture() {
  if (isMobileLayout()) {
    openMobileCapture();
    return;
  }
  if (sidebarHidden) {
    sidebarHidden = false;
    renderPanelState();
    measureGraph();
    renderGraph();
  }
  els.quickCaptureInput.focus();
  els.quickCaptureInput.select();
}

function focusSearch() {
  if (isMobileLayout()) {
    openMobileLibrary({ focusSearch: true });
    return;
  }
  if (sidebarHidden) {
    sidebarHidden = false;
    renderPanelState();
    measureGraph();
    renderGraph();
  }
  els.searchInput.focus();
  els.searchInput.select();
}

function onMobileCaptureSubmit(event) {
  event.preventDefault();
  const title = els.mobileCaptureInput.value.trim();
  if (!title) return;
  addThought(title, null, "parent-of", { select: false });
  els.mobileCaptureInput.value = "";
  closeMobileCapture();
  render();
  setStatus("Captured to inbox");
}

function onQuickCaptureSubmit(event) {
  event.preventDefault();
  const title = els.quickCaptureInput.value.trim();
  if (!title) return;
  addThought(title, null, "parent-of", { select: false });
  els.quickCaptureInput.value = "";
  render();
  setStatus("Captured to inbox");
}

function placeInboxThought() {
  const selected = getSelectedThought();
  if (!selected || !isInboxThought(selected.id)) return;
  const targetId = els.placeTargetInput.value;
  if (!targetId) return;
  addLink(selected.id, targetId, els.placeRelationInput.value as LinkRelation);
  showInboxOnly = false;
  renderThoughtList();
  renderDetails();
  setStatus("Thought placed");
}

function renderMentionPanels(selected) {
  if (!selected) return;
  const backlinks = getBacklinks(selected);
  const mentions = getMentionSuggestions(selected);
  els.backlinkCount.textContent = String(backlinks.length);
  els.mentionCount.textContent = String(mentions.length);
  els.backlinkList.replaceChildren(
    ...backlinks.map((thought) => createThoughtActionItem(thought, "Backlink", () => selectThought(thought.id))),
  );
  els.mentionList.replaceChildren(
    ...mentions.map((thought) => createThoughtActionItem(thought, "Link", () => addLink(selected.id, thought.id, "related"), true)),
  );
}

function createThoughtActionItem(thought, label, action, suggestion = false) {
  const item = document.createElement("button");
  item.className = `connection-item${suggestion ? " suggestion" : ""}`;
  item.type = "button";
  item.addEventListener("click", action);

  const dot = document.createElement("span");
  dot.className = "thought-dot";
  dot.style.background = getKindColor(thought.kind);
  const name = document.createElement("span");
  name.className = "thought-name";
  name.textContent = thought.title;
  const badge = document.createElement("span");
  badge.className = "relation-badge";
  badge.textContent = label;
  item.append(dot, name, badge);
  return item;
}

function getBacklinks(selected) {
  const needle = selected.title.toLowerCase();
  return state.thoughts
    .filter((thought) => thought.id !== selected.id)
    .filter((thought) => getMentionTitles(thought.note).some((title) => title.toLowerCase() === needle))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function getMentionSuggestions(selected) {
  const titles = getMentionTitles(selected.note);
  return uniqueThoughts(
    titles
      .map((title) => getThoughtByTitle(title))
      .filter((thought) => thought && thought.id !== selected.id && !hasLinkBetween(selected.id, thought.id)),
  ).sort((a, b) => a.title.localeCompare(b.title));
}

function getMentionTitles(text) {
  return [...String(text || "").matchAll(/\[\[([^\]]{1,80})\]\]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function getThoughtByTitle(title) {
  const normalized = String(title || "").trim().toLowerCase();
  return state.thoughts.find((thought) => thought.title.toLowerCase() === normalized);
}

function hasLinkBetween(a, b) {
  return state.links.some((link) => (link.from === a && link.to === b) || (link.from === b && link.to === a));
}

function pushHistory() {
  const snapshot = JSON.stringify(state);
  if (undoStack[undoStack.length - 1] === snapshot) return;
  undoStack.push(snapshot);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  renderHistoryControls();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = sanitizeState(JSON.parse(undoStack.pop()));
  focusPositions = null;
  render();
  persistState();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = sanitizeState(JSON.parse(redoStack.pop()));
  focusPositions = null;
  render();
  persistState();
}

function renderHistoryControls() {
  els.undoButton.disabled = !undoStack.length;
  els.redoButton.disabled = !redoStack.length;
}

function isTextEditing(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
}

function fitToGraph() {
  const toView = getFitView();
  if (!toView) return;
  animateCamera({
    fromPositions: getVisualPositions(),
    toPositions: computeFocusPositions(state.selectedId),
    toView,
    save: true,
  });
}

function getFitView() {
  const graphThoughts = getGraphThoughts();
  if (!graphThoughts.length) return null;
  const padding = 115;
  const xs = graphThoughts.map((thought) => thought.x);
  const ys = graphThoughts.map((thought) => thought.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = clamp(Math.min(graphRect.width / width, graphRect.height / height), 0.5, 1.7);
  return {
    scale,
    x: -((minX + maxX) / 2) * scale,
    y: -((minY + maxY) / 2) * scale,
  };
}

function resetView() {
  animateCamera({
    fromPositions: getVisualPositions(),
    toPositions: computeFocusPositions(state.selectedId),
    toView: { x: 0, y: 0, scale: 1 },
    save: true,
  });
}

function openSettings() {
  closeMobilePanels();
  closeMobileCapture();
  els.settingsPage.hidden = false;
}

function closeSettings() {
  els.settingsPage.hidden = true;
}

function toggleMoreMenu() {
  moreMenuOpen = !moreMenuOpen;
  renderMoreMenu();
}

function closeMoreMenu() {
  if (!moreMenuOpen) return;
  moreMenuOpen = false;
  renderMoreMenu();
}

function renderMoreMenu() {
  els.moreMenu.hidden = !moreMenuOpen;
  els.moreButton.classList.toggle("active", moreMenuOpen);
}

function toggleSidebar() {
  if (isMobileLayout()) {
    mobileLibraryOpen = !mobileLibraryOpen;
    if (mobileLibraryOpen) {
      mobileDetailsOpen = false;
      closeMobileCapture();
    }
    renderPanelState();
    return;
  }
  sidebarHidden = !sidebarHidden;
  renderPanelState();
  refreshGraphAfterPanelChange();
}

function toggleDetailsPanel() {
  if (isMobileLayout()) {
    mobileDetailsOpen = !mobileDetailsOpen;
    if (mobileDetailsOpen) {
      mobileLibraryOpen = false;
      closeMobileCapture();
    }
    renderPanelState();
    return;
  }
  detailsHidden = !detailsHidden;
  renderPanelState();
  refreshGraphAfterPanelChange();
}

function refreshGraphAfterPanelChange() {
  measureGraph();
  renderGraph();
  window.setTimeout(() => {
    measureGraph();
    renderGraph();
  }, 300);
}

function renderPanelState() {
  const mobile = isMobileLayout();
  els.appShell.classList.toggle("sidebar-hidden", !mobile && sidebarHidden);
  els.appShell.classList.toggle("details-hidden", !mobile && detailsHidden);
  els.appShell.classList.toggle("mobile-library-open", mobile && mobileLibraryOpen);
  els.appShell.classList.toggle("mobile-details-open", mobile && mobileDetailsOpen);
  els.mobileScrim.hidden = !(mobile && (mobileLibraryOpen || mobileDetailsOpen));

  if (mobile) {
    els.sidebarToggleButton.textContent = "☰";
    els.sidebarToggleButton.title = mobileLibraryOpen ? "Close library" : "Open library";
    els.detailsToggleButton.textContent = "i";
    els.detailsToggleButton.title = mobileDetailsOpen ? "Close thought details" : "Open thought details";
    els.fitButton.textContent = "⛶";
    els.moreButton.textContent = "...";
  } else {
    els.sidebarToggleButton.textContent = "☰";
    els.sidebarToggleButton.title = sidebarHidden ? "Show thoughts sidebar" : "Hide thoughts sidebar";
    els.detailsToggleButton.textContent = "i";
    els.detailsToggleButton.title = detailsHidden ? "Show thought details" : "Hide thought details";
    els.fitButton.textContent = "Fit";
    els.settingsButton.textContent = "Settings";
    els.moreButton.textContent = "...";
  }

  els.sidebarToggleButton.setAttribute("aria-label", els.sidebarToggleButton.title);
  els.sidebarToggleButton.setAttribute("aria-expanded", String(mobile ? mobileLibraryOpen : !sidebarHidden));
  els.detailsToggleButton.setAttribute("aria-label", els.detailsToggleButton.title);
  els.detailsToggleButton.setAttribute("aria-expanded", String(mobile ? mobileDetailsOpen : !detailsHidden));
  els.fitButton.setAttribute("aria-label", "Fit map");
  els.moreButton.setAttribute("aria-label", "More map tools");
  renderMobileCapture();
}

function openMobileLibrary(options: MobileLibraryOptions = {}) {
  if (!isMobileLayout()) return;
  mobileLibraryOpen = true;
  mobileDetailsOpen = false;
  closeMobileCapture();
  renderPanelState();
  if (options.focusSearch) {
    requestAnimationFrame(() => {
      els.searchInput.focus();
      els.searchInput.select();
    });
  }
}

function openMobileDetails() {
  if (!isMobileLayout()) return;
  mobileDetailsOpen = true;
  mobileLibraryOpen = false;
  closeMobileCapture();
  renderPanelState();
}

function closeMobilePanels() {
  if (!mobileLibraryOpen && !mobileDetailsOpen) return;
  mobileLibraryOpen = false;
  mobileDetailsOpen = false;
  renderPanelState();
}

function toggleMobileCapture() {
  if (!isMobileLayout()) return;
  if (mobileCaptureOpen) {
    closeMobileCapture();
  } else {
    openMobileCapture();
  }
}

function openMobileCapture() {
  if (!isMobileLayout()) return;
  mobileCaptureOpen = true;
  closeMobilePanels();
  closeSettings();
  renderMobileCapture();
  requestAnimationFrame(() => els.mobileCaptureInput.focus());
}

function closeMobileCapture() {
  if (!mobileCaptureOpen) return;
  mobileCaptureOpen = false;
  renderMobileCapture();
}

function renderMobileCapture() {
  const showCapture = isMobileLayout() && mobileCaptureOpen;
  els.mobileCaptureForm.hidden = !showCapture;
  els.mobileCaptureButton.classList.toggle("active", showCapture);
  els.mobileCaptureButton.setAttribute("aria-expanded", String(showCapture));
}

function onPointerDown(event: PointerEvent) {
  closeContextMenu();
  if (event.button !== 0) return;
  event.preventDefault();
  els.graph.setPointerCapture(event.pointerId);
  const createHandle = getClosestElement(event.target, ".node-create-handle");
  if (createHandle?.dataset.id) {
    const relation = getCreateHandleRelation(createHandle.dataset.relation);
    const direction = getCreateHandleDirection(createHandle.dataset.direction);
    contextAnchorId = createHandle.dataset.id;
    selectedLinkId = null;
    setHoverThought(contextAnchorId);
    pointerMode = {
      type: "create-handle",
      id: contextAnchorId,
      relation,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
    };
    pointerStart = null;
    return;
  }

  const link = getClosestElement(event.target, ".link-group");
  if (link) {
    selectLink(link.dataset.linkId);
    pointerMode = null;
    pointerStart = null;
    return;
  }

  const node = getClosestElement(event.target, ".node");

  if (node?.dataset.id) {
    // Thoughts are arranged automatically by the focus layout, so they can't be
    // dragged out of place. Pressing one (click or drag) just selects it; the smooth
    // recenter happens on release, the same transition as clicking it in the list.
    pointerMode = { type: "node", id: node.dataset.id };
    pointerStart = null;
    return;
  }

  selectedLinkId = null;
  pointerMode = { type: "pan" };
  pointerStart = {
    clientX: event.clientX,
    clientY: event.clientY,
    viewX: state.view.x,
    viewY: state.view.y,
  };
}

function onPointerMove(event: PointerEvent) {
  updateHoverThought(event);
  if (pointerMode?.type === "create-handle") {
    const dragDistance = Math.hypot(event.clientX - pointerMode.startX, event.clientY - pointerMode.startY);
    pointerMode.dragged = pointerMode.dragged || dragDistance > 6;
    return;
  }
  // Only the empty canvas pans; a press on a node never moves it.
  if (pointerMode?.type !== "pan" || !pointerStart) return;
  state.view.x = pointerStart.viewX + (event.clientX - pointerStart.clientX);
  state.view.y = pointerStart.viewY + (event.clientY - pointerStart.clientY);
  renderGraph();
}

function onPointerUp(event: PointerEvent) {
  if (pointerMode?.type === "node") {
    selectThought(pointerMode.id);
  } else if (pointerMode?.type === "create-handle") {
    contextAnchorId = pointerMode.id;
    const x = pointerMode.dragged ? event.clientX : pointerMode.startX;
    const y = pointerMode.dragged ? event.clientY : pointerMode.startY;
    openNodeContextMenu(x, y, pointerMode.relation);
  } else if (pointerMode?.type === "pan") {
    persistState();
  }
  pointerMode = null;
  pointerStart = null;
}

function onGraphContextMenu(event) {
  const link = event.target.closest(".link-group");
  if (link) {
    event.preventDefault();
    selectLink(link.dataset.linkId);
    openLinkContextMenu(link.dataset.linkId, event.clientX, event.clientY);
    return;
  }

  const node = event.target.closest(".node");
  if (!node) return;
  event.preventDefault();
  contextAnchorId = node.dataset.id;
  setHoverThought(contextAnchorId);
  openNodeContextMenu(event.clientX, event.clientY);
}

function updateHoverThought(event) {
  if (pointerMode?.type === "pan") {
    clearHoverThought();
    return;
  }
  const node = event.target.closest(".node");
  setHoverThought(node?.dataset.id || null);
}

function setHoverThought(id) {
  const nextId = id || null;
  const previousPreviewId = hoverThoughtId && hoverThoughtId !== getGraphFocusId() ? hoverThoughtId : null;
  const nextPreviewId = nextId && nextId !== getGraphFocusId() ? nextId : null;
  hoverThoughtId = nextId;
  if (previousPreviewId === nextPreviewId) return;
  renderGraph();
}

function clearHoverThought() {
  setHoverThought(null);
}

function selectLink(linkId) {
  if (!getLink(linkId)) return;
  selectedLinkId = linkId;
  renderGraph();
}

function getCreateHandleRelation(value: string | undefined): LinkRelation {
  return value === "child-of" || value === "related" ? value : "parent-of";
}

function getCreateHandleDirection(value: string | undefined): "top" | "right" | "bottom" | "left" {
  return value === "top" || value === "right" || value === "bottom" || value === "left" ? value : "bottom";
}

function openNodeContextMenu(clientX, clientY, relation: LinkRelation = "parent-of") {
  contextLinkId = null;
  els.nodeCreateForm.hidden = false;
  els.linkEditForm.hidden = true;
  els.contextMenu.hidden = false;
  els.nodeCreateInput.value = "";
  els.nodeCreateNoteInput.value = "";
  els.nodeCreateRelationInput.value = relation;
  positionContextMenu(clientX, clientY);
  requestAnimationFrame(() => els.nodeCreateInput.focus());
}

function openLinkContextMenu(linkId, clientX, clientY) {
  const link = getLink(linkId);
  if (!link) return;
  contextAnchorId = null;
  contextLinkId = linkId;
  els.nodeCreateForm.hidden = true;
  els.linkEditForm.hidden = false;
  els.contextMenu.hidden = false;
  renderLinkEditForm(link);
  positionContextMenu(clientX, clientY);
  requestAnimationFrame(() => els.linkNameInput.focus());
}

function positionContextMenu(clientX, clientY) {
  const bounds = els.contextMenu.getBoundingClientRect();
  const width = Math.max(bounds.width, 280);
  const height = Math.max(bounds.height, 178);
  const x = Math.min(clientX, window.innerWidth - width - 12);
  const y = Math.min(clientY, window.innerHeight - height - 12);
  els.contextMenu.style.left = `${Math.max(12, x)}px`;
  els.contextMenu.style.top = `${Math.max(12, y)}px`;
}

function closeContextMenu() {
  els.contextMenu.hidden = true;
  contextAnchorId = null;
  contextLinkId = null;
}

function onNodeCreateSubmit(event) {
  event.preventDefault();
  const title = els.nodeCreateInput.value.trim();
  if (!title || !contextAnchorId) return;
  addThought(title, contextAnchorId, els.nodeCreateRelationInput.value as LinkRelation, {
    note: els.nodeCreateNoteInput.value,
  });
  closeContextMenu();
}

function renderLinkEditForm(link = getLink(contextLinkId)) {
  if (!link) return;
  const from = getThought(link.from);
  const to = getThought(link.to);
  if (!from || !to) return;
  els.linkNameInput.value = link.name || "";
  els.linkDirectionInput.options[0].textContent = `${from.title} above ${to.title}`;
  els.linkDirectionInput.options[1].textContent = `${to.title} above ${from.title}`;
  els.linkDirectionInput.value = link.type === "related" ? "related" : "parent-forward";
  els.linkKeepInput.replaceChildren(optionElement(from.id, `Keep ${from.title}`), optionElement(to.id, `Keep ${to.title}`));
  els.linkKeepInput.value = [link.from, link.to].includes(state.selectedId) ? state.selectedId : link.from;
  renderLinkRetargetOptions();
}

function renderLinkRetargetOptions() {
  const keepId = els.linkKeepInput.value;
  const options = state.thoughts
    .filter((thought) => thought.id !== keepId)
    .map((thought) => optionElement(thought.id, thought.title));
  els.linkRetargetInput.replaceChildren(...options);
}

function onLinkEditSubmit(event) {
  event.preventDefault();
  const link = getLink(contextLinkId);
  if (!link) return;
  const direction = els.linkDirectionInput.value;
  const nextLink: Link = {
    ...link,
    name: els.linkNameInput.value.trim(),
    type: direction === "related" ? "related" : "parent",
    from: direction === "parent-reverse" ? link.to : link.from,
    to: direction === "parent-reverse" ? link.from : link.to,
  };
  if (isDuplicateLink(nextLink, link.id)) {
    window.alert("That connection already exists.");
    return;
  }
  pushHistory();
  link.name = nextLink.name;
  link.type = nextLink.type;
  link.from = nextLink.from;
  link.to = nextLink.to;
  selectedLinkId = link.id;
  focusPositions = null;
  render();
  persistState();
  closeContextMenu();
}

function unlinkContextLink() {
  const linkId = contextLinkId;
  if (!linkId) return;
  removeConnection(linkId);
  closeContextMenu();
}

function retargetContextLink() {
  const link = getLink(contextLinkId);
  const keepId = els.linkKeepInput.value;
  const targetId = els.linkRetargetInput.value;
  if (!link || !keepId || !targetId || keepId === targetId) return;
  const fromPositions = getVisualPositions();
  const leavingLink = clone(link);

  const relation = els.linkRetargetRelationInput.value as RetargetRelation;
  let nextFrom = keepId;
  let nextTo = targetId;
  let nextType: LinkType = relation === "related" ? "related" : "parent";
  if (relation === "child-of") {
    nextFrom = targetId;
    nextTo = keepId;
  } else if (relation === "sibling") {
    const parent = getParentThoughts(keepId)[0];
    if (!parent) {
      window.alert("This thought needs a parent before another thought can be placed as its sibling.");
      return;
    }
    nextFrom = parent.id;
    nextTo = targetId;
    nextType = "parent";
  }

  const nextLink: Link = {
    ...link,
    from: nextFrom,
    to: nextTo,
    type: nextType,
    name: els.linkNameInput.value.trim(),
  };
  if (isDuplicateLink(nextLink, link.id)) {
    window.alert("That connection already exists.");
    return;
  }
  pushHistory();
  link.from = nextLink.from;
  link.to = nextLink.to;
  link.type = nextLink.type;
  link.name = nextLink.name;
  selectedLinkId = link.id;
  renderThoughtList();
  renderDetails();
  const toPositions = computeFocusPositions(state.selectedId);
  runGraphTransition({
    fromPositions,
    toPositions,
    toView: getFocusView(state.selectedId, toPositions),
    appearingLinkIds: [link.id],
    leavingLinks: [leavingLink],
    save: true,
  });
  closeContextMenu();
}

function onDocumentPointerDown(event) {
  if (!els.contextMenu.hidden && !els.contextMenu.contains(event.target)) {
    closeContextMenu();
  }
  if (moreMenuOpen && !els.moreMenu.contains(event.target) && event.target !== els.moreButton) {
    closeMoreMenu();
  }
  if (
    mobileCaptureOpen &&
    isMobileLayout() &&
    !els.mobileCaptureForm.contains(event.target) &&
    event.target !== els.mobileCaptureButton
  ) {
    closeMobileCapture();
  }
}

function onWheel(event) {
  event.preventDefault();
  const previous = state.view.scale;
  const next = clamp(previous * (event.deltaY > 0 ? 0.9 : 1.1), 0.35, 2.1);
  const rect = els.graph.getBoundingClientRect();
  const sx = event.clientX - rect.left - graphRect.width / 2;
  const sy = event.clientY - rect.top - graphRect.height / 2;
  const worldX = (sx - state.view.x) / previous;
  const worldY = (sy - state.view.y) / previous;
  state.view.scale = next;
  state.view.x = sx - worldX * next;
  state.view.y = sy - worldY * next;
  renderGraph();
  persistState();
}

function exportMap() {
  syncActiveProject();
  downloadFile("thoughts-mapper-backup.json", JSON.stringify(appData, null, 2), "application/json");
}

function exportMarkdown() {
  const lines = ["# Thoughts Mapper Export", ""];
  state.thoughts
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((thought) => {
      const connections = getConnections(thought.id);
      lines.push(`## ${thought.title}`, "");
      lines.push(`- Kind: ${getKindName(thought.kind)}`);
      if (thought.tags.length) lines.push(`- Tags: ${thought.tags.map((tag) => `#${tag}`).join(" ")}`);
      if (connections.length) {
        lines.push("- Links:");
        connections
          .slice()
          .sort((a, b) => a.thought.title.localeCompare(b.thought.title))
          .forEach(({ thought: other, role, linkName }) => {
            const label = role === "related" ? "Related" : role === "parent" ? "Parent" : "Child";
            const name = linkName ? ` (${linkName})` : "";
            lines.push(`  - ${label}${name}: [[${other.title}]]`);
          });
      }
      if (thought.note.trim()) {
        lines.push("", thought.note.trim());
      }
      lines.push("");
    });
  downloadFile("thoughts-map.md", lines.join("\n"), "text/markdown");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importMap(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (parsed && Array.isArray(parsed.projects)) {
        const approved = window.confirm("Importing this JSON backup will replace all Thoughts Mapper projects on this browser.");
        if (!approved) {
          setStatus("Import cancelled");
          return;
        }
        appData = sanitizeAppData(parsed);
        state = clone(getActiveProject().state);
      } else {
        const approved = window.confirm("Importing this JSON map will replace the current project, including thoughts, notes, links, tags, positions, and settings.");
        if (!approved) {
          setStatus("Import cancelled");
          return;
        }
        pushHistory();
        state = sanitizeState(parsed);
        syncActiveProject();
      }
      resetProjectSessionState();
      render();
      requestAnimationFrame(fitToGraph);
      persistState();
      setStatus("JSON imported");
    } catch {
      window.alert("That file could not be imported.");
      setStatus("Import failed");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function getThought(id) {
  return state.thoughts.find((thought) => thought.id === id);
}

function getLink(id) {
  return state.links.find((link) => link.id === id);
}

function syncSelectedLink() {
  if (selectedLinkId && !getLink(selectedLinkId)) selectedLinkId = null;
  if (contextLinkId && !getLink(contextLinkId)) contextLinkId = null;
}

function isDuplicateLink(nextLink, ignoreId = null) {
  return state.links.some((link) => {
    if (link.id === ignoreId) return false;
    if (nextLink.type === "related") {
      return link.type === "related" && ((link.from === nextLink.from && link.to === nextLink.to) || (link.from === nextLink.to && link.to === nextLink.from));
    }
    return link.type !== "related" && link.from === nextLink.from && link.to === nextLink.to;
  });
}

function getSelectedThought() {
  return getThought(state.selectedId);
}

function qs<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element as T;
}

function getClosestElement(target: EventTarget | null, selector: string): HTMLElement | null {
  return target instanceof Element ? target.closest(selector) : null;
}

function svg(tag: string, attrs: SvgAttrs = {}, text?: string): SVGElement {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeId(prefix) {
  const id =
    window.crypto && "randomUUID" in window.crypto
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function clone<T>(value: T): T {
  return "structuredClone" in window ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function trimLabel(label, length) {
  return label.length > length ? `${label.slice(0, length - 1)}...` : label;
}

function showNotePreview(text) {
  els.notePreview.innerHTML = text && text.trim()
    ? renderMarkdown(text)
    : '<p class="note-empty">Nothing yet — click to write. Markdown supported.</p>';
  els.notePreview.hidden = false;
  els.noteInput.hidden = true;
}

function startNoteEditing() {
  if (!getSelectedThought()) return;
  els.notePreview.hidden = true;
  els.noteInput.hidden = false;
  els.noteInput.focus();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescapeHtml(text) {
  return String(text)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Inline markdown on already HTML-escaped text: code, bold, italic, strikethrough, links.
function renderInline(text) {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, (_, label) => {
      const thought = getThoughtByTitle(unescapeHtml(label));
      if (!thought) return `<span class="mention-missing">[[${label}]]</span>`;
      return `<button type="button" class="mention-link" data-mention-id="${thought.id}">${label}</button>`;
    })
    .replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const safe = /^(https?:|mailto:|\/|#)/i.test(url) ? url : "#";
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
}

// Minimal, dependency-free markdown -> HTML for notes. Supports headings, lists,
// blockquotes, fenced code, horizontal rules, paragraphs, and inline formatting.
// Input is HTML-escaped up front so rendered notes can't inject markup.
function renderMarkdown(source) {
  const lines = escapeHtml(source).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let listType = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
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
      const code = [];
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
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
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
      out.push(`<blockquote>${renderInline(quote.join(" "))}</blockquote>`);
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
        out.push(`<li class="task-item"><input type="checkbox" disabled${checked} />${renderInline(task[2].trim())}</li>`);
      } else {
        out.push(`<li>${renderInline((ordered ? ordered[1] : unordered[1]).trim())}</li>`);
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
