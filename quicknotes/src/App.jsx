import React, { useState, useEffect, useRef, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";

const STORE_FILE = "quicknotes.json";
const DATA_KEY = "data";
const LEGACY_NOTES_KEY = "notes";

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

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TagPopoverContent({ tags, mode, onSelect, onCreate, onDeleteTag }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#e8b54f");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, color);
    setName("");
    setColor("#e8b54f");
  }

  return (
    <>
      <div className="qn-popover-row" onClick={() => onSelect(null)}>
        <span className="qn-popover-empty-dot" />
        {mode === "filter" ? "Todos" : "Sin tag"}
      </div>
      {tags.length > 0 && <div className="qn-popover-divider" />}
      {tags.map((t) => (
        <div key={t.id} className="qn-popover-row" onClick={() => onSelect(t.id)}>
          <span className="qn-popover-dot" style={{ background: t.color }} />
          <span style={{ flex: 1 }}>{t.name}</span>
          <button
            className="qn-tag-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTag(t.id);
            }}
            title="Eliminar tag"
          >
            <TrashIcon />
          </button>
        </div>
      ))}
      <div className="qn-popover-divider" />
      <div className="qn-tag-create">
        <input
          type="text"
          placeholder="Nuevo tag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button onClick={submit}>Crear</button>
      </div>
    </>
  );
}

