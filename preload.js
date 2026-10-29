// preload.ts
import { contextBridge, ipcRenderer } from "electron";

/* DesktopAPI type */ const desktop = {
  openWorkspace: () => ipcRenderer.invoke("workspace:open"),
  readDirectory: (path) => ipcRenderer.invoke("fs:read-directory", path),
  readFile: (path) => ipcRenderer.invoke("fs:read-file", path),
  writeFile: (path, content) => ipcRenderer.invoke("fs:write-file", path, content),
  createFile: (path) => ipcRenderer.invoke("fs:create-file", path),
  createDirectory: (path) => ipcRenderer.invoke("fs:create-directory", path),
  renamePath: (from, to) => ipcRenderer.invoke("fs:rename", from, to),
  deletePath: (path) => ipcRenderer.invoke("fs:delete", path),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.send("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  searchWorkspaceFiles: () => ipcRenderer.invoke('workspace:search-files'),
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('app:command', listener);
    return () => { ipcRenderer.removeListener('app:command', listener); };
  },
};

const terminal = {
  // Shell discovery
  listTerminalShells: () => ipcRenderer.invoke('terminal:list-shells'),
  // Create a PTY
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  // Terminal input and sizing
  writeTerminal: (id, data) => ipcRenderer.invoke('terminal:write', id, data),
  resizeTerminal: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  closeTerminal: (id) => ipcRenderer.invoke('terminal:close', id),

  // Subscribe to terminal output
  onTerminalData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:data', listener);
    return () => { ipcRenderer.removeListener('terminal:data', listener); };
  },

  onTerminalExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:exit', listener);
    return () => { ipcRenderer.removeListener('terminal:exit', listener); };
  },
}

const settings = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getSchema: () => ipcRenderer.invoke('settings:get-schema'),
  updateSetting: (key, value) => ipcRenderer.invoke('settings:update', key, value),
  getFonts: () => ipcRenderer.invoke('settings:list-fonts'),
  onChanged: (callback) => {
    const listener = (_event, updatedSettings) => callback(updatedSettings);
    ipcRenderer.on('settings:changed', listener);
    return () => { ipcRenderer.removeListener('settings:changed', listener); };
  },
};

contextBridge.exposeInMainWorld("desktop", desktop);
contextBridge.exposeInMainWorld("terminal", terminal);
contextBridge.exposeInMainWorld('settings', settings);