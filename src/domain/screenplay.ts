import type { SceneRecord, ScreenplayElement, ScreenplayElementType, ScreenplayRecord } from '../shared/models';

const nextTypeMap: Record<ScreenplayElementType, ScreenplayElementType> = {
  scene_heading: 'action', action: 'action', character: 'dialogue', dialogue: 'character',
  parenthetical: 'dialogue', transition: 'scene_heading', lyrics: 'lyrics', shot: 'action', page_break: 'scene_heading'
};

export function nextElementType(type: ScreenplayElementType): ScreenplayElementType { return nextTypeMap[type]; }
export function tabElementType(type: ScreenplayElementType): ScreenplayElementType {
  if (type === 'action') return 'character';
  if (type === 'dialogue') return 'parenthetical';
  if (type === 'parenthetical') return 'dialogue';
  if (type === 'transition') return 'scene_heading';
  if (type === 'shot') return 'action';
  if (type === 'character') return 'parenthetical';
  return type;
}

export function isTransientEmptyElement(element: ScreenplayElement): boolean {
  return !element.content.trim() && !(element.formatting?.length) && !element.dualDialogue;
}

export function advanceElement(scene: SceneRecord, elementId: string, type: ScreenplayElementType): { scene: SceneRecord; elementId: string; replaced: boolean } {
  const index = scene.elements.findIndex((element) => element.id === elementId);
  if (index < 0) return { scene, elementId, replaced: false };
  const current = scene.elements[index];
  if (isTransientEmptyElement(current) && current.type !== 'scene_heading') {
    const elements = scene.elements.map((element) => element.id === elementId ? { ...element, type } : element);
    return { scene: { ...scene, elements, updatedAt: new Date().toISOString() }, elementId, replaced: true };
  }
  const next = createElement(type, '', index + 1); const elements = [...scene.elements]; elements.splice(index + 1, 0, next);
  return { scene: { ...scene, elements: elements.map((element, order) => ({ ...element, order })), updatedAt: new Date().toISOString() }, elementId: next.id, replaced: false };
}

export function createElement(type: ScreenplayElementType = 'action', content = '', order = 0): ScreenplayElement {
  return { id: crypto.randomUUID(), type, content: type === 'scene_heading' ? content.toUpperCase() : content, order };
}

/** Store scene headings in their displayed case, preserving IDs and text anchors. */
export function normalizeSceneHeadings(screenplay: ScreenplayRecord): ScreenplayRecord {
  const offsets = new Map<string, (offset: number) => number>();
  const scenes = screenplay.scenes.map(scene => {
    let changed = false;
    const elements = scene.elements.map(element => {
      if (element.type !== 'scene_heading') return element;
      const content = element.content.toUpperCase();
      if (content === element.content) return element;
      changed = true;
      const offset = (value: number) => element.content.slice(0, value).toUpperCase().length;
      offsets.set(element.id, offset);
      return { ...element, content, ...(element.formatting ? { formatting: element.formatting.map(range => ({ ...range, start: offset(range.start), end: offset(range.end) })) } : {}) };
    });
    return changed ? { ...scene, elements } : scene;
  });
  if (!offsets.size) return screenplay;
  return { ...screenplay, scenes, ...(screenplay.notes ? { notes: screenplay.notes.map(note => ({ ...note,
    from: { ...note.from, offset: offsets.get(note.from.elementId)?.(note.from.offset) ?? note.from.offset },
    to: { ...note.to, offset: offsets.get(note.to.elementId)?.(note.to.offset) ?? note.to.offset },
  })) } : {}) };
}

export function createScene(order: number, now = new Date().toISOString()): SceneRecord {
  return {
    id: crypto.randomUUID(), order, locked: false, metadata: { synopsis: '' }, createdAt: now, updatedAt: now,
    elements: [createElement('scene_heading', '', 0), createElement('action', '', 1)]
  };
}

