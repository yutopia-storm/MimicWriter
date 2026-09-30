import { sceneHeading } from './screenplay';
import { STORY_TIME_PERIODS } from '../shared/story-config';
import { z } from 'zod';
import type { ScreenplayRecord } from '../shared/models';
import type { Chronology, StoryEvent, StoryLinks, StoryRecord } from '../shared/story';
import { hasMeaningfulSceneLocation } from './story-extraction';

const id = z.string().min(1);
const ids = z.array(id).refine(values => new Set(values).size === values.length, 'Duplicate relationship');
const chronology = z.object({ day: z.number().int().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), timeOfDay: z.enum(['early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night', 'late_night']).optional(), position: z.number().finite().optional(), type: z.enum(['present', 'past', 'future', 'linear', 'flashback', 'flashforward', 'parallel', 'unknown']).optional(), duration: z.number().nonnegative().optional() });
const links = { chronology: chronology.optional(), plotIds: ids.optional(), presentIds: ids.optional(), involvedIds: ids.optional(), remoteIds: ids.optional(), referencedIds: ids.optional(), locationId: id.optional(), notes: z.string().optional() };
const point = z.object({ sceneId: id.optional(), eventId: id.optional(), chronology: chronology.optional() });
const profile = z.object({
  ...Object.fromEntries(['fullName','dateOfBirth','age','occupation','pronouns','biography','personality','goals','fears','secrets','background','shortName','locationType','structure','atmosphere','visualNotes','restrictions','notes'].map(key => [key, z.string().optional()])),
  aliases: z.array(z.string()).optional(), primaryImageId: id.optional(),
  skills: z.array(z.object({ id, name: z.string(), note: z.string().optional() })).optional(),
  customFields: z.array(z.object({ id, name: z.string(), value: z.string() })).optional(),
  images: z.array(z.object({ id, assetId: z.string().uuid(), label: z.string(), notes: z.string().optional(), appearanceId: id.optional() })).optional(),
  appearances: z.array(z.object({ id, name: z.string(), isDefault: z.boolean().optional(), sceneIds: ids.optional(), from: point.optional(), until: point.optional(), ...Object.fromEntries(['description','hair','facialHair','clothing','injuries','marks','accessories','notes'].map(key => [key, z.string().optional()])) })).optional(),
});
const relationship = z.object({ id, fromId: id, toId: id, label: z.string(), type: z.enum(['Parent','Dad','Mum','Child','Son','Daughter','Sibling','Brother','Sister','Grandparent','Granddad','Grandma','Grandchild','Grandson','Granddaughter','Cousin','Uncle','Aunty','Nephew','Niece','Partner','Boyfriend','Girlfriend','Fiancé','Fiancée','Spouse','Wife','Husband','Guardian','Ward','Friend','Family friend','Acquaintance','Colleague','Enemy','Other']).optional(), modifier: z.enum(['biological','adoptive','foster','step','half','in-law']).optional(), directional: z.boolean().optional(), description: z.string().optional(), notes: z.string().optional(), from: point.optional(), until: point.optional(), audienceDiscoversAt: point.optional(), characterDiscoveries: z.array(z.object({ characterId: id, at: point })).optional() });
const entity = { id, name: z.string(), description: z.string(), archived: z.boolean().optional(), sourceNames: ids.optional(), sourceElementIds: ids.optional(), parentId: id.optional(), profile: profile.optional() };
const schema = z.object({ schemaVersion: z.literal(1), projectId: id, relationships: z.array(relationship).optional(),
  plots: z.array(z.object({ ...entity, label: z.string().optional(), color: z.string().min(1), scope: z.enum(['series', 'episode']).optional(), episodeId: id.optional(), status: z.enum(['planned', 'active', 'resolved', 'unresolved']).optional(), resolutionSceneId: id.optional(), resolutionEventId: id.optional() })),
  characters: z.array(z.object(entity)), locations: z.array(z.object(entity)),
  events: z.array(z.object({ ...entity, ...links, major: z.boolean().optional(), occursInSceneId: id.optional(), revealedInSceneIds: ids.optional(), referencedInSceneIds: ids.optional(), participantIds: ids.optional(), contextOverrides: ids.optional() })),
  scenes: z.array(z.object({ ...links, sceneId: id, screenplayId: id, derived: z.object(links).optional(), manualFields: ids.optional() })), ignoredCharacterNames: ids.optional(), ignoredLocationNames: ids.optional(), autoFillDisabledSceneIds: ids.optional(), identityMerges: z.array(z.object({ kind: z.enum(['characters', 'locations']), targetId: id, source: z.object(entity), relationships: z.array(relationship).optional(), childIds: ids.optional(), links: z.array(z.object({ kind: z.enum(['scene', 'event']), id, field: z.string(), targetHad: z.boolean() })) })).optional() });

