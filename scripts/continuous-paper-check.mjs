import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({ viewport: {width:1400,height:1000} });
const errors=[]; page.on('pageerror', e=>errors.push(e.message));
try {
 await page.goto(process.env.PREVIEW_URL ?? 'http://127.0.0.1:5175/');
 await page.evaluate(async(fixture)=>{
  const {browserPreviewApi:api}=await import('/src/browser-api.ts');
  await api.configureStorage('Pagination test'); const project=await api.createProject({title:'Pagination regression',projectType:'feature'});
  const {createElement}=await import('/src/domain/screenplay.ts');
  const {professionalLayout}=await import('/src/shared/screenplay-layout.ts');
  const records=JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'));
  const script=records[project.screenplayId]; script.layout=professionalLayout('letter');
  script.scenes[0].elements=[createElement('scene_heading','INT. ROOM - DAY',0),createElement('action','An action unfolds. '.repeat(350),1),createElement('character','AVA',2),createElement('dialogue','This dialogue continues across pages. '.repeat(160),3)];
  if(fixture === 'hard-breaks'){script.scenes[0].elements[1].content=Array(130).fill('An action line.').join('\n');script.scenes[0].elements[3].content=Array(180).fill('A dialogue line.').join('\n');}
  if(fixture === 'dual'){script.scenes[0].elements=[createElement('scene_heading','INT. ROOM - DAY',0),...['left','right'].flatMap((side,i)=>[{...createElement('character',side.toUpperCase(),1+i*2),dualDialogue:{groupId:'pair',side,role:'character'}},{...createElement('dialogue','Overlapping dialogue. '.repeat(side==='left'?200:140),2+i*2),dualDialogue:{groupId:'pair',side,role:'dialogue'}}])];}
  script.scenes.push({...script.scenes[0],id:crypto.randomUUID(),order:1,elements:[createElement('scene_heading','EXT. ROAD - DAY',0),createElement('action','End.',1)]});
  localStorage.setItem('screenplay-desktop.preview.screenplays',JSON.stringify(records));
 },process.env.PAGINATION_FIXTURE);
 await page.reload(); await page.getByRole('button',{name:/Pagination regression/}).click();
 await page.locator('.pagination-boundary').first().waitFor();
 const snapshot=()=>page.locator('.pagination-boundary').allTextContents(); const initial=await snapshot();
 if(initial.length<3) throw new Error('Missing boundaries');
 await page.getByRole('button',{name:'Continuous',exact:true}).click();
 if(JSON.stringify(await snapshot())!==JSON.stringify(initial)) throw new Error('Mode changed page boundaries');
 const verifyGeometry = async () => { const geometry = await page.evaluate(async()=>{
 const {paginateScreenplay}=await import('/src/domain/pagination.ts');const script=Object.values(JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays')))[0];
 const sheets=[...document.querySelectorAll('.continuous-paper-sheet')].map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom,right:n.getBoundingClientRect().right}));
 const entries=paginateScreenplay(script,script.layout,script.showDialogueContinuations !== false).flatMap(p=>p.entries.filter(e=>e.kind==='element').map(e=>{
 const block=document.querySelector('[data-element-id="'+e.element.id+'"] .continuous-block-content');const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,{acceptNode:n=>n.nodeType === Node.ELEMENT_NODE && n.nodeName !== 'BR' ? NodeFilter.FILTER_SKIP : n.parentElement.closest('.ProseMirror-widget')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let remaining=e.start,node;while(node=walker.nextNode()){if(node.nodeName === 'BR'){remaining--;continue;}if(remaining<node.textContent.length){const range=document.createRange();range.setStart(node,remaining);range.setEnd(node,remaining+1);return {page:p.number,type:e.element.type,line:e.lineStart,actual:range.getBoundingClientRect().top,expected:sheets[p.number-1].top+(script.layout.topMarginMm+e.lineStart*script.layout.fontSizePt*25.4/72)*96/25.4};}remaining-=node.textContent.length;}return null;
 }));return {sheets,entries};});for(const entry of geometry.entries.filter(Boolean)) if(Math.abs(entry.actual-entry.expected)>2) throw new Error('Text does not respect physical page position: '+JSON.stringify(entry));
 for(let i=1;i<geometry.sheets.length;i++) if(Math.abs(geometry.sheets[i].top-geometry.sheets[i-1].bottom-12)>1) throw new Error('Incorrect page gap');
 const numbers=await page.locator('.continuous-paper-number').allTextContents();if(numbers.some((text,i)=>text!==String(i+1)+'.'))throw new Error('Incorrect page numbering');
 console.log('Physical page positions, margins, gaps and numbering verified.'); }; await verifyGeometry();
 await page.locator('.pagination-boundary').first().evaluate(node=>node.scrollIntoView({block:'center'}));await page.screenshot({path:'.artifacts/continuous-paper.png'});
 if (!process.env.PAGINATION_FIXTURE) {
 await page.getByRole('button',{name:'Scene',exact:true}).click();
 if(JSON.stringify(await snapshot())!==JSON.stringify(initial)) throw new Error('Isolated scene changed boundaries');
 await page.getByRole('button',{name:'Screenplay',exact:true}).click();
 await page.getByRole('button',{name:'Continuous',exact:true}).click();
 const dialogue=page.locator('.continuous-block.dialogue');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays')));
 await dialogue.locator('.pagination-continued').first().evaluate(node=>{ const range=document.createRange();range.setStartAfter(node);range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range);node.closest('.ProseMirror').focus(); });
 await page.keyboard.type(' Added.');
 await page.waitForTimeout(900);
 await mkdir('.artifacts',{recursive:true}); await page.screenshot({path:'.artifacts/shared-pagination.png',fullPage:true});
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays')));
 const original=Object.values(before)[0].scenes[0].elements[3]; const edited=Object.values(after)[0].scenes[0].elements[3];
 if(edited.id!==original.id || edited.content.replace(' Added.','')!==original.content || edited.content.length!==original.content.length+7) throw new Error('Boundary typing changed identity or content');
 await dialogue.locator('.continuous-block-content').evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(range);});
 await page.keyboard.insertText('Short speech.'); await page.waitForTimeout(200);
 if(await page.locator('.pagination-more,.pagination-continued').count()) throw new Error('Stale continuation markers after shortening');
 await page.keyboard.press('Control+z');await page.waitForTimeout(200);
 if(!await page.locator('.pagination-more').count()) throw new Error('Undo failed to restore pagination');
 await page.getByRole('button',{name:'Layout',exact:true}).click();
 await page.getByLabel('Paper size').selectOption('a4'); await page.getByLabel('Close layout settings').click();
 if(JSON.stringify(await snapshot())===JSON.stringify(initial)) throw new Error('A4 did not reflow the screenplay');
 await page.waitForTimeout(900); await verifyGeometry();
 await page.getByRole('button',{name:'Layout',exact:true}).click();
 await page.getByLabel("Show MORE and CONT'D").uncheck(); await page.getByLabel('Close layout settings').click();
 if(await page.locator('.pagination-more,.pagination-continued').count()) throw new Error('Continuation preference ignored');
 await page.getByRole('button',{name:'Layout',exact:true}).click();await page.getByLabel('Top page margin (mm)',{exact:true}).fill('32');await page.getByLabel('Bottom page margin (mm)',{exact:true}).fill('30');await page.getByLabel('Close layout settings').click();await page.waitForTimeout(900);await verifyGeometry();
 const shapes=await page.locator('.pagination-boundary,.pagination-more,.pagination-continued').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,top:n.getBoundingClientRect().top,width:n.getBoundingClientRect().width})));
 console.log(JSON.stringify({initial,errors,shapes:shapes.slice(0,12), beforeCount:Object.keys(before).length},null,2));
 if(errors.length) throw new Error(errors.join('\n'));
}
} finally { await browser.close(); }

