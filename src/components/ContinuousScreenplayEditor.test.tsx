// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, createScreenplay } from '../domain/screenplay';
import { makeDualDialogue } from '../domain/screenplay-editing';
import { ContinuousScreenplayEditor } from './ContinuousScreenplayEditor';

afterEach(cleanup);

describe('screenplay editor dialogue selection', () => {
  it('keeps a selected diamond visible until it is selected again', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Selection', screenplayType: 'feature' });
    screenplay.scenes[0].elements = [
      createElement('character', 'MARA', 0),
      createElement('dialogue', 'First line.', 1),
      createElement('character', 'ZIDER', 2),
      createElement('dialogue', 'Second line.', 3),
    ];

    const view = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={vi.fn()} />);
    const first = view.getByRole('checkbox', { name: 'Select dialogue First line.' });

    fireEvent.click(first);
    expect(first).toHaveClass('selected');
    expect(first).toHaveAttribute('aria-checked', 'true');

    fireEvent.mouseLeave(first.parentElement!);
    expect(first).toHaveClass('selected');
    expect(first).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(first);
    expect(first).not.toHaveClass('selected');
    expect(first).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps both diamonds selected until the dual-dialogue command is used', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Selection', screenplayType: 'feature' });
    screenplay.scenes[0].elements = [
      createElement('character', 'MARA', 0),
      createElement('dialogue', 'First line.', 1),
      createElement('character', 'ZIDER', 2),
      createElement('dialogue', 'Second line.', 3),
    ];

    const view = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={vi.fn()} />);
    const first = view.getByRole('checkbox', { name: 'Select dialogue First line.' });
    const second = view.getByRole('checkbox', { name: 'Select dialogue Second line.' });

    fireEvent.click(first);
    fireEvent.click(second);
    expect(first).toHaveClass('selected');
    expect(second).toHaveClass('selected');

    fireEvent.click(view.getByRole('button', { name: 'Make selected dialogue dual' }));
    expect(first).not.toHaveClass('selected');
    expect(second).not.toHaveClass('selected');
    expect(first).toHaveAttribute('aria-checked', 'false');
    expect(second).toHaveAttribute('aria-checked', 'false');
  });

  it('offers removal when either dialogue in an existing dual pair is selected', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Selection', screenplayType: 'feature' });
    const firstCharacter = createElement('character', 'MARA', 0);
    const firstDialogue = createElement('dialogue', 'First line.', 1);
    const secondCharacter = createElement('character', 'ZIDER', 2);
    const secondDialogue = createElement('dialogue', 'Second line.', 3);
    screenplay.scenes[0].elements = [firstCharacter, firstDialogue, secondCharacter, secondDialogue];
    screenplay.scenes[0] = makeDualDialogue(screenplay.scenes[0], [firstCharacter.id, secondCharacter.id], 'dual-test');

    const view = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={vi.fn()} />);
    fireEvent.click(view.getByRole('checkbox', { name: 'Select dialogue First line.' }));

    expect(view.getByRole('button', { name: 'Return selected dialogue to single dialogue' })).toBeVisible();
  });

  it('dispatches the New Scene command from the preview card button', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Scenes', screenplayType: 'feature' });
    const onSceneCommand = vi.fn();
    const view = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={vi.fn()} onSceneCommand={onSceneCommand} />);

    fireEvent.click(view.getByRole('button', { name: 'New scene after scene 1' }));

    expect(onSceneCommand).toHaveBeenCalledWith(screenplay.scenes[0].id, 'add');
  });
});

import { paginateScreenplay } from '../domain/pagination';
import { professionalLayout } from '../shared/screenplay-layout';

