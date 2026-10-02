import type { StoryPoint } from './profiles';
import type { StoryEntity } from './story';
export type WorldKind = 'organisation' | 'structure' | 'rank' | 'position' | 'character' | 'location' | 'object' | 'vehicle' | 'rule' | 'lore' | 'note' | 'event' | 'plot' | 'scene' | 'world' | 'custom';
export interface WorldRef {
    kind: WorldKind;
    id: string;
}
export interface WorldPoint extends StoryPoint {
    screenplayId?: string;
}
export interface WorldEntity extends StoryEntity {
    kind: Exclude<WorldKind, 'character' | 'location' | 'event' | 'plot' | 'scene' | 'world'>;
    fields?: Record<string, string>;
    aliases?: string[];
    abbreviation?: string;
    rankLevel?: number;
    rankGroup?: string;
    fieldLinks?: Record<string, WorldRef>;
    organisationId?: string;
    structureType?: string;
    hierarchyLevel?: number;
    displayOrder?: number;
    category?: string;
    /** Legacy input retained for safe migration; no longer an entry-type control. */
    organisationRole?: 'unit' | 'rank' | 'position';
    customType?: string;
    imageIds?: string[];
    allowedRankIds?: string[];
    unitIds?: string[];
    history?: { id: string; fromPoint?: WorldPoint; untilPoint?: WorldPoint; fields: Record<string,string>; notes?: string }[];
}
export interface WorldRelationship {
    id: string;
    from: WorldRef;
    to: WorldRef;
    type: string;
    fromPoint?: WorldPoint;
    untilPoint?: WorldPoint;
    notes?: string;
    importance?: string;
    unitId?: string;
    rankId?: string;
    positionId?: string;
    reportsToId?: string;
    /** Explicit override; absent means derive from rank hierarchy. Empty means no reports. */
    reportsToIds?: string[];
    archived?: boolean;
}
export interface WorldDiagram {
    id: string;
    name: string;
    mode?: 'organisation' | 'command';
    root?: WorldRef;
    relationshipTypes?: string[];
    kinds?: WorldKind[];
    collapsedIds?: string[];
}
export interface WorldRecord {
    structureModelVersion?: 1;
    schemaVersion: 1;
    id: string;
    name: string;
    description: string;
    characterIds: string[];
    locationIds: string[];
    entities: WorldEntity[];
    relationships: WorldRelationship[];
    diagrams: WorldDiagram[];
    relationshipOptions?: { sourceKind: WorldKind; targetKind: WorldKind; label: string; inverseLabel?: string }[];
    fieldOptions?: Record<string,string[]>;
    provenance?: {
        worldId: string;
        copiedAt: string;
        identityMap: Record<string, string>;
    };
    archived?: boolean;
}
export interface WorldOccurrence {
    id: string;
    worldId?: string;
    entity: WorldRef;
    screenplayId: string;
    sceneId: string;
    scope: 'scene' | 'text';
    from?: {
        elementId: string;
        offset: number;
    };
    to?: {
        elementId: string;
        offset: number;
    };
    selectedText?: string;
    needsReview?: boolean;
}
export interface WorldPackage {
    format: 'story-world';
    schemaVersion: 1;
    world: WorldRecord;
    characters: StoryEntity[];
    locations: StoryEntity[];
    assets: Record<string, string>;
}
export interface WorldUi {
    pins: {
        worldId: string;
        entity?: WorldRef;
        diagramId?: string;
    }[];
    showLinks?: boolean;
}
export interface WorldLinkContext {
    screenplayId: string;
    sceneId: string;
    type: string;
    from?: {
        elementId: string;
        offset: number;
    };
    to?: {
        elementId: string;
        offset: number;
    };
    selectedText?: string;
    x: number;
    y: number;
}
export const WORLD_CATEGORIES = [{ kind: 'organisation', label: 'Organisations' }, { kind: 'character', label: 'People' }, { kind: 'location', label: 'Places' }, { kind: 'object', label: 'Objects' }, { kind: 'vehicle', label: 'Vehicles' }, { kind: 'rule', label: 'Rules' }, { kind: 'lore', label: 'Language & Lore' }, { kind: 'note', label: 'Notes' }] as const;
export const LORE_TYPES = ['Saying', 'Slang/Lingo', 'Spell', 'Incantation', 'Prayer', 'Oath', 'Chant', 'Terminology', 'Code', 'Ritual', 'Potion/Recipe', 'Custom'];
export const WORLD_RELATIONSHIPS = ['part of', 'member of', 'reports to', 'based at', 'located at', 'belongs to', 'owned by', 'driven by', 'passenger', 'applies to', 'requires', 'governed by', 'known by', 'used by', 'attached to', 'related to'];
export const WORLD_FIELDS: Record<string, string[]> = { organisation: ['Rank terminology', 'Position terminology'], object: ['Type', 'Purpose', 'Condition'], vehicle: ['Type', 'Make/model', 'Colour', 'Registration/identifier'], rule: ['Exceptions', 'Reason', 'Importance'], lore: ['Type', 'Language', 'Exact wording', 'Literal translation', 'Meaning / usage', 'Pronunciation', 'Variants'], note: ['Importance'] };

export const ORGANISATION_CATEGORIES = ['Government / Public','Private / Commercial','Criminal','Military','Healthcare','Education','Charity / Non-profit','Religious','Political','Family / Household','Community','Secret Society / Order','Other / Custom'];
export const STRUCTURE_TYPES = ['Division','Department','Branch','Unit','Team','Command','Section','Crew','Custom'];
