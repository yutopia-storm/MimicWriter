import { AllSelection, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { cutScreenplaySelection } from './clipboard-commands';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import type { ScreenplayElementType } from '../shared/models';
import { continuousDocumentSchema as schema } from './continuous-document';
import { nextElementType } from './screenplay';
import { tabType } from './continuous-editor';

export function selectedElement(state: EditorState) {
  return state.selection.$from.parent.type === schema.nodes.screenplay_element ? state.selection.$from.parent : null;
}

export function selectScreenplayText(wholeDocument: boolean): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    if (wholeDocument || $from.depth < 1) {
      dispatch?.(state.tr.setSelection(new AllSelection(state.doc)));
    } else {
      const start = $from.start(1), end = $from.end(1);
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, start + 1, end - 1)));
    }
    return true;
  };
}

export const deleteScreenplaySelection: Command = (state, dispatch) => {
  if (state.selection.empty) return false;
  dispatch?.(cutScreenplaySelection(state).setMeta('clipboard-operation', 'delete'));
  return true;
};

function attributes(element: PMNode, type: ScreenplayElementType) {
  const speech = ['dialogue', 'parenthetical'].includes(type) && element.attrs.dualGroup;
  return { ...element.attrs, elementId: crypto.randomUUID(), type, dualGroup: speech ? element.attrs.dualGroup : null, dualSide: speech ? element.attrs.dualSide : null, dualRole: speech ? type : null };
}

function elementNode(element: PMNode, type: ScreenplayElementType) {
  return schema.nodes.screenplay_element.create(attributes(element, type), type === 'parenthetical' ? schema.text('()') : type === 'transition' ? schema.text(':') : undefined);
}

function prepareTransition(tr: Transaction, position: number) {
  const element = tr.doc.nodeAt(position)!;
  const text = element.textBetween(0, element.content.size, '\n', '\n');
  const end = text.trimEnd().length;
  const colon = text[end - 1] === ':' ? end - 1 : end;
  if (text[end - 1] !== ':') tr = tr.insertText(':', position + 1 + end);
  return tr.setSelection(TextSelection.create(tr.doc, position + 1 + colon));
}

function cycleScreenplayLine(
  state: EditorState,
  element: PMNode,
  position: number,
  offset: number,
  type: ScreenplayElementType,
  dispatch?: (transaction: Transaction) => void,
) {
  const breaks: number[] = [];
  element.forEach((child, childOffset) => {
    if (child.type === schema.nodes.hard_break) breaks.push(childOffset);
  });
  const starts = [0, ...breaks.map((value) => value + 1)];
  if (!starts.includes(offset)) return false;
  const lineEnd = breaks.find((value) => value >= offset) ?? element.content.size;
  const beforeEnd = offset > 0 ? offset - 1 : 0;
  const afterStart = lineEnd < element.content.size ? lineEnd + 1 : element.content.size;
  const beforeContent = element.content.cut(0, beforeEnd);
  let currentContent = element.content.cut(offset, lineEnd);
  const afterContent = element.content.cut(afterStart, element.content.size);
  const lineText = element.textBetween(offset, lineEnd, '\n', '\n');

  if (type === 'transition' && !lineText.trimEnd().endsWith(':'))
    currentContent = currentContent.append(Fragment.from(schema.text(':')));
  if (element.attrs.type === 'transition' && type === 'action') {
    const end = lineText.trimEnd().length;
    if (end > 0 && lineText[end - 1] === ':')
      currentContent = currentContent.cut(0, end - 1).append(currentContent.cut(end));
  }

  const nodes: PMNode[] = [];
  if (offset > 0)
    nodes.push(element.type.create(element.attrs, beforeContent));
  const currentId = offset > 0 ? crypto.randomUUID() : element.attrs.elementId;
  const current = element.type.create({
    ...element.attrs,
    elementId: currentId,
    type,
    dualGroup: null,
    dualSide: null,
    dualRole: null,
  }, currentContent);
  const currentPosition = position + nodes.reduce((total, node) => total + node.nodeSize, 0);
  nodes.push(current);
  if (afterStart < element.content.size)
    nodes.push(element.type.create({ ...element.attrs, elementId: crypto.randomUUID() }, afterContent));

  const tr = state.tr.replaceWith(
    position,
    position + element.nodeSize,
    Fragment.fromArray(nodes),
  );
  tr.setSelection(TextSelection.create(tr.doc, currentPosition + 1));
  dispatch?.(tr.scrollIntoView());
  return true;
}

function caretOffset(type: ScreenplayElementType) { return type === 'parenthetical' ? 2 : 1; }

function dispatchAndFocus(transaction: Transaction, position: number, dispatch?: (transaction: Transaction) => void) {
  dispatch?.(transaction.setSelection(TextSelection.near(transaction.doc.resolve(position))));
}