export default function QuickNotesApp() {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  // tagMenu: null | { mode: "filter" | "assign", noteId, x, right, y }
  const [tagMenu, setTagMenu] = useState(null);

  const hasLoaded = useRef(false);
  const saveTimer = useRef(null);
  const observerRef = useRef(null);
  const heightTimers = useRef({});

  const storeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const store = await load(STORE_FILE, { autoSave: false });
        storeRef.current = store;
        const data = await store.get(DATA_KEY);
        if (data && Array.isArray(data.notes)) {
          setNotes(data.notes);
          setTags(Array.isArray(data.tags) ? data.tags : []);
        } else {
          const legacyNotes = await store.get(LEGACY_NOTES_KEY);
          if (Array.isArray(legacyNotes)) setNotes(legacyNotes);
        }
      } catch (e) {
        console.error("No se pudo cargar el store:", e);
      } finally {
        hasLoaded.current = true;
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hasLoaded.current || !storeRef.current) return;
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await storeRef.current.set(DATA_KEY, { notes, tags });
        await storeRef.current.save();
        setSaveStatus("saved");
      } catch (e) {
        console.error("No se pudo guardar:", e);
        setSaveStatus("error");
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [notes, tags]);

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
      tagId: activeFilter !== "all" ? activeFilter : null,
    };
    setNotes((prev) => [newNote, ...prev]);
  }

  function deleteNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function updateNote(id, field, value) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)));
  }

  function createTag(name, color) {
    const newTag = { id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, color };
    setTags((prev) => [...prev, newTag]);
    return newTag;
  }

  function deleteTag(tagId) {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setNotes((prev) => prev.map((n) => (n.tagId === tagId ? { ...n, tagId: null } : n)));
    setActiveFilter((prev) => (prev === tagId ? "all" : prev));
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

  function openFilterMenu(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTagMenu((prev) =>
      prev && prev.mode === "filter" ? null : { mode: "filter", noteId: null, x: rect.left, y: rect.bottom + 6 }
    );
  }

  function openAssignMenu(e, noteId) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTagMenu((prev) =>
      prev && prev.noteId === noteId
        ? null
        : { mode: "assign", noteId, right: window.innerWidth - rect.right, y: rect.bottom + 6 }
    );
  }

  const visibleNotes = activeFilter === "all" ? notes : notes.filter((n) => n.tagId === activeFilter);
  const currentFilterTag = activeFilter !== "all" ? tags.find((t) => t.id === activeFilter) : null;

  return (
    <div className="qn-root">
      <style>{`
        .qn-root {
          min-height: 100%;
          background: #19191b;
          color: #e9e9ea;
          color-scheme: dark;
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
          background: #e97425;
          color: #ffffff;
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
        .qn-filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #242426;
          border: 1px solid #34343a;
          color: #c9c9cc;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12.5px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .qn-filter-btn:hover { background: #2c2c2f; }
        .qn-filter-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
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
          min-height: 72px;
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
          color-scheme: dark;
        }
        .qn-title-input::placeholder {
          color: #5c5c60;
          font-weight: 500;
        }
        .qn-note-tag-btn {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1.5px dashed #4a4a4e;
          background: transparent;
          cursor: pointer;
          padding: 0;
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
          color-scheme: dark;
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
          margin-top: 8px;
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
        .qn-overlay {
          position: fixed;
          inset: 0;
          z-index: 90;
        }
        .qn-popover {
          position: fixed;
          min-width: 210px;
          background: #26262a;
          border: 1px solid #3a3a3e;
          border-radius: 8px;
          padding: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45);
          z-index: 100;
        }
        .qn-popover-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 13px;
          color: #e0e0e2;
        }
        .qn-popover-row:hover { background: #323236; }
        .qn-popover-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .qn-popover-empty-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1.5px dashed #5c5c60;
        }
        .qn-popover-divider {
          height: 1px;
          background: #3a3a3e;
          margin: 6px 0;
        }
        .qn-tag-create {
          display: flex;
          gap: 6px;
          align-items: center;
          padding: 4px 4px 2px;
        }
        .qn-tag-create input[type="text"] {
          flex: 1;
          background: #1f1f22;
          border: 1px solid #3a3a3e;
          border-radius: 5px;
          padding: 5px 7px;
          font-size: 12.5px;
          color: #e9e9ea;
          outline: none;
          color-scheme: dark;
        }
        .qn-tag-create input[type="color"] {
          width: 28px;
          height: 28px;
          padding: 0;
          border: 1px solid #3a3a3e;
          border-radius: 5px;
          background: transparent;
          cursor: pointer;
        }
        .qn-tag-create button {
          background: #e8b54f;
          color: #1c1404;
          border: none;
          border-radius: 5px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .qn-tag-delete {
          background: transparent;
          border: none;
          color: #5c5c60;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          display: flex;
        }
        .qn-tag-delete:hover {
          color: #d9665f;
          background: rgba(217, 102, 95, 0.1);
        }
      `}</style>

      <div className="qn-toolbar">
        <div className="qn-toolbar-left">
          <span className="qn-title">Notas rápidas</span>
          <button className="qn-add-btn" onClick={addNote}>
            <PlusIcon />
            Agregar
          </button>
          <button className="qn-filter-btn" onClick={openFilterMenu}>
            {currentFilterTag && <span className="qn-filter-dot" style={{ background: currentFilterTag.color }} />}
            {currentFilterTag ? currentFilterTag.name : "Todos"}
            <ChevronDownIcon />
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
        ) : visibleNotes.length === 0 ? (
          <div className="qn-empty">
            {activeFilter === "all" ? (
              <>
                Todavía no tienes notas.
                <br />
                Usa "+ Agregar" para crear la primera.
              </>
            ) : (
              "No hay notas con este tag."
            )}
          </div>
        ) : (
          <>
            <div className="qn-hint">
              Arrastra el borde inferior de una nota para ajustar su alto. El ancho se adapta solo al tamaño de la ventana. Javier
            </div>
            <div className="qn-list">
              {visibleNotes.map((note) => {
                const tag = tags.find((t) => t.id === note.tagId) || null;
                return (
                  <div
                    key={note.id}
                    className="qn-card"
                    data-note-id={note.id}
                    ref={attachRef}
                    style={{
                      ...(note.height ? { height: `${note.height}px` } : {}),
                      borderLeftColor: tag ? tag.color : "#313134",
                      borderLeftWidth: tag ? "4px" : "1px",
                    }}
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
                        className="qn-note-tag-btn"
                        style={tag ? { background: tag.color, borderColor: tag.color, borderStyle: "solid" } : undefined}
                        onClick={(e) => openAssignMenu(e, note.id)}
                        title={tag ? `Tag: ${tag.name}` : "Asignar tag"}
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
                );
              })}
            </div>
          </>
        )}
      </div>

      {tagMenu && (
        <>
          <div className="qn-overlay" onClick={() => setTagMenu(null)} />
          <div
            className="qn-popover"
            style={{
              top: tagMenu.y,
              ...(tagMenu.mode === "assign" ? { right: tagMenu.right } : { left: tagMenu.x }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <TagPopoverContent
              tags={tags}
              mode={tagMenu.mode}
              onSelect={(tagId) => {
                if (tagMenu.mode === "filter") {
                  setActiveFilter(tagId || "all");
                } else {
                  updateNote(tagMenu.noteId, "tagId", tagId);
                }
                setTagMenu(null);
              }}
              onCreate={(name, color) => {
                const t = createTag(name, color);
                if (tagMenu.mode === "assign") {
                  updateNote(tagMenu.noteId, "tagId", t.id);
                }
                setTagMenu(null);
              }}
              onDeleteTag={(tagId) => deleteTag(tagId)}
            />
          </div>
        </>
      )}
    </div>
  );
}