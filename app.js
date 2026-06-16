const DB_NAME = "thoughts-mapper";
const DB_VERSION = 1;
const STORE_NAME = "documents";
const DOC_KEY = "main";
const APP_DATA_VERSION = 3;
const HISTORY_LIMIT = 60;
const NEW_KIND_VALUE = "__new-kind__";
const DEFAULT_KIND_ID = "thought";
const LINK_DRAW_DURATION = 260;

const defaultKindDefinitions = [
  { id: "thought", name: "Thought", color: "#4c7fb8" },
  { id: "idea", name: "Idea", color: "#2f8f83" },
  { id: "project", name: "Project", color: "#4c7fb8" },
  { id: "person", name: "Person", color: "#d49436" },
  { id: "resource", name: "Resource", color: "#8067b3" },
  { id: "question", name: "Question", color: "#c85f6d" },
];

const legacyKindStyles = Object.fromEntries(defaultKindDefinitions.map((kind) => [kind.id, kind.color]));

const kindColourPalette = [
  "#4c7fb8",
  "#2f8f83",
  "#d49436",
  "#8067b3",
  "#c85f6d",
  "#5f8f46",
  "#4f9ca4",
  "#b06f43",
];

const colourSchemes = {
  "light-mint": { theme: "light", background: "pastel-mint" },
  "light-sky": { theme: "light", background: "pastel-sky" },
  "light-blush": { theme: "light", background: "pastel-blush" },
  "light-leaves": { theme: "light", background: "leaves" },
  "light-rain": { theme: "light", background: "rain" },
  "light-snow": { theme: "light", background: "snow" },
  "light-ocean": { theme: "light", background: "ocean" },
  "dark-calm": { theme: "dark", background: "calm" },
  "dark-mint": { theme: "dark", background: "pastel-mint" },
  "dark-sky": { theme: "dark", background: "pastel-sky" },
  "dark-blush": { theme: "dark", background: "pastel-blush" },
  "dark-fire": { theme: "dark", background: "fireflies" },
  "dark-leaves": { theme: "dark", background: "leaves" },
  "dark-blackhole": { theme: "dark", background: "blackhole" },
  "dark-aurora": { theme: "dark", background: "aurora" },
  "dark-rain": { theme: "dark", background: "rain" },
  "dark-snow": { theme: "dark", background: "snow" },
  "dark-nebula": { theme: "dark", background: "nebula" },
  "dark-starfield": { theme: "dark", background: "starfield" },
  "dark-ocean": { theme: "dark", background: "ocean" },
};

const seedState = {
  kinds: defaultKindDefinitions,
  defaultKindId: DEFAULT_KIND_ID,
  thoughts: [
    {
      id: "t-home",
      title: "Thoughts Mapper",
      kind: "project",
      note: "A free, local-first visual thinking space.",
      tags: ["home"],
      x: 0,
      y: 0,
    },
    {
      id: "t-local",
      title: "Local database",
      kind: "idea",
      note: "IndexedDB keeps the map in this browser.",
      tags: ["local-first"],
      x: -260,
      y: -140,
    },
    {
      id: "t-ui",
      title: "Easy UI",
      kind: "idea",
      note: "Add, search, connect, and write without friction.",
      tags: ["ux"],
      x: 260,
      y: -120,
    },
    {
      id: "t-notes",
      title: "Notes",
      kind: "resource",
      note: "Each thought has a focused writing area.",
      tags: ["notes"],
      x: -210,
      y: 160,
    },
    {
      id: "t-next",
      title: "Later features",
      kind: "question",
      note: "Files, web sync, tags, AI search, sharing, and backups.",
      tags: ["roadmap"],
      x: 240,
      y: 160,
    },
  ],
  links: [
    { id: "l-1", from: "t-home", to: "t-local", type: "parent" },
    { id: "l-2", from: "t-home", to: "t-ui", type: "parent" },
    { id: "l-3", from: "t-home", to: "t-notes", type: "parent" },
    { id: "l-4", from: "t-home", to: "t-next", type: "parent" },
  ],
  selectedId: "t-home",
  view: { x: 0, y: 0, scale: 1 },
  settings: {
    theme: "dark",
    background: "calm",
    lineThickness: 2.5,
    connectionType: "curve",
    lineEndpoint: "floating",
  },
};

