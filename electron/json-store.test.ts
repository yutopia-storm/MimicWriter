import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { readJson, writeJsonAtomic } from './json-store';

describe('versioned JSON persistence', () => {
  it('round-trips data and returns a cloned default for missing files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'story-json-')); const path = join(root, 'nested', 'state.json');
    const fallback = { schemaVersion: 1 as const, values: ['default'] };
    const missing = await readJson(path, fallback); missing.values.push('changed');
    expect(fallback.values).toEqual(['default']);
    await writeJsonAtomic(path, { schemaVersion: 1, values: ['saved'] });
    expect(await readJson(path, fallback)).toEqual({ schemaVersion: 1, values: ['saved'] });
    expect((await readFile(path, 'utf8')).endsWith('\n')).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
});
