import { useEffect, useRef, useState } from 'react';
import type { ScreenplayRecord } from '../shared/models';
import type { HistoryEntry, HistoryPage, HistorySummary } from '../shared/project-history';
import { flushProjectEdits } from '../domain/persistence-client';
export function HistorySidebar({ projectId, screenplayId, sceneId, documents, navigate }: {
    projectId: string;
    screenplayId: string;
    sceneId: string;
    documents: ScreenplayRecord[];
    navigate(sceneId: string): void;
}) {
    const [scope, setScope] = useState<'scene' | 'screenplay'>('scene'), [view, setView] = useState(document.body.dataset.editorView ?? 'continuous'), [page, setPage] = useState<HistoryPage>(), [offset, setOffset] = useState(0), [selected, setSelected] = useState<HistoryEntry>(), [selectedId, setSelectedId] = useState(''), [recent, setRecent] = useState(false), [actor, setActor] = useState(''), [error, setError] = useState(''), [versionName, setVersionName] = useState(''), [comparison, setComparison] = useState<{
        version: import('../shared/models').ProjectWorkspace;
        current: import('../shared/models').ProjectWorkspace;
    }>(), [busy, setBusy] = useState(false);
    const alive = useRef(true), list = useRef<HTMLDivElement>(null), generation = useRef(0), state = useRef({ scope, view, recent, actor, offset, sceneId, screenplayId });
    state.current = { scope, view, recent, actor, offset, sceneId, screenplayId };
    const refresh = async () => { if (!window.desktop.projectHistory)
        return; const current = state.current, version = ++generation.current; try {
        const result = await window.desktop.projectHistory(projectId, { action: 'query', query: { screenplayId: current.screenplayId, sceneId: current.view === 'scene' || current.scope === 'scene' ? current.sceneId : undefined, actorId: current.actor || undefined, recentlyCleared: current.recent, offset: current.offset } });
        if (alive.current && version === generation.current) {
            setPage(result.page);
            setError('');
        }
    }
    catch (reason) {
        if (alive.current)
            setError(String(reason));
    } };
    useEffect(() => { alive.current = true; void refresh(); const update = () => void refresh(), mode = () => { setView(document.body.dataset.editorView ?? 'continuous'); }; window.addEventListener('project-history-updated', update); window.addEventListener('editor-view-changed', mode); const timer = setInterval(() => { mode(); void refresh(); }, 5000); return () => { alive.current = false; clearInterval(timer); window.removeEventListener('project-history-updated', update); window.removeEventListener('editor-view-changed', mode); }; }, [projectId]);
    useEffect(() => { setOffset(0); }, [sceneId, screenplayId, scope, actor, recent]);
    useEffect(() => { void refresh(); }, [sceneId, screenplayId, scope, actor, recent, offset, view]);
    useEffect(() => { const scroll = (event: Event) => { if (state.current.view === 'scene' || state.current.scope !== 'screenplay')
        return; const id = (event as CustomEvent<string>).detail; const target = list.current?.querySelector<HTMLElement>('[data-history-scene="' + CSS.escape(id) + '"]'); if (target && list.current)
        list.current.scrollTop = target.offsetTop - list.current.offsetTop - 40;
    else
        void window.desktop.projectHistory(projectId, { action: 'query', query: { screenplayId: state.current.screenplayId, anchorSceneId: id, actorId: state.current.actor || undefined, recentlyCleared: state.current.recent } }).then(result => { if (alive.current && result.page) {
            setOffset(result.page.offset ?? 0);
            setPage(result.page);
            setTimeout(() => { const row = list.current?.querySelector<HTMLElement>('[data-history-scene="' + CSS.escape(id) + '"]'); if (row && list.current)
                list.current.scrollTop = row.offsetTop - list.current.offsetTop - 40; }, 0);
        } }).catch(reason => setError(String(reason))); }; window.addEventListener('screenplay-history-scroll', scroll); return () => window.removeEventListener('screenplay-history-scroll', scroll); }, [projectId]);
    const run = async (request: import('../shared/project-history').HistoryRequest) => { setBusy(true); try {
        await flushProjectEdits();
        const result = await window.desktop.projectHistory(projectId, request);
        if (result.workspace)
            window.dispatchEvent(new CustomEvent('history-workspace-restored', { detail: result.workspace }));
        if (result.comparison)
            setComparison(result.comparison);
        setSelected(undefined);
        await refresh();
    }
    catch (reason) {
        setError(String(reason));
    }
    finally {
        setBusy(false);
    } };
    const open = async (e: HistorySummary) => { try {
        setSelectedId(e.id);
        const result = await window.desktop.projectHistory(projectId, { action: 'entry', id: e.id });
        setSelected(result.entry);
        const t = e.targets.find(t => t.elementId) ?? e.targets[0];
        if (t?.sceneId) {
            navigate(t.sceneId);
            setTimeout(() => { const el = t.elementId ? document.querySelector<HTMLElement>('[data-element-id="' + CSS.escape(t.elementId) + '"]') : document.querySelector<HTMLElement>('[data-scene-id="' + CSS.escape(t.sceneId!) + '"]'); const target = el ?? document.querySelector<HTMLElement>('[data-scene-id="' + CSS.escape(t.sceneId!) + '"]'); target?.scrollIntoView({ block: 'center' }); el?.classList.add('history-change-highlight'); setTimeout(() => el?.classList.remove('history-change-highlight'), 1800); }, 100);
        }
        else if (t && ['character', 'location'].includes(t.type))
            window.dispatchEvent(new CustomEvent('open-story-profile', { detail: { type: t.type, entityId: t.id, full: true } }));
        else if (t && ['event', 'plot'].includes(t.type))
            window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: { type: t.type, entityId: t.id } }));
        else if (t?.worldId)
            window.dispatchEvent(new CustomEvent('open-world-reference', { detail: { worldId: t.worldId, entity: { kind: t.type, id: t.id } } }));
    }
    catch (reason) {
        setError(String(reason));
    } };
    const preview = (value: any): string => value?.elements ? value.elements.map((e: any) => e.content).join('\n') : typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? '(Absent)';
    return <section className="project-history-sidebar" aria-label="History"><h3>History</h3>{view !== 'scene' && <label>History scope<select aria-label="History scope" value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="scene">Scene</option><option value="screenplay">Screenplay</option></select></label>}<label>Writer<select aria-label="History writer" value={actor} onChange={e => setActor(e.target.value)}><option value="">All writers</option>{page?.collaborators.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label><button onClick={() => setRecent(!recent)}>{recent ? 'Back to History' : 'Recently Cleared'}</button>{error && <p role="alert">{error}</p>}{page?.warning && <p role="status">{page.warning}</p>}{recent ? page?.cleared.filter(c => c.screenplayId === screenplayId).map(c => <article key={c.id}><p>{c.sceneId ? 'Scene History' : 'Screenplay History'} · Cleared {new Date(c.clearedAt).toLocaleDateString()}</p><button disabled={busy} onClick={() => void run({ action: 'recoverCleared', id: c.id })}>Restore History</button></article>) : <button disabled={busy} onClick={() => void run({ action: 'clear', screenplayId, sceneId: view === 'scene' || scope === 'scene' ? sceneId : undefined })}>{view === 'scene' || scope === 'scene' ? 'Clear Scene History' : 'Clear Screenplay History'}</button>}
 <div ref={list} className="history-entry-list">{page?.entries.map((e, i) => { const t = e.targets.find(t => t.sceneId) ?? e.targets[0], document = documents.find(d => d.id === t?.screenplayId), index = document?.scenes.findIndex(s => s.id === t?.sceneId) ?? -1, c = page.collaborators.find(c => c.id === e.actorId), day = new Date(e.endedAt).toLocaleDateString(); return <article key={e.id} data-history-scene={t?.sceneId}>{i === 0 || new Date(page.entries[i - 1].endedAt).toLocaleDateString() !== day ? <h4>{day}</h4> : null}<button className={selectedId === e.id ? 'active' : ''} onClick={() => void open(e)}><small style={{ borderLeft: '3px solid ' + (c?.color ?? '#e1a35f'), paddingLeft: 6 }}>{new Date(e.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {c?.displayName ?? 'Writer unavailable'}</small><b>{t?.sceneId ? index >= 0 ? 'Scene ' + (index + 1) : 'Deleted Scene' : t?.type ?? 'Project'}</b><span>{e.label}</span>{(e.added > 0 || e.removed > 0) && <small>+{e.added} −{e.removed}</small>}</button></article>; })}{!page?.entries.length && <p>{recent ? 'No recently cleared changes.' : 'No changes since this History baseline.'}</p>}</div><div><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Newer</button><button disabled={!page || offset + 50 >= page.total} onClick={() => setOffset(offset + 50)}>Older</button></div>
 {selected && <details open><summary>Compare change</summary>{selected.patches.map((p, i) => <div key={i}><h4>{p.id ?? p.path.at(-1)}</h4><label>Before<pre>{preview(p.before)}</pre></label><label>After<pre>{preview(p.after)}</pre></label></div>)}<button disabled={busy} onClick={() => void run({ action: 'restore', id: selected.id })}>Restore previous state</button><button onClick={() => setSelected(undefined)}>Close comparison</button></details>}
 <details><summary>Versions</summary><label>Version name<input value={versionName} onChange={e => setVersionName(e.target.value)}/></label><button disabled={busy || !versionName.trim()} onClick={() => void run({ action: 'createVersion', name: versionName })}>Create Version</button>{page?.versions.map(v => <article key={v.id}><b>{v.name}</b><small>{new Date(v.createdAt).toLocaleString()} · Protected</small><button disabled={busy} onClick={() => void run({ action: 'compareVersion', id: v.id })}>Compare with Current</button><button disabled={busy} onClick={() => void run({ action: 'restoreVersion', id: v.id })}>Restore Version</button></article>)}</details>{comparison && <details open><summary>Version comparison</summary><p>{comparison.version.project.title}</p>{comparison.version.screenplays.map(d => <article key={d.id}><h4>{d.title}</h4><label>Version<pre>{preview({ elements: d.scenes.flatMap(s => s.elements) })}</pre></label><label>Current<pre>{preview({ elements: comparison.current.screenplays.find(v => v.id === d.id)?.scenes.flatMap(s => s.elements) ?? [] })}</pre></label></article>)}<h4>Story and World</h4><label>Version<pre>{preview(comparison.version.story)}</pre></label><label>Current<pre>{preview(comparison.current.story)}</pre></label><button onClick={() => setComparison(undefined)}>Close version comparison</button></details>}</section>;
}
