import { describe, expect, it } from 'vitest';
import { migrateProject, type Build002ProjectRecord, type LegacyProjectRecord } from './project';

describe('project schema migration', () => {
  it('adds one principal screenplay to a legacy Feature project', () => {
    const legacy: LegacyProjectRecord = { schemaVersion: 1, id: crypto.randomUUID(), projectType: 'feature', title: 'Legacy', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { description: '' } };
    const result = migrateProject(legacy);
    expect(result.migrated).toBe(true); expect(result.project.schemaVersion).toBe(3);
    expect(result.project.screenplayId).toBe(result.createdScreenplays[0].id);
  });
  it('wraps flat Build 002 episodes in one deterministic Series/Season', () => { const id = crypto.randomUUID(); const episodeId = crypto.randomUUID(); const record: Build002ProjectRecord = { schemaVersion: 2, id, projectType: 'series', title: 'Legacy Series', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { description: '' }, series: { id: crypto.randomUUID(), title: 'Legacy Series', episodes: [{ id: episodeId, title: 'Pilot', order: 0, screenplayId: crypto.randomUUID(), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] } }; const first = migrateProject(record).project; const second = migrateProject(record).project; expect(first.series!.seasons[0].id).toBe(second.series!.seasons[0].id); expect(first.series!.seasons[0].episodes[0].id).toBe(episodeId); });
});
