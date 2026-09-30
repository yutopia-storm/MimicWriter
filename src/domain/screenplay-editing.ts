import type { SceneRecord, ScreenplayElement, ScreenplayElementType, ScreenplayRecord, TextAlignment, TextEmphasis, TextFormatRange } from '../shared/models';
import { parseCharacterCue } from './continuous-editor';

export function uniqueSuggestions(screenplay: ScreenplayRecord, type: 'character' | 'scene_heading', query: string, omitId?: string): string[] {
  const normalized = query.trim().toUpperCase();
  const values = screenplay.scenes.flatMap((scene) => scene.elements)
    .filter((element) => element.id !== omitId && element.type === type)
    .map((element) => type === 'character' ? parseCharacterCue(element.content).name : element.content.trim().toUpperCase()).filter(Boolean);
  return [...new Set(values)].filter((value) => !normalized || value.startsWith(normalized)).slice(0, 8);
}

export function smartTypeSuggestions(screenplay: ScreenplayRecord, type: ScreenplayElementType, query: string, omitId?: string): string[] {
  const normalized = query.trim().toUpperCase();
  if (type === 'character') {
    const names = uniqueSuggestions(screenplay, 'character', query, omitId);
    const extensions = ['(V.O.)', '(O.S.)', '(CONT’D)', '(FILTERED)'];
    if (normalized.includes('(')) { const name = parseCharacterCue(normalized).name; return extensions.map((extension) => `${name} ${extension}`).filter((value) => value.startsWith(normalized)); }
    return names;
  }
  if (type === 'scene_heading') {
    const used = uniqueSuggestions(screenplay, 'scene_heading', query, omitId);
    const intros = ['INT. ', 'EXT. ', 'INT/EXT. '];
    const times = ['DAY', 'NIGHT', 'MORNING', 'EVENING', 'CONTINUOUS', 'LATER'];
    const timeMatch = normalized.match(/^(.*\s-\s)([^-]*)$/);
    const contextual = timeMatch
      ? times.filter((value) => value.startsWith(timeMatch[2])).map((value) => `${timeMatch[1]}${value}`)
      : normalized.includes(' ') ? [] : intros.filter((value) => value.startsWith(normalized));
    return [...new Set([...contextual, ...used])].slice(0, 8);
  }
  if (type === 'transition') {
    const prefix = normalized.replace(/:$/, '').trimEnd();
    const used = screenplay.scenes.flatMap((scene) => scene.elements).filter((element) => element.type === 'transition' && element.id !== omitId).map((element) => element.content.trim().toUpperCase());
    return [...new Set([...used, 'CUT TO:', 'DISSOLVE TO:', 'FADE OUT:', 'SMASH CUT TO:'])].filter((value) => value.replace(/:$/, '').trim() && (!prefix || value.startsWith(prefix))).slice(0, 8);
  }
  return [];
}

export function applyFormatting(element: ScreenplayElement, start: number, end: number, emphasis: TextEmphasis): ScreenplayElement {
  if (start === end) return element;
  const range: TextFormatRange = { start: Math.max(0, Math.min(start, end)), end: Math.min(element.content.length, Math.max(start, end)), ...emphasis };
  return { ...element, formatting: [...(element.formatting ?? []), range] };
}

export function toggleEmphasis(element: ScreenplayElement, start: number, end: number, key: 'bold' | 'italic' | 'underline' | 'strike'): ScreenplayElement {
  const from = Math.max(0, Math.min(start, end)); const to = Math.min(element.content.length, Math.max(start, end)); if (from === to) return element;
  const styles = Array.from({ length: element.content.length }, () => ({} as TextEmphasis));
  for (const range of element.formatting ?? []) for (let index = range.start; index < Math.min(range.end, styles.length); index++) Object.assign(styles[index], Object.fromEntries(Object.entries(range).filter(([name]) => name !== 'start' && name !== 'end')));
  const enabled = styles.slice(from, to).every((style) => style[key] === true); for (let index = from; index < to; index++) styles[index] = { ...styles[index], [key]: enabled ? undefined : true };
  const formatting: TextFormatRange[] = []; for (let index = 0; index < styles.length; index++) { const clean = Object.fromEntries(Object.entries(styles[index]).filter(([, value]) => value !== undefined)); if (!Object.keys(clean).length) continue; const previous = formatting.at(-1); if (previous && previous.end === index && JSON.stringify(Object.fromEntries(Object.entries(previous).filter(([name]) => name !== 'start' && name !== 'end'))) === JSON.stringify(clean)) previous.end++; else formatting.push({ start: index, end: index + 1, ...clean }); }
  return { ...element, formatting };
}

export function removeFormatting(element: ScreenplayElement, start = 0, end = element.content.length): ScreenplayElement {
  const formatting = (element.formatting ?? []).flatMap((range) => {
    if (range.end <= start || range.start >= end) return [range];
    const fragments: TextFormatRange[] = [];
    if (range.start < start) fragments.push({ ...range, end: start });
    if (range.end > end) fragments.push({ ...range, start: end });
    return fragments;
  });
  return { ...element, formatting };
}

