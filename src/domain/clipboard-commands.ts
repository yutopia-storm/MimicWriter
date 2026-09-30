import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import { AllSelection, TextSelection, type EditorState } from 'prosemirror-state';
import { closeHistory } from 'prosemirror-history';
import { continuousDocumentSchema as schema, elementText, formatting, textNodes } from './continuous-document';
import type { ScreenplayClipboard, ClipboardElement } from './screenplay-clipboard';

export function copyScreenplaySelection(state:EditorState):ScreenplayClipboard {
  const scenes:ScreenplayClipboard['scenes']=[];
  const slice=state.selection.content();let elements:ClipboardElement[]=[];
  slice.content.descendants(node=>{
    if(node.type===schema.nodes.screenplay_scene){if(elements.length)scenes.push({elements});elements=[];}
    if(node.type===schema.nodes.screenplay_element&&node.attrs.type!=='page_break'){
      const element:ClipboardElement={type:node.attrs.type,content:elementText(node)};const ranges=formatting(node);if(ranges.length)element.formatting=ranges;
      if(node.attrs.alignment)element.alignment=node.attrs.alignment;
      if(node.attrs.dualGroup)element.dualDialogue={groupId:node.attrs.dualGroup,side:node.attrs.dualSide,role:node.attrs.dualRole};elements.push(element);return false;
    }return true;
  });if(elements.length)scenes.push({elements});
  const { $from,$to }=state.selection;
  const inline=!(state.selection instanceof AllSelection)&&$from.sameParent($to)&&$from.parent.type===schema.nodes.screenplay_element&&($from.parentOffset>0||$to.parentOffset<$to.parent.content.size);
  return {version:1,inline,scenes};
}

/** Normalize only the inserted transaction, before persistence/history observe it. */
function normalizeDocument(doc:PMNode){
  const scenes:PMNode[]=[];const sceneIds=new Set<string>();const elementIds=new Set<string>();
  doc.forEach(scene=>{
    let children:PMNode[]=[];let sceneId=scene.attrs.sceneId;
    const flush=()=>{
      if(!children.length)return;
      if(!sceneId||sceneIds.has(sceneId))sceneId=crypto.randomUUID();sceneIds.add(sceneId);
      scenes.push(schema.nodes.screenplay_scene.create({...scene.attrs,sceneId,order:scene.attrs.order},children.map(node=>{
        let elementId=node.attrs.elementId;if(!elementId||elementIds.has(elementId))elementId=crypto.randomUUID();elementIds.add(elementId);
        return node.type.create({...node.attrs,elementId,sceneId},node.content,node.marks);
      })));children=[];
    };
    scene.forEach(node=>{if(node.attrs.type==='scene_heading'&&children.length){flush();sceneId=crypto.randomUUID();}children.push(node);});flush();
  });
  const normalized = scenes.map(scene => {
    const groups = new Map<string, PMNode[]>();
    scene.forEach(node => { if (node.attrs.dualGroup) groups.set(node.attrs.dualGroup, [...(groups.get(node.attrs.dualGroup) ?? []), node]); });
    const incomplete = new Set([...groups].filter(([,nodes]) => ['left','right'].some(side => ['character','dialogue'].some(type => (type === 'character' ? nodes.filter(node => node.attrs.dualSide === side && node.attrs.type === type).length !== 1 : !nodes.some(node => node.attrs.dualSide === side && node.attrs.type === type))))).map(([id]) => id));
    if (!incomplete.size) return scene;
    const children: PMNode[] = []; scene.forEach(node => children.push(incomplete.has(node.attrs.dualGroup) ? node.type.create({...node.attrs,dualGroup:null,dualSide:null,dualRole:null},node.content,node.marks) : node));
    return scene.type.create(scene.attrs,children);
  });
  return schema.node('doc',null,normalized);
}
export function pasteScreenplaySelection(state:EditorState,payload:ScreenplayClipboard){
  const groups=new Map<string,string>();
  const scenes=payload.scenes.filter(s=>s.elements.length).map(scene=>{
    const sceneId=crypto.randomUUID();
    return schema.nodes.screenplay_scene.create({sceneId},scene.elements.map(element=>{
      const dual=element.dualDialogue;if(dual&&!groups.has(dual.groupId))groups.set(dual.groupId,crypto.randomUUID());
      return schema.nodes.screenplay_element.create({elementId:crypto.randomUUID(),sceneId,type:element.type,alignment:element.alignment??null,dualGroup:dual?groups.get(dual.groupId):null,dualSide:dual?.side??null,dualRole:dual?.role??null},textNodes({...element,id:'clipboard',order:0}));
    }));
  });if(!scenes.length)return null;
  let tr=closeHistory(state.tr);
  if(payload.inline&&scenes.length===1&&scenes[0].childCount===1&&state.selection.$from.parent.type===schema.nodes.screenplay_element){
    tr=tr.replaceSelection(new Slice(scenes[0].firstChild!.content,0,0));
  }else{
    const slice=new Slice(Fragment.fromArray(scenes),1,1);
    // An empty editing placeholder should be replaced, not kept as a phantom row.
    if(state.selection.empty&&state.selection.$from.parent.type===schema.nodes.screenplay_element&&!state.selection.$from.parent.content.size){
      tr=tr.replaceRange(state.selection.$from.before(),state.selection.$from.after(),slice);
    }else tr=tr.replaceSelection(slice);
    const normalized=normalizeDocument(tr.doc);const cursor=tr.selection.from;
    tr=tr.replaceWith(0,tr.doc.content.size,normalized.content);
    tr=tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(cursor,tr.doc.content.size))));
  }
  return tr.setMeta('clipboard-operation','paste').scrollIntoView();
}
export function pastePlainText(state:EditorState,text:string){
  const children=text.replace(/\r\n?/g,'\n').split(/(\n)/).filter(Boolean).map(part=>part==='\n'?schema.nodes.hard_break.create():schema.text(part));
  let tr = closeHistory(state.tr).replaceSelection(new Slice(Fragment.fromArray(children),0,0));
  const normalized = normalizeDocument(tr.doc); const position = tr.selection.from;
  tr = tr.replaceWith(0, tr.doc.content.size, normalized.content);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(position, tr.doc.content.size)))).setMeta('clipboard-operation','paste-plain').scrollIntoView();
}
export function cutScreenplaySelection(state:EditorState){
  let tr = closeHistory(state.tr).deleteSelection();
  const normalized = normalizeDocument(tr.doc);
  const position = tr.selection.from;
  tr = tr.replaceWith(0, tr.doc.content.size, normalized.content);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(position, tr.doc.content.size)))).setMeta('clipboard-operation','cut').scrollIntoView();
}
