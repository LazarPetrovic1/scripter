import { useEffect, useRef, useState } from 'react';
import { minimalSetup, EditorView } from 'codemirror';
import { EditorState, Compartment, Annotation } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  search,
  openSearchPanel,
  closeSearchPanel,
  findNext,
  findPrevious,
  searchKeymap,
  searchPanelOpen
} from '@codemirror/search';

const externalDocumentUpdate = Annotation.define();

function languageFor(path = '') {
  const filename = path.split(/[\\/]/).pop() || '';
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': case 'ts': case 'tsx': return javascript({
      typescript: extension === 'ts' || extension === 'tsx',
      jsx: extension === 'jsx' || extension === 'tsx',
    });
    case 'json': return json();
    case 'py': return python();
    case 'html': case 'htm': return html();
    case 'css': return css();
    case 'md': case 'markdown': return markdown();
    default: return [];
  }
}

const defaults = {
  'editor.fontFamily': 'monospace',
  'editor.fontSize': 14,
  'editor.tabSize': 2,
  'editor.lineNumbers': true,
};

function fontTheme(fontFamily, fontSize) {
  const safeFamily = String(fontFamily || 'monospace').replace(/["\\]/g, '\\$&');
  return EditorView.theme({
    '&': { fontSize: `${fontSize}px` },
    '.cm-content, .cm-gutters': {
      fontFamily: `"${safeFamily}", monospace`,
    },
  });
}

export default function CodeEditor({ path, content = '', theme = 'dark', onChange }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const languageCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());
  const tabSizeCompartment = useRef(new Compartment());
  const lineNumbersCompartment = useRef(new Compartment());
  const [settings, setSettings] = useState(defaults);
  const [resolvedTheme, setResolvedTheme] = useState(theme);
  const [isFindOpen, setIsFindOpen] = useState(false);

  const handleFind = () => {
    const view = viewRef.current;
    if (!view) return;
    if (isFindOpen) { closeSearchPanel(view); setIsFindOpen(false); }
    else { openSearchPanel(view); setIsFindOpen(true); }
    syncFindState(view);
  };

  const syncFindState = (view) => setIsFindOpen(searchPanelOpen(view.state));
  const handleFindNext = () => { const view = viewRef.current; if (view) findNext(view); };
  const handleFindPrevious = () => { const view = viewRef.current; if (view) findPrevious(view); };
  const handleCloseFind = () => { const view = viewRef.current; if (view) closeSearchPanel(view); };

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  // Load settings and listen for live changes.
  useEffect(() => {
    let disposed = false;
    const applySettings = (next) => { setSettings((current) => ({ ...current, ...next })); };
    window.settings.getSettings()
      .then((next) => { if (!disposed) applySettings(next); })
      .catch((error) => { console.error('Could not load editor settings:', error); });
    const unsubscribe = window.settings.onChanged(applySettings);
    return () => { disposed = true; unsubscribe(); };
  }, []);

  // Follow the app's resolved theme, including system-theme changes.
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => { setResolvedTheme(root.dataset.theme || theme || 'dark'); };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [theme]);

  // Create the editor once; reconfigure its compartments below.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          keymap.of([
            ...searchKeymap,
            { key: 'F3', run: findNext },
            { key: 'Shift-F3', run: findPrevious },
            { key: 'Ctrl-F', run: handleFind },
            {
              key: 'Escape',
              run: (view) => {
                if (!searchPanelOpen(view.state)) return false;
                closeSearchPanel(view);
                setIsFindOpen(false);
                return true;
              },
            },
            indentWithTab
          ]),
          minimalSetup,
          search(),
          languageCompartment.current.of(languageFor(path)),
          themeCompartment.current.of(resolvedTheme === 'dark' ? oneDark : []),
          fontCompartment.current.of(fontTheme(defaults['editor.fontFamily'], defaults['editor.fontSize'])),
          tabSizeCompartment.current.of(EditorState.tabSize.of(defaults['editor.tabSize'])),
          lineNumbersCompartment.current.of([lineNumbers(), highlightActiveLineGutter()]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const isExternalUpdate = update.transactions.some((transaction) => transaction.annotation(externalDocumentUpdate));
            if (!isExternalUpdate) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
      parent: host,
    });

    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // Editor lifetime is tied to the mounted component.
    // Settings and file changes are applied through compartments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update the active language without recreating the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: languageCompartment.current.reconfigure(languageFor(path)) });
  }, [path]);

  // Update the font family and size.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: fontCompartment.current.reconfigure(
        fontTheme(settings['editor.fontFamily'], Number(settings['editor.fontSize']) || 14)
      ),
    });
    // eslint-disable-next-line
  }, [settings['editor.fontFamily'], settings['editor.fontSize']]);

  // Update indentation width.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const tabSize = Math.max(1, Math.min(8, Number(settings['editor.tabSize']) || 2));
    view.dispatch({ effects: tabSizeCompartment.current.reconfigure(EditorState.tabSize.of(tabSize)) });
    // eslint-disable-next-line
  }, [settings['editor.tabSize']]);

  // Toggle the gutter without resetting the document or history.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: lineNumbersCompartment.current.reconfigure(
        settings['editor.lineNumbers'] ? [lineNumbers(), highlightActiveLineGutter()] : []
      ),
    });
    // eslint-disable-next-line
  }, [settings['editor.lineNumbers']]);

  // Switch syntax editor theme independently of the app shell.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeCompartment.current.reconfigure(resolvedTheme === 'dark' ? oneDark : []) });
  }, [resolvedTheme]);

  // Synchronize external document changes without remounting.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        annotations: [externalDocumentUpdate.of(true)],
      });
    }
  }, [content]);

  return (
    <div className="code-editor-container">
      <div className="code-editor-toolbar">
        <button onClick={handleFind}>Find</button>
        <button onClick={handleFindPrevious}>Previous</button>
        <button onClick={handleFindNext}>Next</button>
        <button onClick={handleCloseFind}>Close Find</button>
      </div>

      <div className="code-editor" ref={hostRef} />
    </div>
  );
}
