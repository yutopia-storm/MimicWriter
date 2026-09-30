import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
await mkdir('.artifacts',{recursive:true});
await build({entryPoints:['electron/clipboard.ts'],outfile:'.artifacts/clipboard-adapter.cjs',bundle:true,platform:'node',format:'cjs',external:['electron']});
await writeFile('.artifacts/native-clipboard-probe.cjs',`
const {app,clipboard,ClipboardItem}=require('electron');
const {readScreenplayClipboard,writeScreenplayClipboard}=require('./clipboard-adapter.cjs');
const assert=require('node:assert/strict');
app.whenReady().then(async()=>{
 const before=await Promise.all((await clipboard.read()).map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
 try {
  const data={text:'MARA\\n    (quietly)\\n    Stay here.',html:'<p>MARA</p><p><i>(quietly)</i></p><p>Stay here.</p>',structured:JSON.stringify({version:1,inline:false,scenes:[{elements:[{type:'character',content:'MARA'},{type:'parenthetical',content:'(quietly)'},{type:'dialogue',content:'Stay here.'}]}]})};
  await writeScreenplayClipboard(data);const result=await readScreenplayClipboard();
  assert.equal(result.text.replace(/\\r\\n/g,'\\n'),data.text);assert.equal(result.structured,data.structured);assert.ok(result.html.includes('(quietly)'));
  const types=(await clipboard.read()).flatMap(item=>item.types);assert.ok(types.includes('text/plain'));assert.ok(types.includes('text/html'));assert.ok(types.includes('web application/x-screenplay-fragment+json'));
  await clipboard.write([new ClipboardItem({'text/plain':'External text','text/html':'<p><b>External text</b></p>'})]);
  const external=await readScreenplayClipboard();assert.equal(external.structured,undefined);assert.ok(external.html.includes('<b>External text</b>'));
  console.log('Native OS clipboard passed: all three formats together, exact private roundtrip, parenthetical text/HTML, and external rich clipboard read.');
 }catch(error){console.error(error);process.exitCode=1;}finally{try{if(before.length)await clipboard.write(before);else clipboard.clear();}finally{app.quit();}}
});
`);
const child=spawn(join(process.cwd(),'node_modules/electron/dist/electron.exe'),['.artifacts/native-clipboard-probe.cjs'],{windowsHide:true,stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code??1;});
