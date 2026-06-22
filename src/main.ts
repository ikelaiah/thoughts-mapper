import {
  arrangeHorizontalThoughtRow,
  arrangeVerticalThoughtColumn,
  easeOutCubic,
  getNodeBox as calculateNodeBox,
  interpolate,
  interpolatePositions,
} from "./graph-layout";
import { createProject, sanitizeAppData, sanitizeState } from "./app-data";
import { renderGraphView } from "./graph-render";
import {
  jsonCanvasToState,
  markdownFilesToState,
  opmlDocumentToState,
  projectToJsonCanvas,
  projectToMarkdownBundle,
  projectToMarkdownFiles,
  projectToOpml,
  slugifyFilename,
  type TextFile,
} from "./interoperability";
import { renderMarkdown } from "./markdown";
import { normalizeKindName, normalizeTags, sanitizeKindColor, sanitizeKindId } from "./normalizers";
import {
  DEFAULT_KIND_ID,
  HISTORY_LIMIT,
  LINK_DRAW_DURATION,
  NEW_KIND_VALUE,
  NODE_CREATE_CLICK_THRESHOLD,
  NODE_CREATE_DRAG_THRESHOLD,
  NODE_CREATE_HANDLE_GAP,
  colourSchemes,
  defaultKindDefinitions,
  kindColourPalette,
  seedState,
  templateCatalog,
} from "./constants";
import { loadIndexedState, loadLocalState, openDatabase, persistIndexedState, persistLocalState } from "./storage";
import { bindUiEvents } from "./ui-events";
import { clamp, clone, makeId } from "./utils";
import type {
  AddKindOptions,
  AddThoughtOptions,
  AppData,
  AppElements,
  CenterOptions,
  CreateHandleDirection,
  CreateHandlePreview,
  CreateKindOptions,
  DetailsTabId,
  GraphDepthStyle,
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
  ProjectSnapshot,
  ProjectState,
  RetargetRelation,
  SelectThoughtOptions,
  StageViewId,
  SvgAttrs,
  Thought,
  ThoughtAttachment,
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
type ReviewModeId = "unplaced" | "orphaned" | "missing-mentions" | "open-questions" | "stale-notes" | "unchecked-tasks";
type ReviewItem = {
  id: string;
  thought: Thought;
  title: string;
  note: string;
  mode: ReviewModeId;
  missingTitle?: string;
};
type CommandPaletteMode = "root" | "create" | "connect" | "jump" | "tag" | "export";
type CommandPaletteItem = {
  id: string;
  title: string;
  meta: string;
  action: () => void;
};
type CalmDepthLayoutOptions = {
  verticalGap: number;
  sideGap: number;
  rowGap: number;
  selectedX: number;
};
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
let createHandlePreview: CreateHandlePreview | null = null;
const graphEffects: GraphEffects = {
  appearingLinkIds: new Set<string>(),
  leavingLinks: [] as LinkRenderEffect[],
  dimThoughts: new Map<string, ThoughtRenderEffect>(),
};
const CALM_DEPTH_STYLES: GraphDepthStyle[] = [
  { level: 1, scale: 1, opacity: 1 },
  { level: 2, scale: 0.9, opacity: 0.4 },
  { level: 3, scale: 0.8, opacity: 0.5 },
  { level: 4, scale: 0.7, opacity: 0.6 },
  { level: 5, scale: 0.6, opacity: 0.7 },
];
let contextAnchorId: string | null = null;
let pendingNodeCreatePosition: Point | null = null;
let contextLinkId: string | null = null;
let hoverThoughtId: string | null = null;
let hoverClearTimer: number | undefined;
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
let reviewMode: ReviewModeId = "unplaced";
let noteWorkspaceOpen = false;
let activeDetailsTab: DetailsTabId = "details";
let stageView: StageViewId = "map";
let commandPaletteOpen = false;
let commandPaletteMode: CommandPaletteMode = "root";
let commandPaletteActiveIndex = 0;
let snapshotPanelOpen = false;
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
  reviewButton: qs("#reviewButton"),
  inboxCount: qs("#inboxCount"),
  thoughtCount: qs("#thoughtCount"),
  thoughtList: qs("#thoughtList"),
  sidebarActions: qs(".sidebar-actions"),
  exportButton: qs("#exportButton"),
  markdownExportButton: qs("#markdownExportButton"),
  markdownFolderExportButton: qs("#markdownFolderExportButton"),
  opmlExportButton: qs("#opmlExportButton"),
  jsonCanvasExportButton: qs("#jsonCanvasExportButton"),
  svgExportButton: qs("#svgExportButton"),
  pngExportButton: qs("#pngExportButton"),
  snapshotButton: qs("#snapshotButton"),
  importInput: qs("#importInput"),
  markdownImportInput: qs("#markdownImportInput"),
  opmlImportInput: qs("#opmlImportInput"),
  jsonCanvasImportInput: qs("#jsonCanvasImportInput"),
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
  mapStage: qs(".map-stage"),
  stagePrompt: qs("#stagePrompt"),
  mapViewButton: qs("#mapViewButton"),
  outlineViewButton: qs("#outlineViewButton"),
  walkViewButton: qs("#walkViewButton"),
  outlineView: qs("#outlineView"),
  outlineTitle: qs("#outlineTitle"),
  outlineSummary: qs("#outlineSummary"),
  outlineTree: qs("#outlineTree"),
  walkView: qs("#walkView"),
  walkTitle: qs("#walkTitle"),
  walkMeta: qs("#walkMeta"),
  walkNote: qs("#walkNote"),
  walkContext: qs("#walkContext"),
  walkProgress: qs("#walkProgress"),
  walkPrevButton: qs("#walkPrevButton"),
  walkNextButton: qs("#walkNextButton"),
  walkMapButton: qs("#walkMapButton"),
  settingsPage: qs("#settingsPage"),
  settingsCloseButton: qs("#settingsCloseButton"),
  mobileManagement: qs("#mobileManagement"),
  colourSchemeInput: qs("#colourSchemeInput"),
  lineThicknessInput: qs("#lineThicknessInput"),
  lineThicknessValue: qs("#lineThicknessValue"),
  connectionTypeInput: qs("#connectionTypeInput"),
  lineEndpointInput: qs("#lineEndpointInput"),
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
  detailsTabDetails: qs("#detailsTabDetails"),
  detailsTabNotes: qs("#detailsTabNotes"),
  detailsTabLinks: qs("#detailsTabLinks"),
  detailsTabSources: qs("#detailsTabSources"),
  detailsTabPanelDetails: qs("#detailsTabPanelDetails"),
  detailsTabPanelNotes: qs("#detailsTabPanelNotes"),
  detailsTabPanelLinks: qs("#detailsTabPanelLinks"),
  detailsTabPanelSources: qs("#detailsTabPanelSources"),
  selectedType: qs("#selectedType"),
  deleteButton: qs("#deleteButton"),
  titleInput: qs("#titleInput"),
  kindInput: qs("#kindInput"),
  kindDefaultButton: qs("#kindDefaultButton"),
  tagInput: qs("#tagInput"),
  inboxPlacementPanel: qs("#inboxPlacementPanel"),
  placeTargetInput: qs("#placeTargetInput"),
  placeRelationInput: qs("#placeRelationInput"),
  placeThoughtButton: qs("#placeThoughtButton"),
  placePreviewText: qs("#placePreviewText"),
  openNoteWorkspaceButton: qs("#openNoteWorkspaceButton"),
  noteInput: qs("#noteInput"),
  notePreview: qs("#notePreview"),
  noteWorkspace: qs("#noteWorkspace"),
  noteWorkspaceTitle: qs("#noteWorkspaceTitle"),
  noteWorkspaceInput: qs("#noteWorkspaceInput"),
  closeNoteWorkspaceButton: qs("#closeNoteWorkspaceButton"),
  linkForm: qs("#linkForm"),
  linkTargetInput: qs("#linkTargetInput"),
  linkTargetOptions: qs("#linkTargetOptions"),
  linkRelationInput: qs("#linkRelationInput"),
  linkSubmitButton: qs("#linkSubmitButton"),
  linkPreviewText: qs("#linkPreviewText"),
  connectedThoughtForm: qs("#connectedThoughtForm"),
  connectedThoughtTitleInput: qs("#connectedThoughtTitleInput"),
  connectedThoughtRelationInput: qs("#connectedThoughtRelationInput"),
  connectedThoughtSubmitButton: qs("#connectedThoughtSubmitButton"),
  connectionCount: qs("#connectionCount"),
  connectionList: qs("#connectionList"),
  backlinkCount: qs("#backlinkCount"),
  backlinkList: qs("#backlinkList"),
  mentionCount: qs("#mentionCount"),
  mentionList: qs("#mentionList"),
  attachmentForm: qs("#attachmentForm"),
  attachmentKindInput: qs("#attachmentKindInput"),
  attachmentTitleInput: qs("#attachmentTitleInput"),
  attachmentRefInput: qs("#attachmentRefInput"),
  attachmentList: qs("#attachmentList"),
  inboxReviewPanel: qs("#inboxReviewPanel"),
  reviewModeInput: qs("#reviewModeInput"),
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
  reviewOpenNoteButton: qs("#reviewOpenNoteButton"),
  reviewFixButton: qs("#reviewFixButton"),
  commandPalette: qs("#commandPalette"),
  commandPaletteInput: qs("#commandPaletteInput"),
  commandPaletteList: qs("#commandPaletteList"),
  commandPaletteHint: qs("#commandPaletteHint"),
  commandPaletteCloseButton: qs("#commandPaletteCloseButton"),
  snapshotPanel: qs("#snapshotPanel"),
  snapshotNameInput: qs("#snapshotNameInput"),
  createSnapshotButton: qs("#createSnapshotButton"),
  snapshotList: qs("#snapshotList"),
  snapshotCloseButton: qs("#snapshotCloseButton"),
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
        openInboxReview("unplaced");
        return;
      }
      showInboxOnly = !showInboxOnly;
      renderThoughtList();
    },
    openReview: () => openInboxReview(getFirstPopulatedReviewMode()),
    exportMap,
    exportMarkdown,
    exportMarkdownFolder,
    exportOpml,
    exportJsonCanvas,
    exportSvg,
    exportPng,
    openSnapshotPanel,
    importMap,
    importMarkdown,
    importOpml,
    importJsonCanvas,
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
    resetViewAndCloseMoreMenu: () => {
      resetView();
      closeMoreMenu();
    },
    showMapView: () => setStageView("map"),
    showOutlineView: () => setStageView("outline"),
    showWalkView: () => setStageView("walk"),
    previousWalkThought,
    nextWalkThought,
    showWalkThoughtOnMap,
    showDetailsTab: () => setDetailsTab("details"),
    showNotesTab: () => setDetailsTab("notes"),
    showLinksTab: () => setDetailsTab("links"),
    showSourcesTab: () => setDetailsTab("sources"),
    onTitleInput: () => {
      const selected = getSelectedThought();
      if (!selected) return;
      pushHistory();
      selected.title = els.titleInput.value;
      touchThought(selected);
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
      touchThought(selected);
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
      touchThought(selected);
      render();
      persistState();
    },
    openNoteWorkspace,
    closeNoteWorkspace,
    onNoteInput: () => {
      updateSelectedNote(els.noteInput.value, "compact");
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
    onNoteWorkspaceInput: () => {
      updateSelectedNote(getLiveEditorMarkdown(), "workspace", getLiveEditorCaretOffset());
    },
    onNoteWorkspaceKeydown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        insertLiveEditorText("\n");
      } else if (event.key === "Tab") {
        event.preventDefault();
        insertLiveEditorText("  ");
      }
    },
    onNoteWorkspacePaste: (event) => {
      event.preventDefault();
      insertLiveEditorText(event.clipboardData?.getData("text/plain") || "");
    },
    onLinkSubmit: (event) => {
      event.preventDefault();
      const target = resolveLinkTarget(els.linkTargetInput.value);
      addLink(state.selectedId, target?.id || null, els.linkRelationInput.value as LinkRelation);
      if (target) els.linkTargetInput.value = "";
    },
    onConnectedThoughtSubmit: (event) => {
      event.preventDefault();
      const selected = getSelectedThought();
      const title = els.connectedThoughtTitleInput.value.trim();
      if (!selected || !title) return;
      els.connectedThoughtTitleInput.value = "";
      addThought(title, selected.id, els.connectedThoughtRelationInput.value as LinkRelation);
      setStatus("Connected thought created");
    },
    onAttachmentSubmit,
    renderRelationshipPreviews,
    onReviewModeChange,
    placeInboxThought,
    closeInboxReview,
    previousInboxReviewThought,
    nextInboxReviewThought,
    placeInboxReviewAsChild: () => placeInboxReviewThought("child-of"),
    placeInboxReviewAsParent: () => placeInboxReviewThought("parent-of"),
    placeInboxReviewRelated: () => placeInboxReviewThought("related"),
    keepInboxReviewThought,
    openReviewNote,
    fixCurrentReviewItem,
    closeCommandPalette,
    onCommandPaletteInput: () => {
      commandPaletteActiveIndex = 0;
      renderCommandPalette();
    },
    onCommandPaletteKeydown,
    createSnapshot,
    closeSnapshotPanel,
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
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "p" || event.key === "/")) {
        event.preventDefault();
        openCommandPalette();
        return;
      }
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
        closeCommandPalette();
        closeSnapshotPanel();
        closeNoteWorkspace();
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
  renderStageView();
  renderOutline();
  renderWalk();
  renderNoteWorkspace();
  renderKindSettings();
  renderInboxReview();
  renderCommandPalette();
  renderSnapshotPanel();
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
}