// The absence of a story sidecar is the explicit pre-story (v0) format.
// Additive optional extraction fields preserve the existing v1 representation.
export function migrateStory(value: unknown, projectId: string): StoryRecord {
  if (value == null) return { schemaVersion: 1, projectId, plots: [], characters: [], locations: [], events: [], scenes: [] };
  const story = schema.parse(value);
  if (story.projectId !== projectId) throw new Error('Story does not belong to this project.');
  for (const items of [story.plots, story.characters, story.locations, story.events]) {
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate story identity.');
  }
  if (new Set(story.scenes.map(item => item.sceneId)).size !== story.scenes.length) throw new Error('Duplicate scene relationship.');
  for (const item of [...story.scenes, ...story.events]) {
    if (item.plotIds?.some(id => !story.plots.some(plot => plot.id === id)) ||
        [...item.presentIds ?? [], ...item.involvedIds ?? [], ...item.remoteIds ?? [], ...item.referencedIds ?? [], ...('participantIds' in item ? item.participantIds ?? [] : [])].some(id => !story.characters.some(character => character.id === id)) ||
        (item.locationId && !story.locations.some(location => location.id === item.locationId))) throw new Error('Unknown story relationship.');
  }
  for (const kind of ['plots', 'locations'] as const) for (const item of story[kind]) {
    const visited = new Set([item.id]);
    let parent = item.parentId;
    while (parent) {
      if (visited.has(parent)) throw new Error('Circular story hierarchy.');
      visited.add(parent);
      const ancestor = story[kind].find(value => value.id === parent);
      if (!ancestor) throw new Error('Unknown parent relationship.');
      parent = ancestor.parentId;
    }
  }
  for (const relation of story.relationships ?? []) {
    if (![relation.fromId, relation.toId].every(id => story.characters.some(item => item.id === id))) throw new Error("Unknown character relationship.");
    if (relation.characterDiscoveries?.some(discovery => !story.characters.some(item => item.id === discovery.characterId))) throw new Error('Unknown character relationship discovery.');
  }
  return story;
}

export interface TimelineItem extends StoryLinks { layer?: 'appearance' | 'relationship'; profileId?: string; id: string; kind: 'scene' | 'event'; name: string; description: string; major?: boolean; sceneId?: string; screenplayId?: string; screenplayOrder?: number; missingScene?: boolean; }
export interface TimelineFilter {
  includeChildLocations?: boolean; appearanceChanges?: boolean; relationshipChanges?: boolean; screenplayId?: string; plotIds?: string[]; characterIds?: string[]; relationship?: 'present' | 'involved' | 'referenced' | 'all';
  allCharacters?: boolean; locationId?: string; day?: number; fromDay?: number; toDay?: number;
  kind?: 'scene' | 'event' | 'major' | 'minor'; order?: 'day' | 'date' | 'position' | 'screenplay';
}
export function relatedCharacters(item: StoryLinks, relationship: TimelineFilter['relationship'] = 'present') {
  return relationship === 'all' ? [...new Set([...item.presentIds ?? [], ...item.involvedIds ?? [], ...item.remoteIds ?? [], ...item.referencedIds ?? []])] : item[`${relationship}Ids`] ?? [];
}
export function chronologyLabel(value: Chronology = {}) {
  return [value.day !== undefined ? `Day ${value.day}` : '', value.date, value.time || STORY_TIME_PERIODS.find(period => period.value === value.timeOfDay)?.label].filter(Boolean).join(' · ') || 'Unpositioned';
}
export type EventSceneRelationship = 'occurs' | 'revealed' | 'referenced';
export interface SceneEventRelationship { event: StoryEvent; relationship: EventSceneRelationship; }
export interface EffectiveScenePlotSource { type: 'explicit' | 'event'; eventId?: string; relationship?: 'occurs' | 'revealed'; }
export interface EffectiveScenePlot { plotId: string; sources: EffectiveScenePlotSource[]; }
export interface EffectivePlotScene { sceneId: string; sources: EffectiveScenePlotSource[]; }