const templateCatalog = [
  {
    id: "project-tracker",
    name: "Project tracker",
    root: "Project tracker",
    tags: ["project"],
    children: [
      ["Goals", "question", "What does done look like?\n- [ ] Define outcome\n- [ ] Define success measure"],
      ["Milestones", "project", "- [ ] Plan first milestone\n- [ ] Review risks"],
      ["Next actions", "idea", "- [ ] Add next action\n- [ ] Assign owner"],
      ["Risks", "question", "Track open risks and decisions."],
      ["Resources", "resource", "Links, notes, references, and files to gather."],
    ],
  },
  {
    id: "helpdesk-knowledge-base",
    name: "Helpdesk ticket knowledge base",
    root: "Helpdesk knowledge base",
    tags: ["support"],
    children: [
      ["Common tickets", "question", "Recurring issues and known fixes."],
      ["Troubleshooting steps", "resource", "- [ ] Reproduce\n- [ ] Check logs\n- [ ] Confirm resolution"],
      ["Escalation paths", "person", "Who to contact when the fix needs help."],
      ["Known workarounds", "idea", "Temporary fixes that users can apply safely."],
      ["Customer patterns", "idea", "Signals that point to repeat problems."],
    ],
  },
  {
    id: "bible-study-prep",
    name: "Bible study prep",
    root: "Bible study prep",
    tags: ["study"],
    children: [
      ["Passage", "resource", "Primary text, translation notes, and cross references."],
      ["Observations", "idea", "What does the text say?"],
      ["Interpretation", "question", "What does it mean in context?"],
      ["Application", "idea", "How should this shape belief, action, or prayer?"],
      ["Discussion questions", "question", "- [ ] Opening question\n- [ ] Main question\n- [ ] Reflection question"],
    ],
  },
  {
    id: "sermon-devotional-outline",
    name: "Sermon/devotional outline",
    root: "Sermon outline",
    tags: ["outline"],
    children: [
      ["Big idea", "idea", "The single sentence people should remember."],
      ["Scripture", "resource", "Main text and supporting passages."],
      ["Outline", "project", "- [ ] Introduction\n- [ ] Point one\n- [ ] Point two\n- [ ] Close"],
      ["Illustrations", "resource", "Stories, examples, and images."],
      ["Response", "question", "What should listeners do next?"],
    ],
  },
  {
    id: "research-notes",
    name: "Research notes",
    root: "Research notes",
    tags: ["research"],
    children: [
      ["Research question", "question", "What are you trying to understand?"],
      ["Sources", "resource", "Books, papers, pages, interviews, and datasets."],
      ["Findings", "idea", "Confirmed observations and useful excerpts."],
      ["Open questions", "question", "What still needs checking?"],
      ["Synthesis", "idea", "Patterns, conclusions, and next claims to test."],
    ],
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    root: "Meeting notes",
    tags: ["meeting"],
    children: [
      ["Agenda", "project", "- [ ] Topic one\n- [ ] Topic two\n- [ ] Topic three"],
      ["Decisions", "idea", "Decisions made during the meeting."],
      ["Action items", "project", "- [ ] Action / owner / date"],
      ["People", "person", "Attendees, stakeholders, and follow-ups."],
      ["Parking lot", "question", "Important items to revisit later."],
    ],
  },
  {
    id: "personal-crm",
    name: "Personal CRM",
    root: "Personal CRM",
    tags: ["people"],
    children: [
      ["People to follow up", "person", "- [ ] Name / topic / date"],
      ["Shared interests", "idea", "Topics, projects, and personal details worth remembering."],
      ["Introductions", "person", "People who should meet each other."],
      ["Conversation notes", "resource", "Notes from calls, coffees, and messages."],
      ["Opportunities to help", "question", "Where can you be useful?"],
    ],
  },
  {
    id: "learning-roadmap",
    name: "Learning roadmap",
    root: "Learning roadmap",
    tags: ["learning"],
    children: [
      ["Why learn this", "question", "Purpose, motivation, and desired outcome."],
      ["Core concepts", "idea", "Ideas that everything else depends on."],
      ["Practice projects", "project", "- [ ] Small practice\n- [ ] Real-world practice"],
      ["Resources", "resource", "Courses, books, videos, docs, and mentors."],
      ["Progress review", "question", "What is clear now? What still feels confusing?"],
    ],
  },
  {
    id: "book-summary",
    name: "Book summary",
    root: "Book summary",
    tags: ["book"],
    children: [
      ["Main argument", "idea", "What is the book really saying?"],
      ["Key chapters", "resource", "Chapter-by-chapter notes."],
      ["Quotes", "resource", "Useful short excerpts and page references."],
      ["Questions", "question", "Claims to test or discuss."],
      ["Actions", "project", "- [ ] One idea to apply\n- [ ] One idea to share"],
    ],
  },
  {
    id: "software-architecture-map",
    name: "Software architecture map",
    root: "Software architecture",
    tags: ["software"],
    children: [
      ["User flows", "person", "People, roles, and core workflows."],
      ["Core modules", "project", "Major parts of the system and ownership."],
      ["Data model", "resource", "Entities, relationships, storage, and migrations."],
      ["Integrations", "resource", "External APIs, queues, jobs, and services."],
      ["Risks and tradeoffs", "question", "Constraints, failure modes, and open decisions."],
    ],
  },
];

let state = clone(seedState);
let appData = null;
let db;
let storageMode = "indexeddb";
let saveTimer;
let statusTimer;
let graphRect = { width: 1, height: 1 };
let pointerMode = null;
let pointerStart = null;
let focusAnimation = null;
let focusPositions = null;
let pendingGraphTransition = null;
const graphEffects = {
  appearingLinkIds: new Set(),
  leavingLinks: [],
  dimThoughts: new Map(),
};
let contextAnchorId = null;
let contextLinkId = null;
let hoverThoughtId = null;
let selectedLinkId = null;
let undoStack = [];
let redoStack = [];
let showInboxOnly = false;
let sidebarHidden = false;
let detailsHidden = false;
let newProjectPanelOpen = false;
let moreMenuOpen = false;
let inboxReviewOpen = false;
let inboxReviewIndex = 0;