function getColourSchemeId(theme, background) {
  const match = Object.entries(colourSchemes).find(([, scheme]) => scheme.theme === theme && scheme.background === background);
  if (match) return match[0];
  if (background === "eink") return "light-eink";
  if (background === "leaves") return "light-leaves";
  if (background === "fireflies") return "dark-fire";
  if (background === "starfield") return "dark-starfield";
  if (background === "high-contrast") return "high-contrast";
  if (background === "presentation") return "presentation";
  return theme === "dark" ? "dark-calm" : "light-mint";
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
      attachments: [],
      updatedAt: new Date().toISOString(),
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
      attachments: [],
      updatedAt: new Date().toISOString(),
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
  els.reviewButton.classList.toggle("active", inboxReviewOpen);
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
      dot.style.background = getKindDisplayColor(thought.kind);

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
  renderDetailsTabs();
  if (!selected) return;

  els.selectedType.textContent = getKindName(selected.kind);
  const selectedKindColor = getKindDisplayColor(selected.kind);
  els.selectedType.style.background = colorWithAlpha(selectedKindColor, isEinkTheme() ? 0.12 : 0.14);
  els.selectedType.style.color = selectedKindColor;
  els.titleInput.value = selected.title;
  renderKindInspector(selected);
  els.tagInput.value = selected.tags.join(", ");
  if (document.activeElement !== els.noteInput) {
    els.noteInput.value = selected.note;
    showNotePreview(selected.note);
  }
  els.openNoteWorkspaceButton.disabled = false;

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
  els.connectedThoughtSubmitButton.disabled = !selected;
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
      dot.style.background = getKindDisplayColor(thought.kind);
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

      const editButton = document.createElement("button");
      editButton.className = "connection-action connection-edit";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.title = `Edit the connection between ${selected.title} and ${thought.title}`;
      editButton.addEventListener("click", () => openLinkContextMenuFromElement(linkId, editButton));

      unlinkButton.classList.add("connection-action");
      item.append(openButton, editButton, unlinkButton);
      return item;
    }),
  );
  renderMentionPanels(selected);
  renderAttachmentPanel(selected);
}

function setStageView(view: StageViewId) {
  if (stageView === view) return;
  stageView = view;
  renderStageView();
  if (view === "outline") {
    renderOutline();
    return;
  }
  if (view === "walk") {
    renderWalk();
    return;
  }
  requestAnimationFrame(() => {
    measureGraph();
    renderGraph();
  });
}

function renderStageView() {
  const outlineActive = stageView === "outline";
  const walkActive = stageView === "walk";
  const nonMapActive = outlineActive || walkActive;
  els.mapStage.classList.toggle("outline-mode", outlineActive);
  els.mapStage.classList.toggle("walk-mode", walkActive);
  els.outlineView.hidden = !outlineActive;
  els.walkView.hidden = !walkActive;
  els.mapViewButton.classList.toggle("active", !nonMapActive);
  els.outlineViewButton.classList.toggle("active", outlineActive);
  els.walkViewButton.classList.toggle("active", walkActive);
  els.mapViewButton.setAttribute("aria-selected", String(!nonMapActive));
  els.outlineViewButton.setAttribute("aria-selected", String(outlineActive));
  els.walkViewButton.setAttribute("aria-selected", String(walkActive));
  els.graph.setAttribute("aria-hidden", String(nonMapActive));
  els.fitButton.disabled = nonMapActive;
  els.fitButton.title = nonMapActive ? "Switch to map view to fit the map" : "Fit map";
  els.fitButton.setAttribute("aria-label", els.fitButton.title);
  els.stagePrompt.hidden = nonMapActive || Boolean(getSelectedThought());
}

function renderOutline() {
  const project = getActiveProject();
  const graphThoughts = getGraphThoughts().slice().sort(compareThoughtsByTitle);
  const inboxThoughts = getInboxThoughts().slice().sort(compareThoughtsByTitle);
  const roots = getOutlineRoots(graphThoughts);
  const outlineContext = createOutlineContext();
  const rootNodes = roots.map((thought) => buildOutlineNode(thought, new Set(), outlineContext, null));
  const otherPlaced = graphThoughts
    .filter((thought) => !outlineContext.placedIds.has(thought.id))
    .map((thought) => buildOutlineNode(thought, new Set(), outlineContext, null));
  const sections = [
    createOutlineSection("Map roots", rootNodes),
    createOutlineSection("Other placed thoughts", otherPlaced),
    createOutlineThoughtSection("Inbox", inboxThoughts),
  ].filter(Boolean);

  els.outlineTitle.textContent = project.name;
  els.outlineSummary.textContent = `${graphThoughts.length} placed · ${inboxThoughts.length} inbox`;
  els.outlineTree.replaceChildren(
    ...(sections.length
      ? sections
      : [outlineEmptyState("No thoughts yet")]),
  );
}

function getOutlineRoots(graphThoughts: Thought[]): Thought[] {
  const graphIds = new Set(graphThoughts.map((thought) => thought.id));
  const childIds = new Set(
    state.links
      .filter((link) => link.type !== "related" && graphIds.has(link.from) && graphIds.has(link.to))
      .map((link) => link.to),
  );
  const roots = graphThoughts.filter((thought) => !childIds.has(thought.id));
  if (roots.length) return roots;
  const selected = state.selectedId ? getThought(state.selectedId) : null;
  return selected && graphIds.has(selected.id) ? [selected] : graphThoughts.slice(0, 1);
}

function createOutlineContext() {
  return {
    placedIds: new Set<string>(),
    placedUnder: new Map<string, string>(),
  };
}

function buildOutlineNode(thought: Thought, ancestors: Set<string>, context, parent: Thought | null) {
  const placedUnder = context.placedUnder.get(thought.id) || "";
  if (context.placedIds.has(thought.id)) {
    return {
      thought,
      children: [],
      reference: true,
      referenceText: placedUnder ? `shown under ${placedUnder}` : "shown above",
    };
  }

  const nextAncestors = new Set(ancestors);
  const repeated = nextAncestors.has(thought.id);
  if (repeated) {
    return {
      thought,
      children: [],
      reference: true,
      referenceText: "cycle reference",
    };
  }

  context.placedIds.add(thought.id);
  context.placedUnder.set(thought.id, parent?.title || "Map roots");
  nextAncestors.add(thought.id);
  return {
    thought,
    reference: false,
    referenceText: "",
    children: getChildThoughts(thought.id)
      .slice()
      .sort(compareThoughtsByTitle)
      .map((child) => buildOutlineNode(child, nextAncestors, context, thought)),
  };
}

function createOutlineSection(title: string, nodes) {
  if (!nodes.length) return null;
  const section = document.createElement("section");
  section.className = "outline-section";
  const heading = document.createElement("div");
  heading.className = "outline-section-heading";
  heading.append(spanText(title), spanText(String(nodes.length)));
  const list = document.createElement("div");
  list.className = "outline-list";
  nodes.forEach((node) => list.append(createOutlineNodeElement(node, 0)));
  section.append(heading, list);
  return section;
}

