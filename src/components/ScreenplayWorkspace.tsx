import { flushProjectEdits } from '../domain/persistence-client';
import { StoryPanel } from './StoryPanel';
import type { StoryRecord } from '../shared/story';
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  GripVertical,
  Lock,
  Plus,
  Save,
  Search,
  Trash2,
  Unlock,
} from "lucide-react";
import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import type {
  ProjectWorkspace,
  SceneRecord,
  ScreenplayElement,
  ScreenplayElementType,
  ScreenplayRecord,
  TextAlignment,
  TextEmphasis,
} from "../shared/models";
import { SCREENPLAY_FORMAT } from "../shared/screenplay-format";
import { ContinuousScreenplayEditor } from "./ContinuousScreenplayEditor";
import {
  layoutCss,
  professionalLayout,
  resolveLayout,
  validateLayout,
  type PaperSize,
  type ScreenplayLayout,
} from "../shared/screenplay-layout";
import {
  advanceElement,
  createElement,
  deleteScene,
  insertScene,
  moveScene,
  nextElementType,
  normalizeSceneBoundaries,
  normalizeSceneHeadings,
  sceneHeading,
  sceneLocation,
  tabElementType,
  updateScene,
} from "../domain/screenplay";
import {
  applyFormatting,
  canMakeDualDialogue,
  convertCase,
  makeDualDialogue,
  reconcileFormatting,
  removeDualDialogue,
  removeFormatting,
  setAlignment,
  smartTypeSuggestions,
  toggleEmphasis,
  uniqueSuggestions,
} from "../domain/screenplay-editing";
import {
  duplicateScene,
  findOccurrences,
  reorderScene,
  replaceOccurrences,
  screenplayStatistics,
  type SearchScope,
} from "../domain/editor-operations";
import { resolveEditorCommand } from "../domain/editor-commands";
import {
  paginateScreenplay,
  type ElementFragment,
  type PageEntry,
  type ScreenplayPage,
} from "../domain/pagination";
import {
  joinAtBoundary,
  parentheticalContent,
  splitElement,
  tabType,
  transformElement,
  withCharacterMetadata,
} from "../domain/continuous-editor";

const ELEMENT_LABELS: Record<ScreenplayElementType, string> = {
  scene_heading: "Scene heading",
  action: "Action",
  character: "Character",
  dialogue: "Dialogue",
  parenthetical: "Parenthetical",
  transition: "Transition",
  shot: "Shot",
  lyrics: "Lyrics",
  page_break: "Page break",
};
const SHORTCUT_TYPES: Partial<Record<string, ScreenplayElementType>> = {
  "1": "scene_heading",
  "2": "action",
  "3": "character",
  "4": "parenthetical",
  "5": "dialogue",
  "6": "transition",
  "7": "shot",
  "8": "shot",
};
type SaveState = "saved" | "unsaved" | "saving" | "error";
type EditorView = "screenplay" | "scene" | "continuous";
interface EditorSession {
  view: EditorView;
  sceneId: string;
  elementId?: string;
  caret?: number;
  scrollTop?: number;
}