const els = {
  appShell: document.querySelector("#appShell"),
  saveState: document.querySelector("#saveState"),
  projectControls: document.querySelector("#projectControls"),
  projectSelect: document.querySelector("#projectSelect"),
  projectNameInput: document.querySelector("#projectNameInput"),
  newProjectToggleButton: document.querySelector("#newProjectToggleButton"),
  newProjectPanel: document.querySelector("#newProjectPanel"),
  templateSelect: document.querySelector("#templateSelect"),
  newProjectNameInput: document.querySelector("#newProjectNameInput"),
  createTemplateButton: document.querySelector("#createTemplateButton"),
  searchInput: document.querySelector("#searchInput"),
  quickCaptureForm: document.querySelector("#quickCaptureForm"),
  quickCaptureInput: document.querySelector("#quickCaptureInput"),
  tagFilterInput: document.querySelector("#tagFilterInput"),
  inboxFilterButton: document.querySelector("#inboxFilterButton"),
  inboxCount: document.querySelector("#inboxCount"),
  thoughtCount: document.querySelector("#thoughtCount"),
  thoughtList: document.querySelector("#thoughtList"),
  exportButton: document.querySelector("#exportButton"),
  markdownExportButton: document.querySelector("#markdownExportButton"),
  importInput: document.querySelector("#importInput"),
  sidebarToggleButton: document.querySelector("#sidebarToggleButton"),
  detailsToggleButton: document.querySelector("#detailsToggleButton"),
  moreButton: document.querySelector("#moreButton"),
  moreMenu: document.querySelector("#moreMenu"),
  undoButton: document.querySelector("#undoButton"),
  redoButton: document.querySelector("#redoButton"),
  fitButton: document.querySelector("#fitButton"),
  centerButton: document.querySelector("#centerButton"),
  resetButton: document.querySelector("#resetButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPage: document.querySelector("#settingsPage"),
  settingsCloseButton: document.querySelector("#settingsCloseButton"),
  colourSchemeInput: document.querySelector("#colourSchemeInput"),
  lineThicknessInput: document.querySelector("#lineThicknessInput"),
  lineThicknessValue: document.querySelector("#lineThicknessValue"),
  connectionTypeInput: document.querySelector("#connectionTypeInput"),
  lineEndpointInput: document.querySelector("#lineEndpointInput"),
  kindList: document.querySelector("#kindList"),
  newKindNameInput: document.querySelector("#newKindNameInput"),
  newKindColorInput: document.querySelector("#newKindColorInput"),
  addKindButton: document.querySelector("#addKindButton"),
  graph: document.querySelector("#graph"),
  graphBackground: document.querySelector("#graphBackground"),
  viewport: document.querySelector("#viewport"),
  linksLayer: document.querySelector("#linksLayer"),
  nodesLayer: document.querySelector("#nodesLayer"),
  detailsEmpty: document.querySelector("#detailsEmpty"),
  detailsPanel: document.querySelector("#detailsPanel"),
  selectedType: document.querySelector("#selectedType"),
  deleteButton: document.querySelector("#deleteButton"),
  titleInput: document.querySelector("#titleInput"),
  kindInput: document.querySelector("#kindInput"),
  kindColorInput: document.querySelector("#kindColorInput"),
  kindDefaultButton: document.querySelector("#kindDefaultButton"),
  tagInput: document.querySelector("#tagInput"),
  inboxPlacementPanel: document.querySelector("#inboxPlacementPanel"),
  placeTargetInput: document.querySelector("#placeTargetInput"),
  placeRelationInput: document.querySelector("#placeRelationInput"),
  placeThoughtButton: document.querySelector("#placeThoughtButton"),
  noteInput: document.querySelector("#noteInput"),
  notePreview: document.querySelector("#notePreview"),
  linkForm: document.querySelector("#linkForm"),
  linkTargetInput: document.querySelector("#linkTargetInput"),
  linkRelationInput: document.querySelector("#linkRelationInput"),
  connectionCount: document.querySelector("#connectionCount"),
  connectionList: document.querySelector("#connectionList"),
  backlinkCount: document.querySelector("#backlinkCount"),
  backlinkList: document.querySelector("#backlinkList"),
  mentionCount: document.querySelector("#mentionCount"),
  mentionList: document.querySelector("#mentionList"),
  inboxReviewPanel: document.querySelector("#inboxReviewPanel"),
  inboxReviewProgress: document.querySelector("#inboxReviewProgress"),
  inboxReviewCloseButton: document.querySelector("#inboxReviewCloseButton"),
  inboxReviewTitle: document.querySelector("#inboxReviewTitle"),
  inboxReviewNote: document.querySelector("#inboxReviewNote"),
  inboxReviewTargetInput: document.querySelector("#inboxReviewTargetInput"),
  inboxReviewChildButton: document.querySelector("#inboxReviewChildButton"),
  inboxReviewParentButton: document.querySelector("#inboxReviewParentButton"),
  inboxReviewRelatedButton: document.querySelector("#inboxReviewRelatedButton"),
  inboxReviewKeepButton: document.querySelector("#inboxReviewKeepButton"),
  contextMenu: document.querySelector("#contextMenu"),
  nodeCreateForm: document.querySelector("#nodeCreateForm"),
  nodeCreateInput: document.querySelector("#nodeCreateInput"),
  nodeCreateRelationInput: document.querySelector("#nodeCreateRelationInput"),
  nodeCreateCancelButton: document.querySelector("#nodeCreateCancelButton"),
  linkEditForm: document.querySelector("#linkEditForm"),
  linkNameInput: document.querySelector("#linkNameInput"),
  linkDirectionInput: document.querySelector("#linkDirectionInput"),
  linkUnlinkButton: document.querySelector("#linkUnlinkButton"),
  linkKeepInput: document.querySelector("#linkKeepInput"),
  linkRetargetInput: document.querySelector("#linkRetargetInput"),
  linkRetargetRelationInput: document.querySelector("#linkRetargetRelationInput"),
  linkRetargetButton: document.querySelector("#linkRetargetButton"),
};

init();

async function init() {
  try {
    db = await openDatabase();
    appData = sanitizeAppData((await loadState()) || seedState);
  } catch {
    storageMode = "localstorage";
    appData = sanitizeAppData(loadLocalState() || seedState);
  }
  state = clone(getActiveProject().state);
  measureGraph();
  bindEvents();
  render();
  requestAnimationFrame(fitToGraph);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function loadState() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(DOC_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(DB_NAME);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistState() {
  els.saveState.textContent = "Saving";
  clearTimeout(statusTimer);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    syncActiveProject();
    if (storageMode === "localstorage") {
      localStorage.setItem(DB_NAME, JSON.stringify(appData));
      els.saveState.textContent = "Saved";
      return;
    }

    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(appData, DOC_KEY);
    tx.oncomplete = () => {
      els.saveState.textContent = "Saved";
    };
    tx.onerror = () => {
      els.saveState.textContent = "Save failed";
    };
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
  clean.settings = {
    theme: ["light", "dark"].includes(clean.settings?.theme) ? clean.settings.theme : "light",
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
    ].includes(clean.settings?.background)
      ? clean.settings.background
      : "calm",
    lineThickness: clamp(Number(clean.settings?.lineThickness) || 2.5, 1, 8),
    connectionType: ["straight", "curve"].includes(clean.settings?.connectionType)
      ? clean.settings.connectionType
      : "curve",
    lineEndpoint: ["floating", "touching"].includes(clean.settings?.lineEndpoint)
      ? clean.settings.lineEndpoint
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
  window.addEventListener("resize", () => {
    measureGraph();
    renderGraph();
  });

  els.projectSelect.addEventListener("change", switchProject);
  els.projectNameInput.addEventListener("change", renameActiveProject);
  els.newProjectToggleButton.addEventListener("click", toggleNewProjectPanel);
  els.createTemplateButton.addEventListener("click", createProjectFromSelectedTemplate);
  els.searchInput.addEventListener("input", renderThoughtList);
  els.quickCaptureForm.addEventListener("submit", onQuickCaptureSubmit);
  els.tagFilterInput.addEventListener("change", renderThoughtList);
  els.inboxFilterButton.addEventListener("click", () => {
    const inboxThoughts = getInboxThoughts();
    if (inboxThoughts.length) {
      openInboxReview();
      return;
    }
    showInboxOnly = !showInboxOnly;
    renderThoughtList();
  });
  els.exportButton.addEventListener("click", exportMap);
  els.markdownExportButton.addEventListener("click", exportMarkdown);
  els.importInput.addEventListener("change", importMap);
  els.sidebarToggleButton.addEventListener("click", toggleSidebar);
  els.detailsToggleButton.addEventListener("click", toggleDetailsPanel);
  els.moreButton.addEventListener("click", toggleMoreMenu);
  els.undoButton.addEventListener("click", () => {
    undo();
    closeMoreMenu();
  });
  els.redoButton.addEventListener("click", () => {
    redo();
    closeMoreMenu();
  });
  els.fitButton.addEventListener("click", fitToGraph);
  els.centerButton.addEventListener("click", () => {
    centerSelected();
    closeMoreMenu();
  });
  els.settingsButton.addEventListener("click", () => {
    openSettings();
    closeMoreMenu();
  });
  els.settingsCloseButton.addEventListener("click", closeSettings);
  els.colourSchemeInput.addEventListener("change", () => {
    const scheme = colourSchemes[els.colourSchemeInput.value] || colourSchemes["light-mint"];
    pushHistory();
    state.settings.theme = scheme.theme;
    state.settings.background = scheme.background;
    applySettings();
    persistState();
  });
  els.lineThicknessInput.addEventListener("input", () => {
    pushHistory();
    state.settings.lineThickness = Number(els.lineThicknessInput.value);
    applySettings();
    renderGraph();
    persistState();
  });
  els.connectionTypeInput.addEventListener("change", () => {
    pushHistory();
    state.settings.connectionType = els.connectionTypeInput.value;
    applySettings();
    renderGraph();
    persistState();
  });
  els.lineEndpointInput.addEventListener("change", () => {
    pushHistory();
    state.settings.lineEndpoint = els.lineEndpointInput.value;
    applySettings();
    renderGraph();
    persistState();
  });
  els.resetButton.addEventListener("click", () => {
    resetView();
    closeMoreMenu();
  });

  els.titleInput.addEventListener("input", () => {
    const selected = getSelectedThought();
    if (!selected) return;
    pushHistory();
    selected.title = els.titleInput.value;
    render();
    persistState();
  });

  els.kindInput.addEventListener("change", () => {
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
  });

  els.kindColorInput.addEventListener("change", () => {
    const selected = getSelectedThought();
    const kind = selected ? getKindDefinition(selected.kind) : null;
    if (!kind) return;
    pushHistory();
    kind.color = sanitizeKindColor(els.kindColorInput.value, kind.color);
    render();
    persistState();
  });

  els.kindDefaultButton.addEventListener("click", () => {
    const selected = getSelectedThought();
    if (!selected || state.defaultKindId === selected.kind) return;
    pushHistory();
    state.defaultKindId = selected.kind;
    render();
    persistState();
  });

  els.addKindButton.addEventListener("click", addKindFromSettings);
  els.newKindNameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addKindFromSettings();
  });

  els.tagInput.addEventListener("change", () => {
    const selected = getSelectedThought();
    if (!selected) return;
    pushHistory();
    selected.tags = normalizeTags(els.tagInput.value);
    render();
    persistState();
  });

  els.noteInput.addEventListener("input", () => {
    const selected = getSelectedThought();
    if (!selected) return;
    pushHistory();
    selected.note = els.noteInput.value;
    renderThoughtList();
    renderMentionPanels(selected);
    persistState();
  });

  els.noteInput.addEventListener("blur", () => {
    showNotePreview(els.noteInput.value);
  });

  els.notePreview.addEventListener("click", (event) => {
    const mention = event.target.closest("[data-mention-id]");
    if (mention) {
      event.stopPropagation();
      selectThought(mention.dataset.mentionId);
      return;
    }
    startNoteEditing();
  });
  els.notePreview.addEventListener("keydown", (event) => {
    const mention = event.target.closest?.("[data-mention-id]");
    if (mention && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectThought(mention.dataset.mentionId);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startNoteEditing();
    }
  });

  els.linkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addLink(state.selectedId, els.linkTargetInput.value, els.linkRelationInput.value);
  });
  els.placeThoughtButton.addEventListener("click", placeInboxThought);
  els.inboxReviewCloseButton.addEventListener("click", closeInboxReview);
  els.inboxReviewChildButton.addEventListener("click", () => placeInboxReviewThought("parent-of"));
  els.inboxReviewParentButton.addEventListener("click", () => placeInboxReviewThought("child-of"));
  els.inboxReviewRelatedButton.addEventListener("click", () => placeInboxReviewThought("related"));
  els.inboxReviewKeepButton.addEventListener("click", keepInboxReviewThought);

  els.deleteButton.addEventListener("click", deleteSelectedThought);

  els.graph.addEventListener("pointerdown", onPointerDown);
  els.graph.addEventListener("pointermove", onPointerMove);
  els.graph.addEventListener("pointerup", onPointerUp);
  els.graph.addEventListener("pointercancel", onPointerUp);
  els.graph.addEventListener("pointerleave", clearHoverThought);
  els.graph.addEventListener("contextmenu", onGraphContextMenu);
  els.graph.addEventListener("wheel", onWheel, { passive: false });
  els.nodeCreateForm.addEventListener("submit", onNodeCreateSubmit);
  els.nodeCreateCancelButton.addEventListener("click", closeContextMenu);
  els.linkEditForm.addEventListener("submit", onLinkEditSubmit);
  els.linkUnlinkButton.addEventListener("click", unlinkContextLink);
  els.linkKeepInput.addEventListener("change", renderLinkRetargetOptions);
  els.linkRetargetButton.addEventListener("click", retargetContextLink);
  document.addEventListener("pointerdown", onDocumentPointerDown);
  window.addEventListener("keydown", (event) => {
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
    }
  });
}

