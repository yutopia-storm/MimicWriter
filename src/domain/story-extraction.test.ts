import { describe, expect, it } from 'vitest';
import { createElement, createScreenplay } from './screenplay';
import { deleteStoryEntity, migrateStory, queryTimeline } from './story';
import { durationFromPages, extractSceneHeading, hasMeaningfulSceneLocation, markSceneOverrides, synchronizeSceneDefaults } from './story-extraction';
import { paginateScreenplay, scenePagination } from './pagination';
import { resolveLayout } from '../shared/screenplay-layout';

function fixture() {
  const screenplay = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  screenplay.scenes[0].elements = [
    createElement('scene_heading', 'INT. HOSPITAL - EARLY MORNING', 0),
    createElement('action', 'ZIDER walks to the window.', 1),
    createElement('character', 'APPLE (CONT’D)', 2),
    createElement('dialogue', 'Sara told me about Zider.', 3),
    createElement('character', 'SARA (V.O.)', 4),
    createElement('dialogue', 'Listen.', 5),
  ];
  return screenplay;
}

describe('scene-derived story defaults', () => {
  it.each([
    ['INT. HOUSE - EARLY MORNING', 'early_morning', 'HOUSE'],
    ['EXT. HOUSE - MORNING', 'morning', 'HOUSE'],
    ['INT. HOUSE - DAY', 'afternoon', 'HOUSE'],
    ['INT. HOUSE - AFTERNOON', 'afternoon', 'HOUSE'],
    ['EXT. STREET – EVENING', 'evening', 'STREET'],
    ['INT./EXT. CAR - NIGHT', 'night', 'CAR'],
    ['INT. NIGHT CLUB - DAY', 'afternoon', 'NIGHT CLUB'],
    ['INT. NIGHT CLUB', undefined, 'NIGHT CLUB'],
  ])('extracts time and location from %s', (heading, timeOfDay, location) => {
    expect(extractSceneHeading(heading)).toMatchObject({ location, chronology: { timeOfDay } });
  });
  it.each(['', 'INT.', 'EXT.', 'INT./EXT.', 'I/E', 'LATER', 'CONTINUOUS', 'MOMENTS LATER', 'INT. - DAY', 'EXT. LATER'])('rejects a heading without a meaningful location: %s', heading => {
    expect(extractSceneHeading(heading).location).toBeUndefined();
    expect(hasMeaningfulSceneLocation(heading)).toBe(false);
  });
  it.each(["INT. ZIDER'S HOUSE - LATER", 'EXT. NIGHT CLUB - NIGHT', 'I/E CAR - CONTINUOUS'])('retains valid headings containing syntax or timing tokens: %s', heading => {
    expect(hasMeaningfulSceneLocation(heading)).toBe(true);
  });
  it('omits invalid headings from the timeline without deleting their screenplay scenes or metadata', () => {
    const document = fixture();
    const invalid = structuredClone(document.scenes[0]);
    invalid.id = crypto.randomUUID();
    invalid.elements = [createElement('scene_heading', 'MOMENTS LATER', 0)];
    document.scenes.push(invalid);
    const story = synchronizeSceneDefaults(migrateStory(null, 'p'), [document]);
    expect(document.scenes).toHaveLength(2);
    expect(story.scenes.some(item => item.sceneId === invalid.id)).toBe(true);
    expect(story.locations.some(item => item.name === 'MOMENTS LATER')).toBe(false);
    expect(queryTimeline(story, [document]).filter(item => item.kind === 'scene').map(item => item.id)).toEqual([document.scenes[0].id]);
  });
  it('extracts explicit clock time without inventing a clock time from a general period', () => {
    expect(extractSceneHeading('INT. ROOM - 9:30 PM').chronology.time).toBe('21:30');
    expect(extractSceneHeading('INT. ROOM - NIGHT').chronology.time).toBeUndefined();
    expect(extractSceneHeading('INT. ROOM - NIGHT (FLASHBACK)').chronology.type).toBe('flashback');
  });
  it('registers characters once, links physical appearances, and keeps voice-over and references distinct', () => {
    const document = fixture(), before = JSON.stringify(document);
    const story = synchronizeSceneDefaults(migrateStory(null, 'p'), [document]);
    expect(story.characters.map(item => item.name).sort()).toEqual(['APPLE', 'SARA', 'ZIDER']);
    const characterId = (name: string) => story.characters.find(item => item.name === name)!.id;
    expect(story.scenes[0].presentIds).toEqual(expect.arrayContaining([characterId('APPLE'), characterId('ZIDER')]));
    expect(story.scenes[0].presentIds).not.toContain(characterId('SARA'));
    expect(story.scenes[0].remoteIds).toContain(characterId('SARA'));
    expect(story.scenes[0].referencedIds).toContain(characterId('SARA'));
    expect(story.locations[0].name).toBe('HOSPITAL');
    expect(story.scenes[0].chronology?.timeOfDay).toBe('early_morning');
    expect(JSON.stringify(document)).toBe(before);
    expect(synchronizeSceneDefaults(story, [document])).toBe(story);
    expect(migrateStory(JSON.parse(JSON.stringify(story)), 'p')).toEqual(JSON.parse(JSON.stringify(story)));
  });
  it('uses raw page fractions for seconds, preserving legacy fractional-minute durations', () => {
    expect(durationFromPages(1 / 6)).toBe(10 / 60);
    expect(durationFromPages(1 / 2)).toBe(.5);
    expect(durationFromPages(1)).toBe(1);
    const document = fixture(), layout = resolveLayout(document.layout);
    const fraction = scenePagination(paginateScreenplay(document, layout), layout).get(document.scenes[0].id)!.pageFraction;
    expect(synchronizeSceneDefaults(migrateStory(null, 'p'), [document]).scenes[0].chronology?.duration).toBe(durationFromPages(fraction));
    const legacy = migrateStory(null, 'p');
    legacy.scenes.push({ sceneId: document.scenes[0].id, screenplayId: document.id, chronology: { duration: .5 } });
    expect(synchronizeSceneDefaults(legacy, [document]).scenes[0].chronology?.duration).toBe(.5);
  });
  it('updates scene defaults while respecting manual edits, explicit clears, renames and deletions', () => {
    const document = fixture();
    let story = synchronizeSceneDefaults(migrateStory(null, 'p'), [document]);
    const apple = story.characters.find(item => item.name === 'APPLE')!;
    apple.name = 'Apple renamed';
    const previous = story.scenes[0];
    story.scenes[0] = markSceneOverrides(previous, { ...previous, presentIds: [], chronology: { ...previous.chronology, timeOfDay: 'evening', duration: .5 }, locationId: undefined });
    document.scenes[0].elements[0].content = 'INT. HOUSE - NIGHT';
    document.scenes[0].elements[3].content += ' More dialogue. '.repeat(30);
    story = synchronizeSceneDefaults(story, [document]);
    expect(story.scenes[0].chronology).toMatchObject({ timeOfDay: 'evening', duration: .5 });
    expect(story.scenes[0].presentIds).toEqual([]);
    expect(story.scenes[0].locationId).toBeUndefined();
    expect(story.characters.filter(item => item.sourceNames?.includes('APPLE'))).toHaveLength(1);
    expect(story.characters.find(item => item.id === apple.id)?.name).toBe('Apple renamed');
    story = synchronizeSceneDefaults(deleteStoryEntity(story, 'characters', apple.id), [document]);
    expect(story.characters.some(item => item.sourceNames?.includes('APPLE'))).toBe(false);
  });
  it('refreshes untouched defaults and sorts broad periods and minor events', () => {
    const document = fixture();
    const initial = synchronizeSceneDefaults(migrateStory(null, 'p'), [document]);
    document.scenes[0].elements[0].content = 'INT. HOUSE - NIGHT';
    const story = synchronizeSceneDefaults(initial, [document]);
    expect(story.scenes[0].chronology?.timeOfDay).toBe('night');
    expect(story.locations.find(item => item.id === story.scenes[0].locationId)?.name).toBe('HOUSE');
    story.events = [
      { id: 'night', name: 'Night', description: '', major: true, chronology: { day: 1, timeOfDay: 'night' } },
      { id: 'morning', name: 'Morning', description: '', major: false, chronology: { day: 1, timeOfDay: 'morning' } },
    ];
    expect(queryTimeline(story, [document], { kind: 'event' }).map(item => item.id)).toEqual(['morning', 'night']);
    expect(queryTimeline(story, [document], { kind: 'minor' }).map(item => item.id)).toEqual(['morning']);
  });
  it('keeps stable entities during typing and retains source bindings through save/load', () => {
    const document = fixture();
    document.scenes[0].elements = [createElement('scene_heading', 'INT. HO - DAY', 0), createElement('character', 'AP', 1)];
    let story = synchronizeSceneDefaults(migrateStory(null, 'p'), [document]);
    const characterId = story.characters[0].id, locationId = story.locations[0].id;
    document.scenes[0].elements[0].content = 'INT. HOUSE - DAY';
    document.scenes[0].elements[1].content = 'APPLE';
    story = synchronizeSceneDefaults(migrateStory(JSON.parse(JSON.stringify(story)), 'p'), [document]);
    expect(story.characters).toHaveLength(1); expect(story.locations).toHaveLength(1);
    expect(story.characters[0]).toMatchObject({ id: characterId, name: 'APPLE' });
    expect(story.characters[0].sourceNames).toEqual(['APPLE']);
    expect(story.locations[0]).toMatchObject({ id: locationId, name: 'HOUSE' });
  });
  it('extracts clearly introduced non-speaking characters without treating a mentioned name as present', () => {
    const document = fixture();
    document.scenes[0].elements = [createElement('action', 'Jessica, 28, a detective in a worn coat.\nAshley enters.\nSomeone walks past.', 0)];
    const story = synchronizeSceneDefaults(migrateStory(null, 'p'), [document]);
    expect(story.characters.map(item => item.name)).toEqual(['Jessica', 'Ashley']);
    expect(story.scenes[0].presentIds).toHaveLength(2);
  });
});

