import type { KindDefinition, ProjectState, TemplateDefinition } from "./types";

export const DB_NAME = "thoughts-mapper";
export const DB_VERSION = 1;
export const STORE_NAME = "documents";
export const DOC_KEY = "main";
export const APP_DATA_VERSION = 3;
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
  "light-sky": { theme: "light", background: "pastel-sky" },
  "light-blush": { theme: "light", background: "pastel-blush" },
  "light-leaves": { theme: "light", background: "leaves" },
  "light-rain": { theme: "light", background: "rain" },
  "light-snow": { theme: "light", background: "snow" },
  "light-ocean": { theme: "light", background: "ocean" },
  "light-eink": { theme: "light", background: "eink" },
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
  "dark-eink": { theme: "dark", background: "eink" },
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
