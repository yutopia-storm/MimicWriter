import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flattenTimelineView, type TimelineActivity } from '../domain/timeline-view';
import { TimelineList, type LocateRequest, type TimelineDensity } from './TimelineList';

type Side = 'story' | 'screenplay';
export function TimelineCompare({ storyItems, screenplayItems, density, collapseCommand, header, plots, secondary }: {
  storyItems: TimelineActivity[]; screenplayItems: TimelineActivity[]; density: TimelineDensity;
  collapseCommand: { sequence: number; collapsed: boolean };
  header(item: TimelineActivity, click: () => void, selected: boolean): ReactNode;
  plots(item: TimelineActivity): ReactNode; secondary(item: TimelineActivity, expanded: boolean): ReactNode;
}) {
  const storyPane = useRef<HTMLDivElement>(null), screenplayPane = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const [paneHeight, setPaneHeight] = useState<number>();
  useLayoutEffect(() => {
    const pane = storyPane.current, body = pane?.closest('.story-body');
    if (!pane || !body) return;
    const measure = () => setPaneHeight(Math.max(180, Math.min(640, body.getBoundingClientRect().bottom - pane.getBoundingClientRect().top - 16)));
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    observer?.observe(body);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const [hoverId, setHoverId] = useState<string>();
  const [selection, setSelection] = useState<{ matchId: string; storyKey?: string; screenplayKey?: string }>();
  const [locate, setLocate] = useState<Partial<Record<Side, LocateRequest>>>({});
  const storyRows = flattenTimelineView(storyItems), screenplayRows = flattenTimelineView(screenplayItems);
  const matches = screenplayRows.filter(item => item.matchId === selection?.matchId);
  const matchIndex = Math.max(0, matches.findIndex(item => item.key === selection?.screenplayKey));
  const choose = (side: Side, item: TimelineActivity) => {
    const storyMatch = side === 'story' ? item : storyRows.find(row => row.matchId === item.matchId);
    const screenplayMatch = side === 'screenplay' ? item : screenplayRows.find(row => row.matchId === item.matchId);
    setSelection({ matchId: item.matchId, storyKey: storyMatch?.key, screenplayKey: screenplayMatch?.key });
    const other = side === 'story' ? 'screenplay' : 'story';
    const target = side === 'story' ? screenplayMatch : storyMatch;
    if (target) setLocate(state => ({ ...state, [other]: { key: target.key, sequence: ++sequence.current } }));
  };
  const nextMatch = (delta: number) => {
    const item = matches[matchIndex + delta];
    if (!item) return;
    setSelection(state => state && ({ ...state, screenplayKey: item.key }));
    setLocate(state => ({ ...state, screenplay: { key: item.key, sequence: ++sequence.current } }));
  };
  return <div className="timeline-compare" aria-label="Compare story and screenplay order">
    <p className="timeline-compare-hint">Hover to identify · Click to locate · Each pane scrolls independently.</p>
    <section className="timeline-compare-column">
      <header><h3>Story Order</h3>{selection && !selection.storyKey && <small>No matching occurrence under these filters.</small>}</header>
      <div ref={storyPane} className="timeline-compare-pane" style={paneHeight ? { height: paneHeight } : undefined} role="region" aria-label="Story Order" tabIndex={0}>
        <TimelineList items={storyItems} order="story" density={density} compactComparison collapseCommand={collapseCommand} locate={locate.story} paneRef={storyPane} selectedKey={selection?.storyKey} hoverId={hoverId} onHover={setHoverId} header={item => header(item, () => choose('story', item), selection?.storyKey === item.key)} plots={plots} secondary={secondary}/>
      </div>
    </section>
    <section className="timeline-compare-column">
      <header><h3>Screenplay Order</h3>
        {matches.length > 1 && <nav className="timeline-matches" aria-label="Screenplay appearances">
          <button aria-label="Previous screenplay appearance" disabled={matchIndex === 0} onClick={() => nextMatch(-1)}>‹</button>
          <span aria-live="polite">{matchIndex + 1} of {matches.length}</span>
          <button aria-label="Next screenplay appearance" disabled={matchIndex === matches.length - 1} onClick={() => nextMatch(1)}>›</button>
        </nav>}
        {selection && !selection.screenplayKey && <small>No matching screenplay appearance under these filters.</small>}
      </header>
      <div ref={screenplayPane} className="timeline-compare-pane" style={paneHeight ? { height: paneHeight } : undefined} role="region" aria-label="Screenplay Order" tabIndex={0}>
        <TimelineList items={screenplayItems} order="screenplay" density={density} compactComparison collapseCommand={collapseCommand} locate={locate.screenplay} paneRef={screenplayPane} selectedKey={selection?.screenplayKey} hoverId={hoverId} onHover={setHoverId} header={item => header(item, () => choose('screenplay', item), selection?.screenplayKey === item.key)} plots={plots} secondary={secondary}/>
      </div>
    </section>
  </div>;
}
