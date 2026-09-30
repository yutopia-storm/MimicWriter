import { describe, expect, it } from 'vitest';
import { createScreenplay } from './screenplay';
import { joinAtBoundary, parentheticalContent, parseCharacterCue, splitElement, tabType, transformElement } from './continuous-editor';
import { smartTypeSuggestions } from './screenplay-editing';

describe('continuous screenplay operations', () => {
  it('splits at the caret without losing text or the original identity', () => {
    const source = createScreenplay({ projectId: 'p', title: 'T', screenplayType: 'feature' });
    const action = source.scenes[0].elements[1]; action.content = 'Apple opens the door.';
    const result = splitElement(source, action.id, 6);
    expect(result.screenplay.scenes[0].elements.map((item) => item.content)).toEqual(['', 'Apple ', 'opens the door.']);
    expect(result.screenplay.scenes[0].elements[1].id).toBe(action.id);
    expect(result.screenplay.scenes[0].elements[2].type).toBe('action');
  });

  it('joins adjacent paragraphs from either boundary and preserves the left identity', () => {
    const source = createScreenplay({ projectId: 'p', title: 'T', screenplayType: 'feature' });
    const first = source.scenes[0].elements[1]; first.content = 'Hello ';
    const split = splitElement(source, first.id, 6).screenplay;
    split.scenes[0].elements[2].content = 'world';
    const joined = joinAtBoundary(split, split.scenes[0].elements[2].id, 'backward');
    expect(joined.screenplay.scenes[0].elements[1]).toMatchObject({ id: first.id, content: 'Hello world' });
    expect(joined.caret).toBe(6);
  });

  it('transforms an element in place and implements contextual Tab rules', () => {
    const source = createScreenplay({ projectId: 'p', title: 'T', screenplayType: 'feature' });
    const id = source.scenes[0].elements[1].id;
    const changed = transformElement(source, id, 'character');
    expect(changed.scenes[0].elements[1]).toMatchObject({ id, type: 'character' });
    expect(tabType('action', true)).toBe('character');
    expect(tabType('dialogue', false)).toBe('parenthetical');
    expect(tabType('parenthetical', false)).toBe('dialogue');
    expect(tabType('character', true)).toBe('transition');
    expect(tabType('character', false)).toBe('transition');
    expect(tabType('transition', false)).toBe('action');
  });

  it('normalises parentheticals and separates Character identity from extensions', () => {
    expect(parentheticalContent('quietly')).toBe('(quietly)');
    expect(parentheticalContent('(quietly)')).toBe('(quietly)');
    expect(parseCharacterCue('Zider (V.O.)')).toEqual({ name: 'ZIDER', extension: 'V.O.' });
  });

  it('offers complete contextual Scene Heading and Transition suggestions', () => {
    const source = createScreenplay({ projectId: 'p', title: 'T', screenplayType: 'feature' });
    expect(smartTypeSuggestions(source, 'scene_heading', '').slice(0, 3)).toEqual(['INT. ', 'EXT. ', 'INT/EXT. ']);
    expect(smartTypeSuggestions(source, 'scene_heading', 'INT. KITCHEN - NI')).toContain('INT. KITCHEN - NIGHT');
    expect(smartTypeSuggestions(source, 'transition', 'CUT')).toContain('CUT TO:');
    expect(smartTypeSuggestions(source, 'transition', ':')).toContain('CUT TO:');
    expect(smartTypeSuggestions(source, 'transition', 'CU:')).toEqual(['CUT TO:']);
    expect(smartTypeSuggestions(source, 'transition', 'DISS:')).toEqual(['DISSOLVE TO:']);
  });
});
