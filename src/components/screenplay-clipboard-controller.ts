import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { SCREENPLAY_CLIPBOARD_MIME, type ClipboardRepresentations } from '../shared/clipboard';
import { encodeClipboard, importClipboard } from '../domain/screenplay-clipboard';
import { copyScreenplaySelection, cutScreenplaySelection, pastePlainText, pasteScreenplaySelection } from '../domain/clipboard-commands';
import type { ScreenplayLayout } from '../shared/screenplay-layout';

export function installScreenplayClipboard(view:EditorView, layout:()=>ScreenplayLayout, report:(message:string)=>void) {
  const syncSelection = () => {
    const selection = window.getSelection(); if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode || !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return;
    const from = view.posAtDOM(selection.anchorNode, selection.anchorOffset), to = view.posAtDOM(selection.focusNode, selection.focusOffset);
    if (from >= 0 && to >= 0 && (Math.min(from,to) !== view.state.selection.from || Math.max(from,to) !== view.state.selection.to)) view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.doc.resolve(from),view.state.doc.resolve(to))));
  };
  const copy = (event:ClipboardEvent, cut:boolean) => {
    syncSelection(); if(view.state.selection.empty)return;
    const data=encodeClipboard(copyScreenplaySelection(view.state),layout());
    event.preventDefault(); event.stopImmediatePropagation();
    if(event.clipboardData){event.clipboardData.setData('text/plain',data.text);event.clipboardData.setData('text/html',data.html??'');event.clipboardData.setData(SCREENPLAY_CLIPBOARD_MIME,data.structured??'');}
    if (window.desktop.preferClipboardEvents && event.clipboardData) {
      if (cut) view.dispatch(cutScreenplaySelection(view.state));
      return;
    }
    const state=view.state;
    void window.desktop.writeClipboard(data).then(()=>{if(cut&&view.state===state)view.dispatch(cutScreenplaySelection(state));}).catch(()=>{
      // A native copy event already owns a synchronous OS clipboard write.
      if(event.clipboardData){if(cut&&view.state===state)view.dispatch(cutScreenplaySelection(state));}else report('Could not write to the clipboard. Your text has not been cut.');
    });
  };
  const paste=(data:ClipboardRepresentations,plain=false)=>{
    if(!data.text&&!data.html&&!data.structured&&!data.fdx)return;
    try {const tr=plain?pastePlainText(view.state,data.text):pasteScreenplaySelection(view.state,importClipboard(data,view.state.selection.$from.parent.attrs.type??'action')) ?? (data.text ? pastePlainText(view.state,data.text) : null);if(tr)view.dispatch(tr);}
    catch { if(data.text)view.dispatch(pastePlainText(view.state,data.text));else report('This clipboard content could not be read. Try copying it as plain text.'); }
  };
  const onCopy=(event:ClipboardEvent)=>copy(event,false);const onCut=(event:ClipboardEvent)=>copy(event,true);
  const onPaste=(event:ClipboardEvent)=>{
    syncSelection();
    event.preventDefault();event.stopImmediatePropagation();if(!event.clipboardData)return;
    const captured:ClipboardRepresentations={text:event.clipboardData.getData('text/plain'),html:event.clipboardData.getData('text/html'),structured:event.clipboardData.getData(SCREENPLAY_CLIPBOARD_MIME),fdx:event.clipboardData.getData('application/x-finaldraft')};
    if (window.desktop.preferClipboardEvents) { paste(captured); return; }
    const state=view.state;
    void window.desktop.readClipboard().then(native=>{
      if(view.isDestroyed || view.state!==state)return;
      const sameEntry=native.text===captured.text||(!captured.text&&!captured.html);
      paste(sameEntry?{...captured,structured:native.structured??captured.structured,fdx:native.fdx??captured.fdx,html:captured.html||native.html,text:captured.text||native.text}:captured);
    }).catch(()=>{if(!view.isDestroyed&&view.state===state)paste(captured);});
  };
  const readAndPaste=(plain=false)=>{const state=view.state;void window.desktop.readClipboard().then(data=>{if(!view.isDestroyed&&view.state===state)paste(data,plain);}).catch(()=>report('Could not read the clipboard. Please try again.'));};
  const onKey=(event:KeyboardEvent)=>{
    if(!(event.ctrlKey||event.metaKey))return;
    const key=event.key.toLowerCase();if(!['c','x','v'].includes(key))return;
    if(!event.shiftKey&&window.desktop.preferClipboardEvents)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(key==='v'){readAndPaste(event.shiftKey);return;}
    syncSelection();
    if(view.state.selection.empty)return;
    const state=view.state;const data=encodeClipboard(copyScreenplaySelection(state),layout());
    void window.desktop.writeClipboard(data).then(()=>{if(key==='x'&&!view.isDestroyed&&view.state===state)view.dispatch(cutScreenplaySelection(state));}).catch(()=>report('Could not write to the clipboard. Your text has not been cut.'));
  };
  const onPlain=()=>{if(view.hasFocus())readAndPaste(true);};
  view.dom.addEventListener('copy',onCopy,true);view.dom.addEventListener('cut',onCut,true);view.dom.addEventListener('paste',onPaste,true);view.dom.addEventListener('keydown',onKey,true);window.addEventListener('screenplay-paste-plain',onPlain);
  return ()=>{view.dom.removeEventListener('copy',onCopy,true);view.dom.removeEventListener('cut',onCut,true);view.dom.removeEventListener('paste',onPaste,true);view.dom.removeEventListener('keydown',onKey,true);window.removeEventListener('screenplay-paste-plain',onPlain);};
}