function createOutlineThoughtSection(title: string, thoughts: Thought[]) {
  if (!thoughts.length) return null;
  const section = document.createElement("section");
  section.className = "outline-section";
  const heading = document.createElement("div");
  heading.className = "outline-section-heading";
  heading.append(spanText(title), spanText(String(thoughts.length)));
  const list = document.createElement("div");
  list.className = "outline-list";
  thoughts.forEach((thought) => {
    list.append(createOutlineThoughtRow(thought, 0));
  });
  section.append(heading, list);
  return section;
}

function createOutlineNodeElement(node, depth: number) {
  const item = document.createElement("div");
  item.className = "outline-node";
  item.append(createOutlineThoughtRow(node.thought, depth, node));
  if (node.children.length) {
    const children = document.createElement("div");
    children.className = "outline-children";
    node.children.forEach((child) => children.append(createOutlineNodeElement(child, depth + 1)));
    item.append(children);
  }
  return item;
}

function createOutlineThoughtRow(thought: Thought, depth: number, node = null) {
  const reference = Boolean(node?.reference);
  const row = document.createElement("button");
  row.className = `outline-row${thought.id === state.selectedId ? " active" : ""}${reference ? " reference" : ""}`;
  row.type = "button";
  row.style.setProperty("--outline-indent", `${10 + depth * 24}px`);
  row.addEventListener("click", () => selectThought(thought.id));

  const dot = document.createElement("span");
  dot.className = "thought-dot";
  dot.style.background = getKindDisplayColor(thought.kind);

  const copy = document.createElement("span");
  copy.className = "outline-row-copy";
  const title = document.createElement("span");
  title.className = "outline-row-title";
  title.textContent = thought.title;
  const meta = document.createElement("span");
  meta.className = "outline-row-meta";
  meta.textContent = getOutlineMeta(thought, node?.referenceText || "");
  copy.append(title, meta);

  const count = document.createElement("span");
  count.className = "outline-row-count";
  const childCount = getChildThoughts(thought.id).length;
  count.textContent = !reference && childCount ? String(childCount) : "";
  count.setAttribute("aria-hidden", "true");

  row.append(dot, copy, count);
  return row;
}

function getOutlineMeta(thought: Thought, referenceText = "") {
  const parts = [getKindName(thought.kind)];
  if (thought.tags[0]) parts.push(`#${thought.tags[0]}`);
  const relatedCount = getRelatedThoughts(thought.id).length;
  if (relatedCount) parts.push(`${relatedCount} beside`);
  if (isInboxThought(thought.id)) parts.push("inbox");
  if (referenceText) parts.push(referenceText);
  return parts.join(" · ");
}

function outlineEmptyState(message: string) {
  const empty = document.createElement("div");
  empty.className = "outline-empty";
  empty.textContent = message;
  return empty;
}

function renderWalk() {
  if (stageView !== "walk") return;
  const path = getWalkPath();
  const selected = state.selectedId ? getThought(state.selectedId) : null;
  const active = selected && path.some((thought) => thought.id === selected.id)
    ? selected
    : path[0] || null;
  if (active && active.id !== state.selectedId) {
    state.selectedId = active.id;
    renderThoughtList();
    renderDetails();
    persistState();
  }
  const activeIndex = active ? path.findIndex((thought) => thought.id === active.id) : -1;
  els.walkTitle.textContent = active?.title || "No thoughts yet";
  els.walkProgress.textContent = active ? `${activeIndex + 1} of ${path.length}` : "0 of 0";
  els.walkMeta.textContent = active
    ? [getKindName(active.kind), active.tags.map((tag) => `#${tag}`).join(" "), getConnections(active.id).length ? `${getConnections(active.id).length} connected` : ""]
      .filter(Boolean)
      .join(" · ")
    : "";
  els.walkNote.innerHTML = active?.note?.trim()
    ? renderMarkdown(active.note, getThoughtByTitle)
    : '<p class="note-empty">No note yet.</p>';
  els.walkContext.replaceChildren(...(active ? createWalkContextButtons(active) : []));
  els.walkPrevButton.disabled = activeIndex <= 0;
  els.walkNextButton.disabled = activeIndex < 0 || activeIndex >= path.length - 1;
  els.walkMapButton.disabled = !active;
}

function getWalkPath(): Thought[] {
  const graphThoughts = getGraphThoughts();
  if (!graphThoughts.length) return getInboxThoughts().slice().sort(compareThoughtsByTitle);
  const selected = state.selectedId ? getThought(state.selectedId) : null;
  const start = selected && !isInboxThought(selected.id)
    ? selected
    : getOutlineRoots(graphThoughts.slice().sort(compareThoughtsByTitle))[0] || graphThoughts[0];
  const path: Thought[] = [];
  const visited = new Set<string>();
  const walk = (thought: Thought) => {
    if (!thought || visited.has(thought.id)) return;
    visited.add(thought.id);
    path.push(thought);
    getChildThoughts(thought.id)
      .slice()
      .sort(compareThoughtsByTitle)
      .forEach(walk);
  };
  walk(start);
  graphThoughts
    .slice()
    .sort(compareThoughtsByTitle)
    .forEach(walk);
  return path;
}

function createWalkContextButtons(active: Thought): HTMLElement[] {
  const groups = [
    ["Above", getParentThoughts(active.id)],
    ["Below", getChildThoughts(active.id)],
    ["Beside", getRelatedThoughts(active.id)],
  ] as [string, Thought[]][];
  return groups.flatMap(([label, thoughts]) => thoughts.slice().sort(compareThoughtsByTitle).map((thought) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "walk-context-item";
    button.addEventListener("click", () => {
      selectThought(thought.id, { center: false });
      renderWalk();
    });
    const dot = document.createElement("span");
    dot.className = "thought-dot";
    dot.style.background = getKindDisplayColor(thought.kind);
    const title = document.createElement("span");
    title.textContent = thought.title;
    const badge = document.createElement("span");
    badge.className = "relation-badge";
    badge.textContent = label;
    button.append(dot, title, badge);
    return button;
  }));
}

function previousWalkThought() {
  moveWalkThought(-1);
}

function nextWalkThought() {
  moveWalkThought(1);
}

function moveWalkThought(direction: number) {
  const path = getWalkPath();
  if (!path.length) return;
  const index = Math.max(0, path.findIndex((thought) => thought.id === state.selectedId));
  const next = path[clamp(index + direction, 0, path.length - 1)];
  if (!next) return;
  selectThought(next.id, { center: false });
  renderWalk();
}

function showWalkThoughtOnMap() {
  if (!state.selectedId) return;
  setStageView("map");
  centerSelected();
}

function spanText(text: string) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function compareThoughtsByTitle(a: Thought, b: Thought) {
  return a.title.localeCompare(b.title);
}

function setDetailsTab(tab: DetailsTabId) {
  activeDetailsTab = tab;
  renderDetailsTabs();
}

function renderDetailsTabs() {
  const tabs: { id: DetailsTabId; button: HTMLButtonElement; panel: HTMLElement }[] = [
    { id: "details", button: els.detailsTabDetails, panel: els.detailsTabPanelDetails },
    { id: "notes", button: els.detailsTabNotes, panel: els.detailsTabPanelNotes },
    { id: "links", button: els.detailsTabLinks, panel: els.detailsTabPanelLinks },
    { id: "sources", button: els.detailsTabSources, panel: els.detailsTabPanelSources },
  ];
  tabs.forEach(({ id, button, panel }) => {
    const active = id === activeDetailsTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = 0;
    panel.hidden = !active;
  });
}

function updateSelectedNote(value: string, source: "compact" | "workspace", caretOffset?: number) {
  const selected = getSelectedThought();
  if (!selected) return;
  pushHistory();
  selected.note = value;
  touchThought(selected);
  if (source !== "compact") {
    els.noteInput.value = value;
    showNotePreview(value);
  }
  if (source === "workspace") {
    setLiveEditorMarkdown(value);
    if (caretOffset !== undefined) setLiveEditorCaretOffset(caretOffset);
  } else if (document.activeElement !== els.noteWorkspaceInput) {
    setLiveEditorMarkdown(value);
  }
  renderThoughtList();
  renderMentionPanels(selected);
  persistState();
}

function touchThought(thought: Thought) {
  thought.updatedAt = new Date().toISOString();
}

function openNoteWorkspace() {
  const selected = getSelectedThought();
  if (!selected) {
    setStatus("Select a thought first");
    return;
  }
  noteWorkspaceOpen = true;
  closeContextMenu();
  closeMoreMenu();
  closeMobileCapture();
  renderNoteWorkspace();
  requestAnimationFrame(() => {
    els.noteWorkspaceInput.focus();
    setLiveEditorCaretOffset(selected.note.length);
  });
}

function closeNoteWorkspace() {
  if (!noteWorkspaceOpen) return;
  noteWorkspaceOpen = false;
  renderNoteWorkspace();
}

function renderNoteWorkspace() {
  const selected = getSelectedThought();
  const open = noteWorkspaceOpen && Boolean(selected);
  if (noteWorkspaceOpen && !selected) noteWorkspaceOpen = false;
  els.noteWorkspace.hidden = !open;
  document.body.classList.toggle("note-workspace-open", open);
  if (!selected || !open) return;
  els.noteWorkspaceTitle.textContent = selected.title || "Untitled";
  if (document.activeElement !== els.noteWorkspaceInput) {
    setLiveEditorMarkdown(selected.note);
  }
}

function insertLiveEditorText(text: string) {
  const selection = getLiveEditorSelectionOffsets();
  const value = getLiveEditorMarkdown();
  const normalizedText = String(text || "").replace(/\r\n?/g, "\n");
  const nextValue = `${value.slice(0, selection.start)}${normalizedText}${value.slice(selection.end)}`;
  updateSelectedNote(nextValue, "workspace", selection.start + normalizedText.length);
}

