
import { useEffect, useMemo, useState } from 'react';

export default function Settings({ onClose }) {
  const [schema, setSchema] = useState([]);
  const [values, setValues] = useState({});
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Editor');
  const [error, setError] = useState('');
  const [, setFonts] = useState([]);

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const [definitions, current, availableFonts] = await Promise.all([
          window.settings.getSchema(),
          window.settings.getSettings(),
          window.settings.getFonts()
        ]);

        if (disposed) return;
        setSchema(definitions.map((item) => item.key === 'editor.fontFamily' ? {
          ...item, options: [ item.default, ...availableFonts.filter((font) => font !== item.default),],
        } : item));
        setFonts(availableFonts);
        setValues(current);
      } catch (err) {
        if (!disposed) setError(String(err));
      }
    }

    load();
    const unsubscribe = window.settings.onChanged((updated) => { setValues(updated); });
    return () => { disposed = true; unsubscribe(); };
  }, []);

  const categories = useMemo(() => [...new Set(schema.map((item) => item.category))], [schema]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return schema.filter((item) => {
      const matchesCategory = query || item.category === activeCategory;
      const matchesSearch = !query ||
        `${item.label} ${item.description} ${item.key} ${item.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [schema, activeCategory, search]);

  async function update(key, value) {
    setError('');
    const previous = values[key];
    setValues((current) => ({ ...current, [key]: value }));
    try {
      const updated = await window.settings.updateSetting(key, value);
      setValues(updated);
    } catch (err) {
      setValues((current) => ({ ...current, [key]: previous }));
      setError(String(err));
    }
  }

  function renderControl(item) {
    const value = values[item.key];
    if (item.type === 'boolean') {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => update(item.key, event.target.checked)}
        />
      );
    }

    if (item.type === 'select') {
      return (
        <select value={value ?? item.default} onChange={(event) => update(item.key, event.target.value)}>
          {item.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }

    if (item.type === 'number') {
      return (
        <input
          type="number"
          min={item.min}
          max={item.max}
          value={value ?? item.default}
          onChange={(event) => {
            if (event.target.value === '') return;
            update(item.key, Number(event.target.value));
          }}
        />
      );
    }

    if (item.type === 'color') {
      return (
        <input
          type="color"
          value={value ?? item.default}
          onChange={(event) => update(item.key, event.target.value)}
        />
      );
    }

    return (
      <input
        type="text"
        value={value ?? item.default}
        maxLength={500}
        onChange={(event) => update(item.key, event.target.value)}
      />
    );
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <h2>Settings</h2>
        <input
          type="search"
          placeholder="Search settings..."
          aria-label="Search settings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className='settings-close' onClick={onClose}>&times;</button>
      </header>
      {error && <p className="settings-error">{error}</p>}
      <div className="settings-layout">
        {!search.trim() && (
          <nav className="settings-sidebar" aria-label="Settings categories">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={activeCategory === category ? 'active' : ''}
                onClick={() => setActiveCategory(category)}
              >{category}</button>
            ))}
          </nav>
        )}

        <div className="settings-content">
          {filtered.length === 0 && <p className="settings-empty">No matching settings.</p>}
          {filtered.map((item) => (
            <div className="setting-row" key={item.key}>
              <div className="setting-description">
                <label htmlFor={item.key}>{item.label}</label>
                <p>{item.description}</p>
                <code>{item.key}</code>
              </div>
              <div className="setting-control">{renderControl(item)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}