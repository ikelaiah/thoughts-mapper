export type KindDefinition = {
  id: string;
  name: string;
  color: string;
};

export type Thought = {
  id: string;
  title: string;
  kind: string;
  note: string;
  tags: string[];
  x: number;
  y: number;
};

export type LinkType = "parent" | "related";

export type Link = {
  id: string;
  from: string;
  to: string;
  type: LinkType;
  name?: string;
};

export type ViewState = {
  x: number;
  y: number;
  scale: number;
};

export type MapSettings = {
  theme: string;
  background: string;
  calmMode: boolean;
  lineThickness: number;
  connectionType: "straight" | "curve";
  lineEndpoint: "floating" | "touching";
};

export type ProjectState = {
  kinds: KindDefinition[];
  defaultKindId: string;
  thoughts: Thought[];
  links: Link[];
  selectedId: string | null;
  view: ViewState;
  settings: MapSettings;
};

export type Project = {
  id: string;
  name: string;
  state: ProjectState;
  updatedAt?: string;
};

export type AppData = {
  version: number;
  activeProjectId: string;
  projects: Project[];
};

export type TemplateDefinition = {
  id: string;
  name: string;
  root: string;
  tags: string[];
  children: [string, string, string][];
};

export type Point = {
  x: number;
  y: number;
};

export type NodeBox = {
  scale: number;
  baseWidth: number;
  baseHeight: number;
  hitBaseWidth: number;
  hitBaseHeight: number;
  width: number;
  height: number;
};

export type LinkRelation = "parent-of" | "child-of" | "related";
export type RetargetRelation = LinkRelation | "sibling";
export type PositionMap = Map<string, Point>;
export type SvgAttrs = Record<string, string | number | boolean>;
export type AddThoughtOptions = { select?: boolean; center?: boolean };
export type SelectThoughtOptions = { center?: boolean };
export type CenterOptions = { save?: boolean };
export type RowOptions = { gap?: number };
export type ColumnOptions = { gap?: number; side?: "left" | "right" };
export type ParentRelatedOptions = { sideGap?: number; gap?: number };
export type CreateKindOptions = { assignToThoughtId?: string };
export type AddKindOptions = { select?: boolean; makeDefault?: boolean };
export type MobileLibraryOptions = { focusSearch?: boolean };

export type PointerMode =
  | { type: "node"; id: string }
  | { type: "pan" };

export type PointerStart = {
  clientX: number;
  clientY: number;
  viewX: number;
  viewY: number;
};

export type LinkRenderEffect = {
  id: string;
  link: Link;
};

export type ThoughtRenderEffect = {
  thought: Thought;
  position: Point;
  box?: NodeBox;
  mode?: "deleting" | "dim";
};

export type GraphEffects = {
  appearingLinkIds: Set<string>;
  leavingLinks: LinkRenderEffect[];
  dimThoughts: Map<string, ThoughtRenderEffect>;
};

export type GraphTransitionOptions = {
  fromPositions: PositionMap;
  toPositions: PositionMap;
  toView: ViewState | null;
  appearingLinkIds?: string[];
  leavingLinks?: Link[];
  dimThoughtIds?: string[];
  dimThoughts?: ThoughtRenderEffect[];
  delay?: number;
  save?: boolean;
};