interface StoryRelationshipIndex {
  eventsByScene: Map<string, Record<EventSceneRelationship, SceneEventRelationship[]>>;
  eventsByPlot: Map<string, StoryEvent[]>;
  plotsByScene: Map<string, EffectiveScenePlot[]>;
  scenesByPlot: Map<string, EffectivePlotScene[]>;
}
const activeRelationshipIndexes = new WeakMap<StoryRecord, StoryRelationshipIndex>();
const historicalRelationshipIndexes = new WeakMap<StoryRecord, StoryRelationshipIndex>();
const relationshipIndex = (story: StoryRecord, includeArchived: boolean): StoryRelationshipIndex => {
  const cache = includeArchived ? historicalRelationshipIndexes : activeRelationshipIndexes;
  const existing = cache.get(story);
  if (existing) return existing;
  const eventsByScene = new Map<string, Record<EventSceneRelationship, SceneEventRelationship[]>>();
  const eventsByPlot = new Map<string, StoryEvent[]>();
  const plotSourcesByScene = new Map<string, Map<string, EffectiveScenePlotSource[]>>();
  const sceneSourcesByPlot = new Map<string, Map<string, EffectiveScenePlotSource[]>>();
  const validPlot = (plotId: string) => story.plots.some(plot => plot.id === plotId && (includeArchived || !plot.archived));
  const addPlotScene = (plotId: string, sceneId: string, source: EffectiveScenePlotSource) => {
    if (!validPlot(plotId)) return;
    const plots = plotSourcesByScene.get(sceneId) ?? new Map<string, EffectiveScenePlotSource[]>();
    plots.set(plotId, [...plots.get(plotId) ?? [], source]); plotSourcesByScene.set(sceneId, plots);
    const scenes = sceneSourcesByPlot.get(plotId) ?? new Map<string, EffectiveScenePlotSource[]>();
    scenes.set(sceneId, [...scenes.get(sceneId) ?? [], source]); sceneSourcesByPlot.set(plotId, scenes);
  };
  for (const scene of story.scenes) for (const plotId of scene.plotIds ?? []) addPlotScene(plotId, scene.sceneId, { type: 'explicit' });
  for (const event of story.events) {
    if (event.archived && !includeArchived) continue;
    const addEventScene = (sceneId: string, relationship: EventSceneRelationship) => {
      const grouped = eventsByScene.get(sceneId) ?? { occurs: [], revealed: [], referenced: [] };
      grouped[relationship].push({ event, relationship }); eventsByScene.set(sceneId, grouped);
      if (relationship !== 'referenced') for (const plotId of event.plotIds ?? []) addPlotScene(plotId, sceneId, { type: 'event', eventId: event.id, relationship });
    };
    if (event.occursInSceneId) addEventScene(event.occursInSceneId, 'occurs');
    for (const sceneId of event.revealedInSceneIds ?? []) addEventScene(sceneId, 'revealed');
    for (const sceneId of event.referencedInSceneIds ?? []) addEventScene(sceneId, 'referenced');
    for (const plotId of event.plotIds ?? []) if (validPlot(plotId)) eventsByPlot.set(plotId, [...eventsByPlot.get(plotId) ?? [], event]);
  }
  const index = {
    eventsByScene,
    eventsByPlot,
    plotsByScene: new Map([...plotSourcesByScene].map(([sceneId, plots]) => [sceneId, [...plots].map(([plotId, sources]) => ({ plotId, sources }))])),
    scenesByPlot: new Map([...sceneSourcesByPlot].map(([plotId, scenes]) => [plotId, [...scenes].map(([sceneId, sources]) => ({ sceneId, sources }))])),
  };
  cache.set(story, index);
  return index;
};

