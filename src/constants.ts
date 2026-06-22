import type { KindDefinition, ProjectState, TemplateDefinition } from "./types";

export const DB_NAME = "thoughts-mapper";
export const DB_VERSION = 1;
export const STORE_NAME = "documents";
export const DOC_KEY = "main";
export const APP_DATA_VERSION = 4;
export const HISTORY_LIMIT = 60;
export const NEW_KIND_VALUE = "__new-kind__";
export const DEFAULT_KIND_ID = "thought";
export const LINK_DRAW_DURATION = 260;
export const NODE_CREATE_CLICK_THRESHOLD = 6;
export const NODE_CREATE_DRAG_THRESHOLD = 88;
export const NODE_CREATE_HANDLE_GAP = 17;

export const defaultKindDefinitions: KindDefinition[] = [
  { id: "thought", name: "Thought", color: "#4c7fb8" },
  { id: "idea", name: "Idea", color: "#2f8f83" },
  { id: "project", name: "Project", color: "#4c7fb8" },
  { id: "person", name: "Person", color: "#d49436" },
  { id: "resource", name: "Resource", color: "#8067b3" },
  { id: "question", name: "Question", color: "#c85f6d" },
];

export const legacyKindStyles = Object.fromEntries(defaultKindDefinitions.map((kind) => [kind.id, kind.color]));

export const kindColourPalette = [
  "#4c7fb8",
  "#2f8f83",
  "#d49436",
  "#8067b3",
  "#c85f6d",
  "#5f8f46",
  "#4f9ca4",
  "#b06f43",
];

export const colourSchemes = {
  "light-mint": { theme: "light", background: "pastel-mint" },
  "dark-calm": { theme: "dark", background: "calm" },
  "light-eink": { theme: "light", background: "eink" },
  "high-contrast": { theme: "dark", background: "high-contrast" },
  presentation: { theme: "light", background: "presentation" },
  "light-leaves": { theme: "light", background: "leaves" },
  "dark-fire": { theme: "dark", background: "fireflies" },
  "dark-starfield": { theme: "dark", background: "starfield" },
};

export const seedState: ProjectState = {
  kinds: defaultKindDefinitions,
  defaultKindId: DEFAULT_KIND_ID,
  thoughts: [
    {
      id: "t-home",
      title: "Thoughts Mapper",
      kind: "project",
      note: "A free, local-first visual thinking space.",
      tags: ["home"],
      attachments: [],
      x: 0,
      y: 0,
    },
    {
      id: "t-local",
      title: "Local database",
      kind: "idea",
      note: "IndexedDB keeps the map in this browser.",
      tags: ["local-first"],
      attachments: [],
      x: -260,
      y: -140,
    },
    {
      id: "t-ui",
      title: "Easy UI",
      kind: "idea",
      note: "Add, search, connect, and write without friction.",
      tags: ["ux"],
      attachments: [],
      x: 260,
      y: -120,
    },
    {
      id: "t-notes",
      title: "Notes",
      kind: "resource",
      note: "Each thought has a focused writing area.",
      tags: ["notes"],
      attachments: [],
      x: -210,
      y: 160,
    },
    {
      id: "t-next",
      title: "Later features",
      kind: "question",
      note: "Files, web sync, tags, AI search, sharing, and backups.",
      tags: ["roadmap"],
      attachments: [],
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
    calmMode: true,
    lineThickness: 1.5,
    connectionType: "curve",
    lineEndpoint: "floating",
  },
};

export const templateCatalog: TemplateDefinition[] = [
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