export function selectScreenplayElementType(type: ScreenplayElementType): Command {
  return (state, dispatch) => {
    const element = selectedElement(state);
    if (!element || element.attrs.locked) return false;
    const position = state.selection.$from.before();
    if (!state.selection.empty) {
      let tr = state.tr.setNodeMarkup(position, undefined, { ...element.attrs, type });
      if (type === 'transition') tr = prepareTransition(tr, position);
      dispatch?.(tr.scrollIntoView());
      return true;
    }
    if (element.textContent.trim()) {
      const tr = state.tr.insert(position + element.nodeSize, elementNode(element, type));
      dispatchAndFocus(tr, position + element.nodeSize + caretOffset(type), dispatch);
      return true;
    }
    let tr = state.tr.setNodeMarkup(position, undefined, { ...element.attrs, type });
    if (type === 'parenthetical') tr = tr.insertText('()', position + 1);
    if (type === 'transition') {
      dispatch?.(prepareTransition(tr, position).scrollIntoView());
      return true;
    }
    dispatchAndFocus(tr, position + caretOffset(type), dispatch);
    return true;
  };
}

export const enterScreenplayElement: Command = (state, dispatch) => {
  const element = selectedElement(state);
  if (!element || element.attrs.locked || !element.textContent.trim()) return false;
  const type = nextElementType(element.attrs.type);
  const elementPosition = state.selection.$from.before();
  if (element.attrs.type === 'parenthetical') {
    const tr = state.tr.insert(elementPosition + element.nodeSize, elementNode(element, 'dialogue'));
    dispatchAndFocus(tr, elementPosition + element.nodeSize + 1, dispatch);
    return true;
  }
  let tr = state.tr;
  if (!state.selection.empty) tr = tr.deleteSelection();
  if (element.attrs.type === 'transition' && state.selection.empty && element.textContent.slice(state.selection.$from.parentOffset) === ':') {
    tr = tr.setSelection(TextSelection.create(tr.doc, tr.selection.from + 1));
  }
  const position = tr.selection.from;
  tr = tr.split(position, 1, [{ type: schema.nodes.screenplay_element, attrs: attributes(element, type) }]);
  dispatchAndFocus(tr, position + 1, dispatch);
  return true;
};

export const tabScreenplayElement: Command = (state, dispatch) => {
  const element = selectedElement(state);
  if (!element || element.attrs.locked) return false;
  const { $from, empty } = state.selection;
  const position = $from.before();
  if (element.attrs.type === 'scene_heading' && empty) {
    // Heading parts remain plain text; Tab only moves the caret between them.
    const text = element.textBetween(0, element.content.size, '\n', '\n');
    const prefix = /^\s*(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT\.|EXT\.|I\/E\.)\s+/i.exec(text);
    const separator = /\s+[-–—]\s+(?=[^\n]*$)/g;
    const separators = [...text.matchAll(separator)];
    const time = separators.at(-1);
    const stops = [prefix?.[0].length, time ? time.index! + time[0].length : undefined];
    const offset = stops.find((stop) => stop !== undefined && stop > $from.parentOffset);
    if (offset !== undefined) {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, position + 1 + offset)).scrollIntoView());
      return true;
    }
    const scene = $from.node($from.depth - 1);
    const next = scene.maybeChild($from.index($from.depth - 1) + 1);
    const after = position + element.nodeSize;
    const tr = next?.attrs.type === 'action' ? state.tr : state.tr.insert(after, elementNode(element, 'action'));
    dispatchAndFocus(tr.scrollIntoView(), after + 1, dispatch);
    return true;
  }
  if (empty && ['action', 'character', 'transition'].includes(element.attrs.type)) {
    const lineStarts = [0] as number[];
    element.forEach((child, offset) => {
      if (child.type === schema.nodes.hard_break) lineStarts.push(offset + 1);
    });
    if (!lineStarts.includes($from.parentOffset))
      return selectScreenplayElementType(tabType(element.attrs.type, !element.textContent.trim()))(state, dispatch);
    const type = tabType(element.attrs.type, !element.textContent.trim());
    if (lineStarts.length > 1 && cycleScreenplayLine(state, element, position, $from.parentOffset, type, dispatch))
      return true;
    let tr = state.tr.setNodeMarkup(position, undefined, {
      ...element.attrs,
      type,
    });
    if (type === 'transition') tr = prepareTransition(tr, position);
    if (element.attrs.type === 'transition') {
      const end = element.textContent.trimEnd().length;
      if (end > 0 && element.textContent[end - 1] === ':')
        tr = tr.delete(position + end, position + end + 1);
    }
    // Type cycling is anchored at the start of the existing paragraph. Keep it
    // there even when Transition inserts its automatic trailing colon.
    tr = tr.setSelection(TextSelection.create(tr.doc, position + 1));
    dispatch?.(tr.scrollIntoView());
    return true;
  }
  return selectScreenplayElementType(tabType(element.attrs.type, !element.textContent.trim()))(state, dispatch);
};

