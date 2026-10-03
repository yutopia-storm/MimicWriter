import type { ProjectWorkspace, ScreenplayRecord } from '../shared/models';
import type { StoryRecord } from '../shared/story';
import { HISTORY_DEFAULTS, type Collaborator, type HistoryEntry, type HistoryPatch, type HistoryPort, type HistoryQuery, type HistoryRequest, type HistoryResult, type HistorySummary, type HistoryTarget, type HistoryBaseline, type ProjectVersion, type WriterIdentity } from '../shared/project-history';
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const meaningful = (v: any): any => Array.isArray(v) ? v.map(meaningful) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !['updatedAt', 'storageRevision'].includes(k)).map(([k, value]) => [k, meaningful(value)])) : v;
const same = (a: unknown, b: unknown) => equal(meaningful(a), meaningful(b));
function patchValue(value: any, patch: HistoryPatch) {
    let owner = value;
    for (const part of patch.path) {
        owner = Array.isArray(owner) ? owner.find((v: any) => v.id === part) : owner?.[part];
    }
    return patch.id ? owner?.find((v: any) => (v.id ?? v.sceneId) === patch.id) : owner;
}
const targetKey = (t: HistoryTarget) => [t.type, t.id, t.screenplayId ?? '', t.sceneId ?? ''].join(':');
const clone = <T>(v: T): T => structuredClone(v);
export function canonicalState(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(canonicalState).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.entries(value).filter(([k, v]) => k !== 'storageRevision' && v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonicalState(v)).join(',') + '}';
    return JSON.stringify(value);
}
export async function stateRevision(value: unknown): Promise<string> { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalState(value))); return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join(''); }
interface Control {
    schemaVersion: 1;
    collaborators: Collaborator[];
    index: HistorySummary[];
    pending: HistoryEntry[];
    cleared: Omit<HistoryBaseline, 'baseline'>[];
    versions: ProjectVersion[];
}
export function applyHistoryPatches<T>(value: T, patches: HistoryPatch[], side: 'before' | 'after'): T {
    const result = clone(value) as any;
    for (const patch of patches) {
        let owner = result;
        for (const part of patch.path.slice(0, -1)) {
            owner = Array.isArray(owner) ? owner.find((v: any) => v.id === part) : owner[part];
            if (!owner)
                throw Error('A containing entry is no longer available. Restore its container first.');
        }
        const key = patch.path.at(-1)!;
        const next = patch[side];
        if (patch.id) {
            const array = owner[key] ?? [];
            const index = array.findIndex((v: any) => (v.id ?? v.sceneId) === patch.id);
            if (index >= 0) {
                if (next === undefined)
                    array.splice(index, 1);
                else
                    array[index] = clone(next);
            }
            else if (next !== undefined)
                array.splice(Math.min(patch.index ?? array.length, array.length), 0, clone(next));
            owner[key] = array;
        }
        else if (next === undefined)
            delete owner[key];
        else
            owner[key] = clone(next);
    }
    return result as T;
}
function recordPatches(before: any[], after: any[], path: string[]): HistoryPatch[] { return [...new Set([...before, ...after].map(e => e.id ?? e.sceneId))].flatMap(id => { const a = before.find(e => (e.id ?? e.sceneId) === id), b = after.find(e => (e.id ?? e.sceneId) === id); return same(a, b) ? [] : [{ path, id, index: before.findIndex(e => (e.id ?? e.sceneId) === id), before: a, after: b }]; }); }
export function storyPatches(before: StoryRecord, after: StoryRecord): HistoryPatch[] {
    const patches: HistoryPatch[] = [];
    for (const key of ['characters', 'locations', 'events', 'plots', 'scenes', 'relationships', 'worldOccurrences'] as const)
        patches.push(...recordPatches(before[key] ?? [], after[key] ?? [], [key]));
    const prior = before.worlds ?? [], next = after.worlds ?? [];
    for (const id of new Set([...prior, ...next].map(w => w.id))) {
        const a = prior.find(w => w.id === id), b = next.find(w => w.id === id);
        if (!a || !b) {
            patches.push({ path: ['worlds'], id, before: a, after: b, index: prior.findIndex(w => w.id === id) });
            continue;
        }
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (['entities', 'relationships'].includes(key))
                patches.push(...recordPatches((a as any)[key] ?? [], (b as any)[key] ?? [], ['worlds', id, key]));
            else if (!equal((a as any)[key], (b as any)[key]))
                patches.push({ path: ['worlds', id, key], before: (a as any)[key], after: (b as any)[key] });
        }
    }
    for (const key of ['worldUi', 'appearanceOverrides', 'identityMerges'] as const)
        if (!equal((before as any)[key], (after as any)[key]))
            patches.push({ path: [key], before: (before as any)[key], after: (after as any)[key] });
    return patches;
}
function screenplayPatches(before: ScreenplayRecord, after: ScreenplayRecord): HistoryPatch[] {
    const patches = recordPatches(before.scenes, after.scenes, ['scenes']);
    patches.push(...recordPatches(before.notes ?? [], after.notes ?? [], ['notes']));
    for (const key of ['title', 'layout', 'showDialogueContinuations'] as const)
        if (!equal(before[key], after[key]))
            patches.push({ path: [key], before: before[key], after: after[key] });
    if (!equal(before.scenes.map(s => s.id), after.scenes.map(s => s.id)))
        patches.push({ path: ['sceneOrder'], before: before.scenes.map(s => s.id), after: after.scenes.map(s => s.id) });
    return patches;
}
function counts(patches: HistoryPatch[]) {
    const text = (v: any): string => v?.elements ? v.elements.map((e: any) => e.content).join('\n') : typeof v === 'string' ? v : '';
    let added = 0, removed = 0;
    for (const p of patches) {
        const a = text(p.before), b = text(p.after);
        let start = 0, end = 0;
        while (start < Math.min(a.length, b.length) && a[start] === b[start])
            start++;
        while (end < Math.min(a.length, b.length) - start && a[a.length - 1 - end] === b[b.length - 1 - end])
            end++;
        added += b.length - start - end;
        removed += a.length - start - end;
    }
    return { added, removed };
}
export class ProjectHistory {
    warning = '';
    constructor(private port: HistoryPort, private actor: WriterIdentity, private projectId: string) { }
    private async control(): Promise<Control> {
        const c = await this.port.read<Control>('control', { schemaVersion: 1, collaborators: [{ ...this.actor, role: 'owner' }], index: [], pending: [], cleared: [], versions: [] });
        if (c.schemaVersion !== 1)
            throw Error('This History format is not supported.');
        return c;
    }
    private canManage(c: Control) {
        const member = c.collaborators.find(v => v.id === this.actor.id);
        if (member?.role !== 'owner' && !(member?.role === 'manager' && member.canClearHistory))
            throw Error('The project owner or an authorised manager must do this.');
    }
    private async persist(c: Control) { await this.port.write('control', c); }
    private targets(patches: HistoryPatch[], workspace: ProjectWorkspace, screenplay?: ScreenplayRecord): HistoryTarget[] { return patches.map(p => { const value = (p.after ?? p.before) as any; const key = p.path.at(-1)!; const sceneId = key === 'scenes' ? p.id : value?.sceneId ?? value?.occursInSceneId; const document = screenplay ?? workspace.screenplays.find(d => d.scenes.some(s => s.id === sceneId) || (p.path[0] === 'screenplays' && d.id === (p.path[1] ?? p.id))); return { type: key === 'scenes' && screenplay ? 'scene' : key === 'characters' ? 'character' : key === 'locations' ? 'location' : key === 'events' ? 'event' : key === 'plots' ? 'plot' : p.path[0] === 'worlds' ? value?.kind ?? 'world' : key, id: p.id ?? (p.path[0] === 'worlds' ? p.path[1] : document?.id) ?? workspace.project.id, screenplayId: document?.id, episodeId: document?.episodeId, seriesId: workspace.project.series?.id, sceneId, worldId: p.path[0] === 'worlds' ? p.path.length > 1 ? p.path[1] : p.id : undefined, elementId: value?.elements?.find((e: any) => !equal(e, ((p.before as any)?.elements ?? []).find((old: any) => old.id === e.id)))?.id }; }); }
    private async entry(scope: HistoryEntry['scope'], patches: HistoryPatch[], workspace: ProjectWorkspace, screenplay?: ScreenplayRecord, operation = 'changed'): Promise<HistoryEntry> { const targets = this.targets(patches, workspace, screenplay), now = new Date().toISOString(); const first = (patches[0]?.after ?? patches[0]?.before) as any; return { id: crypto.randomUUID(), projectId: this.projectId, actorId: this.actor.id, startedAt: now, endedAt: now, operation, label: operation === 'restored' ? 'Restored previous work' : operation === 'structure' && scope === 'screenplay' ? (patches[0]?.before === undefined ? 'Created Scene' : patches[0]?.after === undefined ? 'Deleted Scene' : 'Changed Scene structure') : scope === 'screenplay' ? 'Edited ' + (targets.length === 1 ? 'Scene' : 'screenplay') : (!patches[0]?.before ? 'Added ' : !patches[0]?.after ? 'Deleted ' : 'Changed ') + (first?.name ?? targets[0]?.type ?? 'project'), targets, scope, screenplayId: screenplay?.id, patches, ...counts(patches) }; }
    private async append(c: Control, e: HistoryEntry) { await this.port.write('entries/' + e.id, e); const { patches: _patches, scope: _scope, screenplayId: _screenplay, ...summary } = e; c.index = [summary, ...c.index.filter(v => v.id !== e.id)]; }
    private async finishInto(c: Control, screenplayId?: string, sceneId?: string) {
        for (const e of c.pending.filter(e => (!screenplayId || e.screenplayId === screenplayId) && (!sceneId || e.targets.some(t => t.sceneId === sceneId))))
            if (e.patches.some(p => !same(p.before, p.after)))
                await this.append(c, { ...e, endedAt: new Date().toISOString(), ...counts(e.patches) });
        c.pending = c.pending.filter(e => (!!screenplayId && e.screenplayId !== screenplayId) || (!!sceneId && !e.targets.some(t => t.sceneId === sceneId)));
    }
    async screenplay(before: ScreenplayRecord, after: ScreenplayRecord, focusSceneId?: string) {
        const patches = screenplayPatches(before, after);
        if (!patches.length)
            return;
        const c = await this.control(), workspace = await this.port.workspace();
        const structural = patches.some(p => p.path[0] !== 'scenes' || p.before === undefined || p.after === undefined);
        if (structural) {
            await this.finishInto(c, after.id);
            await this.append(c, await this.entry('screenplay', patches, workspace, after, 'structure'));
        }
        else
            for (const patch of patches) {
                if (c.pending.some(e => e.screenplayId === after.id && e.targets[0]?.sceneId !== patch.id))
                    await this.finishInto(c, after.id);
                let pending = c.pending.find(e => e.screenplayId === after.id && e.targets[0]?.sceneId === patch.id);
                if (pending) {
                    pending.patches[0].after = patch.after;
                    pending.endedAt = new Date().toISOString();
                    Object.assign(pending, counts(pending.patches));
                }
                else {
                    pending = await this.entry('screenplay', [patch], workspace, after);
                    pending.label = 'Edited ' + [...new Set(((patch.after as any)?.elements ?? []).filter((e: any) => !same(e, ((patch.before as any)?.elements ?? []).find((v: any) => v.id === e.id))).map((e: any) => e.type.replace('_', ' ')))].join(' and ');
                    c.pending.push(pending);
                }
                if (focusSceneId && patch.id !== focusSceneId)
                    await this.finishInto(c, after.id);
            }
        await this.persist(c);
    }
    async story(before: StoryRecord, after: StoryRecord) {
        const patches = storyPatches(before, after);
        if (!patches.length)
            return;
        const c = await this.control();
        await this.append(c, await this.entry('story', patches, await this.port.workspace()));
        await this.persist(c);
    }
    async project(before: ProjectWorkspace, after: ProjectWorkspace) {
        if (same(before.project, after.project))
            return;
        const patches: HistoryPatch[] = [];
        for (const key of ['title', 'metadata', 'series', 'screenplayId'] as const)
            if (!same(before.project[key], after.project[key]))
                patches.push({ path: ['project', key], before: before.project[key], after: after.project[key] });
        for (const id of new Set([...before.screenplays, ...after.screenplays].map(d => d.id))) {
            const a = before.screenplays.find(d => d.id === id), b = after.screenplays.find(d => d.id === id);
            if (!a || !b)
                patches.push({ path: ['screenplays'], id, index: before.screenplays.findIndex(d => d.id === id), before: a, after: b });
            else if (a.title !== b.title)
                patches.push({ path: ['screenplays', id, 'title'], before: a.title, after: b.title });
        }
        const c = await this.control();
        await this.append(c, await this.entry('project', patches, after, undefined, 'structure'));
        await this.persist(c);
    }
    async query(query: HistoryQuery) { const c = await this.control(), match = (e: HistorySummary) => (!query.actorId || e.actorId === query.actorId) && (!query.since || e.endedAt >= query.since) && (!query.until || e.endedAt <= query.until) && e.targets.some(t => (!query.screenplayId || t.screenplayId === query.screenplayId || (!query.sceneId && !t.screenplayId)) && (!query.sceneId || t.sceneId === query.sceneId) && (!query.objectId || t.id === query.objectId) && (!query.objectType || t.type === query.objectType) && (!!(e.clearedId || e.clearedTargets?.[targetKey(t)] || (!t.screenplayId&&query.screenplayId&&e.clearedTargets?.[query.screenplayId+':'+targetKey(t)])) === !!query.recentlyCleared)); const all = [...c.pending.map(({ patches: _p, scope: _s, screenplayId: _d, ...e }) => ({ ...e, label: e.label + ' · Editing' })), ...c.index].filter(match).sort((a, b) => b.endedAt.localeCompare(a.endedAt)); const limit = Math.min(100, query.limit ?? HISTORY_DEFAULTS.pageSize), anchor = query.anchorSceneId ? all.findIndex(e => e.targets.some(t => t.sceneId === query.anchorSceneId)) : -1, offset = anchor >= 0 ? Math.floor(anchor / limit) * limit : query.offset ?? 0; return { entries: all.slice(offset, offset + limit), offset, total: all.length, collaborators: c.collaborators, cleared: c.cleared, versions: c.versions, warning: this.warning || undefined }; }
    private async version(c: Control, name: string, reason: ProjectVersion['reason']) { const version: ProjectVersion = { id: crypto.randomUUID(), name, reason, createdAt: new Date().toISOString(), actorId: this.actor.id, protected: true }; await this.port.write('versions/' + version.id, { version, workspace: await this.port.workspace() }); c.versions.push(version); return version; }
    async request(request: HistoryRequest): Promise<HistoryResult> {
        const c = await this.control();
        if (request.action === 'heartbeat')
            return {};
        if (request.action === 'query')
            return { page: await this.query(request.query) };
        if (request.action === 'entry') {
            const pending = c.pending.find(e => e.id === request.id);
            return { entry: pending ?? await this.port.read<HistoryEntry | undefined>('entries/' + request.id, undefined) };
        }
        if (request.action === 'finish' || request.action === 'release') {
            await this.finishInto(c, request.action === 'finish' ? request.screenplayId : undefined, request.action === 'finish' ? request.sceneId : undefined);
            await this.persist(c);
            return {};
        }
        if (request.action === 'clear') {
            this.canManage(c);
            await this.finishInto(c, request.screenplayId);
            const workspace = await this.port.workspace(), document = workspace.screenplays.find(d => d.id === request.screenplayId);
            if (!document)
                throw Error('Screenplay unavailable.');
            if (!request.sceneId)
                await this.version(c, 'Before History Cleared', 'history_clear');
            const now = Date.now(), baseline: HistoryBaseline = { id: crypto.randomUUID(), screenplayId: document.id, sceneId: request.sceneId, clearedAt: new Date(now).toISOString(), expiresAt: new Date(now + HISTORY_DEFAULTS.recentlyClearedDays * 86400000).toISOString(), actorId: this.actor.id, baseline: document };
            await this.port.write('baselines/' + baseline.id, baseline);
            const { baseline: _state, ...summary } = baseline;
            c.cleared.push(summary);
            c.index = c.index.map(e => { const clearedTargets = { ...e.clearedTargets }; for (const t of e.targets)
                if (t.screenplayId === document.id && (!request.sceneId || t.sceneId === request.sceneId) && !clearedTargets[targetKey(t)])
                    clearedTargets[targetKey(t)] = baseline.id;for(const t of e.targets)if(!request.sceneId&&!t.screenplayId)clearedTargets[document.id+':'+targetKey(t)]=baseline.id; return { ...e, clearedTargets }; });
            await this.persist(c);
            return {};
        }
        if (request.action === 'recoverCleared') {
            this.canManage(c);
            const baseline = c.cleared.find(v => v.id === request.id);
            if (!baseline || baseline.expiresAt < new Date().toISOString())
                throw Error('This cleared History is no longer available.');
            c.index = c.index.map(e => ({ ...e, clearedId: e.clearedId === request.id ? undefined : e.clearedId, clearedTargets: Object.fromEntries(Object.entries(e.clearedTargets ?? {}).filter(([, id]) => id !== request.id)) }));
            c.cleared = c.cleared.filter(e => e.id !== request.id);
            await this.persist(c);
            return {};
        }
        if (request.action === 'createVersion') {
            this.canManage(c);
            if (!request.name.trim())
                throw Error('Give the version a name.');
            await this.finishInto(c);
            const version = await this.version(c, request.name.trim(), 'named');
            await this.persist(c);
            return { version };
        }
        if (request.action === 'compareVersion' || request.action === 'restoreVersion') {
            const version = await this.port.read<{
                workspace: ProjectWorkspace;
            } | null>('versions/' + request.id, null);
            if (!version)
                throw Error('Version unavailable.');
            const current = await this.port.workspace();
            if (request.action === 'compareVersion')
                return { comparison: { version: version.workspace, current } };
            this.canManage(c);
            await this.finishInto(c);
            await this.version(c, 'Before Version Restored', 'named');
            await this.persist(c);
            await this.port.apply('project', version.workspace);
            await this.append(c, await this.entry('project', [{ path: ['project'], before: current.project, after: version.workspace.project }, { path: ['screenplays'], before: current.screenplays, after: version.workspace.screenplays }, { path: ['story'], before: current.story, after: version.workspace.story }], current, undefined, 'restored'));
            await this.persist(c);
            return { workspace: await this.port.workspace() };
        }
        if (request.action === 'restore') {
            const entry = c.pending.find(e => e.id === request.id) ?? await this.port.read<HistoryEntry | null>('entries/' + request.id, null);
            if (!entry)
                throw Error('History entry unavailable.');
            await this.finishInto(c);
            const current = await this.port.workspace();
            const before = entry.scope === 'screenplay' ? current.screenplays.find(d => d.id === entry.screenplayId) : entry.scope === 'story' ? current.story : current;
            if (!before)
                throw Error('The affected document is unavailable.');
            await this.version(c, 'Before History Restored', 'named');
            await this.persist(c);
            const patches = entry.patches.filter(p => p.path[0] !== 'sceneOrder');
            const restored = applyHistoryPatches(before, patches, 'before') as any;
            const order = entry.patches.find(p => p.path[0] === 'sceneOrder')?.before as string[] | undefined;
            if (entry.scope === 'screenplay') {
                if (order)
                    restored.scenes.sort((a: any, b: any) => { const x = order.indexOf(a.id), y = order.indexOf(b.id); return x < 0 ? 1 : y < 0 ? -1 : x - y; });
                restored.scenes = restored.scenes.map((s: any, i: number) => ({ ...s, order: i }));
            }
            await this.port.apply(entry.scope, restored);
            const after = await this.port.workspace();
            const newEntry = await this.entry(entry.scope, [...patches.map(p => ({ ...p, before: patchValue(before, p), after: p.before })), ...order ? [{ path: ['sceneOrder'], before: (before as ScreenplayRecord).scenes.map(s => s.id), after: restored.scenes.map((s: any) => s.id) }] : []], after, entry.scope === 'screenplay' ? after.screenplays.find(d => d.id === entry.screenplayId) : undefined, 'restored');
            await this.append(c, newEntry);
            await this.persist(c);
            return { workspace: after };
        }
        if (request.action === 'collaborator') {
            if (c.collaborators.find(v => v.id === this.actor.id)?.role !== 'owner')
                throw Error('The project owner must change collaborator permissions.');
            if (!c.collaborators.some(v => v.id === request.value.id) && c.collaborators.length === 1)
                await this.version(c, 'Before Collaboration', 'collaboration');
            if (request.value.role !== 'owner' && c.collaborators.filter(v => v.role === 'owner' && v.id !== request.value.id).length === 0)
                throw Error('The project must retain an owner.');
            c.collaborators = [...c.collaborators.filter(v => v.id !== request.value.id), request.value];
            await this.persist(c);
            return {};
        }
        return {};
    }
}
