import { describe, expect, it } from 'vitest';
import { advanceElement, compileScreenplay, createElement, createScreenplay, deleteScene, insertScene, moveScene, nextElementType, normalizeOrders, normalizeSceneBoundaries, sceneHeading, sceneLocation, tabElementType, validateScreenplay } from './screenplay';
import { applyFormatting, canMakeDualDialogue, canToggleDualDialogue, convertCase, dualDialogueGroupForDialogues, makeDualDialogue, reconcileFormatting, removeDualDialogue, removeFormatting, toggleDualDialogue, uniqueSuggestions } from './screenplay-editing';

describe('screenplay domain', () => {
  it('creates structured screenplays with stable scene and element identities', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    expect(validateScreenplay(screenplay)).toEqual([]);
    expect(screenplay.scenes[0].id).toBeTruthy();
    expect(screenplay.scenes[0].elements.map((element) => element.type)).toEqual(['scene_heading', 'action']);
  });

  it('preserves stable IDs through editing and scene reordering', () => {
    let screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    screenplay = insertScene(screenplay, screenplay.scenes[0].id); screenplay = insertScene(screenplay, screenplay.scenes[1].id);
    const ids = screenplay.scenes.map((scene) => scene.id); const elementId = screenplay.scenes[0].elements[0].id;
    screenplay = { ...screenplay, scenes: screenplay.scenes.map((scene, index) => index ? scene : { ...scene, elements: scene.elements.map((element, elementIndex) => elementIndex ? element : { ...element, content: 'EXT. RIDGE - DAWN' }) }) };
    screenplay = moveScene(screenplay, ids[0], 1);
    expect(screenplay.scenes.map((scene) => scene.id)).toEqual([ids[1], ids[0], ids[2]]);
    expect(screenplay.scenes[1].elements[0].id).toBe(elementId);
  });

  it('presents scene headings in uppercase without changing stored content', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    screenplay.scenes[0].elements[0].content = 'Int. Signal Room - Night';
    expect(sceneHeading(screenplay.scenes[0], 1)).toBe('INT. SIGNAL ROOM - NIGHT');
    expect(screenplay.scenes[0].elements[0].content).toBe('Int. Signal Room - Night');
  });

  it('derives a location from conventional scene headings', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    screenplay.scenes[0].elements[0].content = 'INT./EXT. POLICE CAR - NIGHT';
    expect(sceneLocation(screenplay.scenes[0])).toBe('POLICE CAR');
  });

  it('promotes every additional scene heading into a separate scene', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    const originalSceneId = screenplay.scenes[0].id;
    screenplay.scenes[0].elements = [
      createElement('scene_heading', 'INT. ROOM - DAY', 0),
      createElement('action', 'First.', 1),
      createElement('scene_heading', 'EXT. ROAD - NIGHT', 2),
      createElement('action', 'Second.', 3),
    ];
    const result = normalizeSceneBoundaries(screenplay);
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0].id).toBe(originalSceneId);
    expect(result.scenes.map((scene) => scene.elements.map((element) => element.type))).toEqual([
      ['scene_heading', 'action'],
      ['scene_heading', 'action'],
    ]);
    expect(result.scenes[1].id).not.toBe(originalSceneId);
  });

  it('deletes only the selected scene and refuses to delete the last scene', () => {
    const one = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    expect(() => deleteScene(one, one.scenes[0].id)).toThrow(/at least one scene/);
    const two = insertScene(one); const survivingId = two.scenes[1].id;
    expect(deleteScene(two, two.scenes[0].id).scenes[0].id).toBe(survivingId);
  });

  it('compiles scene and element order deterministically', () => {
    let screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    screenplay = insertScene(screenplay); screenplay.scenes[0].elements.push(createElement('transition', 'CUT TO:', 2));
    screenplay = normalizeOrders(screenplay);
    const compiled = compileScreenplay(screenplay);
    expect(compiled.map((element) => `${element.sceneNumber}:${element.type}`)).toEqual(['1:scene_heading','1:action','1:transition','2:scene_heading','2:action']);
  });

  it('uses conventional next-element behavior', () => {
    expect(nextElementType('scene_heading')).toBe('action');
    expect(nextElementType('character')).toBe('dialogue');
    expect(nextElementType('dialogue')).toBe('character');
    expect(nextElementType('parenthetical')).toBe('dialogue');
    expect(tabElementType('action')).toBe('character');
    expect(tabElementType('character')).toBe('parenthetical');
    expect(nextElementType('shot')).toBe('action');
  });

  it('reuses transient empty elements instead of abandoning them', () => {
    const scene = createScreenplay({ projectId: crypto.randomUUID(), title: 'Flow', screenplayType: 'feature' }).scenes[0]; const action = scene.elements[1];
    const character = advanceElement(scene, action.id, 'character');
    expect(character.replaced).toBe(true); expect(character.scene.elements).toHaveLength(2); expect(character.scene.elements[1]).toMatchObject({ id: action.id, type: 'character', content: '' });
    const backToAction = advanceElement(character.scene, action.id, 'action'); expect(backToAction.scene.elements).toHaveLength(2); expect(backToAction.scene.elements[1].type).toBe('action');
  });

  it('inserts after meaningful content while retaining stable identities', () => {
    const scene = createScreenplay({ projectId: crypto.randomUUID(), title: 'Flow', screenplayType: 'feature' }).scenes[0]; const action = scene.elements[1]; action.content = 'Wait.';
    const result = advanceElement(scene, action.id, 'character'); expect(result.replaced).toBe(false); expect(result.scene.elements.map((element) => element.type)).toEqual(['scene_heading', 'action', 'character']); expect(result.scene.elements[1].id).toBe(action.id);
  });

  it('derives deterministic character and heading suggestions without blocking new values', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    screenplay.scenes[0].elements[0].content = 'INT. SIGNAL ROOM - NIGHT';
    screenplay.scenes[0].elements.push(createElement('character', 'ZIDER', 2));
    expect(uniqueSuggestions(screenplay, 'character', 'ZI')).toEqual(['ZIDER']);
    expect(uniqueSuggestions(screenplay, 'character', 'MARA')).toEqual([]);
    expect(uniqueSuggestions(screenplay, 'scene_heading', 'INT.')).toEqual(['INT. SIGNAL ROOM - NIGHT']);
  });

  it('stores partial and combined emphasis structurally and reconciles ordinary edits', () => {
    let element = createElement('action', 'Signal lost', 0);
    element = applyFormatting(element, 0, 6, { bold: true, italic: true, underline: true });
    expect(element.formatting).toEqual([{ start: 0, end: 6, bold: true, italic: true, underline: true }]);
    element = reconcileFormatting(element, 'The Signal lost');
    expect(element.formatting?.[0]).toMatchObject({ start: 4, end: 10 });
    expect(removeFormatting(element, 4, 6).formatting?.[0].start).toBe(6);
  });

  it('converts only selected text case without changing element identity', () => {
    const element = createElement('action', 'Quiet room', 0); const id = element.id;
    const upper = convertCase(element, 0, 5, 'upper');
    expect(upper.content).toBe('QUIET room'); expect(upper.id).toBe(id);
    expect(convertCase(upper, 0, 5, 'lower').content).toBe('quiet room');
  });

  it('supports discoverable emphasis, colours and alignment as structured data', () => {
    let element = createElement('action', 'A sharp flash.', 0);
    element = applyFormatting(element, 2, 7, { strike: true, color: '#ff0000', backgroundColor: '#ffff00' });
    element = { ...element, alignment: 'justify' };
    expect(element.formatting?.[0]).toMatchObject({ start: 2, end: 7, strike: true, color: '#ff0000', backgroundColor: '#ffff00' });
    expect(element.alignment).toBe('justify'); expect(validateScreenplay({ ...createScreenplay({ projectId: crypto.randomUUID(), title: 'Style', screenplayType: 'feature' }), scenes: [{ ...createScreenplay({ projectId: crypto.randomUUID(), title: 'Style', screenplayType: 'feature' }).scenes[0], elements: [element] }] })).toEqual([]);
  });

  it('creates, compiles and reverses structural dual dialogue without changing IDs', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    const scene = screenplay.scenes[0];
    scene.elements = [createElement('character', 'MARA', 0), createElement('dialogue', 'Go.', 1), createElement('character', 'ZIDER', 2), createElement('parenthetical', '(overlapping)', 3), createElement('dialogue', 'Wait.', 4)];
    const ids = scene.elements.map((element) => element.id); const characters = [ids[0], ids[2]];
    expect(canMakeDualDialogue(scene, characters)).toBe(true);
    const dual = makeDualDialogue(scene, characters, 'dual-1'); screenplay.scenes[0] = dual;
    expect(compileScreenplay(screenplay).every((element) => element.dualDialogue?.groupId === 'dual-1')).toBe(true);
    const restored = removeDualDialogue(dual, 'dual-1');
    expect(restored.elements.map((element) => element.id)).toEqual(ids);
    expect(restored.elements.every((element) => !element.dualDialogue)).toBe(true);
  });

  it('toggles two selected dialogue elements between dual and single dialogue', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Signal', screenplayType: 'feature' });
    const scene = screenplay.scenes[0];
    scene.elements = [createElement('character', 'MARA', 0), createElement('dialogue', 'Go.', 1), createElement('character', 'ZIDER', 2), createElement('parenthetical', '(overlapping)', 3), createElement('dialogue', 'Wait.', 4)];
    const dialogueIds = [scene.elements[1].id, scene.elements[4].id];
    expect(canToggleDualDialogue(scene, dialogueIds)).toBe(true);
    const dual = toggleDualDialogue(scene, dialogueIds);
    expect(dualDialogueGroupForDialogues(dual, dialogueIds)).toBeTruthy();
    expect(dual.elements.filter((element) => element.dualDialogue)).toHaveLength(5);
    const single = toggleDualDialogue(dual, dialogueIds);
    expect(dualDialogueGroupForDialogues(single, dialogueIds)).toBeNull();
    expect(single.elements.every((element) => !element.dualDialogue)).toBe(true);
    expect(single.elements.map((element) => element.id)).toEqual(scene.elements.map((element) => element.id));
  });

  it('validates optional anchored writer notes while accepting older records without notes', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Notes', screenplayType: 'feature' });
    expect(validateScreenplay(screenplay)).toEqual([]);
    const scene = screenplay.scenes[0];
    const element = scene.elements[0];
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(), sceneId: scene.id,
      from: { elementId: element.id, offset: 0 }, to: { elementId: element.id, offset: 3 },
      selectedText: 'INT', content: 'Check this location.', createdAt: now, updatedAt: now,
    };
    expect(validateScreenplay({ ...screenplay, notes: [note] })).toEqual([]);
    expect(validateScreenplay({ ...screenplay, notes: [note, { ...note }] })).toContain('Note identities must be present and unique.');
    expect(validateScreenplay({ ...screenplay, notes: [{ ...note, content: ' ' }] })).toContain('Note content is required.');
    const response = { id: crypto.randomUUID(), content: 'Agreed.', createdAt: now, updatedAt: now };
    expect(validateScreenplay({ ...screenplay, notes: [{ ...note, responses: [response] }] })).toEqual([]);
    expect(validateScreenplay({ ...screenplay, notes: [{ ...note, responses: [response, response] }] })).toContain('Note response identities must be present and unique.');
  });
});