export const insertScreenplayLineBreak: Command = (state, dispatch) => {
  const element = selectedElement(state);
  if (!element || element.attrs.locked) return false;
  dispatch?.(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
  return true;
};

export const startParentheticalAfterCharacter: Command = (state, dispatch) => {
  const element = selectedElement(state);
  if (!element || element.attrs.locked || element.attrs.type !== 'dialogue' || element.textContent || !state.selection.empty) return false;
  const sceneDepth = state.selection.$from.depth - 1;
  const scene = state.selection.$from.node(sceneDepth);
  const elementIndex = state.selection.$from.index(sceneDepth);
  if (elementIndex === 0 || scene.child(elementIndex - 1).attrs.type !== 'character') return false;
  const position = state.selection.$from.before();
  let transaction = state.tr
    .setNodeMarkup(position, undefined, { ...element.attrs, type: 'parenthetical' })
    .insertText('()', position + 1);
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, position + 2));
  dispatch?.(transaction.scrollIntoView());
  return true;
};

export const startParentheticalAfterDialogueBreak: Command = (state, dispatch) => {
  const element = selectedElement(state);
  if (!element || element.attrs.locked || element.attrs.type !== 'dialogue' || !state.selection.empty) return false;
  const offset = state.selection.$from.parentOffset;
  if (offset !== element.content.size || !element.lastChild || element.lastChild.type !== schema.nodes.hard_break) return false;
  const elementPosition = state.selection.$from.before();
  let transaction = state.tr.delete(state.selection.from - 1, state.selection.from);
  const insertPosition = elementPosition + element.nodeSize - 1;
  transaction = transaction.insert(insertPosition, elementNode(element, 'parenthetical'));
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, insertPosition + 2));
  dispatch?.(transaction.scrollIntoView());
  return true;
};

export const skipExistingParentheticalClose: Command = (state, dispatch) => {
  const element = selectedElement(state);
  if (!element || element.attrs.type !== 'parenthetical' || !state.selection.empty) return false;
  const offset = state.selection.$from.parentOffset;
  if (element.textContent[offset] !== ')') return false;
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, state.selection.from + 1)).scrollIntoView());
  return true;
};

export const moveToPreviousScreenplayElement: Command = (state, dispatch) => {
  if (!state.selection.empty) return deleteScreenplaySelection(state, dispatch);
  const element = selectedElement(state);
  if (!element || !state.selection.empty || state.selection.$from.parentOffset > 0) return false;
  const currentPosition = state.selection.$from.before();
  let previous: { node: PMNode; position: number } | null = null;
  state.doc.descendants((node, position) => {
    if (node.type !== schema.nodes.screenplay_element) return true;
    if (position >= currentPosition) return false;
    previous = { node, position };
    return false;
  });
  if (!previous) return false;
  const target = previous as { node: PMNode; position: number };
  if (!element.textContent && element.attrs.type !== 'scene_heading') {
    const transaction = state.tr.delete(currentPosition, currentPosition + element.nodeSize);
    dispatch?.(transaction.setSelection(TextSelection.create(transaction.doc, target.position + target.node.nodeSize - 1)).scrollIntoView());
    return true;
  }
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, target.position + target.node.nodeSize - 1)).scrollIntoView());
  return true;
};

export const deleteForwardScreenplayElement: Command = (state, dispatch) => {
  if (!state.selection.empty) return deleteScreenplaySelection(state, dispatch);
  const element = selectedElement(state);
  if (!element || element.attrs.locked) return false;
  if (!state.selection.empty) {
    dispatch?.(state.tr.deleteSelection().scrollIntoView());
    return true;
  }

  const { $from } = state.selection;
  if ($from.parentOffset < element.content.size) {
    dispatch?.(state.tr.delete($from.pos, $from.pos + 1).scrollIntoView());
    return true;
  }

  const sceneDepth = $from.depth - 1;
  const scene = $from.node(sceneDepth);
  const elementIndex = $from.index(sceneDepth);
  if (elementIndex + 1 >= scene.childCount) return false;
  const next = scene.child(elementIndex + 1);
  if (!next || next.attrs.locked) return false;

  const boundary = $from.after();
  const transaction = state.tr.delete(boundary - 1, boundary + 1);
  dispatch?.(
    transaction
      .setSelection(TextSelection.create(transaction.doc, boundary - 1))
      .scrollIntoView(),
  );
  return true;
};
