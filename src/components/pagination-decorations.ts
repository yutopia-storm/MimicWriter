import type { Node as PMNode } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { scenePagination, screenplayElementBounds, type ScreenplayPage } from '../domain/pagination';
import { elementText } from '../domain/continuous-document';
import type { ScreenplayElement } from '../shared/models';
import type { ScreenplayLayout } from '../shared/screenplay-layout';

/** Presentation only: every offset, page and label comes from full-document pagination. */
export function paginationDecorations(doc: PMNode, pages: ScreenplayPage[], layout: ScreenplayLayout, physicalPages = false) {
  const decorations: Decoration[] = []; const positions = new Map<string, { pos: number; node: PMNode }>();
  const metadata = scenePagination(pages, layout);
  const geometry = new Map<string, ReturnType<typeof screenplayElementBounds>>();
  doc.forEach((scene, scenePos) => {
    let cue: ScreenplayElement | undefined; let firstDialogue = true;
    scene.forEach((node, offset) => {
      const a = node.attrs;
      const element: ScreenplayElement = { id:a.elementId, order:0, type:a.type, content:elementText(node), alignment:a.alignment, ...(a.dualGroup ? { dualDialogue:{groupId:a.dualGroup,side:a.dualSide,role:a.dualRole} } : {}) };
      if(element.type === 'character'){cue=element;firstDialogue=true;}
      else if(!['parenthetical','dialogue'].includes(element.type)){cue=undefined;firstDialogue=true;}
      const bounds = screenplayElementBounds(element,layout,cue); geometry.set(element.id,bounds);
      const origin = element.dualDialogue ? layout.dualDialogue[element.dualDialogue.side].leftMm : layout.leftMarginMm;
      const attrs: Record<string,string> = {};
      if(element.type === 'parenthetical' || element.dualDialogue) attrs.style = `width:${bounds.rightMm-bounds.leftMm}mm!important;margin-left:${bounds.leftMm-origin}mm!important;transform:none`;
      if(element.type === 'dialogue'){attrs['data-speech-first']=String(firstDialogue);firstDialogue=false;}
      if(Object.keys(attrs).length)decorations.push(Decoration.node(scenePos+1+offset,scenePos+1+offset+node.nodeSize,attrs));
    });
  });
  doc.descendants((node, pos) => {
    if (node.type.name === 'screenplay_element') positions.set(node.attrs.elementId, { pos, node });
    if (node.type.name === 'screenplay_scene') {
      const info = metadata.get(node.attrs.sceneId);
      if (info) decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-pagination': info.label, 'data-first-page': String(info.firstPage) }));
    }
  });
  const widget = (pos: number, key: string, className: string, text = '', style = '') => decorations.push(Decoration.widget(pos, () => {
    const span = document.createElement('span'); span.className = className; span.contentEditable = 'false'; span.setAttribute('aria-hidden', 'true'); span.style.cssText = style; span.textContent = text; if (className === 'pagination-boundary') span.dataset.pageNumber = text.replace('Page ', ''); return span;
  }, { key: `${key}:${text}:${style}`, side: -1, ignoreSelection: true }));
  const lineMm = layout.fontSizePt * 25.4 / 72 * layout.lineHeight;
  for (const page of pages) {
    let previousEnd = 0;
    let activeDualGroup: string | undefined;
    let columnEnds = { left: 0, right: 0 };
    const fragments = page.entries.filter(entry => entry.kind === 'element');
    const first = fragments[0];
    for (const entry of fragments) {
      const target = positions.get(entry.element.id); if (!target) continue;
      const position = target.pos + 1 + Math.min(entry.start, target.node.content.size);
      const bounds = geometry.get(entry.element.id) ?? layout.elements[entry.element.type];
      const left = bounds.leftMm - layout.leftMarginMm;
      const boundaryStyle = `margin-left:-${left}mm;width:${layout.pageWidthMm - layout.leftMarginMm - layout.rightMarginMm}mm`;
      const side = entry.element.dualDialogue?.side;
      const group = entry.element.dualDialogue?.groupId;
      if (group !== activeDualGroup) {
        activeDualGroup = group;
        // Both columns start after the same preceding block, not after one another.
        columnEnds = { left: previousEnd, right: previousEnd };
      }
      const firstInColumn = side ? fragments.find(item => item.element.dualDialogue?.side === side) : first;
      if (entry === firstInColumn && (entry === first || first?.element.dualDialogue?.groupId === entry.element.dualDialogue?.groupId) && page.number > 1) {
        const previous = pages[page.number - 2]; const more = previous.entries.find(item => item.kind === 'more' && item.sceneId === entry.sceneId && (!side || previous.entries.some(fragment => fragment.kind === 'element' && fragment.element.id === item.elementId && fragment.element.dualDialogue?.side === side)));
        if (more) widget(position, `more-${page.number}-${side ?? "single"}`, 'pagination-more', '(MORE)', `padding-left:${layout.elements.character.leftMm - bounds.leftMm}mm`);
        const lastLine = Math.max(0, ...previous.entries.map(item => item.lineStart + item.lines));
        const remainingMm = layout.pageHeightMm - layout.topMarginMm - lastLine * lineMm;
        const spacerStyle = physicalPages ? `;height:calc(${remainingMm + layout.topMarginMm}mm + var(--continuous-page-gap));` : '';
        widget(position, `page-${page.number}-${side ?? "single"}`, 'pagination-boundary', `Page ${page.number}`, boundaryStyle + spacerStyle);
        const cue = page.entries.find(item => item.kind === 'continued' && (!side || positions.get(item.elementId)?.node.attrs.dualSide === side));
        if (cue?.kind === 'continued') widget(position, `continued-${page.number}-${side ?? "single"}`, 'pagination-continued', `${cue.character} (CONT'D)`, `padding-left:${layout.elements.character.leftMm - bounds.leftMm}mm`);
      }
      if (entry.start === 0) {
        const startsPage = entry === first || (entry === firstInColumn && group !== undefined && first?.element.dualDialogue?.groupId === group);
        const priorEnd = side ? columnEnds[side] : previousEnd;
        const gapLines = startsPage ? (page.number === 1 ? entry.lineStart : 0) : Math.max(0, entry.lineStart - priorEnd);
        decorations.push(Decoration.node(target.pos, target.pos + target.node.nodeSize, { 'data-page-number': String(page.number), ...(physicalPages ? { style: `margin-top:${gapLines * lineMm}mm!important;margin-bottom:0!important` } : {}) }));
      }
      const end = entry.lineStart + entry.lines;
      if (side) {
        columnEnds[side] = end;
        // The next ordinary paragraph follows the taller of the two columns.
        previousEnd = Math.max(previousEnd, end);
      } else previousEnd = end;
      for (const line of entry.wrappedLines.slice(1)) {
        if (entry.element.content[line.start - 1] !== '\n') widget(target.pos + 1 + Math.min(line.start, target.node.content.size), `wrap-${entry.element.id}-${line.start}`, 'pagination-line-wrap');
      }
    }
  }
  return DecorationSet.create(doc, decorations);
}
