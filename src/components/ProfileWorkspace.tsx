import { synchronizeSceneDefaults } from '../domain/story-extraction';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, GitBranch, MapPin, UserRound, Users } from 'lucide-react';
import type { ScreenplayRecord } from '../shared/models';
import type { StoryEntity, StoryRecord } from '../shared/story';
import type { InspectorContext, ProfilePreferences } from '../shared/profiles';
import { CHARACTER_MODULES, LOCATION_MODULES, DEFAULT_CHARACTER_MODULES, DEFAULT_LOCATION_MODULES, INSPECTOR_WIDTH } from '../shared/profiles';
import { appearanceForScene, characterStatistics, cueCharacter, dateOfBirthLabel, effectiveRelationships, profileActivity, pointRangeApplies, relationshipDisplayName, relationshipVisibleAt } from '../domain/profiles';
import { chronologyLabel, getEffectivePlotsForScene, getEffectiveScenesForPlot, getEventsForPlot, getEventsForScene, queryTimeline, resolveEvent } from '../domain/story';
import { ProfileEditor, ProfileImage } from './ProfileEditor';
import { sceneHeading } from '../domain/screenplay';
import { parseCharacterCue } from '../domain/continuous-editor';

interface Hover { elementId: string; sceneId: string; type: 'character' | 'location'; left: number; top: number; }
type BrowserType = 'timeline' | 'location' | 'character' | 'event' | 'plot';
interface ScopeContext { projectType: string; activeSceneId: string; activeScreenplayId: string; seasons: { id: string; label: string; screenplayIds: string[] }[]; }
export function ProfileWorkspace({ story, documents, change, timeline, remove, undo, hidden, navigateScene, saveStatus, saveError, retry }: {
  saveStatus: string; saveError: string; retry(): void; story: StoryRecord; documents: ScreenplayRecord[]; change(story: StoryRecord): void; timeline(context: InspectorContext): void;
  remove(kind: 'characters' | 'locations', entity: StoryEntity): void; undo(): void; hidden: boolean; navigateScene(sceneId: string): void;
}) {
  const [hover, setHover] = useState<Hover | null>(null), [card, setCard] = useState<InspectorContext | null>(null), [inspector, setInspector] = useState<InspectorContext | null>(null), [profile, setProfile] = useState<InspectorContext | null>(null);
  const [browserType, setBrowserType] = useState<BrowserType>('timeline'), [scope, setScope] = useState('scene'), [expandAll, setExpandAll] = useState(false);
  const [scopeContext, setScopeContext] = useState<ScopeContext>(() => ({ projectType: documents.length > 1 ? 'series' : 'feature', activeSceneId: '', activeScreenplayId: documents[0]?.id ?? '', seasons: [] }));
  const [cardVisibility, setCardVisibility] = useState({ character: document.body.dataset.characterCardsVisible !== 'false', location: document.body.dataset.locationCardsVisible !== 'false' });
  const [prefs, setPrefs] = useState<ProfilePreferences>({}), [ready, setReady] = useState(false), [customize, setCustomize] = useState(false), [error, setError] = useState('');
  const [mount, setMount] = useState<HTMLElement | null>(null), [history, setHistory] = useState<InspectorContext[]>([]);
  const latest = useRef({ story, documents, change }); latest.current = { story, documents, change };
  const prefsRef = useRef(prefs); prefsRef.current = prefs;
  const [prefVersion, setPrefVersion] = useState(0);
  const queue = useRef(Promise.resolve());
  const quickCardOpenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusedCue = useRef<Hover | null>(null);
  const interaction = useRef({ hover, hidden, card, cardVisibility }); interaction.current = { hover, hidden, card, cardVisibility };
  const previousFocus = useRef<HTMLElement | null>(null);
  const setPreferences = (patch: Partial<ProfilePreferences>) => { setPrefs(value => ({ ...value, ...patch })); setPrefVersion(value => value + 1); };
  const closeProfile = () => { setProfile(null); previousFocus.current?.focus({ preventScroll: true }); };
  const openInspector = (context: InspectorContext) => { setHover(null); if (inspector) setHistory(values => [...values.slice(-20), inspector]); setInspector(context); setCard(null); setProfile(null); setPreferences({ inspectorOpen: true }); };
  useEffect(() => {
    setMount(document.querySelector<HTMLElement>('.writing-layout'));
    let active = true;
    if (window.desktop.bootstrap) void window.desktop.bootstrap().then(data => { if (active) { setPrefs(data.preferences.profiles ?? {}); setReady(true); } });
    try { const saved = JSON.parse(localStorage.getItem(`profile-inspector:${story.projectId}`) ?? 'null'); if (saved?.entityId) setInspector(saved); } catch { /* No saved UI context. */ }
    return () => { active = false; };
  }, [story.projectId]);
  useEffect(() => {
    const update = (event: Event) => setScopeContext((event as CustomEvent<ScopeContext>).detail);
    window.addEventListener('profile-scope-context', update);
    return () => window.removeEventListener('profile-scope-context', update);
  }, []);
  useEffect(() => {
    if (!ready || !prefVersion) return;
    const timer = setTimeout(() => { const snapshot = prefsRef.current; queue.current = queue.current.catch(() => {}).then(async () => { try { const data = await window.desktop.bootstrap(); await window.desktop.savePreferences({ ...data.preferences, profiles: snapshot }); setError(''); } catch (reason) { setError(`Preferences could not be saved: ${String(reason)}`); } }); }, 350);
    return () => clearTimeout(timer);
  }, [prefVersion, ready]);
  useEffect(() => { if (inspector) localStorage.setItem(`profile-inspector:${story.projectId}`, JSON.stringify(inspector)); }, [inspector, story.projectId]);
  useEffect(() => {
    mount?.classList.toggle('inspector-rail-visible', !hidden);
    mount?.classList.toggle('inspector-open', Boolean(!hidden && prefs.inspectorOpen));
    mount?.style.setProperty('--inspector-width', `${Math.max(INSPECTOR_WIDTH.min, Math.min(INSPECTOR_WIDTH.max, prefs.inspectorWidth ?? INSPECTOR_WIDTH.initial))}px`);
    return () => { mount?.classList.remove('inspector-open', 'inspector-rail-visible'); };
  }, [mount, hidden, prefs.inspectorOpen, prefs.inspectorWidth]);
  const fromHover = (value: Hover) => {
    const data = { ...latest.current };
    const extracted = synchronizeSceneDefaults(data.story, data.documents);
    if (extracted !== data.story) { data.change(extracted); data.story = extracted; }
    const scene = data.documents.flatMap(item => item.scenes).find(item => item.id === value.sceneId);
    const element = scene?.elements.find(item => item.id === value.elementId);
    const character = value.type === 'character' ? cueCharacter(data.story, element?.content ?? '', element?.id) : undefined;
    const id = character?.id ?? (value.type === 'location' ? data.story.scenes.find(item => item.sceneId === value.sceneId)?.locationId : undefined);
    const location = value.type === 'location' ? data.story.locations.find(item => item.id === id) : undefined;
    return id ? { type: value.type, entityId: location?.parentId ?? id, sourceSceneId: value.sceneId, ...(value.type === 'character' && element ? { sourceIdentity: parseCharacterCue(element.content).name } : {}) } : undefined;
  };
  useEffect(() => {
    const update = (event: Event) => {
      const value = (event as CustomEvent<{ character: boolean; location: boolean }>).detail;
      setCardVisibility(value);
      setHover(current => current && !value[current.type] ? null : current);
      setCard(current => current && (current.type === 'character' || current.type === 'location') && !value[current.type] ? null : current);
    };
    window.addEventListener('profile-card-visibility', update);
    return () => window.removeEventListener('profile-card-visibility', update);
  }, []);
  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const clearOpen = () => clearTimeout(quickCardOpenTimer.current);
    const clearClose = () => clearTimeout(closeTimer);
    const openCharacterCard = () => {
      clearOpen(); clearClose();
      quickCardOpenTimer.current = setTimeout(() => {
        const value = interaction.current.hover;
        if (!value || value.type !== 'character' || interaction.current.hidden || !interaction.current.cardVisibility.character) return;
        const context = fromHover(value);
        if (context) setCard(context);
      }, 300);
    };
    const closeQuickCard = () => {
      clearOpen(); clearClose();
      closeTimer = setTimeout(() => { setCard(null); setHover(null); setCustomize(false); }, 300);
    };
    const show = (node: Element | null) => {
      const block = node?.closest<HTMLElement>('.continuous-block.character, .continuous-block.scene_heading');
      if (!block) return;
      const type = block.classList.contains('character') ? 'character' : 'location';
      if (!interaction.current.cardVisibility[type]) return;
      clearOpen(); clearClose();
      const content = block.querySelector<HTMLElement>('.continuous-block-content') ?? block;
      const range = document.createRange();
      range.selectNodeContents(content);
      const textRect = range.getBoundingClientRect();
      const rect = textRect.width && textRect.height ? textRect : content.getBoundingClientRect();
      const value: Hover = { elementId: block.dataset.elementId!, sceneId: block.dataset.sceneId!, type, left: Math.min(window.innerWidth - 20, rect.right + 10), top: rect.top + Math.max(0, (rect.height - 16) / 2) }; setHover(value); return value;
    };
    const over = (event: PointerEvent) => { if (event.target instanceof Element) { if (event.target.closest('.profile-quick-card')) { clearClose(); return; } if (event.target.closest('.profile-hover')) { clearClose(); if (interaction.current.hover?.type === 'character') openCharacterCard(); return; } show(event.target); } };
    const out = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.continuous-block.character, .continuous-block.scene_heading, .profile-hover, .profile-quick-card')) return; if (event.target.closest('.profile-hover')) clearOpen(); if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.continuous-block.character, .continuous-block.scene_heading, .profile-hover, .profile-quick-card')) return; closeQuickCard(); };
    const focusIn = (event: FocusEvent) => { if (event.target instanceof Element && event.target.closest('.profile-hover') && interaction.current.hover?.type === 'character') openCharacterCard(); };
    const focusOut = (event: FocusEvent) => { if (event.target instanceof Element && event.target.closest('.profile-hover') && !(event.relatedTarget instanceof Element && event.relatedTarget.closest('.profile-hover, .profile-quick-card'))) closeQuickCard(); };
    const focus = (event: Event) => { const id = (event as CustomEvent<{ id: string }>).detail.id; focusedCue.current = show(document.querySelector(`[data-element-id="${CSS.escape(id)}"]`)) ?? null; };
    const keyboard = (event: KeyboardEvent) => {
      const { hover, hidden, card } = interaction.current;
      if (event.altKey && event.key.toLowerCase() === 'i' && (focusedCue.current || hover) && !hidden) { const context = fromHover((focusedCue.current || hover)!); if (context) { event.preventDefault(); event.stopPropagation(); previousFocus.current = document.activeElement as HTMLElement; setCard(context); } }
      if (event.key === 'Escape') { if (card) { event.preventDefault(); event.stopPropagation(); } setCard(null); setCustomize(false); }
    };
    const outside = (event: PointerEvent) => { if (event.target instanceof Element && !event.target.closest('.profile-quick-card, .profile-hover')) { setCard(null); setCustomize(false); } };
    const scroll = () => setHover(current => {
      if (!current) return null;
      const node = document.querySelector<HTMLElement>('[data-element-id="' + CSS.escape(current.elementId) + '"]');
      const rect = node?.getBoundingClientRect();
      if (!node || !rect || rect.top <= 55 || rect.top >= window.innerHeight - 40) return null;
      const content = node.querySelector<HTMLElement>('.continuous-block-content') ?? node;
      const range = document.createRange(); range.selectNodeContents(content);
      const textRect = range.getBoundingClientRect(); const anchor = textRect.width && textRect.height ? textRect : rect;
      return { ...current, left: Math.min(window.innerWidth - 20, anchor.right + 10), top: anchor.top + Math.max(0, (anchor.height - 16) / 2) };
    });
    document.addEventListener('pointerover', over); document.addEventListener('pointerout', out); document.addEventListener('focusin', focusIn); document.addEventListener('focusout', focusOut); document.addEventListener('pointerdown', outside); window.addEventListener('screenplay-element-focus', focus); window.addEventListener('keydown', keyboard, true); document.addEventListener('scroll', scroll, true);
    return () => { clearOpen(); clearClose(); document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out); document.removeEventListener('focusin', focusIn); document.removeEventListener('focusout', focusOut); document.removeEventListener('pointerdown', outside); window.removeEventListener('screenplay-element-focus', focus); window.removeEventListener('keydown', keyboard, true); document.removeEventListener('scroll', scroll, true); };
  }, []);
  useEffect(() => {
    const request = (event: Event) => { const detail = (event as CustomEvent<InspectorContext & { full?: boolean }>).detail; previousFocus.current = document.activeElement as HTMLElement; if (detail.full) setProfile(detail); else openInspector(detail); };
    const image = (event: Event) => { const { kind, entityId, image } = (event as CustomEvent).detail; if (kind !== 'characters' && kind !== 'locations') return; const current = latest.current.story; latest.current.change({ ...current, [kind]: current[kind as 'characters' | 'locations'].map((item: StoryEntity) => item.id === entityId ? { ...item, profile: { ...item.profile, primaryImageId: item.profile?.primaryImageId ?? image.id, images: [...item.profile?.images ?? [], image] } } : item) }); };
    window.addEventListener('open-story-profile', request); window.addEventListener('profile-image-imported', image);
    return () => { window.removeEventListener('open-story-profile', request); window.removeEventListener('profile-image-imported', image); };
  }, [inspector]);
  const entityFor = (context: InspectorContext) => context.type === 'character' ? story.characters.find(item => item.id === context.entityId) : context.type === 'location' ? story.locations.find(item => item.id === context.entityId) : context.type === 'plot' ? story.plots.find(item => item.id === context.entityId) : context.type === 'event' ? story.events.find(item => item.id === context.entityId) : undefined;
  const sceneName = (id: string) => { for (const document of documents) { const index = document.scenes.findIndex(scene => scene.id === id); if (index >= 0) return `${document.title} · Scene ${index + 1}: ${sceneHeading(document.scenes[index], index + 1)}`; } return 'Removed scene'; };
  const link = (type: InspectorContext['type'], id: string, sourceSceneId?: string, label?: string) => <button key={`${type}:${id}`} onClick={() => openInspector({ type, entityId: id, sourceSceneId: type === 'scene' ? id : sourceSceneId })}>{label ?? (type === 'scene' ? sceneName(id) : entityFor({ type, entityId: id })?.name)}</button>;
  const modules = (context: InspectorContext): Record<string, ReactNode> => {
    const entity = entityFor(context); if (!entity) return {};
    const p = entity.profile ?? {}, scene = story.scenes.find(item => item.sceneId === context.sourceSceneId);
    const current = appearanceForScene(story, entity, context.sourceSceneId);
    const primary = p.images?.find(item => item.id === p.primaryImageId);
    const appearanceImage = p.images?.find(item => item.appearanceId === current.appearance?.id);
    const events = story.events.filter(item => !item.archived && (item.occursInSceneId === context.sourceSceneId || item.revealedInSceneIds?.includes(context.sourceSceneId ?? '') || item.referencedInSceneIds?.includes(context.sourceSceneId ?? '')));
    const relationships = effectiveRelationships(story).filter(item => item.fromId === entity.id && (!item.from && !item.until || pointRangeApplies(story, scene?.chronology, item.from, item.until)) && relationshipVisibleAt(story, item, scene?.chronology));
    const area = story.locations.find(item => item.id === scene?.locationId);
    return {
      image: primary && <ProfileImage projectId={story.projectId} assetId={primary.assetId} />, dateOfBirth: p.dateOfBirth ? dateOfBirthLabel(p.dateOfBirth) : undefined, age: p.age, occupation: p.occupation, description: entity.description,
      skills: p.skills?.length ? p.skills.map(item => `${item.name}${item.note ? ` — ${item.note}` : ''}`).join(' · ') : undefined,
      appearance: current.conflicts.length ? 'Conflicting appearances — review the profile.' : current.appearance && <p><b>{current.appearance.name}</b><br />{[current.appearance.description, current.appearance.hair, current.appearance.facialHair, current.appearance.clothing, current.appearance.injuries, current.appearance.marks, current.appearance.accessories, current.appearance.notes].filter(Boolean).join(' · ')}</p>,
      appearanceImage: appearanceImage && <ProfileImage projectId={story.projectId} assetId={appearanceImage.assetId} />,
      characters: scene?.presentIds?.filter(id => context.type !== 'character' || id !== entity.id).length ? scene.presentIds.filter(id => context.type !== 'character' || id !== entity.id).map(id => link('character', id, context.sourceSceneId)) : undefined,
      plots: scene ? getEffectivePlotsForScene(story, scene.sceneId).map(item => link('plot', item.plotId, context.sourceSceneId)) : undefined,
      location: scene?.locationId ? link('location', scene.locationId, context.sourceSceneId) : undefined,
      time: scene?.chronology && chronologyLabel(scene.chronology) !== 'Unpositioned' ? chronologyLabel(scene.chronology) : undefined,
      events: events.length ? events.map(item => <div key={item.id}>{link('event', item.id, context.sourceSceneId)}<small>{item.occursInSceneId === context.sourceSceneId ? 'Occurs' : item.revealedInSceneIds?.includes(context.sourceSceneId ?? '') ? 'Revealed' : 'Referenced'}</small></div>) : undefined,
      relationships: relationships.length ? relationships.map(item => <p key={item.id}>{relationshipDisplayName(item)} · {story.characters.find(c => c.id === item.toId)?.name}{item.derived ? ' · automatic' : ''}</p>) : undefined,
      notes: p.notes, parent: entity.parentId ? link('location', entity.parentId, context.sourceSceneId) : undefined,
      area: area?.parentId ? link('location', area.id, context.sourceSceneId) : undefined,
      locationType: p.locationType, structure: p.structure, atmosphere: p.atmosphere, visualNotes: p.visualNotes, restrictions: p.restrictions,
    };
  };
  const contextTitle = (context: InspectorContext) => { for (const document of documents) { const index = document.scenes.findIndex(item => item.id === context.sourceSceneId); if (index >= 0) return `${document.title} · Scene ${index + 1}`; } return ''; };
  const allRows = queryTimeline(story, documents, { order: 'day' });
  const scopedScreenplayIds = scope === 'screenplay' ? [scopeContext.activeScreenplayId] : scope.startsWith('series:') ? scopeContext.seasons.find(item => `series:${item.id}` === scope)?.screenplayIds ?? [] : [];
  const scopedSceneIds = new Set(scope === 'scene' ? [scopeContext.activeSceneId] : scopedScreenplayIds.length ? documents.filter(item => scopedScreenplayIds.includes(item.id)).flatMap(item => item.scenes.map(scene => scene.id)) : documents.flatMap(item => item.scenes.map(scene => scene.id)));
  const scopeIncludes = (item: ReturnType<typeof queryTimeline>[number]) => {
    if (scope === 'all') return true;
    if (item.sceneId && scopedSceneIds.has(item.sceneId)) return true;
    if (item.kind === 'event') { const event = story.events.find(value => value.id === item.id); return Boolean(event && [event.occursInSceneId, ...(event.revealedInSceneIds ?? []), ...(event.referencedInSceneIds ?? [])].some(id => id && scopedSceneIds.has(id))); }
    return false;
  };
  const scopedRows = allRows.filter(scopeIncludes);
  const scopedCharacterIds = new Set(scopedRows.flatMap(item => [...item.presentIds ?? [], ...item.remoteIds ?? [], ...item.referencedIds ?? []]));
  const scopedLocationIds = new Set(scopedRows.flatMap(item => item.locationId ? [item.locationId] : []));
  const scopedPlotIds = new Set(scopedRows.flatMap(item => item.plotIds ?? []));
  const scopedEventIds = new Set(scopedRows.filter(item => item.kind === 'event').map(item => item.id));
  const scopeOptions = scopeContext.projectType === 'series' ? [{ value: 'scene', label: 'Current scene' }, { value: 'screenplay', label: 'Episode' }, ...scopeContext.seasons.map(item => ({ value: `series:${item.id}`, label: item.label })), { value: 'all', label: 'All time' }] : [{ value: 'scene', label: 'Current scene' }, { value: 'screenplay', label: 'Screenplay' }];
  const inspectorEntity = inspector && entityFor(inspector);
  const inspectorScene = inspector?.type === 'scene' ? documents.flatMap(document => document.scenes.map((scene, index) => ({ scene, name: `${document.title} · Scene ${index + 1}: ${sceneHeading(scene, index + 1)}` }))).find(item => item.scene.id === inspector.entityId) : undefined;
  const railItems: { type: BrowserType; label: string; icon: ReactNode }[] = [{ type: 'timeline', label: 'Timeline', icon: <Clock3 /> }, { type: 'location', label: 'Locations', icon: <MapPin /> }, { type: 'character', label: 'Characters', icon: <Users /> }, { type: 'event', label: 'Events', icon: <CalendarDays /> }, { type: 'plot', label: 'Plots', icon: <GitBranch /> }];
  const chooseBrowser = (type: BrowserType) => { setBrowserType(type); setInspector(null); setHistory([]); setExpandAll(false); setPreferences({ inspectorOpen: true }); };
  const rail = <nav className={`inspector-rail${prefs.inspectorOpen ? ' expanded' : ''}`} aria-label="Story inspector">
    <button className="inspector-toggle" aria-label={prefs.inspectorOpen ? 'Collapse right sidebar' : 'Expand right sidebar'} onClick={() => setPreferences({ inspectorOpen: !prefs.inspectorOpen })}>{prefs.inspectorOpen ? <ChevronRight /> : <ChevronLeft />}</button>
    {railItems.map(item => <button key={item.type} className={browserType === item.type && prefs.inspectorOpen ? 'active' : ''} aria-label={item.label} title={item.label} onClick={() => chooseBrowser(item.type)}>{item.icon}<span>{item.label}</span></button>)}
  </nav>;
  const browserEntities = browserType === 'location' ? story.locations.filter(item => !item.archived && scopedLocationIds.has(item.id)) : browserType === 'character' ? story.characters.filter(item => !item.archived && scopedCharacterIds.has(item.id)) : browserType === 'event' ? story.events.filter(item => !item.archived && scopedEventIds.has(item.id)) : browserType === 'plot' ? story.plots.filter(item => !item.archived && scopedPlotIds.has(item.id)) : [];
  const renderedBrowser = !inspector && prefs.inspectorOpen && <aside className="right-inspector inspector-browser profile-surface" aria-label="Right inspector">
    <header><small>{railItems.find(item => item.type === browserType)?.label.toUpperCase()}</small></header>
    <label>Story range<select aria-label="Story range" value={scopeOptions.some(item => item.value === scope) ? scope : scopeOptions[0].value} onChange={event => setScope(event.target.value)}>{scopeOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <div className="inspector-browser-list">{browserType === 'timeline' ? scopedRows.map(item => <button key={`${item.kind}:${item.id}`} onClick={() => openInspector({ type: item.kind, entityId: item.id, sourceSceneId: item.sceneId ?? item.id })}><small>{chronologyLabel(item.chronology)}</small><b>{item.name}</b><span>{item.kind === 'event' ? item.major ? 'Major event' : 'Event' : 'Scene'}{item.plotIds?.length ? ` · ${item.plotIds.map(id => story.plots.find(plot => plot.id === id)?.name).filter(Boolean).join(', ')}` : ''}</span></button>) : browserEntities.map(item => <button key={item.id} onClick={() => openInspector({ type: browserType, entityId: item.id, sourceSceneId: scopeContext.activeSceneId })}><b>{item.name}</b><span>{item.description}</span></button>)}</div>
  </aside>;
  const renderedInspector = inspector && prefs.inspectorOpen && <aside className="right-inspector profile-surface" aria-label="Right inspector">
    <div role="separator" aria-label="Resize inspector" aria-orientation="vertical" tabIndex={0} className="inspector-resizer" onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setPreferences({ inspectorWidth: Math.max(INSPECTOR_WIDTH.min, Math.min(INSPECTOR_WIDTH.max, (prefs.inspectorWidth ?? INSPECTOR_WIDTH.initial) + (event.key === 'ArrowLeft' ? 20 : -20))) }); }} onPointerDown={event => { event.preventDefault(); const start = event.clientX, width = prefs.inspectorWidth ?? INSPECTOR_WIDTH.initial; const move = (e: PointerEvent) => setPrefs(value => ({ ...value, inspectorWidth: Math.max(INSPECTOR_WIDTH.min, Math.min(INSPECTOR_WIDTH.max, width + start - e.clientX)) })); const end = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); setPrefVersion(value => value + 1); }; document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); }} />
    <header><small>{inspector.type.toUpperCase()}</small><button onClick={() => setPreferences({ inspectorOpen: false })}>Collapse inspector</button></header>
    <button onClick={() => { setInspector(null); setHistory([]); setExpandAll(false); }}>Back to {railItems.find(item => item.type === browserType)?.label}</button>
    {history.length > 0 && <button onClick={() => { setInspector(history.at(-1)!); setHistory(values => values.slice(0, -1)); }}>Back</button>}
    <h2>{inspectorEntity?.name ?? inspectorScene?.name ?? 'Scene'}</h2>{inspector.type === 'character' && inspector.sourceIdentity && inspectorEntity && inspector.sourceIdentity.trim().toUpperCase() !== inspectorEntity.name.trim().toUpperCase() && <small>Appears here as {inspector.sourceIdentity.toUpperCase()}</small>}<small>{contextTitle(inspector)}</small><button onClick={() => { const next = !expandAll; setExpandAll(next); document.querySelectorAll<HTMLDetailsElement>('.right-inspector details').forEach(section => { if (section.querySelector('div, p, button, img')) section.open = next; }); }}>{expandAll ? 'Collapse all fields' : 'Expand all fields'}</button>
    {inspectorEntity && <>{(inspector.type === 'character' || inspector.type === 'location') && <button onClick={() => setProfile(inspector)}>Open full profile</button>}
      {Object.entries(modules(inspector)).filter(([,content]) => Boolean(content)).map(([key, content]) => <details key={`${inspector.type}:${key}`} open={prefs.sectionState?.[`${inspector.type}:${key}`] ?? ['appearance','image','description','time','structure'].includes(key)} onToggle={event => { const open = event.currentTarget.open; if ((prefsRef.current.sectionState?.[`${inspector.type}:${key}`] ?? ['appearance','image','description','time','structure'].includes(key)) !== open) setPreferences({ sectionState: { ...prefsRef.current.sectionState, [`${inspector.type}:${key}`]: open } }); }}><summary>{((inspector.type === 'character' ? CHARACTER_MODULES : LOCATION_MODULES) as Record<string,string>)[key] ?? key}</summary><div>{content}</div></details>)}
      {(inspector.type === 'character' || inspector.type === 'location') && <>
        {inspector.type === 'location' && story.locations.some(item => item.parentId === inspector.entityId) && <details><summary>Areas</summary>{story.locations.filter(item => item.parentId === inspector.entityId).map(item => link('location', item.id, inspector.sourceSceneId))}</details>}
        {(() => { const activity = profileActivity(story, documents, inspector.type as 'character' | 'location', inspector.entityId); const plots = [...new Set(activity.flatMap(item => item.plotIds ?? []))]; const locations = [...new Set(activity.flatMap(item => item.locationId ? [item.locationId] : []))]; const characters = [...new Set(activity.flatMap(item => item.kind === 'scene' ? item.presentIds ?? [] : []))]; return <>{plots.length > 0 && <details><summary>All related plots</summary>{plots.map(id => link('plot', id, inspector.sourceSceneId))}</details>}{inspector.type === 'character' && locations.length > 0 && <details><summary>Locations across the story</summary>{locations.map(id => <div key={id}>{link('location', id, inspector.sourceSceneId)}<small>{activity.filter(item => item.kind === 'scene' && item.locationId === id).length} scenes</small></div>)}</details>}{inspector.type === 'location' && characters.length > 0 && <details><summary>Characters across the story</summary>{characters.map(id => <div key={id}>{link('character', id, inspector.sourceSceneId)}<small>{activity.filter(item => item.kind === 'scene' && item.presentIds?.includes(id)).length} scenes</small></div>)}</details>}</>; })()}
        <details><summary>Story activity</summary>{profileActivity(story, documents, inspector.type, inspector.entityId).slice(0, 30).map(item => <div key={`${item.kind}:${item.id}`}><small>{chronologyLabel(item.chronology)}</small>{link(item.kind, item.id, item.sceneId, item.name)}</div>)}</details>
        <details><summary>Stats</summary>{inspector.type === 'character' ? (() => { const stats = characterStatistics(story, documents, inspector.entityId); return <p>{stats.sceneCount} scenes · {stats.words} dialogue words · {stats.episodeCount} documents</p>; })() : <p>{profileActivity(story, documents, 'location', inspector.entityId).filter(item => item.kind === 'scene').length} direct scenes</p>}</details>
      </>}
      {inspector.type === 'event' && (() => { const event = story.events.find(item => item.id === inspector.entityId)!; const resolved = resolveEvent(story, event); return <><p>{chronologyLabel(resolved.chronology)}</p>{!!event.plotIds?.length && <details open><summary>Plots</summary>{event.plotIds.map(id => link('plot', id, inspector.sourceSceneId))}</details>}<details open><summary>Scenes</summary>{event.occursInSceneId && <div>{link('scene', event.occursInSceneId, event.occursInSceneId)}<small>Occurs</small></div>}{event.revealedInSceneIds?.map(id => <div key={`revealed:${id}`}>{link('scene', id, id)}<small>Revealed</small></div>)}{event.referencedInSceneIds?.map(id => <div key={`referenced:${id}`}>{link('scene', id, id)}<small>Referenced</small></div>)}</details>{!!event.participantIds?.length && <details><summary>Participants</summary>{event.participantIds.map(id => link('character', id, inspector.sourceSceneId))}</details>}{!!resolved.presentIds?.length && <details><summary>Present in occurrence scene</summary>{resolved.presentIds.map(id => link('character', id, inspector.sourceSceneId))}</details>}</>; })()}
      {inspector.type === 'plot' && (() => { const plot = story.plots.find(item => item.id === inspector.entityId)!; const events = getEventsForPlot(story, plot.id), scenes = getEffectiveScenesForPlot(story, plot.id); return <><p>{plot.scope ?? 'Project'} · {plot.status ?? 'Active'}{plot.label ? ` · ${plot.label}` : ''}</p><details open><summary>Events</summary>{events.map(event => link('event', event.id, event.occursInSceneId))}{!events.length && <small>No events assigned.</small>}</details><details open><summary>Scenes</summary>{scenes.map(scene => <div key={scene.sceneId}>{link('scene', scene.sceneId, scene.sceneId)}<small>{scene.sources.map(source => source.type === 'explicit' ? 'Added to Scene' : `${source.relationship === 'revealed' ? 'Revealed via' : 'Via'} ${story.events.find(event => event.id === source.eventId)?.name ?? 'removed event'}`).join(' · ')}</small></div>)}{!scenes.length && <small>No scenes associated.</small>}</details></>; })()}
      {(inspector.type === 'event' || inspector.type === 'plot') && <button onClick={() => window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: inspector }))}>Edit {inspector.type}</button>}
      <button onClick={() => timeline(inspector)}>View full timeline</button>
    </>}
    {inspector.type === 'scene' && inspectorScene && (() => { const events = getEventsForScene(story, inspector.entityId), plots = getEffectivePlotsForScene(story, inspector.entityId); return <><button onClick={() => navigateScene(inspector.entityId)}>Open scene</button><details open><summary>Plots</summary>{plots.map(plot => <div key={plot.plotId}>{link('plot', plot.plotId, inspector.entityId)}<small>{plot.sources.map(source => source.type === 'explicit' ? 'Added to Scene' : `${source.relationship === 'revealed' ? 'Revealed via' : 'Via'} ${story.events.find(event => event.id === source.eventId)?.name ?? 'removed event'}`).join(' · ')}</small></div>)}{!plots.length && <small>No plots associated.</small>}</details>{(['occurs', 'revealed', 'referenced'] as const).map(relationship => <details open key={relationship}><summary>{relationship === 'occurs' ? 'Events occurring here' : relationship === 'revealed' ? 'Events revealed here' : 'Events referenced here'}</summary>{events[relationship].map(({ event }) => link('event', event.id, inspector.entityId))}{!events[relationship].length && <small>None</small>}</details>)}<button onClick={() => window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: inspector }))}>Edit scene details</button><button onClick={() => timeline(inspector)}>View full timeline</button></>; })()}
    <small role="status">{saveStatus}</small>{error && <p role="alert">{error}<button onClick={() => setPrefVersion(value => value + 1)}>Retry preferences</button></p>}
  </aside>;
  return <>
    {mount && !hidden && createPortal(rail, mount)}
    {mount && !hidden && renderedBrowser && createPortal(renderedBrowser, mount)}
    {mount && !hidden && renderedInspector && createPortal(renderedInspector, mount)}
    {hover && !hidden && !profile && <button className="profile-hover" style={{ left: hover.left, top: hover.top }} title={hover.type === 'character' ? 'Hover for character card; click to open inspector' : 'Open location card (Alt+I)'} aria-label={hover.type === 'character' ? 'Open character inspector' : 'Open location card'} onMouseDown={event => event.preventDefault()} onClick={() => { clearTimeout(quickCardOpenTimer.current); const context = fromHover(hover); if (context) { previousFocus.current = document.activeElement as HTMLElement; if (hover.type === 'character') openInspector(context); else setCard(context); } }}>{hover.type === 'character' ? <UserRound size={16} /> : <MapPin size={16} />}</button>}
    {card && !hidden && <section className="profile-quick-card profile-surface" role="dialog" aria-label={`${card.type} quick card`} style={{ right: 20, bottom: 20 }} onKeyDown={event => event.stopPropagation()}>
      <header><h3>{entityFor(card)?.name}</h3><button aria-label="Close card" onClick={() => setCard(null)}>×</button></header>{card.type === 'character' && card.sourceIdentity && entityFor(card) && card.sourceIdentity.trim().toUpperCase() !== entityFor(card)?.name.trim().toUpperCase() && <small>Appears here as {card.sourceIdentity.toUpperCase()}</small>}<small>{contextTitle(card)}</small>
      {(() => { const labels = card.type === 'character' ? CHARACTER_MODULES : LOCATION_MODULES; const prefKey = card.type === 'character' ? 'characterModules' : 'locationModules'; const defaults = card.type === 'character' ? DEFAULT_CHARACTER_MODULES : DEFAULT_LOCATION_MODULES; const enabled = prefs[prefKey] ?? defaults, content = modules(card); return <>
        {enabled.filter(key => content[key]).map(key => <section key={key}><h4>{(labels as Record<string,string>)[key]}</h4>{content[key]}</section>)}
        <button onClick={() => setCustomize(!customize)}>Customise {card.type} card</button>
        {customize && <fieldset><legend>Card modules</legend>{Object.entries(labels).map(([key,label]) => <label key={key}><input type="checkbox" checked={enabled.includes(key)} onChange={event => setPreferences({ [prefKey]: event.target.checked ? [...enabled, key] : enabled.filter(item => item !== key) })} />{label}</label>)}{enabled.map((key,index) => <div key={key}>{(labels as Record<string,string>)[key]} <button disabled={!index} aria-label={`Move ${key} up`} onClick={() => { const next = [...enabled]; [next[index-1], next[index]] = [next[index], next[index-1]]; setPreferences({ [prefKey]: next }); }}>↑</button></div>)}<button onClick={() => setPreferences({ [prefKey]: defaults })}>Reset to default</button></fieldset>}
      </>; })()}
      <footer><button onClick={() => openInspector(card)}>Open in inspector</button><button onClick={() => { setProfile(card); setCard(null); }}>Open full profile</button></footer>
    </section>}
    {(profile || prefs.inspectorOpen) && saveError && <div className="profile-save-error" role="alert">{saveError}<button onClick={retry}>Retry story save</button></div>}
    {profile && <ProfileEditor saveStatus={saveStatus} key={`${profile.type}:${profile.entityId}`} context={profile} story={story} documents={documents} change={change} navigate={context => { if (context.type === 'character' || context.type === 'location') setProfile(context); else if (context.type === 'scene') { closeProfile(); navigateScene(context.entityId); } else openInspector(context); }} timeline={context => { setProfile(null); timeline(context); }} close={closeProfile} undo={undo} remove={remove} />}
  </>;
}
