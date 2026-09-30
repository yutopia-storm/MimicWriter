// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { ProfileWorkspace } from './ProfileWorkspace';
import { createElement, createScreenplay } from '../domain/screenplay';
import { migrateStory } from '../domain/story';
import { synchronizeSceneDefaults } from '../domain/story-extraction';
import { mergeIdentity } from '../domain/story-identities';
import type { DesktopApi } from '../shared/models';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('reveals an icon from the cue, then opens the canonical card only from icon hover', async () => {
  vi.useFakeTimers();
  const screenplay = createScreenplay({ projectId: 'p', title: 'Pilot', screenplayType: 'episode' });
  screenplay.scenes[0].elements = [
    createElement('scene_heading', 'INT. COURT - DAY', 0),
    createElement('character', 'SOLICITOR', 1),
    createElement('dialogue', 'Your sister.', 2),
    createElement('character', 'MARSHA', 3),
    createElement('character', 'APPLE', 4),
  ];
  const extracted = synchronizeSceneDefaults(migrateStory(null, 'p'), [screenplay]);
  const solicitor = extracted.characters.find(character => character.name === 'SOLICITOR')!;
  const marsha = extracted.characters.find(character => character.name === 'MARSHA')!;
  const story = mergeIdentity(extracted, 'characters', solicitor.id, marsha.id);
  window.desktop = {} as DesktopApi;
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 80, bottom: 18, width: 80, height: 18, toJSON: () => ({}) }) });

  const view = render(<div className="writing-layout"><ProfileWorkspace story={story} documents={[screenplay]} change={vi.fn()} timeline={vi.fn()} remove={vi.fn()} undo={vi.fn()} hidden={false} navigateScene={vi.fn()} saveStatus="Saved" saveError="" retry={vi.fn()} /></div>);
  const cue = document.createElement('div');
  cue.className = 'continuous-block character';
  cue.dataset.elementId = screenplay.scenes[0].elements[1].id;
  cue.dataset.sceneId = screenplay.scenes[0].id;
  const content = document.createElement('span'); content.className = 'continuous-block-content'; content.textContent = 'SOLICITOR'; cue.appendChild(content);
  view.container.querySelector('.writing-layout')!.appendChild(cue);

  fireEvent.pointerOver(content);
  await act(async () => { vi.advanceTimersByTime(301); });
  expect(view.queryByRole('dialog', { name: 'character quick card' })).not.toBeInTheDocument();
  const icon = view.getByRole('button', { name: 'Open character inspector' });
  fireEvent.pointerOver(icon);
  await act(async () => { vi.advanceTimersByTime(301); });

  const card = view.getByRole('dialog', { name: 'character quick card' });
  expect(card).toHaveTextContent('MARSHA');
  expect(card).toHaveTextContent('Appears here as SOLICITOR');

  const appleCue = document.createElement('div');
  appleCue.className = 'continuous-block character';
  appleCue.dataset.elementId = screenplay.scenes[0].elements[4].id;
  appleCue.dataset.sceneId = screenplay.scenes[0].id;
  const appleContent = document.createElement('span'); appleContent.className = 'continuous-block-content'; appleContent.textContent = 'APPLE'; appleCue.appendChild(appleContent);
  view.container.querySelector('.writing-layout')!.appendChild(appleCue);
  fireEvent.pointerOver(appleContent);
  fireEvent.pointerOver(view.getByRole('button', { name: 'Open character inspector' }));
  await act(async () => { vi.advanceTimersByTime(301); });
  expect(view.getByRole('dialog', { name: 'character quick card' })).toHaveTextContent('APPLE');
});
