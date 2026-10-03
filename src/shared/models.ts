export type ProjectType = 'feature' | 'short' | 'series';
export type DocumentFormat = 'screenplay';
export type ScreenplayElementType = 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'shot' | 'lyrics' | 'page_break';
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';
export interface TextEmphasis { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string; backgroundColor?: string; }
export interface TextFormatRange extends TextEmphasis { start: number; end: number; }
export interface DualDialogueMembership { groupId: string; side: 'left' | 'right'; role: 'character' | 'parenthetical' | 'dialogue'; }

export interface BrandConfig {
  productName: string;
  shortName: string;
  developerName: string;
  tagline: string;
  description: string;
  accentColor: string;
}

export interface OwnerConfig {
  schemaVersion: 1;
  brand: BrandConfig;
  terminology: Record<string, string>;
  featureFlags: Record<string, boolean>;
  defaults: { projectType: ProjectType };
}

export interface UserPreferences {
  schemaVersion: 1;
  theme: 'dark' | 'light' | 'system';
  compactLibrary: boolean;
  spellingLanguage: 'en-GB' | 'en-US';
  profiles?: import('./profiles').ProfilePreferences;
  timelineDisplay?: 'icons_names' | 'names';
  timelineOrder?: 'story' | 'screenplay' | 'compare';
  timelineDensity?: 'compact' | 'standard' | 'expanded';
}

export interface AppState {
  schemaVersion: 1;
  storageRoot: string | null;
  setupCompleted: boolean;
}

export interface EpisodeRecord {
  id: string;
  title: string;
  order: number;
  screenplayId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonRecord { id: string; order: number; title?: string; episodes: EpisodeRecord[]; createdAt: string; updatedAt: string; }

export interface ProjectCollection { schemaVersion: 1; id: string; name: string; projectIds: string[]; createdAt: string; updatedAt: string; }

export interface ProjectRecord {
  schemaVersion: 3;
  id: string;
  projectType: ProjectType;
  documentFormat: DocumentFormat;
  title: string;
  createdAt: string;
  updatedAt: string;
  metadata: { description: string };
  screenplayId?: string;
  series?: { id: string; title: string; seasons: SeasonRecord[] };
}

export interface ScreenplayElement {
  id: string;
  type: ScreenplayElementType;
  content: string;
  order: number;
  formatting?: TextFormatRange[];
  alignment?: TextAlignment;
  dualDialogue?: DualDialogueMembership;
  character?: { name: string; extension?: string };
}

export interface SceneRecord {
  id: string;
  order: number;
  elements: ScreenplayElement[];
  locked: boolean;
  metadata: { synopsis: string };
  createdAt: string;
  updatedAt: string;
}

export interface ScreenplayNoteAnchor {
  elementId: string;
  offset: number;
}

export interface ScreenplayNoteResponse {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenplayNote {
  id: string;
  sceneId: string;
  from: ScreenplayNoteAnchor;
  to: ScreenplayNoteAnchor;
  selectedText: string;
  content: string;
  resolved?: boolean;
  responses?: ScreenplayNoteResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ScreenplayRecord {
  storageRevision?: string;
  schemaVersion: 1;
  id: string;
  projectId: string;
  episodeId?: string;
  title: string;
  screenplayType: 'feature' | 'short' | 'episode';
  layout?: import('./screenplay-layout').ScreenplayLayout;
  showDialogueContinuations?: boolean;
  notes?: ScreenplayNote[];
  scenes: SceneRecord[];
  revision: { currentRevisionId: string; sequence: number };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWorkspace { project: ProjectRecord; screenplays: ScreenplayRecord[]; story?: import('./story').StoryRecord; }

export interface StorageHealth { configured: boolean; available: boolean; writable: boolean; path: string | null; message: string; }

export interface BootstrapData {
  ownerConfig: OwnerConfig;
  preferences: UserPreferences;
  appState: AppState;
  storageHealth: StorageHealth;
  projects: ProjectRecord[];
  collections: ProjectCollection[];
}

export interface DesktopApi {
  onCloseRequest?(callback?:()=>Promise<void>):void;
  projectHistory(projectId:string, request:import('./project-history').HistoryRequest):Promise<import('./project-history').HistoryResult>;
  deleteLibraryWorld(id: string): Promise<void>;
  listWorldLibrary(): Promise<import('./worlds').WorldPackage[]>;
  saveLibraryWorld(value: import('./worlds').WorldPackage): Promise<import('./worlds').WorldPackage>;
  importProjectImage(projectId: string, dataUrl: string): Promise<string>;
  readProjectImage(projectId: string, assetId: string): Promise<string>;
  preferClipboardEvents?: boolean;
  bootstrap(): Promise<BootstrapData>;
  readClipboard(): Promise<import("./clipboard").ClipboardRepresentations>;
  writeClipboard(data: import("./clipboard").ClipboardRepresentations): Promise<void>;
  readClipboardText(): Promise<string>;
  writeClipboardText(text: string): Promise<void>;
  chooseStorageFolder(): Promise<string | null>;
  configureStorage(path: string): Promise<BootstrapData>;
  refreshStorage(): Promise<{ health: StorageHealth; projects: ProjectRecord[]; collections: ProjectCollection[] }>;
  createProject(input: { title: string; projectType: ProjectType; collectionId?: string }): Promise<ProjectRecord>;
  openProject(id: string): Promise<ProjectRecord>;
  openWorkspace(projectId: string): Promise<ProjectWorkspace>;
  createSeason(projectId: string, title?: string): Promise<ProjectWorkspace>;
  renameSeason(projectId: string, seasonId: string, title: string): Promise<ProjectWorkspace>;
  reorderSeason(projectId: string, seasonId: string, targetIndex: number): Promise<ProjectWorkspace>;
  createEpisode(projectId: string, seasonId: string, title: string): Promise<ProjectWorkspace>;
  renameEpisode(projectId: string, episodeId: string, title: string): Promise<ProjectWorkspace>;
  moveEpisode(projectId: string, episodeId: string, targetSeasonId: string, targetIndex: number): Promise<ProjectWorkspace>;
  createCollection(name: string): Promise<ProjectCollection[]>;
  renameCollection(id: string, name: string): Promise<ProjectCollection[]>;
  deleteCollection(id: string): Promise<ProjectCollection[]>;
  setCollectionProject(collectionId: string, projectId: string, included: boolean): Promise<ProjectCollection[]>;
  reorderCollectionProject(collectionId: string, projectId: string, targetIndex: number): Promise<ProjectCollection[]>;
  saveScreenplay(projectId: string, screenplay: ScreenplayRecord, context?:import('./project-history').SaveContext): Promise<ScreenplayRecord>;
  saveStory(projectId: string, story: import('./story').StoryRecord, context?:import('./project-history').SaveContext): Promise<import('./story').StoryRecord>;
  saveOwnerConfig(config: OwnerConfig): Promise<OwnerConfig>;
  savePreferences(preferences: UserPreferences): Promise<UserPreferences>;
}
