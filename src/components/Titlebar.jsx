
import { Minus, Square, X } from 'lucide-react';
import logo from '../icon.png'

export default function Titlebar() {
  return (
    <header className="titlebar" style={{ width: "100vw" }}>
      <div className="titlebar-brand">
        <img height={16} width={16} src={logo} alt='Scripter Text Editor' />
        <span>Scripter&nbsp;v{process.env.REACT_APP_VERSION}</span>
      </div>

      <div className="titlebar-drag-region" />

      <div className="window-controls">
        <button aria-label="Minimize" onClick={() => window.desktop.minimizeWindow()}>
          <Minus size={15} />
        </button>
        <button aria-label="Maximize or restore" onClick={() => window.desktop.toggleMaximizeWindow()}>
          <Square size={13} />
        </button>
        <button
          aria-label="Close"
          className="window-close"
          onClick={() => window.desktop.closeWindow()}
        ><X size={15} /></button>
      </div>
    </header>
  );
}
