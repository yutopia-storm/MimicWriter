import { describe, expect, it } from 'vitest'; import { createScreenplay } from './screenplay'; import { paginateScreenplay, pageLineCapacity } from './pagination'; import { professionalLayout } from '../shared/screenplay-layout';
describe('screenplay pagination', () => {
  it('uses professional physical line capacity', () => { expect(pageLineCapacity(professionalLayout('letter'))).toBe(54); expect(pageLineCapacity(professionalLayout('a4'))).toBe(58); });
  it('keeps character with dialogue and emits proper split markers without mutating identity', () => { const screenplay = createScreenplay({ projectId:'p', title:'T', screenplayType:'feature' }); const scene = screenplay.scenes[0]; scene.elements = [{ id:'c', type:'character', content:'ZIDER', order:0 },{ id:'d', type:'dialogue', content:Array.from({length:200},(_,i)=>`Sentence ${i}.`).join(' '), order:1 }]; const pages = paginateScreenplay(screenplay, professionalLayout('letter'), true); expect(pages.length).toBeGreaterThan(1); expect(pages[0].entries.at(-1)?.kind).toBe('more'); expect(pages[1].entries[0]).toMatchObject({ kind:'continued', character:'ZIDER' }); expect(scene.elements[0].content).toBe('ZIDER'); });
  it('suppresses generated markers while preserving pagination', () => { const screenplay = createScreenplay({ projectId:'p', title:'T', screenplayType:'feature' }); screenplay.scenes[0].elements = [{ id:'c', type:'character', content:'AVA', order:0 },{ id:'d', type:'dialogue', content:'Words '.repeat(800), order:1 }]; const pages = paginateScreenplay(screenplay, professionalLayout('a4'), false); expect(pages.length).toBeGreaterThan(1); expect(pages.flatMap((page)=>page.entries).some((entry)=>entry.kind !== 'element')).toBe(false); });
});

import { createElement } from './screenplay';
import { scenePagination, wrapElement } from './pagination';
describe('shared pagination regression coverage', () => {
  const layout = professionalLayout('letter');
  function draft() { return createScreenplay({ projectId: 'p', title: 'Pagination', screenplayType: 'feature' }); }
  it('fills remaining action space and preserves every source character across fragments', () => {
    const script = draft(); const text = 'A long action with spaces.  '.repeat(300) + '\n';
    script.scenes[0].elements = [createElement('action', 'lead\n'.repeat(20), 0), createElement('action', text, 1)];
    const pages = paginateScreenplay(script, layout); const id = script.scenes[0].elements[1].id;
    expect(pages[0].entries.some(e => e.kind === 'element' && e.element.id === id)).toBe(true);
    const fragments = pages.flatMap(p => p.entries).filter(e => e.kind === 'element' && e.element.id === id);
    expect(fragments.map(e => e.kind === 'element' ? e.element.content.slice(e.start, e.end) : '').join('')).toBe(text);
    expect(pages.every(p => p.usedLines <= pageLineCapacity(layout))).toBe(true);
  });
  it('moves a cue with its multiline parenthetical and first dialogue line', () => {
    const script = draft(); script.scenes[0].elements = [createElement('action', Array(50).fill('line').join('\n'), 0), createElement('character', 'AVA', 1), createElement('parenthetical', '(quietly\nand carefully)', 2), createElement('dialogue', 'Yes.', 3)];
    const pages = paginateScreenplay(script, layout);
    expect(pages[0].entries.some(e => e.kind === 'element' && e.element.type === 'character')).toBe(false);
    expect(pages[1].entries.filter(e => e.kind === 'element').map(e => e.element.type)).toEqual(['character', 'parenthetical', 'dialogue']);
  });
  it('continues a speech across dialogue and parenthetical elements and removes markers on shrink', () => {
    const script = draft(); script.scenes[0].elements = [createElement('character', 'AVA', 0), createElement('dialogue', Array(49).fill('line').join('\n'), 1), createElement('parenthetical', '(a beat)', 2), createElement('dialogue', Array(10).fill('line').join('\n'), 3)];
    const pages = paginateScreenplay(script, layout);
    expect(pages[0].entries.at(-1)?.kind).toBe('more'); expect(pages[1].entries[0].kind).toBe('continued');
    script.scenes[0].elements[1].content = 'Short.';
    const short = paginateScreenplay(script, layout); expect(short).toHaveLength(1); expect(short[0].entries.every(e => e.kind === 'element')).toBe(true);
  });
  it('reflows subsequent scene ranges with paper size and edits', () => {
    const script = draft(); script.scenes[0].elements = [createElement('action', Array(55).fill('line').join('\n'), 0)];
    const second = { ...script.scenes[0], id: 'second', order: 1, elements: [createElement('action', 'End.', 0)] }; script.scenes.push(second);
    const letter = scenePagination(paginateScreenplay(script, layout), layout); const a4 = professionalLayout('a4');
    expect(letter.get('second')!.firstPage).toBe(2); expect(scenePagination(paginateScreenplay(script, a4), a4).get('second')!.firstPage).toBe(1);
    script.scenes[0].elements[0].content = 'Short.'; expect(scenePagination(paginateScreenplay(script, layout), layout).get('second')!.firstPage).toBe(1);
  });
  it('wraps using exact Courier advance and retains trailing newlines', () => {
    const element = createElement('dialogue', 'x'.repeat(35) + '\n', 0); expect(wrapElement(element, layout)).toEqual([{start:0,end:36},{start:36,end:36}]);
  });
});

