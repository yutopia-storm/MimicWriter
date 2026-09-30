import type { EpisodeRecord, ProjectRecord, ScreenplayRecord, SeasonRecord } from '../shared/models';
import { createScreenplay } from './screenplay';

export interface LegacyProjectRecord {
  schemaVersion: 1; id: string; projectType: 'feature' | 'series'; title: string; createdAt: string; updatedAt: string;
  metadata: { description: string }; series?: { id: string; title: string; episodes: EpisodeRecord[] };
}
export interface Build002ProjectRecord {
  schemaVersion: 2; id: string; projectType: 'feature' | 'series'; title: string; createdAt: string; updatedAt: string;
  metadata: { description: string }; screenplayId?: string; series?: { id: string; title: string; episodes: EpisodeRecord[] };
}
export type StoredProjectRecord = LegacyProjectRecord | Build002ProjectRecord | ProjectRecord;

function firstSeason(project: Build002ProjectRecord): SeasonRecord {
  return { id: `season-${project.series!.id}`, order: 0, title: '', episodes: project.series!.episodes.map((episode, order) => ({ ...episode, order })), createdAt: project.createdAt, updatedAt: project.updatedAt };
}

export function migrateProject(record: StoredProjectRecord): { project: ProjectRecord; createdScreenplays: ScreenplayRecord[]; migrated: boolean; fromVersion: number } {
  if (record.schemaVersion === 3) return { project: record, createdScreenplays: [], migrated: false, fromVersion: 3 };
  if (record.schemaVersion === 1) {
    if (record.projectType === 'feature') {
      const screenplay = createScreenplay({ projectId: record.id, title: record.title, screenplayType: 'feature' }, record.createdAt);
      const { series: _series, ...base } = record; return { project: { ...base, schemaVersion: 3, documentFormat: 'screenplay', screenplayId: screenplay.id }, createdScreenplays: [screenplay], migrated: true, fromVersion: 1 };
    }
    const seriesId = record.series?.id ?? crypto.randomUUID();
    const v2: Build002ProjectRecord = { ...record, schemaVersion: 2, series: { id: seriesId, title: record.series?.title ?? record.title, episodes: record.series?.episodes ?? [] } };
    return { project: { ...v2, schemaVersion: 3, documentFormat: 'screenplay', series: { id: seriesId, title: v2.series!.title, seasons: [firstSeason(v2)] } }, createdScreenplays: [], migrated: true, fromVersion: 1 };
  }
  if (record.schemaVersion === 2) {
    if (record.projectType === 'feature') { const { series: _series, ...base } = record; return { project: { ...base, schemaVersion: 3, documentFormat: 'screenplay' }, createdScreenplays: [], migrated: true, fromVersion: 2 }; }
    if (!record.series) throw new Error('Series project structure is missing.');
    return { project: { ...record, schemaVersion: 3, documentFormat: 'screenplay', series: { id: record.series.id, title: record.series.title, seasons: [firstSeason(record)] } }, createdScreenplays: [], migrated: true, fromVersion: 2 };
  }
  throw new Error('This project uses an unsupported schema version.');
}

export function normalizeSeries(project: ProjectRecord): ProjectRecord {
  if (!project.series) return project;
  return { ...project, series: { ...project.series, seasons: project.series.seasons.map((season, order) => ({ ...season, order, episodes: season.episodes.map((episode, episodeOrder) => ({ ...episode, order: episodeOrder })) })) } };
}

export function allEpisodes(project: ProjectRecord) { return project.series?.seasons.flatMap((season) => season.episodes) ?? []; }
