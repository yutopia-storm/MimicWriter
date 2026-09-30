import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { continuousDocumentSchema as schema } from './continuous-document';
import {
  deleteForwardScreenplayElement,
  enterScreenplayElement,
  insertScreenplayLineBreak,
  moveToPreviousScreenplayElement,
  selectScreenplayElementType,
  skipExistingParentheticalClose,
  startParentheticalAfterCharacter,
  startParentheticalAfterDialogueBreak,
  tabScreenplayElement,
} from './continuous-editor-commands';
import type { ScreenplayElementType } from '../shared/models';

function stateFor(contents: string[], elementIndex: number, offset: number, types: ScreenplayElementType[] = []) {
  const elements = contents.map((content, index) =>
    schema.nodes.screenplay_element.create(
      { elementId: `element-${index}`, sceneId: 'scene-1', type: types[index] ?? 'action' },
      content
        ? content.split(/(\n)/).filter(Boolean).map((part) =>
            part === '\n' ? schema.nodes.hard_break.create() : schema.text(part),
          )
        : undefined,
    ),
  );
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.screenplay_scene.create({ sceneId: 'scene-1', order: 0 }, elements),
  ]);
  let position = 1;
  for (let index = 0; index < elementIndex; index += 1) position += elements[index].nodeSize;
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, position + 1 + offset),
  });
}

