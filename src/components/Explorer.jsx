
import { useState } from 'react';
import ContextMenu from './ContextMenu';

function basename(path) { return path.split(/[\\/]/).filter(Boolean).pop() || path; }

function FileTreeNode({ entry, depth, actions }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);

  async function toggleDirectory() {
    if (entry.kind !== 'directory') {
      actions.openFile(entry.path);
      return;
    }
    if (!expanded) {
      setLoading(true);
      setError('');

      try {
        const result = await window.desktop.readDirectory(entry.path);
        setChildren(result);
      } catch (err) {
        setError(err.message || 'Unable to read directory');
      } finally {
        setLoading(false);
      }
    }
    setExpanded((value) => !value);
  }

  async function refresh() {
    if (entry.kind !== 'directory') return;
    try {
      setChildren(await window.desktop.readDirectory(entry.path));
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to refresh directory');
    }
  }

  function showMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY });
  }

  const items = entry.kind === 'directory' ? [
    { label: 'Open Folder', action: () => setExpanded(true) },
    { separator: true },
    { label: 'New File', action: () => actions.createFile(entry.path) },
    { label: 'New Folder', action: () => actions.createFolder(entry.path) },
    { separator: true },
    { label: 'Refresh', action: refresh },
    { label: 'Rename', action: () => actions.rename(entry) },
    { label: 'Delete', action: () => actions.remove(entry) },
  ] : [
    { label: 'Open', action: () => actions.openFile(entry.path) },
    { label: 'Open in New Tab', action: () => actions.openFile(entry.path) },
    { separator: true },
    { label: 'Rename', action: () => actions.rename(entry) },
    { label: 'Delete', action: () => actions.remove(entry) },
  ];

  return (
    <div className="tree-node">
      <button
        className="tree-entry"
        style={{ paddingLeft: 10 + depth * 15 }}
        onClick={() => void toggleDirectory()}
        onContextMenu={showMenu}
        title={entry.path}
      >
        <span className="tree-chevron">{entry.kind === 'directory' ? (expanded ? '▾' : '▸') : ''}</span>
        <span className="tree-icon">{entry.kind === 'directory' ? (expanded ? '📂' : '📁') : '📄'}</span>
        <span className="tree-name">{entry.name}</span>
      </button>

      {menu && <ContextMenu {...menu} items={items} onClose={() => setMenu(null)} />}
      {error && <div className="tree-error" style={{ paddingLeft: 20 + depth * 15 }}>{error}</div>}

      {expanded && entry.kind === 'directory' && (
        <div>
          {loading ? <div className="tree-empty">Loading...</div> : children.length === 0 ? (
            <div className="tree-empty" style={{ paddingLeft: 30 + depth * 15 }}>Empty folder</div>
          ) : (
            children.map((child) => (
              <FileTreeNode key={child.path} entry={child} depth={depth + 1} actions={actions} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Explorer({ workspace, files, onRefresh, actions }) {
  const [menu, setMenu] = useState(null);

  if (!workspace) {
    return (
      <aside className="explorer">
        <div className="explorer-heading center">FILE EXPLORER</div>
        <div className="explorer-empty">
          <p>No workspace open.</p>
          <button onClick={actions.openWorkspace}>Open Folder</button>
        </div>
      </aside>
    );
  }

  const rootItems = [
    { label: 'New File', action: () => actions.createFile(workspace) },
    { label: 'New Folder', action: () => actions.createFolder(workspace) },
    { separator: true },
    { label: 'Refresh', action: onRefresh },
  ];

  return (
    <aside className="explorer">
      <div className="explorer-heading">
        <span>FILE EXPLORER</span>
        <div className="explorer-heading-actions">
          <button title="New File" onClick={() => actions.createFile(workspace)}>+F</button>
          <button title="New Folder" onClick={() => actions.createFolder(workspace)}>+D</button>
          <button title="Refresh" onClick={onRefresh}>↻</button>
        </div>
      </div>

      <button
        className="workspace-root"
        onClick={onRefresh}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <span>▾</span>
        <span>{basename(workspace)}</span>
      </button>

      {menu && <ContextMenu {...menu} items={rootItems} onClose={() => setMenu(null)} />}

      <div className="tree-list">
        {files.map((entry) => (
          <FileTreeNode key={entry.path} entry={entry} depth={0} actions={actions} />
        ))}
      </div>
    </aside>
  );
}