export function createScreenplay(input: { projectId: string; title: string; screenplayType: 'feature' | 'short' | 'episode'; episodeId?: string }, now = new Date().toISOString()): ScreenplayRecord {
  return {
    schemaVersion: 1, id: crypto.randomUUID(), projectId: input.projectId, episodeId: input.episodeId,
    title: input.title, screenplayType: input.screenplayType, scenes: [createScene(0, now)],
    revision: { currentRevisionId: crypto.randomUUID(), sequence: 1 }, createdAt: now, updatedAt: now
  };
}

export function normalizeOrders(screenplay: ScreenplayRecord): ScreenplayRecord {
  return {
    ...screenplay,
    scenes: screenplay.scenes.map((scene, sceneIndex) => ({
      ...scene, order: sceneIndex,
      elements: scene.elements.map((element, elementIndex) => ({ ...element, order: elementIndex }))
    }))
  };
}

export function normalizeSceneBoundaries(screenplay: ScreenplayRecord): ScreenplayRecord {
  screenplay = normalizeSceneHeadings(screenplay);
  let changed = false;
  const now = new Date().toISOString();
  const scenes = screenplay.scenes.flatMap((scene) => {
    const chunks: ScreenplayElement[][] = [];
    let current: ScreenplayElement[] = [];
    for (const element of scene.elements) {
      if (element.type === 'scene_heading' && current.length) {
        chunks.push(current);
        current = [];
      }
      current.push(element);
    }
    if (current.length) chunks.push(current);
    if (chunks.length <= 1) return [scene];
    changed = true;
    return chunks.map((elements, index) => index === 0
      ? { ...scene, elements }
      : { ...scene, id: crypto.randomUUID(), locked: false, metadata: { synopsis: '' }, createdAt: now, updatedAt: now, elements });
  });
  return changed ? normalizeOrders({ ...screenplay, scenes }) : screenplay;
}

export function insertScene(screenplay: ScreenplayRecord, afterSceneId?: string): ScreenplayRecord {
  const scenes = [...screenplay.scenes];
  const index = afterSceneId ? scenes.findIndex((scene) => scene.id === afterSceneId) + 1 : scenes.length;
  scenes.splice(Math.max(0, index), 0, createScene(index));
  return normalizeOrders({ ...screenplay, scenes });
}

export function deleteScene(screenplay: ScreenplayRecord, sceneId: string): ScreenplayRecord {
  if (screenplay.scenes.length <= 1) throw new Error('A screenplay must contain at least one scene.');
  const scenes = screenplay.scenes.filter((scene) => scene.id !== sceneId);
  if (scenes.length === screenplay.scenes.length) throw new Error('Scene could not be found.');
  return normalizeOrders({ ...screenplay, scenes });
}

