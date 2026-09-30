import { Schema, type Mark, type Node as PMNode } from 'prosemirror-model';
import type { ScreenplayElement, ScreenplayElementType, ScreenplayRecord, TextEmphasis, TextFormatRange } from '../shared/models';
import { parseCharacterCue } from './continuous-editor';
import { createScene, normalizeSceneBoundaries } from './screenplay';

export const continuousDocumentSchema = new Schema({
  nodes: {
    doc: { content: 'screenplay_scene+' },
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
    screenplay_scene: {
      group: 'block', content: 'screenplay_element+',
      attrs: { sceneId: { default: '' }, locked: { default: false }, order: { default: 0 } },
      toDOM(node) { const number = Number(node.attrs.order) + 1; return ['article', { class: `screenplay-scene continuous-scene${node.attrs.locked ? ' locked' : ''}`, 'data-scene-id': node.attrs.sceneId },
        ['div', { class: 'scene-toolbar', contenteditable: 'false' }, ['span', {}, `\u2637  SCENE ${number}`], ['div', {},
          ['button', { type: 'button', 'data-scene-command': 'metadata', title: 'Story details', 'aria-label': `Story details for scene ${number}` }, ['http://www.w3.org/2000/svg svg', { viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'aria-hidden': 'true' }, ['http://www.w3.org/2000/svg circle', { cx: '12', cy: '12', r: '9' }], ['http://www.w3.org/2000/svg path', { d: 'M12 7v5l3 2' }]]],
          ['button', { type: 'button', 'data-scene-command': 'up', title: 'Move scene up', 'aria-label': 'Move scene up' }, '\u2191'],
          ['button', { type: 'button', 'data-scene-command': 'down', title: 'Move scene down', 'aria-label': 'Move scene down' }, '\u2193'],
          ['button', { type: 'button', 'data-scene-command': 'lock', title: node.attrs.locked ? 'Unlock scene' : 'Lock scene', 'aria-label': node.attrs.locked ? 'Unlock scene' : 'Lock scene' }, node.attrs.locked ? '\uD83D\uDD12' : '\uD83D\uDD13'],
          ['button', { type: 'button', 'data-scene-command': 'delete', title: 'Delete scene', 'aria-label': 'Delete scene' }, '\u2715']]],
        ['div', { class: 'scene-content' }, 0],
        ['button', { type: 'button', class: 'add-scene-divider', contenteditable: 'false', 'data-scene-command': 'add', 'aria-label': `New scene after scene ${number}` }, ['span', { 'aria-hidden': 'true' }, '+'], ' New Scene']]; }
    },
    screenplay_element: {
      group: 'block', content: 'inline*',
      attrs: { elementId: { default: '' }, sceneId: { default: '' }, type: { default: 'action' }, locked: { default: false }, dualGroup: { default: null }, dualSide: { default: null }, dualRole: { default: null }, alignment: { default: null } },
      toDOM(node) { const a = node.attrs; const controls = a.type === 'character' ? [['button', { type: 'button', class: 'speech-selector', contenteditable: 'false', 'data-speech-select': a.elementId, 'aria-label': `Select speech ${node.textContent || 'unnamed'}` }, '\u25C7'], ...(a.dualGroup ? [['button', { type: 'button', class: 'remove-dual', contenteditable: 'false', 'data-remove-dual': a.dualGroup }, 'Remove Dual Dialogue']] : [])] : []; return ['div', { class: `continuous-block ${a.type}${a.locked ? ' locked' : ''}`, 'data-element-id': a.elementId, 'data-scene-id': a.sceneId, 'data-dual-group': a.dualGroup ?? undefined, 'data-dual-side': a.dualSide ?? undefined, style: a.alignment ? `text-align:${a.alignment}` : undefined }, ...controls, ['span', { class: 'continuous-block-content' }, 0]]; }
    }
  },
  marks: {
    bold: { toDOM: () => ['strong', 0] }, italic: { toDOM: () => ['em', 0] }, underline: { toDOM: () => ['u', 0] }, strike: { toDOM: () => ['s', 0] },
    color: { attrs: { value: {} }, toDOM: (mark) => ['span', { style: `color:${mark.attrs.value}` }, 0] },
    background: { attrs: { value: {} }, toDOM: (mark) => ['span', { style: `background-color:${mark.attrs.value}` }, 0] }
  }
});

function marksFor(range: TextFormatRange): Mark[] { const result: Mark[] = []; const marks = continuousDocumentSchema.marks; if (range.bold) result.push(marks.bold.create()); if (range.italic) result.push(marks.italic.create()); if (range.underline) result.push(marks.underline.create()); if (range.strike) result.push(marks.strike.create()); if (range.color) result.push(marks.color.create({ value: range.color })); if (range.backgroundColor) result.push(marks.background.create({ value: range.backgroundColor })); return result; }
export function textNodes(element: ScreenplayElement) {
  if (!element.content) return [];
  const boundaries = new Set([0, element.content.length]);
  for (const range of element.formatting ?? []) {
    boundaries.add(Math.max(0, Math.min(element.content.length, range.start)));
    boundaries.add(Math.max(0, Math.min(element.content.length, range.end)));
  }
  const points = [...boundaries].sort((a, b) => a - b);
  return points.slice(0, -1).flatMap((start, index) => {
    const end = points[index + 1];
    if (end <= start) return [];
    const active = (element.formatting ?? []).filter((range) => range.start <= start && range.end >= end).flatMap(marksFor);
    return element.content.slice(start, end).split(/(\n)/).flatMap((part) => {
      if (!part) return [];
      return part === '\n'
        ? continuousDocumentSchema.nodes.hard_break.create()
        : continuousDocumentSchema.text(part, active);
    });
  });
}

