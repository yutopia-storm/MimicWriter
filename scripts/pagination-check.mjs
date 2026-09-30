import { _electron as electron } from "playwright";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const root = await mkdtemp(join(tmpdir(), "screenplay-pages-"));
const profile = join(root, "profile");
const storage = join(root, "storage");
const app = await electron.launch({
  args: [".", `--user-data-dir=${profile}`],
});
const page = await app.firstWindow();
try {
  await mkdir(join(process.cwd(), ".artifacts"), { recursive: true });
  await page.getByPlaceholder("Choose a folder…").fill(storage);
  await page.getByRole("button", { name: "Use this folder" }).click();
  await page.getByRole("button", { name: /New Project/i }).click();
  await page.getByPlaceholder("Untitled story").fill("Pagination Check");
  await page.getByRole("button", { name: /^Feature/ }).click();
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /Pagination Check/ }).click();
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByLabel("Paper size").selectOption("a4");
  await page.getByRole("button", { name: "Close layout settings" }).click();
  await page
    .getByRole("dialog", { name: "Advanced Screenplay Layout" })
    .waitFor({ state: "hidden" });
  await page.getByLabel("Action", { exact: true }).press("Tab");
  await page.getByLabel("Character", { exact: true }).fill("ZIDER");
  await page.waitForTimeout(100);
  await page.getByLabel("Character", { exact: true }).press("Enter");
  await page.waitForTimeout(300);
  const dialogue = page.getByLabel("Dialogue", { exact: true });
  if (!(await dialogue.count())) {
    const editors = await page.locator(".element-editor").evaluateAll((nodes) => nodes.map((node) => ({ label: node.getAttribute("aria-label"), text: node.textContent, lastKey: node.getAttribute("data-last-key") })));
    const suggestionLabels = await page.locator(".element-suggestions button").allTextContents();
    throw new Error(`Dialogue was not created. Editors: ${JSON.stringify(editors)} Suggestions: ${JSON.stringify(suggestionLabels)}`);
  }
  const original = Array.from(
    { length: 180 },
    (_, index) =>
      `This is uninterrupted dialogue line ${index + 1} crossing the physical page while preserving one structured element.`,
  ).join(" ");
  await dialogue.fill(original);
  await page.waitForFunction(
    () => document.querySelectorAll(".screenplay-page").length > 1,
  );
  if (
    (await page.locator(".page-more").count()) < 1 ||
    (await page.locator(".page-continued").count()) < 1
  )
    throw new Error(
      "Automatic MORE/CONT'D markers were not generated for split dialogue.",
    );
  if ((await page.getByLabel("Character").innerText()) !== "ZIDER")
    throw new Error("CONT'D altered the stored Character identity.");
  const firstMore = page.locator(".page-more").first();
  const outgoingPage = firstMore.locator("xpath=ancestor::section[contains(@class,'screenplay-page')]");
  const incomingCue = page.locator(".page-continued").first();
  const incomingPage = incomingCue.locator("xpath=ancestor::section[contains(@class,'screenplay-page')]");
  const [moreBox, outgoingBox, cueBox, incomingBox] = await Promise.all([firstMore.boundingBox(), outgoingPage.boundingBox(), incomingCue.boundingBox(), incomingPage.boundingBox()]);
  if (!moreBox || !outgoingBox || moreBox.y + moreBox.height > outgoingBox.y + outgoingBox.height - 80) { const fragments = await outgoingPage.locator(".page-element-fragment").evaluateAll((nodes) => nodes.map((node) => { const editor = node.querySelector(".element-editor"); const style = editor ? getComputedStyle(editor) : null; return { planned: node.getAttribute("data-planned-lines"), height: node.getBoundingClientRect().height, type: node.querySelector(".script-element")?.className, editorWidth: editor?.getBoundingClientRect().width, font: style?.font, lineHeight: style?.lineHeight }; })); throw new Error(`(MORE) is not inside the outgoing page writing area: ${JSON.stringify({ moreBox, outgoingBox, fragments })}`); }
  if (!cueBox || !incomingBox || cueBox.y - incomingBox.y > 130) throw new Error("CHARACTER (CONT'D) is not at the top of the following page writing area.");
  await firstMore.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.screenshot({
    path: join(process.cwd(), ".artifacts", "physical-pagination.png"),
    fullPage: false,
  });
  const lastDialogue = page.getByLabel("Dialogue").last();
  const lastFragmentText = await lastDialogue.innerText();
  await lastDialogue.fill(`${lastFragmentText.slice(0, -1)}z`);
  await page.waitForTimeout(200);
  if (!(await page.getByLabel("Dialogue").last().innerText()).endsWith("z"))
    throw new Error(
      "Editing did not remain continuous across the visual page boundary.",
    );
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByLabel("Show MORE and CONT'D").uncheck();
  await page.getByRole("button", { name: "Close layout settings" }).click();
  if (await page.locator(".page-more").count())
    throw new Error("Continuation markers remained visible when disabled.");
  await page.getByText(/Unsaved changes|Saving…/, { exact: true }).waitFor();
  await page.getByText("Saved", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /Pagination Check/ }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".screenplay-page").length > 1,
  );
  if (await page.locator(".page-more").count())
    throw new Error("Continuation preference did not persist.");
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByLabel("Paper size").selectOption("letter");
  await page.getByRole("button", { name: "Close layout settings" }).click();
  const size = await page
    .locator(".screenplay-page")
    .first()
    .evaluate((node) => [
      getComputedStyle(node.parentElement)
        .getPropertyValue("--page-width")
        .trim(),
      getComputedStyle(node.parentElement)
        .getPropertyValue("--page-height")
        .trim(),
    ]);
  if (size[0] !== "215.9mm" || size[1] !== "279.4mm")
    throw new Error(`US Letter physical geometry failed: ${size}`);
  console.log(
    JSON.stringify(
      {
        checks: [
          "dynamic physical pagination",
          "continuous cross-boundary editing",
          "MORE/CONT'D generated without data mutation",
          "continuation preference persisted",
          "A4 and US Letter presets",
        ],
        pages: await page.locator(".screenplay-page").count(),
      },
      null,
      2,
    ),
  );
} finally {
  if (!page.isClosed()) await page.close({ runBeforeUnload: false });
  await app.close();
}