function runDelete(state: EditorState) {
  let next = state;
  expect(deleteForwardScreenplayElement(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
  return next;
}

function runTab(state: EditorState) {
  let next = state;
  expect(tabScreenplayElement(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
  return next;
}

describe('screenplay Tab navigation', () => {
  it.each(['', 'Existing text'])('cycles types in place at the start of %j', (text) => {
    let state = stateFor([text, 'Following'], 0, 0);
    for (const type of ['character', 'transition', 'action', 'character', 'transition', 'action']) {
      state = runTab(state);
      expect(state.selection.$from.parent.attrs).toMatchObject({ type, elementId: 'element-0' });
      expect(state.selection.$from.parent.textContent).toBe(type === 'transition' ? `${text}:` : text);
      expect(state.selection.$from.parentOffset).toBe(0);
      expect(state.doc.firstChild?.childCount).toBe(2);
    }
  });

  it('retains the existing new-element behavior at the end of text', () => {
    const state = runTab(stateFor(['Action'], 0, 6));
    expect(state.doc.firstChild?.childCount).toBe(2);
    expect(state.selection.$from.parent.attrs.type).toBe('character');
    expect(state.doc.firstChild?.firstChild?.textContent).toBe('Action');
  });

  it('cycles only the current Shift+Return line and repeats without creating another line', () => {
    let state = stateFor(['First line\nCurrent line\nLast line'], 0, 11);
    for (const [type, content] of [
      ['character', 'Current line'],
      ['transition', 'Current line:'],
      ['action', 'Current line'],
      ['character', 'Current line'],
    ] as const) {
      state = runTab(state);
      expect(state.selection.$from.parent.attrs.type).toBe(type);
      expect(state.selection.$from.parent.textContent).toBe(content);
      expect(state.selection.$from.parentOffset).toBe(0);
      expect(state.doc.firstChild?.childCount).toBe(3);
      expect(state.doc.firstChild?.child(0).textContent).toBe('First line');
      expect(state.doc.firstChild?.child(2).textContent).toBe('Last line');
    }
  });

  it('cycles the first Shift+Return line without changing the following line', () => {
    const state = runTab(stateFor(['Current line\nFollowing line'], 0, 0));
    expect(state.doc.firstChild?.childCount).toBe(2);
    expect(state.doc.firstChild?.child(0).attrs.type).toBe('character');
    expect(state.doc.firstChild?.child(0).textContent).toBe('Current line');
    expect(state.doc.firstChild?.child(1).attrs.type).toBe('action');
    expect(state.doc.firstChild?.child(1).textContent).toBe('Following line');
  });

  it('cycles a Return-separated current element repeatedly', () => {
    let state = stateFor(['First line', 'Current line'], 1, 0);
    for (const type of ['character', 'transition', 'action', 'character']) {
      state = runTab(state);
      expect(state.selection.$from.parent.attrs.type).toBe(type);
      expect(state.selection.$from.parentOffset).toBe(0);
      expect(state.doc.firstChild?.childCount).toBe(2);
    }
  });

  it.each(['INT.', 'EXT.', 'INT./EXT.', 'INT/EXT.', 'EXT./INT.', 'I/E.'])('moves through %s, location, time and existing action without editing text', (prefix) => {
    const heading = `${prefix} TRAIN - CARRIAGE - NIGHT`;
    let state = stateFor([heading, 'The train moves.'], 0, 0, ['scene_heading', 'action']);
    const original = state.doc;
    state = runTab(state);
    expect(state.selection.$from.parentOffset).toBe(heading.indexOf('TRAIN'));
    state = runTab(state);
    expect(state.selection.$from.parentOffset).toBe(heading.indexOf('NIGHT'));
    state = runTab(state);
    expect(state.selection.$from.parent.attrs.elementId).toBe('element-1');
    expect(state.selection.$from.parentOffset).toBe(0);
    expect(state.doc.eq(original)).toBe(true);
  });

  it.each(['', 'INT. ROOM', 'INT. ROOM - DAY'])('leaves heading %j intact when creating a missing action', (heading) => {
    let state = stateFor([heading, 'MARA'], 0, heading.length, ['scene_heading', 'character']);
    state = runTab(state);
    expect(state.doc.firstChild?.childCount).toBe(3);
    expect(state.doc.firstChild?.firstChild?.textContent).toBe(heading);
    expect(state.selection.$from.parent.attrs.type).toBe('action');
    expect(state.doc.firstChild?.lastChild?.textContent).toBe('MARA');
  });

  it('does not modify locked elements', () => {
    const initial = stateFor(['Action'], 0, 0);
    const state = initial.apply(initial.tr.setNodeMarkup(1, undefined, { ...initial.doc.firstChild!.firstChild!.attrs, locked: true }));
    expect(tabScreenplayElement(state)).toBe(false);
  });
});

describe('screenplay editor forward delete', () => {
  it('deletes the character in front of the caret', () => {
    const next = runDelete(stateFor(['Ahead'], 0, 1));
    expect(next.doc.textContent).toBe('Aead');
  });

  it('removes an empty line in front of the caret', () => {
    const next = runDelete(stateFor(['Ahead', '', 'After'], 0, 5));
    expect(next.doc.firstChild?.childCount).toBe(2);
    expect(next.doc.textContent).toBe('AheadAfter');
  });

  it('joins the following line at the end of an element', () => {
    const next = runDelete(stateFor(['Ahead', 'After'], 0, 5));
    expect(next.doc.firstChild?.childCount).toBe(1);
    expect(next.doc.textContent).toBe('AheadAfter');
  });

  it('does not delete across a scene boundary', () => {
    const state = stateFor(['Ahead'], 0, 5);
    expect(deleteForwardScreenplayElement(state)).toBe(false);
  });
});

describe('screenplay editor backspace', () => {
  it('removes an empty paragraph and pulls the following content up', () => {
    const state = stateFor(['Before', '', 'After'], 1, 0);
    let next = state;
    expect(moveToPreviousScreenplayElement(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
    expect(next.doc.firstChild?.childCount).toBe(2);
    expect(next.doc.textContent).toBe('BeforeAfter');
    expect(next.selection.$from.parent.textContent).toBe('Before');
  });
});

describe('screenplay editor line breaks', () => {
  it('inserts a soft line break without creating another screenplay element', () => {
    const state = stateFor(['First line'], 0, 5);
    let next = state;

    expect(insertScreenplayLineBreak(state, (transaction) => { next = state.apply(transaction); })).toBe(true);

    expect(next.doc.firstChild?.childCount).toBe(1);
    expect(next.selection.$from.parent.child(1).type).toBe(schema.nodes.hard_break);
    expect(next.selection.$from.parent.child(2).textContent).toBe(' line');
    expect(next.selection.$from.parent.attrs.elementId).toBe('element-0');

    const typed = next.apply(next.tr.insertText('Next'));
    expect(typed.selection.$from.parent.child(2).textContent).toBe('Next line');
  });
});

describe('screenplay editor element transitions', () => {
  it.each(['', 'Existing action'])('starts a selected transition before its colon after %j', (text) => {
    const initial = stateFor([text], 0, text.length);
    let state = initial;
    selectScreenplayElementType('transition')(initial, tr => { state = initial.apply(tr); });
    expect(state.selection.$from.parent.textContent).toBe(':');
    expect(state.selection.$from.parentOffset).toBe(0);
    state = state.apply(state.tr.insertText('CUT TO'));
    expect(state.selection.$from.parent.textContent).toBe('CUT TO:');
    let next = state;
    enterScreenplayElement(state, tr => { next = state.apply(tr); });
    expect(next.selection.$from.parent.attrs.type).toBe('scene_heading');
    expect(next.selection.$from.parent.textContent).toBe('');
    expect(next.doc.textContent).toBe(`${text}CUT TO:`);
  });

  it('does not duplicate an existing colon when tabbing to transition', () => {
    const state = runTab(stateFor(['CUT TO:'], 0, 0, ['character']));
    expect(state.selection.$from.parent.textContent).toBe('CUT TO:');
    expect(state.selection.$from.parentOffset).toBe(0);
  });

  it('cycles an unused transition back to an empty action', () => {
    const transition = runTab(stateFor([''], 0, 0, ['character']));
    expect(transition.selection.$from.parent.textContent).toBe(':');
    const action = runTab(transition);
    expect(action.selection.$from.parent.attrs.type).toBe('action');
    expect(action.selection.$from.parent.textContent).toBe('');
    expect(action.doc.firstChild?.childCount).toBe(1);
  });

  it('returns from a parenthetical directly into dialogue', () => {
    const state = stateFor(['(quietly)'], 0, 9, ['parenthetical']);
    let next = state;
    expect(enterScreenplayElement(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
    expect(next.doc.firstChild?.child(1).attrs.type).toBe('dialogue');
  });

  it('returns from dialogue into a new character cue', () => {
    const state = stateFor(['Hello.'], 0, 6, ['dialogue']);
    let next = state;
    expect(enterScreenplayElement(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
    expect(next.doc.firstChild?.child(1).attrs.type).toBe('character');
  });

  it('creates a new chosen element when only the caret is active', () => {
    const state = stateFor(['Existing action'], 0, 15, ['action']);
    let next = state;
    expect(selectScreenplayElementType('transition')(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
    expect(next.doc.firstChild?.childCount).toBe(2);
    expect(next.doc.firstChild?.child(0).attrs.type).toBe('action');
    expect(next.doc.firstChild?.child(1).attrs.type).toBe('transition');
  });

  it('converts the current element when its text is selected', () => {
    const initial = stateFor(['Selected action'], 0, 15, ['action']);
    const state = initial.apply(initial.tr.setSelection(TextSelection.create(initial.doc, 2, 17)));
    let next = state;
    expect(selectScreenplayElementType('transition')(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
    expect(next.doc.firstChild?.childCount).toBe(1);
    expect(next.doc.firstChild?.child(0).attrs.type).toBe('transition');
    expect(next.doc.firstChild?.child(0).textContent).toBe('Selected action:');
    expect(next.selection.$from.parentOffset).toBe(15);
  });
});

describe('automatic parentheticals', () => {
  it('turns an empty dialogue directly after a character into one bracket pair', () => {
    const state = stateFor(['MARA', ''], 1, 0, ['character', 'dialogue']);
    let next = state;
    expect(startParentheticalAfterCharacter(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
    expect(next.selection.$from.parent.attrs.type).toBe('parenthetical');
    expect(next.selection.$from.parent.textContent).toBe('()');
    expect(next.selection.$from.parentOffset).toBe(1);
  });

  it('does not activate away from a character cue', () => {
    expect(startParentheticalAfterCharacter(stateFor(['Action', ''], 1, 0, ['action', 'dialogue']))).toBe(false);
  });

  it('moves past the existing closing bracket instead of adding another', () => {
    const state = stateFor(['(quietly)'], 0, 8, ['parenthetical']);
    let next = state;
    expect(skipExistingParentheticalClose(state, (transaction) => { next = state.apply(transaction); })).toBe(true);
    expect(next.selection.$from.parent.textContent).toBe('(quietly)');
    expect(next.selection.$from.parentOffset).toBe(9);
  });

  it('turns a trailing dialogue soft-break into a parenthetical element', () => {
    const initial = stateFor(['Dialogue'], 0, 8, ['dialogue']);
    let withBreak = initial;
    expect(insertScreenplayLineBreak(initial, (transaction) => { withBreak = initial.apply(transaction); })).toBe(true);
    let next = withBreak;
    expect(startParentheticalAfterDialogueBreak(withBreak, (transaction) => { next = withBreak.apply(transaction); })).toBe(true);
    expect(next.doc.firstChild?.childCount).toBe(2);
    expect(next.doc.firstChild?.child(0).textContent).toBe('Dialogue');
    expect(next.doc.firstChild?.child(0).attrs.type).toBe('dialogue');
    expect(next.doc.firstChild?.child(1).attrs.type).toBe('parenthetical');
    expect(next.doc.firstChild?.child(1).textContent).toBe('()');
    expect(next.selection.$from.parent.attrs.type).toBe('parenthetical');
    expect(next.selection.$from.parentOffset).toBe(1);
  });
});