function setLiveEditorMarkdown(value: string) {
  const normalized = String(value || "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const fragment = document.createDocumentFragment();
  (lines.length ? lines : [""]).forEach((line) => fragment.append(createLiveEditorLine(line)));
  els.noteWorkspaceInput.replaceChildren(fragment);
  els.noteWorkspaceInput.classList.toggle("empty", !normalized.trim());
}

function createLiveEditorLine(text: string): HTMLElement {
  const line = document.createElement("div");
  line.className = `note-live-line ${getLiveEditorLineClass(text)}`.trim();
  if (text) {
    line.append(renderLiveEditorLineContent(text));
  } else {
    line.append(document.createElement("br"));
  }
  return line;
}

function getLiveEditorLineClass(text: string): string {
  const line = String(text || "").replace(/\u00a0/g, " ");
  const heading = line.match(/^(#{1,6})\s/);
  if (heading) return `heading heading-${heading[1].length}`;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) return "rule";
  if (/^\s*>\s?/.test(line)) return "quote";
  const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+/);
  if (task) return `task${task[1].toLowerCase() === "x" ? " checked" : ""}`;
  if (/^\s*\d+\.\s+/.test(line)) return "ordered-list";
  if (/^\s*[-*+]\s+/.test(line)) return "unordered-list";
  if (/^```/.test(line.trim())) return "code-fence";
  return "";
}

function renderLiveEditorLineContent(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const line = String(text || "").replace(/\u00a0/g, " ");

  const heading = line.match(/^(#{1,6})(\s+)(.*)$/);
  if (heading) {
    appendLiveToken(fragment, `${heading[1]}${heading[2]}`, "heading-token");
    appendLiveInlineMarkdown(fragment, heading[3]);
    return fragment;
  }

  if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
    appendLiveToken(fragment, line, "rule-token");
    return fragment;
  }

  const task = line.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
  if (task) {
    appendLiveToken(fragment, task[1], "prefix task-prefix");
    appendLiveInlineContainer(fragment, task[2]);
    return fragment;
  }

  const ordered = line.match(/^(\s*\d+\.\s+)(.*)$/);
  if (ordered) {
    appendLiveToken(fragment, ordered[1], "prefix ordered-prefix");
    appendLiveInlineContainer(fragment, ordered[2]);
    return fragment;
  }

  const unordered = line.match(/^(\s*[-*+]\s+)(.*)$/);
  if (unordered) {
    appendLiveToken(fragment, unordered[1], "prefix unordered-prefix");
    appendLiveInlineContainer(fragment, unordered[2]);
    return fragment;
  }

  const quote = line.match(/^(\s*>\s?)(.*)$/);
  if (quote) {
    appendLiveToken(fragment, quote[1], "prefix quote-prefix");
    appendLiveInlineContainer(fragment, quote[2]);
    return fragment;
  }

  const codeFence = line.match(/^(\s*```)(.*)$/);
  if (codeFence) {
    appendLiveToken(fragment, codeFence[1], "code-fence-token");
    appendLiveInlineMarkdown(fragment, codeFence[2]);
    return fragment;
  }

  appendLiveInlineMarkdown(fragment, line);
  return fragment;
}

function appendLiveInlineContainer(parent: Node, text: string) {
  const content = document.createElement("span");
  content.className = "note-live-content";
  appendLiveInlineMarkdown(content, text);
  parent.appendChild(content);
}

function appendLiveInlineMarkdown(parent: Node, text: string) {
  const source = String(text || "");
  const pattern = /(\[\[[^\]]+\]\]|`[^`]+`|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^) \t\n]+\)|\*[^*]+\*|_[^_]+_)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      parent.appendChild(document.createTextNode(source.slice(cursor, match.index)));
    }
    appendLiveInlineToken(parent, match[0]);
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    parent.appendChild(document.createTextNode(source.slice(cursor)));
  }
}

function appendLiveInlineToken(parent: Node, token: string) {
  if (token.startsWith("[[") && token.endsWith("]]")) {
    const label = token.slice(2, -2);
    appendLiveToken(parent, "[[", "inline-token");
    appendLiveStyledText(parent, label, getThoughtByTitle(label) ? "mention" : "mention missing");
    appendLiveToken(parent, "]]", "inline-token");
    return;
  }

  if (token.startsWith("`") && token.endsWith("`")) {
    appendLiveToken(parent, "`", "inline-token");
    appendLiveStyledText(parent, token.slice(1, -1), "code");
    appendLiveToken(parent, "`", "inline-token");
    return;
  }

  if ((token.startsWith("***") && token.endsWith("***")) || (token.startsWith("___") && token.endsWith("___"))) {
    appendLiveToken(parent, token.slice(0, 3), "inline-token");
    appendLiveStyledText(parent, token.slice(3, -3), "bold italic");
    appendLiveToken(parent, token.slice(-3), "inline-token");
    return;
  }

  if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
    appendLiveToken(parent, token.slice(0, 2), "inline-token");
    appendLiveStyledText(parent, token.slice(2, -2), "bold");
    appendLiveToken(parent, token.slice(-2), "inline-token");
    return;
  }

  if (token.startsWith("~~") && token.endsWith("~~")) {
    appendLiveToken(parent, "~~", "inline-token");
    appendLiveStyledText(parent, token.slice(2, -2), "strike");
    appendLiveToken(parent, "~~", "inline-token");
    return;
  }

  const link = token.match(/^\[([^\]]+)\]\(([^) \t\n]+)\)$/);
  if (link) {
    appendLiveToken(parent, "[", "inline-token");
    appendLiveStyledText(parent, link[1], "link");
    appendLiveToken(parent, `](${link[2]})`, "inline-token");
    return;
  }

  if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
    appendLiveToken(parent, token[0], "inline-token");
    appendLiveStyledText(parent, token.slice(1, -1), "italic");
    appendLiveToken(parent, token.slice(-1), "inline-token");
    return;
  }

  parent.appendChild(document.createTextNode(token));
}

function appendLiveToken(parent: Node, text: string, className = "") {
  const token = document.createElement("span");
  token.className = `note-live-token ${className}`.trim();
  token.textContent = text;
  parent.appendChild(token);
}

function appendLiveStyledText(parent: Node, text: string, className: string) {
  const span = document.createElement("span");
  span.className = `note-live-styled ${className}`.trim();
  span.textContent = text;
  parent.appendChild(span);
}

function getLiveEditorLines(): HTMLElement[] {
  return [...els.noteWorkspaceInput.querySelectorAll<HTMLElement>(".note-live-line")];
}

function getLiveLineText(line: HTMLElement): string {
  return (line.textContent || "").replace(/\u00a0/g, " ");
}

function getLiveEditorMarkdown(): string {
  const lines = getLiveEditorLines();
  if (lines.length) return lines.map(getLiveLineText).join("\n");
  return (els.noteWorkspaceInput.textContent || "").replace(/\r\n?/g, "\n");
}

function getLiveEditorSelectionOffsets(): { start: number; end: number } {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode || !selection.focusNode) {
    const end = getLiveEditorMarkdown().length;
    return { start: end, end };
  }
  if (!els.noteWorkspaceInput.contains(selection.anchorNode) || !els.noteWorkspaceInput.contains(selection.focusNode)) {
    const end = getLiveEditorMarkdown().length;
    return { start: end, end };
  }
  const anchor = getLiveEditorOffsetForNode(selection.anchorNode, selection.anchorOffset);
  const focus = getLiveEditorOffsetForNode(selection.focusNode, selection.focusOffset);
  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
  };
}

function getLiveEditorCaretOffset(): number {
  return getLiveEditorSelectionOffsets().end;
}

function getLiveEditorOffsetForNode(node: Node, nodeOffset: number): number {
  const lines = getLiveEditorLines();
  const line = getLiveEditorLineFromNode(node);
  const lineIndex = line ? lines.indexOf(line) : -1;
  if (!line || lineIndex < 0) return getLiveEditorMarkdown().length;
  const previousOffset = lines
    .slice(0, lineIndex)
    .reduce((total, item) => total + getLiveLineText(item).length + 1, 0);

  try {
    const range = document.createRange();
    range.selectNodeContents(line);
    range.setEnd(node, nodeOffset);
    return previousOffset + range.toString().length;
  } catch {
    return previousOffset + getLiveLineText(line).length;
  }
}

function getLiveEditorLineFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest(".note-live-line") as HTMLElement | null;
}

function setLiveEditorCaretOffset(offset: number) {
  const lines = getLiveEditorLines();
  if (!lines.length) return;
  let remaining = clamp(offset, 0, getLiveEditorMarkdown().length);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const text = getLiveLineText(line);
    if (remaining <= text.length || index === lines.length - 1) {
      setCaretInLiveEditorLine(line, remaining);
      return;
    }
    remaining -= text.length + 1;
  }
}

