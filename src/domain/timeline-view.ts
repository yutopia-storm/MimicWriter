import type { ScreenplayRecord } from '../shared/models';
import type { Chronology, StoryRecord } from '../shared/story';
import { getEventsForScene, orderSceneEvents, queryTimeline, resolveEvent, sortTimelineItems, type EventSceneRelationship, type TimelineFilter, type TimelineItem } from './story';
import { STORY_TIME_PERIODS } from '../shared/story-config';

export type TimelineOrder = 'story' | 'screenplay';
export interface TimelineActivity extends TimelineItem {
  /** Projection identity distinguishes every typed appearance of the same Event. */
  key: string;
  matchId: string;
  entityId: string;
  relationship?: EventSceneRelationship;
  events: TimelineActivity[];
  noPresentation?: boolean;
}

/** Both comparison panes read the same canonical records. No reverse writeback. */
export function buildTimelineView(story: StoryRecord, documents: ScreenplayRecord[], filter: TimelineFilter, order: TimelineOrder, occurrencesOnly = false, plotsOnly = false): TimelineActivity[] {
  const viewFilter = { ...filter, order: order === 'story' ? 'day' as const : 'screenplay' as const };
  const scenes = queryTimeline(story, documents, { ...viewFilter, kind: undefined }).filter(i => i.kind === 'scene');
  const records = queryTimeline(story, documents, viewFilter);
  const acceptedEvent = (event: typeof story.events[number]) => !event.archived && (!filter.kind || filter.kind === 'event' || filter.kind === 'major' && event.major || filter.kind === 'minor' && !event.major) && (!filter.plotIds?.length || filter.plotIds.some(id => event.plotIds?.includes(id))) && (!plotsOnly || !!event.plotIds?.length);
  const eventNode = (event: typeof story.events[number], relationship: EventSceneRelationship, scene?: TimelineItem): TimelineActivity => ({
    ...resolveEvent(story, event), kind: 'event', id: event.id, entityId: event.id,
    key: JSON.stringify(['event', event.id, scene?.id ?? 'occurrence', relationship]), matchId: 'event:' + event.id,
    relationship, sceneId: scene?.id ?? records.find(i => i.kind === 'event' && i.id === event.id)?.sceneId,
    chronology: relationship === 'occurs' ? resolveEvent(story, event).chronology : scene?.chronology,
    screenplayId: scene?.screenplayId, screenplayOrder: scene?.screenplayOrder,
    missingScene: relationship === 'occurs' && records.find(i => i.kind === 'event' && i.id === event.id)?.missingScene,
    events: [],
  });
  const roots: TimelineActivity[] = [];
  const nested = new Set<string>();
  const eventOrder = new Map(story.events.map((event, index) => [event.id, index]));
  for (const scene of scenes) {
    let links = Object.values(getEventsForScene(story, scene.id)).flat().sort((a, b) => eventOrder.get(a.event.id)! - eventOrder.get(b.event.id)!);
    if (order === 'story') links = orderSceneEvents(story, links);
    const events = links.filter(link => (!occurrencesOnly || link.relationship === 'occurs') && acceptedEvent(link.event)).flatMap(link => {
      const c = resolveEvent(story, link.event).chronology;
      // Preserve independently positioned legacy occurrences without copying their data.
      if (order === 'story' && link.relationship === 'occurs' && (c?.day !== scene.chronology?.day || c?.date !== scene.chronology?.date)) return [];
      if (link.relationship === 'occurs' && !scene.missingScene) nested.add(link.event.id);
      return [eventNode(link.event, link.relationship, scene)];
    });
    if (filter.kind && filter.kind !== 'scene') roots.push(...events);
    else if (!plotsOnly || scene.plotIds?.length) roots.push({ ...scene, key: 'scene:' + scene.id, matchId: 'scene:' + scene.id, entityId: scene.id, events });
  }
  for (const item of records.filter(i => i.kind === 'event')) {
    if (item.layer) {
      roots.push({ ...item, key: 'layer:' + item.id, matchId: 'layer:' + item.id, entityId: item.id, events: [] });
      continue;
    }
    if (nested.has(item.id) || plotsOnly && !item.plotIds?.length) continue;
    const event = story.events.find(e => e.id === item.id)!;
    const appearances = scenes.some(scene => Object.values(getEventsForScene(story, scene.id)).flat().some(link => link.event.id === event.id));
    // An off-screen occurrence is not another audience appearance before its revelation.
    if (order === 'screenplay' && appearances) continue;
    roots.push({ ...eventNode(event, 'occurs'), ...item, key: JSON.stringify(['event', event.id, 'occurrence', 'occurs']), noPresentation: order === 'screenplay' && !item.sceneId, events: [] });
  }
  if (order === 'story') {
    // A consistent writer-entered Day/date pair can align date-only and Day-only
    // entries in this projection. Conflicting calendars are never guessed.
    const offsets = new Set(flattenTimelineView(roots).flatMap(item => item.chronology?.day !== undefined && item.chronology.date ? [Date.parse(item.chronology.date + 'T00:00:00Z') / 86400000 - item.chronology.day] : []));
    if (offsets.size === 1) {
      const offset = [...offsets][0];
      const key = (item: TimelineActivity) => {
        const c = item.chronology;
        const day = c?.day ?? (c?.date ? Date.parse(c.date + 'T00:00:00Z') / 86400000 - offset : undefined);
        const time = c?.time ? Number(c.time.slice(0, 2)) * 60 + Number(c.time.slice(3)) : STORY_TIME_PERIODS.find(p => p.value === c?.timeOfDay)?.sortMinute ?? 1440;
        return day === undefined ? Infinity : day * 1440 + time;
      };
      return [...roots].sort((a, b) => key(a) - key(b) || (a.chronology?.position ?? Infinity) - (b.chronology?.position ?? Infinity) || 0);
    }
  }
  return sortTimelineItems(roots, viewFilter, documents.flatMap(d => d.scenes.map(s => s.id)));
}

