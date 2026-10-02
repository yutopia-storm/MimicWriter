import type { ScreenplayRecord } from '../shared/models';
import type { Chronology, SceneStory, StoryEntity, StoryLinks, StoryRecord } from '../shared/story';
import { STORY_SECONDS_PER_PAGE, STORY_TIME_PERIODS, periodFromTime } from '../shared/story-config';
import { resolveLayout } from '../shared/screenplay-layout';
import { parseCharacterCue } from './continuous-editor';
import { paginateScreenplay, scenePagination } from './pagination';

const canonical = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const physicalAction = '(?:enters?|exits?|walks?|runs?|sits?|stands?|looks?|turns?|opens?|closes?|reaches?|picks?|takes?|puts?|grabs?|holds?|smiles?|nods?|shakes?|drives?|arrives?|leaves?|waits?|wakes?|sleeps?|falls?|jumps?|crosses?|steps?|kneels?|crouches?|stares?|watches?|follows?|approaches?|whispers?|shouts?|says?|asks?|replies?)';
const headingSyntaxToken = /\b(?:INT(?:ERIOR)?|EXT(?:ERIOR)?|I|E|EARLY\s+MORNING|MOMENTS\s+LATER|SAME\s+TIME|LATE\s+NIGHT|MORNING|MIDDAY|AFTERNOON|EVENING|NIGHT|DAY|CONTINUOUS|LATER)\b/gi;

function meaningfulLocation(value: string) {
  return /[\p{L}\p{N}]/u.test(value.replace(headingSyntaxToken, '').replace(/[\s./\\()[\]{}:;,_—–-]+/g, ''));
}

/** Only scene-heading suffixes are time indicators: NIGHT CLUB is a location. */
export function extractSceneHeading(heading: string): { location?: string; parentLocation?: string; area?: string; chronology: Chronology } {
  const clean = heading.trim().replace(/^(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\.?\s*\/\s*E\.?|INT\.?|EXT\.?)(?:\s+|$)/i, '');
  const parts = clean.split(/\s+[—–-]\s+/);
  const suffix = parts.length > 1 ? parts.at(-1)!.trim() : /^(DAY|NIGHT|CONTINUOUS|LATER|MOMENTS LATER|EARLY MORNING|MORNING|MIDDAY|AFTERNOON|EVENING|LATE NIGHT)$/i.test(clean) ? clean : '';
  const upper = canonical(suffix.replace(/\([^)]*\)/g, '').trim());
  const period = STORY_TIME_PERIODS.find(period => period.headings.some(label => upper === label || upper.startsWith(label + ' ')));
  const clock = upper.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/);
  const hourOnly = !clock ? upper.match(/\b(\d{1,2})\s*(AM|PM)\b/) : null;
  let time: string | undefined;
  if (clock || hourOnly) {
    let hours = Number(clock?.[1] ?? hourOnly?.[1]);
    const minutes = Number(clock?.[2] ?? 0);
    const meridiem = clock?.[3] ?? hourOnly?.[2];
    if (meridiem && hours >= 1 && hours <= 12) hours = hours % 12 + (meridiem === 'PM' ? 12 : 0);
    if (hours < 24 && minutes < 60) time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const type = /\bFLASHBACK\b/i.test(suffix) ? 'flashback' : /\bFLASH\s*FORWARD\b/i.test(suffix) ? 'flashforward' : undefined;
  const isTimeSuffix = period || time || type || /^(CONTINUOUS|LATER|SAME TIME|MOMENTS LATER)$/i.test(upper);
  const locationCandidate = (isTimeSuffix ? parts.slice(0, -1).join(' - ') : clean).trim();
  const location = meaningfulLocation(locationCandidate) ? locationCandidate : '';
  const locationParts = location.split(/\s+[—–-]\s+/);
  return { ...(locationParts.length > 1 ? { parentLocation: locationParts.slice(0, -1).join(' - '), area: locationParts.at(-1) } : {}), location: location || undefined, chronology: { timeOfDay: time ? periodFromTime(time) : period?.value, time, type } };
}

/** A scene is timeline-eligible only when its explicit heading contains a real location. */
export function hasMeaningfulSceneLocation(heading: string) {
  return Boolean(extractSceneHeading(heading).location);
}