export function screenplayToContinuousDocument(screenplay: ScreenplayRecord, visibleSceneIds?: string | string[]): PMNode { const ids = visibleSceneIds ? new Set(Array.isArray(visibleSceneIds) ? visibleSceneIds : [visibleSceneIds]) : null; const scenes = ids ? screenplay.scenes.filter((scene) => ids.has(scene.id)) : screenplay.scenes; return continuousDocumentSchema.node('doc', null, scenes.map((scene) => continuousDocumentSchema.node('screenplay_scene', { sceneId: scene.id, locked: scene.locked, order: scene.order }, scene.elements.map((element) => continuousDocumentSchema.node('screenplay_element', { elementId: element.id, sceneId: scene.id, type: element.type, locked: scene.locked, dualGroup: element.dualDialogue?.groupId ?? null, dualSide: element.dualDialogue?.side ?? null, dualRole: element.dualDialogue?.role ?? null, alignment: element.alignment ?? null }, textNodes(element)))))); }
function markStyle(mark: Mark): TextEmphasis { if (mark.type.name === 'bold') return { bold: true }; if (mark.type.name === 'italic') return { italic: true }; if (mark.type.name === 'underline') return { underline: true }; if (mark.type.name === 'strike') return { strike: true }; if (mark.type.name === 'color') return { color: mark.attrs.value }; if (mark.type.name === 'background') return { backgroundColor: mark.attrs.value }; return {}; }
export function formatting(node: PMNode): TextFormatRange[] { const ranges: TextFormatRange[] = []; let offset = 0; node.forEach((child) => { const end = offset + child.nodeSize; const style = Object.assign({}, ...child.marks.map(markStyle)); const previous = ranges.at(-1); if (Object.keys(style).length && previous && previous.end === offset && JSON.stringify({ ...previous, start: 0, end: 0 }) === JSON.stringify({ start: 0, end: 0, ...style })) previous.end = end; else if (Object.keys(style).length) ranges.push({ start: offset, end, ...style }); offset = end; }); return ranges; }

export function elementText(node: PMNode) {
  let content = '';
  node.forEach((child) => { content += child.type === continuousDocumentSchema.nodes.hard_break ? '\n' : child.textContent; });
  return content;
}

export function continuousDocumentToScreenplay(base: ScreenplayRecord, doc: PMNode, visibleSceneIds?: string[]): ScreenplayRecord { const originals = new Map(base.scenes.flatMap((scene) => scene.elements.map((element) => [element.id, element] as const))); const byScene = new Map<string, ScreenplayElement[]>(); doc.forEach((sceneNode) => { const sceneId = sceneNode.attrs.sceneId as string; const values: ScreenplayElement[] = []; sceneNode.forEach((node) => { const a = node.attrs; const original = originals.get(a.elementId); const type = a.type as ScreenplayElementType; const content = elementText(node); const next: ScreenplayElement = { ...(original ?? { id: a.elementId, order: values.length, type, content: '' }), id: a.elementId, order: values.length, type, content }; const ranges = formatting(node); if (ranges.length) next.formatting = ranges; else delete next.formatting; if (a.alignment) next.alignment = a.alignment; else delete next.alignment; if (a.dualGroup) next.dualDialogue = { groupId: a.dualGroup, side: a.dualSide, role: a.dualRole }; else delete next.dualDialogue; if (type === 'character') { if (!original || original.type !== type || original.content !== content) next.character = parseCharacterCue(content); } else delete next.character; values.push(next); }); byScene.set(sceneId, values); }); const originalsByScene = new Map(base.scenes.map(scene => [scene.id, scene]));
  const visible = new Set(visibleSceneIds ?? base.scenes.filter(scene => byScene.has(scene.id)).map(scene => scene.id));
  const replacements = new Map<string, import('../shared/models').SceneRecord[]>();
  let anchor = base.scenes.find(scene => visible.has(scene.id))?.id;
  for (const [id, elements] of byScene) {
    if (originalsByScene.has(id)) anchor = id;
    const scene = { ...(originalsByScene.get(id) ?? createScene(0)), id, elements };
    if (anchor) replacements.set(anchor, [...(replacements.get(anchor) ?? []), scene]);
  }
  const scenes = base.scenes.flatMap(scene => visible.has(scene.id) ? replacements.get(scene.id) ?? [] : [scene]).map((scene, order) => ({...scene, order}));
  return normalizeSceneBoundaries({ ...base, scenes }); }
