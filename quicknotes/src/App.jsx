import React, { useState, useEffect, useRef, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";

const STORE_FILE = "quicknotes.json";
const STORE_KEY = "notes";

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function QuickNotesApp() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  const hasLoaded = useRef(false);
  const saveTimer = useRef(null);
  const observerRef = useRef(null);
  const heightTimers = useRef({});
  const storeRef = useRef(null);

  // Load the on-disk store once on mount (creates the JSON file on first run)
  useEffect(() => {
    (async () => {
      try {
        const store = await load(STORE_FILE, { autoSave: false });
        storeRef.current = store;
        const saved = await store.get(STORE_KEY);
        if (Array.isArray(saved)) setNotes(saved);
      } catch (e) {
        console.error("No se pudo cargar el store:", e);
      } finally {
        hasLoaded.current = true;
        setLoading(false);
      }
    })();
  }, []);

  // Debounced autosave to disk whenever notes change (after initial load)
  useEffect(() => {
    if (!hasLoaded.current || !storeRef.current) return;
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await storeRef.current.set(STORE_KEY, notes);
        await storeRef.current.save();
        setSaveStatus("saved");
      } catch (e) {
        console.error("No se pudo guardar:", e);
        setSaveStatus("error");
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [notes]);

  // Observe individual note height (resize: vertical) so manual resizing persists
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.dataset.noteId;
        if (!id) return;
        const newHeight = Math.round(entry.target.offsetHeight);
        clearTimeout(heightTimers.current[id]);
        heightTimers.current[id] = setTimeout(() => {
          setNotes((prev) =>
            prev.map((n) => {
              if (n.id !== id) return n;
              if (n.height && Math.abs(n.height - newHeight) < 3) return n;
              return { ...n, height: newHeight };
            })
          );
        }, 250);
      });
    });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, []);

  const attachRef = useCallback((el) => {
    if (el && observerRef.current) observerRef.current.observe(el);
  }, []);

  function addNote() {
    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "",
      content: "",
      height: null,
    };
    setNotes((prev) => [newNote, ...prev]);
  }

  function deleteNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function updateNote(id, field, value) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)));
  }

  async function handleCopy(id, content) {
    try {
      await navigator.clipboard.writeText(content || "");
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = content || "";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e2) {
        /* clipboard unavailable */
      }
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1400);
  }

  return (
    <div className="qn-root">
      <style>{`
        .qn-root {
          min-height: 100vh;
          background: #19191b;
          color: #e9e9ea;
          font-family: 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .qn-toolbar {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 20px;
          background: #1f1f22;
          border-bottom: 1px solid #2d2d30;
        }
        .qn-toolbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .qn-title {
          font-size: 14px;
          font-weight: 600;
          color: #c9c9cc;
          letter-spacing: 0.2px;
        }
        .qn-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #e8b54f;
          color: #1c1404;
          border: none;
          border-radius: 6px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
        }
        .qn-add-btn:hover { filter: brightness(1.08); }
        .qn-add-btn:active { transform: scale(0.97); }
        .qn-save-status {
          font-size: 12px;
          color: #71717a;
          min-width: 80px;
          text-align: right;
        }
        .qn-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px 60px;
        }
        .qn-list {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .qn-empty {
          max-width: 760px;
          margin: 60px auto 0;
          text-align: center;
          color: #71717a;
          font-size: 14px;
          line-height: 1.6;
        }
        .qn-loading {
          max-width: 760px;
          margin: 60px auto 0;
          text-align: center;
          color: #71717a;
          font-size: 13px;
        }
        .qn-card {
          width: 100%;
          box-sizing: border-box;
          background: #242426;
          border: 1px solid #313134;
          border-radius: 10px;
          padding: 12px 12px 14px;
          display: flex;
          flex-direction: column;
          resize: vertical;
          overflow: auto;
          min-height: 120px;
          transition: border-color 0.15s ease;
        }
        .qn-card:focus-within {
          border-color: #4a4a4e;
        }
        .qn-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .qn-title-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e9e9ea;
          font-size: 14px;
          font-weight: 600;
          padding: 2px 0;
        }
        .qn-title-input::placeholder {
          color: #5c5c60;
          font-weight: 500;
        }
        .qn-delete-btn {
          flex-shrink: 0;
          background: transparent;
          border: none;
          color: #5c5c60;
          cursor: pointer;
          padding: 5px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .qn-delete-btn:hover {
          color: #d9665f;
          background: rgba(217, 102, 95, 0.1);
        }
        .qn-card-body {
          flex: 1;
          display: flex;
          gap: 10px;
          min-height: 0;
        }
        .qn-content-input {
          flex: 1;
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: #d4d4d6;
          font-family: inherit;
          font-size: 13.5px;
          line-height: 1.55;
          min-height: 0;
        }
        .qn-content-input::placeholder {
          color: #5c5c60;
        }
        .qn-copy-btn {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 7px;
          border: 1px solid #3a3a3e;
          background: #2c2c2f;
          color: #b8b8bc;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          align-self: flex-start;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .qn-copy-btn:hover {
          background: #343437;
          color: #e9e9ea;
        }
        .qn-copy-btn.copied {
          background: rgba(95, 184, 122, 0.15);
          border-color: #5fb87a;
          color: #5fb87a;
        }
        .qn-hint {
          max-width: 760px;
          margin: 0 auto 16px;
          font-size: 12px;
          color: #5c5c60;
        }
      `}</style>

      <div className="qn-toolbar">
        <div className="qn-toolbar-left">
          <span className="qn-title">Notas rápidas</span>
          <button className="qn-add-btn" onClick={addNote}>
            <PlusIcon />
            Agregar
          </button>
        </div>
        <span className="qn-save-status">
          {saveStatus === "saving" && "Guardando…"}
          {saveStatus === "saved" && "Guardado"}
          {saveStatus === "error" && "Error al guardar"}
        </span>
      </div>

      <div className="qn-body">
        {loading ? (
          <div className="qn-loading">Cargando tus notas…</div>
        ) : notes.length === 0 ? (
          <div className="qn-empty">
            Todavía no tienes notas.
            <br />
            Usa "+ Agregar" para crear la primera.
          </div>
        ) : (
          <>
            <div className="qn-hint">
              Arrastra el borde inferior de una nota para ajustar su alto. El ancho se adapta solo al tamaño de la ventana.
            </div>
            <div className="qn-list">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="qn-card"
                  data-note-id={note.id}
                  ref={attachRef}
                  style={note.height ? { height: `${note.height}px` } : undefined}
                >
                  <div className="qn-card-header">
                    <input
                      className="qn-title-input"
                      type="text"
                      placeholder="Sin título"
                      value={note.title}
                      onChange={(e) => updateNote(note.id, "title", e.target.value)}
                    />
                    <button
                      className="qn-delete-btn"
                      onClick={() => deleteNote(note.id)}
                      title="Eliminar nota"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="qn-card-body">
                    <textarea
                      className="qn-content-input"
                      placeholder="Escribe aquí…"
                      value={note.content}
                      onChange={(e) => updateNote(note.id, "content", e.target.value)}
                    />
                    <button
                      className={`qn-copy-btn ${copiedId === note.id ? "copied" : ""}`}
                      onClick={() => handleCopy(note.id, note.content)}
                      title="Copiar contenido"
                    >
                      {copiedId === note.id ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}