import type { SceneRecord, ScreenplayElement, ScreenplayRecord } from '../shared/models';
import type { ScreenplayLayout } from '../shared/screenplay-layout';

export interface ElementFragment { kind: 'element'; sceneId: string; element: ScreenplayElement; start: number; end: number; lines: number; lineStart: number; wrappedLines: WrappedLine[]; }
export interface ContinuedCue { kind: 'continued'; sceneId: string; elementId: string; character: string; lines: 1; lineStart: number; }
export interface MoreMarker { kind: 'more'; sceneId: string; elementId: string; lines: 1; lineStart: number; }
export type PageEntry = ElementFragment | ContinuedCue | MoreMarker;
export interface ScreenplayPage { number: number; entries: PageEntry[]; usedLines: number; }
const MM_PER_POINT = 25.4 / 72;
export function pageLineCapacity(layout: ScreenplayLayout) { return Math.max(4, Math.floor((layout.pageHeightMm - layout.topMarginMm - layout.bottomMarginMm) / (layout.fontSizePt * MM_PER_POINT * layout.lineHeight) + 1e-8)); }
export function charactersPerLine(element: ScreenplayElement, layout: ScreenplayLayout) {
  const bounds = screenplayElementBounds(element, layout);
  return Math.max(1, Math.floor((bounds.rightMm - bounds.leftMm) / (layout.fontSizePt * MM_PER_POINT * .6) + 1e-8));
}
/** Parentheticals follow their cue, including the cue's actual text width. */
export function screenplayElementBounds(element: ScreenplayElement, layout: ScreenplayLayout, cue?: ScreenplayElement) {
  let bounds = { ...layout.elements[element.type] };
  const column = element.dualDialogue ? layout.dualDialogue[element.dualDialogue.side] : { leftMm: layout.leftMarginMm, rightMm: layout.pageWidthMm - layout.rightMarginMm };
  if (element.dualDialogue) {
    const inset = element.type === 'character' ? layout.dualDialogue.characterInsetMm : element.type === 'parenthetical' ? layout.dualDialogue.parentheticalInsetMm : 0;
    bounds = { ...bounds, leftMm: column.leftMm + inset, rightMm: column.rightMm };
  }
  if (element.type === 'parenthetical' && cue) {
    const character = screenplayElementBounds(cue, layout);
    const advance = layout.fontSizePt * MM_PER_POINT * .6;
    const length = Math.min(cue.content.split('\n')[0].length, Math.max(1, Math.floor((character.rightMm-character.leftMm)/advance)));
    const center = cue.alignment === 'center' ? (character.leftMm+character.rightMm)/2 : cue.alignment === 'right' ? character.rightMm-length*advance/2 : character.leftMm+length*advance/2;
    const halfWidth = Math.max(advance, Math.min((bounds.rightMm-bounds.leftMm)/2, center-column.leftMm, column.rightMm-center));
    bounds = { ...bounds, leftMm:center-halfWidth, rightMm:center+halfWidth };
  }
  return bounds;
}
export interface WrappedLine { start: number; end: number; }
// Contiguous source ranges include whitespace and hard breaks: layout never edits text.
export function wrapElement(element: ScreenplayElement, layout: ScreenplayLayout, cue?: ScreenplayElement): WrappedLine[] {
  const bounds = screenplayElementBounds(element, layout, cue);
  const text = element.content; const width = Math.max(1, Math.floor((bounds.rightMm-bounds.leftMm)/(layout.fontSizePt*MM_PER_POINT*.6)+1e-8)); const lines: WrappedLine[] = []; let start = 0;
  while (start < text.length) {
    const newline = text.indexOf('\n', start); let end = Math.min(start + width, text.length);
    if (newline >= start && newline < end) end = newline + 1;
    else if (end < text.length && text[end] !== '\n') { const space = text.lastIndexOf(' ', end); if (space > start) end = space + 1; }
    else if (text[end] === '\n') end++;
    lines.push({ start, end }); start = end;
  }
  if (!lines.length || text.endsWith('\n')) lines.push({ start: text.length, end: text.length });
  return lines;
}

