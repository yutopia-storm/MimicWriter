// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { StoryPanel } from './StoryPanel';
import { createScreenplay } from '../domain/screenplay';
import { migrateStory } from '../domain/story';
import type { DesktopApi, ProjectWorkspace } from '../shared/models';
afterEach(cleanup);

it('opens scene details, edits relationships, autosaves, and clears metadata without changing screenplay text', async () => {
  const screenplay = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  const original = JSON.stringify(screenplay);
  const story = migrateStory(null, 'p');
  story.plots = [{ id: 'a', name: 'Disappearance', description: '', color: 'accent' }];
  story.events = [{ id: 'e', name: 'Disappears', description: '', occursInSceneId: screenplay.scenes[0].id }];
  const workspace: ProjectWorkspace = { project: { id: 'p', schemaVersion: 3, documentFormat: 'screenplay', projectType: 'feature', title: 'Example', createdAt: '', updatedAt: '', metadata: { description: '' } }, screenplays: [screenplay], story };
  const saveStory = vi.fn(async (_id, value) => value);
  window.desktop = { saveStory } as unknown as DesktopApi;
  const onSaved = vi.fn();
  const view = render(<StoryPanel workspace={workspace} screenplay={screenplay} open sceneId={screenplay.scenes[0].id} plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={onSaved} />);
  fireEvent.change(view.getByLabelText('Story day'), { target: { value: '4' } });
  fireEvent.click(within(view.getByRole('group', { name: 'Plots' })).getByRole('button', { name: '+ Add' }));
  fireEvent.click(view.getByRole('button', { name: 'Disappearance' }));
  await waitFor(() => expect(saveStory).toHaveBeenCalled(), { timeout: 2000 });
  expect(saveStory.mock.calls.at(-1)?.[1].scenes[0]).toMatchObject({ chronology: { day: 4 }, plotIds: ['a'] });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(view.getByLabelText('More scene actions'));
  fireEvent.click(view.getByRole('button', { name: 'Clear manual story metadata' }));
  await waitFor(() => expect(saveStory.mock.calls.at(-1)?.[1].scenes).toEqual([]), { timeout: 2000 });
  expect(saveStory.mock.calls.at(-1)?.[1].events).toHaveLength(1);
  expect(saveStory.mock.calls.at(-1)?.[1].events[0].occursInSceneId).toBe(screenplay.scenes[0].id);
  expect(JSON.stringify(screenplay)).toBe(original);
  confirm.mockRestore();
});

it('assigns an event to a plot and scene once, then derives both relationships in Scene Details', async () => {
  const screenplay = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  const story = migrateStory(null, 'p');
  story.plots = [{ id: 'plot-a', name: 'Investigation', description: '', color: 'accent' }];
  story.events = [{ id: 'event-a', name: 'A clue is found', description: '', contextOverrides: [] }];
  const workspace: ProjectWorkspace = { project: { id: 'p', schemaVersion: 3, documentFormat: 'screenplay', projectType: 'feature', title: 'Example', createdAt: '', updatedAt: '', metadata: { description: '' } }, screenplays: [screenplay], story };
  const saveStory = vi.fn(async (_id, value) => value);
  window.desktop = { saveStory } as unknown as DesktopApi;
  const view = render(<StoryPanel workspace={workspace} screenplay={screenplay} open plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(view.getByRole('button', { name: 'Events' }));
  const eventPicker = view.getByRole('group', { name: 'Event' });
  fireEvent.click(within(eventPicker).getByRole('button', { name: '+ Add' }));
  fireEvent.click(within(eventPicker).getByRole('button', { name: 'A clue is found' }));
  const assignedPlots = view.getByRole('group', { name: 'Assigned Plots' });
  fireEvent.click(within(assignedPlots).getByRole('button', { name: '+ Add' }));
  fireEvent.click(within(assignedPlots).getByRole('button', { name: 'Investigation' }));
  fireEvent.change(view.getByLabelText('Where does this event occur?'), { target: { value: 'scene' } });
  const scenePicker = view.getByRole('group', { name: 'Occurs in scene' });
  fireEvent.click(within(scenePicker).getByRole('button', { name: '+ Add' }));
  fireEvent.click(within(scenePicker).getAllByRole('button')[1]);

  await waitFor(() => expect(saveStory.mock.calls.at(-1)?.[1].events[0]).toMatchObject({ plotIds: ['plot-a'], occursInSceneId: screenplay.scenes[0].id }), { timeout: 2000 });
  expect(saveStory.mock.calls.at(-1)?.[1].scenes[0]?.plotIds ?? []).toEqual([]);
  fireEvent.click(view.getByRole('button', { name: 'Scenes' }));
  expect(view.getAllByText('A clue is found')).not.toHaveLength(0);
  expect(view.getByText('Via A clue is found')).toBeInTheDocument();
});

