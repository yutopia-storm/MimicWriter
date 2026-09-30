import { describe, expect, it } from 'vitest';
import { createElement, createScreenplay, insertScene } from './screenplay';
import { duplicateElements, duplicateScene, findOccurrences, reorderScene, replaceOccurrences, screenplayStatistics } from './editor-operations';
import { resolveEditorCommand } from './editor-commands';

describe('core editor operations', () => {
  it('resolves central keyboard commands without intercepting unrelated keys', () => {
    expect(resolveEditorCommand({ key: 'f', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe('search.find');
    expect(resolveEditorCommand({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })).toBe('history.redo');
    expect(resolveEditorCommand({ key: 'Tab', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })).toBeNull();
  });
  it('reorders by stable identity while deriving display order', () => { let screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Order', screenplayType: 'feature' }); screenplay = insertScene(screenplay); screenplay = insertScene(screenplay); const ids = screenplay.scenes.map((scene) => scene.id); const moved = reorderScene(screenplay, ids[2], 0); expect(moved.scenes.map((scene) => scene.id)).toEqual([ids[2], ids[0], ids[1]]); expect(moved.scenes.map((scene) => scene.order)).toEqual([0,1,2]); });
  it('duplicates scenes and elements with new identities and preserved content', () => { const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Copy', screenplayType: 'feature' }); screenplay.scenes[0].elements[0].content = 'INT. ROOM'; const copy = duplicateScene(screenplay, screenplay.scenes[0].id); expect(copy.scenes[1].id).not.toBe(copy.scenes[0].id); expect(copy.scenes[1].elements[0].id).not.toBe(copy.scenes[0].elements[0].id); expect(copy.scenes[1].elements[0].content).toBe('INT. ROOM'); const scene = duplicateElements(copy.scenes[0], [copy.scenes[0].elements[0].id], copy.scenes[0].elements[0].id); expect(scene.elements[1].id).not.toBe(scene.elements[0].id); });
  it('finds and replaces only visible screenplay text with selectable scope', () => { const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Find', screenplayType: 'feature' }); screenplay.scenes[0].elements = [createElement('character','MARA',0), createElement('dialogue','Mara waits.',1)]; expect(findOccurrences(screenplay,'mara')).toHaveLength(2); const scoped = replaceOccurrences(screenplay,'mara','ZIDER','character'); expect(scoped.count).toBe(1); expect(scoped.screenplay.scenes[0].elements.map((element) => element.content)).toEqual(['ZIDER','Mara waits.']); });
  it('derives screenplay statistics without storing competing values', () => { const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Stats', screenplayType: 'feature' }); screenplay.scenes[0].elements[0].content = 'INT. ROOM'; screenplay.scenes[0].elements[1].content = 'One two three.'; expect(screenplayStatistics(screenplay)).toEqual({ words: 5, scenes: 1, approximatePages: 1 }); });
});


it('supports independent case and whole-word search options', () => {
  const screenplay = createScreenplay({ projectId: 'search', title: 'Search', screenplayType: 'feature' });
  screenplay.scenes[0].elements[1].content = 'Cat cat scatter cat_ cat.';
  expect(findOccurrences(screenplay, 'cat')).toHaveLength(5);
  expect(findOccurrences(screenplay, 'cat', 'screenplay', undefined, { caseSensitive: true })).toHaveLength(4);
  expect(findOccurrences(screenplay, 'cat', 'screenplay', undefined, { wholeWords: true })).toHaveLength(3);
  expect(findOccurrences(screenplay, 'cat', 'screenplay', undefined, { caseSensitive: true, wholeWords: true })).toHaveLength(2);
});
