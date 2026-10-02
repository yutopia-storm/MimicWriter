import { describe, expect, it } from 'vitest';
import { createElement, createScene, createScreenplay } from './screenplay';
import { migrateStory, queryTimeline, resolveEvent, deleteStoryEntity, getEffectivePlotsForScene, getEffectiveScenesForPlot, getEventsForPlot, getEventsForScene } from './story';
import { extractSceneHeading, refreshScene, synchronizeSceneDefaults, markSceneOverrides } from './story-extraction';
import { mergeIdentity, separateIdentity } from './story-identities';
import { periodFromTime } from '../shared/story-config';

function fixture() {
  const script = createScreenplay({ projectId: 'p', title: 'Pilot', screenplayType: 'episode' });
  script.scenes.push(createScene(1));
  script.scenes[0].elements = [createElement('scene_heading', 'INT./EXT. COURT - DAY', 0), createElement('character', 'SOLICITOR', 1), createElement('dialogue', 'Yes.', 2)];
  script.scenes[1].elements = [createElement('scene_heading', 'INT. COURTHOUSE - NIGHT', 0), createElement('character', 'MARSHA (O.S.)', 1), createElement('dialogue', 'No.', 2)];
  const story = synchronizeSceneDefaults(migrateStory(null, 'p'), [script]);
  story.plots.push({ id: 'plot', name: 'Bail', description: '', color: 'accent', status: 'active', scope: 'series' });
  story.scenes[0].chronology = { ...story.scenes[0].chronology, day: 4, time: '09:30' };
  story.scenes[0].plotIds = ['plot'];
  return { script, story };
}