/** Canonical Event ↔ Scene relationships, grouped without writing a reverse Scene copy. */
export function getEventsForScene(story: StoryRecord, sceneId: string, includeArchived = false) {
  return relationshipIndex(story, includeArchived).eventsByScene.get(sceneId) ?? { occurs: [], revealed: [], referenced: [] };
}

/** Event membership belongs only to Event.plotIds; Scene membership never assigns it. */
export function getEventsForPlot(story: StoryRecord, plotId: string, includeArchived = false) {
  return relationshipIndex(story, includeArchived).eventsByPlot.get(plotId) ?? [];
}

/** Effective Scene plots are explicit Scene links plus OCCURS/REVEALED Event plots. */
export function getEffectivePlotsForScene(story: StoryRecord, sceneId: string, includeArchived = false): EffectiveScenePlot[] {
  return relationshipIndex(story, includeArchived).plotsByScene.get(sceneId) ?? [];
}

export function getEffectiveScenesForPlot(story: StoryRecord, plotId: string, includeArchived = false): EffectivePlotScene[] {
  return relationshipIndex(story, includeArchived).scenesByPlot.get(plotId) ?? [];
}

export function queryTimeline(story: StoryRecord, screenplays: ScreenplayRecord[], filter: TimelineFilter = {}): TimelineItem[] {
  const scenes: TimelineItem[] = screenplays.flatMap(screenplay => screenplay.scenes.flatMap((scene, index) => {
    const explicitHeading = scene.elements.find(element => element.type === 'scene_heading')?.content ?? '';
    if (!hasMeaningfulSceneLocation(explicitHeading)) return [];
    return [{
    ...story.scenes.find(link => link.sceneId === scene.id), id: scene.id, sceneId: scene.id, screenplayId: screenplay.id,
    plotIds: getEffectivePlotsForScene(story, scene.id).map(item => item.plotId),
    kind: 'scene' as const, name: `${screenplay.title} · Scene ${index + 1}: ${sceneHeading(scene, index + 1)}`,
    description: scene.metadata.synopsis, screenplayOrder: index + 1,
  }]; }));
  const allSceneIds = new Set(screenplays.flatMap(screenplay => screenplay.scenes.map(scene => scene.id)));
  // Retain metadata for deleted scenes so undo/restoration reconnects the same ID.
  const missing: TimelineItem[] = story.scenes.filter(item => !allSceneIds.has(item.sceneId)).map(item => ({ ...item, id: item.sceneId, kind: 'scene', name: 'Removed scene (metadata retained)', description: '', missingScene: true }));
  const events: TimelineItem[] = story.events.filter(event => !event.archived).map(event => ({ ...resolveEvent(story, event), kind: 'event', sceneId: event.occursInSceneId, screenplayId: scenes.find(scene => scene.id === event.occursInSceneId)?.screenplayId, screenplayOrder: scenes.find(scene => scene.id === event.occursInSceneId)?.screenplayOrder }));
  const point = (value?: import('../shared/profiles').StoryPoint) => value?.sceneId ? story.scenes.find(item => item.sceneId === value.sceneId)?.chronology : value?.eventId ? events.find(item => item.id === value.eventId)?.chronology : value?.chronology;
  const layers: TimelineItem[] = [];
  if (filter.appearanceChanges) for (const character of story.characters.filter(item => !item.archived)) for (const appearance of character.profile?.appearances ?? []) {
    if (!appearance.from && !appearance.sceneIds?.length) continue;
    const sceneId = appearance.sceneIds?.[0] ?? appearance.from?.sceneId;
    layers.push({ id: 'appearance:' + appearance.id, kind: 'event', layer: 'appearance', profileId: character.id, name: character.name + ' · ' + appearance.name, description: appearance.description ?? '', chronology: point(appearance.from) ?? story.scenes.find(item => item.sceneId === sceneId)?.chronology, presentIds: [character.id], sceneId, screenplayId: scenes.find(item => item.id === sceneId)?.screenplayId });
  }
  if (filter.relationshipChanges) for (const relation of story.relationships ?? []) { const boundary = relation.audienceDiscoversAt ?? relation.from; if (boundary) layers.push({ id: 'relationship:' + relation.id, kind: 'event', layer: 'relationship', profileId: relation.fromId, name: (story.characters.find(item => item.id === relation.fromId)?.name ?? '') + (relation.directional ? ' → ' : ' ↔ ') + (story.characters.find(item => item.id === relation.toId)?.name ?? '') + ' · ' + (relation.type ?? relation.label), description: relation.description ?? '', chronology: point(boundary), presentIds: [relation.fromId, relation.toId] }); }
  const locationIds = new Set(filter.locationId ? [filter.locationId] : []);
  if (filter.includeChildLocations && filter.locationId) { let size = 0; while(size !== locationIds.size) { size = locationIds.size; for(const location of story.locations) if(location.parentId && locationIds.has(location.parentId)) locationIds.add(location.id); } }
  const presentationOrder = new Map(scenes.map((item,index) => [item.id,index]));
  const items = [...scenes, ...missing, ...events, ...layers].filter(item => {
    const characters = relatedCharacters(item, filter.allCharacters ? 'present' : filter.relationship);
    return (!item.layer || (!filter.allCharacters && !filter.kind)) && (!filter.screenplayId || item.screenplayId === filter.screenplayId) && (!filter.plotIds?.length || filter.plotIds.some(id => item.plotIds?.includes(id))) &&
      (!filter.characterIds?.length || (filter.allCharacters ? filter.characterIds.every(id => characters.includes(id)) : filter.characterIds.some(id => characters.includes(id)))) &&
      (!filter.locationId || !!item.locationId && locationIds.has(item.locationId)) &&
      (filter.day === undefined || item.chronology?.day === filter.day) &&
      (filter.fromDay === undefined || (item.chronology?.day !== undefined && item.chronology.day >= filter.fromDay)) &&
      (filter.toDay === undefined || (item.chronology?.day !== undefined && item.chronology.day <= filter.toDay)) &&
      (!filter.kind || (filter.kind === 'major' ? item.kind === 'event' && item.major : filter.kind === 'minor' ? item.kind === 'event' && !item.major : item.kind === filter.kind));
  });
  const key = (item: TimelineItem): number => {
    const c = item.chronology;
    if (filter.order === 'screenplay') return presentationOrder.get(item.sceneId ?? item.id) ?? Infinity;
    if (filter.order === 'position') return c?.position ?? Infinity;
    const time = c?.time ? Number(c.time.slice(0, 2)) * 60 + Number(c.time.slice(3)) : STORY_TIME_PERIODS.find(period => period.value === c?.timeOfDay)?.sortMinute ?? 0;
    if (filter.order === 'date') return c?.date ? Date.parse(c.date) / 60000 + time : Infinity;
    return c?.day !== undefined ? c.day * 1440 + time : c?.date ? 1e10 + Date.parse(c.date) / 60000 + time : Infinity;
  };
  return items.sort((a, b) => (key(a) - key(b)) || ((a.chronology?.position ?? Infinity) - (b.chronology?.position ?? Infinity)) || 0);
}

