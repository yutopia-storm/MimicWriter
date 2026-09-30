import type { ScreenplayElement, ScreenplayElementType, TextEmphasis, TextFormatRange } from '../shared/models';
import type { ClipboardRepresentations } from '../shared/clipboard';
import type { ScreenplayLayout } from '../shared/screenplay-layout';
import { wrapElement } from './pagination';

export type ClipboardElement = Omit<ScreenplayElement, 'id' | 'order'>;
export interface ScreenplayClipboard { version: 1; inline: boolean; scenes: { elements: ClipboardElement[] }[]; }
const types = new Set<ScreenplayElementType>(['scene_heading','action','character','dialogue','parenthetical','transition','shot','lyrics']);
const alignments = new Set(['left','center','right','justify']);
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const color = (value: unknown) => typeof value === 'string' && /^(#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d.,%\s]+\))$/i.test(value) ? value : undefined;
export function decodeStructured(value?: string): ScreenplayClipboard | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value); if (parsed.version !== 1 || !Array.isArray(parsed.scenes) || !parsed.scenes.length) return null;
    let count = 0;
    const scenes = parsed.scenes.map((scene: { elements: unknown[] }) => {
      if (!Array.isArray(scene.elements)) throw Error();
      const elements = scene.elements.map((raw: any): ClipboardElement => {
        if (!raw || !types.has(raw.type) || typeof raw.content !== 'string' || ++count > 100000) throw Error();
        const element: ClipboardElement = { type: raw.type, content: raw.content };
        if (alignments.has(raw.alignment)) element.alignment = raw.alignment;
        if (Array.isArray(raw.formatting)) element.formatting = raw.formatting.map((range: any) => {
          if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end > raw.content.length || range.end <= range.start) throw Error();
          const clean: TextFormatRange = { start: range.start, end: range.end };
          for (const key of ['bold','italic','underline','strike'] as const) if (range[key] === true) clean[key] = true;
          if (color(range.color)) clean.color = range.color; if (color(range.backgroundColor)) clean.backgroundColor = range.backgroundColor;
          return clean;
        });
        if (raw.dualDialogue && typeof raw.dualDialogue.groupId === 'string' && ['left','right'].includes(raw.dualDialogue.side) && ['character','parenthetical','dialogue'].includes(raw.dualDialogue.role)) element.dualDialogue = { groupId: raw.dualDialogue.groupId, side: raw.dualDialogue.side, role: raw.dualDialogue.role };
        return element;
      }); return { elements };
    });
    return count ? { version: 1, inline: parsed.inline === true, scenes } : null;
  } catch { return null; }
}
function richText(element: ClipboardElement) {
  const points = [...new Set([0,element.content.length,...(element.formatting ?? []).flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
  return points.slice(0,-1).map((start,index)=>{
    const end=points[index+1];const emphasis=Object.assign({},...(element.formatting??[]).filter(r=>r.start<=start&&r.end>=end)) as TextEmphasis;
    let text=escapeHtml(element.content.slice(start,end)).replace(/\n/g,'<br>');
    if(emphasis.bold)text=`<strong>${text}</strong>`;if(emphasis.italic)text=`<em>${text}</em>`;if(emphasis.underline)text=`<u>${text}</u>`;if(emphasis.strike)text=`<s>${text}</s>`;
    const styles=[color(emphasis.color)?`color:${emphasis.color}`:'',color(emphasis.backgroundColor)?`background-color:${emphasis.backgroundColor}`:''].filter(Boolean).join(';');
    return styles?`<span style="${styles}">${text}</span>`:text;
  }).join('');
}
export function encodeClipboard(payload: ScreenplayClipboard, layout: ScreenplayLayout): ClipboardRepresentations {
  const elements=payload.scenes.flatMap(s=>s.elements);const structured=JSON.stringify(payload);
  const html=`<div data-screenplay-clipboard="${escapeHtml(structured)}" style="font-family:Courier New,Courier,monospace;font-size:12pt">${elements.map(element=>{
    const bounds=layout.elements[element.type];const align=element.alignment??(element.type==='transition'?'right':element.type==='parenthetical'?'center':'left');
    return `<p data-screenplay-type="${element.type}" style="margin:0 0 12pt ${bounds.leftMm-layout.leftMarginMm}mm;width:${bounds.rightMm-bounds.leftMm}mm;text-align:${align};white-space:pre-wrap">${richText(element)||'<br>'}</p>`;
  }).join('')}</div>`;
  const text=payload.inline&&elements.length===1?elements[0].content:elements.map((element,index)=>{
    const left=element.type==='parenthetical'?Math.max(layout.elements.parenthetical.leftMm,layout.elements.dialogue.leftMm+layout.dualDialogue.parentheticalInsetMm):layout.elements[element.type].leftMm;
    const indent=' '.repeat(Math.max(0,Math.round((left-layout.leftMarginMm)/2.54)));
    const lines=wrapElement({...element,id:'clipboard',order:index},layout).map(line=>indent+element.content.slice(line.start,line.end).replace(/\n$/,'').trimEnd()).join('\n');
    const tight=['dialogue','parenthetical'].includes(element.type)&&index>0&&['character','dialogue','parenthetical'].includes(elements[index-1].type);
    return (index?(tight?'\n':'\n\n'):'')+lines;
  }).join('');
  return {text,html,structured};
}
interface Paragraph { text: string; formatting?: TextFormatRange[]; type?: ScreenplayElementType; alignment?: ScreenplayElement['alignment']; indent?: number; blankBefore?: boolean; continuationLine?: boolean; pagination?: boolean; }
const heading = /^(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT\.?|EXT\.?|I\/E\.?|EST\.)(?:\s|$)/i;
function explicitType(value: string | null): ScreenplayElementType | undefined {
  const key=(value??'').toLowerCase().replace(/[\s_-]+/g,'');
  return ({sceneheading:'scene_heading',slugline:'scene_heading',action:'action',character:'character',dialogue:'dialogue',parenthetical:'parenthetical',transition:'transition',shot:'shot',lyrics:'lyrics',lyric:'lyrics'} as Record<string,ScreenplayElementType>)[key];
}
function infer(paragraphs: Paragraph[], context: ScreenplayElementType): ScreenplayClipboard {
  const scenes: ScreenplayClipboard['scenes']=[];let elements: ClipboardElement[]=[];let previous: ScreenplayElementType=context;
  paragraphs.forEach((paragraph,index)=>{
    const text=paragraph.text.trim();if(!text)return;
    // Only unambiguous pagination furniture is discarded; ambiguous prose survives.
    if(paragraph.pagination||(/^\(MORE\)$/i.test(text)&&['dialogue','parenthetical'].includes(previous)))return;
    let type=paragraph.type;
    const next=paragraphs.slice(index+1).find(p=>p.text.trim());
    if(!type){
      if(heading.test(text))type='scene_heading';
      else if(/^(?:CUT TO:|DISSOLVE TO:|FADE (?:IN:|OUT\.?|TO BLACK\.?))$/i.test(text)||/^[A-Z \-]+ TO:$/.test(text))type='transition';
      else if(/^(?:CLOSE(?:\s|-)?UP|WIDE SHOT|ANGLE ON|POV|INSERT|BACK TO SCENE)(?:\b|:)/i.test(text))type='shot';
      else if(text.startsWith('~')||text.startsWith('♪'))type='lyrics';
      else if(/^\([\s\S]+\)$/.test(text)&&(['character','dialogue','parenthetical'].includes(previous)||(paragraph.indent??0)>0||paragraphs.length===1))type='parenthetical';
      else if(text.length<70&&/[A-Z]/.test(text)&&text===text.toUpperCase()&&!/[.!?:]$/.test(text)&&next&&!heading.test(next.text.trim())&&(!next.blankBefore||paragraph.indent||next.indent)&&(/[a-z]/.test(next.text)||/^\(/.test(next.text.trim())))type='character';
      else if(['character','parenthetical'].includes(previous)||(previous==='dialogue'&&!paragraph.blankBefore))type='dialogue';
      else type='action';
    }
    if(type==='scene_heading'&&elements.length){scenes.push({elements});elements=[];}
    const content=type==='character'?paragraph.text.replace(/\s*\(CONT['’]D\)\s*$/i,''):paragraph.text;
    if(paragraph.continuationLine && elements.at(-1)?.type===type && ['action','dialogue','lyrics'].includes(type)) { elements[elements.length-1].content += '\n' + content; previous=type; return; }
    elements.push({type,content,...(paragraph.formatting?.length?{formatting:paragraph.formatting.filter(r=>r.start<content.length).map(r=>({...r,end:Math.min(r.end,content.length)}))}:{}),...(paragraph.alignment?{alignment:paragraph.alignment}:{})});previous=type;
  });
  if(elements.length)scenes.push({elements});
  return {version:1,inline:paragraphs.length===1&&!paragraphs[0].type&&['action','dialogue'].includes(scenes[0]?.elements[0]?.type),scenes};
}
function plainParagraphs(text:string):Paragraph[]{
  const pages=text.replace(/\r\n?/g,'\n').split('\f');let blankBefore=true;
  const paragraphs:Paragraph[]=pages.flatMap(page=>{
    const lines=page.split('\n');const nonempty=lines.map((line,index)=>line.trim()?index:-1).filter(index=>index>=0);
    return lines.flatMap((line,index)=>{if(!line.trim()){blankBefore=true;return [];}const pagination=pages.length>1&&/^\d+\.?$/.test(line.trim())&&(index===nonempty[0]||index===nonempty.at(-1));const p={text:line.trim(),indent:line.match(/^\s*/)?.[0].length??0,blankBefore,continuationLine:!blankBefore,pagination};blankBefore=false;return[p];});
  });
  return paragraphs.flatMap((paragraph,index)=>{
    if(!paragraph.text)return [];
    if(paragraph.text.startsWith('(')&&!paragraph.text.endsWith(')')){
      let end=index+1;
      while(end<paragraphs.length&&!paragraphs[end].blankBefore&&!paragraphs[end].pagination){
        if(paragraphs[end].text.endsWith(')')){
          paragraph.text=paragraphs.slice(index,end+1).map(part=>part.text).join('\n');
          for(let consumed=index+1;consumed<=end;consumed++)paragraphs[consumed].text='';
          break;
        }
        end++;
      }
    }
    return [paragraph];
  });
}
function htmlParagraphs(html:string):Paragraph[]{
  const doc=new DOMParser().parseFromString(html,'text/html');
  const rules: { selector: string; style: CSSStyleDeclaration }[] = [];
  for (const sheet of doc.querySelectorAll('style')) for (const match of (sheet.textContent ?? '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of match[1].split(',').map(value => value.trim())) if (selector && /^(?:[a-z][\w-]*)?(?:\.[\w-]+)*$/i.test(selector)) {
      const style = doc.createElement('span').style; style.cssText = match[2]; rules.push({ selector, style });
    }
  }
  const stylesFor = (node: Element) => {
    const style = doc.createElement('span').style;
    const apply = (source: CSSStyleDeclaration) => { for (let index=0; index<source.length; index++) { const key=source.item(index); style.setProperty(key,source.getPropertyValue(key),source.getPropertyPriority(key)); } };
    for (const rule of rules) if (node.matches(rule.selector)) apply(rule.style);
    apply((node as HTMLElement).style); return style;
  };
  doc.querySelectorAll('script,style,meta,link,iframe,object,noscript,[data-page-number],.page-number,.page-header,.page-footer').forEach(node=>node.remove());
  const blockSelector='p,div,li,pre,h1,h2,h3,td';
  const candidates: Element[]=[];const parents=new Map<Element,Element[]>();
  const ancestors=(node:Element)=>{const result:Element[]=[];let parent=node.parentElement;while(parent){result.unshift(parent);parent=parent.parentElement;}return result;};
  const collect=(container:Element)=>{
    let inline:Node[]=[];
    const flush=()=>{if(!inline.length)return;const wrapper=container.cloneNode(false) as Element;inline.forEach(child=>wrapper.append(child.cloneNode(true)));if(wrapper.textContent?.trim()){candidates.push(wrapper);parents.set(wrapper,ancestors(container));}inline=[];};
    container.childNodes.forEach(child=>{
      if(child instanceof Element && child.querySelector(blockSelector)){flush();collect(child);}
      else if(child instanceof Element && child.matches(blockSelector)){flush();candidates.push(child);}
      else inline.push(child);
    });flush();
  };collect(doc.body);
  const emphasisFor=(current:Element,inherited:TextEmphasis)=>{
    const style=stylesFor(current);const tag=current.tagName;const emphasis={...inherited};
    if(style.fontWeight==='normal'||(style.fontWeight&&Number(style.fontWeight)<600))delete emphasis.bold;
    else if(['B','STRONG'].includes(tag)||style.fontWeight==='bold'||Number(style.fontWeight)>=600)emphasis.bold=true;
    if(style.fontStyle==='normal')delete emphasis.italic;
    else if(['I','EM'].includes(tag)||style.fontStyle==='italic')emphasis.italic=true;
    if(tag==='U'||style.textDecoration.includes('underline'))emphasis.underline=true;
    if(['S','STRIKE','DEL'].includes(tag)||style.textDecoration.includes('line-through'))emphasis.strike=true;
    if(color(style.color))emphasis.color=style.color;if(color(style.backgroundColor))emphasis.backgroundColor=style.backgroundColor;
    return emphasis;
  };
  return candidates.map(node=>{
    let text='';const formatting:TextFormatRange[]=[];
    const walk=(current:Node, inherited:TextEmphasis)=>{
      if(current.nodeType===Node.TEXT_NODE){const value=current.textContent??'';const start=text.length;text+=value;if(value&&Object.keys(inherited).length)formatting.push({...inherited,start,end:text.length});return;}
      if(!(current instanceof Element))return;if(current.tagName==='BR'){text+='\n';return;}
      const emphasis=emphasisFor(current,inherited);
      current.childNodes.forEach(child=>walk(child,emphasis));
    };walk(node,(parents.get(node)??ancestors(node)).reduce((style,parent)=>emphasisFor(parent,style),{} as TextEmphasis));
    const leading=text.length-text.trimStart().length;const trimmed=text.trim();const paragraphStyle=stylesFor(node);
    return {text:trimmed,formatting:formatting.map(r=>({...r,start:Math.max(0,r.start-leading),end:Math.min(trimmed.length,r.end-leading)})).filter(r=>r.end>r.start),type:explicitType(node.getAttribute('data-screenplay-type')??node.getAttribute('data-type')??node.className),alignment:alignments.has(paragraphStyle.textAlign)?paragraphStyle.textAlign as ScreenplayElement['alignment']:undefined,indent:parseFloat(paragraphStyle.marginLeft)||0};
  });
}
function fdxPayload(xml?:string):ScreenplayClipboard|null{
  if(!xml||!/<FinalDraft[\s>]/i.test(xml))return null;
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))return null;
  const content=[...doc.documentElement.children].find(node=>node.tagName==='Content');
  const paragraphs=[...(content?.querySelectorAll('Paragraph')??[])].map(node=>{
    let text='';const formatting:TextFormatRange[]=[];
    node.querySelectorAll('Text').forEach(part=>{const start=text.length;text+=part.textContent??'';const style=part.getAttribute('Style')??'';if(style)formatting.push({start,end:text.length,bold:/Bold/i.test(style),italic:/Italic/i.test(style),underline:/Underline/i.test(style)});});
    return {text,formatting,type:explicitType(node.getAttribute('Type'))};
  });return paragraphs.length?infer(paragraphs,'action'):null;
}
export function importClipboard(data:ClipboardRepresentations, context:ScreenplayElementType='action'):ScreenplayClipboard{
  const native=decodeStructured(data.structured);if(native)return native;
  const fdx=fdxPayload(data.fdx??data.text);if(fdx)return fdx;
  if(data.html){
    const doc=new DOMParser().parseFromString(data.html,'text/html');const embedded=decodeStructured(doc.querySelector('[data-screenplay-clipboard]')?.getAttribute('data-screenplay-clipboard')??undefined);if(embedded)return embedded;
    const rich=htmlParagraphs(data.html);if(rich.some(p=>p.text.trim()))return infer(rich,context);
  }
  return infer(plainParagraphs(data.text),context);
}