function measureGraph() {
  const bounds = els.graph.getBoundingClientRect();
  graphRect = {
    width: Math.max(bounds.width, 1),
    height: Math.max(bounds.height, 1),
  };
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
  els.lineThicknessInput.value = state.settings.lineThickness;
  els.lineThicknessValue.value = state.settings.lineThickness.toFixed(1);
  els.lineThicknessValue.textContent = `${state.settings.lineThickness.toFixed(1)} px`;
  els.connectionTypeInput.value = state.settings.connectionType;
  els.lineEndpointInput.value = state.settings.lineEndpoint;
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

  const candidates = state.thoughts.filter((thought) => thought.id !== selected.id);
  els.linkTargetInput.replaceChildren(
    ...candidates.map((thought) => {
      const option = document.createElement("option");
      option.value = thought.id;
      option.textContent = thought.title;
      return option;
    }),
  );
  els.placeTargetInput.replaceChildren(
    ...candidates.map((thought) => {
      const option = document.createElement("option");
      option.value = thought.id;
      option.textContent = thought.title;
      return option;
    }),
  );
  const isInbox = isInboxThought(selected.id);
  els.inboxPlacementPanel.hidden = !isInbox || !candidates.length;
  els.linkForm.hidden = isInbox && candidates.length;

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
      unlinkButton.textContent = "Unlink";
      unlinkButton.title = `Unlink ${selected.title} and ${thought.title}`;
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
  els.kindInput.replaceChildren(...options, divider, optionElement(NEW_KIND_VALUE, "+ New kind"));
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
      nameInput.setAttribute("aria-label", "Kind name");
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
  els.viewport.setAttribute(
    "transform",
    `translate(${graphRect.width / 2 + state.view.x} ${graphRect.height / 2 + state.view.y}) scale(${state.view.scale})`,
  );

  const positions = getVisualPositions();
  const graphFocusId = getGraphFocusId();
  const activeIds = new Set(getFocusFamilyIds(graphFocusId));
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
    .map(({ link, effect, visualId }) => {
      const from = getGraphRenderThought(link.from);
      const to = getGraphRenderThought(link.to);
      if (!from || !to) return null;
      const fromPos = positions.get(from.id) || from;
      const toPos = positions.get(to.id) || to;
      const isActiveLink = link.from === state.selectedId || link.to === state.selectedId;
      const isSelectedLink = link.id === selectedLinkId;
      const isFocusLink = activeIds.has(link.from) && activeIds.has(link.to);
      const isPreviewLink = previewId && previewIds.has(link.from) && previewIds.has(link.to);
      const isAppearing = effect === "appearing";
      const isLeaving = effect === "leaving";
      const fromNodeBox = getGraphRenderNodeBox(link.from);
      const toNodeBox = getGraphRenderNodeBox(link.to);
      const endpoints = getTrimmedLinkEndpoints(fromPos, toPos, fromNodeBox, toNodeBox);
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
      const linkAttrs = {
        class: `link-line ${link.type === "related" ? "related" : "parent"}${isActiveLink ? " active" : ""}${isSelectedLink ? " selected" : ""}${isPreviewLink ? " preview" : ""}${isAppearing ? " appearing" : ""}${
          isFocusLink && !isActiveLink ? " context" : ""
        }`,
        style: `stroke-width: ${thickness}px`,
      };
      if (isAppearing) linkAttrs.pathLength = 1;
      const hitAttrs = {
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

      if (!isLeaving && (isActiveLink || isSelectedLink || link.name)) {
        const label = svg(
          "text",
          {
            class: `relation-label${isActiveLink || isSelectedLink ? " active" : ""}`,
            x: (fromPos.x + toPos.x) / 2,
            y: (fromPos.y + toPos.y) / 2 - 8,
          },
          link.name || getLinkLabel(link),
        );
        group.append(label);
      }
      const priority = isLeaving ? 1 : isSelectedLink ? 5 : isAppearing ? 4 : isActiveLink ? 3 : isPreviewLink ? 2 : isFocusLink ? 1 : 0;
      return { element: group, priority };
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.element);
  els.linksLayer.replaceChildren(...linkElements);

  const nodeElements = getGraphRenderThoughts()
    .map((thought) => {
      const thoughtEffect = graphEffects.dimThoughts.get(thought.id);
      const position = thoughtEffect?.position || positions.get(thought.id) || thought;
      const isActive = thought.id === graphFocusId;
      const isConnected = activeIds.has(thought.id) && !isActive;
      const isDimmed = graphFocusId && !activeIds.has(thought.id);
      const isPreview = thought.id === previewId;
      const isPreviewRelated = previewIds.has(thought.id) && !isPreview;
      const isDeleting = thoughtEffect?.mode === "deleting";
      const isSoftDisconnected = graphEffects.dimThoughts.has(thought.id) && !isDeleting;
      const box = getGraphRenderNodeBox(thought.id);
      const scale = box.scale;
      const nodeWidth = box.baseWidth;
      const nodeHeight = box.baseHeight;
      const showKindLabel = isActive || isConnected || isPreview || isPreviewRelated || state.view.scale >= 1.2;
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
          class: "node-shell",
          x: -nodeWidth / 2,
          y: -nodeHeight / 2,
          width: nodeWidth,
          height: nodeHeight,
          rx: 18,
          ry: 18,
        }),
      );
      group.append(svg("circle", { r: 7, cx: -nodeWidth / 2 + 19, cy: -nodeHeight / 2 + 18, fill: getKindColor(thought.kind) }));
      const textElements = [
        svg("text", { class: "node-title", y: showKindLabel ? -2 : 5 }, trimLabel(thought.title, isActive ? 18 : 13)),
      ];
      if (showKindLabel) {
        textElements.push(svg("text", { class: "node-kind", y: 19 }, isInboxThought(thought.id) ? "inbox" : getKindName(thought.kind)));
      }
      group.append(...textElements);
      const priority = isActive ? 4 : isPreview ? 3 : isConnected || isPreviewRelated ? 2 : isDimmed ? 0 : 1;
      return { element: group, priority };
    })
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.element);
  els.nodesLayer.replaceChildren(...nodeElements);
}

