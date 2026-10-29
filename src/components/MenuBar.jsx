
import { useEffect, useRef, useState } from 'react';

const menus = {
  File: [
    { label: 'Open Workspace', command: 'workspace.open', shortcut: 'Ctrl+O' },
    { label: 'New File', command: 'file.create', shortcut: 'Ctrl+N' },
    { label: 'Save', command: 'file.save', shortcut: 'Ctrl+S' },
    { label: 'Close Tab', command: 'tab.close', shortcut: 'Ctrl+W' },
  ],
  View: [
    { label: 'Toggle Explorer', command: 'view.explorer', shortcut: 'Ctrl+B' },
    { label: 'Toggle Terminal', command: 'view.terminal', shortcut: 'Ctrl+J' },
    { label: 'Command Palette', command: 'palette.open', shortcut: 'Ctrl+P' },
    { label: 'Settings', command: 'settings.open', shortcut: 'Ctrl+,' },
  ],
  Edit: [
    { label: 'Undo', command: 'editor.undo' },
    { label: 'Redo', command: 'editor.redo' },
    { label: 'Find', command: 'editor.find' },
  ],
};

export default function MenuBar({ executeCommand }) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuBarRef = useRef(null);
  useEffect(() => {
    function handleOutsideClick(event) { if (menuBarRef.current && !menuBarRef.current.contains(event.target)) setActiveMenu(null); }
    function handleEscape(event) { if (event.key === 'Escape') setActiveMenu(null); }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <nav className="menubar" ref={menuBarRef}>
      {Object.entries(menus).map(([name, items]) => (
        <div className="menubar-group" key={name}>
          <button
            type="button"
            className={activeMenu === name ? 'menu-trigger active' : 'menu-trigger'}
            aria-expanded={activeMenu === name}
            onClick={() => setActiveMenu(current => current === name ? null : name)}
          >{name}</button>

          {activeMenu === name && (
            <div className="menu-dropdown">
              {items.map(item => (
                <button
                  type="button"
                  key={item.command}
                  className="menu-item"
                  onClick={() => { setActiveMenu(null); executeCommand(item.command); }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <small className="shortcut">{item.shortcut}</small>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
