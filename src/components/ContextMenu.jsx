
import { useEffect } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const handlePointerDown = () => onClose();
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => (
        item.separator ? (
          <div className="context-separator" key={`separator-${index}`} />
        ) : (
          <button
            key={item.label}
            disabled={item.disabled}
            onClick={() => { onClose(); item.action?.(); }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="context-shortcut">{item.shortcut}</span>}
          </button>
        )
      ))}
    </div>
  );
}
