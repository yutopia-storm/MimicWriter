import { reorderScene } from './editor-operations';
import { describe, expect, it } from 'vitest';
import { createElement, createScene, createScreenplay } from './screenplay';
import { deleteStoryEntity, migrateStory, queryTimeline } from './story';

function fixture() {
  const screenplay = createScreenplay({ projectId: 'project', title: 'Story', screenplayType: 'feature' });
  screenplay.scenes.push(createScene(1));
  screenplay.scenes.forEach((scene, index) => { scene.elements = [createElement('scene_heading', `INT. ROOM ${index + 1} - DAY`, 0)]; });
  const story = migrateStory(null, 'project');
  story.plots = ['a', 'b'].map(id => ({ id, name: id, color: 'accent', description: '' }));
  story.characters = ['apple', 'zider', 'sara'].map(id => ({ id, name: id, description: '' }));
  story.locations = [{ id: 'house', name: 'House', description: '' }];
  story.scenes = [{ sceneId: screenplay.scenes[0].id, screenplayId: screenplay.id, chronology: { day: 4, time: '14:30' }, plotIds: ['a', 'b'], presentIds: ['apple', 'zider'], involvedIds: ['sara'], referencedIds: ['sara'], locationId: 'house' }];
  story.events = [{ id: 'death', name: 'Peter dies', description: '', chronology: { day: 2 }, plotIds: ['b'], presentIds: ['zider'], occursInSceneId: screenplay.scenes[0].id, revealedInSceneIds: [screenplay.scenes[1].id], major: true }];
  return { story, screenplay };
}

describe('shared story model', () => {
  it('migrates absent metadata without deriving canon and rejects unknown versions or invalid relationships', () => {
    expect(migrateStory(null, 'p').characters).toEqual([]);
    expect(() => migrateStory({ schemaVersion: 2 }, 'p')).toThrow();
    const { story } = fixture();
    expect(migrateStory(story, 'project')).toEqual(story);
    expect(() => migrateStory(story, 'another')).toThrow();
    story.events[0].presentIds = ['unknown'];
    expect(() => migrateStory(story, 'project')).toThrow('Unknown story relationship');
  });
  it('combines plots, presence, all-character matching, location and time without duplicating intersections', () => {
    const { story, screenplay } = fixture();
    const rows = queryTimeline(story, [screenplay], { plotIds: ['a', 'b'], characterIds: ['apple', 'zider'], allCharacters: true, relationship: 'present', day: 4, locationId: 'house' });
    expect(rows).toHaveLength(1);
    expect(rows[0].plotIds).toEqual(['a', 'b']);
    expect(queryTimeline(story, [screenplay], { characterIds: ['sara'] })).toEqual([]);
    expect(queryTimeline(story, [screenplay], { characterIds: ['sara'], relationship: 'referenced' })).toHaveLength(1);
    expect(queryTimeline(story, [screenplay], { characterIds: ['apple'], kind: 'event' })).toEqual([]);
    expect(queryTimeline(story, [screenplay], { kind: 'major' }).map(item => item.id)).toEqual(['death']);
  });
  it('keeps event links independent of revealing scenes and orders chronology independently of screenplay order', () => {
    const { story, screenplay } = fixture();
    const before = JSON.stringify(screenplay);
    expect(queryTimeline(story, [screenplay])[0].id).toBe('death');
    expect(queryTimeline(story, [screenplay], { plotIds: ['a'], kind: 'event' })).toEqual([]);
    expect(JSON.stringify(screenplay)).toBe(before);
    const reordered = reorderScene(screenplay, screenplay.scenes[0].id, 1);
    story.plots[0].name = 'Disappearance'; story.characters[0].name = 'Apple renamed';
    expect(queryTimeline(story, [reordered], { characterIds: ['apple'] })[0].screenplayOrder).toBe(2);
    expect(queryTimeline(story, [reordered], { plotIds: ['a'] })[0].id).toBe(screenplay.scenes[0].id);
  });
  it('preserves independent objects on deletion and retains removed scene relationships for restoration', () => {
    const { story, screenplay } = fixture();
    const clean = deleteStoryEntity(deleteStoryEntity(story, 'plots', 'a'), 'characters', 'apple');
    expect(clean.events).toHaveLength(1); expect(clean.scenes).toHaveLength(1);
    expect(clean.scenes[0].plotIds).toEqual(['b']); expect(clean.scenes[0].presentIds).toEqual(['zider']);
    const removed = { ...screenplay, scenes: screenplay.scenes.slice(1) };
    expect(queryTimeline(story, [removed]).find(item => item.id === screenplay.scenes[0].id)?.missingScene).toBe(true);
    expect(queryTimeline(story, [removed]).find(item => item.id === 'death')?.sceneId).toBe(screenplay.scenes[0].id);
    story.plots[0].archived = true;
    expect(queryTimeline(story, [screenplay], { plotIds: ['a'] })).toHaveLength(1);
  });
});
