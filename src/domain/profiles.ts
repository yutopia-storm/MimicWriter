import type { ScreenplayRecord } from '../shared/models';
import type { Appearance, CharacterRelationship, RelationshipType, StoryPoint } from '../shared/profiles';
import type { Chronology, StoryEntity, StoryRecord } from '../shared/story';
import { parseCharacterCue } from './continuous-editor';
import { queryTimeline, resolveEvent } from './story';
import { STORY_TIME_PERIODS } from '../shared/story-config';
import { compareWorldPoints } from './worlds';

const key = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
export function ageFromDateOfBirth(value: string, today = new Date()): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 ? age : undefined;
}
export function dateOfBirthLabel(value: string, today = new Date()) {
  const age = ageFromDateOfBirth(value, today);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(match[2]) - 1];
  if (!month) return value;
  const formatted = `${match[3]} . ${month} . ${match[1]}`;
  return age === undefined ? formatted : `${formatted} (${age})`;
}
export function cueCharacter(story: StoryRecord, text: string, sourceElementId?: string) {
  const name = key(parseCharacterCue(text).name);
  const bound = sourceElementId ? story.characters.find(item => item.sourceElementIds?.includes(sourceElementId)) : undefined;
  if (bound) return bound;
  const direct = story.characters.find(item => key(item.name) === name || item.sourceNames?.some(alias => key(alias) === name));
  if (direct) return direct;
  const retainedMerge = story.identityMerges?.find(item => item.kind === 'characters' && [item.source.name, ...item.source.sourceNames ?? []].some(alias => key(alias) === name));
  return retainedMerge ? story.characters.find(item => item.id === retainedMerge.targetId) : undefined;
}
export function locationFamily(story: StoryRecord, id: string): string[] {
  const result = new Set([id]);
  let size = 0;
  while (size !== result.size) { size = result.size; for (const item of story.locations) if (item.parentId && result.has(item.parentId)) result.add(item.id); }
  return [...result];
}
export function pointChronology(story: StoryRecord, point?: StoryPoint): Chronology | undefined {
  if (!point) return;
  if (point.sceneId) return story.scenes.find(item => item.sceneId === point.sceneId)?.chronology;
  if (point.eventId) { const event = story.events.find(item => item.id === point.eventId); return event ? resolveEvent(story, event).chronology : undefined; }
  return point.chronology;
}
function time(c: Chronology) { return c.time ? Number(c.time.slice(0, 2)) * 60 + Number(c.time.slice(3)) : STORY_TIME_PERIODS.find(item => item.value === c.timeOfDay)?.sortMinute ?? 0; }
function compare(a: Chronology | undefined, b: Chronology | undefined): number | undefined {
  if (!a || !b) return;
  if (a.day !== undefined && b.day !== undefined) return (a.day - b.day) * 1440 + (b.time || b.timeOfDay ? time(a) - time(b) : 0);
  if (a.date && b.date) return (Date.parse(a.date) - Date.parse(b.date)) / 60000 + (b.time || b.timeOfDay ? time(a) - time(b) : 0);
  if (a.position !== undefined && b.position !== undefined) return a.position - b.position;
}
export function pointRangeApplies(story: StoryRecord, c: Chronology | undefined, from?: StoryPoint, until?: StoryPoint) {
  const lower = from ? compare(c, pointChronology(story, from)) : 0;
  const upper = until ? compare(c, pointChronology(story, until)) : 0;
  return lower !== undefined && upper !== undefined && lower >= 0 && upper <= 0;
}
function gendered(character: StoryEntity | undefined, masculine: RelationshipType, feminine: RelationshipType, neutral: RelationshipType): RelationshipType {
  const pronouns = character?.profile?.pronouns?.toLowerCase() ?? '';
  if (/\b(he|him|his)\b/.test(pronouns)) return masculine;
  if (/\b(she|her|hers)\b/.test(pronouns)) return feminine;
  return neutral;
}
function reciprocalType(type: RelationshipType | undefined, from: StoryEntity | undefined): RelationshipType {
  if (['Brother','Sister','Sibling'].includes(type ?? '')) return gendered(from, 'Brother', 'Sister', 'Sibling');
  if (['Dad','Mum','Parent'].includes(type ?? '')) return gendered(from, 'Son', 'Daughter', 'Child');
  if (['Son','Daughter','Child'].includes(type ?? '')) return gendered(from, 'Dad', 'Mum', 'Parent');
  if (['Granddad','Grandma','Grandparent'].includes(type ?? '')) return gendered(from, 'Grandson', 'Granddaughter', 'Grandchild');
  if (['Grandson','Granddaughter','Grandchild'].includes(type ?? '')) return gendered(from, 'Granddad', 'Grandma', 'Grandparent');
  if (['Uncle','Aunty'].includes(type ?? '')) return gendered(from, 'Nephew', 'Niece', 'Child');
  if (['Nephew','Niece'].includes(type ?? '')) return gendered(from, 'Uncle', 'Aunty', 'Parent');
  if (['Wife','Husband','Spouse'].includes(type ?? '')) return gendered(from, 'Husband', 'Wife', 'Spouse');
  if (['Boyfriend','Girlfriend','Partner'].includes(type ?? '')) return gendered(from, 'Boyfriend', 'Girlfriend', 'Partner');
  if (['Fiancé','Fiancée'].includes(type ?? '')) return gendered(from, 'Fiancé', 'Fiancée', 'Partner');
  return type ?? 'Other';
}
export interface EffectiveRelationship extends CharacterRelationship { derived?: boolean; derivedFromIds?: string[]; }
export function effectiveRelationships(story: StoryRecord): EffectiveRelationship[] {
  const direct = story.relationships ?? [];
  const result: EffectiveRelationship[] = direct.map(item => ({ ...item, type: item.type ?? 'Other' }));
  for (const item of direct) if (!item.directional) result.push({ ...item, id: `reciprocal:${item.id}`, fromId: item.toId, toId: item.fromId, type: reciprocalType(item.type, story.characters.find(character => character.id === item.fromId)), label: reciprocalType(item.type, story.characters.find(character => character.id === item.fromId)), derived: true, derivedFromIds: [item.id] });
  const spouse = direct.filter(item => ['Wife','Husband','Spouse'].includes(item.type ?? item.label));
  const sibling = direct.filter(item => ['Brother','Sister','Sibling'].includes(item.type ?? item.label));
  const pairs = (relation: CharacterRelationship) => [[relation.fromId, relation.toId], [relation.toId, relation.fromId]] as const;
  for (const marriage of spouse) for (const [person, partner] of pairs(marriage)) for (const relation of sibling) for (const [member, siblingId] of pairs(relation)) if (partner === member && person !== siblingId && !result.some(item => item.fromId === person && item.toId === siblingId)) {
    const siblingCharacter = story.characters.find(item => item.id === siblingId), personCharacter = story.characters.find(item => item.id === person);
    const toType = gendered(siblingCharacter, 'Brother', 'Sister', 'Sibling'), fromType = gendered(personCharacter, 'Brother', 'Sister', 'Sibling');
    result.push({ id: `in-law:${marriage.id}:${relation.id}:${person}`, fromId: person, toId: siblingId, type: toType, modifier: 'in-law', label: `${toType} in-law`, derived: true, derivedFromIds: [marriage.id, relation.id], audienceDiscoversAt: relation.audienceDiscoversAt ?? marriage.audienceDiscoversAt });
    result.push({ id: `in-law:${marriage.id}:${relation.id}:${siblingId}`, fromId: siblingId, toId: person, type: fromType, modifier: 'in-law', label: `${fromType} in-law`, derived: true, derivedFromIds: [marriage.id, relation.id], audienceDiscoversAt: relation.audienceDiscoversAt ?? marriage.audienceDiscoversAt });
  }
  return result;
}
export function relationshipVisibleAt(story: StoryRecord, relationship: CharacterRelationship, chronology?: Chronology, characterId?: string) {
  const discovery = characterId ? relationship.characterDiscoveries?.find(item => item.characterId === characterId)?.at : relationship.audienceDiscoversAt;
  return !discovery || !chronology || pointRangeApplies(story, chronology, discovery);
}
export function relationshipDisplayName(relationship: CharacterRelationship) {
  const type = (relationship.type ?? relationship.label) || 'Relationship';
  return relationship.modifier === 'in-law' ? `${type} in-law` : relationship.modifier ? `${relationship.modifier} ${type}` : type;
}
export function appearanceForScene(story: StoryRecord, character: StoryEntity, sceneId?: string, documents: ScreenplayRecord[] = []): { appearance?: Appearance; conflicts: Appearance[] } {
  const appearances = character.profile?.appearances ?? [];
  const applies = (item: Appearance) => {
    if (!sceneId) return false;
    const at = {sceneId};
    const lower = item.from ? compareWorldPoints(at,item.from,story,documents) : 0;
    const upper = item.until ? compareWorldPoints(at,item.until,story,documents) : -1;
    return lower !== undefined && upper !== undefined && lower >= 0 && upper < 0;
  };
  const ranked = appearances.map(item => ({ item, rank: sceneId && item.sceneIds?.includes(sceneId) ? 4 : !item.sceneIds?.length && (item.from || item.until) && applies(item) ? (item.from?.eventId || item.from?.sceneId || item.until?.eventId || item.until?.sceneId ? 3 : 2) : item.isDefault ? 1 : 0 })).filter(item => item.rank > 0);
  const best = Math.max(0, ...ranked.map(item => item.rank));
  const choices = ranked.filter(item => item.rank === best).map(item => item.item);
  return choices.length === 1 ? { appearance: choices[0], conflicts: [] } : { conflicts: choices };
}
export function profileActivity(story: StoryRecord, documents: ScreenplayRecord[], type: 'character' | 'location', id: string, descendants = false) {
  const locations = descendants ? locationFamily(story, id) : [id];
  return queryTimeline(story, documents).filter(item => type === 'character' ? item.presentIds?.includes(id) : item.locationId && locations.includes(item.locationId));
}
export function characterStatistics(story: StoryRecord, documents: ScreenplayRecord[], id: string) {
  let words = 0, blocks = 0;
  const appearances: { sceneId: string; screenplayId: string; cue: string }[] = [];
  for (const document of documents) for (const scene of document.scenes) {
    let speaker: string | undefined;
    for (const element of scene.elements) {
      if (element.type === 'character') {
        speaker = cueCharacter(story, element.content)?.id;
        if (speaker === id && !appearances.some(item => item.sceneId === scene.id)) appearances.push({ sceneId: scene.id, screenplayId: document.id, cue: element.content });
      } else if (element.type === 'dialogue' && speaker === id) { blocks++; words += element.content.trim().split(/\s+/).filter(Boolean).length; }
      else if (element.type !== 'parenthetical' && element.type !== 'dialogue') speaker = undefined;
    }
  }
  const scenes = documents.flatMap(document => document.scenes.map(scene => ({ scene, document })));
  const presence = scenes.filter(({ scene }) => story.scenes.find(item => item.sceneId === scene.id)?.presentIds?.includes(id));
  const entity = story.characters.find(item => item.id === id);
  return { words, blocks, appearances, firstScreenplay: appearances[0], firstNamed: appearances.find(item => key(parseCharacterCue(item.cue).name) === key(entity?.name ?? '')), sceneCount: presence.length,
    minutes: presence.reduce((sum, { scene }) => sum + (story.scenes.find(item => item.sceneId === scene.id)?.chronology?.duration ?? 0), 0),
    episodeCount: new Set(presence.map(item => item.document.id)).size,
  };
}
