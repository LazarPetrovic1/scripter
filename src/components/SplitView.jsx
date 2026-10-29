
import { useCallback, useRef, useState } from 'react';

export default function SplitView({
  left,
  right,
  initialWidth = 150,
  minWidth = 100,
  maxWidth = 450,
  collapsed = false,
  onCollapsedChange,
}) {
  const [leftWidth, setLeftWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const previousWidth = useRef(initialWidth);

  const collapse = useCallback(() => {
    if (!collapsed) {
      previousWidth.current = leftWidth;
      onCollapsedChange?.(true);
    } else {
      setLeftWidth(
        Math.min(maxWidth, Math.max(minWidth, previousWidth.current))
      );
      onCollapsedChange?.(false);
    }
  }, [collapsed, leftWidth, minWidth, maxWidth, onCollapsedChange]);

  const startDrag = useCallback((event) => {
    if (collapsed || event.button !== 0) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: leftWidth, };
    setIsDragging(true);

    const handleMove = (moveEvent) => {
      if (!dragRef.current) return;
      const delta = moveEvent.clientX - dragRef.current.startX;
      const nextWidth = Math.min(maxWidth, Math.max(0, dragRef.current.startWidth + delta));
      if (nextWidth < minWidth / 2) {
        previousWidth.current = dragRef.current.startWidth;
        onCollapsedChange?.(true);
        return;
      }
      setLeftWidth(Math.max(minWidth, nextWidth));
    };

    const handleUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [collapsed, leftWidth, minWidth, maxWidth, onCollapsedChange]);

  return (
    <div className={`split-view ${isDragging ? 'is-dragging' : ''}`}>
      {!collapsed && <div className="split-view-left" style={{ width: leftWidth }}>{left}</div>}
      <div
        className={`split-view-divider ${collapsed ? 'collapsed' : ''}`}
        onPointerDown={startDrag}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize explorer"
        title="Drag to resize; drag left to collapse"
      >
        <button
          className="split-view-toggle"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={collapse}
          title={collapsed ? 'Show explorer' : 'Hide explorer'}
          aria-label={collapsed ? 'Show explorer' : 'Hide explorer'}
        >{collapsed ? '›' : '‹'}</button>
      </div>
      <div className="split-view-right">{right}</div>
    </div>
  );
}