function setCaretInLiveEditorLine(line: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();

  const targetOffset = clamp(offset, 0, getLiveLineText(line).length);
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let remaining = targetOffset;
  let lastTextNode: Text | null = null;
  let current = walker.nextNode() as Text | null;

  while (current) {
    lastTextNode = current;
    if (remaining <= current.data.length) {
      range.setStart(current, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= current.data.length;
    current = walker.nextNode() as Text | null;
  }

  if (lastTextNode) {
    range.setStart(lastTextNode, lastTextNode.data.length);
  } else {
    range.setStart(line, 0);
  }

  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderKindInspector(selected) {
  const options = state.kinds.map((kind) => optionElement(kind.id, kind.name));
  const divider = optionElement("", "──────────");
  divider.disabled = true;
  els.kindInput.replaceChildren(...options, divider, optionElement(NEW_KIND_VALUE, "+ New type"));
  els.kindInput.value = selected.kind;
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
    createHandlePreview,
    hoverThoughtId,
    selectedLinkId,
    getVisualPositions,
    getGraphFocusId,
    getDirectFocusFamilyIds,
    getSecondaryFocusFamilyIds,
    getFocusFamilyIds,
    getCalmDepthStyles,
    getPreviewFamilyIds,
    getGraphRenderThought,
    getGraphRenderThoughts,
    getGraphRenderNodeBox,
    getLinkDirectionText,
    getKindName,
    getKindColor: getKindDisplayColor,
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
  const defaultX = selected ? selected.x + Math.cos(angle) * 150 : (inboxIndex % 4) * 170 - 255;
  const defaultY = selected ? selected.y + (relation === "child-of" ? -220 : 220) : Math.floor(inboxIndex / 4) * 120 + 260;
  const thought = {
    id: makeId("t"),
    title,
    kind: getDefaultKindId(),
    note: "",
    tags: [],
    attachments: [],
    updatedAt: new Date().toISOString(),
    x: options.position?.x ?? defaultX,
    y: options.position?.y ?? defaultY,
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
    renderOutline();
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
  renderOutline();
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
  renderOutline();
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
    renderStageView();
    renderOutline();
    renderNoteWorkspace();
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
    renderStageView();
    renderOutline();
    renderNoteWorkspace();
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

  if (isCalmMode()) {
    arrangeCalmDepthContext(
      positions,
      selected.id,
      new Set([selected.id, ...parents.map((thought) => thought.id), ...children.map((thought) => thought.id), ...related.map((thought) => thought.id)]),
      {
        verticalGap: isMobileLayout() ? 118 : 142,
        sideGap: Math.max(48, sideGap * 0.72),
        rowGap: isMobileLayout() ? 20 : 28,
        selectedX: selected.x,
      },
    );
  } else {
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

function arrangeCalmDepthContext(
  positions: PositionMap,
  selectedId: string,
  arrangedIds: Set<string>,
  options: CalmDepthLayoutOptions,
): void {
  const graphIds = new Set(getGraphThoughts().map((thought) => thought.id));
  if (!graphIds.has(selectedId)) return;

  const queue = [selectedId, ...[...arrangedIds].filter((id) => id !== selectedId)];
  const queuedIds = new Set(queue);
  const depthById = new Map<string, number>([[selectedId, 0]]);
  arrangedIds.forEach((id) => {
    if (id !== selectedId) depthById.set(id, 1);
  });

  const takeUnarranged = (thoughts: Thought[]): Thought[] =>
    uniqueThoughts(thoughts).filter((thought) => graphIds.has(thought.id) && !arrangedIds.has(thought.id));
  const enqueue = (thoughts: Thought[], depth: number): void => {
    thoughts.forEach((thought) => {
      arrangedIds.add(thought.id);
      depthById.set(thought.id, depth);
      if (queuedIds.has(thought.id)) return;
      queue.push(thought.id);
      queuedIds.add(thought.id);
    });
  };

  for (let index = 0; index < queue.length; index += 1) {
    const anchorId = queue[index];
    const anchor = getThought(anchorId);
    const anchorPosition = positions.get(anchorId) || anchor;
    if (!anchor || !anchorPosition) continue;

    const anchorDepth = depthById.get(anchorId) ?? 0;
    const nextDepth = anchorDepth + 1;
    const verticalGap = getCalmLayoutGap(nextDepth, options.verticalGap);
    const sideGap = getCalmLayoutGap(nextDepth, options.sideGap);
    const anchorBox = getNodeBox(anchorId);

    const parents = takeUnarranged(getParentThoughts(anchorId));
    arrangeHorizontalThoughtRow(positions, parents, anchorPosition.x, anchorPosition.y - verticalGap, getNodeBox, { gap: options.rowGap });
    enqueue(parents, nextDepth);

    const children = takeUnarranged(getChildThoughts(anchorId));
    arrangeHorizontalThoughtRow(positions, children, anchorPosition.x, anchorPosition.y + verticalGap, getNodeBox, { gap: options.rowGap });
    enqueue(children, nextDepth);

    const related = takeUnarranged(getRelatedThoughts(anchorId));
    const side = anchorPosition.x < options.selectedX ? "left" : "right";
    const edgeX = side === "left"
      ? anchorPosition.x - anchorBox.width / 2 - sideGap
      : anchorPosition.x + anchorBox.width / 2 + sideGap;
    arrangeVerticalThoughtColumn(positions, related, edgeX, anchorPosition.y, getNodeBox, {
      gap: options.rowGap,
      side,
    });
    enqueue(related, nextDepth);
  }
}

function getCalmLayoutGap(depth: number, baseGap: number): number {
  return Math.max(baseGap * 0.68, baseGap * getCalmDepthStyle(depth).scale);
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

function getCalmDepthStyles(id: string | null): Map<string, GraphDepthStyle> {
  const styles = new Map<string, GraphDepthStyle>();
  if (!isCalmMode() || !id || isInboxThought(id)) return styles;

  const graphIds = new Set(getGraphThoughts().map((thought) => thought.id));
  if (!graphIds.has(id)) return styles;

  const neighbours = new Map<string, string[]>();
  graphIds.forEach((thoughtId) => neighbours.set(thoughtId, []));
  state.links.forEach((link) => {
    if (!graphIds.has(link.from) || !graphIds.has(link.to)) return;
    neighbours.get(link.from)?.push(link.to);
    neighbours.get(link.to)?.push(link.from);
  });

  const distances = new Map<string, number>([[id, 0]]);
  const queue = [id];
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    const currentDistance = distances.get(currentId) ?? 0;
    neighbours.get(currentId)?.forEach((nextId) => {
      if (distances.has(nextId)) return;
      distances.set(nextId, currentDistance + 1);
      queue.push(nextId);
    });
  }

  distances.forEach((distance, thoughtId) => {
    styles.set(thoughtId, getCalmDepthStyle(distance));
  });
  return styles;
}

function getCalmDepthStyle(distance: number): GraphDepthStyle {
  const level = distance <= 1 ? 1 : Math.min(distance, CALM_DEPTH_STYLES.length);
  return CALM_DEPTH_STYLES[level - 1] || CALM_DEPTH_STYLES[CALM_DEPTH_STYLES.length - 1];
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
  return true;
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

function getKindDisplayColor(id) {
  const color = getKindColor(id);
  return isEinkTheme() ? getEinkKindColor(color, state.settings.theme) : color;
}

function isEinkTheme() {
  return state.settings.background === "eink";
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
  const kind = addKind(name, getNextKindColor(), { select: false });
  if (!kind) return null;
  if (options.assignToThoughtId) {
    const thought = getThought(options.assignToThoughtId);
    if (thought && thought.kind !== kind.id) {
      if (state.kinds.length === kindCount) pushHistory();
      thought.kind = kind.id;
      touchThought(thought);
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
  state.thoughts.filter((thought) => thought.kind === id).forEach(touchThought);
  render();
  persistState();
}

function updateKindColor(id, color) {
  const kind = getKindDefinition(id);
  const nextColor = sanitizeKindColor(color, kind?.color);
  if (!kind || kind.color === nextColor) return;
  pushHistory();
  kind.color = nextColor;
  state.thoughts.filter((thought) => thought.kind === id).forEach(touchThought);
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
    if (thought.kind === id) {
      thought.kind = fallback.id;
      touchThought(thought);
    }
  });
  render();
  persistState();
}

function getAllTags() {
  return [...new Set(state.thoughts.flatMap((thought) => thought.tags || []))].sort((a, b) => a.localeCompare(b));
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

function getEinkKindColor(color, theme) {
  const { h, s, l } = hexToHsl(sanitizeKindColor(color));
  const dark = theme === "dark";
  const saturation = clamp(s * (dark ? 0.22 : 0.28) + (dark ? 3 : 4), 0, dark ? 16 : 20);
  const lightness = dark
    ? clamp(l * 0.35 + 49, 62, 76)
    : clamp(l * 0.32 + 28, 41, 55);
  return hslToHex(h, saturation, lightness);
}

function hexToHsl(color) {
  const value = Number.parseInt(color.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  if (max === g) h = (b - r) / d + 2;
  if (max === b) h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  const normalizedS = s / 100;
  const normalizedL = l / 100;
  const c = (1 - Math.abs(2 * normalizedL - 1)) * normalizedS;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = normalizedL - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return `#${toHexPair((r + m) * 255)}${toHexPair((g + m) * 255)}${toHexPair((b + m) * 255)}`;
}

function toHexPair(value) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
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
  const item = getCurrentReviewItem();
  const current = item?.thought || null;
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
    : item?.note || "Choose a thought to connect.";
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

function openInboxReview(mode: ReviewModeId = reviewMode) {
  inboxReviewOpen = true;
  reviewMode = mode;
  inboxReviewIndex = clamp(inboxReviewIndex, 0, Math.max(getReviewItems().length - 1, 0));
  renderInboxReview();
  renderThoughtList();
}

function closeInboxReview() {
  if (!inboxReviewOpen) return;
  inboxReviewOpen = false;
  renderInboxReview();
  renderThoughtList();
}

function getCurrentReviewItem(): ReviewItem | null {
  const items = getReviewItems();
  if (!items.length) return null;
  inboxReviewIndex = clamp(inboxReviewIndex, 0, items.length - 1);
  return items[inboxReviewIndex];
}

function getCurrentInboxReviewThought() {
  return getCurrentReviewItem()?.thought || null;
}

function renderInboxReview() {
  els.inboxReviewPanel.hidden = !inboxReviewOpen;
  if (!inboxReviewOpen) return;

  els.reviewModeInput.value = reviewMode;
  const items = getReviewItems();
  const item = getCurrentReviewItem();
  const current = item?.thought || null;
  const candidates = state.thoughts.filter((thought) => thought.id !== current?.id);
  const targetId = els.inboxReviewTargetInput.value;
  els.inboxReviewProgress.textContent = items.length
    ? `${inboxReviewIndex + 1} of ${items.length} ${getReviewModeLabel(reviewMode).toLowerCase()}`
    : `No ${getReviewModeLabel(reviewMode).toLowerCase()}.`;
  els.inboxReviewTitle.textContent = item?.title || "Review clear";
  els.inboxReviewNote.textContent = item?.note || "Nothing needs attention in this queue.";
  els.inboxReviewTargetInput.replaceChildren(
    ...candidates.map((thought) => optionElement(thought.id, thought.title)),
  );
  if (candidates.some((thought) => thought.id === targetId)) els.inboxReviewTargetInput.value = targetId;
  const placementMode = reviewMode === "unplaced" || reviewMode === "orphaned";
  const disabled = !current || !candidates.length || !placementMode;
  const targetLabel = els.inboxReviewTargetInput.closest("label") as HTMLElement | null;
  if (targetLabel) targetLabel.hidden = !placementMode;
  [els.inboxReviewTargetInput, els.inboxReviewChildButton, els.inboxReviewParentButton, els.inboxReviewRelatedButton].forEach((element) => {
    element.disabled = disabled;
    element.hidden = !placementMode;
  });
  els.reviewOpenNoteButton.hidden = placementMode;
  els.reviewOpenNoteButton.disabled = !current;
  els.reviewFixButton.hidden = reviewMode !== "missing-mentions";
  els.reviewFixButton.disabled = !item?.missingTitle;
  els.inboxReviewPrevButton.disabled = items.length < 2;
  els.inboxReviewNextButton.disabled = items.length < 2;
  els.inboxReviewKeepButton.disabled = !current;
  renderInboxReviewPreview();
}

function onReviewModeChange() {
  reviewMode = els.reviewModeInput.value as ReviewModeId;
  inboxReviewIndex = 0;
  renderInboxReview();
}

function getFirstPopulatedReviewMode(): ReviewModeId {
  const modes: ReviewModeId[] = ["unplaced", "orphaned", "missing-mentions", "open-questions", "stale-notes", "unchecked-tasks"];
  return modes.find((mode) => getReviewItems(mode).length) || "unplaced";
}

function getReviewModeLabel(mode: ReviewModeId): string {
  const labels: Record<ReviewModeId, string> = {
    unplaced: "Unplaced thoughts",
    orphaned: "Orphaned thoughts",
    "missing-mentions": "Missing mentions",
    "open-questions": "Open questions",
    "stale-notes": "Stale notes",
    "unchecked-tasks": "Unchecked tasks",
  };
  return labels[mode];
}

function getReviewItems(mode: ReviewModeId = reviewMode): ReviewItem[] {
  if (mode === "unplaced") {
    return getInboxThoughts().slice().sort(compareThoughtsByTitle).map((thought) => ({
      id: thought.id,
      thought,
      title: thought.title,
      note: thought.note.trim() || "Captured thoughts stay here until they are connected.",
      mode,
    }));
  }

  if (mode === "orphaned") {
    const graphThoughts = getGraphThoughts();
    const rootId = getOutlineRoots(graphThoughts)[0]?.id || "";
    return graphThoughts
      .filter((thought) => thought.id !== rootId && !getParentThoughts(thought.id).length)
      .sort(compareThoughtsByTitle)
      .map((thought) => ({
        id: thought.id,
        thought,
        title: thought.title,
        note: "This thought has no parent. Place it under another thought or connect it beside a peer.",
        mode,
      }));
  }

  if (mode === "missing-mentions") {
    return state.thoughts.flatMap((thought) => {
      const missing = getMentionTitles(thought.note).filter((title) => !getThoughtByTitle(title));
      return [...new Set(missing)].map((missingTitle) => ({
        id: `${thought.id}:${missingTitle}`,
        thought,
        title: `${thought.title} mentions [[${missingTitle}]]`,
        note: `Missing thought: ${missingTitle}`,
        mode,
        missingTitle,
      }));
    }).sort((a, b) => a.title.localeCompare(b.title));
  }

  if (mode === "open-questions") {
    return state.thoughts
      .filter((thought) => thought.kind === "question" || thought.tags.includes("question") || thought.tags.includes("open-question") || /\?/.test(`${thought.title} ${thought.note}`))
      .sort(compareThoughtsByTitle)
      .map((thought) => ({
        id: thought.id,
        thought,
        title: thought.title,
        note: thought.note.trim() || "Question thought without supporting notes yet.",
        mode,
      }));
  }

  if (mode === "stale-notes") {
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    return state.thoughts
      .filter((thought) => thought.note.trim() && Date.parse(thought.updatedAt || "") < cutoff)
      .sort((a, b) => Date.parse(a.updatedAt || "") - Date.parse(b.updatedAt || ""))
      .map((thought) => ({
        id: thought.id,
        thought,
        title: thought.title,
        note: `Last edited ${formatDate(thought.updatedAt)}.`,
        mode,
      }));
  }

  return state.thoughts
    .filter((thought) => /(^|\n)\s*[-*+]\s+\[\s\]\s+/.test(thought.note))
    .sort(compareThoughtsByTitle)
    .map((thought) => ({
      id: thought.id,
      thought,
      title: thought.title,
      note: "This note has unchecked tasks.",
      mode,
    }));
}

function openReviewNote() {
  const item = getCurrentReviewItem();
  if (!item) return;
  selectThought(item.thought.id, { center: false });
  setDetailsTab("notes");
  openNoteWorkspace();
}

function fixCurrentReviewItem() {
  const item = getCurrentReviewItem();
  if (!item?.missingTitle) {
    openReviewNote();
    return;
  }
  selectThought(item.thought.id, { center: false });
  addThought(item.missingTitle, item.thought.id, "related", { note: `Created from [[${item.missingTitle}]] mention in ${item.thought.title}.` });
  inboxReviewIndex = Math.min(inboxReviewIndex, Math.max(getReviewItems().length - 1, 0));
  renderInboxReview();
  setStatus("Mention thought created");
}

function formatDate(value: string | undefined): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "an unknown date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function previousInboxReviewThought() {
  moveInboxReviewThought(-1);
}

function nextInboxReviewThought() {
  moveInboxReviewThought(1);
}

function moveInboxReviewThought(direction: number) {
  const items = getReviewItems();
  if (items.length < 2) return;
  inboxReviewIndex = (inboxReviewIndex + direction + items.length) % items.length;
  renderInboxReview();
}

function placeInboxReviewThought(relation) {
  const current = getCurrentReviewItem()?.thought || null;
  const targetId = els.inboxReviewTargetInput.value;
  if (!current || !targetId) return;
  selectThought(current.id, { center: false });
  addLink(current.id, targetId, relation);
  inboxReviewIndex = Math.min(inboxReviewIndex, Math.max(getReviewItems().length - 1, 0));
  renderInboxReview();
  setStatus("Thought placed");
}

function keepInboxReviewThought() {
  const items = getReviewItems();
  if (!items.length) return;
  inboxReviewIndex = (inboxReviewIndex + 1) % items.length;
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

function openCommandPalette(mode: CommandPaletteMode = "root") {
  commandPaletteOpen = true;
  commandPaletteMode = mode;
  commandPaletteActiveIndex = 0;
  els.commandPaletteInput.value = "";
  closeContextMenu();
  closeMoreMenu();
  closeMobileCapture();
  renderCommandPalette();
  requestAnimationFrame(() => els.commandPaletteInput.focus());
}

function closeCommandPalette() {
  if (!commandPaletteOpen) return;
  commandPaletteOpen = false;
  commandPaletteMode = "root";
  renderCommandPalette();
}

function renderCommandPalette() {
  els.commandPalette.hidden = !commandPaletteOpen;
  if (!commandPaletteOpen) return;
  const items = getCommandPaletteItems();
  commandPaletteActiveIndex = clamp(commandPaletteActiveIndex, 0, Math.max(items.length - 1, 0));
  els.commandPaletteInput.placeholder = getCommandPalettePlaceholder();
  els.commandPaletteHint.textContent = getCommandPaletteHint();
  els.commandPaletteList.replaceChildren(
    ...(items.length ? items.map((item, index) => createCommandPaletteRow(item, index)) : [emptyListMessage("No matches")]),
  );
}

function createCommandPaletteRow(item: CommandPaletteItem, index: number): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `command-palette-row${index === commandPaletteActiveIndex ? " active" : ""}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(index === commandPaletteActiveIndex));
  button.addEventListener("mouseenter", () => {
    commandPaletteActiveIndex = index;
    renderCommandPalette();
  });
  button.addEventListener("click", item.action);
  const title = document.createElement("span");
  title.textContent = item.title;
  const meta = document.createElement("small");
  meta.textContent = item.meta;
  button.append(title, meta);
  return button;
}

function onCommandPaletteKeydown(event: KeyboardEvent) {
  const items = getCommandPaletteItems();
  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
    return;
  }
  if (event.key === "Backspace" && commandPaletteMode !== "root" && !els.commandPaletteInput.value) {
    event.preventDefault();
    commandPaletteMode = "root";
    commandPaletteActiveIndex = 0;
    renderCommandPalette();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    commandPaletteActiveIndex = items.length ? (commandPaletteActiveIndex + 1) % items.length : 0;
    renderCommandPalette();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    commandPaletteActiveIndex = items.length ? (commandPaletteActiveIndex - 1 + items.length) % items.length : 0;
    renderCommandPalette();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    items[commandPaletteActiveIndex]?.action();
  }
}

function getCommandPaletteItems(): CommandPaletteItem[] {
  const query = els.commandPaletteInput.value.trim();
  if (commandPaletteMode === "create") {
    return query
      ? [{ id: "create", title: `Create "${query}"`, meta: state.selectedId ? "Connected below selected thought" : "Captured to inbox", action: () => runPaletteAction(() => { addThought(query); }) }]
      : [];
  }
  if (commandPaletteMode === "connect") {
    const selected = getSelectedThought();
    return selected
      ? filterPaletteItems(state.thoughts
        .filter((thought) => thought.id !== selected.id)
        .sort(compareThoughtsByTitle)
        .map((thought) => ({
          id: thought.id,
          title: thought.title,
          meta: "Connect beside selected thought",
          action: () => runPaletteAction(() => addLink(selected.id, thought.id, "related")),
        })), query)
      : [{ id: "no-selection", title: "Select a thought first", meta: "Connect needs an active thought", action: () => undefined }];
  }
  if (commandPaletteMode === "jump") {
    return getJumpCommandItems(query);
  }
  if (commandPaletteMode === "tag") {
    const selected = getSelectedThought();
    const tags = query ? normalizeTags(query) : [];
    const existingTags = getAllTags().map((tag) => ({
      id: tag,
      title: `#${tag}`,
      meta: selected?.tags.includes(tag) ? "Already on selected thought" : "Add tag",
      action: () => runPaletteAction(() => addTagToSelected(tag)),
    }));
    const createTag = tags[0] && !getAllTags().includes(tags[0])
      ? [{ id: `new-${tags[0]}`, title: `Add #${tags[0]}`, meta: "New tag", action: () => runPaletteAction(() => addTagToSelected(tags[0])) }]
      : [];
    return selected ? [...createTag, ...filterPaletteItems(existingTags, query)] : [{ id: "no-selection", title: "Select a thought first", meta: "Tags apply to the active thought", action: () => undefined }];
  }
  if (commandPaletteMode === "export") {
    return [
      { id: "backup", title: "Backup JSON", meta: "All projects and snapshots", action: () => runPaletteAction(exportMap) },
      { id: "markdown", title: "Export notes", meta: "Single Markdown document", action: () => runPaletteAction(exportMarkdown) },
      { id: "markdown-folder", title: "Markdown folder", meta: "One file per thought", action: () => runPaletteAction(exportMarkdownFolder) },
      { id: "opml", title: "Export OPML", meta: "Outline hierarchy", action: () => runPaletteAction(exportOpml) },
      { id: "canvas", title: "JSON Canvas", meta: "Obsidian-compatible canvas", action: () => runPaletteAction(exportJsonCanvas) },
      { id: "svg", title: "Export SVG", meta: "Visible map", action: () => runPaletteAction(exportSvg) },
      { id: "png", title: "Export PNG", meta: "Visible map", action: () => runPaletteAction(exportPng) },
    ];
  }

  const commands: CommandPaletteItem[] = [
    { id: "create", title: "Create thought", meta: "Enter a title", action: () => switchCommandPaletteMode("create") },
    { id: "connect", title: "Connect thought", meta: "Relate selected thought to another", action: () => switchCommandPaletteMode("connect") },
    { id: "jump", title: "Jump to thought", meta: "Search by title, note, or tag", action: () => switchCommandPaletteMode("jump") },
    { id: "tag", title: "Add tag", meta: "Apply to selected thought", action: () => switchCommandPaletteMode("tag") },
    { id: "note", title: "Open note", meta: "Focused writing surface", action: () => runPaletteAction(openNoteWorkspace) },
    { id: "export", title: "Export", meta: "JSON, Markdown, OPML, Canvas, SVG, PNG", action: () => switchCommandPaletteMode("export") },
    { id: "review", title: "Review thinking queues", meta: "Unplaced, mentions, questions, tasks", action: () => runPaletteAction(() => openInboxReview(getFirstPopulatedReviewMode())) },
    { id: "snapshots", title: "Snapshots", meta: "Create or restore named versions", action: () => runPaletteAction(openSnapshotPanel) },
  ];
  return [
    ...filterPaletteItems(commands, query),
    ...getJumpCommandItems(query).slice(0, query ? 8 : 4),
  ];
}

function getJumpCommandItems(query: string): CommandPaletteItem[] {
  return filterPaletteItems(state.thoughts.slice().sort(compareThoughtsByTitle).map((thought) => ({
    id: thought.id,
    title: thought.title,
    meta: [getKindName(thought.kind), thought.tags[0] ? `#${thought.tags[0]}` : "", isInboxThought(thought.id) ? "inbox" : ""].filter(Boolean).join(" · "),
    action: () => runPaletteAction(() => selectThought(thought.id)),
  })), query);
}

function filterPaletteItems(items: CommandPaletteItem[], query: string): CommandPaletteItem[] {
  const normalized = query.toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(normalized));
}

function switchCommandPaletteMode(mode: CommandPaletteMode) {
  commandPaletteMode = mode;
  commandPaletteActiveIndex = 0;
  els.commandPaletteInput.value = "";
  renderCommandPalette();
  requestAnimationFrame(() => els.commandPaletteInput.focus());
}

function runPaletteAction(action: () => void | Promise<void>) {
  closeCommandPalette();
  void action();
}

function addTagToSelected(tag: string) {
  const selected = getSelectedThought();
  const normalized = normalizeTags(tag)[0];
  if (!selected || !normalized || selected.tags.includes(normalized)) return;
  pushHistory();
  selected.tags = normalizeTags([...selected.tags, normalized]);
  touchThought(selected);
  render();
  persistState();
  setStatus("Tag added");
}

function getCommandPalettePlaceholder(): string {
  const placeholders: Record<CommandPaletteMode, string> = {
    root: "Create, connect, jump, tag, note, export...",
    create: "Thought title",
    connect: "Thought to connect",
    jump: "Thought to jump to",
    tag: "Tag to add",
    export: "Export format",
  };
  return placeholders[commandPaletteMode];
}

function getCommandPaletteHint(): string {
  if (commandPaletteMode === "root") return "Ctrl+P or Ctrl+/";
  return "Enter to run · Backspace to go back · Esc to close";
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

function renderAttachmentPanel(selected: Thought) {
  const attachments = selected.attachments || [];
  els.attachmentList.replaceChildren(
    ...(attachments.length
      ? attachments.map((attachment) => createAttachmentRow(selected, attachment))
      : [emptyListMessage("No sources yet")]),
  );
}

function createAttachmentRow(selected: Thought, attachment: ThoughtAttachment): HTMLElement {
  const item = document.createElement("div");
  item.className = "source-row";

  const copy = document.createElement("div");
  copy.className = "source-copy";
  const title = document.createElement(isSafeExternalRef(attachment.ref) ? "a" : "span");
  title.className = "source-title";
  title.textContent = attachment.title || attachment.ref;
  if (title instanceof HTMLAnchorElement) {
    title.href = attachment.ref;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
  }
  const meta = document.createElement("span");
  meta.textContent = `${attachment.kind === "file" ? "File" : "URL"} · ${attachment.ref}`;
  copy.append(title, meta);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => removeAttachment(selected.id, attachment.id));

  item.append(copy, removeButton);
  return item;
}

function onAttachmentSubmit(event: SubmitEvent) {
  event.preventDefault();
  const selected = getSelectedThought();
  const ref = els.attachmentRefInput.value.trim();
  if (!selected || !ref) return;
  pushHistory();
  const title = els.attachmentTitleInput.value.trim() || inferAttachmentTitle(ref);
  selected.attachments = [...(selected.attachments || []), {
    id: makeId("source"),
    kind: els.attachmentKindInput.value === "file" ? "file" : "url",
    title,
    ref,
    preview: "",
  }];
  touchThought(selected);
  els.attachmentTitleInput.value = "";
  els.attachmentRefInput.value = "";
  renderDetails();
  persistState();
  setStatus("Source added");
}

function removeAttachment(thoughtId: string, attachmentId: string) {
  const thought = getThought(thoughtId);
  if (!thought) return;
  pushHistory();
  thought.attachments = (thought.attachments || []).filter((attachment) => attachment.id !== attachmentId);
  touchThought(thought);
  renderDetails();
  persistState();
}

function inferAttachmentTitle(ref: string): string {
  try {
    const url = new URL(ref);
    return url.hostname.replace(/^www\./, "") || "Source link";
  } catch {
    const name = ref.replace(/\\/g, "/").split("/").filter(Boolean).pop();
    return name || "File reference";
  }
}

function isSafeExternalRef(ref: string): boolean {
  return /^(https?:|mailto:)/i.test(ref);
}

function emptyListMessage(message: string): HTMLElement {
  const empty = document.createElement("p");
  empty.className = "empty-inline";
  empty.textContent = message;
  return empty;
}

function createThoughtActionItem(thought, label, action, suggestion = false) {
  const item = document.createElement("button");
  item.className = `connection-item${suggestion ? " suggestion" : ""}`;
  item.type = "button";
  item.addEventListener("click", action);

  const dot = document.createElement("span");
  dot.className = "thought-dot";
  dot.style.background = getKindDisplayColor(thought.kind);
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

function openSnapshotPanel() {
  snapshotPanelOpen = true;
  closeMoreMenu();
  closeMobileCapture();
  renderSnapshotPanel();
  requestAnimationFrame(() => els.snapshotNameInput.focus());
}

function closeSnapshotPanel() {
  if (!snapshotPanelOpen) return;
  snapshotPanelOpen = false;
  renderSnapshotPanel();
}

function renderSnapshotPanel() {
  els.snapshotPanel.hidden = !snapshotPanelOpen;
  if (!snapshotPanelOpen) return;
  const snapshots = getSnapshots();
  if (!els.snapshotNameInput.value) {
    els.snapshotNameInput.value = defaultSnapshotName();
  }
  els.snapshotList.replaceChildren(
    ...(snapshots.length
      ? snapshots.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(createSnapshotRow)
      : [emptyListMessage("No snapshots yet")]),
  );
}

function createSnapshot() {
  const project = getActiveProject();
  const name = els.snapshotNameInput.value.trim() || defaultSnapshotName();
  syncActiveProject();
  const snapshot: ProjectSnapshot = {
    id: makeId("snapshot"),
    name: name.slice(0, 80),
    createdAt: new Date().toISOString(),
    state: sanitizeState(state),
  };
  project.snapshots = [snapshot, ...getSnapshots()].slice(0, 30);
  els.snapshotNameInput.value = defaultSnapshotName();
  renderSnapshotPanel();
  persistState();
  setStatus("Snapshot created");
}

function createSnapshotRow(snapshot: ProjectSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "snapshot-row";
  const copy = document.createElement("div");
  copy.className = "snapshot-copy";
  const title = document.createElement("strong");
  title.textContent = snapshot.name;
  const meta = document.createElement("span");
  meta.textContent = `${formatDate(snapshot.createdAt)} · ${snapshot.state.thoughts.length} thoughts`;
  copy.append(title, meta);

  const restoreButton = document.createElement("button");
  restoreButton.type = "button";
  restoreButton.textContent = "Restore";
  restoreButton.addEventListener("click", () => restoreSnapshot(snapshot.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteSnapshot(snapshot.id));

  row.append(copy, restoreButton, deleteButton);
  return row;
}

function restoreSnapshot(snapshotId: string) {
  const snapshot = getSnapshots().find((item) => item.id === snapshotId);
  if (!snapshot) return;
  const approved = window.confirm(`Restore snapshot "${snapshot.name}"? Your current map will be kept in undo history.`);
  if (!approved) return;
  pushHistory();
  state = sanitizeState(snapshot.state);
  syncActiveProject();
  resetProjectSessionState();
  render();
  requestAnimationFrame(fitToGraph);
  persistState();
  setStatus("Snapshot restored");
}

function deleteSnapshot(snapshotId: string) {
  const project = getActiveProject();
  project.snapshots = getSnapshots().filter((snapshot) => snapshot.id !== snapshotId);
  renderSnapshotPanel();
  persistState();
}

function getSnapshots(): ProjectSnapshot[] {
  const project = getActiveProject();
  if (!Array.isArray(project.snapshots)) project.snapshots = [];
  return project.snapshots;
}

function defaultSnapshotName(): string {
  const date = new Date();
  return `Snapshot ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
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
  renderStageView();
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
  clearCreateHandlePreview();
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
  if (pointerMode?.type === "create-handle") {
    const dragDistance = Math.hypot(event.clientX - pointerMode.startX, event.clientY - pointerMode.startY);
    createHandlePreview = {
      from: getCreateHandleGraphPoint(pointerMode.id, pointerMode.direction),
      to: clientPointToGraph(event.clientX, event.clientY),
      ready: dragDistance >= NODE_CREATE_DRAG_THRESHOLD,
    };
    renderGraph();
    return;
  }
  updateHoverThought(event);
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
    const dragDistance = Math.hypot(event.clientX - pointerMode.startX, event.clientY - pointerMode.startY);
    const isClick = dragDistance <= NODE_CREATE_CLICK_THRESHOLD;
    const isReadyDrag = dragDistance >= NODE_CREATE_DRAG_THRESHOLD;
    const createPosition = isReadyDrag ? clientPointToGraph(event.clientX, event.clientY) : null;
    clearCreateHandlePreview();
    if (isClick || isReadyDrag) {
      const x = isReadyDrag ? event.clientX : pointerMode.startX;
      const y = isReadyDrag ? event.clientY : pointerMode.startY;
      openNodeContextMenu(x, y, pointerMode.relation, createPosition);
    } else {
      contextAnchorId = null;
    }
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
  const createHandle = getClosestElement(event.target, ".node-create-handle");
  if (createHandle?.dataset.id) {
    setHoverThought(createHandle.dataset.id);
    return;
  }
  const node = event.target.closest(".node");
  if (node?.dataset.id) {
    setHoverThought(node.dataset.id);
    return;
  }
  scheduleHoverClear();
}

function setHoverThought(id) {
  const nextId = id || null;
  if (nextId && hoverClearTimer) {
    window.clearTimeout(hoverClearTimer);
    hoverClearTimer = undefined;
  }
  const previousPreviewId = hoverThoughtId && hoverThoughtId !== getGraphFocusId() ? hoverThoughtId : null;
  const nextPreviewId = nextId && nextId !== getGraphFocusId() ? nextId : null;
  hoverThoughtId = nextId;
  if (previousPreviewId === nextPreviewId) return;
  renderGraph();
}

function scheduleHoverClear() {
  if (!hoverThoughtId || hoverClearTimer) return;
  hoverClearTimer = window.setTimeout(() => {
    hoverClearTimer = undefined;
    setHoverThought(null);
  }, 180);
}

function clearHoverThought() {
  if (hoverClearTimer) {
    window.clearTimeout(hoverClearTimer);
    hoverClearTimer = undefined;
  }
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

function getCreateHandleDirection(value: string | undefined): CreateHandleDirection {
  return value === "top" || value === "right" || value === "bottom" || value === "left" ? value : "bottom";
}

function clientPointToGraph(clientX: number, clientY: number): Point {
  const bounds = els.graph.getBoundingClientRect();
  return {
    x: (clientX - bounds.left - graphRect.width / 2 - state.view.x) / state.view.scale,
    y: (clientY - bounds.top - graphRect.height / 2 - state.view.y) / state.view.scale,
  };
}

function getCreateHandleGraphPoint(id: string, direction: CreateHandleDirection): Point {
  const thought = getGraphRenderThought(id) || getThought(id);
  const position = (thought && getVisualPositions().get(id)) || thought || { x: 0, y: 0 };
  const box = getGraphRenderNodeBox(id);
  const handleGap = NODE_CREATE_HANDLE_GAP;
  const offsets = {
    top: { x: 0, y: -box.baseHeight / 2 - handleGap },
    right: { x: box.baseWidth / 2 + handleGap, y: 0 },
    bottom: { x: 0, y: box.baseHeight / 2 + handleGap },
    left: { x: -box.baseWidth / 2 - handleGap, y: 0 },
  };
  const offset = offsets[direction];
  return {
    x: position.x + offset.x * box.scale,
    y: position.y + offset.y * box.scale,
  };
}

function clearCreateHandlePreview() {
  if (!createHandlePreview) return;
  createHandlePreview = null;
  renderGraph();
}

function openNodeContextMenu(clientX, clientY, relation: LinkRelation = "parent-of", createPosition: Point | null = null) {
  contextLinkId = null;
  pendingNodeCreatePosition = createPosition;
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
  pendingNodeCreatePosition = null;
  contextLinkId = linkId;
  els.nodeCreateForm.hidden = true;
  els.linkEditForm.hidden = false;
  els.contextMenu.hidden = false;
  renderLinkEditForm(link);
  positionContextMenu(clientX, clientY);
  requestAnimationFrame(() => els.linkNameInput.focus());
}

function openLinkContextMenuFromElement(linkId, element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  openLinkContextMenu(linkId, bounds.right, bounds.bottom + 6);
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
  pendingNodeCreatePosition = null;
  contextLinkId = null;
}

function onNodeCreateSubmit(event) {
  event.preventDefault();
  const title = els.nodeCreateInput.value.trim();
  if (!title || !contextAnchorId) return;
  addThought(title, contextAnchorId, els.nodeCreateRelationInput.value as LinkRelation, {
    note: els.nodeCreateNoteInput.value,
    position: pendingNodeCreatePosition,
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

async function exportMarkdownFolder() {
  const project = getActiveProject();
  const files = projectToMarkdownFiles(project.name, state);
  const directoryPicker = (window as unknown as { showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  if (directoryPicker) {
    try {
      const directory = await directoryPicker({ mode: "readwrite" });
      await Promise.all(files.map((file) => writeFileToDirectory(directory, file)));
      setStatus("Markdown folder exported");
      return;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        setStatus("Export cancelled");
        return;
      }
    }
  }
  downloadFile(`${slugifyFilename(project.name, "thoughts-map")}-markdown.md`, projectToMarkdownBundle(project.name, state), "text/markdown");
  setStatus("Markdown bundle exported");
}

function exportOpml() {
  const project = getActiveProject();
  downloadFile(`${slugifyFilename(project.name, "thoughts-map")}.opml`, projectToOpml(project.name, state), "text/x-opml");
}

function exportJsonCanvas() {
  const project = getActiveProject();
  downloadFile(`${slugifyFilename(project.name, "thoughts-map")}.canvas`, JSON.stringify(projectToJsonCanvas(state), null, 2), "application/json");
}

function exportSvg() {
  downloadFile("thoughts-map.svg", serializeGraphSvg(), "image/svg+xml");
}

function exportPng() {
  const svgText = serializeGraphSvg();
  const image = new Image();
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(graphRect.width));
    canvas.height = Math.max(1, Math.round(graphRect.height));
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(url);
      setStatus("PNG export failed");
      return;
    }
    context.drawImage(image, 0, 0);
    canvas.toBlob((pngBlob) => {
      URL.revokeObjectURL(url);
      if (!pngBlob) {
        setStatus("PNG export failed");
        return;
      }
      const pngUrl = URL.createObjectURL(pngBlob);
      const anchor = document.createElement("a");
      anchor.href = pngUrl;
      anchor.download = "thoughts-map.png";
      anchor.click();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("PNG export failed");
  };
  image.src = url;
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

async function writeFileToDirectory(directory: FileSystemDirectoryHandle, file: TextFile): Promise<void> {
  const handle = await directory.getFileHandle(file.name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file.text);
  await writable.close();
}

function serializeGraphSvg(): string {
  renderGraph();
  const clone = els.graph.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.round(graphRect.width)));
  clone.setAttribute("height", String(Math.round(graphRect.height)));
  clone.setAttribute("viewBox", `0 0 ${Math.round(graphRect.width)} ${Math.round(graphRect.height)}`);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `${serializeCssVariables()}\n${collectStylesheetText()}`;
  clone.querySelector("defs")?.prepend(style);
  return new XMLSerializer().serializeToString(clone);
}

function serializeCssVariables(): string {
  const computed = getComputedStyle(document.body);
  const variables = [
    "--stage-bg",
    "--node-fill",
    "--node-stroke",
    "--link",
    "--active-link",
    "--accent",
    "--accent-strong",
    "--ink",
    "--muted",
    "--line",
    "--panel-strong",
    "--preview",
    "--preview-soft",
  ].map((name) => `${name}: ${computed.getPropertyValue(name).trim()};`).join(" ");
  return `:root { ${variables} }`;
}

function collectStylesheetText(): string {
  return Array.from(document.styleSheets).map((sheet) => {
    try {
      return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
    } catch {
      return "";
    }
  }).join("\n");
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

async function importMarkdown(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (!files.length) return;
  try {
    const textFiles = await readTextFiles(files);
    const approved = window.confirm("Importing Markdown will replace the current project with thoughts from the selected files.");
    if (!approved) {
      setStatus("Import cancelled");
      return;
    }
    pushHistory();
    state = sanitizeState(markdownFilesToState(textFiles, state));
    syncActiveProject();
    resetProjectSessionState();
    render();
    requestAnimationFrame(fitToGraph);
    persistState();
    setStatus("Markdown imported");
  } catch {
    window.alert("Those Markdown files could not be imported.");
    setStatus("Import failed");
  } finally {
    input.value = "";
  }
}

async function importOpml(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const document = new DOMParser().parseFromString(text, "application/xml");
    if (document.querySelector("parsererror")) throw new Error("Invalid OPML");
    const approved = window.confirm("Importing OPML will replace the current project.");
    if (!approved) {
      setStatus("Import cancelled");
      return;
    }
    pushHistory();
    state = sanitizeState(opmlDocumentToState(document, state));
    syncActiveProject();
    resetProjectSessionState();
    render();
    requestAnimationFrame(fitToGraph);
    persistState();
    setStatus("OPML imported");
  } catch {
    window.alert("That OPML file could not be imported.");
    setStatus("Import failed");
  } finally {
    input.value = "";
  }
}

async function importJsonCanvas(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const approved = window.confirm("Importing JSON Canvas will replace the current project.");
    if (!approved) {
      setStatus("Import cancelled");
      return;
    }
    pushHistory();
    state = sanitizeState(jsonCanvasToState(parsed, state));
    syncActiveProject();
    resetProjectSessionState();
    render();
    requestAnimationFrame(fitToGraph);
    persistState();
    setStatus("JSON Canvas imported");
  } catch {
    window.alert("That JSON Canvas file could not be imported.");
    setStatus("Import failed");
  } finally {
    input.value = "";
  }
}

async function readTextFiles(files: File[]): Promise<TextFile[]> {
  return Promise.all(files.map(async (file) => ({
    name: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    text: await file.text(),
  })));
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

function trimLabel(label, length) {
  return label.length > length ? `${label.slice(0, length - 1)}...` : label;
}

function showNotePreview(text) {
  els.notePreview.innerHTML = text && text.trim()
    ? renderMarkdown(text, getThoughtByTitle)
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
