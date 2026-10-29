
export function createCommands(actions) {
  return [
    {
      id: 'workspace.open',
      label: 'Open Workspace',
      category: 'File',
      shortcut: 'Ctrl+O',
      run: actions.openWorkspace,
    },
    {
      id: 'file.create',
      label: 'New File',
      category: 'File',
      run: actions.createFile,
    },
    {
      id: 'folder.create',
      label: 'New Folder',
      category: 'File',
      run: actions.createFolder,
    },
    {
      id: 'file.save',
      label: 'Save',
      category: 'File',
      shortcut: 'Ctrl+S',
      run: actions.saveFile,
    },
    {
      id: 'tab.close',
      label: 'Close Tab',
      category: 'Editor',
      run: actions.closeTab,
    },
    {
      id: 'view.explorer',
      label: 'Toggle Explorer',
      category: 'View',
      run: actions.toggleExplorer,
    },
    {
      id: 'view.terminal',
      label: 'Toggle Terminal',
      category: 'View',
      run: actions.toggleTerminal,
    },
    {
      id: 'palette.open',
      label: 'Command Palette',
      category: 'View',
      run: actions.openPalette,
    },
  ];
}
