import type { SceneRecord, ScreenplayElement, ScreenplayElementType, ScreenplayRecord } from '../shared/models';
import { normalizeOrders } from './screenplay';

export type SearchScope = 'screenplay' | 'scene' | ScreenplayElementType;
export interface SearchOccurrence { sceneId: string; elementId: string; start: number; end: number; preview: string; }

function inScope(scene: SceneRecord, element: ScreenplayElement, scope: SearchScope, activeSceneId?: string) {
  if (scope === 'screenplay') return true; if (scope === 'scene') return scene.id === activeSceneId; return element.type === scope;
}
export interface SearchOptions { caseSensitive?: boolean; wholeWords?: boolean }

export function findOccurrences(screenplay: ScreenplayRecord, query: string, scope: SearchScope = 'screenplay', activeSceneId?: string, options: SearchOptions = {}): SearchOccurrence[] {
  if (!query) return []; const needle = options.caseSensitive ? query : query.toLocaleLowerCase(); const results: SearchOccurrence[] = [];
  for (const scene of screenplay.scenes) for (const element of scene.elements) if (inScope(scene, element, scope, activeSceneId)) {
    const value = options.caseSensitive ? element.content : element.content.toLocaleLowerCase(); let from = 0; while (from <= value.length) { const start = value.indexOf(needle, from); if (start < 0) break; if (!options.wholeWords || (!/[\p{L}\p{N}_]/u.test([...element.content.slice(0, start)].at(-1) ?? '') && !/[\p{L}\p{N}_]/u.test([...element.content.slice(start + query.length)][0] ?? ''))) results.push({ sceneId: scene.id, elementId: element.id, start, end: start + query.length, preview: element.content }); from = start + Math.max(1, query.length); }
  }
  return results;
}
export function replaceOccurrences(screenplay: ScreenplayRecord, query: string, replacement: string, scope: SearchScope = 'screenplay', activeSceneId?: string, replaceAll = true, options: SearchOptions = {}): { screenplay: ScreenplayRecord; count: number } {
  const targets = findOccurrences(screenplay, query, scope, activeSceneId, options); const selected = replaceAll ? targets : targets.slice(0, 1); if (!selected.length) return { screenplay, count: 0 };
  const grouped = new Map<string, SearchOccurrence[]>(); selected.forEach((item) => grouped.set(item.elementId, [...(grouped.get(item.elementId) ?? []), item]));
  const scenes = screenplay.scenes.map((scene) => ({ ...scene, elements: scene.elements.map((element) => { const matches = grouped.get(element.id); if (!matches) return element; let content = element.content; [...matches].sort((a, b) => b.start - a.start).forEach((match) => { content = content.slice(0, match.start) + replacement + content.slice(match.end); }); return { ...element, content, formatting: [] }; }) }));
  return { screenplay: { ...screenplay, scenes }, count: selected.length };
}
export function reorderScene(screenplay: ScreenplayRecord, sceneId: string, targetIndex: number): ScreenplayRecord {
  const scenes = [...screenplay.scenes]; const source = scenes.findIndex((scene) => scene.id === sceneId); if (source < 0) return screenplay;
  const [scene] = scenes.splice(source, 1); scenes.splice(Math.max(0, Math.min(targetIndex, scenes.length)), 0, scene); return normalizeOrders({ ...screenplay, scenes });
}
function cloneElement(element: ScreenplayElement, order: number, groups = new Map<string, string>()): ScreenplayElement { const oldGroup = element.dualDialogue?.groupId; if (oldGroup && !groups.has(oldGroup)) groups.set(oldGroup, crypto.randomUUID()); return { ...structuredClone(element), id: crypto.randomUUID(), order, dualDialogue: element.dualDialogue ? { ...element.dualDialogue, groupId: groups.get(oldGroup!)! } : undefined }; }
export function duplicateScene(screenplay: ScreenplayRecord, sceneId: string, targetIndex?: number): ScreenplayRecord {
  const source = screenplay.scenes.find((scene) => scene.id === sceneId); if (!source) return screenplay; const now = new Date().toISOString();
  const groups = new Map<string, string>(); const copy: SceneRecord = { ...structuredClone(source), id: crypto.randomUUID(), order: 0, createdAt: now, updatedAt: now, elements: source.elements.map((element, order) => cloneElement(element, order, groups)) };
  const scenes = [...screenplay.scenes]; const index = targetIndex ?? scenes.findIndex((scene) => scene.id === sceneId) + 1; scenes.splice(index, 0, copy); return normalizeOrders({ ...screenplay, scenes });
}
export function duplicateElements(scene: SceneRecord, elementIds: string[], afterElementId: string): SceneRecord {
  const selected = scene.elements.filter((element) => elementIds.includes(element.id)); const index = scene.elements.findIndex((element) => element.id === afterElementId) + 1; const elements = [...scene.elements]; const groups = new Map<string, string>(); elements.splice(index, 0, ...selected.map((element, order) => cloneElement(element, order, groups))); return { ...scene, elements: elements.map((element, order) => ({ ...element, order })) };
}
export function screenplayPlainText(screenplay: ScreenplayRecord) { return screenplay.scenes.flatMap((scene) => scene.elements.map((element) => element.content)).join('\n'); }
export function screenplayStatistics(screenplay: ScreenplayRecord) { const text = screenplayPlainText(screenplay).trim(); const words = text ? text.split(/\s+/).length : 0; return { words, scenes: screenplay.scenes.length, approximatePages: Math.max(1, Math.ceil(words / 180)) }; }
