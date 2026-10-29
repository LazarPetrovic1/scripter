type FileEntry = {
  name: string;
  path: string;
  kind: "file" | "directory";
};

interface FilesystemAPI {
  readDirectory(path: string): Promise<FileEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createFile(path: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  renamePath(from: string, to: string): Promise<void>;
  deletePath(path: string): Promise<void>;
}

type OpenDocument = {
  path: string;
  content: string;
  savedContent: string;
  language: string;
  isDirty: boolean;
};

/*
  PROVIDE THE FOLLOWING:
    openFile(path);
    closeTab(path);
    setActiveTab(path);
    updateDocument(path, content);
    saveDocument(path);
    saveAllDocuments();
*/

type RegisteredCommand = {
  id: string;
  label: string;
  executable: string;
  args: string[];
  cwd: "workspace" | "file-directory";
};

type Command = {
  id: string;
  title: string;
  category: string;
  keybinding?: string;
  execute: () => void | Promise<void>;
};

/*
  EXAMPLE COMMANDS FOR PALETTE:
    Command | Action
    Open File | Show a workspace file picker
    Save File | Save the active document
    Save All | Save all modified documents
    Toggle Terminal | Show or hide the terminal
    Toggle Explorer | Show or hide the file tree
    New File | Create a file
    New Terminal | Open a new shell session
    Open Settings | Show the settings view
    Change Theme | Select a theme
    Run Current File | Execute a registered language command
*/

type AppSettings = {
  theme: "dark" | "light" | "system";
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: boolean;
  showLineNumbers: boolean;
  autosave: boolean;
  terminalFontSize: number;
  terminalShell?: string;
};

/*
  ADDITIONAL STUFF:
    Explorer: toggle visibility and adjust width.
    Editor: occupies the remaining central area.
    Bottom panel: terminal, output, and eventually problems.
    Status bar: file encoding, language mode, cursor position, and other useful metadata.
*/

/*
  TITLE AND MENU BAR:
    An application icon and workspace name.
    File, Edit, View, Terminal, and Help menus.
    Window controls appropriate to the platform.
    A draggable titlebar region.
    Non-draggable interactive buttons.
    A native application menu on macOS, where that behavior fits the platform.
*/

interface DesktopAPI {
  openWorkspace(): Promise<string | null>;
  readDirectory(path: string): Promise<FileEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createFile(path: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  renamePath(from: string, to: string): Promise<void>;
  deletePath(path: string): Promise<void>;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
}

// declare global {
//   interface Window {
//     desktop: DesktopAPI;
//   }
// }

// ZUSTAND STORE

interface Document {
  path: string;
  content: string;
  savedContent: string;
}

interface IDEState {
  workspace: string | null;
  files: FileEntry[];
  documents: Document[];
  activePath: string | null;
  sidebarVisible: boolean;
  terminalVisible: boolean;
  settingsVisible: boolean;
  paletteVisible: boolean;
  theme: "dark" | "light";

  openWorkspace: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  updateDocument: (path: string, content: string) => void;
  saveDocument: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  togglePalette: () => void;
  toggleSettings: () => void;
  toggleTheme: () => void;
}