
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export const settingsRegistry = {
  'editor.fontSize': {
    category: 'Editor',
    label: 'Font Size',
    description: 'Editor text size in pixels.',
    type: 'number',
    default: 14,
    min: 8,
    max: 40,
  },
  'editor.fontFamily': {
    category: 'Editor',
    label: 'Font Family',
    description: 'Font used in the code editor.',
    type: 'string',
    default: 'Consolas, monospace',
    options: ['monospace', 'Consolas', 'Cascadia Code', 'Fira Code'],
  },
  'editor.tabSize': {
    category: 'Editor',
    label: 'Tab Size',
    description: 'Number of spaces represented by a tab.',
    type: 'number',
    default: 2,
    min: 1,
    max: 8,
  },
  'editor.insertSpaces': {
    category: 'Editor',
    label: 'Insert Spaces',
    description: 'Insert spaces instead of tab characters.',
    type: 'boolean',
    default: true,
  },
  'editor.wordWrap': {
    category: 'Editor',
    label: 'Word Wrap',
    description: 'Wrap long lines in the editor.',
    type: 'select',
    default: 'off',
    options: ['off', 'on'],
  },
  'editor.lineNumbers': {
    category: 'Editor',
    label: 'Line Numbers',
    description: 'Show line numbers in the editor.',
    type: 'boolean',
    default: true,
  },
  'terminal.shell': {
    category: 'Terminal',
    label: 'Default Shell',
    description: 'Shell to use for new terminal sessions.',
    type: 'string',
    default: 'auto',
  },
  'terminal.fontSize': {
    category: 'Terminal',
    label: 'Font Size',
    description: 'Terminal text size in pixels.',
    type: 'number',
    default: 13,
    min: 8,
    max: 32,
  },
  'terminal.scrollback': {
    category: 'Terminal',
    label: 'Scrollback',
    description: 'Number of terminal lines retained.',
    type: 'number',
    default: 5000,
    min: 100,
    max: 50000,
  },
  'terminal.cursorBlink': {
    category: 'Terminal',
    label: 'Blinking Cursor',
    description: 'Animate the terminal cursor.',
    type: 'boolean',
    default: true,
  },
  'appearance.theme': {
    category: 'Appearance',
    label: 'Theme',
    description: 'Application color theme.',
    type: 'select',
    default: 'dark',
    options: ['dark', 'light', 'system'],
  },
  'appearance.accentColor': {
    category: 'Appearance',
    label: 'Accent Color',
    description: 'Hex color used for interface accents.',
    type: 'color',
    default: '#7c9cff',
  },
  'behavior.restoreWorkspace': {
    category: 'Behavior',
    label: 'Restore Workspace',
    description: 'Reopen the previous workspace on startup.',
    type: 'boolean',
    default: true,
  },
  'behavior.confirmDelete': {
    category: 'Behavior',
    label: 'Confirm Before Deleting',
    description: 'Ask before deleting files or folders.',
    type: 'boolean',
    default: true,
  },
};

const defaults = Object.fromEntries(
  Object.entries(settingsRegistry).map(([key, definition]) => [key, definition.default]),
);

let settings = { ...defaults };
let settingsFile;
let writeQueue = Promise.resolve();

function isValidValue(definition, value) {
  switch (definition.type) {
    case 'boolean': return typeof value === 'boolean';
    case 'number': return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= definition.min &&
      value <= definition.max
    );
    case 'select': return definition.options.includes(value);
    case 'color': return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    case 'string': return typeof value === 'string' && value.length <= 500;
    default: return false;
  }
}

export function getSettings() { return { ...settings }; }

export function getSettingsSchema() {
  return Object.entries(settingsRegistry).map(([key, definition]) => ({ key, ...definition }));
}

export async function initializeSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  try {
    const contents = await fs.readFile(settingsFile, 'utf8');
    const saved = JSON.parse(contents);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [key, value] of Object.entries(saved)) {
        const definition = settingsRegistry[key];
        if (definition && isValidValue(definition, value)) settings[key] = value;
      }
    }
  } catch (error) { if (error.code !== 'ENOENT') console.error('Could not load settings:', error); }

  // Create the initial settings file, including defaults.
  await persistSettings();
  return getSettings();
}

async function persistSettings() {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const snapshot = JSON.stringify(settings, null, 2);
    const temporaryFile = `${settingsFile}.tmp`;
    await fs.mkdir(path.dirname(settingsFile), { recursive: true });
    await fs.writeFile(temporaryFile, snapshot, 'utf8');
    await fs.rename(temporaryFile, settingsFile);
  });
  return writeQueue;
}

export async function updateSetting(key, value) {
  const definition = settingsRegistry[key];
  if (!definition) throw new Error(`Unknown setting: ${key}`);
  if (!isValidValue(definition, value)) throw new Error(`Invalid value for setting: ${key}`);
  const previousValue = settings[key];
  if (previousValue === value) return getSettings();
  settings[key] = value;
  try { await persistSettings(); }
  catch (error) {
    // Roll back in-memory state if persistence fails.
    settings[key] = previousValue;
    throw error;
  }

  return getSettings();
}