describe('shared screenplay pagination decorations', () => {
  it('keeps page boundaries and metadata identical when isolating a scene; reflows without emitting edits', () => {
    const screenplay = createScreenplay({ projectId: 'p', title: 'Pages', screenplayType: 'feature' });
    screenplay.scenes[0].elements = [createElement('action', 'Opening. '.repeat(400), 0)];
    const scene = { ...screenplay.scenes[0], id: 'focused', order: 1, elements: [createElement('character', 'AVA', 0), createElement('dialogue', 'Dialogue words. '.repeat(400), 1)] }; screenplay.scenes.push(scene);
    const layout = professionalLayout('letter'); const pages = paginateScreenplay(screenplay, layout); const change = vi.fn();
    const view = render(<ContinuousScreenplayEditor screenplay={screenplay} pages={pages} layout={layout} onChange={change} />);
    const card = view.container.querySelector('[data-scene-id="focused"].continuous-scene')!;
    const metadata = card.getAttribute('data-pagination'); const boundaries = [...card.querySelectorAll('.pagination-boundary')].map(node => node.textContent);
    expect(boundaries.length).toBeGreaterThan(0); expect(card.querySelectorAll('.pagination-more').length).toBeGreaterThan(0);
    view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} pages={pages} layout={layout} sceneId="focused" onChange={change} />);
    expect(view.container.querySelectorAll('.continuous-scene')).toHaveLength(1);
    expect(view.container.querySelector('.continuous-scene')).toHaveAttribute('data-pagination', metadata);
    expect([...view.container.querySelectorAll('.pagination-boundary')].map(node => node.textContent)).toEqual(boundaries);
    const shorter = structuredClone(screenplay); shorter.scenes[1].elements[1].content = 'Done.';
    view.rerender(<ContinuousScreenplayEditor screenplay={shorter} pages={paginateScreenplay(shorter, layout)} layout={layout} sceneId="focused" onChange={change} />);
    expect(view.container.querySelectorAll('.pagination-more,.pagination-continued')).toHaveLength(0); expect(change).not.toHaveBeenCalled();
  });
});


