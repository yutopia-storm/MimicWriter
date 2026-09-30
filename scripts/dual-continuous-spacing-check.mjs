import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
try {
  await page.goto(process.env.PREVIEW_URL ?? 'http://127.0.0.1:5174/');
  await page.evaluate(async () => {
    const { browserPreviewApi: api } = await import('/src/browser-api.ts');
    const { createElement } = await import('/src/domain/screenplay.ts');
    const { professionalLayout } = await import('/src/shared/screenplay-layout.ts');
    await api.configureStorage('Dual spacing test');
    const project = await api.createProject({ title: 'Dual spacing regression', projectType: 'feature' });
    const { screenplays: [script] } = await api.openWorkspace(project.id);
    script.layout = professionalLayout('a4');
    const element = (type, text) => createElement(type, text);
    const pair = (group, leftLong) => ['left', 'right'].flatMap(side => [
      { ...element('character', side === 'left' ? 'ZIDER' : 'SOLICITOR'), dualDialogue: { groupId: group, side, role: 'character' } },
      { ...element('dialogue', (side === 'left') === leftLong ? 'It says here I am not allowed to go near witnesses.' : 'She is exempt.'), dualDialogue: { groupId: group, side, role: 'dialogue' } },
    ]);
    script.scenes[0].elements = [element('scene_heading', 'EXT. COURT - DAY'), element('action', 'Zider exits with his solicitor, headphones on. Bail papers in his hand, checking his phone.'), element('action', 'Apple waits outside, leaning on her car.'), element('character', 'SOLICITOR'), element('dialogue', 'Your sister.'), ...pair('first', true), element('action', 'They reach Apple.'), ...pair('second', false), element('action', 'Marsha offers a hand.')].map((element, order) => ({ ...element, order }));
    await api.saveScreenplay(project.id, script);
  });
  await page.reload();
  await page.locator('.project-card').filter({ hasText: 'Dual spacing regression' }).first().click();
  await page.getByRole('button', { name: 'Continuous', exact: true }).click();
  const geometry = await page.evaluate(async () => {
    const { paginateScreenplay } = await import('/src/domain/pagination.ts');
    const scripts = JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'));
    const script = Object.values(scripts)[0];
    const sheet = document.querySelector('.continuous-paper-sheet').getBoundingClientRect();
    return paginateScreenplay(script, script.layout).flatMap(page => page.entries.filter(entry => entry.kind === 'element').map(entry => {
      const block = document.querySelector(`[data-element-id="${entry.element.id}"] .continuous-block-content`);
      const text = [...block.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.length);
      const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 1);
      return { type: entry.element.type, text: entry.element.content, line: entry.lineStart, actual: range.getBoundingClientRect().top, expected: sheet.top + (script.layout.topMarginMm + entry.lineStart * script.layout.fontSizePt * 25.4 / 72 * script.layout.lineHeight) * 96 / 25.4 };
    }));
  });
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({ path: '.artifacts/dual-continuous-spacing.png' });
  console.log(JSON.stringify(geometry, null, 2));
  for (const row of geometry) assert.ok(Math.abs(row.actual - row.expected) < 2, `Incorrect vertical position: ${JSON.stringify(row)}`);
  for (const mode of ['Screenplay', 'Scene']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    const aligned = await page.locator('[data-dual-group="first"].character').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    assert.ok(Math.abs(aligned[0] - aligned[1]) < 2, `${mode} dual cues misaligned`);
  }
  console.log('Passed: dual-dialogue spacing follows pagination with unequal columns, two groups, preceding and following prose; Screenplay and Scene cues stay aligned.');
} finally { await browser.close(); }
