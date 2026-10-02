import type { Chronology } from './story';
export interface StoryPoint { sceneId?: string; eventId?: string; chronology?: Chronology; }
export interface ProfileImage { id: string; assetId: string; label: string; notes?: string; appearanceId?: string; }
export interface Appearance {
  id: string; name: string; isDefault?: boolean; sceneIds?: string[]; from?: StoryPoint; until?: StoryPoint;
  description?: string; hair?: string; facialHair?: string; clothing?: string; injuries?: string; marks?: string; accessories?: string; notes?: string;
}
export interface EntityProfile {
  fullName?: string; dateOfBirth?: string; age?: string; occupation?: string; pronouns?: string; biography?: string; personality?: string;
  goals?: string; fears?: string; secrets?: string; background?: string; aliases?: string[];
  shortName?: string; locationType?: string; structure?: string; atmosphere?: string; visualNotes?: string; restrictions?: string;
  notes?: string; skills?: { id: string; name: string; note?: string }[];
  images?: ProfileImage[]; primaryImageId?: string; appearances?: Appearance[];
  customFields?: { id: string; name: string; value: string }[];
}
export interface CharacterRelationship {
  id: string; fromId: string; toId: string; label: string; directional?: boolean; description?: string; notes?: string;
  type?: RelationshipType; modifier?: RelationshipModifier; from?: StoryPoint; until?: StoryPoint;
  audienceDiscoversAt?: StoryPoint; characterDiscoveries?: { characterId: string; at: StoryPoint }[];
}
export type RelationshipModifier = 'biological' | 'adoptive' | 'foster' | 'step' | 'half' | 'in-law';
export type RelationshipType = typeof RELATIONSHIP_TYPES[number];
export const RELATIONSHIP_TYPES = ['Parent','Dad','Mum','Child','Son','Daughter','Sibling','Brother','Sister','Grandparent','Granddad','Grandma','Grandchild','Grandson','Granddaughter','Cousin','Uncle','Aunty','Nephew','Niece','Partner','Boyfriend','Girlfriend','Fiancé','Fiancée','Spouse','Wife','Husband','Guardian','Ward','Friend','Family friend','Acquaintance','Colleague','Enemy','Other'] as const;
export const RELATIONSHIP_MODIFIERS = ['biological','adoptive','foster','step','half','in-law'] as const;
export interface InspectorContext { type: 'character' | 'location' | 'event' | 'plot' | 'scene'; entityId: string; sourceSceneId?: string; sourceIdentity?: string; }
export interface ProfilePreferences {
  characterWorldFields?: string[];
  characterModules?: string[]; locationModules?: string[];
  inspectorOpen?: boolean; inspectorWidth?: number; sectionState?: Record<string, boolean>;
}
export const CHARACTER_MODULES = { world: 'World relationships', image: 'Character image', dateOfBirth: 'Date of birth', age: 'Age', occupation: 'Occupation / role', description: 'Short description', skills: 'Skills', appearance: 'Current appearance', appearanceImage: 'Current appearance image', plots: 'Current plots', characters: 'Characters with', location: 'Location', time: 'Story time', events: 'Current scene events', relationships: 'Relevant relationships', notes: 'Notes' };
export const LOCATION_MODULES = { world: 'World relationships', image: 'Location image', locationType: 'Location type', description: 'Description', parent: 'Parent location', area: 'Current area', structure: 'Layout / structure', atmosphere: 'Atmosphere', visualNotes: 'Visual notes', restrictions: 'Access / restrictions', characters: 'Characters present', plots: 'Current plots', events: 'Current events', time: 'Story time', notes: 'Notes' };
export const DEFAULT_CHARACTER_MODULES = ['world','image', 'age', 'occupation', 'appearance'];
export const DEFAULT_LOCATION_MODULES = ['world','image', 'description', 'parent', 'area', 'structure'];
export const INSPECTOR_WIDTH = { min: 280, max: 560, initial: 340 };
export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;

export const CHARACTER_WORLD_FIELDS = { organisation: 'Organisation', unit: 'Team / Unit', rank: 'Rank / Grade', position: 'Position' };
export const DEFAULT_CHARACTER_WORLD_FIELDS = Object.keys(CHARACTER_WORLD_FIELDS);