describe('standard screenplay keyboard editing', () => {
  function setup(continuous = false) {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }) });
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
    const screenplay = createScreenplay({ projectId: 'keyboard', title: 'Keys', screenplayType: 'feature' });
    screenplay.scenes[0].elements = [createElement('action', 'First paragraph'), createElement('action', 'Second paragraph')];
    screenplay.scenes.push({ ...structuredClone(screenplay.scenes[0]), id: 'second-scene', order: 1, elements: [createElement('action', 'Other scene')] });
    const change = vi.fn();
    const result = render(<ContinuousScreenplayEditor screenplay={screenplay} physicalPages={continuous} onChange={change} />);
    const editor = result.container.querySelector('.ProseMirror') as HTMLElement;
    editor.focus();
    return { ...result, editor, change };
  }
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });


  it('keeps the editor attached when switching from cards to Continuous and back', () => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }) });
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
    const screenplay = createScreenplay({ projectId: 'switch', title: 'Switch', screenplayType: 'feature' });
    screenplay.scenes[0].elements = [createElement('action', 'Switch mode text')];
    const change = vi.fn();
    const result = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
    const original = result.container.querySelector('.ProseMirror') as HTMLElement;
    original.focus();
    const modeButton = document.createElement('button');
    document.body.append(modeButton);
    modeButton.focus();
    result.rerender(<ContinuousScreenplayEditor screenplay={screenplay} physicalPages onChange={change} />);
    const editor = result.container.querySelector('.ProseMirror') as HTMLElement;
    expect(editor).not.toBeNull();
    expect(editor?.isConnected).toBe(true);
    expect(editor).toBe(original);
    expect(document.activeElement).toBe(editor);
    modeButton.remove();
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(editor, { key: 'Delete' });
    expect(editor.textContent).not.toContain('Switch mode text');
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(editor.textContent).toContain('Switch mode text');
    result.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
    expect(result.container.querySelector('.ProseMirror')).toBe(original);
  });
  it.each(['Backspace', 'Delete'])('selects only card text and supports %s, undo and redo', key => {
    const { editor, change } = setup();
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    expect(window.getSelection()?.toString()).toContain('First paragraph');
    expect(window.getSelection()?.toString()).not.toMatch(/SCENE|New Scene|Other scene/);
    fireEvent.keyDown(editor, { key });
    expect(editor.textContent).not.toContain('First paragraph');
    expect(editor.textContent).toContain('Other scene');
    expect(change).toHaveBeenCalled();
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(editor.textContent).toContain('First paragraph');
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(editor.textContent).not.toContain('First paragraph');
  });

  it('deletes the full continuous document and restores it with Ctrl+Z', () => {
    const { editor } = setup(true);
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(editor, { key: 'Delete' });
    expect(editor.textContent).not.toMatch(/First paragraph|Second paragraph|Other scene/);
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(editor.textContent).toContain('Other scene');
  });


  it.each([false, true])('pastes over the selected scope (continuous=%s)', continuous => {
    vi.stubGlobal('desktop', { preferClipboardEvents: true });
    const { editor } = setup(continuous);
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    fireEvent.paste(editor, { clipboardData: { getData: (type: string) => type === 'text/plain' ? 'Replacement text.' : '' } });
    expect(editor.textContent).toContain('Replacement text.');
    expect(editor.textContent).not.toMatch(/First paragraph|Second paragraph/);
    expect(editor.textContent?.includes('Other scene')).toBe(!continuous);
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(editor.textContent).toContain('First paragraph');
    expect(editor.textContent).toContain('Other scene');
  });

  it('cuts and pastes through desktop Ctrl+X/V, and copies through Ctrl+C', async () => {
    let clipboard = { text: '' };
    vi.stubGlobal('desktop', {
      writeClipboard: vi.fn(async (data) => { clipboard = data; }),
      readClipboard: vi.fn(async () => clipboard),
    });
    const { editor } = setup();
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(editor, { key: 'c', ctrlKey: true });
    expect(clipboard.text).toContain('First paragraph');
    fireEvent.keyDown(editor, { key: 'x', ctrlKey: true });
    await waitFor(() => expect(editor.textContent).not.toContain('First paragraph'));
    fireEvent.keyDown(editor, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(editor.textContent).toContain('First paragraph'));
    expect(editor.textContent).toContain('Other scene');
  });

  it.each([false, true])('uses native browser copy/cut/paste events (continuous=%s)', continuous => {
    vi.stubGlobal('desktop', { preferClipboardEvents: true, writeClipboard: vi.fn(), readClipboard: vi.fn() });
    const { editor } = setup(continuous);
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    expect(fireEvent.keyDown(editor, { key: 'c', ctrlKey: true })).toBe(true);
    const data = new Map<string, string>();
    const clipboardData = { setData: (type: string, value: string) => data.set(type, value), getData: (type: string) => data.get(type) ?? '' };
    fireEvent.copy(editor, { clipboardData });
    expect(data.get('text/plain')).toContain('Second paragraph');
    expect(data.get('text/plain')).not.toMatch(/SCENE|New Scene/);
    expect(data.get('text/plain')?.includes('Other scene')).toBe(continuous);
    fireEvent.cut(editor, { clipboardData });
    expect(editor.textContent).not.toContain('First paragraph');
    fireEvent.paste(editor, { clipboardData });
    expect(editor.textContent).toContain('First paragraph');
    expect(editor.textContent).toContain('Other scene');
    expect(window.desktop.writeClipboard).not.toHaveBeenCalled();
    expect(window.desktop.readClipboard).not.toHaveBeenCalled();
  });
});


