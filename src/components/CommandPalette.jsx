import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, FileCode, TerminalSquare } from 'lucide-react';

function relativePath(path, workspace) {
  if (!workspace) return path;
  const normalizedPath = path.replace(/\\/g, '/');
  const normalizedWorkspace = workspace.replace(/\\/g, '/').replace(/\/+$/, '');
  if (normalizedPath.toLowerCase().startsWith((normalizedWorkspace + '/').toLowerCase()))
    return normalizedPath.slice(normalizedWorkspace.length + 1);
  return path;
}

export default function CommandPalette({ commands, onClose, workspace, workspaceFiles = [], onOpenFile }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matchingCommands = commands.filter((command) => {
      const searchText = [ command.label, command.id, ...(command.keywords || [])].join(' ').toLowerCase();
      return searchText.includes(search);
    }).map((command) => ({
      type: 'command',
      id: command.id,
      label: command.label,
      shortcut: command.shortcut,
      command,
    }));

    // Keep the initial palette focused on commands. Start searching
    // workspace files when the user enters a query.
    
  const matchingFiles = search && workspace ? workspaceFiles.filter((file) => {
      const filePath = relativePath(file.path, workspace);
      return filePath.toLowerCase().includes(search);
    }).map((file) => ({
      type: 'file',
      id: file.path,
      label: relativePath(file.path, workspace),
      path: file.path,
      file,
    })) : [];
    return [...matchingCommands, ...matchingFiles];
  }, [commands, query, workspace, workspaceFiles]);

  useEffect(() => { setSelected(0); }, [query, commands.length, workspaceFiles]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  function execute(index) {
    const result = results[index];
    if (!result) return;
    onClose();
    if (result.type === 'command') result.command.run();
    else onOpenFile?.(result.path);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') { onClose(); return; }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => results.length ? (index + 1) % results.length : 0);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => results.length ? (index - 1 + results.length) % results.length : 0);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      execute(selected);
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-search">
          <h2 className="center">Command Palette</h2>
          <div>
            <Search size={17} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
              placeholder="Type a command or search for a file..."
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        <div className="palette-results">
          {results.map((result, index) => (
            <button
              type="button"
              key={`${result.type}:${result.id}`}
              className={index === selected ? 'palette-item selected' : 'palette-item'}
              onMouseEnter={() => setSelected(index)}
              onClick={() => execute(index)}
            >
              {result.type === 'file' ? <FileCode size={16} /> : <TerminalSquare size={16} />}
              <span>{result.label}</span>
              {result.type === 'file' ? <kbd>File</kbd> : result.shortcut && <kbd>{result.shortcut}</kbd>}
            </button>
          ))}

          {results.length === 0 && <div className="empty-message">No matching commands or files</div>}
        </div>
      </div>
    </div>
  );
}
