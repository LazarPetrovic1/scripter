import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

function TerminalSession({ id, shell, workspace, active, settings, onStatus }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const fitRef = useRef(null);
  let opened = false;
  useEffect(() => {
    let disposed = false;
    let ptyReady = false;
    const ptyId = crypto.randomUUID();
    let terminalId = null;
    let frame = null;
    let observer = null;
    let unsubscribeData = () => {};
    let unsubscribeExit = () => {};

    const terminal = new XTerm({
      cursorBlink: settings['terminal.cursorBlink'] ?? true,
      fontSize: settings['terminal.fontSize'] ?? 13,
      fontFamily: 'Consolas, "Cascadia Mono", Menlo, Monaco, monospace',
      scrollback: settings['terminal.scrollback'] ?? 5000,
      theme: { background: '#17191f', foreground: '#d9dce5', cursor: '#ffffff', selectionBackground: '#34435e' },
    });

    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());
    terminalRef.current = terminal;
    fitRef.current = fit;
    const resize = () => {
      if (disposed || !opened || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (disposed || !opened) return;
        const container = containerRef.current;
        if (
          !container ||
          !container.isConnected ||
          container.clientWidth <= 0 ||
          container.clientHeight <= 0
        ) return;
        try {
          if (disposed || !ptyReady || !terminalId) return;
          const currentId = terminalId;
          window.terminal
            .resizeTerminal(currentId, terminal.cols, terminal.rows)
            .catch((error) => {
              if (
                !disposed &&
                ptyReady &&
                terminalId === currentId
              ) console.error('Terminal resize failed:', error);
            });
        } catch (error) { if (!disposed) console.error('Terminal resize failed:', error); }
      });
    };

    const inputSubscription = terminal.onData((data) => {
      if (disposed || !ptyReady || !terminalId) return;
      const currentId = terminalId;
      window.terminal.writeTerminal(currentId, data).catch((error) => {
        if (!disposed && ptyReady && terminalId === currentId) 
          console.error('Terminal input failed:', error);
      });
    });

    async function start() {
      try {
        const container = containerRef.current;
        if (!container) return;
        // Do not initialize xterm against a zero-sized container.
        while (!disposed) {
          const rect = container.getBoundingClientRect();
          if (container.isConnected && rect.width > 0 && rect.height > 0) break;
          await new Promise((resolve) => { frame = requestAnimationFrame(() => { frame = null; resolve(); }); });
        }

        if (disposed) return;
        terminal.open(container);
        opened = true
        // Subscribe before creating the PTY.
        unsubscribeData = window.terminal.onTerminalData(
          ({ id: eventId, data }) => {
            if (!disposed && eventId === ptyId) {
              terminal.write(data);
            }
          }
        );

        unsubscribeExit = window.terminal.onTerminalExit(
          ({ id: eventId, exitCode }) => {
            if (disposed || eventId !== ptyId) return;
            ptyReady = false;
            terminalId = null;
            onStatus(id, `Process exited (${exitCode ?? 'unknown'})`);
            terminal.write('\r\n[Process exited]\r\n');
          }
        );

        observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();

        const session = await window.terminal.createTerminal({
          id: ptyId,
          shell,
          cwd: workspace || undefined,
          cols: terminal.cols || 80,
          rows: terminal.rows || 24,
        });

        // React may have unmounted this session while IPC was pending.
        if (disposed) { await window.terminal.closeTerminal(ptyId).catch(() => {}); return; }
        if (session.id !== ptyId) {
          await window.terminal.closeTerminal(session.id).catch(() => {});
          throw new Error('Terminal session ID mismatch');
        }

        terminalId = ptyId;
        ptyReady = true;
        onStatus(id, `${session.shell} · ${session.cwd}`);
        resize();
        if (active) terminal.focus();
      } catch (error) {
        if (!disposed) {
          onStatus(id, 'Terminal failed to start');
          try { terminal.write(`\r\n${String(error)}\r\n`); }
          catch { /* The terminal may already have been disposed.*/ }
          console.error('Terminal startup failed:', error);
        }
      }
    }

    start();
    return () => {
      disposed = true;
      opened = false;
      ptyReady = false;
      observer?.disconnect();
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      inputSubscription.dispose();
      unsubscribeData();
      unsubscribeExit();
      const closingId = terminalId;
      terminalId = null;
      if (closingId) window.terminal.closeTerminal(closingId).catch(() => {});
      terminal.dispose();
      if (terminalRef.current === terminal) { terminalRef.current = null; fitRef.current = null; }
    };
    // Session identity is immutable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, shell, workspace]);

  // Apply settings. IMPORTANT: no cleanup that changes shared readiness flags.
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const styles = getComputedStyle(document.documentElement);
    const getColor = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;

    try {
      terminal.options.theme = {
        background: getColor('--editor', '#17191f'),
        foreground: getColor('--text', '#d9dce5'),
        cursor: getColor('--text', '#ffffff'),
        selectionBackground: getColor('--selection', '#34435e'),
      };

      terminal.options.fontSize = settings['terminal.fontSize'] ?? 13;
      terminal.options.scrollback = settings['terminal.scrollback'] ?? 5000;
      terminal.options.cursorBlink = settings['terminal.cursorBlink'] ?? true;

      if (active) {
        const frame = requestAnimationFrame(() => {
          const container = containerRef.current;

          if (
            terminalRef.current !== terminal ||
            !container ||
            container.clientWidth <= 0 ||
            container.clientHeight <= 0
          ) return;

          try { fitRef.current?.fit(); }
          catch (error) { console.error('Terminal refit failed:', error); }
        });

        return () => cancelAnimationFrame(frame);
      }
    } catch (error) { console.error('Failed to apply terminal settings:', error); }
  }, [settings, active]);

  // Resize and focus on tab activation.
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return;
      try { fitRef.current?.fit(); terminalRef.current?.focus(); }
      catch (error) { console.error('Terminal activation failed:', error); }
    });

    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{
        position: active ? 'relative' : 'absolute',
        inset: active ? undefined : 0,
        visibility: active ? 'visible' : 'hidden',
        pointerEvents: active ? 'auto' : 'none',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}
    />
  );
}

