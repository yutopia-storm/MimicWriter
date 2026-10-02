import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldRecord, WorldPoint, WorldRelationship } from '../shared/worlds';
import { compareWorldPoints, relationshipAt } from './worlds';
import { chronologyLabel } from './story';

export function matchingCharacters(story: StoryRecord, name: string) {
  const key=(value:string)=>value.trim().replace(/\s+/g,' ').toUpperCase();
  return name.trim() ? story.characters.filter(c=>[c.name,...c.sourceNames ?? [],...c.profile?.aliases ?? []].some(value=>key(value)===key(name))) : [];
}

export function characterMemberships(story: StoryRecord, characterId: string, documents: ScreenplayRecord[], at?: WorldPoint, history = false) {
  return (story.worlds ?? []).flatMap(world => world.relationships.filter(r => r.type === 'member of' && r.from.kind === 'character' && r.from.id === characterId && (history || !world.archived && relationshipAt(r, at, story, documents) === 'active')).map(relationship => ({ world, relationship })));
}
export function membershipDetails(world: WorldRecord, story: StoryRecord, r: WorldRelationship) {
  const organisation = world.entities.find(e => e.kind === 'organisation' && e.id === r.to.id);
  return { organisation, unit: world.entities.find(e => e.kind === 'structure' && e.id === r.unitId), rank: world.entities.find(e => e.id === r.rankId), position: world.entities.find(e => e.id === r.positionId), reportsTo: story.characters.find(e => e.id === r.reportsToId) };
}
export function worldPointLabel(point: WorldPoint | undefined, story: StoryRecord, documents: ScreenplayRecord[], fallback: string) {
  if (!point) return fallback;
  if (point.screenplayId) return documents.find(d => d.id === point.screenplayId)?.title ?? 'Removed episode';
  if (point.sceneId) { const d = documents.find(d => d.scenes.some(s => s.id === point.sceneId)); return d ? `${d.title} · Scene ${d.scenes.findIndex(s => s.id === point.sceneId) + 1}` : 'Removed scene'; }
  if (point.eventId) return story.events.find(e => e.id === point.eventId)?.name ?? 'Removed event';
  return chronologyLabel(point.chronology) || 'Story time not set';
}
/** Whole-episode end-exclusive bounds can be displayed as the last included episode. */
export function membershipPeriod(r: WorldRelationship, story: StoryRecord, documents: ScreenplayRecord[]) {
  const start = worldPointLabel(r.fromPoint, story, documents, 'Start not set');
  const endIndex = documents.findIndex(d => d.id === r.untilPoint?.screenplayId);
  const startIndex = documents.findIndex(d => d.id === r.fromPoint?.screenplayId);
  const end = r.untilPoint ? endIndex > 0 && startIndex >= 0 && startIndex < endIndex ? documents[endIndex - 1].title : 'Before ' + worldPointLabel(r.untilPoint, story, documents, '') : 'Present';
  return `${start} → ${end}${r.archived ? ' · Archived' : ''}`;
}
export function reportingCharacters(world: WorldRecord, story: StoryRecord, characterId: string, organisationId: string, documents: ScreenplayRecord[], at?: WorldPoint, retainedId?: string) {
  return story.characters.filter(c => c.id !== characterId && (c.id === retainedId || !c.archived && world.relationships.some(r => r.type === 'member of' && r.from.kind === 'character' && r.from.id === c.id && r.to.id === organisationId && relationshipAt(r, at, story, documents) === 'active')));
}
/** Lower numbers are more senior; level 1 is the top. Unassigned ranks never invent a reporting chain. */
export function hierarchyReporters(world: WorldRecord, story: StoryRecord, r: WorldRelationship, documents: ScreenplayRecord[], at?: WorldPoint) {
  const level = world.entities.find(e => e.id === r.rankId)?.rankLevel;
  if (level === undefined) return [];
  const candidates = world.relationships.filter(other => other.type === 'member of' && other.from.kind === 'character' && other.from.id !== r.from.id && other.to.id === r.to.id && other.unitId === r.unitId && relationshipAt(other, at, story, documents) === 'active' && story.characters.some(c => c.id === other.from.id && !c.archived)).map(other => ({id:other.from.id,level:world.entities.find(e => e.id === other.rankId)?.rankLevel})).filter((c):c is {id:string;level:number} => c.level !== undefined && c.level < level);
  const nearest = Math.max(...candidates.map(c => c.level));
  return [...new Set(candidates.filter(c => c.level === nearest).map(c => c.id))];
}
export function membershipReporterIds(world: WorldRecord, story: StoryRecord, r: WorldRelationship, documents: ScreenplayRecord[], at?: WorldPoint) {
  const eligible = hierarchyReporters(world, story, r, documents, at);
  if (r.reportsToIds) return [...new Set(r.reportsToIds)].filter(id => eligible.includes(id));
  return r.reportsToId ? [r.reportsToId] : eligible;
}
export function saveMembership(world: WorldRecord, story: StoryRecord, r: WorldRelationship, documents: ScreenplayRecord[], transferFrom?: string) {
  if (!story.characters.some(c => c.id === r.from.id) || r.from.kind !== 'character') throw Error('Choose an existing Character.');
  if (!world.entities.some(e => e.id === r.to.id && e.kind === 'organisation') || r.to.kind !== 'organisation') throw Error('Choose an Organisation in this World.');
  if (r.unitId && !world.entities.some(e => e.id === r.unitId && e.kind === 'structure' && e.organisationId === r.to.id)) throw Error('Choose a unit belonging to this Organisation.');
  for (const [id,kind] of [[r.rankId,'rank'],[r.positionId,'position']] as const) if (id && !world.entities.some(e => e.id === id && (e.kind === kind || e.organisationRole === kind) && (!e.organisationId || e.organisationId === r.to.id))) throw Error(`Choose a ${kind} belonging to this Organisation.`);
  const position=world.entities.find(e=>e.id===r.positionId);
  if(position?.unitIds?.length&&(!r.unitId||!position.unitIds.includes(r.unitId))) throw Error('This position is not available in the selected unit.');
  if(position?.allowedRankIds?.length&&r.rankId&&!position.allowedRankIds.includes(r.rankId)) throw Error('This rank cannot be used with the selected position.');
  const previous = transferFrom ? world.relationships.find(x => x.id === transferFrom) : undefined;
  if (transferFrom && (!previous || previous.from.id !== r.from.id || previous.type !== 'member of' || previous.untilPoint || previous.archived || previous.id === r.id)) throw Error('The membership changed. Reopen the transfer.');
  if (previous && !r.fromPoint) throw Error('Choose when the transfer begins.');
  if (previous?.fromPoint && r.fromPoint) { const order=compareWorldPoints(previous.fromPoint,r.fromPoint,story,documents); if (order !== undefined && order >= 0) throw Error('The transfer must begin after the existing membership starts.'); }
  if (r.fromPoint && r.untilPoint) { const order=compareWorldPoints(r.fromPoint,r.untilPoint,story,documents); if (order !== undefined && order >= 0) throw Error('The end must be after the start.'); }
  if (r.reportsToId && !reportingCharacters(world,story,r.from.id,r.to.id,documents,r.fromPoint,r.id === previous?.id ? previous.reportsToId : world.relationships.find(x=>x.id===r.id)?.reportsToId).some(c=>c.id===r.reportsToId)) throw Error('Choose a reporting Character associated with this Organisation.');
  if (r.reportsToIds) {
    const allowed = hierarchyReporters(world,story,r,documents,r.fromPoint);
    for (const id of r.reportsToIds) if (id === r.from.id || !allowed.includes(id)) throw Error('Choose a reporting Character at the next higher rank in this unit.');
  }
  return { ...world, characterIds: [...new Set([...world.characterIds,r.from.id])], relationships: [...world.relationships.filter(x => x.id !== r.id).map(x => x.id === transferFrom ? { ...x, untilPoint: r.fromPoint } : x), r] };
}
