import type { SceneRecord, ScreenplayElement, ScreenplayElementType, ScreenplayRecord } from '../shared/models';
import { createElement, nextElementType, normalizeOrders, updateScene } from './screenplay';

export interface ElementLocation { sceneId: string; sceneIndex: number; elementIndex: number; element: ScreenplayElement }

export function orderedElements(screenplay: ScreenplayRecord): ElementLocation[] {
  return screenplay.scenes.flatMap((scene, sceneIndex) => scene.elements.map((element, elementIndex) => ({ sceneId: scene.id, sceneIndex, elementIndex, element })));
}

export function parseCharacterCue(content: string): { name: string; extension?: string } {
  const match = content.trim().toUpperCase().match(/^(.+?)(?:\s+\(([^)]+)\))?$/);
  return { name: match?.[1]?.trim() ?? '', extension: match?.[2]?.trim() || undefined };
}

export function withCharacterMetadata(element: ScreenplayElement): ScreenplayElement {
  return element.type === 'character' ? { ...element, character: parseCharacterCue(element.content) } : { ...element, character: undefined };
}

export function transformElement(screenplay: ScreenplayRecord, elementId: string, type: ScreenplayElementType): ScreenplayRecord {
  const location = orderedElements(screenplay).find((item) => item.element.id === elementId);
  if (!location) return screenplay;
  return updateScene(screenplay, location.sceneId, (scene) => ({ ...scene, elements: scene.elements.map((element) => element.id === elementId ? withCharacterMetadata({ ...element, type }) : element) }));
}

export function splitElement(screenplay: ScreenplayRecord, elementId: string, offset: number, requestedType?: ScreenplayElementType): { screenplay: ScreenplayRecord; focusId: string } {
  const location = orderedElements(screenplay).find((item) => item.element.id === elementId);
  if (!location) return { screenplay, focusId: elementId };
  const source = location.element;
  const at = Math.max(0, Math.min(offset, source.content.length));
  const expectedType = requestedType ?? nextElementType(source.type);
  const existingNext = screenplay.scenes[location.sceneIndex]?.elements[location.elementIndex + 1];
  if (at === source.content.length && existingNext && !existingNext.content.trim() && existingNext.type === expectedType) {
    return { screenplay, focusId: existingNext.id };
  }
  const left = withCharacterMetadata({ ...source, content: source.content.slice(0, at), formatting: (source.formatting ?? []).filter((range) => range.start < at).map((range) => ({ ...range, end: Math.min(range.end, at) })) });
  const type = expectedType;
  const right = withCharacterMetadata({ ...createElement(type, source.content.slice(at)), formatting: (source.formatting ?? []).filter((range) => range.end > at).map((range) => ({ ...range, start: Math.max(0, range.start - at), end: range.end - at })) });
  const next = updateScene(screenplay, location.sceneId, (scene) => { const elements = [...scene.elements]; elements.splice(location.elementIndex, 1, left, right); return { ...scene, elements: elements.map((element, order) => ({ ...element, order })) }; });
  return { screenplay: normalizeOrders(next), focusId: right.id };
}

function canCrossSceneJoin(left: ScreenplayElement, right: ScreenplayElement) { return left.type !== 'scene_heading' && right.type !== 'scene_heading'; }

export function joinAtBoundary(screenplay: ScreenplayRecord, elementId: string, direction: 'backward' | 'forward'): { screenplay: ScreenplayRecord; focusId: string; caret: number } {
  const all = orderedElements(screenplay); const index = all.findIndex((item) => item.element.id === elementId);
  if (index < 0) return { screenplay, focusId: elementId, caret: 0 };
  const leftLocation = direction === 'backward' ? all[index - 1] : all[index];
  const rightLocation = direction === 'backward' ? all[index] : all[index + 1];
  if (!leftLocation || !rightLocation || (leftLocation.sceneId !== rightLocation.sceneId && !canCrossSceneJoin(leftLocation.element, rightLocation.element))) return { screenplay, focusId: elementId, caret: direction === 'backward' ? 0 : all[index].element.content.length };
  const caret = leftLocation.element.content.length;
  const joined = withCharacterMetadata({ ...leftLocation.element, content: leftLocation.element.content + rightLocation.element.content, formatting: [...(leftLocation.element.formatting ?? []), ...(rightLocation.element.formatting ?? []).map((range) => ({ ...range, start: range.start + caret, end: range.end + caret }))], dualDialogue: leftLocation.element.dualDialogue?.groupId === rightLocation.element.dualDialogue?.groupId ? leftLocation.element.dualDialogue : undefined });
  let scenes = screenplay.scenes.map((scene) => ({ ...scene, elements: scene.elements.map((element) => element.id === joined.id ? joined : element).filter((element) => element.id !== rightLocation.element.id) }));
  scenes = scenes.filter((scene, sceneIndex) => scene.elements.length > 0 || sceneIndex === 0);
  return { screenplay: normalizeOrders({ ...screenplay, scenes }), focusId: joined.id, caret };
}

export function tabType(type: ScreenplayElementType, empty: boolean): ScreenplayElementType {
  if (type === 'action') return 'character';
  if (type === 'dialogue') return 'parenthetical';
  if (type === 'parenthetical') return 'dialogue';
  if (type === 'transition') return 'action';
  if (type === 'character') return 'transition';
  return type;
}

export function parentheticalContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return '()';
  return trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed : `(${trimmed.replace(/^\(|\)$/g, '')})`;
}