export type AppElements = {
  appShell: HTMLElement;
  leftResizeHandle: HTMLElement;
  rightResizeHandle: HTMLElement;
  saveState: HTMLElement;
  libraryCloseButton: HTMLButtonElement;
  projectControls: HTMLElement;
  projectSelect: HTMLSelectElement;
  projectNameInput: HTMLInputElement;
  newProjectToggleButton: HTMLButtonElement;
  newProjectPanel: HTMLElement;
  templateSelect: HTMLSelectElement;
  newProjectNameInput: HTMLInputElement;
  createTemplateButton: HTMLButtonElement;
  searchInput: HTMLInputElement;
  quickCaptureForm: HTMLFormElement;
  quickCaptureInput: HTMLInputElement;
  tagFilterInput: HTMLSelectElement;
  inboxFilterButton: HTMLButtonElement;
  inboxCount: HTMLElement;
  thoughtCount: HTMLElement;
  thoughtList: HTMLElement;
  sidebarActions: HTMLElement;
  exportButton: HTMLButtonElement;
  markdownExportButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  sidebarToggleButton: HTMLButtonElement;
  detailsToggleButton: HTMLButtonElement;
  moreButton: HTMLButtonElement;
  moreMenu: HTMLElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  fitButton: HTMLButtonElement;
  centerButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
  settingsMenuButton: HTMLButtonElement;
  settingsPage: HTMLElement;
  settingsCloseButton: HTMLButtonElement;
  mobileManagement: HTMLElement;
  colourSchemeInput: HTMLSelectElement;
  lineThicknessInput: HTMLInputElement;
  lineThicknessValue: HTMLOutputElement;
  connectionTypeInput: HTMLSelectElement;
  lineEndpointInput: HTMLSelectElement;
  calmModeInput: HTMLInputElement;
  kindList: HTMLElement;
  newKindNameInput: HTMLInputElement;
  newKindColorInput: HTMLInputElement;
  addKindButton: HTMLButtonElement;
  graph: SVGSVGElement;
  graphBackground: SVGRectElement;
  viewport: SVGGElement;
  linksLayer: SVGGElement;
  nodesLayer: SVGGElement;
  detailsEmpty: HTMLElement;
  detailsCloseButton: HTMLButtonElement;
  detailsPanel: HTMLElement;
  selectedType: HTMLElement;
  deleteButton: HTMLButtonElement;
  titleInput: HTMLInputElement;
  kindInput: HTMLSelectElement;
  kindColorInput: HTMLInputElement;
  kindDefaultButton: HTMLButtonElement;
  tagInput: HTMLInputElement;
  inboxPlacementPanel: HTMLElement;
  placeTargetInput: HTMLSelectElement;
  placeRelationInput: HTMLSelectElement;
  placeThoughtButton: HTMLButtonElement;
  placePreviewText: HTMLElement;
  noteInput: HTMLTextAreaElement;
  notePreview: HTMLElement;
  linkForm: HTMLFormElement;
  linkTargetInput: HTMLSelectElement;
  linkRelationInput: HTMLSelectElement;
  linkSubmitButton: HTMLButtonElement;
  linkPreviewText: HTMLElement;
  connectionCount: HTMLElement;
  connectionList: HTMLElement;
  backlinkCount: HTMLElement;
  backlinkList: HTMLElement;
  mentionCount: HTMLElement;
  mentionList: HTMLElement;
  inboxReviewPanel: HTMLElement;
  inboxReviewProgress: HTMLElement;
  inboxReviewCloseButton: HTMLButtonElement;
  inboxReviewPrevButton: HTMLButtonElement;
  inboxReviewNextButton: HTMLButtonElement;
  inboxReviewTitle: HTMLElement;
  inboxReviewNote: HTMLElement;
  inboxReviewTargetInput: HTMLSelectElement;
  inboxReviewPreview: HTMLElement;
  inboxReviewChildButton: HTMLButtonElement;
  inboxReviewParentButton: HTMLButtonElement;
  inboxReviewRelatedButton: HTMLButtonElement;
  inboxReviewKeepButton: HTMLButtonElement;
  contextMenu: HTMLElement;
  nodeCreateForm: HTMLFormElement;
  nodeCreateInput: HTMLInputElement;
  nodeCreateRelationInput: HTMLSelectElement;
  nodeCreateCancelButton: HTMLButtonElement;
  linkEditForm: HTMLFormElement;
  linkNameInput: HTMLInputElement;
  linkDirectionInput: HTMLSelectElement;
  linkUnlinkButton: HTMLButtonElement;
  linkKeepInput: HTMLSelectElement;
  linkRetargetInput: HTMLSelectElement;
  linkRetargetRelationInput: HTMLSelectElement;
  linkRetargetButton: HTMLButtonElement;
  mobileScrim: HTMLButtonElement;
  mobileCaptureButton: HTMLButtonElement;
  mobileCaptureForm: HTMLFormElement;
  mobileCaptureInput: HTMLInputElement;
  mobileCaptureCancelButton: HTMLButtonElement;
};
