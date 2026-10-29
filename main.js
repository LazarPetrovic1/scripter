
import { app, BrowserWindow, dialog, Menu, protocol, net, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fontList from 'font-list';

import {
  createDirectory,
  createFile,
  deletePath,
  getWorkspace,
  readDirectory,
  readTextFile,
  renamePath,
  setWorkspace,
  writeTextFile,
  searchWorkspaceFiles
} from './filesystem.js';

import {
  initializeSettings,
  getSettings,
  getSettingsSchema,
  updateSetting,
} from './settings.js';

import { registerTerminalHandlers, cleanupTerminalsForOwner } from './terminal.js';
const isDev = process.env.NODE_ENV === 'development';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;

function assertTrustedSender(event) {
  const frame = event.senderFrame;
  if (!frame) throw new Error('Missing IPC sender frame.');
  const url = new URL(frame.url);
  const trustedDev =
    !app.isPackaged &&
    url.protocol === 'http:' &&
    url.hostname === 'localhost' &&
    url.port === '3000';

  const trustedPackaged = app.isPackaged && url.protocol === 'file:';

  if (!trustedDev && !trustedPackaged) {
    console.error('Rejected IPC sender:', frame.url);
    throw new Error('Untrusted IPC sender.');
  }
}

function registerHandler(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event);
    return handler(...args);
  });
}

function registerSettingsHandlers() {
  registerHandler('settings:list-fonts', async () => {
    const fonts = await fontList.getFonts();
    return [...new Set(
      fonts.map((font) => font.replace(/^["']|["']$/g, '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  });
  registerHandler('settings:get', () => getSettings());
  registerHandler('settings:get-schema', () => getSettingsSchema());
  registerHandler('settings:update', async (key, value) => {
    const updatedSettings = await updateSetting(key, value);
    // Notify every live window after the update has been persisted.
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('settings:changed', updatedSettings);
    }
    return updatedSettings;
  });
}

function registerWindowEvents() {
  ipcMain.on('window:minimize', (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on('window:toggle-maximize', (event) => {
    assertTrustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });

  ipcMain.on('window:close', (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

function registerFilesystemHandlers() {
  registerHandler('workspace:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Workspace',
    });

    if (result.canceled || !result.filePaths[0]) return null;
    return setWorkspace(result.filePaths[0]);
  });

  registerHandler('fs:read-directory', readDirectory);
  registerHandler('fs:read-file', readTextFile);
  registerHandler('fs:write-file', writeTextFile);
  registerHandler('fs:create-file', createFile);
  registerHandler('fs:create-directory', createDirectory);
  registerHandler('fs:rename', renamePath);
  registerHandler('fs:delete', deletePath);
  registerHandler('workspace:current', () => getWorkspace());
  registerHandler('workspace:search-files', searchWorkspaceFiles);
}

function createMenu() {
  const sendCommand = (command) => {
    if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send('app:command', command);
  };

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Workspace…', accelerator: 'CmdOrCtrl+O', click: () => sendCommand('workspace.open') },
        { label: 'New File', accelerator: 'CmdOrCtrl+N', click: () => sendCommand('file.create') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendCommand('file.save') },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => sendCommand('tab.close') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendCommand('editor.undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => sendCommand('editor.redo') },
        { type: 'separator' },
        { role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => sendCommand('editor.find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Explorer', accelerator: 'CmdOrCtrl+B', click: () => sendCommand('view.explorer') },
        { label: 'Toggle Terminal', accelerator: 'CmdOrCtrl+J', click: () => sendCommand('view.terminal') },
        { label: 'Command Palette', accelerator: 'CmdOrCtrl+P', click: () => sendCommand('palette.open') },
        { type: 'separator' },
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => sendCommand('settings.open') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const icon = path.join(currentDir, 'icon.png');
  const preloadPath = path.join(currentDir, 'preload.js');

  const window = new BrowserWindow({
    width: 1000,
    height: 600,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    backgroundColor: '#17191f',
    icon,
    webPreferences: {
      devTools: true,
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: true,
      // sandbox: true,
    },
  });
  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.setIcon(icon);
  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if ((devUrl && url.startsWith(devUrl)) || (app.isPackaged && url.startsWith('file://'))) return;
    event.preventDefault();
  });

  if (isDev) void window.loadURL('http://localhost:3000');
  else void window.loadFile(path.join(currentDir, 'build', 'index.html'), { hash: '' });
  protocol.handle('audio', async (request) => {
    const audioPath = decodeURIComponent(request.url.slice('audio://'.length));
    return net.fetch(`file://${audioPath}`);
  });
}

app.whenReady().then(async () => {
  await initializeSettings();
  registerFilesystemHandlers();
  registerWindowEvents();
  // Register terminal IPC handlers once, not once per window.
  registerTerminalHandlers(assertTrustedSender);
  registerSettingsHandlers();
  createMenu();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', () => {
  for (const window of BrowserWindow.getAllWindows()) { cleanupTerminalsForOwner(window.webContents); }
});
