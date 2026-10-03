import type { StoryRecord } from '../shared/story';
import type { WorldOccurrence } from '../shared/worlds';
import type { SearchOccurrence } from '../domain/editor-operations';
import { useEffect, useRef, useState } from "react";
import { AllSelection, EditorState, Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { deleteScreenplaySelection, selectScreenplayText } from '../domain/continuous-editor-commands';
import { MessagesSquare } from "lucide-react";
import type { Node as PMNode } from "prosemirror-model";
import type { ScreenplayNote, ScreenplayRecord } from "../shared/models";
import { continuousDocumentSchema as schema, continuousDocumentToScreenplay, screenplayToContinuousDocument } from "../domain/continuous-document";
import { deleteForwardScreenplayElement, enterScreenplayElement, insertScreenplayLineBreak, moveToPreviousScreenplayElement, selectedElement, selectScreenplayElementType, skipExistingParentheticalClose, startParentheticalAfterCharacter, startParentheticalAfterDialogueBreak, tabScreenplayElement } from "../domain/continuous-editor-commands";
import { canToggleDualDialogue, dualDialogueGroupForDialogues, smartTypeSuggestions, speechBlockForDialogue, toggleDualDialogue } from "../domain/screenplay-editing";
import type { ScreenplayElementType } from "../shared/models";

import { installScreenplayClipboard } from './screenplay-clipboard-controller';
import { paginationDecorations } from './pagination-decorations';
import type { ScreenplayPage } from '../domain/pagination';
import { resolveLayout, type ScreenplayLayout } from '../shared/screenplay-layout';
const selectedBlock = selectedElement;

interface NoteSelection {
  sceneId: string;
  from: ScreenplayNote['from'];
  to: ScreenplayNote['to'];
  selectedText: string;
  x: number;
  y: number;
}

interface NoteEditor {
  noteId: string;
  mode: 'edit' | 'respond';
  text: string;
  x: number;
  y: number;
}

function stackMarginNotes(root: HTMLElement | null) {
  const notes = [...(root?.querySelectorAll<HTMLElement>('.screenplay-margin-note') ?? [])];
  notes.forEach((note) => {
    note.style.transform = '';
    const page = note.closest<HTMLElement>('.script-pages');
    const anchor = note.parentElement;
    if (!page || !anchor) return;
    const pageBounds = page.getBoundingClientRect(), anchorBounds = anchor.getBoundingClientRect(), noteBounds = note.getBoundingClientRect();
    // Centre the note on the physical page edge. This measured anchor is independent
    // of action, dialogue, parenthetical and dual-dialogue horizontal formatting.
    if (pageBounds.width && noteBounds.width) note.style.left = `${pageBounds.left - anchorBounds.left - noteBounds.width / 2}px`;
  });
  const ordered = notes
    .map((note) => ({ note, top: note.getBoundingClientRect().top }))
    .sort((left, right) => left.top - right.top);
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const { note } of ordered) {
    const bounds = note.getBoundingClientRect();
    const offset = Math.max(0, previousBottom + 6 - bounds.top);
    note.style.transform = offset ? `translateY(${offset}px)` : '';
    previousBottom = bounds.bottom + offset;
  }
}

function noteSelectionForState(state: EditorState, view: EditorView): NoteSelection | null {
  if (state.selection.empty || state.selection instanceof AllSelection) return null;
  const endpoint = (position: typeof state.selection.$from) => {
    for (let depth = position.depth; depth >= 0; depth -= 1) {
      const node = position.node(depth);
      if (node.type === schema.nodes.screenplay_element)
        return { elementId: node.attrs.elementId as string, offset: position.pos - position.start(depth) };
    }
    return null;
  };
  const from = endpoint(state.selection.$from), to = endpoint(state.selection.$to);
  if (!from || !to) return null;
  const sceneDepth = Math.max(0, state.selection.$from.depth - 1);
  const sceneId = state.selection.$from.node(sceneDepth).attrs.sceneId as string | undefined;
  const selectedText = state.doc.textBetween(state.selection.from, state.selection.to, '\n', '\n');
  if (!sceneId || !selectedText.trim()) return null;
  try {
    const coords = view.coordsAtPos(state.selection.to);
    return { sceneId, from, to, selectedText, x: coords.left, y: coords.bottom + 6 };
  } catch {
    return { sceneId, from, to, selectedText, x: 0, y: 0 };
  }
}