export function flattenTimelineView(items: TimelineActivity[]): TimelineActivity[] {
  return items.flatMap(item => [item, ...item.events]);
}

export function timelineDayLabel(c?: Chronology) {
  return [c?.day !== undefined ? 'Day ' + c.day : '', c?.date ? new Date(c.date + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ') || 'Unpositioned';
}
export function timelineTimeLabel(c?: Chronology) {
  return c?.time ? c.time + (c.endTime ? '–' + c.endTime : '') : STORY_TIME_PERIODS.find(p => p.value === c?.timeOfDay)?.label ?? '';
}
export interface TimelineGroup { key: string; label: string; chronology?: Chronology; periods: { key: string; label: string; items: TimelineActivity[] }[]; }
/** Contiguous groups never reorder screenplay material. */
export function groupTimeline(items: TimelineActivity[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const item of items) {
    const day = timelineDayLabel(item.chronology), time = timelineTimeLabel(item.chronology);
    let group = groups.at(-1);
    if (!group || group.label !== day) { group = { key: item.key + ':day', label: day, chronology: item.chronology, periods: [] }; groups.push(group); }
    let period = group.periods.at(-1);
    if (!period || period.label !== time) { period = { key: item.key + ':time', label: time, items: [] }; group.periods.push(period); }
    period.items.push(item);
  }
  return groups;
}

/** Never derive clock precision from a daypart, an estimate, or unrelated date systems. */
export function elapsedTimeLabel(previous?: Chronology, next?: Chronology): string {
  if (!previous || !next) return '';
  const calendar = Boolean(previous.date && next.date);
  const storyDays = previous.day !== undefined && next.day !== undefined;
  if (!calendar && !storyDays) return '';
  const dayA = calendar ? Date.parse(previous.date! + 'T00:00:00Z') / 86400000 : previous.day!;
  const dayB = calendar ? Date.parse(next.date! + 'T00:00:00Z') / 86400000 : next.day!;
  if (!Number.isFinite(dayA) || !Number.isFinite(dayB)) return '';
  const clock = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const exact = !!previous.time && !!next.time;
  const end = previous.endTime ?? previous.time;
  let minutes = (dayB - dayA) * 1440;
  if (exact) minutes += clock(next.time!) - clock(end!) - (previous.endTime && previous.endTime < previous.time! ? 1440 : 0);
  if (minutes <= 0 || !Number.isFinite(minutes)) return '';
  // Calendar months are reported only when their actual boundaries match.
  if (calendar && (!exact || next.time === end) && !previous.endTime) {
    const a = new Date(previous.date! + 'T00:00:00Z'), b = new Date(next.date! + 'T00:00:00Z');
    const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
    if (months > 0 && a.getUTCDate() === b.getUTCDate()) return months + (months === 1 ? ' month later' : ' months later');
  }
  if (!exact) return (dayB - dayA) + (dayB - dayA === 1 ? ' day later' : ' days later');
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), remainder = minutes % 60;
  return [[days, 'day'], [hours, 'hour'], [remainder, 'minute']].filter(([amount]) => amount).map(([amount, unit]) => amount + ' ' + unit + (amount === 1 ? '' : 's')).join(' ') + ' later';
}
