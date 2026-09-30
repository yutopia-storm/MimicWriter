import { clipboard, ClipboardItem } from 'electron';
import { z } from 'zod';
import { SCREENPLAY_CLIPBOARD_MIME, type ClipboardRepresentations } from '../src/shared/clipboard';

export async function readScreenplayClipboard(): Promise<ClipboardRepresentations> {
  const result: ClipboardRepresentations = { text: '' };
  for (const item of await clipboard.read()) {
    for (const [mime, key] of [['text/plain', 'text'], ['text/html', 'html'], ['web ' + SCREENPLAY_CLIPBOARD_MIME, 'structured'], ['web application/x-finaldraft', 'fdx']] as const) {
      if (item.types.includes(mime)) { const payload = await item.getType(mime); if (payload instanceof Blob) result[key] = await payload.text(); }
    }
  }
  return result;
}
export async function writeScreenplayClipboard(value: unknown): Promise<void> {
  const data = z.object({ text: z.string(), html: z.string().optional(), structured: z.string().optional() }).parse(value);
  // Fixed MIME allowlist: renderer input cannot write file references or arbitrary native formats.
  await clipboard.write([new ClipboardItem({
    'text/plain': data.text,
    ...(data.html ? { 'text/html': data.html } : {}),
    ...(data.structured ? { ['web ' + SCREENPLAY_CLIPBOARD_MIME]: data.structured } : {}),
  })]);
}