export function moveScene(screenplay: ScreenplayRecord, sceneId: string, direction: -1 | 1): ScreenplayRecord {
  const scenes = [...screenplay.scenes]; const index = scenes.findIndex((scene) => scene.id === sceneId); const target = index + direction;
  if (index < 0 || target < 0 || target >= scenes.length) return screenplay;
  [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
  return normalizeOrders({ ...screenplay, scenes });
}

export function updateScene(screenplay: ScreenplayRecord, sceneId: string, updater: (scene: SceneRecord) => SceneRecord): ScreenplayRecord {
  return { ...screenplay, scenes: screenplay.scenes.map((scene) => scene.id === sceneId ? updater(scene) : scene) };
}

export function validateScreenplay(value: ScreenplayRecord): string[] {
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push('Unsupported screenplay schema version.');
  if (!value.id || !value.projectId) errors.push('Screenplay identity is missing.');
  if (!Array.isArray(value.scenes) || value.scenes.length === 0) errors.push('A screenplay requires at least one scene.');
  const sceneIds = new Set<string>(); const elementIds = new Set<string>();
  value.scenes?.forEach((scene, sceneIndex) => {
    if (!scene.id || sceneIds.has(scene.id)) errors.push('Scene identities must be present and unique.');
    sceneIds.add(scene.id);
    if (scene.order !== sceneIndex) errors.push('Scene order is invalid.');
    scene.elements.forEach((element, elementIndex) => {
      if (!element.id || elementIds.has(element.id)) errors.push('Element identities must be present and unique.');
      elementIds.add(element.id);
      if (element.order !== elementIndex) errors.push('Element order is invalid.');
      if (element.formatting?.some((range) => range.start < 0 || range.end <= range.start || range.end > element.content.length)) errors.push('Text formatting range is invalid.');
    });
    const dualGroups = new Map<string, ScreenplayElement[]>();
    scene.elements.filter((element) => element.dualDialogue).forEach((element) => { const group = dualGroups.get(element.dualDialogue!.groupId) ?? []; group.push(element); dualGroups.set(element.dualDialogue!.groupId, group); });
    for (const group of dualGroups.values()) for (const side of ['left', 'right'] as const) {
      if (group.filter((element) => element.dualDialogue?.side === side && element.type === 'character').length !== 1 || group.filter((element) => element.dualDialogue?.side === side && element.type === 'dialogue').length < 1) errors.push('Dual dialogue requires one Character and at least one Dialogue on each side.');
    }
  });
  const noteIds = new Set<string>();
  value.notes?.forEach((note) => {
    if (!note.id || noteIds.has(note.id)) errors.push('Note identities must be present and unique.');
    noteIds.add(note.id);
    if (!note.sceneId || !note.from?.elementId || !note.to?.elementId) errors.push('Note anchors are invalid.');
    if (!Number.isInteger(note.from?.offset) || note.from.offset < 0 || !Number.isInteger(note.to?.offset) || note.to.offset < 0) errors.push('Note offsets are invalid.');
    if (!note.content?.trim()) errors.push('Note content is required.');
    const responseIds = new Set<string>();
    note.responses?.forEach((response) => {
      if (!response.id || responseIds.has(response.id)) errors.push('Note response identities must be present and unique.');
      responseIds.add(response.id);
      if (!response.content?.trim()) errors.push('Note response content is required.');
    });
  });
  return [...new Set(errors)];
}

export interface CompiledElement { sceneId: string; sceneNumber: number; elementId: string; type: ScreenplayElementType; content: string; formatting: ScreenplayElement['formatting']; alignment: ScreenplayElement['alignment']; dualDialogue: ScreenplayElement['dualDialogue']; }
export function compileScreenplay(screenplay: ScreenplayRecord): CompiledElement[] {
  screenplay = normalizeSceneHeadings(screenplay);
  return [...screenplay.scenes].sort((a, b) => a.order - b.order).flatMap((scene, sceneIndex) =>
    [...scene.elements].sort((a, b) => a.order - b.order).map((element) => ({
      sceneId: scene.id, sceneNumber: sceneIndex + 1, elementId: element.id, type: element.type, content: element.content,
      formatting: element.formatting, alignment: element.alignment, dualDialogue: element.dualDialogue
    }))
  );
}

export function sceneHeading(scene: SceneRecord, fallbackNumber: number): string {
  return (scene.elements.find((element) => element.type === 'scene_heading')?.content.trim() || `Scene ${fallbackNumber}`).toUpperCase();
}

export function sceneLocation(scene: SceneRecord): string {
  const heading = scene.elements.find((element) => element.type === 'scene_heading')?.content.trim().toUpperCase() ?? '';
  if (!heading) return 'UNSPECIFIED';
  const withoutPrefix = heading.replace(/^(?:INT\.\/EXT\.|INT\/EXT\.|INT\.|EXT\.)\s*/, '');
  return withoutPrefix.replace(/\s+-\s+[^-]+$/, '').trim() || 'UNSPECIFIED';
}