export function paginateScreenplay(screenplay: ScreenplayRecord, layout: ScreenplayLayout, continuations = true): ScreenplayPage[] {
  const capacity = pageLineCapacity(layout); const pages: ScreenplayPage[] = [{ number: 1, entries: [], usedLines: 0 }]; let page = pages[0];
  let trailingSpace = 0;
  const nextPage = () => { page = { number: pages.length + 1, entries: [], usedLines: 0 }; pages.push(page); trailingSpace = 0; };
  // Adjacent paragraphs share a gap; before/after spacing must not add up.
  const beforeSpacing = (before: number) => page.usedLines ? Math.max(0, before - trailingSpace) : 0;
  const afterSpacing = (after: number) => { trailingSpace = Math.min(after, capacity - page.usedLines); page.usedLines += trailingSpace; };
  const put = (sceneId: string, element: ScreenplayElement, lines: WrappedLine[], before = 0) => {
    const lineStart = page.usedLines + before;
    page.entries.push({ kind: 'element', sceneId, element, start: lines[0].start, end: lines.at(-1)!.end, lines: lines.length, lineStart, wrappedLines: lines });
    page.usedLines = lineStart + lines.length;
    trailingSpace = 0;
  };
  const all = screenplay.scenes.flatMap((scene) => scene.elements.map((element) => ({ scene, element })));
  for (let index = 0; index < all.length; index++) {
    const { scene, element } = all[index];
    if (element.type === 'page_break') { if (page.entries.length) nextPage(); continue; }
    if (element.dualDialogue) {
      // Paginate both columns from the same vertical origin, then merge their pages.
      const group = all.slice(index).filter(item => item.scene.id === scene.id && item.element.dualDialogue?.groupId === element.dualDialogue!.groupId);
      const columns = (['left', 'right'] as const).map(side => {
        const elements = group.filter(item => item.element.dualDialogue?.side === side).map(item => ({ ...item.element, dualDialogue: undefined }));
        const columnLayout = structuredClone(layout); const bounds = layout.dualDialogue[side];
        columnLayout.leftMarginMm = bounds.leftMm; columnLayout.rightMarginMm = layout.pageWidthMm - bounds.rightMm;
        for (const type of ['character', 'parenthetical', 'dialogue'] as const) { const inset = type === 'character' ? layout.dualDialogue.characterInsetMm : type === 'parenthetical' ? layout.dualDialogue.parentheticalInsetMm : 0; columnLayout.elements[type] = { ...layout.elements[type], leftMm: bounds.leftMm + inset, rightMm: bounds.rightMm }; }
        return paginateScreenplay({ ...screenplay, scenes: [{ ...scene, elements }] }, columnLayout, continuations);
      });
      const height = Math.max(...columns.map(column => column[0].usedLines));
      if (page.usedLines && (columns.some(column => column.length > 1) || page.usedLines + height > capacity)) nextPage();
      const origin = page.usedLines;
      for (let p = 0; p < Math.max(...columns.map(column => column.length)); p++) {
        if (p) nextPage(); const offset = p ? 0 : origin;
        for (const column of columns) for (const entry of column[p]?.entries ?? []) page.entries.push({ ...entry, lineStart: entry.lineStart + offset, ...(entry.kind === 'element' ? { element: group.find(item => item.element.id === entry.element.id)!.element } : {}) });
        page.usedLines = offset + Math.max(...columns.map(column => column[p]?.usedLines ?? 0));
      }
      trailingSpace = Math.max(0, page.usedLines - Math.max(...page.entries.map(entry => entry.lineStart + entry.lines)));
      index += group.length - 1; continue;
    }
    const wrapped = wrapElement(element, layout);
    if (element.type === 'character') {
      const speech: { scene: SceneRecord; element: ScreenplayElement }[] = []; let cursor = index + 1;
      while (cursor < all.length && all[cursor].scene.id === scene.id && ['parenthetical', 'dialogue'].includes(all[cursor].element.type) && !all[cursor].element.dualDialogue) speech.push(all[cursor++]);
      if (speech.length) {
        const body = speech.flatMap(item => wrapElement(item.element, layout, element).map(line => ({ element: item.element, line })));
        const firstDialogue = body.findIndex(item => item.element.type === 'dialogue');
        const before = beforeSpacing(layout.elements.character.spaceBeforeLines);
        const minimum = wrapped.length + Math.max(1, firstDialogue + 1) + (body.length > firstDialogue + 1 && continuations ? 1 : 0);
        if (page.usedLines && capacity - page.usedLines < before + minimum) nextPage();
        put(scene.id, element, wrapped, page.usedLines ? before : 0);
        let offset = 0;
        while (offset < body.length) {
          const available = capacity - page.usedLines; const remaining = body.length - offset;
          const take = Math.min(remaining, available - (remaining > available && continuations ? 1 : 0));
          if (take <= 0) { nextPage(); continue; }
          let end = offset + take;
          // Keep a parenthetical with the dialogue it introduces where possible.
          if (end < body.length) while (end > offset + 1 && body[end - 1].element.type === 'parenthetical') end--;
          while (offset < end) { const current = body[offset].element; const lines: WrappedLine[] = []; while (offset < end && body[offset].element.id === current.id) lines.push(body[offset++].line); put(scene.id, current, lines); }
          if (offset < body.length) {
            if (continuations) page.entries.push({ kind: 'more', sceneId: scene.id, elementId: body[offset - 1].element.id, lines: 1, lineStart: page.usedLines++ });
            nextPage();
            if (continuations) page.entries.push({ kind: 'continued', sceneId: scene.id, elementId: element.id, character: element.content.replace(/\s*\(CONT['’]D\)\s*$/i, ''), lines: 1, lineStart: page.usedLines++ });
          }
        }
        afterSpacing(layout.elements.dialogue.spaceAfterLines); index = cursor - 1; continue;
      }
    }
    const format = layout.elements[element.type]; let before = beforeSpacing(format.spaceBeforeLines);
    const minimum = element.type === 'scene_heading' ? wrapped.length + 2 : Math.min(2, wrapped.length);
    if (page.usedLines && capacity - page.usedLines < before + minimum) { nextPage(); before = 0; }
    let offset = 0;
    while (offset < wrapped.length) {
      const take = Math.min(wrapped.length - offset, capacity - page.usedLines - before);
      if (take <= 0) { nextPage(); before = 0; continue; }
      put(scene.id, element, wrapped.slice(offset, offset + take), before); offset += take; before = 0;
      if (offset < wrapped.length) nextPage();
    }
    afterSpacing(format.spaceAfterLines);
  }
  return pages;
}

export function scenePagination(pages: ScreenplayPage[], layout: ScreenplayLayout) {
  const result = new Map<string, { firstPage: number; lastPage: number; length: string; label: string; pageFraction: number }>();
  const spans = new Map<string, { firstPage: number; lastPage: number; start: number; end: number }>(); const capacity = pageLineCapacity(layout);
  for (const page of pages) for (const entry of page.entries) {
    const start = (page.number - 1) * capacity + entry.lineStart; const end = start + entry.lines;
    const span = spans.get(entry.sceneId); if (span) { span.lastPage = page.number; span.end = Math.max(span.end, end); } else spans.set(entry.sceneId, { firstPage: page.number, lastPage: page.number, start, end });
  }
  for (const [id, span] of spans) {
    const eighths = Math.max(1, Math.ceil((span.end - span.start) / capacity * 8)); const whole = Math.floor(eighths / 8); const fraction = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][eighths % 8]; const length = `${whole || !fraction ? whole : ''}${fraction} ${eighths === 8 ? 'page' : 'pages'}`;
    result.set(id, { firstPage: span.firstPage, lastPage: span.lastPage, length, pageFraction: (span.end - span.start) / capacity, label: `${span.firstPage === span.lastPage ? span.firstPage : `${span.firstPage}–${span.lastPage}`} · ${length}` });
  }
  return result;
}
