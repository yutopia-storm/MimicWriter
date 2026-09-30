export type EditorCommandId = 'history.undo' | 'history.redo' | 'search.find' | 'search.replace' | 'view.screenplay' | 'view.scene' | 'view.continuous' | 'scene.moveUp' | 'scene.moveDown' | 'clipboard.copy' | 'clipboard.cut' | 'clipboard.paste' | 'format.bold' | 'format.italic' | 'format.underline';

export const EDITOR_COMMANDS: Record<EditorCommandId, { label: string; shortcuts: string[] }> = {
  'history.undo': { label: 'Undo', shortcuts: ['Ctrl+Z'] }, 'history.redo': { label: 'Redo', shortcuts: ['Ctrl+Y', 'Ctrl+Shift+Z'] },
  'search.find': { label: 'Find', shortcuts: ['Ctrl+F'] }, 'search.replace': { label: 'Replace', shortcuts: ['Ctrl+H'] },
  'view.screenplay': { label: 'Screenplay View', shortcuts: ['Alt+Shift+1'] }, 'view.scene': { label: 'Scene View', shortcuts: ['Alt+Shift+2'] }, 'view.continuous': { label: 'Continuous Writing View', shortcuts: ['Alt+Shift+3'] },
  'scene.moveUp': { label: 'Move Scene Up', shortcuts: ['Alt+ArrowUp'] }, 'scene.moveDown': { label: 'Move Scene Down', shortcuts: ['Alt+ArrowDown'] },
  'clipboard.copy': { label: 'Copy', shortcuts: ['Ctrl+C'] }, 'clipboard.cut': { label: 'Cut', shortcuts: ['Ctrl+X'] }, 'clipboard.paste': { label: 'Paste', shortcuts: ['Ctrl+V'] },
  'format.bold': { label: 'Bold', shortcuts: ['Ctrl+B'] }, 'format.italic': { label: 'Italic', shortcuts: ['Ctrl+I'] }, 'format.underline': { label: 'Underline', shortcuts: ['Ctrl+U'] }
};

export function resolveEditorCommand(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): EditorCommandId | null {
  const modifiers = [event.ctrlKey || event.metaKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : ''].filter(Boolean);
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const shortcut = [...modifiers, key].join('+');
  return (Object.entries(EDITOR_COMMANDS) as [EditorCommandId, { shortcuts: string[] }][]).find(([, command]) => command.shortcuts.includes(shortcut))?.[0] ?? null;
}