function getCurvePath(from, to) {
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

function getNodeBox(id) {
  const isActive = id === state.selectedId;
  const connected = state.selectedId && getConnectedThoughts(state.selectedId).some((thought) => thought.id === id);
  const scale = isActive ? 1.12 : connected ? 0.95 : 0.82;
  const baseWidth = isActive ? 166 : 140;
  const baseHeight = isActive ? 76 : 64;
  return {
    baseWidth,
    baseHeight,
    width: baseWidth * scale,
    height: baseHeight * scale,
    scale,
  };
}

function getGraphRenderNodeBox(id) {
  return graphEffects.dimThoughts.get(id)?.box || getNodeBox(id);
}

function getTrimmedLinkEndpoints(from, to, fromBox, toBox) {
  const baseFrom = trimPointToBox(from, to, fromBox, 0);
  const baseTo = trimPointToBox(to, from, toBox, 0);
  if (state.settings.lineEndpoint === "touching") {
    return { from: baseFrom, to: baseTo };
  }

  const dx = baseTo.x - baseFrom.x;
  const dy = baseTo.y - baseFrom.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1) {
    return getMinimalLinkEndpoints(from, to);
  }

  const visibleLength = Math.max(28, length * 0.58);
  const totalGap = Math.max(0, length - visibleLength);
  const gapPerSide = Math.min(30, totalGap / 2);
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

function getMinimalLinkEndpoints(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const size = state.settings.lineEndpoint === "floating" ? 28 : 12;
  const center = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
  return {
    from: { x: center.x - unitX * size * 0.5, y: center.y - unitY * size * 0.5 },
    to: { x: center.x + unitX * size * 0.5, y: center.y + unitY * size * 0.5 },
  };
}

function trimPointToBox(center, target, box, extraGap = 0) {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const edgeInset = state.settings.lineEndpoint === "touching" ? -0.5 : state.settings.lineThickness;
  const halfWidth = box.width / 2 + edgeInset + extraGap;
  const halfHeight = box.height / 2 + edgeInset + extraGap;
  const scale = Math.min(Math.abs(halfWidth / dx) || Infinity, Math.abs(halfHeight / dy) || Infinity);
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function addThought(title, anchorId = state.selectedId, relation = "parent-of", options = {}) {
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

function addLink(activeId, targetId, relation = "parent-of") {
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

function selectThought(id, options = {}) {
  clearPendingGraphTransition();
  selectedLinkId = null;
  if (id && isInboxThought(id)) {
    state.selectedId = id;
    renderThoughtList();
    renderDetails();
    renderGraph();
    persistState();
    return;
  }

  const fromPositions = getVisualPositions();
  state.selectedId = id;
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

function centerSelected(options = {}) {
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
  const paddingX = 240;
  const paddingY = 190;
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
  const scale = clamp(Math.min(graphRect.width / width, graphRect.height / height), 0.48, 1.15);
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
}) {
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

function animateFocus({ fromPositions, toPositions, toView, save = true }) {
  animateCamera({ fromPositions, toPositions, toView, save });
}

function animateCamera({ fromPositions = getVisualPositions(), toPositions = getVisualPositions(), toView, save = true }) {
  clearPendingGraphTransition();
  stopFocusAnimation();
  const fromView = { ...state.view };
  const start = performance.now();
  const duration = 560;

  focusAnimation = requestAnimationFrame(function tick(now) {
    const progress = clamp((now - start) / duration, 0, 1);
    const eased = easeOutCubic(progress);
    focusPositions = interpolatePositions(fromPositions, toPositions, eased);
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

function interpolatePositions(fromPositions, toPositions, progress) {
  const positions = new Map();
  state.thoughts.forEach((thought) => {
    const from = fromPositions.get(thought.id) || thought;
    const to = toPositions.get(thought.id) || thought;
    positions.set(thought.id, {
      x: interpolate(from.x, to.x, progress),
      y: interpolate(from.y, to.y, progress),
    });
  });
  return positions;
}

function computeFocusPositions(selectedId = state.selectedId) {
  const positions = new Map(state.thoughts.map((thought) => [thought.id, { x: thought.x, y: thought.y }]));
  const selected = getThought(selectedId);
  if (!selected) return positions;

  const ancestorEntries = getAncestorEntries(selectedId, 2);
  const descendantEntries = getDescendantEntries(selectedId, 3);
  const parents = ancestorEntries.filter((entry) => entry.depth === 1).map((entry) => entry.thought);
  const children = descendantEntries.filter((entry) => entry.depth === 1).map((entry) => entry.thought);
  const siblings = getSiblingThoughts(selectedId);
  const directIds = new Set([
    selectedId,
    ...ancestorEntries.map((entry) => entry.thought.id),
    ...descendantEntries.map((entry) => entry.thought.id),
  ]);
  const visibleSiblings = siblings.filter((thought) => !directIds.has(thought.id));
  const layerGap = 245;

  positions.set(selected.id, { x: selected.x, y: selected.y });

  groupByDepth(ancestorEntries).forEach((entries, depth) => {
    arrangeFocusLayer(positions, entries, selected, selected.y - depth * layerGap, {
      spacing: depth === 1 ? 220 : 190,
      relation: "ancestor",
    });
  });

  if (visibleSiblings.length) {
    arrangeSiblingShelf(positions, selected, visibleSiblings);
  }

  groupByDepth(descendantEntries).forEach((entries, depth) => {
    arrangeFocusLayer(positions, entries, selected, selected.y + depth * layerGap, {
      spacing: depth === 1 ? 220 : 185,
      relation: "descendant",
    });
  });

  if (!parents.length && !children.length && !visibleSiblings.length) {
    positions.set(selected.id, { x: selected.x, y: selected.y });
  }
  return positions;
}

function arrangeFocusLayer(positions, entries, selected, y, options = {}) {
  if (!entries.length) return;
  const spacing = options.spacing || 190;
  const relation = options.relation || "descendant";
  const groups = new Map();
  entries.forEach((entry) => {
    const anchorId = relation === "ancestor" ? entry.childId : entry.parentId;
    if (!groups.has(anchorId)) groups.set(anchorId, []);
    groups.get(anchorId).push(entry);
  });

  const layout = [];
  groups.forEach((group, anchorId) => {
    const anchor = positions.get(anchorId) || getThought(anchorId) || selected;
    const sorted = [...group].sort((a, b) => a.thought.x - b.thought.x || a.thought.title.localeCompare(b.thought.title));
    sorted.forEach((entry, index) => {
      layout.push({
        entry,
        idealX: anchor.x + (index - (sorted.length - 1) / 2) * spacing,
      });
    });
  });

  resolveLayerCollisions(layout, spacing);
  layout.forEach(({ entry, x }) => {
    positions.set(entry.thought.id, { x, y });
  });
}

function resolveLayerCollisions(layout, spacing) {
  layout.sort((a, b) => a.idealX - b.idealX || a.entry.thought.title.localeCompare(b.entry.thought.title));
  layout.forEach((item, index) => {
    item.x = index === 0 ? item.idealX : Math.max(item.idealX, layout[index - 1].x + spacing);
  });

  for (let index = layout.length - 2; index >= 0; index -= 1) {
    layout[index].x = Math.min(layout[index].x, layout[index + 1].x - spacing);
  }
}

function groupByDepth(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    if (!groups.has(entry.depth)) groups.set(entry.depth, []);
    groups.get(entry.depth).push(entry);
  });
  return groups;
}

function arrangeSiblingShelf(positions, selected, siblings) {
  if (!siblings.length) return;
  const peers = getPeerThoughtsInOrder(selected.id, siblings);
  const selectedIndex = Math.max(peers.findIndex((thought) => thought.id === selected.id), 0);
  const selectedBox = getNodeBox(selected.id);
  const sideGap = 76;
  const itemGap = 30;
  const rowY = selected.y + selectedBox.height / 2 + 118;
  const left = [];
  const right = [];

  siblings.forEach((thought) => {
    const index = peers.findIndex((peer) => peer.id === thought.id);
    const target = index >= 0 && index < selectedIndex ? left : right;
    target.push(thought);
  });

  let cursor = selected.x - selectedBox.width / 2 - sideGap;
  left
    .sort((a, b) => b.x - a.x || a.title.localeCompare(b.title))
    .forEach((thought) => {
      const box = getNodeBox(thought.id);
      const x = cursor - box.width / 2;
      positions.set(thought.id, { x, y: rowY });
      cursor = x - box.width / 2 - itemGap;
    });

  cursor = selected.x + selectedBox.width / 2 + sideGap;
  right
    .sort((a, b) => a.x - b.x || a.title.localeCompare(b.title))
    .forEach((thought) => {
      const box = getNodeBox(thought.id);
      const x = cursor + box.width / 2;
      positions.set(thought.id, { x, y: rowY });
      cursor = x + box.width / 2 + itemGap;
    });
}

function getVisualPositions() {
  return focusPositions || computeFocusPositions(state.selectedId);
}

function interpolate(from, to, progress) {
  return from + (to - from) * progress;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function getLinkLabel(link) {
  if (link.type === "related") return "related";
  if (link.from === state.selectedId) return "parent -> child";
  if (link.to === state.selectedId) return "parent <- child";
  return "parent -> child";
}

function getLinkDirectionText(link) {
  return link.type === "related" ? "is related to" : "is parent of";
}

function getConnectionRoleLabel(role) {
  if (role === "related") return "Related";
  return role === "parent" ? "Parent" : "Child";
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

function getPeerThoughtsInOrder(id, siblings) {
  const peers = new Map();
  getParentThoughts(id).forEach((parent) => {
    getChildThoughts(parent.id).forEach((child) => peers.set(child.id, child));
  });
  peers.set(id, getThought(id));
  siblings.forEach((thought) => peers.set(thought.id, thought));
  return [...peers.values()].filter(Boolean).sort((a, b) => a.x - b.x);
}

function getFocusFamilyIds(id) {
  if (!id) return [];
  return uniqueThoughts([
    getThought(id),
    ...getAncestorEntries(id, 2).map((entry) => entry.thought),
    ...getDescendantEntries(id, 3).map((entry) => entry.thought),
    ...getSiblingThoughts(id),
    ...getRelatedThoughts(id),
  ])
    .filter(Boolean)
    .map((thought) => thought.id);
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

function createKindFromPrompt(options = {}) {
  const name = window.prompt("New kind name", "Thought");
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

function addKind(name, color, options = {}) {
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
  els.inboxReviewProgress.textContent = inboxThoughts.length
    ? `${inboxReviewIndex + 1} of ${inboxThoughts.length} unplaced thoughts`
    : "No unplaced thoughts.";
  els.inboxReviewTitle.textContent = current?.title || "Inbox clear";
  els.inboxReviewNote.textContent = current?.note?.trim() || "Captured thoughts will appear here until you connect them.";
  els.inboxReviewTargetInput.replaceChildren(
    ...candidates.map((thought) => optionElement(thought.id, thought.title)),
  );
  const disabled = !current || !candidates.length;
  [els.inboxReviewTargetInput, els.inboxReviewChildButton, els.inboxReviewParentButton, els.inboxReviewRelatedButton].forEach((element) => {
    element.disabled = disabled;
  });
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
  if (sidebarHidden) {
    sidebarHidden = false;
    renderPanelState();
    measureGraph();
    renderGraph();
  }
  els.searchInput.focus();
  els.searchInput.select();
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
  addLink(selected.id, targetId, els.placeRelationInput.value);
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
  const padding = 170;
  const xs = graphThoughts.map((thought) => thought.x);
  const ys = graphThoughts.map((thought) => thought.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = clamp(Math.min(graphRect.width / width, graphRect.height / height), 0.45, 1.45);
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
  sidebarHidden = !sidebarHidden;
  renderPanelState();
  refreshGraphAfterPanelChange();
}

function toggleDetailsPanel() {
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
  els.appShell.classList.toggle("sidebar-hidden", sidebarHidden);
  els.appShell.classList.toggle("details-hidden", detailsHidden);
  els.sidebarToggleButton.textContent = sidebarHidden ? "Show list" : "Hide list";
  els.sidebarToggleButton.title = sidebarHidden ? "Show thoughts sidebar" : "Hide thoughts sidebar";
  els.sidebarToggleButton.setAttribute("aria-label", els.sidebarToggleButton.title);
  els.detailsToggleButton.textContent = detailsHidden ? "Show details" : "Hide details";
  els.detailsToggleButton.title = detailsHidden ? "Show thought details" : "Hide thought details";
  els.detailsToggleButton.setAttribute("aria-label", els.detailsToggleButton.title);
}

function onPointerDown(event) {
  closeContextMenu();
  if (event.button !== 0) return;
  event.preventDefault();
  els.graph.setPointerCapture(event.pointerId);
  const link = event.target.closest(".link-group");
  if (link) {
    selectLink(link.dataset.linkId);
    pointerMode = null;
    pointerStart = null;
    return;
  }

  const node = event.target.closest(".node");

  if (node) {
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

function onPointerMove(event) {
  updateHoverThought(event);
  // Only the empty canvas pans; a press on a node never moves it.
  if (pointerMode?.type !== "pan" || !pointerStart) return;
  state.view.x = pointerStart.viewX + (event.clientX - pointerStart.clientX);
  state.view.y = pointerStart.viewY + (event.clientY - pointerStart.clientY);
  renderGraph();
}

function onPointerUp() {
  if (pointerMode?.type === "node") {
    selectThought(pointerMode.id);
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

function openNodeContextMenu(clientX, clientY) {
  contextLinkId = null;
  els.nodeCreateForm.hidden = false;
  els.linkEditForm.hidden = true;
  els.contextMenu.hidden = false;
  els.nodeCreateInput.value = "";
  els.nodeCreateRelationInput.value = "parent-of";
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
  addThought(title, contextAnchorId, els.nodeCreateRelationInput.value);
  closeContextMenu();
}

function renderLinkEditForm(link = getLink(contextLinkId)) {
  if (!link) return;
  const from = getThought(link.from);
  const to = getThought(link.to);
  if (!from || !to) return;
  els.linkNameInput.value = link.name || "";
  els.linkDirectionInput.options[0].textContent = `${from.title} parent of ${to.title}`;
  els.linkDirectionInput.options[1].textContent = `${to.title} parent of ${from.title}`;
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
  const nextLink = {
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

  const relation = els.linkRetargetRelationInput.value;
  let nextFrom = keepId;
  let nextTo = targetId;
  let nextType = relation === "related" ? "related" : "parent";
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

  const nextLink = {
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

function svg(tag, attrs = {}, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
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

function clone(value) {
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