it('decorates all search matches and updates scene focus for the selected match', () => {
  const screenplay = createScreenplay({ projectId: 'find', title: 'Find', screenplayType: 'feature' });
  const element = createElement('action', 'Blue sky, blue water.');
  screenplay.scenes[0].elements = [element];
  const matches = [{ sceneId: screenplay.scenes[0].id, elementId: element.id, start: 0, end: 4, preview: element.content }, { sceneId: screenplay.scenes[0].id, elementId: element.id, start: 10, end: 14, preview: element.content }];
  const track = vi.fn(); window.addEventListener('screenplay-scene-focus', track);
  const change = vi.fn();
  const view = render(<ContinuousScreenplayEditor screenplay={screenplay} searchMatches={matches} activeSearchMatch={matches[0]} onChange={change} />);
  expect([...view.container.querySelectorAll('.screenplay-search-match')].map(node => node.textContent)).toEqual(['Blue', 'blue']);
  expect((track.mock.calls[0][0] as CustomEvent).detail).toBe(screenplay.scenes[0].id);
  expect(change).not.toHaveBeenCalled();
  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} searchMatches={[]} onChange={change} />);
  expect(view.container.querySelectorAll('.screenplay-search-match')).toHaveLength(0);
  window.removeEventListener('screenplay-scene-focus', track);
});


it('keeps a backward multi-element selection through record refreshes and successive styles', () => {
  let screenplay = createScreenplay({ projectId: 'format', title: 'Format', screenplayType: 'feature' });
  screenplay.scenes[0].elements = [createElement('action', 'First text'), createElement('action', 'Second text')];
  const change = vi.fn();
  const result = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
  const editor = result.container.querySelector('.ProseMirror') as HTMLElement;
  editor.focus();
  const nodes = result.container.querySelectorAll('.continuous-block-content');
  act(() => {
    window.getSelection()!.setBaseAndExtent(nodes[1].firstChild!, 6, nodes[0].firstChild!, 6);
    fireEvent.keyDown(editor, { key: 'Control', ctrlKey: true });
  });
  const selected = window.getSelection()!.toString();
  for (const command of ['bold', 'italic', 'underline']) {
    act(() => { window.dispatchEvent(new CustomEvent('screenplay-format', { detail: { command } })); });
    screenplay = structuredClone(change.mock.calls.at(-1)![0]);
    // A legitimate external record update must preserve both selection endpoints.
    screenplay.scenes[0].elements[0].alignment = 'left';
    result.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
    expect(window.getSelection()!.isCollapsed).toBe(false);
    expect(window.getSelection()!.toString()).toBe(selected);
  }
  expect(screenplay.scenes[0].elements[0].formatting?.some(range => range.bold && range.italic && range.underline)).toBe(true);
});

it('adds, stacks, removes and hides persisted margin notes', async () => {
  let screenplay = createScreenplay({ projectId: 'notes', title: 'Notes', screenplayType: 'feature' });
  const element = createElement('character', 'SOLICITOR');
  screenplay.scenes[0].elements = [element];
  const change = vi.fn();
  const view = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
  const editor = view.container.querySelector('.ProseMirror') as HTMLElement;
  const text = view.container.querySelector('.continuous-block-content')!.firstChild!;

  act(() => {
    window.getSelection()!.setBaseAndExtent(text, 0, text, 9);
    fireEvent.keyDown(editor, { key: 'Control', ctrlKey: true });
  });
  fireEvent.click(view.getByRole('button', { name: 'Add Note' }));
  fireEvent.change(view.getByRole('textbox', { name: 'Add note' }), { target: { value: 'She needs more personality.' } });
  fireEvent.click(view.getByRole('button', { name: 'Save Note' }));

  screenplay = change.mock.calls.at(-1)![0];
  expect(screenplay.notes).toHaveLength(1);
  expect(screenplay.notes?.[0]).toMatchObject({
    sceneId: screenplay.scenes[0].id,
    from: { elementId: element.id, offset: 0 },
    to: { elementId: element.id, offset: 9 },
    selectedText: 'SOLICITOR',
    content: 'She needs more personality.',
  });

  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
  expect(view.getByRole('note', { name: 'Note: She needs more personality.' })).toBeVisible();

  screenplay = {
    ...screenplay,
    notes: [...screenplay.notes!, { ...screenplay.notes![0], id: crypto.randomUUID(), content: 'Second nearby note.' }],
  };
  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
  await waitFor(() => expect([...view.container.querySelectorAll<HTMLElement>('.screenplay-margin-note')].some((note) => note.style.transform)).toBe(true));

  const notes = [...view.container.querySelectorAll<HTMLElement>('.screenplay-margin-note')];
  notes.forEach((note) => { note.style.transform = ''; });
  const editorMutation = document.createTextNode('');
  editor.append(editorMutation);
  editorMutation.remove();
  await waitFor(() => expect(notes.some((note) => note.style.transform)).toBe(true));

  fireEvent.click(view.getByRole('button', { name: 'Remove note: She needs more personality.' }));
  expect(change.mock.calls.at(-1)?.[1]).toBe('remove-note');
  screenplay = change.mock.calls.at(-1)![0];
  expect(screenplay.notes).toHaveLength(1);
  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
  expect(view.queryByRole('note', { name: 'Note: She needs more personality.' })).toBeNull();
  expect(view.getByRole('note', { name: 'Note: Second nearby note.' })).toBeVisible();

  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} notesVisible={false} onChange={change} />);
  expect(view.queryByRole('note')).toBeNull();
});