export function ContinuousScreenplayEditor({ screenplay, worldStory, notesVisible = true, searchMatches = [], activeSearchMatch, sceneId, sceneIds, pages = [], layout, physicalPages = false, onChange, onUndo, onRedo, onSceneCommand }: { screenplay: ScreenplayRecord; worldStory?: StoryRecord; notesVisible?: boolean; searchMatches?: SearchOccurrence[]; activeSearchMatch?: SearchOccurrence; pages?: ScreenplayPage[]; physicalPages?: boolean; layout?: ScreenplayLayout; sceneId?: string; sceneIds?: string[]; onChange(next: ScreenplayRecord, transaction?: string): void; onUndo?(): void; onRedo?(): void; onSceneCommand?(sceneId: string, command: 'up'|'down'|'lock'|'delete'|'add'|'metadata'): void }) {
  const worldRef = useRef(worldStory); worldRef.current = worldStory;
  const pagination = useRef({ pages, physicalPages, layout: layout ?? resolveLayout(screenplay.layout) }); pagination.current = { pages, physicalPages, layout: layout ?? resolveLayout(screenplay.layout) };
  const visibleSceneKey = sceneIds?.join('|');
  const host = useRef<HTMLDivElement>(null); const viewRef = useRef<EditorView | null>(null); const latest = useRef(screenplay); latest.current = screenplay;
  const change = useRef(onChange); change.current = onChange;
  const searchRef = useRef(searchMatches); searchRef.current = searchMatches;
  const notesRef = useRef(screenplay.notes ?? []); notesRef.current = screenplay.notes ?? [];
  const notesVisibleRef = useRef(notesVisible); notesVisibleRef.current = notesVisible;
  const previousPresentation = useRef({ physicalPages, sceneId, visibleSceneKey });
  const sceneCommand = useRef(onSceneCommand); sceneCommand.current = onSceneCommand;
  const historyCommands = useRef({ onUndo, onRedo }); historyCommands.current = { onUndo, onRedo };
  useEffect(() => { const view = viewRef.current; if (view && !view.isDestroyed) view.dispatch(view.state.tr.setMeta('world-presentation', true)); }, [worldStory]);
  const [clipboardError, setClipboardError] = useState('');
  const [noteSelection, setNoteSelection] = useState<NoteSelection | null>(null);
  const [noteComposer, setNoteComposer] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null);
  const [overlay, setOverlay] = useState<{ kind: 'suggestions'|'menu'; elementId: string; type: ScreenplayElementType; values: string[]; index: number } | null>(null);
  const [selectedDialogues, setSelectedDialogues] = useState<string[]>([]);
  const selectedDialoguesRef = useRef<string[]>([]); selectedDialoguesRef.current = selectedDialogues;
  const overlayRef = useRef(overlay); overlayRef.current = overlay;
  const toggleDialogueSelection = (id: string, control: HTMLInputElement) => {
    const current = selectedDialoguesRef.current;
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current.slice(-1), id];
    selectedDialoguesRef.current = next;
    control.dataset.selected = String(next.includes(id));
    control.style.opacity = next.includes(id) ? '1' : '';
    control.classList.toggle('selected', next.includes(id));
    control.setAttribute('aria-pressed', String(next.includes(id)));
    setSelectedDialogues(next);
  };
  useEffect(() => { if (!host.current) return; const locked = new Plugin({ filterTransaction(transaction, state) { if (!transaction.docChanged) return true; const protectedScenes = new Map<string, string>(); state.doc.forEach((scene) => { if (scene.attrs.locked) protectedScenes.set(scene.attrs.sceneId, JSON.stringify(scene.toJSON())); }); transaction.doc.forEach((scene) => { if (protectedScenes.has(scene.attrs.sceneId) && protectedScenes.get(scene.attrs.sceneId) !== JSON.stringify(scene.toJSON())) protectedScenes.set(scene.attrs.sceneId, "changed"); }); return [...protectedScenes.values()].every((value) => value !== "changed") && [...protectedScenes.keys()].every((id) => { let found = false; transaction.doc.forEach((scene) => { if (scene.attrs.sceneId === id) found = true; }); return found; }); } });
    let view: EditorView;
    const shortcuts = keymap({
      "Mod-z": (state, dispatch) => { if (historyCommands.current.onUndo) { historyCommands.current.onUndo(); return true; } return undo(state, dispatch); }, "Mod-y": (state, dispatch) => { if (historyCommands.current.onRedo) { historyCommands.current.onRedo(); return true; } return redo(state, dispatch); }, "Mod-Shift-z": (state, dispatch) => { if (historyCommands.current.onRedo) { historyCommands.current.onRedo(); return true; } return redo(state, dispatch); },
      "Mod-a": (state, dispatch) => selectScreenplayText(pagination.current.physicalPages)(state, dispatch),
      "Mod-b": toggleMark(schema.marks.bold), "Mod-i": toggleMark(schema.marks.italic), "Mod-u": toggleMark(schema.marks.underline),
      "Mod-1": selectScreenplayElementType('scene_heading'), "Mod-2": selectScreenplayElementType('action'),
      "Mod-3": selectScreenplayElementType('character'), "Mod-4": selectScreenplayElementType('parenthetical'),
      "Mod-5": selectScreenplayElementType('dialogue'), "Mod-6": selectScreenplayElementType('transition'),
      "Mod-7": selectScreenplayElementType('shot'),
      Enter: enterScreenplayElement,
      "Shift-Enter": insertScreenplayLineBreak,
      Tab: tabScreenplayElement,
      Backspace: moveToPreviousScreenplayElement,
      Delete: deleteForwardScreenplayElement,
    });
    const elementNodeView = (initial: PMNode) => {
      const dom = document.createElement('div');
      const contentDOM = document.createElement('span');
      contentDOM.className = 'continuous-block-content';
      let control: HTMLInputElement | null = null;
      const render = (node: PMNode) => {
        const a = node.attrs;
        dom.className = `continuous-block ${a.type}${a.locked ? ' locked' : ''}`;
        dom.dataset.elementId = a.elementId;
        dom.dataset.sceneId = a.sceneId;
        if (a.dualGroup) {
          dom.dataset.dualGroup = a.dualGroup;
          dom.dataset.dualSide = a.dualSide;
        } else {
          delete dom.dataset.dualGroup;
          delete dom.dataset.dualSide;
        }
        dom.style.textAlign = a.alignment ?? '';
        if (a.type === 'dialogue' && !control) {
          control = document.createElement('input');
          control.type = 'checkbox';
          control.className = 'speech-selector';
          control.contentEditable = 'false';
          control.addEventListener('change', () => {
            if (control?.dataset.dialogueSelect) toggleDialogueSelection(control.dataset.dialogueSelect, control);
          });
          control.textContent = '◇';
          dom.prepend(control);
        } else if (a.type !== 'dialogue' && control) {
          control.remove();
          control = null;
        }
        if (control) {
          control.dataset.dialogueSelect = a.elementId;
          control.setAttribute('aria-label', `Select dialogue ${node.textContent || 'empty dialogue'}`);
          const active = selectedDialoguesRef.current.includes(a.elementId);
          control.dataset.selected = String(active);
          control.style.opacity = active ? '1' : '';
          control.classList.toggle('selected', active);
          control.setAttribute('aria-checked', String(active));
        }
      };
      dom.append(contentDOM);
      render(initial);
      return {
        dom,
        contentDOM,
        update(node: PMNode) {
          if (node.type !== initial.type) return false;
          render(node);
          return true;
        },
        stopEvent(event: Event) {
          return event.type !== 'mousedown' && event.target instanceof Node && !!control?.contains(event.target);
        },
      };
    };
    const positionOverlay = (position: number) => { const coords = view.coordsAtPos(position); host.current?.parentElement?.style.setProperty('--overlay-x', `${coords.left}px`); host.current?.parentElement?.style.setProperty('--overlay-y', `${coords.bottom + 4}px`); };
    view = new EditorView(host.current, { state: EditorState.create({ schema, doc: screenplayToContinuousDocument(screenplay, sceneIds ?? sceneId), plugins: [history(), new Plugin({ props: { decorations(state) {
      const decorations: Decoration[] = [];
      const matches = new Map<string, SearchOccurrence[]>();
      for (const match of searchRef.current) matches.set(match.elementId, [...(matches.get(match.elementId) ?? []), match]);
      if (worldRef.current?.worldUi?.showLinks) {
        const anchors = new Map<string, { position: number; size: number }>();
        state.doc.descendants((node, pos) => { if (node.type === schema.nodes.screenplay_element) anchors.set(node.attrs.elementId, { position: pos + 1, size: node.content.size }); });
        for (const occurrence of worldRef.current.worldOccurrences ?? []) {
          if (occurrence.screenplayId !== latest.current.id || occurrence.scope !== 'text' || occurrence.needsReview || !occurrence.from || !occurrence.to) continue;
          const a = anchors.get(occurrence.from.elementId), b = anchors.get(occurrence.to.elementId);
          if (!a || !b || occurrence.from.offset > a.size || occurrence.to.offset > b.size) continue;
          const from = a.position + occurrence.from.offset, to = b.position + occurrence.to.offset;
          if (to <= from || state.doc.textBetween(from, to, '\n', '\n') !== occurrence.selectedText) continue;
          const story = worldRef.current, world = story.worlds?.find(w => w.id === occurrence.worldId);
          const entity = world?.entities.find(e => e.id === occurrence.entity.id) ?? (occurrence.entity.kind === 'character' ? story.characters : occurrence.entity.kind === 'location' ? story.locations : occurrence.entity.kind === 'event' ? story.events : story.plots).find(e => e.id === occurrence.entity.id);
          decorations.push(Decoration.inline(from, to, { class: 'world-occurrence', 'data-world-occurrence': occurrence.id, title: entity ? entity.name : 'World entry unavailable' }));
        }
      }
      state.doc.descendants((node, pos) => {
        if (node.type !== schema.nodes.screenplay_element) return true;
        for (const match of matches.get(node.attrs.elementId) ?? []) {
          if (match.end <= node.content.size) decorations.push(Decoration.inline(pos + 1 + match.start, pos + 1 + match.end, { class: 'screenplay-search-match' }));
        }
        if (notesVisibleRef.current) {
          for (const note of notesRef.current.filter((item) => item.from.elementId === node.attrs.elementId)) {
            const notePosition = pos + 1 + Math.min(note.from.offset, node.content.size);
            decorations.push(Decoration.widget(notePosition, () => {
              const marker = document.createElement('span');
              marker.className = 'screenplay-margin-note';
              marker.classList.toggle('resolved', !!note.resolved);
              marker.contentEditable = 'false';
              marker.setAttribute('role', 'note');
              marker.setAttribute('aria-label', `Note: ${note.content}`);
              marker.title = `“${note.selectedText}”`;
              marker.addEventListener('selectstart', (event) => event.preventDefault());
              const text = document.createElement('span');
              text.className = 'screenplay-margin-note-text';
              text.textContent = note.content;
              const resolved = document.createElement('input');
              resolved.type = 'checkbox';
              resolved.className = 'screenplay-margin-note-resolved';
              resolved.checked = !!note.resolved;
              resolved.setAttribute('aria-label', `Mark note as dealt with: ${note.content}`);
              resolved.title = 'Mark note as dealt with';
              resolved.addEventListener('mousedown', (event) => event.stopPropagation());
              resolved.addEventListener('change', (event) => {
                event.stopPropagation();
                const record = latest.current;
                const now = new Date().toISOString();
                change.current({ ...record, notes: (record.notes ?? []).map((item) => item.id === note.id ? { ...item, resolved: resolved.checked, updatedAt: now } : item) }, 'resolve-note');
              });
              const responses = document.createElement('span');
              responses.className = 'screenplay-margin-note-responses';
              for (const response of note.responses ?? []) {
                const reply = document.createElement('span');
                reply.className = 'screenplay-margin-note-response';
                reply.textContent = response.content;
                responses.append(reply);
              }
              const controls = document.createElement('span');
              controls.className = 'screenplay-margin-note-controls';
              const actionButton = (label: 'E' | 'R', mode: NoteEditor['mode']) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.setAttribute('aria-label', `${mode === 'edit' ? 'Edit' : 'Respond to'} note: ${note.content}`);
                button.title = mode === 'edit' ? 'Edit note' : 'Respond to note';
                button.addEventListener('mousedown', (event) => { event.preventDefault(); event.stopPropagation(); });
                button.addEventListener('click', (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const bounds = marker.getBoundingClientRect();
                  setNoteEditor({ noteId: note.id, mode, text: mode === 'edit' ? note.content : '', x: bounds.right + 6, y: bounds.top });
                });
                return button;
              };
              controls.append(actionButton('E', 'edit'), actionButton('R', 'respond'));
              const remove = document.createElement('button');
              remove.type = 'button';
              remove.className = 'screenplay-margin-note-remove';
              remove.setAttribute('aria-label', `Remove note: ${note.content}`);
              remove.title = 'Remove note';
              remove.textContent = '×';
              remove.addEventListener('mousedown', (event) => { event.preventDefault(); event.stopPropagation(); });
              remove.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const record = latest.current;
                change.current({ ...record, notes: (record.notes ?? []).filter((item) => item.id !== note.id) }, 'remove-note');
                setNoteEditor((current) => current?.noteId === note.id ? null : current);
              });
              marker.append(resolved, text, responses, controls, remove);
              return marker;
            }, { key: `note-${note.id}-${note.updatedAt}-${note.resolved ? 'resolved' : 'open'}-${note.responses?.length ?? 0}-${note.content}`, side: -1, ignoreSelection: true }));
          }
        }
        return false;
      });
      return DecorationSet.create(state.doc, decorations);
    } } }), locked, shortcuts, keymap(baseKeymap), new Plugin({ props: { decorations(state) { return paginationDecorations(state.doc, pagination.current.pages, pagination.current.layout, pagination.current.physicalPages); } } })] }), nodeViews: { screenplay_element: elementNodeView }, dispatchTransaction(transaction) { const previousDoc = view.state.doc; const nextState = view.state.apply(transaction); const documentChanged = !nextState.doc.eq(previousDoc); if (documentChanged) {
      const anchorPosition = (doc: PMNode, anchor: { elementId: string; offset: number } | undefined) => { if (!anchor) return undefined; let result: number | undefined; doc.descendants((node, pos) => { if (node.type === schema.nodes.screenplay_element && node.attrs.elementId === anchor.elementId && anchor.offset <= node.content.size) result = pos + 1 + anchor.offset; }); return result; };
      const anchorAt = (doc: PMNode, pos: number) => { const resolved = doc.resolve(Math.max(0, Math.min(pos, doc.content.size))); for (let depth = resolved.depth; depth > 0; depth--) { const node = resolved.node(depth); if (node.type === schema.nodes.screenplay_element) return { elementId: node.attrs.elementId as string, offset: pos - resolved.start(depth) }; } return undefined; };
      const updates: WorldOccurrence[] = [];
      for (const occurrence of worldRef.current?.worldOccurrences ?? []) {
        if (occurrence.screenplayId !== latest.current.id || occurrence.scope !== 'text') continue;
        const from = anchorPosition(view.state.doc, occurrence.from), to = anchorPosition(view.state.doc, occurrence.to);
        if (from === undefined || to === undefined) continue;
        const a = transaction.mapping.mapResult(from, 1), b = transaction.mapping.mapResult(to, -1);
        const newFrom = a.deleted ? undefined : anchorAt(transaction.doc, a.pos), newTo = b.deleted ? undefined : anchorAt(transaction.doc, b.pos);
        if ((a.deleted || b.deleted) && !occurrence.needsReview) { updates.push({ ...occurrence, needsReview: true }); continue; }
        if (newFrom && newTo && (newFrom.elementId !== occurrence.from?.elementId || newFrom.offset !== occurrence.from?.offset || newTo.elementId !== occurrence.to?.elementId || newTo.offset !== occurrence.to?.offset)) updates.push({ ...occurrence, from: newFrom, to: newTo });
      }
      if (updates.length) window.dispatchEvent(new CustomEvent('world-occurrences-remapped', { detail: updates }));
    } const selectionChanged = !nextState.selection.eq(view.state.selection); view.updateState(nextState); if (notesVisibleRef.current) requestAnimationFrame(() => stackMarginNotes(host.current)); if (selectionChanged && !transaction.getMeta("search-selection")) queueMicrotask(() => { if (!view.isDestroyed) view.focus(); }); if (selectionChanged && !transaction.getMeta("search-selection")) setNoteSelection(notesVisibleRef.current ? noteSelectionForState(nextState, view) : null); if (documentChanged) onChange(continuousDocumentToScreenplay(latest.current, nextState.doc, sceneIds ?? (sceneId ? [sceneId] : latest.current.scenes.map(scene => scene.id))), transaction.getMeta("clipboard-operation") ? undefined : "continuous-document"); const activeSceneNode = nextState.selection.$head.depth >= 1 ? nextState.selection.$head.node(1) : null; if (activeSceneNode?.attrs.sceneId) window.dispatchEvent(new CustomEvent("screenplay-scene-focus", { detail: activeSceneNode.attrs.sceneId })); const block = selectedBlock(nextState); if (!nextState.selection.empty || !block) setOverlay(null); if (block && nextState.selection.empty) { const type = block.attrs.type as ScreenplayElementType; const entered = block.textContent.trim().toUpperCase(); const values = smartTypeSuggestions(latest.current, type, block.textContent, block.attrs.elementId).filter((value) => value !== entered); positionOverlay(nextState.selection.from); setOverlay(values.length ? { kind: 'suggestions', elementId: block.attrs.elementId, type, values, index: 0 } : null); window.dispatchEvent(new CustomEvent("screenplay-element-focus", { detail: { id: block.attrs.elementId, type } })); } } }); viewRef.current = view;
    const structuralKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 'a' || key === 'z' || key === 'y') {
          event.preventDefault(); event.stopImmediatePropagation(); setOverlay(null);
          if (key === 'a') selectScreenplayText(pagination.current.physicalPages)(view.state, view.dispatch);
          else if (key === 'y' || event.shiftKey) {
            if (historyCommands.current.onRedo) historyCommands.current.onRedo(); else redo(view.state, view.dispatch);
          } else {
            if (historyCommands.current.onUndo) historyCommands.current.onUndo(); else undo(view.state, view.dispatch);
          }
          return;
        }
      }
      if ((event.key === 'Backspace' || event.key === 'Delete') && !view.state.selection.empty) {
        event.preventDefault(); event.stopImmediatePropagation(); setOverlay(null);
        deleteScreenplaySelection(view.state, view.dispatch);
        return;
      }
      const block = selectedBlock(view.state);
      const open = overlayRef.current;

      if (event.key === "(" && (startParentheticalAfterCharacter(view.state, view.dispatch) || startParentheticalAfterDialogueBreak(view.state, view.dispatch))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOverlay(null);
        return;
      }
      if (event.key === ")" && skipExistingParentheticalClose(view.state, view.dispatch)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key === "Enter" && event.shiftKey && block) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOverlay(null);
        insertScreenplayLineBreak(view.state, view.dispatch);
        return;
      }
      if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const length = open.kind === "suggestions" ? open.values.length : 7;
        setOverlay({ ...open, index: (open.index + (event.key === "ArrowDown" ? 1 : -1) + length) % length });
        return;
      }
      if (open?.kind === "suggestions" && event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        replaceActive(open.values[open.index]);
        return;
      }
      if (open?.kind === "menu" && event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        chooseType((['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot'] as ScreenplayElementType[])[open.index]);
        return;
      }
      if (open?.kind === "menu" && /^[1-7]$/.test(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        chooseType((['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot'] as ScreenplayElementType[])[Number(event.key) - 1]);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOverlay(null);
        return;
      }
      if (event.key === "Enter" && block) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!block.textContent.trim()) {
          positionOverlay(view.state.selection.from);
          setOverlay({ kind: "menu", elementId: block.attrs.elementId, type: block.attrs.type, values: [], index: 0 });
        } else {
          setOverlay(null);
          enterScreenplayElement(view.state, view.dispatch);
        }
        return;
      }
      if (event.key !== "Tab") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOverlay(null);
      if (!block) {
        const anchor = window.getSelection()?.anchorNode;
        const element = (anchor?.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor?.parentElement)?.closest<HTMLElement>(".continuous-block");
        if (element) {
          const pos = view.posAtDOM(element, 0);
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)));
        }
      }
      tabScreenplayElement(view.state, view.dispatch);
    };
    const format = (event: Event) => { const { command, value } = (event as CustomEvent<{command:string;value?:string}>).detail; const { from, to, empty } = view.state.selection; if (empty) return; view.focus(); const mark = command === "backgroundColor" ? schema.marks.background : schema.marks[command]; if (mark) { const active = view.state.doc.rangeHasMark(from, to, mark); let tr = view.state.tr; if ((command === "color" || command === "backgroundColor") && value) tr = tr.removeMark(from, to, mark).addMark(from, to, mark.create({ value })); else tr = active ? tr.removeMark(from,to,mark) : tr.addMark(from,to,mark.create()); view.dispatch(tr); return; } if (command === "clear") { let tr = view.state.tr; Object.values(schema.marks).forEach((type) => { tr = tr.removeMark(from, to, type); }); view.dispatch(tr); return; } if (command === "upper" || command === "lower") { const text = view.state.doc.textBetween(from, to); view.dispatch(view.state.tr.insertText(command === "upper" ? text.toUpperCase() : text.toLowerCase(), from, to)); return; } if (["left", "center", "right", "justify"].includes(command)) { let tr = view.state.tr; view.state.doc.nodesBetween(from, to, (node, pos) => { if (node.type === schema.nodes.screenplay_element) tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, alignment: command }); }); view.dispatch(tr); } };
    const chooseElementType = (event: Event) => {
      const { id, type } = (event as CustomEvent<{ id: string; type: ScreenplayElementType }>).detail;
      let state = view.state;
      const selected = selectedBlock(state);
      if (selected?.attrs.elementId !== id) {
        let position: number | null = null;
        state.doc.descendants((node, pos) => {
          if (node.type === schema.nodes.screenplay_element && node.attrs.elementId === id) {
            position = pos + 1 + node.content.size;
            return false;
          }
          return position === null;
        });
        if (position === null) return;
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, position)));
        state = view.state;
      }
      setOverlay(null);
      selectScreenplayElementType(type)(state, view.dispatch);
      view.focus();
    };
    const pointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!host.current?.parentElement?.contains(target)) setOverlay(null);
      if (!target.closest('.note-selection-action,.note-composer') && !view.dom.contains(target)) {
        setNoteSelection(null);
        setNoteComposer(false);
        setNoteEditor(null);
      }
    };
    const sceneControlClick = (event: MouseEvent) => { const target = event.target as HTMLElement; const command = target.closest<HTMLButtonElement>('[data-scene-command]'); const scene = target.closest<HTMLElement>('[data-scene-id]'); if (!scene?.dataset.sceneId || !command?.dataset.sceneCommand) return; event.preventDefault(); event.stopPropagation(); sceneCommand.current?.(scene.dataset.sceneId, command.dataset.sceneCommand as 'up'|'down'|'lock'|'delete'|'add'|'metadata'); };
    const syncBeforeStructuralKey = (event: KeyboardEvent) => {
      if (!['Enter', 'Tab', 'Backspace', 'Delete'].includes(event.key) && !(event.ctrlKey || event.metaKey)) return;
      const selection = window.getSelection();
      if (!selection?.anchorNode || !selection.focusNode || !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return;
      if (view.state.selection instanceof AllSelection && !selection.isCollapsed) return;
      const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
      const head = view.posAtDOM(selection.focusNode, selection.focusOffset);
      if (anchor >= 0 && head >= 0 && (anchor !== view.state.selection.anchor || head !== view.state.selection.head)) {
        view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head))));
      }
    };
    const removeClipboard = installScreenplayClipboard(view, () => pagination.current.layout, setClipboardError);
    const worldContext = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]'); if (!target) return;
      event.preventDefault();
      if (view.state.selection.empty) {
        const clicked = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (clicked) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, clicked.pos)));
      }
      const selection = noteSelectionForState(view.state, view);
      const element = latest.current.scenes.flatMap(s => s.elements).find(e => e.id === (selection?.from.elementId ?? target.dataset.elementId));
      const cursor = {elementId: element?.id ?? target.dataset.elementId!, offset:view.state.selection.$from.parentOffset};
      const detail = { screenplayId: latest.current.id, sceneId: selection?.sceneId ?? target.dataset.sceneId, elementId: element?.id, type: element?.type ?? 'action', ...(selection ? { from: selection.from, to: selection.to, selectedText: selection.selectedText } : {from:cursor,to:cursor}), x: event.clientX, y: event.clientY };
      window.dispatchEvent(new CustomEvent('world-link-context', { detail }));
    };
    const worldInsert = (event: Event) => {
      const { text, type } = (event as CustomEvent<{ text: string; type: ScreenplayElementType }>).detail;
      const block = selectedBlock(view.state);
      if (!block || !text || block.attrs.locked || view.state.selection.$from.node(1).attrs.locked) { window.dispatchEvent(new CustomEvent('world-insert-result', { detail: 'Select an unlocked screenplay element first.' })); return; }
      if (type === 'dialogue' && block.attrs.type !== 'dialogue') { window.dispatchEvent(new CustomEvent('world-insert-result', { detail: 'Place the screenplay cursor in Dialogue. No speaker has been guessed.' })); return; }
      let transaction = view.state.tr;
      if (block.attrs.type === type) transaction = transaction.insertText(text, view.state.selection.from, view.state.selection.from);
      else { const pos = view.state.selection.$from.after(view.state.selection.$from.depth); const node = schema.nodes.screenplay_element.create({ elementId: crypto.randomUUID(), sceneId: block.attrs.sceneId, type }, text.split(/(\n)/).filter(Boolean).map(part => part === '\n' ? schema.nodes.hard_break.create() : schema.text(part))); transaction = transaction.insert(pos, node).setSelection(TextSelection.create(transaction.doc, pos + 1 + node.content.size)); }
      view.dispatch(transaction); window.dispatchEvent(new CustomEvent('world-insert-result', { detail: 'Wording added to the screenplay.' }));
    };
    const worldNavigate = (event: Event) => { const occurrence = (event as CustomEvent<WorldOccurrence>).detail; if (occurrence.screenplayId !== latest.current.id || !occurrence.from) return; let position: number | undefined; view.state.doc.descendants((node, pos) => { if (node.type === schema.nodes.screenplay_element && node.attrs.elementId === occurrence.from?.elementId) position = pos + 1 + Math.min(occurrence.from!.offset, node.content.size); }); if (position !== undefined) { view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)).scrollIntoView()); view.focus(); } };
    view.dom.addEventListener('contextmenu', worldContext);
    window.addEventListener('world-insert-text', worldInsert);
    window.addEventListener('world-navigate-occurrence', worldNavigate);
    window.addEventListener("screenplay-format", format); window.addEventListener("screenplay-element-type", chooseElementType); document.addEventListener('pointerdown', pointer, true); document.addEventListener('click', sceneControlClick, true); document.addEventListener("keydown", syncBeforeStructuralKey, true); view.dom.addEventListener("keydown", structuralKey, true); return () => { view.dom.removeEventListener('contextmenu', worldContext); window.removeEventListener('world-insert-text', worldInsert); window.removeEventListener('world-navigate-occurrence', worldNavigate); window.removeEventListener("screenplay-format", format); window.removeEventListener("screenplay-element-type", chooseElementType); document.removeEventListener('pointerdown', pointer, true); document.removeEventListener('click', sceneControlClick, true); document.removeEventListener("keydown", syncBeforeStructuralKey, true); removeClipboard(); view.dom.removeEventListener("keydown", structuralKey, true); viewRef.current = null; view.destroy(); };
  }, [screenplay.id, sceneId, visibleSceneKey]);
  useEffect(() => {
    const previous = previousPresentation.current;
    previousPresentation.current = { physicalPages, sceneId, visibleSceneKey };
    if (previous.physicalPages !== physicalPages || previous.sceneId !== sceneId || previous.visibleSceneKey !== visibleSceneKey) {
      // The view switch button owns focus after a click; return keyboard input to the editor.
      viewRef.current?.focus();
    }
  }, [physicalPages, sceneId, visibleSceneKey]);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let frame = 0;
    const stackAfterLayout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (notesVisibleRef.current) stackMarginNotes(root);
      });
    };
    const mutations = new MutationObserver(stackAfterLayout);
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(stackAfterLayout);
    sizes?.observe(root);
    window.addEventListener('resize', stackAfterLayout);
    stackAfterLayout();
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      sizes?.disconnect();
      window.removeEventListener('resize', stackAfterLayout);
    };
  }, [screenplay.id, sceneId, visibleSceneKey]);
  useEffect(() => { const hostNode = host.current; if (!hostNode) return; hostNode.querySelectorAll<HTMLInputElement>('[data-dialogue-select]').forEach((button) => { const active = selectedDialogues.includes(button.dataset.dialogueSelect ?? ''); button.dataset.selected = String(active); button.style.opacity = active ? '1' : ''; button.classList.toggle('selected', active); button.setAttribute('aria-checked', String(active)); }); }, [selectedDialogues, screenplay]);
  useEffect(() => { if (overlay?.kind !== 'menu') return; const menu = host.current?.parentElement?.querySelector<HTMLElement>('.element-menu'); menu?.querySelectorAll<HTMLButtonElement>('button').forEach((button, index) => { button.classList.toggle('active', index === overlay.index); button.setAttribute('aria-current', index === overlay.index ? 'true' : 'false'); }); }, [overlay]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const document = screenplayToContinuousDocument(screenplay, sceneIds ?? sceneId);
    if (document.eq(view.state.doc)) return;
    const selection = view.state.selection;
    const endpoint = (position: typeof selection.$anchor) => ({
      id: position.parent.attrs.elementId as string | undefined,
      offset: position.parent.attrs.type === 'scene_heading' ? position.parent.textBetween(0, position.parentOffset, '', '\n').toUpperCase().length : position.parentOffset,
    });
    const anchor = endpoint(selection.$anchor), head = endpoint(selection.$head);
    const resolve = (point: ReturnType<typeof endpoint>) => {
      let result: number | undefined;
      document.descendants((node, position) => {
        if (point.id && node.attrs.elementId === point.id) result = position + 1 + Math.min(point.offset, node.content.size);
      });
      return result;
    };
    let next = EditorState.create({ schema, doc: document, plugins: view.state.plugins });
    if (selection instanceof AllSelection) next = next.apply(next.tr.setSelection(new AllSelection(document)));
    else {
      const from = resolve(anchor), to = resolve(head);
      if (from !== undefined && to !== undefined) next = next.apply(next.tr.setSelection(TextSelection.create(document, from, to)));
      else if (from !== undefined || to !== undefined) next = next.apply(next.tr.setSelection(TextSelection.near(document.resolve(from ?? to!))));
    }
    view.updateState(next);
  }, [screenplay, sceneId, visibleSceneKey]);
  useEffect(() => { const view = viewRef.current; if (view) view.updateState(view.state); }, [pages, layout, physicalPages]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.updateState(view.state);
    if (!activeSearchMatch) return;
    let position: number | undefined;
    view.state.doc.descendants((node, pos) => {
      if (node.attrs.elementId === activeSearchMatch.elementId) position = pos + 1;
    });
    if (position === undefined) return;
    const from = position + activeSearchMatch.start, to = position + activeSearchMatch.end;
    if (to > view.state.doc.content.size) return;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)).setMeta('search-selection', true));
    const frame = requestAnimationFrame(() => {
      if (view.isDestroyed) return;
      const scroller = view.dom.closest<HTMLElement>('.screenplay-scroll');
      if (!scroller) return;
      const bounds = scroller.getBoundingClientRect();
      const find = scroller.querySelector<HTMLElement>('.find-panel')?.getBoundingClientRect();
      const top = Math.max(bounds.top, find?.bottom ?? bounds.top) + 20;
      const bottom = bounds.bottom - 20;
      const coords = view.coordsAtPos(from);
      if (coords.top < top || coords.bottom > bottom) scroller.scrollTop += coords.top - (top + Math.max(0, bottom - top) / 3);
    });
    return () => cancelAnimationFrame(frame);
  }, [searchMatches, activeSearchMatch, sceneId, visibleSceneKey]);
  useEffect(() => {
    const view = viewRef.current;
    if (view) view.updateState(view.state);
    const frame = requestAnimationFrame(() => stackMarginNotes(host.current));
    if (!notesVisible) {
      setNoteSelection(null);
      setNoteComposer(false);
      setNoteEditor(null);
    }
    return () => cancelAnimationFrame(frame);
  }, [screenplay.notes, notesVisible]);
  const replaceActive = (value: string) => { const view = viewRef.current; const block = view && selectedBlock(view.state); if (!view || !block) return; const pos = view.state.selection.$from.before(); view.dispatch(view.state.tr.replaceWith(pos + 1, pos + block.nodeSize - 1, value ? schema.text(value) : [])); setOverlay(null); view.focus(); };
  const chooseType = (type: ScreenplayElementType) => { const view = viewRef.current; if (!view || !selectedBlock(view.state)) return; setOverlay(null); selectScreenplayElementType(type)(view.state, view.dispatch); view.focus(); };
  const selectedExistingDual = selectedDialogues.length === 1 ? screenplay.scenes.flatMap((scene) => { const selected = scene.elements.find((element) => element.id === selectedDialogues[0] && element.type === 'dialogue'); const groupId = selected?.dualDialogue?.groupId; if (!groupId) return []; return [{ scene, groupId, dialogueIds: scene.elements.filter((element) => element.type === 'dialogue' && element.dualDialogue?.groupId === groupId && speechBlockForDialogue(scene, element.id)?.elements.find(member => member.type === 'dialogue')?.id === element.id).map((element) => element.id) }]; })[0] : undefined;
  const effectiveDialogueIds = selectedExistingDual?.dialogueIds ?? selectedDialogues;
  const selectedScene = selectedExistingDual?.scene ?? (effectiveDialogueIds.length === 2 ? screenplay.scenes.find((scene) => canToggleDualDialogue(scene, effectiveDialogueIds)) : undefined);
  const selectedDualGroup = selectedExistingDual?.groupId ?? (selectedScene ? dualDialogueGroupForDialogues(selectedScene, effectiveDialogueIds) : null);
  const toggleSelectedDual = () => { const record = latest.current; const currentIds = selectedDialoguesRef.current; const existing = currentIds.length === 1 ? record.scenes.flatMap((scene) => { const selected = scene.elements.find((element) => element.id === currentIds[0] && element.type === 'dialogue'); const groupId = selected?.dualDialogue?.groupId; if (!groupId) return []; return [{ scene, ids: scene.elements.filter((element) => element.type === 'dialogue' && element.dualDialogue?.groupId === groupId && speechBlockForDialogue(scene, element.id)?.elements.find(member => member.type === 'dialogue')?.id === element.id).map((element) => element.id) }]; })[0] : undefined; const ids = existing?.ids ?? currentIds; const scene = existing?.scene ?? record.scenes.find((item) => canToggleDualDialogue(item, ids)); if (!scene) return; onChange({ ...record, scenes: record.scenes.map((item) => item.id === scene.id ? toggleDualDialogue(item, ids) : item) }, selectedDualGroup ? 'remove-dual-dialogue' : 'make-dual-dialogue'); selectedDialoguesRef.current = []; setSelectedDialogues([]); };
  const saveNote = () => {
    if (!noteSelection || !noteText.trim()) return;
    const now = new Date().toISOString();
    const note: ScreenplayNote = {
      id: crypto.randomUUID(),
      sceneId: noteSelection.sceneId,
      from: noteSelection.from,
      to: noteSelection.to,
      selectedText: noteSelection.selectedText,
      content: noteText.trim(),
      createdAt: now,
      updatedAt: now,
    };
    onChange({ ...latest.current, notes: [...(latest.current.notes ?? []), note] }, 'add-note');
    setNoteText('');
    setNoteComposer(false);
    setNoteSelection(null);
  };
  const saveNoteEditor = () => {
    if (!noteEditor || !noteEditor.text.trim()) return;
    const now = new Date().toISOString();
    const record = latest.current;
    const notes = (record.notes ?? []).map((note) => {
      if (note.id !== noteEditor.noteId) return note;
      if (noteEditor.mode === 'edit') return { ...note, content: noteEditor.text.trim(), updatedAt: now };
      return {
        ...note,
        responses: [...(note.responses ?? []), { id: crypto.randomUUID(), content: noteEditor.text.trim(), createdAt: now, updatedAt: now }],
        updatedAt: now,
      };
    });
    change.current({ ...record, notes }, noteEditor.mode === 'edit' ? 'edit-note' : 'respond-note');
    setNoteEditor(null);
  };
  return <div className="continuous-editor-shell">
    {physicalPages && <div className="continuous-paper-stack" aria-hidden="true">{pages.map(page => <div className="continuous-paper-sheet" key={page.number}><span className="continuous-paper-number">{page.number}.</span></div>)}</div>}
    <div ref={host} className="continuous-document-editor" />
    {notesVisible && noteSelection && !noteComposer && <button
      type="button"
      className="note-selection-action"
      style={{ left: noteSelection.x, top: noteSelection.y }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setNoteComposer(true)}
    >Add Note</button>}
    {notesVisible && noteSelection && noteComposer && <div className="note-composer" style={{ left: noteSelection.x, top: noteSelection.y }}>
      <label>Add note<textarea autoFocus value={noteText} onChange={(event) => setNoteText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setNoteComposer(false); setNoteText(''); } if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) saveNote(); }} /></label>
      <div><button type="button" onClick={() => { setNoteComposer(false); setNoteText(''); }}>Cancel</button><button type="button" disabled={!noteText.trim()} onClick={saveNote}>Save Note</button></div>
    </div>}
    {notesVisible && noteEditor && <div className="note-composer note-editor" style={{ left: noteEditor.x, top: noteEditor.y }}>
      <label>{noteEditor.mode === 'edit' ? 'Edit note' : 'Respond to note'}<textarea autoFocus value={noteEditor.text} onChange={(event) => setNoteEditor({ ...noteEditor, text: event.target.value })} onKeyDown={(event) => { if (event.key === 'Escape') setNoteEditor(null); if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) saveNoteEditor(); }} /></label>
      <div><button type="button" onClick={() => setNoteEditor(null)}>Cancel</button><button type="button" disabled={!noteEditor.text.trim()} onClick={saveNoteEditor}>{noteEditor.mode === 'edit' ? 'Save' : 'Respond'}</button></div>
    </div>}
    {clipboardError && <div role="alert" className="clipboard-error">{clipboardError}<button onClick={() => setClipboardError('')}>Dismiss</button></div>}
    {selectedScene && <button className={`continuous-dual-command${selectedDualGroup ? ' active' : ''}`} aria-label={selectedDualGroup ? 'Return selected dialogue to single dialogue' : 'Make selected dialogue dual'} aria-pressed={!!selectedDualGroup} title={selectedDualGroup ? 'Return to single dialogue' : 'Make dual dialogue'} onClick={toggleSelectedDual}><MessagesSquare aria-hidden="true"/><span>Dual Dialogue</span></button>}
    {overlay?.kind === 'suggestions' && <div className="element-suggestions beta-editor-overlay" role="listbox">{overlay.values.map((value,index) => <button key={value} className={index === overlay.index ? 'active' : ''} role="option" aria-selected={index === overlay.index} onMouseDown={(event) => { event.preventDefault(); replaceActive(value); }}>{value}</button>)}</div>}
    {overlay?.kind === 'menu' && <div className="element-menu beta-editor-overlay" role="menu" aria-label="Screenplay element menu">{(['scene_heading','action','character','parenthetical','dialogue','transition','shot'] as ScreenplayElementType[]).map((type,index) => <button key={type} role="menuitem" onMouseDown={(event) => { event.preventDefault(); chooseType(type); }}>{index+1} {type.replace('_',' ')}</button>)}</div>}
  </div>;
}
