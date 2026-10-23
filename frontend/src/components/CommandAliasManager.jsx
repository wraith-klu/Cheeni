import React, { useState } from "react";
import {
  ALLOWED_ALIAS_APPS,
  ALLOWED_ALIAS_FOLDERS,
  MAX_COMMAND_ALIASES,
  readCommandAliases,
  validateCommandAlias,
} from "../utils/commandAliases";

export default function CommandAliasManager({ storageKey }) {
  const [aliases, setAliases] = useState(() => readCommandAliases(storageKey));
  const [phrase, setPhrase] = useState("");
  const [type, setType] = useState("launch_app");
  const [target, setTarget] = useState(ALLOWED_ALIAS_APPS[0]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const persist = (nextAliases) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextAliases));
      setAliases(nextAliases);
      setError("");
      return true;
    } catch {
      setError("Could not save aliases in this browser. Check available storage and try again.");
      return false;
    }
  };

  const resetForm = () => {
    setPhrase("");
    setType("launch_app");
    setTarget(ALLOWED_ALIAS_APPS[0]);
    setEditingId(null);
  };

  const saveAlias = (event) => {
    event.preventDefault();
    const validation = validateCommandAlias({ phrase, type, target }, aliases, editingId);
    if (!validation.alias) {
      setError(validation.error);
      return;
    }
    if (!editingId && aliases.length >= MAX_COMMAND_ALIASES) {
      setError(`You can save up to ${MAX_COMMAND_ALIASES} aliases.`);
      return;
    }

    const nextAliases = editingId
      ? aliases.map((alias) => alias.id === editingId ? { id: editingId, ...validation.alias } : alias)
      : [...aliases, { id: crypto.randomUUID(), ...validation.alias }];
    if (persist(nextAliases)) resetForm();
  };

  const editAlias = (alias) => {
    setPhrase(alias.phrase);
    setType(alias.type);
    setTarget(alias.target);
    setEditingId(alias.id);
    setError("");
  };

  const deleteAlias = (aliasId) => {
    persist(aliases.filter((alias) => alias.id !== aliasId));
    if (editingId === aliasId) resetForm();
  };

  const targets = type === "launch_app" ? ALLOWED_ALIAS_APPS : type === "open_folder" ? ALLOWED_ALIAS_FOLDERS : null;

  return (
    <section style={{ background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 14, color: "var(--land-ink)" }}>Personal command aliases</h3>
        <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--land-ink-3)" }}>
          Stored in this browser for this account. Aliases can only open supported apps, standard folders, or HTTP(S) websites.
        </p>
      </div>

      <form onSubmit={saveAlias} style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Phrase to recognize
          <input value={phrase} onChange={(event) => setPhrase(event.target.value)} maxLength={60} placeholder="my college portal" required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Opens
          <select value={type} onChange={(event) => {
            const nextType = event.target.value;
            setType(nextType);
            setTarget(nextType === "launch_app" ? ALLOWED_ALIAS_APPS[0] : nextType === "open_folder" ? ALLOWED_ALIAS_FOLDERS[0] : "");
          }}>
            <option value="launch_app">Supported application</option>
            <option value="open_folder">Standard folder</option>
            <option value="open_url">Website URL</option>
          </select>
        </label>
        {targets ? (
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Target
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              {targets.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        ) : (
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            HTTP(S) website
            <input type="url" value={target} onChange={(event) => setTarget(event.target.value)} maxLength={2048} placeholder="https://example.com" required />
          </label>
        )}
        {error && <p role="alert" style={{ margin: 0, color: "#b42318", fontSize: 12 }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {editingId && <button type="button" onClick={resetForm}>Cancel edit</button>}
          <button type="submit">{editingId ? "Save alias" : "Add alias"}</button>
        </div>
      </form>

      <div style={{ display: "grid", gap: 6 }}>
        {aliases.map((alias) => (
          <article key={alias.id} style={{ padding: 9, border: "1px solid var(--land-rule)", borderRadius: 7, fontSize: 12 }}>
            <strong>{alias.phrase}</strong>
            <div style={{ color: "var(--land-ink-3)", overflowWrap: "anywhere" }}>{alias.type === "open_url" ? alias.target : `${alias.type === "launch_app" ? "App" : "Folder"}: ${alias.target}`}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button type="button" onClick={() => editAlias(alias)}>Edit</button>
              <button type="button" onClick={() => deleteAlias(alias.id)}>Delete</button>
            </div>
          </article>
        ))}
        {!aliases.length && <p style={{ margin: 0, fontSize: 12, color: "var(--land-ink-3)" }}>No aliases saved yet.</p>}
      </div>
    </section>
  );
}
