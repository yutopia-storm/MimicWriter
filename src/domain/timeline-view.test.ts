import { expect, it } from 'vitest';
import { createElement, createScene, createScreenplay } from './screenplay';
import { migrateStory } from './story';
import { buildTimelineView, elapsedTimeLabel, flattenTimelineView } from './timeline-view';

function fixture() {
  const document = createScreenplay({ projectId: 'p', title: 'Episode', screenplayType: 'feature' });
  document.scenes = [createScene(0), createScene(1), createScene(2)];
  document.scenes.forEach(s => { s.elements = [createElement('scene_heading', 'INT. OFFICE - NIGHT', 0)]; });
  const story = migrateStory(null, 'p');
  story.scenes = document.scenes.map((s, i) => ({ sceneId: s.id, screenplayId: document.id, chronology: { day: [14, 8, 1][i], time: '20:00', type: i === 2 ? 'flashback' as const : 'present' as const } }));
  story.events = [{ id: 'disappearance', name: 'Same title', description: '', chronology: { day: 0, time: '09:00' }, revealedInSceneIds: [document.scenes[0].id], referencedInSceneIds: [document.scenes[1].id], sceneInteractions: [{ sceneId: document.scenes[2].id, relationship: 'investigated' }] }];
  return { story, document };
}
it('orders flashbacks by story time and preserves their screenplay position without changing data', () => {
  const { story, document } = fixture(), before = JSON.stringify({ story, document });
  const left = buildTimelineView(story, [document], {}, 'story', true);
  const right = buildTimelineView(story, [document], {}, 'screenplay');
  expect(left.filter(i => i.kind === 'scene').map(i => i.entityId)).toEqual(document.scenes.map(s => s.id).reverse());
  expect(right.map(i => i.entityId)).toEqual(document.scenes.map(s => s.id));
  expect(flattenTimelineView(left).filter(i => i.matchId === 'event:disappearance').map(i => i.relationship)).toEqual(['occurs']);
  expect(flattenTimelineView(right).filter(i => i.matchId === 'event:disappearance').map(i => i.relationship)).toEqual(['revealed', 'referenced', 'investigated']);
  expect(JSON.stringify({ story, document })).toBe(before);
});
it('retains Event identity and precise ordering within its Scene, while screenplay order retains event order', () => {
  const { story, document } = fixture(), sceneId = document.scenes[0].id;
  story.events = [
    { id: 'late', name: 'Same title', description: '', contextOverrides: [], occursInSceneId: sceneId, occurrenceTiming: { mode: 'exact', time: '20:05' } },
    { id: 'untimed', name: 'Same title', description: '', contextOverrides: [], occursInSceneId: sceneId },
    { id: 'early', name: 'Same title', description: '', contextOverrides: [], occursInSceneId: sceneId, occurrenceTiming: { mode: 'range', time: '20:00', endTime: '20:02' } },
  ];
  const left = buildTimelineView(story, [document], {}, 'story', true).find(i => i.entityId === sceneId)!;
  const right = buildTimelineView(story, [document], {}, 'screenplay').find(i => i.entityId === sceneId)!;
  expect(left.events.map(i => i.entityId)).toEqual(['early', 'untimed', 'late']);
  expect(right.events.map(i => i.entityId)).toEqual(['late', 'untimed', 'early']);
  expect(new Set(left.events.map(i => i.matchId)).size).toBe(3);
});
it('provides distinct stable keys for every typed appearance and one occurrence', () => {
  const { story, document } = fixture();
  story.events[0].occursInSceneId = document.scenes[0].id;
  story.events[0].contextOverrides = [];
  const right = flattenTimelineView(buildTimelineView(story, [document], {}, 'screenplay')).filter(i => i.kind === 'event');
  expect(right.map(i => i.relationship)).toEqual(['occurs', 'referenced', 'investigated']);
  expect(new Set(right.map(i => i.key)).size).toBe(3);
  expect(new Set(right.map(i => i.matchId)).size).toBe(1);
});
it('places an unassociated Event without appearances in an explicitly unpositioned screenplay entry', () => {
  const { story, document } = fixture(); story.events[0].revealedInSceneIds = []; story.events[0].referencedInSceneIds = []; story.events[0].sceneInteractions = [];
  const right = buildTimelineView(story, [document], {}, 'screenplay');
  expect(right.at(-1)).toMatchObject({ entityId: 'disappearance', noPresentation: true });
});
it('derives precise gaps, complete calendar months, and only known day precision', () => {
  expect(elapsedTimeLabel({ day: 1, time: '09:00' }, { day: 1, time: '14:00' })).toBe('5 hours later');
  expect(elapsedTimeLabel({ day: 1, timeOfDay: 'morning' }, { day: 1, timeOfDay: 'evening' })).toBe('');
  expect(elapsedTimeLabel({ day: 1 }, { day: 3 })).toBe('2 days later');
  expect(elapsedTimeLabel({ date: '2026-01-01' }, { date: '2026-07-01' })).toBe('6 months later');
  expect(elapsedTimeLabel({ day: 14, time: '22:00', endTime: '02:00' }, { day: 15, time: '03:00' })).toBe('1 hour later');
  expect(elapsedTimeLabel({ day: 1, time: '09:00' }, { day: 1, time: '09:00' })).toBe('');
  expect(elapsedTimeLabel({ day: 1 }, { date: '2026-01-02' })).toBe('');
  expect(elapsedTimeLabel(undefined, { day: 2 })).toBe('');
});

it('aligns date-only chronology through a consistent canonical Day/date anchor without writing inferred Days',()=>{const {story,document}=fixture();story.scenes[0].chronology={day:14,date:'2026-01-14',time:'09:00'};story.scenes[1].chronology={date:'2026-01-02',time:'10:00'};story.scenes[2].chronology={day:3,time:'11:00'};story.events=[];expect(buildTimelineView(story,[document],{},'story').map(i=>i.entityId)).toEqual([document.scenes[1].id,document.scenes[2].id,document.scenes[0].id]);expect(story.scenes[1].chronology.day).toBeUndefined();});
