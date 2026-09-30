# MimicWriter desktop application

Build 001 establishes the local-first desktop shell, configurable product presentation, first-run storage setup, Feature/Series project creation and a persistent project library. Build 002 adds the local screenplay domain, continuous editor, stable scene/element identities, episode screenplays, autosave and the initial revision boundary.

## Development

```text
npm install
npm run dev
```

## Verification

```text
npm test
npm run build
```

`npm run package` creates platform packaging output in `release/`.

On Windows, `npm run package:win` creates a local unsigned NSIS test installer. Use `npm run package:win:dir` for a faster unpacked application build.

## Screenplay editor

- Press `Enter` to create the conventional next screenplay element; use `Shift+Enter` for a line break. `Tab` moves from writing contexts into the next useful Action or Character element.
- Use `Alt+1` through `Alt+6` to change the active element to Scene Heading, Action, Character, Dialogue, Parenthetical or Transition.
- Character cues and scene headings offer keyboard-selectable suggestions derived from the current screenplay; `Escape` dismisses them and typing a new value always remains available.
- Select two adjacent Character/Dialogue speech blocks with their contextual selectors to make or remove structural dual dialogue.
- Selected text supports `Ctrl+B`, `Ctrl+I`, and `Ctrl+U`, plus the contextual formatting controls for strike-through, colours, alignment, case conversion and clearing formatting. `Ctrl+Z`/`Ctrl+Y` undo and redo screenplay edits.
- Switch between the shared continuous Screenplay View and focused Scene View without creating duplicate screenplay data. The last episode, scene and view are restored when reopening a project.
- Drag scenes in the sidebar to reorder them, or use Move Scene Up/Down commands. Scene numbers are derived from order; stable scene IDs do not change.
- `Ctrl+F` opens screenplay-wide Find and `Ctrl+H` opens Replace. Replace can be scoped to the screenplay, current scene, or an element type, and participates in undo/redo.
- Scene context commands provide structured copy/duplicate/paste with fresh IDs, while standard selected-text Cut/Copy/Paste remains interoperable with other applications.
- Word and scene counts are derived live. Displayed page counts are explicitly approximate.
- Empty elements can be removed with `Backspace`.
- Screenplay changes save automatically. The header always shows Unsaved, Saving, Saved or Save failed state, and navigation/closing is guarded while work is not safely persisted.
- Scene controls support add, delete (with confirmation), reorder, lock/unlock and navigation without changing scene IDs.

Feature projects own one principal screenplay. Series projects own independently persisted episode screenplays. Screenplay files live under each project's `Screenplays` directory; immutable initial snapshots live separately under `Revisions` so ordinary saves and explicit revisions remain distinct concepts.

## Storage

The writer chooses a storage root during first-run setup. The application creates brand-neutral managed folders for `Projects`, `Backups`, `Exports` and `References`. Each project uses a stable UUID directory and a versioned `project.json` record.

Owner configuration, writer preferences and the chosen storage path are kept in separate versioned records in Electron's platform application-data location. Secrets are not stored in those records.