export function reconcileFormatting(element: ScreenplayElement, content: string): ScreenplayElement {
  let prefix = 0; while (prefix < element.content.length && prefix < content.length && element.content[prefix] === content[prefix]) prefix++;
  let suffix = 0; while (suffix < element.content.length - prefix && suffix < content.length - prefix && element.content[element.content.length - 1 - suffix] === content[content.length - 1 - suffix]) suffix++;
  const oldEnd = element.content.length - suffix; const delta = content.length - element.content.length;
  const formatting = (element.formatting ?? []).map((range) => {
    if (range.end <= prefix) return range;
    if (range.start >= oldEnd) return { ...range, start: range.start + delta, end: range.end + delta };
    return { ...range, end: Math.max(range.start, Math.min(content.length, range.end + delta)) };
  }).filter((range) => range.end > range.start);
  return { ...element, content, formatting };
}

export function convertCase(element: ScreenplayElement, start: number, end: number, mode: 'upper' | 'lower'): ScreenplayElement {
  const from = Math.min(start, end); const to = Math.max(start, end);
  const selected = element.content.slice(from, to); const replacement = mode === 'upper' ? selected.toUpperCase() : selected.toLowerCase();
  return { ...element, content: element.content.slice(0, from) + replacement + element.content.slice(to) };
}

export function setAlignment(element: ScreenplayElement, alignment: TextAlignment): ScreenplayElement { return { ...element, alignment }; }

interface SpeechBlock { characterId: string; elements: ScreenplayElement[]; start: number; end: number; }
export function speechBlock(scene: SceneRecord, characterId: string): SpeechBlock | null {
  const start = scene.elements.findIndex((element) => element.id === characterId && element.type === 'character');
  if (start < 0) return null;
  let cursor = start + 1;
  while (['parenthetical', 'dialogue'].includes(scene.elements[cursor]?.type)) cursor++;
  const elements = scene.elements.slice(start, cursor);
  if (!elements.some(element => element.type === 'dialogue')) return null;
  return { characterId, elements, start, end: cursor - 1 };
}

export function canMakeDualDialogue(scene: SceneRecord, characterIds: string[]): boolean {
  if (characterIds.length !== 2) return false;
  const blocks = characterIds.map((id) => speechBlock(scene, id));
  if (blocks.some((block) => !block)) return false;
  const [first, second] = blocks as SpeechBlock[];
  return first.end + 1 === second.start || second.end + 1 === first.start;
}

export function makeDualDialogue(scene: SceneRecord, characterIds: string[], groupId: string = crypto.randomUUID()): SceneRecord {
  if (!canMakeDualDialogue(scene, characterIds)) throw new Error('Select two adjacent Character and Dialogue blocks.');
  const blocks = characterIds.map((id) => speechBlock(scene, id)!).sort((a, b) => a.start - b.start);
  const membership = new Map<string, ScreenplayElement['dualDialogue']>();
  blocks.forEach((block, sideIndex) => block.elements.forEach((element) => membership.set(element.id, { groupId, side: sideIndex ? 'right' : 'left', role: element.type as 'character' | 'parenthetical' | 'dialogue' })));
  return { ...scene, elements: scene.elements.map((element) => membership.has(element.id) ? { ...element, dualDialogue: membership.get(element.id) } : element) };
}

export function removeDualDialogue(scene: SceneRecord, groupId: string): SceneRecord {
  return { ...scene, elements: scene.elements.map((element) => element.dualDialogue?.groupId === groupId ? { ...element, dualDialogue: undefined } : element) };
}

export function speechBlockForDialogue(scene: SceneRecord, dialogueId: string): SpeechBlock | null {
  const dialogueIndex = scene.elements.findIndex((element) => element.id === dialogueId && element.type === 'dialogue');
  if (dialogueIndex < 0) return null;
  let characterIndex = dialogueIndex - 1;
  while (['parenthetical', 'dialogue'].includes(scene.elements[characterIndex]?.type)) characterIndex--;
  if (scene.elements[characterIndex]?.type !== 'character') return null;
  return speechBlock(scene, scene.elements[characterIndex].id);
}

export function dualDialogueGroupForDialogues(scene: SceneRecord, dialogueIds: string[]): string | null {
  if (dialogueIds.length !== 2 || dialogueIds[0] === dialogueIds[1]) return null;
  const dialogues = dialogueIds.map((id) => scene.elements.find((element) => element.id === id && element.type === 'dialogue'));
  if (dialogues.some((dialogue) => !dialogue)) return null;
  const [first, second] = dialogues as ScreenplayElement[];
  const groupId = first.dualDialogue?.groupId;
  return groupId && second.dualDialogue?.groupId === groupId && first.dualDialogue?.side !== second.dualDialogue?.side ? groupId : null;
}

export function canToggleDualDialogue(scene: SceneRecord, dialogueIds: string[]): boolean {
  if (dualDialogueGroupForDialogues(scene, dialogueIds)) return true;
  const blocks = dialogueIds.map((id) => speechBlockForDialogue(scene, id));
  if (blocks.some((block) => !block)) return false;
  return canMakeDualDialogue(scene, (blocks as SpeechBlock[]).map((block) => block.characterId));
}

export function toggleDualDialogue(scene: SceneRecord, dialogueIds: string[]): SceneRecord {
  const groupId = dualDialogueGroupForDialogues(scene, dialogueIds);
  if (groupId) return removeDualDialogue(scene, groupId);
  const blocks = dialogueIds.map((id) => speechBlockForDialogue(scene, id));
  if (blocks.some((block) => !block)) throw new Error('Select two adjacent dialogue blocks.');
  return makeDualDialogue(scene, (blocks as SpeechBlock[]).map((block) => block.characterId));
}
