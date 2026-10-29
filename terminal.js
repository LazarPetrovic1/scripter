
import { ipcMain } from 'electron';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import * as pty from 'node-pty';
const terminals = new Map();

// IDs being processed by the create handler.
const creatingTerminals = new Set();
const platform = process.platform;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clampInteger(value, fallback, min, max) {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(value, max));
}

function shellDefinitions() {
  if (platform === 'win32') {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    return [
      {
        id: 'powershell',
        label: 'Windows PowerShell',
        executable: path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        args: ['-NoLogo'],
      },
      { id: 'pwsh', label: 'PowerShell 7', executable: 'pwsh.exe', args: ['-NoLogo'] },
      {
        id: 'cmd',
        label: 'Command Prompt',
        executable: path.join(systemRoot, 'System32', 'cmd.exe'),
        args: [],
      },
      {
        id: 'git-bash',
        label: 'Git Bash',
        executable: path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
        args: ['--login', '-i'],
      },
    ];
  }

  return [
    { id: 'zsh', label: 'Zsh', executable: '/bin/zsh', args: ['-l'] },
    { id: 'bash', label: 'Bash', executable: '/bin/bash', args: ['-l'] },
    { id: 'fish', label: 'Fish', executable: 'fish', args: ['-l'] },
    { id: 'sh', label: 'POSIX shell', executable: '/bin/sh', args: [] },
  ];
}

function executableExists(executable) {
  if (path.isAbsolute(executable)) return fs.existsSync(executable);
  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensions = platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];

  return pathEntries.some((entry) =>
    extensions.some((extension) => fs.existsSync(path.join(entry, executable + extension))));
}

function getAvailableShells() {
  const definitions = shellDefinitions();
  const preferred = process.env.SHELL;
  if (platform !== 'win32' && preferred) {
    const basename = path.basename(preferred);
    const matching = definitions.find((shell) => shell.id === basename && executableExists(preferred));
    if (matching) definitions.unshift({ ...matching, executable: preferred, args: ['-l'] });
  }

  return definitions
    .filter((shell) => executableExists(shell.executable))
    .filter((shell, index, all) => all.findIndex((item) => item.id === shell.id) === index);
}

function getDefaultShell(shells) {
  const preferred = process.env.SHELL;
  const basename = preferred ? path.basename(preferred) : '';
  if (platform !== 'win32' && preferred) {
    const exactMatch = shells.find((shell) => shell.executable === preferred);
    if (exactMatch) return exactMatch;
  }

  const preferredId = platform === 'win32' ?
    'powershell' : platform === 'darwin' ?
    'zsh' : basename || 'bash';

  return (
    shells.find((shell) => shell.id === preferredId) ||
    shells.find((shell) => shell.id === 'bash') ||
    shells[0]
  );
}

function findTerminal(event, id) {
  const session = terminals.get(id);
  if (!session) return null;
  if (session.owner !== event.sender) throw new Error('Terminal ownership mismatch');
  return session;
}

function resolveCwd(requestedCwd) {
  if (typeof requestedCwd !== 'string' || !requestedCwd.trim()) return os.homedir();
  try {
    const stat = fs.statSync(requestedCwd);
    if (stat.isDirectory()) return requestedCwd;
  } catch { /* Fall back if the directory no longer exists or is inaccessible.*/ }
  return os.homedir();
}

function sendToOwner(session, channel, payload) {
  if (session.closing || session.owner.isDestroyed()) return;
  // Ignore events from a session that has already been replaced.
  if (terminals.get(session.id) !== session) return;
  session.owner.send(channel, payload);
}

function removeSession(session) {
  if (terminals.get(session.id) !== session) return false;
  terminals.delete(session.id);
  session.closing = true;
  return true;
}

export function registerTerminalHandlers() {
  ipcMain.handle('terminal:list-shells', () => {
    const shells = getAvailableShells();
    return { platform, shells, defaultShell: getDefaultShell(shells)?.id ?? null };
  });

  ipcMain.handle('terminal:create', (event, options = {}) => {
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw new Error('Invalid terminal options');
    const id = options.id;
    if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Invalid terminal ID');
    // Reserve before spawning. The handler is synchronous, but keeping
    // this reservation makes the creation invariant explicit.
    if (terminals.has(id) || creatingTerminals.has(id)) throw new Error('Invalid or duplicate terminal ID');
    creatingTerminals.add(id);
    let child = null;
    let session = null;

    try {
      const shells = getAvailableShells();
      const shell = shells.find((item) => item.id === options.shell) || getDefaultShell(shells);
      if (!shell) throw new Error('No supported shell was found on this system.');
      const cwd = resolveCwd(options.cwd);

      child = pty.spawn(shell.executable, shell.args, {
        name: 'xterm-256color',
        cols: clampInteger(options.cols, 80, 2, 500),
        rows: clampInteger(options.rows, 24, 1, 200),
        cwd,
        env: { ...process.env },
        useConpty: true,
      });

      session = { id, owner: event.sender, child, closing: false };
      // Register before listening for events.
      terminals.set(id, session);
      child.onData((data) => { sendToOwner(session, 'terminal:data', { id, data }); });
      child.onExit(({ exitCode, signal }) => {
        // Only remove this exact session. Never delete a replacement.
        if (!removeSession(session)) return;
        if (!session.owner.isDestroyed()) session.owner.send('terminal:exit', { id, exitCode, signal });
      });
      return { id, shell: shell.id, cwd };
    } catch (error) {
      if (session) removeSession(session);
      // If a PTY was created but registration failed, terminate it.
      if (child && !session) {
        try { child.kill(); }
        catch (killError) {
          console.error(`Failed to clean up partially created terminal ${id}:`, killError);
        }
      }

      throw error;
    } finally { creatingTerminals.delete(id); }
  });

  ipcMain.handle('terminal:write', (event, id, data) => {
    const session = findTerminal(event, id);
    if (!session || session.closing) return false;
    if (typeof data !== 'string' || data.length > 1024 * 1024) throw new Error('Invalid terminal input');
    session.child.write(data);
    return true;
  });

  ipcMain.handle('terminal:resize', (event, id, cols, rows) => {
    const session = findTerminal(event, id);
    if (!session || session.closing) return false;
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) return false;
    session.child.resize(clampInteger(cols, 80, 2, 500), clampInteger(rows, 24, 1, 200));
    return true;
  });

  ipcMain.handle('terminal:close', (event, id) => {
    const session = findTerminal(event, id);
    // Closing an already-exited terminal is harmless.
    if (!session) return false;
    // Remove before kill, preventing further writes and output events.
    if (!removeSession(session)) return false;
    try { session.child.kill(); }
    catch (error) { console.error(`Failed to close terminal ${id}:`, error); }
    return true;
  });
}

export function cleanupTerminalsForOwner(owner) {
  for (const session of [...terminals.values()]) {
    if (session.owner !== owner) continue;
    if (!removeSession(session)) continue;
    try { session.child.kill(); }
    catch (error) { console.error(`Failed to stop terminal ${session.id}:`, error); }
  }
}
