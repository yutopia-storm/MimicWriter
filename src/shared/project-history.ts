import type { ProjectWorkspace, ScreenplayRecord } from './models';
import type { StoryRecord } from './story';
export const HISTORY_DEFAULTS = { recentlyClearedDays: 30, pageSize: 50, leaseMs: 90000, backupIntervalMs: 86400000 };
export interface WriterIdentity {
    id: string;
    deviceId: string;
    displayName: string;
    color: string;
}
export interface Collaborator {
    id: string;
    displayName: string;
    color: string;
    role: 'owner' | 'manager' | 'editor';
    canClearHistory?: boolean;
}
export interface HistoryTarget {
    type: string;
    id: string;
    screenplayId?: string;
    episodeId?: string;
    seriesId?: string;
    sceneId?: string;
    elementId?: string;
    worldId?: string;
}
export interface HistorySummary {
    id: string;
    projectId: string;
    actorId: string;
    startedAt: string;
    endedAt: string;
    operation: string;
    label: string;
    targets: HistoryTarget[];
    added: number;
    removed: number;
    clearedId?: string;
    clearedTargets?: Record<string, string>;
}
export interface HistoryPatch {
    path: string[];
    id?: string;
    index?: number;
    before?: unknown;
    after?: unknown;
}
export interface HistoryEntry extends HistorySummary {
    scope: 'screenplay' | 'story' | 'project';
    screenplayId?: string;
    patches: HistoryPatch[];
}
export interface HistoryQuery {
    screenplayId?: string;
    sceneId?: string;
    actorId?: string;
    objectId?: string;
    objectType?: string;
    since?: string;
    until?: string;
    offset?: number;
    limit?: number;
    recentlyCleared?: boolean;
    anchorSceneId?: string;
}
export interface HistoryBaseline {
    id: string;
    screenplayId: string;
    sceneId?: string;
    clearedAt: string;
    expiresAt: string;
    actorId: string;
    baseline: ScreenplayRecord;
}
export interface ProjectVersion {
    id: string;
    name: string;
    createdAt: string;
    actorId: string;
    protected: boolean;
    reason: 'named' | 'history_clear' | 'collaboration';
}
export interface HistoryPage {
    entries: HistorySummary[];
    total: number;
    offset?: number;
    collaborators: Collaborator[];
    cleared: Omit<HistoryBaseline, 'baseline'>[];
    versions: ProjectVersion[];
    warning?: string;
}
export type HistoryRequest = {
    action: 'query';
    query: HistoryQuery;
} | {
    action: 'entry';
    id: string;
} | {
    action: 'finish';
    screenplayId?: string;
    sceneId?: string;
} | {
    action: 'clear';
    screenplayId: string;
    sceneId?: string;
} | {
    action: 'recoverCleared';
    id: string;
} | {
    action: 'restore';
    id: string;
} | {
    action: 'createVersion';
    name: string;
} | {
    action: 'restoreVersion';
    id: string;
} | {
    action: 'compareVersion';
    id: string;
} | {
    action: 'collaborator';
    value: Collaborator;
} | {
    action: 'release';
} | {
    action: 'heartbeat';
};
export interface HistoryResult {
    page?: HistoryPage;
    entry?: HistoryEntry;
    workspace?: ProjectWorkspace;
    version?: ProjectVersion;
    comparison?: {
        version: ProjectWorkspace;
        current: ProjectWorkspace;
    };
    warning?: string;
}
export interface SaveContext {
    expectedRevision?: string;
    sceneId?: string;
}
export interface HistoryPort {
    read<T>(key: string, fallback: T): Promise<T>;
    write(key: string, value: unknown): Promise<void>;
    workspace(): Promise<ProjectWorkspace>;
    apply(scope: HistoryEntry['scope'], value: ScreenplayRecord | StoryRecord | ProjectWorkspace): Promise<void>;
}