export function deleteStoryEntity(story: StoryRecord, kind: 'plots' | 'characters' | 'locations' | 'events', id: string): StoryRecord {
  const clean = <T extends StoryLinks>(item: T): T => ({ ...item,
    ...(kind === 'plots' ? { plotIds: item.plotIds?.filter(value => value !== id) } : {}),
    ...(kind === 'characters' ? { presentIds: item.presentIds?.filter(value => value !== id), involvedIds: item.involvedIds?.filter(value => value !== id), remoteIds: item.remoteIds?.filter(value => value !== id), referencedIds: item.referencedIds?.filter(value => value !== id), ...('participantIds' in item ? { participantIds: (item as unknown as { participantIds?: string[] }).participantIds?.filter(value => value !== id) } : {}) } : {}),
    ...(kind === 'locations' && item.locationId === id ? { locationId: undefined } : {}),
  });
  const entity = story[kind].find(item => item.id === id);
  const sourceNames = entity ? [...new Set([entity.name.trim().toUpperCase(), ...entity.sourceNames ?? []])] : [];
  const ignored = kind === 'characters' ? { ignoredCharacterNames: [...new Set([...story.ignoredCharacterNames ?? [], ...sourceNames])] } : kind === 'locations' ? { ignoredLocationNames: [...new Set([...story.ignoredLocationNames ?? [], ...sourceNames])] } : {};
  return { ...story, ...ignored, relationships: kind === 'characters' ? story.relationships?.filter(item => item.fromId !== id && item.toId !== id) : story.relationships, [kind]: story[kind].filter(item => item.id !== id).map(item => ({ ...item, ...(item.parentId === id ? { parentId: undefined } : {}) })), plots: story.plots.filter(item => kind !== 'plots' || item.id !== id).map(item => ({ ...item, ...(kind === 'plots' && item.parentId === id ? { parentId: undefined } : {}), ...(kind === 'events' && item.resolutionEventId === id ? { resolutionEventId: undefined } : {}) })), scenes: story.scenes.map(item => ({ ...clean(item), derived: item.derived ? clean(item.derived) : undefined })), events: story.events.filter(item => kind !== 'events' || item.id !== id).map(clean) };
}