export default function Terminal({ workspace }) {
  const [shells, setShells] = useState([]);
  const [selectedShell, setSelectedShell] = useState('');
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [settings, setSettings] = useState({
    'terminal.fontSize': 13,
    'terminal.scrollback': 5000,
    'terminal.cursorBlink': true,
  });

  const initializedRef = useRef(false);

  // Load shells and terminal settings once.
  useEffect(() => {
    let disposed = false;
    async function initialize() {
      try {
        const [info, currentSettings] = await Promise.all([
          window.terminal.listTerminalShells(),
          window.settings.getSettings(),
        ]);

        if (disposed) return;
        setShells(info.shells);
        setSelectedShell(info.defaultShell || info.shells[0]?.id || '');
        setSettings((current) => ({ ...current, ...currentSettings }));
      } catch (error) { console.error('Terminal initialization failed:', error); }
    }

    initialize();
    const unsubscribe = window.settings.onChanged((next) => {
      setSettings((current) => ({ ...current, ...next }));
    });

    return () => { disposed = true; unsubscribe(); };
  }, []);

  const createSession = useCallback((shellId = selectedShell) => {
    if (!shellId) return;
    const id = crypto.randomUUID();
    setSessions((current) => [...current, { id, shell: shellId, status: 'Starting terminal...', } ]);
    setActiveSessionId(id);
  }, [selectedShell]);

  // Start the first terminal once the shell list is available.
  useEffect(() => {
    if (initializedRef.current || shells.length === 0) return;
    initializedRef.current = true;
    createSession(selectedShell || shells[0].id);
  }, [shells, selectedShell, createSession]);

  const updateStatus = useCallback((id, status) => {
    setSessions((current) => current.map((session) => session.id === id ? { ...session, status } : session));
  }, []);

  // Removing a session unmounts its TerminalSession component,
  // which closes only that session's PTY in its cleanup.
  const closeSession = useCallback((id) => {
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== id);
      setActiveSessionId((activeId) => {
        if (activeId !== id) return activeId;
        return remaining.length ? remaining[remaining.length - 1].id : null;
      });
      return remaining;
    });
  }, []);

  const closeAllSessions = useCallback(() => { setSessions([]); setActiveSessionId(null); }, []);

  return (
    <section className="terminal-panel">
      <header className="terminal-toolbar">
        <div className="terminal-tabs">
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className={`terminal-tab ${
                session.id === activeSessionId ? 'active' : ''
              }`}
            >
              <button
                type="button"
                className="terminal-tab-select"
                onClick={() => setActiveSessionId(session.id)}
                title={session.status}
              >
                {session.shell} {index + 1}
              </button>

              <button
                type="button"
                className="terminal-tab-close"
                aria-label={`Close terminal ${index + 1}`}
                title="Kill this terminal"
                onClick={() => closeSession(session.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="terminal-actions">
          <select
            aria-label="Shell for new terminal"
            value={selectedShell}
            onChange={(event) => setSelectedShell(event.target.value)}
          >
            {shells.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => createSession()}
            disabled={!selectedShell}
          >
            + New terminal
          </button>

          <button
            type="button"
            onClick={closeAllSessions}
            disabled={sessions.length === 0}
          >
            Kill all
          </button>
        </div>
      </header>

      {sessions.length > 0 && (
        <div className="terminal-status">
          {sessions.find((session) => session.id === activeSessionId)?.status}
        </div>
      )}

      <div className="terminal-views">
        {sessions.map((session) => (
          <TerminalSession
            key={session.id}
            id={session.id}
            shell={session.shell}
            workspace={workspace}
            active={session.id === activeSessionId}
            settings={settings}
            onStatus={updateStatus}
          />
        ))}

        {sessions.length === 0 && (
          <div className="terminal-empty">
            No active terminals. Create a new terminal to get started.
          </div>
        )}
      </div>
    </section>
  );
}