it('resolves, edits and responds to a margin note', () => {
  let screenplay = createScreenplay({ projectId: 'note-actions', title: 'Note actions', screenplayType: 'feature' });
  const element = createElement('action', 'She crosses the room.');
  screenplay.scenes[0].elements = [element];
  const now = new Date().toISOString();
  screenplay.notes = [{
    id: crypto.randomUUID(), sceneId: screenplay.scenes[0].id,
    from: { elementId: element.id, offset: 0 }, to: { elementId: element.id, offset: 3 },
    selectedText: 'She', content: 'Check this action.', createdAt: now, updatedAt: now,
  }];
  const change = vi.fn();
  const view = render(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);

  fireEvent.click(view.getByRole('checkbox', { name: 'Mark note as dealt with: Check this action.' }));
  expect(change.mock.calls.at(-1)?.[1]).toBe('resolve-note');
  screenplay = change.mock.calls.at(-1)![0];
  expect(screenplay.notes?.[0].resolved).toBe(true);
  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
  expect(view.getByRole('note')).toHaveClass('resolved');

  fireEvent.click(view.getByRole('button', { name: 'Edit note: Check this action.' }));
  fireEvent.change(view.getByRole('textbox', { name: 'Edit note' }), { target: { value: 'Action corrected.' } });
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  expect(change.mock.calls.at(-1)?.[1]).toBe('edit-note');
  screenplay = change.mock.calls.at(-1)![0];
  expect(screenplay.notes?.[0].content).toBe('Action corrected.');
  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);

  fireEvent.click(view.getByRole('button', { name: 'Respond to note: Action corrected.' }));
  fireEvent.change(view.getByRole('textbox', { name: 'Respond to note' }), { target: { value: 'Confirmed in the new draft.' } });
  fireEvent.click(view.getByRole('button', { name: 'Respond' }));
  expect(change.mock.calls.at(-1)?.[1]).toBe('respond-note');
  screenplay = change.mock.calls.at(-1)![0];
  expect(screenplay.notes?.[0].responses?.[0].content).toBe('Confirmed in the new draft.');
  view.rerender(<ContinuousScreenplayEditor screenplay={screenplay} onChange={change} />);
  expect(view.getByText('Confirmed in the new draft.')).toHaveClass('screenplay-margin-note-response');

  vi.stubGlobal('desktop', { preferClipboardEvents: true, writeClipboard: vi.fn(), readClipboard: vi.fn() });
  const editor = view.container.querySelector('.ProseMirror') as HTMLElement;
  fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
  const copied = new Map<string, string>();
  fireEvent.copy(editor, { clipboardData: { setData: (type: string, value: string) => copied.set(type, value), getData: (type: string) => copied.get(type) ?? '' } });
  expect(copied.get('text/plain')).toContain('She crosses the room.');
  expect(copied.get('text/plain')).not.toMatch(/Action corrected|Confirmed in the new draft/);
});
