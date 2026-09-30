import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(async (automatic) => {
    const { browserPreviewApi: api } = await import('/src/browser-api.ts');
    const { createElement } = await import('/src/domain/screenplay.ts');
    const { professionalLayout } = await import('/src/shared/screenplay-layout.ts');
    await api.configureStorage('Return regression');
    const project = await api.createProject({ title: 'Return regression', projectType: 'feature' });
    const records = JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays'));
    const script = records[project.screenplayId]; script.layout = professionalLayout('letter');
    script.scenes[0].elements = [createElement('scene_heading', 'INT. ROOM - DAY', 0), createElement('action', 'First paragraph.', 1), createElement('page_break', '', 2), createElement('action', 'Later page. '.repeat(1000), 3)];
    if (automatic) script.scenes[0].elements = script.scenes[0].elements.filter(element => element.type !== 'page_break');
    localStorage.setItem('screenplay-desktop.preview.screenplays', JSON.stringify(records));
  }, process.argv.includes('--automatic'));
  await page.reload(); await page.getByRole('button', { name: /Return regression/ }).click();
  await page.getByRole('button', { name: 'Continuous', exact: true }).click();
  const verify = async () => {
    await page.waitForTimeout(900);
    const result = await page.evaluate(async () => {
      const { paginateScreenplay } = await import('/src/domain/pagination.ts');
      const script = Object.values(JSON.parse(localStorage.getItem('screenplay-desktop.preview.screenplays')))[0];
      const sheets = [...document.querySelectorAll('.continuous-paper-sheet')].map(node => node.getBoundingClientRect().top);
      const entries = paginateScreenplay(script, script.layout).flatMap(p => p.entries.filter(e => e.kind === 'element').map(e => {
        const block = document.querySelector('[data-element-id="' + e.element.id + '"] .continuous-block-content');
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement.closest('.ProseMirror-widget') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        let remaining = e.start, node;
        while (node = walker.nextNode()) {
          if (remaining < node.textContent.length) {
            const range = document.createRange(); range.setStart(node, remaining); range.setEnd(node, remaining + 1);
            return { page: p.number, actual: range.getBoundingClientRect().top - sheets[p.number - 1], expected: (script.layout.topMarginMm + e.lineStart * script.layout.fontSizePt * 25.4 / 72) * 96 / 25.4 };
          }
          remaining -= node.textContent.length;
        }
        return null;
      })).filter(Boolean);
      return { entries, margin: getComputedStyle(document.querySelectorAll('.continuous-block.action')[1]).marginTop };
    });
    result.entries.forEach(entry => assert.ok(Math.abs(entry.actual - entry.expected) < 2, JSON.stringify(entry)));
    return result;
  };
  const before = await verify();
  const first = page.locator('.continuous-block.action').first();
  await first.locator('.continuous-block-content').click(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  const after = await verify(); assert.equal(after.margin, '16px', 'Return must leave exactly one blank screenplay line');
  assert.deepEqual(after.entries.filter(e => e.page > 1), before.entries.filter(e => e.page > 1), 'Earlier Return must not move later-page text within its paper');
  await page.keyboard.type('New paragraph.'); await page.keyboard.press('Enter');
  const twice = await verify(); assert.deepEqual(twice.entries.filter(e => e.page > 1), before.entries.filter(e => e.page > 1));
  await page.keyboard.press('Control+z'); await verify();
  await page.getByRole('button', { name: 'Layout', exact: true }).click(); await page.getByLabel('Paper size').selectOption('a4'); await page.getByLabel('Close layout settings').click(); await verify();
  assert.deepEqual(errors, []);
  console.log('Return spacing, fixed later-page origins, repeated edits, undo, A4 and Letter passed.');
} finally { await browser.close(); }