it('paginates long dual dialogue without overflowing pages or duplicating source ranges', () => {
  const script = createScreenplay({ projectId: 'p', title: 'Dual', screenplayType: 'feature' }); const layout = professionalLayout('letter');
  script.scenes[0].elements = (['left', 'right'] as const).flatMap((side, index) => [
    { ...createElement('character', side.toUpperCase(), index * 2), dualDialogue: { groupId: 'pair', side, role: 'character' as const } },
    { ...createElement('dialogue', 'A long overlapping speech. '.repeat(180), index * 2 + 1), dualDialogue: { groupId: 'pair', side, role: 'dialogue' as const } },
  ]);
  const pages = paginateScreenplay(script, layout);
  expect(pages.length).toBeGreaterThan(1); expect(pages.every(page => page.usedLines <= pageLineCapacity(layout))).toBe(true);
  for (const element of script.scenes[0].elements) {
    expect(pages.flatMap(page => page.entries).filter(entry => entry.kind === 'element' && entry.element.id === element.id).map(entry => entry.kind === 'element' ? entry.element.content.slice(entry.start, entry.end) : '').join('')).toBe(element.content);
  }
});

it('shares adjacent before/after spacing as one paragraph gap', () => {
  const script = createScreenplay({ projectId: 'p', title: 'Spacing', screenplayType: 'feature' });
  script.scenes[0].elements = [createElement('scene_heading', 'INT. ROOM - DAY', 0), createElement('action', 'First.', 1), createElement('action', '', 2), createElement('action', 'Second.', 3), createElement('character', 'AVA', 4), createElement('dialogue', 'Hello.', 5)];
  for (const size of ['a4', 'letter'] as const) {
    const entries = paginateScreenplay(script, professionalLayout(size))[0].entries;
    expect(entries.map(entry => entry.lineStart)).toEqual([0, 2, 4, 6, 8, 9]);
  }
});

it('keeps explicitly separated page content anchored after earlier paragraph insertion', () => {
  const script = createScreenplay({ projectId: 'p', title: 'Page origins', screenplayType: 'feature' });
  script.scenes[0].elements = [createElement('action', 'Before.', 0), createElement('page_break', '', 1), createElement('action', 'After.', 2)];
  const layout = professionalLayout('letter'); const before = paginateScreenplay(script, layout)[1];
  script.scenes[0].elements.splice(1, 0, createElement('action', '', 1));
  expect(paginateScreenplay(script, layout)[1]).toEqual(before);
});
