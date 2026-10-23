import { useEffect, useState } from "react";
import apiClient from "../utils/api";

const roots = ["Desktop", "Documents", "Downloads"];

export default function FileOperationsPanel({ storageKey = "local" }) {
  const [root, setRoot] = useState("Downloads");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [operationType, setOperationType] = useState("create_folder");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState(null);
  const [readResult, setReadResult] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    let active = true;
    const sessionKey = `cheeni_file_operation_v1_${storageKey}`;
    const operationId = sessionStorage.getItem(sessionKey);
    if (operationId) {
      apiClient.get(`/api/agent/files/operations/${encodeURIComponent(operationId)}`)
        .then((response) => { if (active) setPreview(response.data.operation); })
        .catch(() => { if (active) sessionStorage.removeItem(sessionKey); });
    }
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (preview?.operation_id) {
      sessionStorage.setItem(`cheeni_file_operation_v1_${storageKey}`, preview.operation_id);
    }
  }, [preview, storageKey]);

  useEffect(() => {
    if (preview?.state !== "pending") return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [preview?.state]);

  const run = async (task) => {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(error.response?.data?.detail || error.response?.data?.message || "The local file agent is unavailable or rejected this request.");
    } finally {
      setBusy(false);
    }
  };

  const search = () => run(async () => {
    const response = await apiClient.post("/api/agent/files/search", { query, root });
    setMatches(response.data.matches || []);
    setReadResult("");
  });

  const readFile = (path) => run(async () => {
    const response = await apiClient.post("/api/agent/files/read", { path });
    setReadResult(response.data.content || "");
    setSource(path);
  });

  const createPreview = () => run(async () => {
    const request = operationType === "create_folder"
      ? { type: operationType, parent: destination, name }
      : operationType === "rename"
        ? { type: operationType, source, name }
        : { type: operationType, source, destination };
    const response = await apiClient.post("/api/agent/files/operations/preview", request);
    setPreview(response.data.preview);
  });

  const confirm = () => run(async () => {
    try {
      const response = await apiClient.post(`/api/agent/files/operations/${encodeURIComponent(preview.operation_id)}/confirm`, {});
      setPreview(response.data.operation);
      setMessage(response.data.operation.result?.message || (response.data.operation.result?.success ? "Operation completed." : "Operation did not complete."));
      setMatches([]);
    } catch (error) {
      const status = await apiClient.get(`/api/agent/files/operations/${encodeURIComponent(preview.operation_id)}`).catch(() => null);
      if (status?.data?.operation && status.data.operation.state !== "pending") {
        setPreview(status.data.operation);
        setMessage("The connection ended during execution. Check the recorded status before retrying.");
        return;
      }
      throw error;
    }
  });

  const cancel = () => run(async () => {
    const response = await apiClient.post(`/api/agent/files/operations/${encodeURIComponent(preview.operation_id)}/cancel`, {});
    setPreview(response.data.operation);
  });

  const prepareUndo = () => run(async () => {
    const response = await apiClient.post(`/api/agent/files/operations/${encodeURIComponent(preview.operation_id)}/undo`, {});
    setPreview(response.data.preview);
  });

  const refreshStatus = () => run(async () => {
    const response = await apiClient.get(`/api/agent/files/operations/${encodeURIComponent(preview.operation_id)}`);
    setPreview(response.data.operation);
  });

  const dismissStatus = () => {
    sessionStorage.removeItem(`cheeni_file_operation_v1_${storageKey}`);
    setPreview(null);
  };

  const isPending = preview?.state === "pending" && clock < preview.expires_at * 1000;
  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid var(--land-rule)", borderRadius: 7, background: "var(--land-bg)", color: "var(--land-ink)" };
  const buttonStyle = { padding: "8px 11px", border: "1px solid var(--land-rule)", borderRadius: 7, background: "var(--land-bg)", color: "var(--land-ink)", cursor: "pointer" };

  return (
    <section style={{ display: "grid", gap: 12, padding: 16, border: "1px solid var(--land-rule)", borderRadius: 10, background: "var(--land-bg-2)", color: "var(--land-ink)" }}>
      <div>
        <strong>Safe File Operations</strong>
        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--land-ink-2)" }}>Limited to Desktop, Documents, and Downloads. Every change needs a fresh preview and your confirmation. Deletion is disabled.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 0.4fr) 1fr auto", gap: 8 }}>
        <select value={root} onChange={(event) => setRoot(event.target.value)} style={inputStyle} aria-label="Search folder">
          {roots.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Search by file or folder name" style={inputStyle} />
        <button type="button" style={buttonStyle} disabled={busy || !query.trim()} onClick={search}>Search</button>
      </div>

      {matches.length > 0 && <div style={{ display: "grid", gap: 5, maxHeight: 150, overflow: "auto" }}>
        {matches.map((match) => <div key={match.path} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", fontSize: 11, padding: "5px 7px", background: "var(--land-bg)", borderRadius: 5 }}>
          <span><code style={{ overflowWrap: "anywhere" }}>{match.path}</code> <small>({match.kind})</small></span>
          <span style={{ display: "flex", gap: 5, flexShrink: 0 }}>
            {match.kind === "file" && <><button type="button" style={buttonStyle} disabled={busy} onClick={() => readFile(match.path)}>Read</button>
            <button type="button" style={buttonStyle} onClick={() => setSource(match.path)}>Use as source</button></>}
            {match.kind === "folder" && <button type="button" style={buttonStyle} onClick={() => setDestination(match.path)}>Use as destination</button>}
          </span>
        </div>)}
      </div>}

      {readResult && <pre style={{ maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 10, background: "var(--land-bg)", borderRadius: 6, fontSize: 11 }}>{readResult}</pre>}

      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Operation
          <select value={operationType} onChange={(event) => { setOperationType(event.target.value); setPreview(null); }} style={{ ...inputStyle, marginTop: 4 }}>
            <option value="create_folder">Create folder</option>
            <option value="rename">Rename file</option>
            <option value="move">Move file</option>
            <option value="copy">Copy / back up one file</option>
          </select>
        </label>
        {operationType !== "create_folder" && <label style={{ fontSize: 12 }}>Exact source file path
          <input value={source} onChange={(event) => setSource(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder="Choose a search result or enter a full path" />
        </label>}
        {operationType === "create_folder" && <label style={{ fontSize: 12 }}>Existing parent folder path
          <input value={destination} onChange={(event) => setDestination(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder="For example, your approved Downloads folder" />
        </label>}
        {operationType === "rename" || operationType === "create_folder" ? <label style={{ fontSize: 12 }}>New name
          <input value={name} onChange={(event) => setName(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} maxLength={255} />
        </label> : <label style={{ fontSize: 12 }}>Existing destination folder path
          <input value={destination} onChange={(event) => setDestination(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder="Must be an existing approved folder" />
        </label>}
        <button type="button" style={buttonStyle} disabled={busy || isPending || preview?.state === "executing"} onClick={createPreview}>Preview exact operation</button>
      </div>

      {preview && <div style={{ display: "grid", gap: 7, padding: 11, border: "1px solid var(--land-accent)", borderRadius: 8, fontSize: 12 }}>
        <strong>Review before confirming</strong>
        <div>Action: {preview.type.replaceAll("_", " ")}</div>
        {preview.source && <div>Source: <code style={{ overflowWrap: "anywhere" }}>{preview.source}</code></div>}
        {preview.parent && <div>Parent: <code style={{ overflowWrap: "anywhere" }}>{preview.parent}</code></div>}
        <div>Destination: <code style={{ overflowWrap: "anywhere" }}>{preview.destination}</code></div>
        <div>Items: {preview.item_count}; estimated bytes: {preview.estimated_bytes}{preview.available_bytes != null ? `; currently free at destination: ${preview.available_bytes}` : ""}; collisions: {preview.collision_policy}</div>
        <div>Preview status: {preview.state}{preview.state === "pending" ? ` · expires ${new Date(preview.expires_at * 1000).toLocaleTimeString()}` : ""}</div>
        {preview.result && <div>Result: {preview.result.success ? "completed" : preview.result.message || "failed"}</div>}
        {preview.state === "executing" && <button type="button" style={buttonStyle} disabled={busy} onClick={refreshStatus}>Refresh operation status</button>}
        {preview.undo_available && preview.state === "completed" && <button type="button" style={buttonStyle} disabled={busy} onClick={prepareUndo}>Preview safe undo</button>}
        {preview.state !== "pending" && preview.state !== "executing" && <button type="button" style={buttonStyle} onClick={dismissStatus}>Dismiss status</button>}
        {isPending && <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ ...buttonStyle, borderColor: "#f59e0b" }} disabled={busy} onClick={cancel}>Cancel preview</button>
          <button type="button" style={{ ...buttonStyle, background: "var(--land-accent)", color: "white" }} disabled={busy} onClick={confirm}>Confirm this exact change</button>
        </div>}
      </div>}
      {message && <div role="status" style={{ fontSize: 12, color: "var(--land-ink-2)" }}>{message}</div>}
    </section>
  );
}