export function ScreenplayWorkspaceView({
  initialWorkspace,
  term,
  onWorkspace,
  onBack,
}: {
  initialWorkspace: ProjectWorkspace;
  term(key: string): string;
  onWorkspace(workspace: ProjectWorkspace): void;
  onBack(): void;
}) {
  const recentScreenplayKey = `screenplay-editor-active:${initialWorkspace.project.id}`;
  const recentScreenplayId = localStorage.getItem(recentScreenplayKey);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [recoveryGeneration,setRecoveryGeneration]=useState(0);
  const workspaceRef = useRef(workspace); workspaceRef.current = workspace;
  const [storyState, setStoryState] = useState<SaveState>("saved");
  const [activeId, setActiveId] = useState(
    initialWorkspace.screenplays.some((item) => item.id === recentScreenplayId)
      ? recentScreenplayId!
      : (initialWorkspace.screenplays[0]?.id ?? ""),
  );
  const seasons = workspace.project.series?.seasons ?? [];
  useEffect(() => {
    const listener = (event: Event) => {
      const sceneId = (event as CustomEvent<string>).detail;
      const document = workspaceRef.current.screenplays.find(item => item.scenes.some(scene => scene.id === sceneId));
      if (!document) return;
      const key = 'screenplay-editor-session:' + document.id;
      const existing = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(key, JSON.stringify({ ...existing, sceneId }));
      selectScreenplay(document.id);
    };
    window.addEventListener('profile-navigate-scene', listener);
    return () => window.removeEventListener('profile-navigate-scene', listener);
  });
  const activeEpisodeSeason = seasons.find((season) =>
    season.episodes.some((episode) => episode.screenplayId === activeId),
  );
  const [activeSeasonId, setActiveSeasonId] = useState(
    activeEpisodeSeason?.id ?? seasons[0]?.id ?? "",
  );
  const activeSeason =
    seasons.find((season) => season.id === activeSeasonId) ?? seasons[0];
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [editingEpisodeTitle, setEditingEpisodeTitle] = useState("");
  const [editingState, setEditingState] = useState<SaveState>("saved");
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (document.body.dataset.closeReady!=="true" && (editingState !== "saved" || storyState !== "saved")) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [editingState, storyState]);
  const active =
    workspace.screenplays.find((screenplay) => screenplay.id === activeId) ??
    workspace.screenplays[0];
  const updateWorkspace = (next: ProjectWorkspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
    onWorkspace(next);
  };
  const createEpisode = async () => {
    await flushProjectEdits();
    if (!episodeTitle.trim() || !activeSeason) return;
    const next = await window.desktop.createEpisode(
      workspace.project.id,
      activeSeason.id,
      episodeTitle.trim(),
    );
    const episode = next.project.series?.seasons
      .find((season) => season.id === activeSeason.id)
      ?.episodes.at(-1);
    const id = episode?.screenplayId ?? "";
    updateWorkspace(next);
    setActiveId(id);
    localStorage.setItem(recentScreenplayKey, id);
    setEpisodeTitle("");
  };
  const saveScreenplay = async (screenplay: ScreenplayRecord) => {
    const saved = await window.desktop.saveScreenplay(
      workspace.project.id,
      screenplay,
    );
    updateWorkspace({
      ...workspaceRef.current,
      screenplays: workspaceRef.current.screenplays.map((item) =>
        item.id === saved.id ? saved : item,
      ),
    });
    return saved;
  };
  const canLeave = async () => {try{await flushProjectEdits();await window.desktop.projectHistory?.(workspace.project.id,{action:'release'});return true;}catch{return false;}};
  useEffect(()=>{const restored=(event:Event)=>{const next=(event as CustomEvent<ProjectWorkspace>).detail;if(next.project.id!==workspace.project.id)return;updateWorkspace(next);setRecoveryGeneration(v=>v+1);};window.addEventListener('history-workspace-restored',restored);return()=>window.removeEventListener('history-workspace-restored',restored);},[workspace.project.id]);
  const selectScreenplay = async (id: string) => {
    if (id === activeId || await canLeave()) {
      setEditingState("saved");
      setStoryState("saved");
      setActiveId(id);
      localStorage.setItem(recentScreenplayKey, id);
    }
  };
  useEffect(() => {
    if (workspace.project.projectType !== "series") return;
    const header = document.querySelector<HTMLElement>(".workspace-topbar");
    if (!header) return;
    header.querySelector(".season-navigation")?.remove();
    const navigation = document.createElement("div");
    navigation.className = "season-navigation";
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Current ${term("series")}`);
    seasons.forEach((season, index) => {
      const option = document.createElement("option");
      option.value = season.id;
      option.textContent = `${term("series")} ${index + 1}${season.title ? `: ${season.title}` : ""}`;
      select.append(option);
    });
    select.value = activeSeason?.id ?? "";
    select.onchange = () => {
      const season = seasons.find((item) => item.id === select.value);
      setActiveSeasonId(select.value);
      if (season?.episodes[0])
        selectScreenplay(season.episodes[0].screenplayId);
    };
    navigation.append(select);
    const add = document.createElement("button");
    add.textContent = "+";
    add.title = `Add ${term("series")}`;
    add.setAttribute("aria-label", `Add ${term("series")}`);
    add.onclick = async () => {
      const next = await window.desktop.createSeason(workspace.project.id);
      updateWorkspace(next);
      setActiveSeasonId(next.project.series!.seasons.at(-1)!.id);
    };
    navigation.append(add);
    const up = document.createElement("button");
    up.textContent = "↑";
    up.title = `Move ${term("series")} up`;
    up.onclick = async () => {
      if (activeSeason)
        updateWorkspace(
          await window.desktop.reorderSeason(
            workspace.project.id,
            activeSeason.id,
            activeSeason.order - 1,
          ),
        );
    };
    navigation.append(up);
    const down = document.createElement("button");
    down.textContent = "↓";
    down.title = `Move ${term("series")} down`;
    down.onclick = async () => {
      if (activeSeason)
        updateWorkspace(
          await window.desktop.reorderSeason(
            workspace.project.id,
            activeSeason.id,
            activeSeason.order + 1,
          ),
        );
    };
    navigation.append(down);
    if (
      active &&
      activeSeason?.episodes.some(
        (episode) => episode.screenplayId === active.id,
      )
    ) {
      const episode = activeSeason.episodes.find(
        (item) => item.screenplayId === active.id,
      )!;
      const episodeUp = document.createElement("button");
      episodeUp.textContent = "E↑";
      episodeUp.title = `Move ${term("episode")} up`;
      episodeUp.onclick = async () =>
        updateWorkspace(
          await window.desktop.moveEpisode(
            workspace.project.id,
            episode.id,
            activeSeason.id,
            episode.order - 1,
          ),
        );
      navigation.append(episodeUp);
      const episodeDown = document.createElement("button");
      episodeDown.textContent = "E↓";
      episodeDown.title = `Move ${term("episode")} down`;
      episodeDown.onclick = async () =>
        updateWorkspace(
          await window.desktop.moveEpisode(
            workspace.project.id,
            episode.id,
            activeSeason.id,
            episode.order + 1,
          ),
        );
      navigation.append(episodeDown);
      const move = document.createElement("select");
      move.setAttribute("aria-label", `Move ${term("episode")} to`);
      const placeholder = document.createElement("option");
      placeholder.textContent = `Move ${term("episode")}…`;
      placeholder.value = "";
      move.append(placeholder);
      seasons
        .filter((season) => season.id !== activeSeason.id)
        .forEach((season, index) => {
          const option = document.createElement("option");
          option.value = season.id;
          option.textContent = `${term("series")} ${season.order + 1}`;
          move.append(option);
        });
      move.onchange = async () => {
        if (!move.value) return;
        const target = seasons.find((season) => season.id === move.value)!;
        const next = await window.desktop.moveEpisode(
          workspace.project.id,
          episode.id,
          target.id,
          target.episodes.length,
        );
        updateWorkspace(next);
        setActiveSeasonId(target.id);
      };
      navigation.append(move);
    }
    header.append(navigation);
    return () => {
      navigation.remove();
    };
  }, [workspace, activeSeasonId, activeId]);
  return (
    <div className="workspace-shell">
      <header className="workspace-topbar">
        <button
          className="back-button"
          onClick={async () => {
            if (await canLeave()) onBack();
          }}
        >
          <ArrowLeft />
          Library
        </button>
        <div>
          <span className="pill">{workspace.project.projectType}</span>
          <b>{workspace.project.title}</b>
        </div>
      </header>
      {!active ? (
        <section className="episode-empty">
          <FilePlus2 />
          <div className="eyebrow">SERIES SCREENPLAYS</div>
          <h1>Begin with an episode.</h1>
          <p>Each episode has its own screenplay.</p>
          <div>
            <input
              aria-label="Episode title"
              value={episodeTitle}
              onChange={(event) => setEpisodeTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createEpisode();
              }}
              placeholder="Episode title"
            />
            <button
              className="primary"
              disabled={!episodeTitle.trim()}
              onClick={() => void createEpisode()}
            >
              <Plus />
              Create episode
            </button>
          </div>
        </section>
      ) : (
        <ScreenplayEditor
          key={active.id+":"+recoveryGeneration}
          initial={active}
          workspace={workspace}
          plotTerm={term('plot') === 'plot' ? 'Plot' : term('plot')}
          timelineTerm={term('story_timeline') === 'story_timeline' ? 'Story Timeline' : term('story_timeline')}
          onStoryState={setStoryState}
          onStorySaved={story => updateWorkspace({ ...workspaceRef.current, story })}
          onSave={saveScreenplay}
          onSaveState={setEditingState}
          episodeNavigation={workspace.project.projectType === "series" ? (
            <section className="episode-navigation">
              <div className="navigator-title"><span>EPISODES</span></div>
              {activeSeason?.episodes.map((episode, index) => (
                <div className={`episode-row ${episode.screenplayId === active.id ? "active" : ""}`} key={episode.id}>
                  {editingEpisodeId === episode.id ? <input className="episode-rename" aria-label={`Rename ${episode.title}`} autoFocus value={editingEpisodeTitle} onChange={(event) => setEditingEpisodeTitle(event.target.value)} onBlur={async () => { if (editingEpisodeTitle.trim() && editingEpisodeTitle.trim() !== episode.title) updateWorkspace(await window.desktop.renameEpisode(workspace.project.id, episode.id, editingEpisodeTitle.trim())); setEditingEpisodeId(null); }} onKeyDown={async (event) => { if (event.key === "Escape") setEditingEpisodeId(null); if (event.key === "Enter") { event.preventDefault(); if (editingEpisodeTitle.trim()) updateWorkspace(await window.desktop.renameEpisode(workspace.project.id, episode.id, editingEpisodeTitle.trim())); setEditingEpisodeId(null); } }} /> : <button onClick={() => selectScreenplay(episode.screenplayId)}><span>{index + 1}</span><b>{episode.title}</b></button>}
                  <div className="episode-actions"><button aria-label={`Move ${episode.title} up`} disabled={index === 0} onClick={async () => updateWorkspace(await window.desktop.moveEpisode(workspace.project.id, episode.id, activeSeason.id, index - 1))}><ArrowUp /></button><button aria-label={`Move ${episode.title} down`} disabled={index === activeSeason.episodes.length - 1} onClick={async () => updateWorkspace(await window.desktop.moveEpisode(workspace.project.id, episode.id, activeSeason.id, index + 1))}><ArrowDown /></button><button aria-label={`Edit ${episode.title}`} onClick={() => { setEditingEpisodeId(episode.id); setEditingEpisodeTitle(episode.title); }}>✎</button></div>
                </div>
              ))}
              <div className="episode-add">
                <input aria-label="New episode title" value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createEpisode(); }} placeholder="New episode" />
                <button aria-label="Create episode" disabled={!episodeTitle.trim()} onClick={() => void createEpisode()}><Plus /></button>
              </div>
            </section>
          ) : undefined}
        />
      )}
    </div>
  );
}

function ScreenplayEditor({
  initial, workspace, plotTerm, timelineTerm, onStoryState, onStorySaved,
  onSave,
  onSaveState,
  episodeNavigation,
}: {
  initial: ScreenplayRecord;
  workspace: ProjectWorkspace;
  plotTerm: string;
  timelineTerm: string;
  onStoryState(state: SaveState): void;
  onStorySaved(story: StoryRecord): void;
  onSave(screenplay: ScreenplayRecord): Promise<ScreenplayRecord>;
  onSaveState(state: SaveState): void;
  episodeNavigation?: ReactNode;
}) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [worldDraft, setWorldDraft] = useState(workspace.story);
  const [storySaveState, setStorySaveState] = useState<SaveState>("saved");
  const [storySceneId, setStorySceneId] = useState<string | undefined>();
  const sessionKey = `screenplay-editor-session:${initial.id}`;
  let restored: EditorSession | null = null;
  try {
    restored = JSON.parse(localStorage.getItem(sessionKey) ?? "null");
  } catch {
    restored = null;
  }
  const normalizedInitial = useRef(normalizeSceneBoundaries(initial));
  const normalizedInitialNeedsSave = useRef(normalizedInitial.current !== initial);
  const [screenplay, setScreenplay] = useState(normalizedInitial.current);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SceneRecord | null>(null);
  const [editorView, setEditorView] = useState<EditorView>(
    restored?.view ?? "screenplay",
  );
  const [activeSceneId, setActiveSceneId] = useState(
    restored?.sceneId ?? normalizedInitial.current.scenes[0].id,
  );
  const [locationFilter, setLocationFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(`screenplay-sidebar-collapsed:${initial.id}`) === "true",
  );
  const [notesVisible, setNotesVisible] = useState(
    () => localStorage.getItem(`screenplay-notes-visible:${initial.id}`) !== "false",
  );
  const [locationCardsVisible, setLocationCardsVisible] = useState(
    () => localStorage.getItem(`screenplay-location-cards-visible:${initial.id}`) !== "false",
  );
  const [characterCardsVisible, setCharacterCardsVisible] = useState(
    () => localStorage.getItem(`screenplay-character-cards-visible:${initial.id}`) !== "false",
  );
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWords, setWholeWords] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [scope, setScope] = useState<SearchScope>("screenplay");
  const [resultIndex, setResultIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeElement, setActiveElement] = useState<{ id: string; type: ScreenplayElementType } | null>(null);
  const [sceneMenu, setSceneMenu] = useState<{
    x: number;
    y: number;
    sceneId: string;
  } | null>(null);
  const copiedScene = useRef<string | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutErrors, setLayoutErrors] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editVersion = useRef(0);
  const current = useRef(screenplay);
  current.current = screenplay;
  const sceneRefs = useRef(new Map<string, HTMLElement>());
  const scrollRef = useRef<HTMLElement>(null);
  const pendingSave=useRef<ScreenplayRecord|undefined>(undefined);
  const saveQueue=useRef(Promise.resolve());
  const latestSave=useRef(onSave);latestSave.current=onSave;
  const historyFocus=useRef(activeSceneId);
  const [historyCaretSceneId,setHistoryCaretSceneId]=useState(activeSceneId);
  const persistPending=async()=>{if(timer.current)clearTimeout(timer.current);const next=pendingSave.current;if(!next){await saveQueue.current;return;}pendingSave.current=undefined;const version=editVersion.current;const task=saveQueue.current.catch(()=>{}).then(async()=>{reportState('saving');try{const saved=await latestSave.current(next);if(editVersion.current===version){setScreenplay(saved);current.current=saved;reportState('saved');} }catch(error){pendingSave.current=current.current;reportState('error');setSaveError(String(error));throw error;}});saveQueue.current=task;await task;};
  useEffect(()=>{const flush=(event:Event)=>{(event as CustomEvent<Promise<unknown>[]>).detail.push(persistPending().then(()=>window.desktop.projectHistory?.(workspace.project.id,{action:'finish',screenplayId:initial.id})));};window.addEventListener('project-flush',flush);window.desktop.onCloseRequest?.(()=>flushProjectEdits().then(()=>window.desktop.projectHistory?.(workspace.project.id,{action:'release'})).then(()=>{document.body.dataset.closeReady='true';}));return()=>{window.removeEventListener('project-flush',flush);window.desktop.onCloseRequest?.(undefined);};},[]);
  useEffect(()=>{const renew=()=>void window.desktop.projectHistory?.(workspace.project.id,{action:'heartbeat'}).catch(()=>{});renew();const heartbeat=setInterval(renew,30000);return()=>clearInterval(heartbeat);},[workspace.project.id]);
  useEffect(()=>{if(activeSceneId!==historyFocus.current){const previousSceneId=historyFocus.current;historyFocus.current=activeSceneId;setHistoryCaretSceneId(activeSceneId);void persistPending().then(()=>window.desktop.projectHistory?.(workspace.project.id,{action:'finish',screenplayId:initial.id,sceneId:previousSceneId})).catch(()=>{});}},[activeSceneId]);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const undoStack = useRef<ScreenplayRecord[]>([]);
  const redoStack = useRef<ScreenplayRecord[]>([]);
  const sceneLocations = useMemo(() => [...new Set(screenplay.scenes.map(sceneLocation))].sort(), [screenplay.scenes]);
  const activeLocationFilter = sceneLocations.includes(locationFilter) ? locationFilter : "all";
  const sidebarScenes = screenplay.scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => activeLocationFilter === "all" || sceneLocation(scene) === activeLocationFilter);
  const lastTransaction = useRef<{ key?: string; at: number }>({ at: 0 });
  const persistSession = (patch: Partial<EditorSession> = {}) =>
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        view: editorView,
        sceneId: activeSceneId,
        scrollTop: scrollRef.current?.scrollTop ?? 0,
        ...patch,
      }),
    );
  useEffect(() => {
    onSaveState("saved");
    if (restored?.scrollTop)
      setTimeout(() => {
        if (scrollRef.current)
          scrollRef.current.scrollTop = restored.scrollTop!;
      }, 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    persistSession();
  }, [editorView, activeSceneId]);
  useEffect(() => {
    const detail = { character: characterCardsVisible, location: locationCardsVisible };
    document.body.dataset.characterCardsVisible = String(detail.character);
    document.body.dataset.locationCardsVisible = String(detail.location);
    window.dispatchEvent(new CustomEvent("profile-card-visibility", { detail }));
  }, [characterCardsVisible, locationCardsVisible]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (optionsRef.current?.open && event.target instanceof Node && !optionsRef.current.contains(event.target)) optionsRef.current.open = false; };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    const seasons = workspace.project.series?.seasons.map((season, index) => ({ id: season.id, label: `Series ${index + 1}`, screenplayIds: season.episodes.map(episode => episode.screenplayId) })) ?? [];
    window.dispatchEvent(new CustomEvent('profile-scope-context', { detail: { projectType: workspace.project.projectType, activeSceneId, historySceneId:editorView==='scene'?activeSceneId:historyCaretSceneId, activeScreenplayId: screenplay.id, seasons } }));
  }, [workspace.project.projectType, workspace.project.series, activeSceneId, historyCaretSceneId, editorView, screenplay.id]);
  useEffect(() => {
    const track = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id) {setHistoryCaretSceneId(id);if(id!==historyFocus.current){const previousSceneId=historyFocus.current;historyFocus.current=id;void persistPending().then(()=>window.desktop.projectHistory?.(workspace.project.id,{action:'finish',screenplayId:initial.id,sceneId:previousSceneId})).catch(()=>{});}setActiveSceneId(id);}
    };
    window.addEventListener("screenplay-scene-focus", track);
    return () => window.removeEventListener("screenplay-scene-focus", track);
  }, []);
  useEffect(() => {
    document.body.dataset.editorView = editorView;window.dispatchEvent(new Event('editor-view-changed'));
    const viewGroup = document.querySelector(".view-switch");
    let continuous = viewGroup?.querySelector<HTMLButtonElement>(
      "[data-continuous-view]",
    );
    if (!continuous && viewGroup) {
      continuous = document.createElement("button");
      continuous.dataset.continuousView = "true";
      continuous.textContent = "Continuous";
      viewGroup.append(continuous);
    }
    if (continuous) {
      continuous.classList.toggle("active", editorView === "continuous");
      continuous.onclick = () => switchView("continuous");
    }
    const host = document.querySelector<HTMLElement>(".workspace-topbar");
    let toolbar = host?.querySelector<HTMLElement>(".shared-format-toolbar");
    if (!toolbar && host) {
      toolbar = document.createElement("div");
      toolbar.className = "shared-format-toolbar header-format-toolbar";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", "Screenplay formatting");
      for (const [command, label, title] of [
        ["bold", "B", "Bold"],
        ["italic", "I", "Italic"],
        ["underline", "U", "Underline"],
        ["strike", "S", "Strikethrough"],
        ["upper", "AA", "Uppercase"],
        ["lower", "aa", "Lowercase"],
        ["left", "≡", "Align Left"],
        ["center", "≡", "Align Centre"],
        ["right", "≡", "Align Right"],
        ["justify", "☰", "Justify"],
        ["clear", "×", "Remove Formatting"],
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.formatCommand = command;
        button.className = `format-${command}`;
        button.textContent = label;
        button.title = title;
        button.setAttribute("aria-label", title);
        toolbar.append(button);
      }
      for (const [command, title, value] of [
        ["color", "Text colour", "#000000"],
        ["backgroundColor", "Text background colour", "#ffff00"],
      ] as const) {
        const label = document.createElement("label");
        label.className = `format-colour format-${command}`;
        label.title = title;
        label.setAttribute("aria-label", title);
        const input = document.createElement("input");
        input.type = "color";
        input.dataset.formatCommand = command;
        input.value = value;
        label.append(input);
        toolbar.insertBefore(label, toolbar.querySelector(".format-left"));
      }
      host.insertBefore(toolbar, host.querySelector(".episode-quick-add"));
    }
    if (toolbar) {
      const invoke = (event: Event) => {
        const control = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-format-command]",
        );
        if (!control) return;
        event.preventDefault();
        const command = control.dataset.formatCommand;
        const value =
          control instanceof HTMLInputElement ? control.value : undefined;
        window.dispatchEvent(
          new CustomEvent("screenplay-format", { detail: { command, value } }),
        );
      };
      toolbar.onpointerdown = (event) => {
        if (
          (event.target as HTMLElement).closest("button[data-format-command]")
        )
          event.preventDefault();
      };
      toolbar.onclick = (event) => {
        if (
          (event.target as HTMLElement).closest("button[data-format-command]")
        )
          invoke(event);
      };
      toolbar.oninput = (event) => {
        if ((event.target as HTMLElement).matches("input[data-format-command]"))
          invoke(event);
      };
    }
    return () => {
      delete document.body.dataset.editorView;
    };
  }, [editorView]);
  const reportState = (state: SaveState) => {
    setSaveState(state);
    onSaveState(state);
  };
  const commit = (
    next: ScreenplayRecord,
    recordHistory = true,
    transactionKey?: string,
  ) => {
    next = normalizeSceneHeadings(next);
    const now = Date.now();
    const grouped =
      transactionKey &&
      lastTransaction.current.key === transactionKey &&
      now - lastTransaction.current.at < 1200;
    if (recordHistory && !grouped) {
      undoStack.current.push(current.current);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
    }
    lastTransaction.current = { key: transactionKey, at: now };
    const version = ++editVersion.current;
    setScreenplay(next);
    current.current = next;
    reportState("unsaved");
    setSaveError("");
    if (timer.current) clearTimeout(timer.current);
    pendingSave.current=next;
    timer.current=setTimeout(()=>{void persistPending().catch(()=>{});},800);
  };
  useEffect(() => {
    if (!normalizedInitialNeedsSave.current) return;
    normalizedInitialNeedsSave.current = false;
    commit(current.current, false, "normalize-scene-boundaries");
  }, []);
  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(current.current);
    commit(previous, false);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(current.current);
    commit(next, false);
  };
  useEffect(() => {
    const focusElement = (id: string, caret: number) => setTimeout(() => {
      const root = document.querySelector<HTMLElement>(`[data-element-id="${id}"], [data-source-element-id="${id}"] .element-editor`);
      if (!root) return;
      requestAnimationFrame(() => { root.focus(); restoreSelection(root, [caret, caret]); });
    }, 0);
    const focused = (event: Event) => setActiveElement((event as CustomEvent<{ id: string; type: ScreenplayElementType }>).detail);
    const structural = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string; id: string; offset?: number; type?: ScreenplayElementType }>).detail;
      const source = current.current;
      if ((detail.action === "type" || detail.action === "shortcut") && detail.type === "scene_heading") {
        const sourceScene = source.scenes.find((scene) => scene.elements.some((element) => element.id === detail.id));
        if (!sourceScene) return;
        const next = insertScene(source, sourceScene.id);
        const created = next.scenes[sourceScene.order + 1];
        const headingId = created.elements[0].id;
        setActiveSceneId(created.id);
        setActiveElement({ id: headingId, type: "scene_heading" });
        commit(next);
        focusElement(headingId, 0);
        return;
      }
      if (detail.action === "type" && detail.type) {
        setActiveElement({ id: detail.id, type: detail.type });
        let next = transformElement(source, detail.id, detail.type);
        if (detail.type === "parenthetical") next = { ...next, scenes: next.scenes.map((scene) => ({ ...scene, elements: scene.elements.map((element) => element.id === detail.id && !element.content ? { ...element, content: parentheticalContent("") } : element) })) };
        commit(next);
        focusElement(detail.id, detail.type === "parenthetical" ? 1 : detail.offset ?? 0);
      } else if (detail.action === "shortcut" && detail.type) {
        const currentElement = source.scenes.flatMap((scene) => scene.elements).find((element) => element.id === detail.id);
        if (!currentElement) return;
        if (!currentElement.content.trim()) {
          let next = transformElement(source, detail.id, detail.type);
          if (detail.type === "parenthetical") next = { ...next, scenes: next.scenes.map((scene) => ({ ...scene, elements: scene.elements.map((element) => element.id === detail.id ? { ...element, content: "()" } : element) })) };
          setActiveElement({ id: detail.id, type: detail.type });
          commit(next);
          focusElement(detail.id, detail.type === "parenthetical" ? 1 : 0);
        } else {
          const result = splitElement(source, detail.id, detail.offset ?? currentElement.content.length, detail.type);
          let next = result.screenplay;
          if (detail.type === "parenthetical") next = { ...next, scenes: next.scenes.map((scene) => ({ ...scene, elements: scene.elements.map((element) => element.id === result.focusId && !element.content ? { ...element, content: "()" } : element) })) };
          commit(next);
          focusElement(result.focusId, detail.type === "parenthetical" ? 1 : 0);
        }
      } else if (detail.action === "split") {
        const result = splitElement(source, detail.id, detail.offset ?? 0);
        commit(result.screenplay);
        focusElement(result.focusId, 0);
      } else if (detail.action === "backward" || detail.action === "forward") {
        const result = joinAtBoundary(source, detail.id, detail.action);
        if (result.screenplay !== source) commit(result.screenplay);
        focusElement(result.focusId, result.caret);
      }
    };
    window.addEventListener("screenplay-element-focus", focused);
    window.addEventListener("screenplay-structure", structural);
    return () => { window.removeEventListener("screenplay-element-focus", focused); window.removeEventListener("screenplay-structure", structural); };
  });
  const layout = useMemo(() => resolveLayout(
    screenplay.layout,
    navigator.language === "en-US" ? "en-US" : "en-GB",
  ), [screenplay.layout]);
  const updateLayout = (next: ScreenplayLayout) => {
    const errors = validateLayout(next);
    setLayoutErrors(errors);
    if (!errors.length) commit({ ...screenplay, layout: next });
  };
  const changePaper = (paperSize: PaperSize) => {
    setLayoutErrors([]);
    commit({ ...screenplay, layout: professionalLayout(paperSize) });
  };
  const activeScene =
    screenplay.scenes.find((scene) => scene.id === activeSceneId) ??
    screenplay.scenes[0];
  const renderedScene = (id: string) =>
    sceneRefs.current.get(id) ??
    [...(scrollRef.current?.querySelectorAll<HTMLElement>(".screenplay-scene[data-scene-id]") ?? [])]
      .find((node) => node.dataset.sceneId === id);
  const scrollToScene = (id: string) => {
    setActiveSceneId(id);
    persistSession({ sceneId: id });
    if (editorView !== "scene")
      setTimeout(
        () =>
          renderedScene(id)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
  };
  const switchView = (view: EditorView) => {
    setEditorView(view);
    persistSession({ view });
    if (view !== "scene")
      setTimeout(
        () =>
          renderedScene(activeScene.id)?.scrollIntoView({ block: "start" }),
        0,
      );
  };
  const addScene = (afterId?: string) => {
    const next = insertScene(screenplay, afterId);
    commit(next);
    const index = afterId
      ? next.scenes.findIndex((scene) => scene.id === afterId) + 1
      : next.scenes.length - 1;
    setActiveSceneId(next.scenes[index].id);
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    try {
      const next = deleteScene(screenplay, pendingDelete.id);
      commit(next);
      setActiveSceneId(
        next.scenes[Math.min(pendingDelete.order, next.scenes.length - 1)].id,
      );
    } finally {
      setPendingDelete(null);
    }
  };
  const moveActive = (direction: -1 | 1) => {
    const index = screenplay.scenes.findIndex(
      (scene) => scene.id === activeScene.id,
    );
    commit(reorderScene(screenplay, activeScene.id, index + direction));
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const command = resolveEditorCommand(event);
      if (!command) return;
      const editable = (event.target as HTMLElement)?.isContentEditable;
      if (command === "search.find" || command === "search.replace") {
        event.preventDefault();
        setFindOpen(true);
        setReplaceOpen(command === "search.replace");
      } else if (!editable && command === "history.undo") {
        event.preventDefault();
        undo();
      } else if (!editable && command === "history.redo") {
        event.preventDefault();
        redo();
      } else if (command === "view.screenplay") {
        event.preventDefault();
        switchView("screenplay");
      } else if (command === "view.scene") {
        event.preventDefault();
        switchView("scene");
      } else if (command === "view.continuous") {
        event.preventDefault();
        switchView("continuous");
      } else if (command === "scene.moveUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (command === "scene.moveDown") {
        event.preventDefault();
        moveActive(1);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  const searchSceneId = scope === "scene" ? activeScene.id : undefined;
  const occurrences = useMemo(
    () => findOccurrences(screenplay, query, scope, searchSceneId, { caseSensitive, wholeWords }),
    [screenplay, query, scope, searchSceneId, caseSensitive, wholeWords],
  );
  const statistics = useMemo(
    () => screenplayStatistics(screenplay),
    [screenplay],
  );
  const goResult = (delta: number) => {
    if (!occurrences.length) return;
    const index =
      (resultIndex + delta + occurrences.length) % occurrences.length;
    setResultIndex(index);
    setActiveSceneId(occurrences[index].sceneId);
  };
  const activeSearchMatch = findOpen ? occurrences[Math.min(resultIndex, Math.max(0, occurrences.length - 1))] : undefined;
  useEffect(() => { setResultIndex(0); }, [query, caseSensitive, wholeWords, scope]);
  useEffect(() => {
    if (activeSearchMatch) {
      setActiveSceneId(activeSearchMatch.sceneId);
      if (editorView === 'screenplay' && activeLocationFilter !== 'all') setLocationFilter('all');
    }
  }, [activeSearchMatch?.sceneId, findOpen]);

  const performReplace = (all: boolean) => {
    const result = replaceOccurrences(
      screenplay,
      query,
      replacement,
      scope,
      activeScene.id,
      all,
      { caseSensitive, wholeWords },
    );
    if (result.count) commit(result.screenplay);
    setNotice(`${result.count} replacement${result.count === 1 ? "" : "s"}`);
  };
  const copyScene = async (id: string) => {
    copiedScene.current = id;
    const scene = screenplay.scenes.find((item) => item.id === id);
    if (scene)
      await navigator.clipboard?.writeText(
        scene.elements.map((element) => element.content).join("\n"),
      );
  };
  const formatStyle = {
    ...layoutCss(layout),
    "--scene-gap": `${SCREENPLAY_FORMAT.sceneGapEm}em`,
  } as CSSProperties;
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "unsaved"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Save failed"
          : "Saved";
  const visibleScenes =
    editorView === "scene"
        ? [activeScene]
        : editorView === "screenplay" && activeLocationFilter !== "all"
          ? screenplay.scenes.filter((scene) => sceneLocation(scene) === activeLocationFilter)
          : screenplay.scenes;
  const contextScene = sceneMenu
    ? screenplay.scenes.find((scene) => scene.id === sceneMenu.sceneId)
    : undefined;
  const paginatedPages = useMemo(
    () =>
      paginateScreenplay(
        screenplay,
        layout,
        screenplay.showDialogueContinuations !== false,
      ),
    [screenplay, layout],
  );
  useEffect(() => {
    if (editorView === 'scene') setCurrentPage(paginatedPages.find(page => page.entries.some(entry => entry.sceneId === activeScene.id))?.number ?? 1);
    else setCurrentPage(current => Math.min(current, paginatedPages.length));
  }, [editorView, activeScene.id, paginatedPages]);
  return (
    <div
      className={`screenplay-layout writing-layout${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
      onClick={() => sceneMenu && setSceneMenu(null)}
    >
      <StoryPanel onDraft={setWorldDraft} characterCardsVisible={characterCardsVisible} locationCardsVisible={locationCardsVisible} onOpen={() => { setStorySceneId(undefined); setStoryOpen(true); }} navigateScene={id => { if (screenplay.scenes.some(scene => scene.id === id)) { setLocationFilter("all"); setActiveSceneId(id); requestAnimationFrame(() => document.querySelector(`[data-scene-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" })); } else window.dispatchEvent(new CustomEvent("profile-navigate-scene", { detail: id })); }} workspace={workspace} screenplay={screenplay} open={storyOpen} sceneId={storySceneId} plotTerm={plotTerm} timelineTerm={timelineTerm} onClose={() => setStoryOpen(false)} onState={state => { setStorySaveState(state); onStoryState(state); }} onSaved={onStorySaved} />
      <aside className={`scene-navigator${sidebarCollapsed ? " collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-collapse"
          aria-label={sidebarCollapsed ? "Expand scene sidebar" : "Collapse scene sidebar"}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed((collapsed) => {
            const next = !collapsed;
            localStorage.setItem(`screenplay-sidebar-collapsed:${initial.id}`, String(next));
            return next;
          })}
        >
          {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
        {episodeNavigation}
        <div className="navigator-title">
          <span>SCENES</span>
          <button aria-label="Add scene" onClick={() => addScene()}>
            <Plus />
          </button>
        </div>
        <label className="scene-location-filter">
          <span>Location</span>
          <select aria-label="Filter scenes by location" value={activeLocationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
            <option value="all">All locations</option>
            {sceneLocations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </label>
        {sidebarScenes.map(({ scene, index }) => (
          <div
            key={scene.id}
            className={`scene-nav-row${activeScene.id === scene.id ? " active" : ""}${dragTarget === index ? " drag-target" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragTarget(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/x-scene-id");
              commit(reorderScene(screenplay, id, index));
              setActiveSceneId(id);
              setDragTarget(null);
            }}
          >
            <button
              type="button"
              draggable
              className="scene-nav-target"
              onDragStart={(event) =>
                event.dataTransfer.setData("text/x-scene-id", scene.id)
              }
              onClick={() => scrollToScene(scene.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setSceneMenu({
                  x: event.clientX,
                  y: event.clientY,
                  sceneId: scene.id,
                });
              }}
            >
              <span>{index + 1}</span>
              <b>{sceneHeading(scene, index + 1)}</b>
            </button>
            {scene.locked && (
              <button
                type="button"
                className="scene-nav-unlock"
                aria-label={`Unlock scene ${index + 1}`}
                title="Unlock scene"
                onClick={(event) => {
                  event.stopPropagation();
                  commit(updateScene(screenplay, scene.id, (item) => ({ ...item, locked: false })));
                }}
              >
                <Lock aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </aside>
        <header className="screenplay-heading writing-header">
          <CompactEpisodeTitle title={screenplay.title} />
          <button className="layout-button" onClick={() => { setStorySceneId(undefined); setStoryOpen(true); }}>{timelineTerm}{storySaveState === "error" ? " · Save failed" : storySaveState !== "saved" ? " · Saving…" : ""}</button>
          <div className="editor-heading-tools">
            <label className="current-element-control">
              <span>Element</span>
              <select
                aria-label="Current screenplay element"
                disabled={!activeElement}
                value={activeElement?.type ?? "action"}
                onChange={(event) => activeElement && window.dispatchEvent(new CustomEvent("screenplay-element-type", { detail: { id: activeElement.id, type: event.target.value as ScreenplayElementType } }))}
              >
                {Object.entries(ELEMENT_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
              </select>
            </label>
            <button
              className="layout-button"
              onClick={() => setLayoutOpen(true)}
            >
              Layout
            </button>
            <div className="view-switch" role="group" aria-label="Editor view">
              <button
                className={editorView === "screenplay" ? "active" : ""}
                onClick={() => switchView("screenplay")}
              >
                Screenplay
              </button>
              <button
                className={editorView === "scene" ? "active" : ""}
                onClick={() => switchView("scene")}
              >
                Scene
              </button>
            </div>
            <button
              className="find-button"
              aria-label="Find"
              onClick={() => setFindOpen(true)}
            >
              <Search />
            </button>

          </div>
        </header>
      <main
        className="screenplay-scroll"
        ref={scrollRef}
        onScroll={(event) => { persistSession(); const node = event.currentTarget; const top = node.getBoundingClientRect().top;const blocks=Array.from(node.querySelectorAll<HTMLElement>('.continuous-block[data-scene-id],.screenplay-scene[data-scene-id]'));const viewed=blocks.find(e=>e.getBoundingClientRect().bottom>top+80)?.dataset.sceneId;if(viewed)window.dispatchEvent(new CustomEvent('screenplay-history-scroll',{detail:viewed})); const elements = Array.from(node.querySelectorAll<HTMLElement>('[data-page-number],.pagination-boundary')); const visible = elements.filter(element => element.getBoundingClientRect().top <= top + 80).at(-1) ?? elements[0]; if (visible) setCurrentPage(Number(visible.dataset.pageNumber)); }}
      >
        {findOpen && (
          <div className="find-panel">
            <input
              autoFocus
              aria-label="Find text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResultIndex(0);
              }}
              placeholder="Find in screenplay"
            />
            <span>
              {occurrences.length
                ? `${resultIndex + 1} / ${occurrences.length}`
                : "0 results"}
            </span>
            <label className="find-option"><input type="checkbox" checked={caseSensitive} onChange={event => setCaseSensitive(event.target.checked)} />Case sensitive</label>
            <label className="find-option"><input type="checkbox" checked={wholeWords} onChange={event => setWholeWords(event.target.checked)} />Whole words only</label>
            <button onClick={() => goResult(-1)}>Previous</button>
            <button onClick={() => goResult(1)}>Next</button>
            <button onClick={() => setReplaceOpen(!replaceOpen)}>
              Replace
            </button>
            <button aria-label="Close find" onClick={() => setFindOpen(false)}>
              ×
            </button>
            {replaceOpen && (
              <div className="replace-row">
                <input
                  aria-label="Replace with"
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                  placeholder="Replace with"
                />
                <select
                  aria-label="Replace scope"
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as SearchScope)
                  }
                >
                  <option value="screenplay">Entire screenplay</option>
                  <option value="scene">Current scene</option>
                  <option value="character">Character cues</option>
                  <option value="dialogue">Dialogue</option>
                  <option value="action">Action</option>
                  <option value="scene_heading">Scene headings</option>
                </select>
                <button onClick={() => performReplace(false)}>Replace</button>
                <button onClick={() => performReplace(true)}>
                  Replace All
                </button>
                <small>{notice}</small>
              </div>
            )}
          </div>
        )}
        {saveError && <div className="save-error">{saveError}</div>}
        <div
            className={`script-pages ${editorView}-view`}
            data-editor-context={editorView}
            style={{ ...formatStyle, "--screenplay-page-count": paginatedPages.length } as CSSProperties}
            spellCheck
          >
            <ContinuousScreenplayEditor worldStory={worldDraft} notesVisible={notesVisible} searchMatches={findOpen ? occurrences : []} activeSearchMatch={activeSearchMatch} onUndo={undo} onRedo={redo} physicalPages={editorView === "continuous"} pages={paginatedPages} layout={layout} screenplay={screenplay} sceneId={editorView === "scene" ? activeScene.id : undefined} sceneIds={editorView === "screenplay" && activeLocationFilter !== "all" ? visibleScenes.map((scene) => scene.id) : undefined} onChange={(next, transaction) => commit(next, true, transaction)} onSceneCommand={(sceneId, command) => { const scene = screenplay.scenes.find((item) => item.id === sceneId); if (!scene) return; if (command === 'up' || command === 'down') commit(moveScene(screenplay, sceneId, command === 'up' ? -1 : 1)); else if (command === 'lock') commit(updateScene(screenplay, sceneId, (item) => ({ ...item, locked: !item.locked }))); else if (command === 'delete') setPendingDelete(scene); else if (command === 'metadata') { setStorySceneId(sceneId); setStoryOpen(true); } else addScene(sceneId); }} />
          </div>
      </main>
        <footer className="screenplay-statistics">
          <span>{statistics.words.toLocaleString()} words</span>
          <span>{statistics.scenes} scenes</span>
          <span>Page {currentPage} of {paginatedPages.length}</span>
          <details ref={optionsRef} className="footer-options">
            <summary>Options</summary>
            <div role="group" aria-label="Editor options">
              <label><input type="checkbox" checked={notesVisible} onChange={event => { const next = event.target.checked; localStorage.setItem(`screenplay-notes-visible:${initial.id}`, String(next)); setNotesVisible(next); }} />Notes</label>
              <label><input type="checkbox" checked={locationCardsVisible} onChange={event => { const next = event.target.checked; localStorage.setItem(`screenplay-location-cards-visible:${initial.id}`, String(next)); setLocationCardsVisible(next); }} />Location cards</label>
              <label><input type="checkbox" checked={characterCardsVisible} onChange={event => { const next = event.target.checked; localStorage.setItem(`screenplay-character-cards-visible:${initial.id}`, String(next)); setCharacterCardsVisible(next); }} />Character cards</label>
            </div>
          </details>
            <div className={`save-state ${saveState}`}>
              {saveState === "saved" ? <Check /> : <Save />}
              {saveLabel}
            </div>
          <small>{layout.paperSize === "a4" ? "A4" : "US Letter"} Page View</small>
        </footer>

      {sceneMenu && (
        <div
          className="scene-context-menu"
          style={{ left: sceneMenu.x, top: sceneMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => {
              void copyScene(sceneMenu.sceneId);
              setSceneMenu(null);
            }}
          >
            Copy Scene
          </button>
          <button
            onClick={() => {
              commit(duplicateScene(screenplay, sceneMenu.sceneId));
              setSceneMenu(null);
            }}
          >
            Duplicate Scene
          </button>
          <button
            onClick={() => {
              if (contextScene)
                commit(
                  updateScene(screenplay, contextScene.id, (scene) => ({
                    ...scene,
                    locked: !scene.locked,
                  })),
                );
              setSceneMenu(null);
            }}
          >
            {contextScene?.locked ? "Unlock Scene" : "Lock Scene"}
          </button>
          <button
            disabled={!copiedScene.current}
            onClick={() => {
              if (copiedScene.current)
                commit(
                  duplicateScene(
                    screenplay,
                    copiedScene.current,
                    screenplay.scenes.findIndex(
                      (scene) => scene.id === sceneMenu.sceneId,
                    ) + 1,
                  ),
                );
              setSceneMenu(null);
            }}
          >
            Paste Scene After
          </button>
          <button
            onClick={() => {
              const index = screenplay.scenes.findIndex(
                (scene) => scene.id === sceneMenu.sceneId,
              );
              commit(reorderScene(screenplay, sceneMenu.sceneId, index - 1));
              setSceneMenu(null);
            }}
          >
            Move Scene Up
          </button>
          <button
            onClick={() => {
              const index = screenplay.scenes.findIndex(
                (scene) => scene.id === sceneMenu.sceneId,
              );
              commit(reorderScene(screenplay, sceneMenu.sceneId, index + 1));
              setSceneMenu(null);
            }}
          >
            Move Scene Down
          </button>
        </div>
      )}
      {layoutOpen && (
        <LayoutSettings
          layout={layout}
          showContinuations={screenplay.showDialogueContinuations !== false}
          errors={layoutErrors}
          onChange={updateLayout}
          onPaper={changePaper}
          onContinuations={(show) =>
            commit({ ...screenplay, showDialogueContinuations: show })
          }
          onClose={() => setLayoutOpen(false)}
        />
      )}{" "}
      {pendingDelete && (
        <div className="confirmation-backdrop" role="dialog" aria-modal="true">
          <div className="confirmation-card">
            <h2>Delete scene?</h2>
            <p>
              “{sceneHeading(pendingDelete, pendingDelete.order + 1)}” and all
              content will be removed. Independent events and story details will be retained; their scene links will be marked as removed until restored.
            </p>
            <div>
              <button
                className="secondary"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button className="danger-button" onClick={confirmDelete}>
                Delete scene permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginatedPages({ pages, screenplay, style, suggestions, onElementChange, onInsert, onDelete, onUndo, onRedo }: { pages: ScreenplayPage[]; screenplay: ScreenplayRecord; style: CSSProperties; suggestions: Suggestions; onElementChange(sceneId: string, id: string, element: ScreenplayElement, transaction?: string): void; onInsert(sceneId: string, id: string, type: ScreenplayElementType): void; onDelete(sceneId: string, id: string): void; onUndo(): void; onRedo(): void }) {
  const sceneById = new Map(screenplay.scenes.map((scene) => [scene.id, scene]));
  const renderEntry = (entry: PageEntry, index: number) => {
    if (entry.kind === "more") return <div className="page-more" key={`more-${entry.elementId}-${index}`}>(MORE)</div>;
    if (entry.kind === "continued") return <div className="page-continued" key={`continued-${entry.elementId}-${index}`}>{entry.character} (CONT'D)</div>;
    const scene = sceneById.get(entry.sceneId); if (!scene) return null;
    return <FragmentElementEditor key={`${entry.element.id}-${entry.start}`} fragment={entry} locked={scene.locked} suggestions={suggestions} onChange={(next, transaction) => onElementChange(entry.sceneId, entry.element.id, next, transaction)} onInsert={(type) => onInsert(entry.sceneId, entry.element.id, type)} onDelete={() => onDelete(entry.sceneId, entry.element.id)} onUndo={onUndo} onRedo={onRedo}/>;
  };
  const renderPage = (entries: PageEntry[]) => { const consumed = new Set<string>(); return entries.map((entry, index) => { if (entry.kind !== "element" || !entry.element.dualDialogue) return renderEntry(entry, index); const groupId = entry.element.dualDialogue.groupId; if (consumed.has(groupId)) return null; consumed.add(groupId); const grouped = entries.filter((candidate): candidate is ElementFragment => candidate.kind === "element" && candidate.element.dualDialogue?.groupId === groupId); return <div className="dual-dialogue" data-dual-dialogue-id={groupId} key={groupId}><div>{grouped.filter((candidate) => candidate.element.dualDialogue?.side === "left").map(renderEntry)}</div><div>{grouped.filter((candidate) => candidate.element.dualDialogue?.side === "right").map(renderEntry)}</div></div>; }); };
  return <div className="paginated-pages" style={style}>{pages.map((page) => <section className="screenplay-page" data-page-number={page.number} key={page.number}><div className="page-number">{page.number > 1 ? `${page.number}.` : ""}</div><div className="page-writing-area">{renderPage(page.entries)}</div></section>)}</div>;
}

function FragmentElementEditor({ fragment, locked, suggestions, onChange, onInsert, onDelete, onUndo, onRedo }: { fragment: ElementFragment; locked: boolean; suggestions: Suggestions; onChange(element: ScreenplayElement, transaction?: string): void; onInsert(type: ScreenplayElementType): void; onDelete(): void; onUndo(): void; onRedo(): void }) {
  const source = fragment.element; const start = fragment.start; const end = fragment.end;
  const fragmentSuggestions: Suggestions = { character: (query) => suggestions.character(query, source.id), scene_heading: (query) => suggestions.scene_heading(query, source.id), transition: (query) => suggestions.transition(query, source.id) };
  const formatting = (source.formatting ?? []).flatMap((range) => { const from = Math.max(start, range.start); const to = Math.min(end, range.end); return from < to ? [{ ...range, start: from - start, end: to - start }] : []; });
  const view: ScreenplayElement = { ...source, id: `${source.id}--${start}`, content: source.content.slice(start, end), formatting, dualDialogue: undefined };
  const merge = (next: ScreenplayElement, transaction?: string) => {
    const delta = next.content.length - (end - start); const preserved = (source.formatting ?? []).flatMap((range) => { const pieces = []; if (range.start < start) pieces.push({ ...range, end: Math.min(range.end, start) }); if (range.end > end) pieces.push({ ...range, start: Math.max(range.start, end) + delta, end: range.end + delta }); return pieces; });
    const updatedRanges = (next.formatting ?? []).map((range) => ({ ...range, start: range.start + start, end: range.end + start }));
    onChange({ ...source, type: next.type, alignment: next.alignment, content: source.content.slice(0, start) + next.content + source.content.slice(end), formatting: [...preserved, ...updatedRanges] }, transaction);
  };
  return <div className="page-element-fragment" data-source-element-id={source.id} data-fragment-start={start} data-planned-lines={fragment.lines}><ElementEditor element={view} locked={locked} suggestions={fragmentSuggestions} selectedSpeech={false} onSelectSpeech={() => {}} onChange={merge} onInsert={onInsert} onDelete={onDelete} onUndo={onUndo} onRedo={onRedo}/></div>;
}

function LayoutSettings({
  layout,
  showContinuations,
  errors,
  onChange,
  onPaper,
  onContinuations,
  onClose,
}: {
  layout: ScreenplayLayout;
  showContinuations: boolean;
  errors: string[];
  onChange(layout: ScreenplayLayout): void;
  onPaper(size: PaperSize): void;
  onContinuations(show: boolean): void;
  onClose(): void;
}) {
  const number = (
    label: string,
    value: number,
    update: (value: number) => ScreenplayLayout,
  ) => (
    <label>
      {label} (mm)
      <input
        type="number"
        min="0"
        step="0.1"
        value={value}
        onChange={(event) => onChange(update(Number(event.target.value)))}
      />
    </label>
  );
  const withValue = (path: keyof ScreenplayLayout, value: number) => ({
    ...layout,
    [path]: value,
  });
  const bounds = (
    type: ScreenplayElementType,
    side: "leftMm" | "rightMm",
    value: number,
  ) => ({
    ...layout,
    elements: {
      ...layout.elements,
      [type]: { ...layout.elements[type], [side]: value },
    },
  });
  return (
    <div
      className="confirmation-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Advanced Screenplay Layout"
    >
      <div className="layout-settings">
        <header>
          <div>
            <div className="eyebrow">SCREENPLAY FORMATTING</div>
            <h2>Advanced Screenplay Layout</h2>
          </div>
          <button aria-label="Close layout settings" onClick={onClose}>
            ×
          </button>
        </header>
        <p>
          Professional defaults are applied automatically. Custom values belong
          to this screenplay.
        </p>
        <label>
          Paper size
          <select
            value={layout.paperSize}
            onChange={(event) => onPaper(event.target.value as PaperSize)}
          >
            <option value="a4">A4 — 210 × 297 mm</option>
            <option value="letter">US Letter — 8.5 × 11 in</option>
          </select>
        </label>
        <div className="layout-grid">
          {number("Top page margin", layout.topMarginMm, (v) =>
            withValue("topMarginMm", v),
          )}
          {number("Bottom page margin", layout.bottomMarginMm, (v) =>
            withValue("bottomMarginMm", v),
          )}
          {number("Left page margin", layout.leftMarginMm, (v) =>
            withValue("leftMarginMm", v),
          )}
          {number("Right page margin", layout.rightMarginMm, (v) =>
            withValue("rightMarginMm", v),
          )}
          {number("Header position", layout.headerTopMm, (v) =>
            withValue("headerTopMm", v),
          )}
          {number("Page number position", layout.footerBottomMm, (v) =>
            withValue("footerBottomMm", v),
          )}
          {(
            [
              "action",
              "scene_heading",
              "character",
              "dialogue",
              "transition",
              "shot",
            ] as ScreenplayElementType[]
          ).flatMap((type) => [
            number(
              `${ELEMENT_LABELS[type]} left`,
              layout.elements[type].leftMm,
              (v) => bounds(type, "leftMm", v),
            ),
            number(
              `${ELEMENT_LABELS[type]} right`,
              layout.elements[type].rightMm,
              (v) => bounds(type, "rightMm", v),
            ),
          ])}
          {number(
            "Dual left column start",
            layout.dualDialogue.left.leftMm,
            (v) => ({
              ...layout,
              dualDialogue: {
                ...layout.dualDialogue,
                left: { ...layout.dualDialogue.left, leftMm: v },
              },
            }),
          )}
          {number(
            "Dual left column end",
            layout.dualDialogue.left.rightMm,
            (v) => ({
              ...layout,
              dualDialogue: {
                ...layout.dualDialogue,
                left: { ...layout.dualDialogue.left, rightMm: v },
              },
            }),
          )}
          {number(
            "Dual right column start",
            layout.dualDialogue.right.leftMm,
            (v) => ({
              ...layout,
              dualDialogue: {
                ...layout.dualDialogue,
                right: { ...layout.dualDialogue.right, leftMm: v },
              },
            }),
          )}
          {number(
            "Dual right column end",
            layout.dualDialogue.right.rightMm,
            (v) => ({
              ...layout,
              dualDialogue: {
                ...layout.dualDialogue,
                right: { ...layout.dualDialogue.right, rightMm: v },
              },
            }),
          )}
          {number("Dual column gap", layout.dualDialogue.gapMm, (v) => ({
            ...layout,
            dualDialogue: { ...layout.dualDialogue, gapMm: v },
          }))}
        </div>
        <label className="toggle-row">
          <span>
            <b>Show MORE and CONT'D</b>
            <small>
              Display automatic continuation markers when Dialogue crosses a
              physical page boundary.
            </small>
          </span>
          <input
            type="checkbox"
            checked={showContinuations}
            onChange={(event) => onContinuations(event.target.checked)}
          />
        </label>
        {errors.length > 0 && (
          <div className="layout-errors">
            {errors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        )}
        <footer>
          <button
            className="secondary"
            onClick={() => onPaper(layout.paperSize)}
          >
            Restore Professional Defaults
          </button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

function LegacyScreenplayEditor({
  initial,
  onSave,
  onSaveState,
}: {
  initial: ScreenplayRecord;
  onSave(screenplay: ScreenplayRecord): Promise<ScreenplayRecord>;
  onSaveState(state: SaveState): void;
}) {
  const [screenplay, setScreenplay] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SceneRecord | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editVersion = useRef(0);
  const sceneRefs = useRef(new Map<string, HTMLElement>());
  const undoStack = useRef<ScreenplayRecord[]>([]);
  const redoStack = useRef<ScreenplayRecord[]>([]);
  const current = useRef(screenplay);
  current.current = screenplay;
  useEffect(() => {
    onSaveState("saved");
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const reportState = (state: SaveState) => {
    setSaveState(state);
    onSaveState(state);
  };
  const commit = (next: ScreenplayRecord, recordHistory = true) => {
    if (recordHistory) {
      undoStack.current.push(current.current);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
    }
    const version = ++editVersion.current;
    setScreenplay(next);
    current.current = next;
    reportState("unsaved");
    setSaveError("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      reportState("saving");
      try {
        const saved = await onSave(next);
        if (editVersion.current === version) {
          setScreenplay(saved);
          current.current = saved;
          reportState("saved");
        }
      } catch (error) {
        if (editVersion.current === version) {
          reportState("error");
          setSaveError((error as Error).message);
        }
      }
    }, 800);
  };
  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(current.current);
    commit(previous, false);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(current.current);
    commit(next, false);
  };
  const scrollToScene = (id: string) =>
    sceneRefs.current
      .get(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  const addScene = (afterId?: string) => {
    const next = insertScene(screenplay, afterId);
    commit(next);
    const index = afterId
      ? next.scenes.findIndex((scene) => scene.id === afterId) + 1
      : next.scenes.length - 1;
    setTimeout(() => scrollToScene(next.scenes[index].id), 0);
  };
  const removeScene = (scene: SceneRecord) => setPendingDelete(scene);
  const confirmDelete = () => {
    if (!pendingDelete) return;
    try {
      commit(deleteScene(screenplay, pendingDelete.id));
      setPendingDelete(null);
    } catch (error) {
      setSaveError((error as Error).message);
      reportState("error");
      setPendingDelete(null);
    }
  };
  const suggestions = {
    character: (query: string, omitId?: string) =>
      uniqueSuggestions(screenplay, "character", query, omitId),
    scene_heading: (query: string, omitId?: string) =>
      uniqueSuggestions(screenplay, "scene_heading", query, omitId),
    transition: (query: string, omitId?: string) =>
      smartTypeSuggestions(screenplay, "transition", query, omitId),
  };
  const formatStyle = layoutCss(resolveLayout(initial.layout)) as CSSProperties;
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "unsaved"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Save failed"
          : "Saved";
  return (
    <div className="screenplay-layout">
      <aside className="scene-navigator">
        <div className="navigator-title">
          <span>SCENES</span>
          <button aria-label="Add scene" onClick={() => addScene()}>
            <Plus />
          </button>
        </div>
        {screenplay.scenes.map((scene, index) => (
          <button key={scene.id} onClick={() => scrollToScene(scene.id)}>
            <span>{index + 1}</span>
            <b>{sceneHeading(scene, index + 1)}</b>
            {scene.locked && <Lock />}
          </button>
        ))}
      </aside>
      <main className="screenplay-scroll">
        <div className="screenplay-heading">
          <div>
            <div className="eyebrow">SCREENPLAY</div>
            <h1>{screenplay.title}</h1>
          </div>
          <div className={`save-state ${saveState}`} title={saveError}>
            {saveState === "saved" ? <Check /> : <Save />}
            {saveLabel}
          </div>
        </div>
        {saveError && (
          <div className="save-error">
            {saveError} Your changes remain open—fix storage and keep this
            window open.
          </div>
        )}
        <div className="script-pages" style={formatStyle}>
          {screenplay.scenes.map((scene, index) => (
            <SceneEditor
              key={scene.id}
              scene={scene}
              sceneNumber={index + 1}
              sceneCount={screenplay.scenes.length}
              suggestions={suggestions}
              register={(node) => {
                if (node) sceneRefs.current.set(scene.id, node);
                else sceneRefs.current.delete(scene.id);
              }}
              onChange={(updated) =>
                commit(updateScene(screenplay, scene.id, () => updated))
              }
              onMove={(direction) =>
                commit(moveScene(screenplay, scene.id, direction))
              }
              onDelete={() => removeScene(scene)}
              onAddAfter={() => addScene(scene.id)}
              onUndo={undo}
              onRedo={redo}
            />
          ))}
        </div>
      </main>
      {pendingDelete && (
        <div
          className="confirmation-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Delete scene confirmation"
        >
          <div className="confirmation-card">
            <h2>Delete scene?</h2>
            <p>
              “{sceneHeading(pendingDelete, pendingDelete.order + 1)}” and all
              of its content will be removed. Independent events and story details will be retained; their scene links will be marked as removed until restored. This cannot be undone.
            </p>
            <div>
              <button
                className="secondary"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button className="danger-button" onClick={confirmDelete}>
                Delete scene permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Suggestions = {
  character(query: string, omitId?: string): string[];
  scene_heading(query: string, omitId?: string): string[];
  transition(query: string, omitId?: string): string[];
};
const SceneEditor = memo(function SceneEditor({
  scene,
  sceneNumber,
  sceneCount,
  suggestions,
  register,
  onChange,
  onMove,
  onDelete,
  onAddAfter,
  onUndo,
  onRedo,
}: {
  scene: SceneRecord;
  sceneNumber: number;
  sceneCount: number;
  suggestions: Suggestions;
  register(node: HTMLElement | null): void;
  onChange(scene: SceneRecord, transactionKey?: string): void;
  onMove(direction: -1 | 1): void;
  onDelete(): void;
  onAddAfter(): void;
  onUndo(): void;
  onRedo(): void;
}) {
  const [selectedSpeechIds, setSelectedSpeechIds] = useState<string[]>([]);
  const mutateElements = (
    elements: ScreenplayElement[],
    transactionKey?: string,
  ) =>
    onChange(
      {
        ...scene,
        elements: elements.map((element, order) => ({ ...element, order })),
        updatedAt: new Date().toISOString(),
      },
      transactionKey,
    );
  const updateElement = (
    id: string,
    next: ScreenplayElement,
    transactionKey?: string,
  ) =>
    mutateElements(
      scene.elements.map((element) => (element.id === id ? next : element)),
      transactionKey,
    );
  const insertElement = (afterId: string, type: ScreenplayElementType) => {
    if (
      type === "scene_heading" &&
      document.body.dataset.editorView === "continuous"
    ) {
      onAddAfter();
      setTimeout(
        () =>
          document
            .querySelectorAll<HTMLElement>('[aria-label="Scene heading"]')
            [sceneNumber]?.focus(),
        0,
      );
      return;
    }
    const result = advanceElement(scene, afterId, type);
    onChange(result.scene);
    setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(`[data-element-id="${result.elementId}"]`)
          ?.focus(),
      0,
    );
  };
  const deleteElement = (id: string) => {
    if (scene.elements.length > 1)
      mutateElements(scene.elements.filter((element) => element.id !== id));
  };
  const toggleSpeech = (id: string) =>
    setSelectedSpeechIds((ids) =>
      ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids.slice(-1), id],
    );
  const makeDual = () => {
    onChange(makeDualDialogue(scene, selectedSpeechIds));
    setSelectedSpeechIds([]);
  };
  const editor = (element: ScreenplayElement) => (
    <ElementEditor
      key={element.id}
      element={element}
      locked={scene.locked}
      suggestions={suggestions}
      selectedSpeech={selectedSpeechIds.includes(element.id)}
      onSelectSpeech={() => toggleSpeech(element.id)}
      onChange={(next, transaction) =>
        updateElement(element.id, next, transaction)
      }
      onInsert={(type) => insertElement(element.id, type)}
      onDelete={() => deleteElement(element.id)}
      onUndo={onUndo}
      onRedo={onRedo}
    />
  );
  const rendered: ReactNode[] = [];
  const consumed = new Set<string>();
  for (const element of scene.elements) {
    const groupId = element.dualDialogue?.groupId;
    if (!groupId || consumed.has(groupId)) {
      if (!groupId) rendered.push(editor(element));
      continue;
    }
    consumed.add(groupId);
    const grouped = scene.elements.filter(
      (candidate) => candidate.dualDialogue?.groupId === groupId,
    );
    const left = grouped.filter(
      (candidate) => candidate.dualDialogue?.side === "left",
    );
    const right = grouped.filter(
      (candidate) => candidate.dualDialogue?.side === "right",
    );
    rendered.push(
      <div
        className="dual-dialogue"
        data-dual-dialogue-id={groupId}
        key={groupId}
      >
        <button
          className="remove-dual"
          onClick={() => onChange(removeDualDialogue(scene, groupId))}
        >
          Remove Dual Dialogue
        </button>
        <div>{left.map(editor)}</div>
        <div>{right.map(editor)}</div>
      </div>,
    );
  }
  return (
    <article
      className={`screenplay-scene ${scene.locked ? "locked" : ""}`}
      data-scene-id={scene.id}
      ref={register}
      contentEditable={false}
    >
      <div className="scene-toolbar" contentEditable={false}>
        <span>
          <GripVertical />
          SCENE {sceneNumber}
        </span>
        <div>
          {canMakeDualDialogue(scene, selectedSpeechIds) && (
            <button className="dual-command" onClick={makeDual}>
              Make Dual Dialogue
            </button>
          )}
          <button
            title="Move scene up"
            disabled={sceneNumber === 1}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </button>
          <button
            title="Move scene down"
            disabled={sceneNumber === sceneCount}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </button>
          <button
            title={scene.locked ? "Unlock scene" : "Lock scene"}
            onClick={() => onChange({ ...scene, locked: !scene.locked })}
          >
            {scene.locked ? <Lock /> : <Unlock />}
          </button>
          <button title="Delete scene" onClick={onDelete}>
            <Trash2 />
          </button>
        </div>
      </div>
      <div className="scene-content">{rendered}</div>
      <button className="add-scene-divider" contentEditable={false} onClick={onAddAfter}>
        <Plus />
        New Scene
      </button>
    </article>
  );
});

function selectionOffsets(root: HTMLElement): [number, number] {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [0, 0];
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return [0, 0];
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return [start, start + range.toString().length];
}
function restoreSelection(root: HTMLElement, offsets: [number, number]) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node);
  if (!nodes.length) return;
  const point = (offset: number): [Node, number] => {
    let remaining = offset;
    for (const text of nodes) {
      const length = text.textContent?.length ?? 0;
      if (remaining <= length) return [text, remaining];
      remaining -= length;
    }
    const last = nodes[nodes.length - 1];
    return [last, last.textContent?.length ?? 0];
  };
  const [startNode, startOffset] = point(offsets[0]);
  const [endNode, endOffset] = point(offsets[1]);
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
function formattedSegments(element: ScreenplayElement) {
  const styles = Array.from(
    { length: element.content.length },
    () => ({}) as TextEmphasis,
  );
  for (const range of element.formatting ?? [])
    for (
      let index = range.start;
      index < Math.min(range.end, styles.length);
      index++
    )
      for (const [key, value] of Object.entries(range))
        if (key !== "start" && key !== "end" && value !== undefined)
          Object.assign(styles[index], { [key]: value });
  const segments: { text: string; style: TextEmphasis }[] = [];
  for (let index = 0; index < element.content.length; index++) {
    const signature = JSON.stringify(styles[index]);
    const previous = segments.at(-1);
    if (previous && JSON.stringify(previous.style) === signature)
      previous.text += element.content[index];
    else segments.push({ text: element.content[index], style: styles[index] });
  }
  return segments;
}

let activeElementId: string | null = null;
let lastBlankEnterAt = 0;

const ElementEditor = memo(function ElementEditor({
  element,
  locked,
  suggestions,
  selectedSpeech,
  onSelectSpeech,
  onChange,
  onInsert,
  onDelete,
  onUndo,
  onRedo,
}: {
  element: ScreenplayElement;
  locked: boolean;
  suggestions: Suggestions;
  selectedSpeech: boolean;
  onSelectSpeech(): void;
  onChange(element: ScreenplayElement, transactionKey?: string): void;
  onInsert(type: ScreenplayElementType): void;
  onDelete(): void;
  onUndo(): void;
  onRedo(): void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<[number, number]>([0, 0]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showElementMenu, setShowElementMenu] = useState(false);
  const structureTarget = () => {
    const fragment = editorRef.current?.closest<HTMLElement>("[data-source-element-id]");
    return { id: fragment?.dataset.sourceElementId ?? element.id, base: Number(fragment?.dataset.fragmentStart ?? 0) };
  };
  const options =
    element.type === "character"
      ? suggestions.character(element.content, element.id)
      : element.type === "scene_heading"
        ? suggestions.scene_heading(element.content, element.id)
        : element.type === "transition"
          ? suggestions.transition(element.content, element.id)
        : [];
  const autocompleteComplete = element.type === "character"
    ? options.some((option) => option === element.content.trim().toUpperCase())
    : element.type === "scene_heading"
      ? /^(?:INT\.|EXT\.|INT\.\/EXT\.).+\s-\s\S+/i.test(element.content.trim())
      : element.type === "transition" ? /:\s*$/.test(element.content) : true;
  useEffect(() => {
    const root = editorRef.current; const anchor = window.getSelection()?.anchorNode;
    if (root && ((anchor && root.contains(anchor)) || activeElementId === element.id)) setShowSuggestions(options.length > 0 && !autocompleteComplete);
  }, [element.content, element.type, options.join("|")]);
  useEffect(() => {
    const listener = (event: Event) => { const detail = (event as CustomEvent<{ id: string; show: boolean }>).detail; if (detail.id === structureTarget().id) setShowElementMenu(detail.show); };
    window.addEventListener("screenplay-element-menu", listener); return () => window.removeEventListener("screenplay-element-menu", listener);
  });
  useEffect(() => {
    const root = editorRef.current;
    const selectionChanged = () => { const anchor = window.getSelection()?.anchorNode; if (root && anchor && root.contains(anchor)) captureSelection(); };
    const autocompleteKey = (event: Event) => { const detail = (event as CustomEvent<{ id: string; key: string }>).detail; if (detail.id !== structureTarget().id) return; if (detail.key === "Tab") { setShowSuggestions(false); setShowElementMenu(false); } else if (showSuggestions && options.length) setSuggestionIndex((value) => detail.key === "ArrowDown" ? (value + 1) % options.length : (value - 1 + options.length) % options.length); };
    const outside = (event: PointerEvent) => { if (root && !root.closest(".element-body")?.contains(event.target as Node)) { setShowSuggestions(false); setShowElementMenu(false); } };
    document.addEventListener("selectionchange", selectionChanged); window.addEventListener("screenplay-autocomplete-key", autocompleteKey); document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("selectionchange", selectionChanged); window.removeEventListener("screenplay-autocomplete-key", autocompleteKey); document.removeEventListener("pointerdown", outside); };
  }, [showSuggestions, options.length]);
  const captureSelection = () => {
    if (editorRef.current) {
      activeElementId = element.id;
      selectionRef.current = selectionOffsets(editorRef.current);
    }
  };
  const updateContent = () => {
    const content = editorRef.current?.innerText.replace(/\r/g, "") ?? "";
    onChange(withCharacterMetadata(reconcileFormatting(element, content)), `typing:${element.id}`);
    setShowSuggestions(
      element.type === "character" || element.type === "scene_heading" || element.type === "transition",
    );
  };
  const chooseSuggestion = (value: string) => {
    if (editorRef.current) editorRef.current.textContent = value;
    selectionRef.current = [value.length, value.length];
    onChange(withCharacterMetadata({ ...element, content: value, formatting: [] }));
    setShowSuggestions(false);
    setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      restoreSelection(editorRef.current, [value.length, value.length]);
    }, 0);
  };
  const format = (emphasis: TextEmphasis) => {
    const [start, end] = selectionRef.current;
    const toggle = (Object.keys(emphasis) as (keyof TextEmphasis)[]).find((key) => ["bold", "italic", "underline", "strike"].includes(key));
    onChange(toggle ? toggleEmphasis(element, start, end, toggle as "bold" | "italic" | "underline" | "strike") : applyFormatting(element, start, end, emphasis));
  };
  const caseChange = (mode: "upper" | "lower") => {
    const [start, end] = selectionRef.current;
    onChange(convertCase(element, start, end, mode));
  };
  useEffect(() => {
    const root = editorRef.current;
    const focus = () => {
      activeElementId = element.id;
      captureSelection();
      const target = structureTarget();
      window.dispatchEvent(new CustomEvent("screenplay-element-focus", { detail: { id: target.id, type: element.type } }));
      const sceneId =
        root?.closest<HTMLElement>("[data-scene-id]")?.dataset.sceneId;
      if (sceneId)
        window.dispatchEvent(
          new CustomEvent("screenplay-scene-focus", { detail: sceneId }),
        );
    };
    const listener = (event: Event) => {
      if (!root || activeElementId !== element.id) return;
      const { command, value } = (
        event as CustomEvent<{ command: string; value?: string }>
      ).detail;
      if (command === "bold") format({ bold: true });
      else if (command === "italic") format({ italic: true });
      else if (command === "underline") format({ underline: true });
      else if (command === "strike") format({ strike: true });
      else if (command === "color") format({ color: value });
      else if (command === "backgroundColor")
        format({ backgroundColor: value });
      else if (command === "upper" || command === "lower") caseChange(command);
      else if (["left", "center", "right", "justify"].includes(command))
        onChange(setAlignment(element, command as TextAlignment));
      else if (command === "clear") {
        const [start, end] = selectionRef.current;
        onChange(removeFormatting(element, start, end));
      }
    };
    root?.addEventListener("focus", focus);
    window.addEventListener("screenplay-format", listener);
    return () => {
      root?.removeEventListener("focus", focus);
      window.removeEventListener("screenplay-format", listener);
    };
  });
  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    captureSelection();
    const key = event.key.toLowerCase();
    if (event.key !== "Enter") lastBlankEnterAt = 0;
    if (event.ctrlKey && key === "a") {
      event.preventDefault();
      const mode = document.body.dataset.editorView;
      const currentScene = editorRef.current?.closest<HTMLElement>(".screenplay-scene");
      const target = mode === "continuous" ? editorRef.current?.closest<HTMLElement>(".script-pages") : currentScene?.querySelector<HTMLElement>(".scene-content");
      const editors = target ? [...target.querySelectorAll<HTMLElement>(".element-editor")] : [];
      if (editors.length) {
        const range = document.createRange();
        range.setStartBefore(editors[0]);
        range.setEndAfter(editors[editors.length - 1]);
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      }
      return;
    }
    if (event.ctrlKey && key === "z") {
      event.preventDefault();
      event.shiftKey ? onRedo() : onUndo();
      return;
    }
    if (event.ctrlKey && key === "y") {
      event.preventDefault();
      onRedo();
      return;
    }
    if (event.ctrlKey && ["b", "i", "u"].includes(key)) {
      event.preventDefault();
      format(
        key === "b"
          ? { bold: true }
          : key === "i"
            ? { italic: true }
            : { underline: true },
      );
      return;
    }
    if (showElementMenu && !event.ctrlKey && SHORTCUT_TYPES[event.key] && event.key !== "8") {
      event.preventDefault();
      const target = structureTarget();
      setShowElementMenu(false);
      window.dispatchEvent(new CustomEvent("screenplay-structure", { detail: { action: "shortcut", id: target.id, type: SHORTCUT_TYPES[event.key]!, offset: target.base + element.content.length } }));
      return;
    }
    if (showElementMenu && event.key === "Escape") {
      event.preventDefault();
      setShowElementMenu(false);
      return;
    }
    if (event.ctrlKey && SHORTCUT_TYPES[event.key]) {
      event.preventDefault();
      const target = structureTarget();
      window.dispatchEvent(new CustomEvent("screenplay-structure", { detail: { action: "shortcut", id: target.id, type: SHORTCUT_TYPES[event.key]!, offset: target.base + element.content.length } }));
      return;
    }
    if (showSuggestions && options.length && event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionIndex((suggestionIndex + 1) % options.length);
      return;
    }
    if (showSuggestions && options.length && event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionIndex(
        (suggestionIndex - 1 + options.length) % options.length,
      );
      return;
    }
    if (showSuggestions && options.length && event.key === "Escape") {
      event.preventDefault();
      setShowSuggestions(false);
      return;
    }
    if (
      showSuggestions &&
      options.length &&
      (event.key === "Enter" || event.key === "Tab") &&
      options[suggestionIndex] !== element.content.trim().toUpperCase()
    ) {
      event.preventDefault();
      chooseSuggestion(options[suggestionIndex]);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const target = structureTarget();
      window.dispatchEvent(new CustomEvent("screenplay-structure", { detail: { action: "type", id: target.id, type: tabType(element.type, !element.content.trim()), offset: target.base + selectionRef.current[0] } }));
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (element.type === "action" && !element.content.trim() && Date.now() - lastBlankEnterAt < 900) {
        setShowElementMenu(true);
        lastBlankEnterAt = 0;
        return;
      }
      lastBlankEnterAt = nextElementType(element.type) === "action" ? Date.now() : 0;
      const target = structureTarget();
      window.dispatchEvent(new CustomEvent("screenplay-structure", { detail: { action: "split", id: target.id, offset: target.base + selectionRef.current[0] } }));
      return;
    }
    if (event.key === "Backspace" && selectionRef.current[0] === 0 && selectionRef.current[1] === 0) {
      event.preventDefault();
      const target = structureTarget();
      window.dispatchEvent(new CustomEvent("screenplay-structure", { detail: { action: "backward", id: target.id } }));
      return;
    }
    if (event.key === "Delete" && selectionRef.current[0] === element.content.length && selectionRef.current[1] === element.content.length) {
      event.preventDefault();
      const target = structureTarget();
      window.dispatchEvent(new CustomEvent("screenplay-structure", { detail: { action: "forward", id: target.id } }));
      return;
    }
    if ((event.key === "ArrowLeft" && selectionRef.current[0] === 0) || (event.key === "ArrowRight" && selectionRef.current[1] === element.content.length)) {
      const editors = [...document.querySelectorAll<HTMLElement>(".element-editor")];
      const index = editors.indexOf(editorRef.current!);
      const target = editors[index + (event.key === "ArrowLeft" ? -1 : 1)];
      if (target) {
        event.preventDefault();
        target.focus();
        const end = event.key === "ArrowLeft" ? target.innerText.replace(/\r/g, "").length : 0;
        restoreSelection(target, [end, end]);
      }
    }
  };
  const elementFormat = SCREENPLAY_FORMAT.element[element.type];
  const style = {
    "--element-width": `var(--${element.type}-width)`,
    "--element-left": `var(--${element.type}-left)`,
    "--element-top": `var(--${element.type}-before)`,
    "--element-bottom": `var(--${element.type}-after)`,
  } as CSSProperties;
  const textStyle = (style: TextEmphasis): CSSProperties => ({
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration:
      [style.underline && "underline", style.strike && "line-through"]
        .filter(Boolean)
        .join(" ") || undefined,
    color: style.color,
    backgroundColor: style.backgroundColor,
  });
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const signature = JSON.stringify(element.formatting ?? []);
    if (
      root.innerText.replace(/\r/g, "") === element.content &&
      root.dataset.formatSignature === signature
    )
      return;
    const focused = document.activeElement === root;
    const offsets = focused
      ? selectionRef.current
      : ([0, 0] as [number, number]);
    root.replaceChildren();
    for (const segment of formattedSegments(element)) {
      const span = document.createElement("span");
      span.textContent = segment.text;
      Object.assign(span.style, textStyle(segment.style));
      root.append(span);
    }
    root.dataset.formatSignature = signature;
    if (focused) {
      root.focus();
      restoreSelection(root, offsets);
    }
  }, [element.content, element.formatting]);
  return (
    <div className={`script-element ${element.type}`} style={style}>
      {element.type === "character" && (
        <button
          className={`speech-selector ${selectedSpeech ? "selected" : ""}`}
          aria-label={`Select speech ${element.content || "unnamed"}`}
          aria-pressed={selectedSpeech}
          onClick={onSelectSpeech}
        >
          ◈
        </button>
      )}
      <select
        aria-label="Element type"
        disabled={locked}
        value={element.type}
        onChange={(event) =>
          onChange({
            ...element,
            type: event.target.value as ScreenplayElementType,
          })
        }
      >
        {Object.entries(ELEMENT_LABELS).map(([type, label]) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>
      <div className="element-body">
        <div
          className="format-toolbar"
          onMouseDown={(event) => event.preventDefault()}
        >
          <button aria-label="Bold" onClick={() => format({ bold: true })}>
            <b>B</b>
          </button>
          <button aria-label="Italic" onClick={() => format({ italic: true })}>
            <i>I</i>
          </button>
          <button
            aria-label="Underline"
            onClick={() => format({ underline: true })}
          >
            <u>U</u>
          </button>
          <button
            aria-label="Strike through"
            onClick={() => format({ strike: true })}
          >
            <s>S</s>
          </button>
          <input
            aria-label="Text colour"
            type="color"
            onChange={(event) => format({ color: event.target.value })}
          />
          <input
            aria-label="Background colour"
            type="color"
            defaultValue="#ffff00"
            onChange={(event) =>
              format({ backgroundColor: event.target.value })
            }
          />
          {(["left", "center", "right", "justify"] as TextAlignment[]).map(
            (alignment) => (
              <button
                key={alignment}
                aria-label={`Align ${alignment}`}
                onClick={() => onChange(setAlignment(element, alignment))}
              >
                {alignment[0].toUpperCase()}
              </button>
            ),
          )}
          <button aria-label="Uppercase" onClick={() => caseChange("upper")}>
            AA
          </button>
          <button aria-label="Lowercase" onClick={() => caseChange("lower")}>
            aa
          </button>
          <button
            aria-label="Remove formatting"
            onClick={() => {
              const [start, end] = selectionRef.current;
              onChange(removeFormatting(element, start, end));
            }}
          >
            Clear
          </button>
        </div>
        <div
          ref={editorRef}
          className="element-editor"
          data-element-id={element.id}
          role="textbox"
          aria-label={ELEMENT_LABELS[element.type]}
          aria-multiline="true"
          aria-disabled={locked}
          tabIndex={locked ? -1 : 0}
          contentEditable={!locked}
          spellCheck
          suppressContentEditableWarning
          onInput={updateContent}
          onFocus={() => { activeElementId = structureTarget().id; setShowSuggestions(options.length > 0 && !autocompleteComplete); }}
          onMouseDown={() => setShowSuggestions(options.length > 0 && !autocompleteComplete)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
          data-placeholder={ELEMENT_LABELS[element.type]}
          style={{ textAlign: element.alignment ?? elementFormat.alignment }}
        />
        {showSuggestions && options.length > 0 && (
          <div className="element-suggestions" role="listbox">
            {options.map((option, index) => (
              <button
                key={option}
                className={index === suggestionIndex ? "active" : ""}
                role="option"
                aria-selected={index === suggestionIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseSuggestion(option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        )}
        {showElementMenu && (
          <div className="element-menu" role="menu" aria-label="Screenplay element menu">
            {(["1", "2", "3", "4", "5", "6", "7"] as const).map((number) => <button key={number} role="menuitem" onMouseDown={(event) => { event.preventDefault(); const target = structureTarget(); setShowElementMenu(false); window.dispatchEvent(new CustomEvent("screenplay-structure", { detail: { action: "shortcut", id: target.id, type: SHORTCUT_TYPES[number], offset: target.base + element.content.length } })); }}>{number} {ELEMENT_LABELS[SHORTCUT_TYPES[number]!]}</button>)}
          </div>
        )}
      </div>
      <button
        className="element-delete"
        aria-label="Delete element"
        disabled={locked}
        onClick={onDelete}
      >
        <Trash2 />
      </button>
    </div>
  );
});


function CompactEpisodeTitle({ title }: { title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    const fit = () => {
      let size = 24;
      heading.style.fontSize = size + 'px';
      while (heading.scrollWidth > heading.clientWidth && size > 16) {
        heading.style.fontSize = --size + 'px';
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(heading);
    return () => observer.disconnect();
  }, [title]);
  return <h1 ref={ref} className="compact-episode-title" title={title}>{title}</h1>;
}
