
import { useEffect, useState } from 'react';

export default function NameDialog({ open, title, initialValue = '', onConfirm, onCancel }) {
  const [name, setName] = useState(initialValue);
  useEffect(() => { if (open) setName(initialValue); }, [open, initialValue]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    onConfirm(value);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={onCancel}>
      <form className="name-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter a name"
          aria-label="Name"
        />

        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={!name.trim()}>Confirm</button>
        </div>
      </form>
    </div>
  );
}