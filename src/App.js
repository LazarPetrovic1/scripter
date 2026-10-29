import { CodeEditor, CommandPalette, Explorer, MenuBar, NameDialog, Titlebar, Settings, SplitView, Terminal } from './components/index.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
function basename(path) { return path.split(/[\\/]/).filter(Boolean).pop() || path; }

function joinPath(parent, name) {
  const separator = parent.includes('\\') ? '\\' : '/';
  return `${parent.replace(/[\\/]+$/, '')}${separator}${name}`;
}

function parentPath(path) {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index <= 0 ? path.slice(0, 1) : path.slice(0, index);
}

function isDocumentModified(doc) { return doc.content !== doc.savedContent; }

function getDocumentState(documents, path) {
  const doc = documents.find((item) => item.path === path);
  if (!doc) return null;
  return { ...doc, isModified: isDocumentModified(doc) };
}

function App() {
  const [workspace, setWorkspace] = useState(null);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [error, setError] = useState('');
  const [nameDialog, setNameDialog] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeDocument = getDocumentState(documents, activePath);
  const closeSettings = () => setSettingsOpen(() => false);

  useEffect(() => {
    let disposed = false;

    function applyTheme(settings) {
      const root = document.documentElement;
      const preference = settings['appearance.theme'] || 'dark';
      const accent = settings['appearance.accentColor'] || '#7c9cff';
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const resolvedTheme = preference === 'system' ? (media.matches ? 'light' : 'dark') : preference;
      root.dataset.theme = resolvedTheme;
      root.style.setProperty('--accent', accent);
    }

    let currentSettings = {};

    const onSystemThemeChange = () => {
      if (currentSettings['appearance.theme'] === 'system') applyTheme(currentSettings);
    };

    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', onSystemThemeChange);

    async function initialize() {
      try {
        const initial = await window.settings.getSettings();
        if (disposed) return;
        currentSettings = initial;
        applyTheme(initial);
      } catch (error) { console.error('Failed to initialize theme:', error); }
    }

    initialize();

    const unsubscribe = window.settings.onChanged((updated) => {
      currentSettings = updated;
      applyTheme(updated);
    });

    return () => {
      disposed = true;
      unsubscribe();
      media.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  const perform = useCallback(async (action) => {
    try {
      setError('');
      return await action();
    } catch (err) {
      setError(err.message || 'Operation failed');
      console.error('Operation failed:', err);
    }
  }, []);
  
  const refreshFiles = useCallback(async () => {
    if (!workspace) return;
    const [rootEntries, searchableFiles] = await Promise.all([
      window.desktop.readDirectory(workspace),
      window.desktop.searchWorkspaceFiles(),
    ]);
    setFiles(rootEntries);
    setWorkspaceFiles(searchableFiles);
  }, [workspace]);

  const openWorkspace = useCallback(async () => {
    const selected = await window.desktop.openWorkspace();
    if (!selected) return;
    // Clear stale state before loading the newly selected workspace.
    setWorkspace(selected);
    setFiles([]);
    setWorkspaceFiles([]);
    setDocuments([]);
    setActivePath(null);
    const [rootEntries, searchableFiles] = await Promise.all([
      window.desktop.readDirectory(selected),
      window.desktop.searchWorkspaceFiles(),
    ]);
    setFiles(rootEntries);
    setWorkspaceFiles(searchableFiles);
  }, []);

  const openFile = useCallback(async (path) => {
    const existing = documents.find((doc) => doc.path === path);
    if (existing) { setActivePath(path); return; }
    const content = await window.desktop.readFile(path);
    setDocuments((current) => [...current, { path, content, savedContent: content }]);
    setActivePath(path);
  }, [documents]);

  const saveFile = useCallback(async (path = activePath) => {
    const doc = documents.find((item) => item.path === path);
    if (!doc) return;
    const contentToSave = doc.content;
    await window.desktop.writeFile(path, contentToSave);
    setDocuments((current) => current.map((item) =>
      item.path === path ? { ...item, savedContent: contentToSave } : item
    ));
  }, [activePath, documents]);

  const updateContent = useCallback((path, content) => {
    setDocuments((current) => current.map((doc) => doc.path === path ? { ...doc, content } : doc));
  }, []);

  const createFile = useCallback((directory = workspace) => {
    if (!directory) return openWorkspace();
    setNameDialog({ type: 'createFile', directory });
  }, [workspace, openWorkspace]);

  const createFolder = useCallback((directory = workspace) => {
    if (!directory) return openWorkspace();
    setNameDialog({ type: 'createFolder', directory });
  }, [workspace, openWorkspace]);

  const rename = useCallback((entry) => {
    setNameDialog({ type: 'rename', entry });
  }, []);

  const remove = useCallback(async (entry) => {
    const confirmed = window.confirm(
      `Delete "${entry.name}"${entry.kind === 'directory' ? ' and all its contents' : ''}?`
    );
    if (!confirmed) return;
    await window.desktop.deletePath(entry.path);
    const separator = entry.path.includes('\\') ? '\\' : '/';
    setDocuments((current) => current.filter((doc) =>
      doc.path !== entry.path &&
      !doc.path.startsWith(entry.path + separator)
    ));

    setActivePath((current) => {
      const removed = current === entry.path || current?.startsWith(entry.path + separator);
      return removed ? documents.find((doc) =>
        doc.path !== entry.path && !doc.path.startsWith(entry.path + separator)
      )?.path ?? null : current;
    });

    await refreshFiles();
  }, [documents, refreshFiles]);

  const closeTab = useCallback((path = activePath) => {
    const doc = documents.find((item) => item.path === path);
    if (!doc) return;
    if (isDocumentModified(doc)) {
      if (!window.confirm('Discard unsaved changes and close this tab?')) return;
    }
    const remaining = documents.filter((item) => item.path !== path);
    setDocuments(remaining);
    if (activePath === path) setActivePath(remaining[remaining.length - 1]?.path ?? null);
  }, [documents, activePath]);

  const actions = useMemo(() => ({
    openWorkspace: () => perform(openWorkspace),
    createFile: (directory) => perform(() => createFile(directory)),
    createFolder: (directory) => perform(() => createFolder(directory)),
    openFile: (path) => perform(() => openFile(path)),
    rename: (entry) => perform(() => rename(entry)),
    remove: (entry) => perform(() => remove(entry)),
  }), [perform, openWorkspace, createFile, createFolder, openFile, rename, remove]);

  const commands = useMemo(() => [
    { id: 'workspace.open', label: 'Open Workspace', shortcut: 'Ctrl+O', keywords: ['folder', 'project', 'directory'], run: actions.openWorkspace },
    { id: 'palette.open', label: 'Command Palette', shortcut: 'Ctrl+P', keywords: ['commands', 'search', 'actions'], run: () => setPaletteOpen(true) },
    { id: 'file.create', label: 'New File', shortcut: 'Ctrl+N', keywords: ['create', 'file'], run: () => actions.createFile(workspace) },
    { id: 'file.save', label: 'Save File', shortcut: 'Ctrl+S', keywords: ['write', 'save'], run: () => perform(() => saveFile()) },
    { id: 'tab.close', label: 'Close Tab', shortcut: 'Ctrl+W', keywords: ['editor', 'close'], run: () => closeTab() },
    { id: 'view.explorer', label: 'Toggle Explorer', shortcut: 'Ctrl+B', keywords: ['sidebar', 'files', 'project'], run: () => setSidebarVisible((v) => !v) },
    { id: 'view.terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+J', keywords: ['shell', 'console', 'command line'], run: () => setTerminalVisible((v) => !v) },
    { id: 'settings.open', label: 'Open Settings', shortcut: 'Ctrl+,', keywords: ['preferences', 'configuration', 'options'], run: () => setSettingsOpen(true) },
    // { id: 'editor.find', label: 'Find in File', shortcut: 'Ctrl+F', keywords: ['search', 'text', 'locate'], run: () => window.alert('Find will be implemented with the editor search interface.') },
    // Connect these two callbacks to your editor's actual undo/redo API.
    // { id: 'editor.undo', label: 'Undo', shortcut: 'Ctrl+Z', keywords: ['revert', 'history'], run: () => editorActions.undo() },
    // { id: 'editor.redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', keywords: ['repeat', 'history'], run: () => editorActions.redo() },
  ], [actions, workspace, perform, saveFile, closeTab]);
  
  const executeCommand = useCallback((id) => {
    const command = commands.find((item) => item.id === id);
    if (command) void perform(command.run);
  }, [commands, perform]);

  useEffect(() => {
    return window.desktop.onCommand((commandId) => {
      const command = commands.find((item) => item.id === commandId);
      command?.run();
    });
  }, [commands]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      // Command palette: Ctrl/Cmd + P
      if (modifier && !event.shiftKey && key === 'p') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // Open workspace: Ctrl/Cmd + O
      if (modifier && key === 'o' && !event.shiftKey) {
        event.preventDefault();
        void perform(openWorkspace);
        return;
      }

      // Save active file: Ctrl/Cmd + S
      if (modifier && key === 's' && !event.shiftKey) {
        event.preventDefault();
        void perform(() => saveFile());
        return;
      }

      // New file: Ctrl/Cmd + N
      if (modifier && key === 'n' && !event.shiftKey) {
        event.preventDefault();
        void actions.createFile(workspace);
        return;
      }

      // Close active tab: Ctrl/Cmd + W
      if (modifier && key === 'w') {
        event.preventDefault();
        void closeTab();
        return;
      }

      // Toggle explorer: Ctrl/Cmd + B
      if (modifier && key === 'b' && !event.shiftKey) {
        event.preventDefault();
        setSidebarVisible((visible) => !visible);
        return;
      }

      // Toggle terminal: Ctrl/Cmd + J
      if (modifier && key === 'j' && !event.shiftKey) {
        event.preventDefault();
        setTerminalVisible((visible) => !visible);
        return;
      }

      // Next/previous editor tab: Ctrl/Cmd + Tab
      if (modifier && key === 'tab') {
        event.preventDefault();

        if (documents.length < 2) return;

        const currentIndex = documents.findIndex(
          (doc) => doc.path === activePath
        );

        const direction = event.shiftKey ? -1 : 1;
        const nextIndex =
          (currentIndex + direction + documents.length) % documents.length;

        setActivePath(documents[nextIndex].path);
        return;
      }

      // Find in current file: Ctrl/Cmd + F
      // if (modifier && key === 'f') {
      //   event.preventDefault();
      //   window.alert('Find will be implemented with the editor search interface.');
      // }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    perform,
    openWorkspace,
    saveFile,
    closeTab,
    actions,
    workspace,
    documents,
    activePath,
  ]);

  useEffect(() => {
    const unsubscribe = window.desktop.onOpenWorkspace?.(() => {
      void perform(openWorkspace);
    });

    return unsubscribe;
  }, [perform, openWorkspace]);

  const handleNameConfirm = useCallback(async (name) => {
    const dialog = nameDialog;
    if (!dialog) return;
    setNameDialog(null);

    if (dialog.type === 'createFile') {
      const path = joinPath(dialog.directory, name);
      await window.desktop.createFile(path);
      await refreshFiles();
      await openFile(path);
      return;
    }

    if (dialog.type === 'createFolder') {
      const path = joinPath(dialog.directory, name);
      await window.desktop.createDirectory(path);
      await refreshFiles();
      return;
    }

    if (dialog.type === 'rename') {
      const { entry } = dialog;
      if (name === entry.name) return;
      const nextPath = joinPath(parentPath(entry.path), name);
      await window.desktop.renamePath(entry.path, nextPath);
      setDocuments((current) =>
        current.map((doc) => {
          if (doc.path === entry.path) return { ...doc, path: nextPath };
          const separator = entry.path.includes('\\') ? '\\' : '/';
          if (doc.path.startsWith(entry.path + separator)) {
            return { ...doc, path: nextPath + doc.path.slice(entry.path.length) };
          }
          return doc;
        })
      );

      setActivePath((current) => {
        if (current === entry.path) return nextPath;
        const separator = entry.path.includes('\\') ? '\\' : '/';
        return current?.startsWith(entry.path + separator) ? nextPath + current.slice(entry.path.length) : current;
      });

      await refreshFiles();
    }
  }, [nameDialog, refreshFiles, openFile]);

  return (
    <>
      <Titlebar />
      <MenuBar executeCommand={executeCommand} />
      {settingsOpen ? (
        <Settings onClose={closeSettings} />
      ) : (
        <>
          <div className="app initial-welcome-page">
            <div className="workspace-layout">
              <SplitView
                collapsed={!sidebarVisible}
                onCollapsedChange={(collapsed) => setSidebarVisible(!collapsed)}
                left={
                  <Explorer
                    workspace={workspace}
                    files={files}
                    onRefresh={() => perform(refreshFiles)}
                    actions={actions}
                  />
                }
                right={
                  <main className="editor-area">
                    <div className="editor-tabs">
                      {documents.map((doc) => {
                        const modified = doc.content !== doc.savedContent;
                        const active = activePath === doc.path;

                        return (
                          <div key={doc.path} className={`editor-tab ${active ? 'active' : ''}`}>
                            <button onClick={() => setActivePath(doc.path)}>
                              {basename(doc.path)}
                              {modified ? ' •' : ''}
                            </button>
                            <button
                              className="tab-close"
                              aria-label={`Close ${basename(doc.path)}`}
                              onClick={() => closeTab(doc.path)}
                            >×</button>
                          </div>
                        );
                      })}
                    </div>
                    {/* <div className="editor-tabs">
                      {documents.map((doc) => {
                        const modified = isDocumentModified(doc);
                        return (
                          <div
                            key={doc.path}
                            className={`editor-tab ${activePath === doc.path ? 'active' : ''}`}
                          >
                            <button onClick={() => setActivePath(doc.path)}>
                              {basename(doc.path)}
                              {modified ? ' •' : ''}
                            </button>
                            <button
                              className="tab-close"
                              aria-label={`Close ${basename(doc.path)}`}
                              onClick={() => closeTab(doc.path)}
                            >×</button>
                          </div>
                        );
                      })}
                    </div> */}
                    <div className="right-side-split">
                      {activeDocument ? (
                        <CodeEditor
                          path={activeDocument.path}
                          content={activeDocument.content}
                          onChange={(value) =>
                            updateContent(activeDocument.path, value)
                          }
                        />
                      ) : (
                        <div className="editor-welcome">
                          <div className="center">
                            <h1>Scripter</h1>
                            <p>Open a file from the explorer to start editing.</p>

                            {!workspace && (
                              <button onClick={() => void perform(openWorkspace)}>
                                Open Workspace (Ctrl + O)
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {terminalVisible && (
                        <Terminal workspace={workspace} />
                      )}
                    </div>
                  </main>
                }
              />
            </div>
          </div>
          <footer className="statusbar">
            <span>{workspace ? basename(workspace) : 'No workspace'}</span>
            <span>{activeDocument ? activeDocument.isModified ? 'Modified' : 'Saved' : 'Ready'} </span>
            <span>{activeDocument ? basename(activeDocument.path).split('.').pop().toUpperCase() : 'Plain text'}</span>
          </footer>
        </>
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      <NameDialog
        open={Boolean(nameDialog)}
        title={
          nameDialog?.type === 'createFile' ? 'New File'
            : nameDialog?.type === 'createFolder'
              ? 'New Folder'
              : 'Rename'
        }
        initialValue={
          nameDialog?.type === 'rename'
            ? nameDialog.entry.name
            : ''
        }
        onConfirm={handleNameConfirm}
        onCancel={() => setNameDialog(null)}
      />
      {paletteOpen && (
        <CommandPalette
          commands={commands}
          onClose={() => setPaletteOpen(false)}
          workspace={workspace}
          workspaceFiles={workspaceFiles}
          onOpenFile={(path) => actions.openFile(path)}
        />
      )}
    </>
  );
}

export default App;
