export interface Chronology {
  day?: number;
  date?: string;
  time?: string;
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
}
export interface StoryEvent extends StoryEntity, StoryLinks {
  major?: boolean;
  occursInSceneId?: string;
  revealedInSceneIds?: string[];
  referencedInSceneIds?: string[];
  participantIds?: string[];
  /** Explicit context overrides; absent on legacy events, whose values stay independent. */
  contextOverrides?: string[];
}
export interface IdentityMerge {
  kind: 'characters' | 'locations'; targetId: string; source: StoryEntity;
  links: { kind: 'scene' | 'event'; id: string; field: string; targetHad: boolean }[];
  relationships?: import('./profiles').CharacterRelationship[];
  childIds?: string[];
}
export interface StoryRecord {
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
