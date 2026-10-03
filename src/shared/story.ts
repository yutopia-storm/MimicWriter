export type PlotEffect = typeof import('./story-config').PLOT_RELATIONSHIPS[number];

export interface Chronology {
  day?: number;
  date?: string;
  time?: string;
  endTime?: string;
  timeOfDay?: 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'late_night';
  position?: number;
  type?: 'present' | 'past' | 'future' | 'linear' | 'flashback' | 'flashforward' | 'parallel' | 'unknown';
  /** Minutes, including fractional minutes. Kept compatible with existing story files. */
  duration?: number;
}
export interface StoryLinks {
  chronology?: Chronology;
  plotIds?: string[];
  presentIds?: string[];
  involvedIds?: string[];
  /** Explicit remote/voice-over speakers; unlike physical presence. */
  remoteIds?: string[];
  referencedIds?: string[];
  locationId?: string;
  notes?: string;
}
export interface StoryEntity { id: string; name: string; description: string; archived?: boolean; sourceNames?: string[]; sourceElementIds?: string[]; parentId?: string; profile?: import('./profiles').EntityProfile; }
export interface Plot extends StoryEntity {
  label?: string; color: string; scope?: 'series' | 'episode'; episodeId?: string;
  status?: 'planned' | 'active' | 'resolved' | 'unresolved';
  resolutionSceneId?: string; resolutionEventId?: string;
}
export interface SceneStory extends StoryLinks {
  sceneId: string; screenplayId: string;
  /** Last scene-derived values; fields edited by the writer are no longer managed. */
  derived?: StoryLinks;
  manualFields?: string[];
  /** Effect on each explicit Scene-to-Plot link; inherited Event effects stay Event-owned. */
  plotRoles?: Record<string, string>;
  /** Retained legacy Track labels for recovery; current Tracks derives presence/references. */
  characterRoles?: Record<string, string>;
  locationRoles?: Record<string, string>;
}
export interface StoryEvent extends StoryEntity, StoryLinks {
  /** Effect owned by each existing Event-to-Plot link, keyed by Plot ID. */
  plotEffects?: Record<string, PlotEffect>;
  occurrenceTiming?: { mode: "inherit" | "exact" | "range" | "duration" | "approximate"; time?: string; endTime?: string; duration?: number; timeOfDay?: Chronology["timeOfDay"] };
  major?: boolean;
  occursInSceneId?: string;
  revealedInSceneIds?: string[];
  referencedInSceneIds?: string[];
  participantIds?: string[];
  sceneInteractions?: { sceneId: string; relationship: 'investigated' | 'new_evidence' | 'reinterpreted' }[];
  /** Explicit context overrides; absent on legacy events, whose values stay independent. */
  contextOverrides?: string[];
}
export interface IdentityMerge {
  kind: 'characters' | 'locations'; targetId: string; source: StoryEntity;
  links: { kind: 'scene' | 'event'; id: string; field: string; targetHad: boolean }[];
  relationships?: import('./profiles').CharacterRelationship[];
  childIds?: string[];
  worldLinks?: { worldId?: string; type: 'member' | 'from' | 'to' | 'reportsTo' | 'reportsToMany' | 'occurrence' | 'field' | 'source'; field?: string; id?: string; targetHad?: boolean }[];
}
export interface StoryRecord {
  storageRevision?: string;
  worlds?: import('./worlds').WorldRecord[];
  worldOccurrences?: import('./worlds').WorldOccurrence[];
  worldUi?: import('./worlds').WorldUi;
  schemaVersion: 1;
  projectId: string;
  plots: Plot[];
  characters: StoryEntity[];
  locations: StoryEntity[];
  events: StoryEvent[];
  scenes: SceneStory[];
  ignoredCharacterNames?: string[];
  ignoredLocationNames?: string[];
  autoFillDisabledSceneIds?: string[];
  identityMerges?: IdentityMerge[];
  relationships?: import('./profiles').CharacterRelationship[];
}