/** Resolve context at read time. Absent override metadata identifies legacy independent events. */
export function resolveEvent(story: StoryRecord, event: StoryEvent): StoryEvent {
  const scene = story.scenes.find(item => item.sceneId === event.occursInSceneId);
  if (!scene || !event.contextOverrides) return { ...event, presentIds: event.participantIds ?? event.presentIds };
  const overridden = (key: string) => event.contextOverrides!.includes(key);
  const chronology: Chronology = {};
  for (const field of ['day', 'date', 'time', 'timeOfDay', 'position'] as const) {
    Object.assign(chronology, { [field]: overridden('chronology.' + field) ? event.chronology?.[field] : scene.chronology?.[field] });
  }
  return { ...event, chronology,
    plotIds: event.plotIds,
    locationId: overridden('locationId') ? event.locationId : scene.locationId,
    presentIds: scene.presentIds,
    participantIds: event.participantIds ?? [],
  };
}
export function activitySummary(items: TimelineItem[]) {
  const days = items.flatMap(item => item.chronology?.day === undefined ? [] : [item.chronology.day]);
  return {
    scenes: items.filter(item => item.kind === 'scene').length,
    events: items.filter(item => item.kind === 'event').length,
    screenplayIds: [...new Set(items.flatMap(item => item.screenplayId ? [item.screenplayId] : []))],
    plotIds: [...new Set(items.flatMap(item => item.plotIds ?? []))],
    characterIds: [...new Set(items.flatMap(item => item.presentIds ?? []))],
    locationIds: [...new Set(items.flatMap(item => item.locationId ? [item.locationId] : []))],
    first: items[0], latest: items.at(-1),
    range: days.length ? 'Day ' + Math.min(...days) + ' → Day ' + Math.max(...days) : '',
  };
}