describe('story refinement safety', () => {
  it('inherits live scene context, respects selective empty overrides, and keeps legacy events independent', () => {
    const { story, script } = fixture();
    const event = { id: 'event', name: 'Bail', description: '', occursInSceneId: script.scenes[0].id, contextOverrides: [] };
    story.events.push(event);
    expect(resolveEvent(story, event)).toMatchObject({ chronology: { day: 4, time: '09:30' }, presentIds: story.scenes[0].presentIds, participantIds: [] });
    expect(resolveEvent(story, { ...event, participantIds: [], contextOverrides: ['participantIds'] }).presentIds).toEqual(story.scenes[0].presentIds);
    story.scenes[0].chronology!.day = 8;
    expect(queryTimeline(story, [script], { kind: 'event' })[0].chronology?.day).toBe(8);
    const legacy = { ...event, contextOverrides: undefined, chronology: { day: 2, duration: 1, type: 'flashback' as const } };
    expect(resolveEvent(story, legacy).chronology).toEqual(legacy.chronology);
    expect(event).not.toHaveProperty('chronology');
  });
  it('round-trips old chronology, combined reveal links and ambiguous roles without guessing replacements', () => {
    const { story, script } = fixture();
    story.events.push({ id: 'legacy', name: 'Fact', description: '', occursInSceneId: script.scenes[0].id, revealedInSceneIds: [script.scenes[1].id], involvedIds: [story.characters[0].id], chronology: { type: 'linear', duration: 0.5, position: 12 } });
    const json = JSON.parse(JSON.stringify(story));
    expect(migrateStory(json, 'p')).toEqual(json);
  });
  it.each(['INT.', 'EXT.', 'INT./EXT.', 'I/E', 'DAY', 'NIGHT', 'CONTINUOUS', 'LATER'])('does not make a location from %s', value => expect(extractSceneHeading(value).location).toBeUndefined());
  it('recognizes midday, late night and exact-time dayparts while preserving sub-location names', () => {
    expect(extractSceneHeading("INT. ZIDER'S HOUSE - KITCHEN - MIDDAY")).toMatchObject({ location: "ZIDER'S HOUSE - KITCHEN", chronology: { timeOfDay: 'midday' } });
    expect(extractSceneHeading('INT. COURT - LATE NIGHT').chronology.timeOfDay).toBe('late_night');
    expect(periodFromTime('09:30')).toBe('morning');
    expect(extractSceneHeading('INT. COURT - 23:30').chronology.timeOfDay).toBe('late_night');
  });
  it.each(['characters', 'locations'] as const)('merges and separates %s with stable original identities and no screenplay changes', kind => {
    const { script, story } = fixture(), before = JSON.stringify(script);
    const [source, target] = story[kind];
    story.events.push({ id: 'e', name: 'Fact', description: '', ...(kind === 'characters' ? { participantIds: [source.id, target.id] } : { locationId: source.id }) });
    let merged = mergeIdentity(story, kind, source.id, target.id);
    merged = synchronizeSceneDefaults(migrateStory(JSON.parse(JSON.stringify(merged)), 'p'), [script]);
    expect(merged[kind]).toHaveLength(1);
    expect(merged[kind][0].sourceNames).toContain(source.name);
    const restored = separateIdentity(merged, kind, target.id, source.name, [script]);
    expect(restored[kind].map(item => item.id).sort()).toEqual([source.id, target.id].sort());
    const field = kind === 'characters' ? 'presentIds' : 'locationId';
    expect(restored.scenes.map(item => item[field])).toEqual(story.scenes.map(item => item[field]));
    expect(restored.events.map(item => ({ ...item, participantIds: item.participantIds?.slice().sort() }))).toEqual(story.events.map(item => ({ ...item, participantIds: item.participantIds?.slice().sort() })));
    expect(JSON.stringify(script)).toBe(before);
    expect(() => migrateStory(JSON.parse(JSON.stringify(restored)), 'p')).not.toThrow();
  });
  it('refreshes defaults without destroying overrides and follows moved scene IDs', () => {
    const { story, script } = fixture();
    story.scenes[0] = markSceneOverrides(story.scenes[0], { ...story.scenes[0], chronology: { day: 12, timeOfDay: 'evening' }, presentIds: [], notes: 'Keep this' });
    const moved = { ...script, id: 'another-episode', scenes: [...script.scenes].reverse() };
    const next = refreshScene(story, [moved], script.scenes[0].id);
    expect(next.scenes[0]).toMatchObject({ screenplayId: 'another-episode', chronology: { day: 12, timeOfDay: 'evening' }, presentIds: [], notes: 'Keep this', plotIds: ['plot'] });
  });
  it('requires physical presence for Together even when relationship filter was all', () => {
    const { story, script } = fixture();
    story.scenes[0].referencedIds = [story.characters[1].id];
    expect(queryTimeline(story, [script], { characterIds: story.characters.map(item => item.id), allCharacters: true, relationship: 'all' })).toEqual([]);
  });
  it('derives scene plots from typed event relationships without reverse inference or duplicate writeback', () => {
    const { story, script } = fixture();
    story.plots.push({ id: 'relationship', name: 'Relationship', description: '', color: 'accent' }, { id: 'reference-only', name: 'Reference only', description: '', color: 'accent' });
    story.events.push(
      { id: 'occurs', name: 'Confession', description: '', plotIds: ['plot', 'relationship'], occursInSceneId: script.scenes[0].id, contextOverrides: [] },
      { id: 'revealed', name: 'Secret', description: '', plotIds: ['relationship'], revealedInSceneIds: [script.scenes[1].id] },
      { id: 'referenced', name: 'Rumour', description: '', plotIds: ['reference-only'], referencedInSceneIds: [script.scenes[1].id] },
    );
    const first = getEffectivePlotsForScene(story, script.scenes[0].id);
    expect(first.map(item => item.plotId).sort()).toEqual(['plot', 'relationship']);
    expect(first.find(item => item.plotId === 'plot')?.sources.map(item => item.type).sort()).toEqual(['event', 'explicit']);
    expect(getEffectivePlotsForScene(story, script.scenes[1].id).map(item => item.plotId)).toEqual(['relationship', 'reference-only']);
    expect(getEventsForScene(story, script.scenes[1].id)).toMatchObject({ occurs: [], revealed: [{ relationship: 'revealed' }], referenced: [{ relationship: 'referenced' }] });
    expect(getEventsForPlot(story, 'relationship').map(item => item.id)).toEqual(['occurs', 'revealed']);
    expect(getEffectiveScenesForPlot(story, 'relationship').map(item => item.sceneId).sort()).toEqual(script.scenes.map(item => item.id).sort());
    expect(resolveEvent(story, story.events[0]).plotIds).toEqual(['plot', 'relationship']);
    expect(story.scenes[0].plotIds).toEqual(['plot']);
    expect(queryTimeline(story, [script], { kind: 'scene', plotIds: ['relationship'] }).map(item => item.id).sort()).toEqual(script.scenes.map(item => item.id).sort());
  });
  it('preserves scope relationships on renaming and clears deleted resolution or parent links', () => {
    const { story } = fixture();
    story.plots.push({ id: 'child', name: 'Episode plot', description: '', color: 'accent', scope: 'episode', parentId: 'plot', resolutionEventId: 'e' });
    story.events.push({ id: 'e', name: 'Resolved', description: '' });
    const next = deleteStoryEntity(deleteStoryEntity(story, 'events', 'e'), 'plots', 'plot');
    expect(next.plots[0]).toMatchObject({ id: 'child', scope: 'episode' });
    expect(next.plots[0].parentId).toBeUndefined();
    expect(next.plots[0].resolutionEventId).toBeUndefined();
    expect(() => migrateStory(next, 'p')).not.toThrow();
  });
  it('recalculates effective links after event removal, movement, archival, and plot deletion', () => {
    const { story, script } = fixture();
    story.plots.push({ id: 'second', name: 'Second plot', description: '', color: 'accent' });
    story.events.push(
      { id: 'a', name: 'First source', description: '', plotIds: ['second'], occursInSceneId: script.scenes[0].id, contextOverrides: [] },
      { id: 'b', name: 'Second source', description: '', plotIds: ['second'], occursInSceneId: script.scenes[0].id, contextOverrides: [] },
    );
    expect(getEffectivePlotsForScene(story, script.scenes[0].id).filter(item => item.plotId === 'second')).toHaveLength(1);

    const oneRemoved = deleteStoryEntity(story, 'events', 'a');
    expect(getEffectivePlotsForScene(oneRemoved, script.scenes[0].id).some(item => item.plotId === 'second')).toBe(true);
    const moved = { ...oneRemoved, events: oneRemoved.events.map(event => event.id === 'b' ? { ...event, occursInSceneId: script.scenes[1].id } : event) };
    expect(getEffectivePlotsForScene(moved, script.scenes[0].id).some(item => item.plotId === 'second')).toBe(false);
    expect(getEffectivePlotsForScene(moved, script.scenes[1].id).some(item => item.plotId === 'second')).toBe(true);

    const archived = { ...moved, events: moved.events.map(event => event.id === 'b' ? { ...event, archived: true } : event) };
    expect(getEventsForPlot(archived, 'second')).toEqual([]);
    expect(getEventsForPlot(archived, 'second', true).map(event => event.id)).toEqual(['b']);
    expect(getEffectiveScenesForPlot(archived, 'second', true).map(item => item.sceneId)).toEqual([script.scenes[1].id]);

    const plotDeleted = deleteStoryEntity(moved, 'plots', 'second');
    expect(plotDeleted.events.find(event => event.id === 'b')?.plotIds).toEqual([]);
    expect(plotDeleted.events.some(event => event.id === 'b')).toBe(true);
    expect(getEffectivePlotsForScene(plotDeleted, script.scenes[1].id).some(item => item.plotId === 'second')).toBe(false);
  });
});