export function durationFromPages(pageFraction: number): number {
  return Math.max(0, Math.round(pageFraction * STORY_SECONDS_PER_PAGE)) / 60;
}
export function durationLabel(minutes: number): string {
  const seconds = Math.round(minutes * 60);
  return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ""}`;
}

/** Remember explicit clears as well as edits so extraction cannot undo writer decisions. */
export function markSceneOverrides(previous: SceneStory, next: StoryLinks): SceneStory {
  const manual = new Set(previous.manualFields ?? []);
  for (const field of ['presentIds', 'involvedIds', 'remoteIds', 'referencedIds', 'locationId'] as const) {
    if (!same(previous[field], next[field])) manual.add(field);
  }
  for (const field of ['timeOfDay', 'time', 'duration', 'type'] as const) {
    if (!same(previous.chronology?.[field], next.chronology?.[field])) manual.add(`chronology.${field}`);
  }
  return { ...previous, ...next, manualFields: [...manual] };
}

/** Deterministic defaults from explicit screenplay structure; no AI or prose rewriting. */
export function synchronizeSceneDefaults(story: StoryRecord, documents: ScreenplayRecord[]): StoryRecord {
  const next: StoryRecord = structuredClone(story);
  // Retain old erroneous token entities for recovery, but remove them from active indexes.
  for (const location of next.locations) if (!meaningfulLocation(location.name) && location.sourceElementIds?.length) location.archived = true;
  const sourceNames = new Map<string, string>();
  for (const document of documents) for (const scene of document.scenes) for (const element of scene.elements) {
    if (element.type === 'character') sourceNames.set(element.id, canonical(parseCharacterCue(element.content).name));
    if (element.type === 'scene_heading') sourceNames.set(element.id, canonical(extractSceneHeading(element.content).location ?? ''));
  }
  const findEntity = (kind: 'characters' | 'locations', name: string, sourceId?: string): StoryEntity | undefined => {
    const key = canonical(name);
    if (!key || (kind === 'characters' ? next.ignoredCharacterNames : next.ignoredLocationNames)?.includes(key)) return;
    let entity = next[kind].find(item => canonical(item.name) === key || item.sourceNames?.includes(key) || (kind === 'locations' && item.profile?.aliases?.some(name => canonical(name) === key)));
    if (!entity && sourceId) {
      const bound = next[kind].find(item => item.sourceElementIds?.includes(sourceId));
      // A single cue/heading being typed keeps its ID instead of creating partial-name entities.
      // A changed cue amongst other unchanged cues instead creates/reuses the new character.
      if (bound && !(kind === 'locations' && next.events.some(event => event.locationId === bound.id && (!event.contextOverrides || event.contextOverrides.includes('locationId')))) && !bound.sourceElementIds?.some(id => id !== sourceId && sourceNames.has(id) && sourceNames.get(id) !== key)) {
        entity = bound;
        if ((entity.sourceNames?.length ?? 0) <= 1 && entity.sourceNames?.includes(canonical(entity.name))) {
          entity.name = name.trim();
          // Intermediate typing such as A → AP → APPLE must not leave "A" as an alias.
          entity.sourceNames = [key];
        }
      }
    }
    if (!entity) { entity = { id: crypto.randomUUID(), name: name.trim(), description: '', sourceNames: [key] }; next[kind].push(entity); }
    else if (!entity.sourceNames?.includes(key)) entity.sourceNames = [...entity.sourceNames ?? [], key];
    if (sourceId) {
      for (const other of next[kind]) if (other !== entity && other.sourceElementIds?.includes(sourceId)) other.sourceElementIds = other.sourceElementIds.filter(id => id !== sourceId);
      if (!entity.sourceElementIds?.includes(sourceId)) entity.sourceElementIds = [...entity.sourceElementIds ?? [], sourceId];
    }
    return entity;
  };
  // Register cues project-wide first, so non-speaking appearances can reuse their IDs.
  for (const document of documents) for (const scene of document.scenes) {
    for (const element of scene.elements) {
      if (element.type === 'character') findEntity('characters', parseCharacterCue(element.content).name, element.id);
      if (element.type === 'action') {
        // Conventional capitalized introductions with age or a direct physical action.
        const introductions = new RegExp(`(?:^|[.!?]\\s+|\\n)([A-Z][A-Za-z'’\\-]*(?: [A-Z][A-Za-z'’\\-]*){0,2})(?=,?\\s+(?:\\(?\\d{1,3}\\b|${physicalAction}\\b))`, 'g');
        for (const match of element.content.matchAll(introductions)) {
          if (!/^(THE|A|AN|WE|HE|SHE|THEY|IT|SOMEONE|SOMEBODY|EVERYONE)( |$)/i.test(match[1])) findEntity('characters', match[1]);
        }
      }
    }
  }
  for (const document of documents) {
    const layout = resolveLayout(document.layout);
    const spans = scenePagination(paginateScreenplay(document, layout, document.showDialogueContinuations !== false), layout);
    for (const scene of document.scenes) {
      if (next.autoFillDisabledSceneIds?.includes(scene.id)) continue;
      const headingElement = scene.elements.find(element => element.type === 'scene_heading');
      const heading = headingElement?.content ?? '';
      const extracted = extractSceneHeading(heading);
      const location = extracted.location ? findEntity('locations', extracted.location, headingElement?.id) : undefined;
      const present = new Set<string>(), involved = new Set<string>(), referenced = new Set<string>();
      for (const element of scene.elements) {
        if (element.type === 'character') {
          const cue = parseCharacterCue(element.content);
          const character = findEntity('characters', cue.name, element.id);
          if (character) {
            if (/V\.?\s*O\.?|VOICE\s*OVER|ON (?:THE )?PHONE|FILTERED/i.test(cue.extension ?? '')) involved.add(character.id);
            else present.add(character.id);
          }
        }
        if (element.type === 'action' || element.type === 'dialogue') {
          for (const character of next.characters) {
            const names = [...new Set([canonical(character.name), ...character.sourceNames ?? []])].filter(Boolean);
            for (const name of names) {
              const token = escapePattern(name);
              if (!new RegExp(`(?<![\\p{L}\\p{N}])${token}(?![\\p{L}\\p{N}])`, 'iu').test(element.content)) continue;
              const subject = new RegExp(`(?:^|[.!?]\\s+|\\n)${token}(?:,\\s*\\(?\\d{1,3}\\)?[,]?)?\\s+${physicalAction}\\b`, 'imu');
              const introduction = new RegExp(`(?:^|[.!?]\\s+|\\n)${token},?\\s+\\(?\\d{1,3}\\b`, 'imu');
              if (element.type === 'action' && (subject.test(element.content) || introduction.test(element.content))) present.add(character.id);
              else referenced.add(character.id);
            }
          }
        }
      }
      const occupied = scene.elements.some(element => element.content.trim());
      const extractedLinks: StoryLinks = {
        presentIds: [...present], remoteIds: [...involved], referencedIds: [...referenced].filter(id => !present.has(id)),
        locationId: location?.id,
        chronology: { ...extracted.chronology, duration: occupied ? durationFromPages(spans.get(scene.id)?.pageFraction ?? 0) : undefined },
      };
      const existing = next.scenes.find(item => item.sceneId === scene.id);
      if (!existing && !occupied) continue;
      const link: SceneStory = existing ?? { sceneId: scene.id, screenplayId: document.id };
      const managed = (path: string, current: unknown, previous: unknown) => !link.manualFields?.includes(path) && (current === undefined || same(current, previous));
      for (const field of ['presentIds', 'involvedIds', 'remoteIds', 'referencedIds', 'locationId'] as const) {
        if (field === 'locationId' || field !== 'involvedIds' && managed(field, link[field], link.derived?.[field])) Object.assign(link, { [field]: extractedLinks[field] });
      }
      const chronology = { ...link.chronology };
      for (const field of ['timeOfDay', 'time', 'duration', 'type'] as const) {
        if (managed(`chronology.${field}`, chronology[field], link.derived?.chronology?.[field])) Object.assign(chronology, { [field]: extractedLinks.chronology?.[field] });
      }
      if (chronology.time) chronology.timeOfDay = periodFromTime(chronology.time);
      link.screenplayId = document.id;
      link.chronology = chronology;
      link.derived = extractedLinks;
      if (!existing) next.scenes.push(link);
    }
  }
  return same(next, story) ? story : next;
}

/** Re-read managed fields only; manual chronology, plot choices, notes and relationships survive. */
export function refreshScene(story: StoryRecord, documents: ScreenplayRecord[], sceneId: string) {
  return synchronizeSceneDefaults({ ...story, autoFillDisabledSceneIds: story.autoFillDisabledSceneIds?.filter(id => id !== sceneId) }, documents);
}
