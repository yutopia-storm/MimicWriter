import { expect, it } from 'vitest';
import { compileScreenplay, createElement, createScreenplay, normalizeSceneBoundaries, normalizeSceneHeadings } from './screenplay';
import { continuousDocumentToScreenplay, screenplayToContinuousDocument } from './continuous-document';
import { migrateStory, queryTimeline } from './story';

it('autocorrects lowercase headings without changing other screenplay text or identities', () => {
  const script = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  const scene = script.scenes[0];
  scene.elements[0].content = 'int. kitchen - early morning';
  scene.elements[1].content = 'She whispers softly.';
  const result = normalizeSceneBoundaries(script);
  expect(result.scenes[0].elements[0]).toMatchObject({ id: scene.elements[0].id, content: 'INT. KITCHEN - EARLY MORNING' });
  expect(result.scenes[0].id).toBe(scene.id);
  expect(result.scenes[0].elements[1]).toBe(scene.elements[1]);
  expect(script.scenes[0].elements[0].content).toBe('int. kitchen - early morning');
  expect(normalizeSceneHeadings(result)).toBe(result);
  expect(createElement('scene_heading', 'ext. street - night').content).toBe('EXT. STREET - NIGHT');
});

it('corrects typed/pasted headings and uses uppercase in compilation and timeline labels', () => {
  const script = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  script.scenes[0].elements[0].content = 'ext. house - night';
  const roundTrip = continuousDocumentToScreenplay(script, screenplayToContinuousDocument(script));
  expect(roundTrip.scenes[0].elements[0].content).toBe('EXT. HOUSE - NIGHT');
  expect(compileScreenplay(script)[0].content).toBe('EXT. HOUSE - NIGHT');
  expect(queryTimeline(migrateStory(null, 'p'), [script])[0].name).toContain('EXT. HOUSE - NIGHT');
});

it('retains formatting and note anchors when uppercase expands Unicode characters', () => {
  const script = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  const scene = script.scenes[0], heading = scene.elements[0];
  heading.content = 'int. straße - tag';
  heading.formatting = [{ start: 5, end: 11, bold: true }];
  script.notes = [{ id: 'note', sceneId: scene.id, from: { elementId: heading.id, offset: 5 }, to: { elementId: heading.id, offset: 11 }, selectedText: 'straße', content: 'Check location.', createdAt: '', updatedAt: '' }];
  const result = normalizeSceneHeadings(script);
  expect(result.scenes[0].elements[0].content).toBe('INT. STRASSE - TAG');
  expect(result.scenes[0].elements[0].formatting).toEqual([{ start: 5, end: 12, bold: true }]);
  expect(result.notes![0].to.offset).toBe(12);
  expect(result.notes![0].selectedText).toBe('straße');
});
