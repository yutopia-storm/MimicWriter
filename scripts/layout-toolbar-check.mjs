import { _electron as electron } from "playwright";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const root = await mkdtemp(join(tmpdir(), "screenplay-layout-"));
const profile = join(root, "profile");
const storage = join(root, "storage");
await mkdir(join(process.cwd(), ".artifacts"), { recursive: true });
const app = await electron.launch({
  args: [".", `--user-data-dir=${profile}`],
});
const page = await app.firstWindow();
async function selectText(locator, start, end) {
  await locator.evaluate(
    (root, offsets) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      const point = (offset) => {
        let remaining = offset;
        for (const text of nodes) {
          if (remaining <= text.textContent.length) return [text, remaining];
          remaining -= text.textContent.length;
        }
        return [nodes.at(-1), nodes.at(-1).textContent.length];
      };
      const [startNode, startOffset] = point(offsets.start);
      const [endNode, endOffset] = point(offsets.end);
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      root.focus();
      root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    },
    { start, end },
  );
}
try {
  await page.getByPlaceholder("Choose a folder…").fill(storage);
  await page.getByRole("button", { name: "Use this folder" }).click();
  await page.getByRole("button", { name: /New Project/i }).click();
  await page.getByPlaceholder("Untitled story").fill("Layout Check");
  await page.getByRole("button", { name: /^Series/ }).click();
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /Layout Check/ }).click();
  await page.getByLabel("Episode title").fill("Pilot");
  await page.getByRole("button", { name: "Create episode" }).click();
  await page.getByLabel("Action").press("Tab");
  await page.getByLabel("Character").fill("MARA");
  await page.getByLabel("Character").press("Enter");
  await page.getByLabel("Dialogue").fill("Dialogue begins here.");
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByLabel("Paper size").selectOption("a4");
  await page.getByRole("button", { name: "Done" }).click();
  const pageBox = await page.locator(".screenplay-page").first().boundingBox();
  if (!pageBox || pageBox.width < 792 || pageBox.width > 796)
    throw new Error(`A4 physical page width is incorrect (${pageBox?.width}).`);
  const physicalSize = await page
    .locator(".paginated-pages")
    .evaluate((node) => [
      getComputedStyle(node).getPropertyValue("--page-width").trim(),
      getComputedStyle(node).getPropertyValue("--page-height").trim(),
    ]);
  if (physicalSize[0] !== "210mm" || physicalSize[1] !== "297mm")
    throw new Error(`A4 page proportions are incorrect (${physicalSize}).`);
  const characterBox = await page.getByLabel("Character").boundingBox();
  const dialogueBox = await page.getByLabel("Dialogue").boundingBox();
  const gap = dialogueBox.y - (characterBox.y + characterBox.height);
  if (gap > 4)
    throw new Error(`Character/Dialogue gap remains excessive (${gap}px).`);
  const toolbar = page.getByRole("toolbar", { name: "Screenplay formatting" });
  const toolbarBox = await toolbar.boundingBox();
  const episodeBox = await page.locator(".episode-quick-add").boundingBox();
  if (
    !toolbarBox ||
    !episodeBox ||
    toolbarBox.x + toolbarBox.width > episodeBox.x + 1
  )
    throw new Error("Toolbar is not immediately left of New Episode.");
  if (await page.locator(".screenplay-scroll .shared-format-toolbar").count())
    throw new Error("Formatting toolbar still floats in the writing area.");
  for (const name of [
    "Bold",
    "Italic",
    "Underline",
    "Strikethrough",
    "Text colour",
    "Text background colour",
    "Align Left",
    "Align Centre",
    "Align Right",
    "Justify",
    "Remove Formatting",
  ])
    if ((await toolbar.getByLabel(name, { exact: true }).count()) !== 1)
      throw new Error(`${name} control is missing.`);
  const dialogue = page.getByLabel("Dialogue");
  await selectText(dialogue, 0, 8);
  await toolbar.getByLabel("Bold", { exact: true }).click();
  await selectText(dialogue, 0, 8);
  await toolbar.getByLabel("Italic", { exact: true }).click();
  await selectText(dialogue, 0, 8);
  await toolbar.getByLabel("Underline", { exact: true }).click();
  await selectText(dialogue, 0, 8);
  await toolbar.getByLabel("Strikethrough", { exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Dialogue"] span')
        ?.getAttribute("style")
        ?.includes("line-through"),
    null,
    { timeout: 3_000 },
  );
  const style = await dialogue.locator("span").first().getAttribute("style");
  if (
    !style?.includes("font-weight") ||
    !style.includes("font-style") ||
    !style.includes("underline") ||
    !style.includes("line-through")
  )
    throw new Error(`Combined emphasis was not retained: ${style}`);
  const setColour = async (command, value) =>
    toolbar
      .locator(`input[data-format-command="${command}"]`)
      .evaluate((input, colour) => {
        input.value = colour;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
  await selectText(dialogue, 0, 8);
  await setColour("color", "#123456");
  await selectText(dialogue, 0, 8);
  await setColour("backgroundColor", "#fedcba");
  await page.waitForFunction(() => {
    const style = document.querySelector('[aria-label="Dialogue"] span')?.style;
    return (
      style?.color === "rgb(18, 52, 86)" &&
      style?.backgroundColor === "rgb(254, 220, 186)"
    );
  });
  await toolbar.getByLabel("Align Right", { exact: true }).click();
  if (
    (await dialogue.evaluate((element) => element.style.textAlign)) !== "right"
  )
    throw new Error(
      "Alignment command did not reach the active screenplay element.",
    );
  await selectText(dialogue, 0, 8);
  await toolbar.getByLabel("Remove Formatting", { exact: true }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector('[aria-label="Dialogue"] span')
        ?.getAttribute("style"),
  );
  await dialogue.press("Enter");
  await page.getByLabel("Action").last().press("Tab");
  await page.getByLabel("Character").last().fill("ZIDER");
  await page.getByLabel("Character").last().press("Enter");
  await page.getByLabel("Dialogue").last().fill("We can talk together.");
  await page.getByRole("button", { name: "Continuous", exact: true }).click();
  await page
    .locator(".speech-selector")
    .nth(0)
    .evaluate((button) => button.click());
  await page
    .locator(".speech-selector")
    .nth(1)
    .evaluate((button) => button.click());
  const selectedSpeeches = await page
    .locator('.speech-selector[aria-pressed="true"]')
    .count();
  if (selectedSpeeches !== 2)
    throw new Error(
      `Continuous speech selection failed (${selectedSpeeches} selected).`,
    );
  await page.getByRole("button", { name: "Make Dual Dialogue" }).click();
  if ((await page.locator("[data-dual-dialogue-id]").count()) !== 1)
    throw new Error(
      "Dual dialogue was unavailable in Continuous Writing View.",
    );
  await page.screenshot({
    path: join(process.cwd(), ".artifacts", "layout-toolbar-corrections.png"),
    fullPage: true,
  });
  const dualBox = await page.locator("[data-dual-dialogue-id]").boundingBox();
  const writingWidth = await page
    .locator(".script-pages")
    .first()
    .evaluate((node) => { const style = getComputedStyle(node); return node.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight); });
  if (!dualBox || dualBox.width > writingWidth + 1)
    throw new Error(
      `Dual dialogue exceeds the standard writing area (${dualBox?.width}px > ${writingWidth}px).`,
    );
  console.log(
    JSON.stringify(
      {
        pageWidth: pageBox.width,
        characterDialogueGap: gap,
        checks: [
          "A4 physical dimensions",
          "header toolbar position",
          "no floating toolbar",
          "complete control set",
          "combined emphasis",
          "text and background colours",
          "alignment",
          "remove formatting",
          "physical dual-dialogue bounds",
          "continuous dual dialogue",
        ],
        screenshot: ".artifacts/layout-toolbar-corrections.png",
      },
      null,
      2,
    ),
  );
} finally {
  if (!page.isClosed()) await page.close({ runBeforeUnload: false });
  await app.close();
}
