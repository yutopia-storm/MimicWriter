import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1400,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>(errors.push(e.message),console.log('ERROR',e.message)));
const html='<p>INT. GARAGE - NIGHT</p><p>A <b>bright</b> lamp.</p><p style="margin-left:180px">MARA</p><p>Wait.</p><p>(<i>quietly</i>)</p><p><u>Stay here.</u></p><p>CUT TO:</p><p>EXT. ROAD - DAY</p><p>Rain falls.</p>';
const getScript=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'))).find(s=>s.title==='Clipboard source'));
const setClipboard=async data=>page.evaluate(async data=>{await navigator.clipboard.write([new ClipboardItem(Object.fromEntries(Object.entries(data).map(([type,text])=>[type,new Blob([text],{type:type.startsWith('web ')?type.slice(4):type})])))]);},data);
try{
 await page.goto(process.env.PREVIEW_URL??'http://127.0.0.1:5174/');
 await page.evaluate(async()=>{const{browserPreviewApi:api}=await import('/src/browser-api.ts');await api.configureStorage('Clipboard checks');await api.createProject({title:'Clipboard source',projectType:'feature'});await api.createProject({title:'Clipboard destination',projectType:'feature'});});
 await page.reload();await page.getByRole('button',{name:/Clipboard source/}).click();
 await page.locator('.continuous-block.action').first().click();await setClipboard({'text/plain':'INT. GARAGE - NIGHT\nA bright lamp.\nMARA\nWait.\n(quietly)\nStay here.\nCUT TO:\nEXT. ROAD - DAY\nRain falls.','text/html':html});await page.keyboard.press('Control+v');await page.waitForTimeout(1100);
 const source=await getScript();assert.equal(source.scenes.filter(s=>s.elements.some(e=>e.type==='scene_heading'&&e.content)).length,2);
 const parenthetical=source.scenes.flatMap(s=>s.elements).find(e=>e.type==='parenthetical');assert.equal(parenthetical.content,'(quietly)');assert.deepEqual(parenthetical.formatting,[{start:1,end:8,italic:true}]);
 await page.keyboard.press('Control+a');await page.keyboard.press('Control+c');await page.waitForTimeout(300);
 const copied=await page.evaluate(async()=>{const data={};for(const item of await navigator.clipboard.read())for(const type of item.types)data[type]=await(await item.getType(type)).text();return data;});
 assert.ok(copied['text/html'].includes('data-screenplay-type="parenthetical"'));assert.ok(copied['web application/x-screenplay-fragment+json']);assert.ok(!/scene-toolbar|pagination-boundary|SCENE 1/.test(copied['text/html']));assert.match(copied['text/plain'],/\n +\(quietly\)/);
 await page.reload();await page.getByRole('button',{name:/Clipboard destination/}).click();await page.getByRole('button',{name:'Scene',exact:true}).click();
 const destBefore=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'))).find(s=>s.title==='Clipboard destination'));
 await page.locator('.continuous-block.action').first().click();await page.keyboard.press('Control+a');await page.keyboard.press('Control+v');await page.waitForTimeout(1100);
 const destination=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'))).find(s=>s.title==='Clipboard destination'));
 const content=record=>record.scenes.flatMap(s=>s.elements).map(({id,order,character,...e})=>e);
 assert.deepEqual(content(destination),content(source));assert.ok(destination.scenes.every(s=>!source.scenes.some(a=>s.id===a.id))||destination.scenes[0].id===destBefore.scenes[0].id);
 await page.keyboard.press('Control+z');await page.waitForTimeout(1100);
 const undone=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'))).find(s=>s.title==='Clipboard destination'));
 assert.deepEqual(undone.scenes,destBefore.scenes);
 await page.locator('.continuous-block.action').first().click();await setClipboard({'text/plain':'(plain text)','text/html':'<p><b>(plain text)</b></p>'});await page.keyboard.press('Control+Shift+v');await page.waitForTimeout(1100);
 const plain=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'))).find(s=>s.title==='Clipboard destination'));
 assert.equal(plain.scenes[0].elements[1].content,'(plain text)');assert.equal(plain.scenes[0].elements[1].type,'action');assert.equal(plain.scenes[0].elements[1].formatting,undefined);
 assert.deepEqual(errors,[]);console.log('Browser clipboard: external HTML, parenthetical formatting, three copy formats, cross-project Scene Mode paste, single undo, and plain-text paste passed.');
}finally{await browser.close();}


