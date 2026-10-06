import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/*
 * Plugin / Skill Manager (#25)
 * Architecture-worthy extensibility layer.
 * Users can add Skills via a simple JSON config.
 * Each skill defines: name, description, trigger keywords, endpoint or prompt template.
 *
 * Default built-in skills ship with Cheeni.
 * Custom skills persist to localStorage.
 *
 * Props:
 *   isOpen        – controls visibility
 *   onClose       – close handler
 *   onSkillInvoke – (prompt: string) => void — fires a prompt into the agent pipeline
 */

// -- Built-in default skills ---------------------------------------------------

const DEFAULT_SKILLS = [
  {
    id: "skill_weather",
    name: "Weather",
    description: "Get current weather or forecast for any city.",
    icon: "???",
    category: "Utilities",
    enabled: true,
    triggers: ["weather", "forecast", "temperature", "rain", "sunny"],
    promptTemplate: "What is the current weather in {city}? Give a quick 2-sentence summary.",
    isBuiltIn: true,
    version: "1.0",
  },
  {
    id: "skill_stocks",
    name: "Stock Price",
    description: "Check real-time stock prices and market summaries.",
    icon: "??",
    category: "Finance",
    enabled: true,
    triggers: ["stock", "share price", "market cap", "nasdaq", "nse", "bse"],
    promptTemplate: "What is the current stock price of {ticker}? Summarize recent performance.",
    isBuiltIn: true,
    version: "1.0",
  },
  {
    id: "skill_translate",
    name: "Translator",
    description: "Translate text between any two languages instantly.",
    icon: "??",
    category: "Language",
    enabled: true,
    triggers: ["translate", "in hindi", "in french", "in spanish", "in german", "in japanese"],
    promptTemplate: "Translate the following to {language}: {text}",
    isBuiltIn: true,
    version: "1.0",
  },
  {
    id: "skill_interview",
    name: "Mock Interviewer",
    description: "Get AI-driven mock interview questions with feedback.",
    icon: "??",
    category: "Career",
    enabled: true,
    triggers: ["mock interview", "interview question", "behavioural", "technical round"],
    promptTemplate: "Act as a senior software engineer conducting a technical interview. Start with a {topic} question and then evaluate my answer.",
    isBuiltIn: true,
    version: "1.0",
  },
  {
    id: "skill_summarize",
    name: "Summarizer",
    description: "Summarize any article, document, or long text in bullet points.",
    icon: "??",
    category: "Productivity",
    enabled: true,
    triggers: ["summarize", "summary", "tl;dr", "brief me", "bullet points"],
    promptTemplate: "Please summarize the following in 5 concise bullet points:\n\n{text}",
    isBuiltIn: true,
    version: "1.0",
  },
  {
    id: "skill_code_review",
    name: "Code Reviewer",
    description: "Get instant code review, bug fixes, and optimization tips.",
    icon: "??",
    category: "Development",
    enabled: true,
    triggers: ["review my code", "check this code", "find bugs", "optimize", "code review"],
    promptTemplate: "Review the following code and identify: 1) Bugs 2) Performance issues 3) Best practice violations:\n\n{code}",
    isBuiltIn: true,
    version: "1.0",
  },
];

const STORE_KEY = "cheeni_plugins_v1";

function loadCustomSkills() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveCustomSkills(skills) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(skills));
  } catch { /* non-critical */ }
}

const EMPTY_SKILL_FORM = {
  name: "", description: "", icon: "?", category: "Custom",
  triggers: "", promptTemplate: "", version: "1.0",
};

// -- SVG Icons -----------------------------------------------------------------

const IcoX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcoPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IcoPlay = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IcoTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IcoToggle = ({ on }) => on ? (
  <svg width="32" height="18" viewBox="0 0 32 18" fill="none">
    <rect width="32" height="18" rx="9" fill="var(--land-accent)"/>
    <circle cx="23" cy="9" r="7" fill="white"/>
  </svg>
) : (
  <svg width="32" height="18" viewBox="0 0 32 18" fill="none">
    <rect width="32" height="18" rx="9" fill="var(--land-rule)"/>
    <circle cx="9" cy="9" r="7" fill="white"/>
  </svg>
);

// -- Skill Card ----------------------------------------------------------------

function SkillCard({ skill, onToggle, onDelete, onInvoke }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      style={{
        background: "var(--land-bg-2)", border: "1px solid var(--land-rule)",
        borderRadius: 12, padding: "14px 16px", cursor: "pointer",
        opacity: skill.enabled ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{skill.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <div>
              <span style={{ fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: 600, color: "var(--land-ink)" }}>{skill.name}</span>
              <span style={{ fontFamily: "var(--land-sans)", fontSize: 10, color: "var(--land-ink-3)", marginLeft: 8, background: "var(--land-bg)", border: "1px solid var(--land-rule)", borderRadius: 10, padding: "2px 7px" }}>{skill.category}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button onClick={() => onInvoke(skill)} title="Invoke this skill" style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--land-accent-light)", border: "1px solid var(--land-accent)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--land-accent)", fontSize: 11, fontWeight: 600 }}>
                <IcoPlay /> Use
              </button>
              <button onClick={(e) => { e.stopPropagation(); onToggle(skill.id); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }} title={skill.enabled ? "Disable skill" : "Enable skill"}>
                <IcoToggle on={skill.enabled} />
              </button>
              {!skill.isBuiltIn && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(skill.id); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#C0392B", display: "flex", padding: 2 }} title="Delete skill">
                  <IcoTrash />
                </button>
              )}
            </div>
          </div>
          <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: "4px 0 0", lineHeight: 1.5 }}>{skill.description}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {(skill.triggers || []).slice(0, 4).map((t) => (
              <span key={t} style={{ fontFamily: "var(--land-sans)", fontSize: 10, color: "var(--land-ink-3)", background: "var(--land-bg)", border: "1px solid var(--land-rule)", borderRadius: 10, padding: "2px 7px" }}>"{t}"</span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// -- Add Skill Form ------------------------------------------------------------

function AddSkillForm({ onAdd, onCancel }) {
  const [form, setForm] = useState(EMPTY_SKILL_FORM);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.promptTemplate.trim()) errs.promptTemplate = "Prompt template is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onAdd({
      id: `skill_custom_${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim() || "Custom skill",
      icon: form.icon || "?",
      category: form.category || "Custom",
      enabled: true,
      triggers: form.triggers.split(",").map((t) => t.trim()).filter(Boolean),
      promptTemplate: form.promptTemplate.trim(),
      isBuiltIn: false,
      version: form.version || "1.0",
    });
  };

  const field = (label, key, placeholder, multiline = false) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontFamily: "var(--land-sans)", fontSize: 12, fontWeight: 500, color: "var(--land-ink-2)" }}>{label}</label>
      {multiline ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
          placeholder={placeholder}
          rows={3}
          style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink)", background: "var(--land-bg-2)", border: `1px solid ${errors[key] ? "#C0392B" : "var(--land-rule)"}`, borderRadius: 8, padding: "8px 10px", resize: "vertical", outline: "none" }}
        />
      ) : (
        <input
          value={form[key]}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
          placeholder={placeholder}
          style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink)", background: "var(--land-bg-2)", border: `1px solid ${errors[key] ? "#C0392B" : "var(--land-rule)"}`, borderRadius: 8, padding: "8px 10px", outline: "none" }}
        />
      )}
      {errors[key] && <span style={{ fontSize: 11, color: "#C0392B" }}>{errors[key]}</span>}
    </div>
  );

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--land-bg-2)", border: "1px solid var(--land-accent)", borderRadius: 12, padding: "18px" }}
    >
      <h3 style={{ fontFamily: "var(--land-sans)", fontSize: 14, fontWeight: 700, color: "var(--land-ink)", margin: 0 }}>Add Custom Skill</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
        {field("Skill Name *", "name", "e.g. Dictionary Lookup")}
        {field("Icon", "icon", "??")}
      </div>
      {field("Description", "description", "What does this skill do?")}
      {field("Category", "category", "e.g. Utilities, Finance, Coding...")}
      {field("Trigger Keywords (comma-separated)", "triggers", "e.g. define, meaning of, synonym")}
      {field("Prompt Template *", "promptTemplate", "Use {variable} placeholders, e.g. Define the word {word}.", true)}
      <p style={{ fontFamily: "var(--land-sans)", fontSize: 11, color: "var(--land-ink-3)", margin: 0 }}>
        Tip: Use <code style={{ background: "var(--land-bg)", padding: "0 4px", borderRadius: 3 }}>{"{text}"}</code> or <code style={{ background: "var(--land-bg)", padding: "0 4px", borderRadius: 3 }}>{"{word}"}</code> as placeholders — Cheeni will fill them in.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ fontFamily: "var(--land-sans)", fontSize: 13, background: "transparent", border: "1px solid var(--land-rule)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "var(--land-ink-2)" }}>Cancel</button>
        <button type="submit" style={{ fontFamily: "var(--land-sans)", fontSize: 13, background: "var(--land-accent)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: 600 }}>Add Skill</button>
      </div>
    </motion.form>
  );
}

// -- Invoke Skill Dialog -------------------------------------------------------

function InvokeDialog({ skill, onClose, onInvoke }) {
  const [vars, setVars] = useState({});
  const placeholders = (skill?.promptTemplate || "").match(/\{(\w+)\}/g)?.map((p) => p.slice(1, -1)) || [];
  const uniquePlaceholders = [...new Set(placeholders)];

  const buildPrompt = () => {
    let p = skill.promptTemplate;
    for (const [k, v] of Object.entries(vars)) {
      p = p.replaceAll(`{${k}}`, v);
    }
    return p;
  };

  const handleRun = () => {
    onInvoke(buildPrompt());
    onClose();
  };

  return (
    <AnimatePresence>
      {skill && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.4)" }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 401, width: "min(440px, 94vw)", background: "var(--land-bg)", border: "1px solid var(--land-rule)", borderRadius: 16, padding: "24px", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>{skill.icon}</span>
              <div>
                <h3 style={{ fontFamily: "var(--land-sans)", fontSize: 16, fontWeight: 700, color: "var(--land-ink)", margin: 0 }}>{skill.name}</h3>
                <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: 0 }}>{skill.description}</p>
              </div>
            </div>
            {uniquePlaceholders.length === 0 ? (
              <p style={{ fontFamily: "var(--land-sans)", fontSize: 13, color: "var(--land-ink-2)", margin: "0 0 16px" }}>
                Prompt: <em style={{ color: "var(--land-ink-3)" }}>{skill.promptTemplate}</em>
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {uniquePlaceholders.map((ph) => (
                  <div key={ph} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontFamily: "var(--land-sans)", fontSize: 12, fontWeight: 500, color: "var(--land-ink-2)", textTransform: "capitalize" }}>{ph}</label>
                    <input
                      placeholder={`Enter ${ph}…`}
                      value={vars[ph] || ""}
                      onChange={(e) => setVars((p) => ({ ...p, [ph]: e.target.value }))}
                      style={{ fontFamily: "var(--land-sans)", fontSize: 13, color: "var(--land-ink)", background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 8, padding: "8px 12px", outline: "none" }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ fontFamily: "var(--land-sans)", fontSize: 13, background: "transparent", border: "1px solid var(--land-rule)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "var(--land-ink-2)" }}>Cancel</button>
              <button onClick={handleRun} style={{ fontFamily: "var(--land-sans)", fontSize: 13, background: "var(--land-accent)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: 600 }}>
                Ask Cheeni
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// -- Main Component -------------------------------------------------------------

const CATEGORIES = ["All", "Utilities", "Finance", "Language", "Career", "Productivity", "Development", "Custom"];

export function PluginManager({ isOpen, onClose, onSkillInvoke }) {
  const [customSkills, setCustomSkills]     = useState(() => loadCustomSkills());
  const [builtInStates, setBuiltInStates]   = useState({});
  const [showAddForm, setShowAddForm]       = useState(false);
  const [activeCategory, setCategory]       = useState("All");
  const [invokingSkill, setInvokingSkill]   = useState(null);

  const allSkills = [
    ...DEFAULT_SKILLS.map((s) => ({ ...s, enabled: builtInStates[s.id] !== false })),
    ...customSkills,
  ];

  const filtered = activeCategory === "All" ? allSkills : allSkills.filter((s) => s.category === activeCategory);

  const toggleSkill = (id) => {
    const isBuiltIn = DEFAULT_SKILLS.some((s) => s.id === id);
    if (isBuiltIn) {
      setBuiltInStates((p) => ({ ...p, [id]: !(p[id] !== false) }));
    } else {
      setCustomSkills((prev) => {
        const updated = prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s);
        saveCustomSkills(updated);
        return updated;
      });
    }
  };

  const deleteSkill = (id) => {
    if (!window.confirm("Delete this skill?")) return;
    setCustomSkills((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveCustomSkills(updated);
      return updated;
    });
  };

  const addSkill = (skill) => {
    setCustomSkills((prev) => {
      const updated = [...prev, skill];
      saveCustomSkills(updated);
      return updated;
    });
    setShowAddForm(false);
  };

  const handleInvokeSkill = (skill) => {
    const placeholders = (skill.promptTemplate || "").match(/\{(\w+)\}/g);
    if (!placeholders) {
      onSkillInvoke?.(skill.promptTemplate);
      onClose();
    } else {
      setInvokingSkill(skill);
    }
  };

  const presentCategories = CATEGORIES.filter((c) => c === "All" || allSkills.some((s) => s.category === c));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "min(720px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--land-bg)", border: "1px solid var(--land-rule)", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.35)" }}
            role="dialog" aria-modal="true" aria-label="Plugin and Skill Manager"
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid var(--land-rule)", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontFamily: "var(--land-serif)", fontSize: 22, fontWeight: 700, color: "var(--land-ink)", margin: 0 }}>Skills & Plugins</h2>
                <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: "4px 0 0" }}>{allSkills.filter((s) => s.enabled).length} active · {allSkills.length} total</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowAddForm((p) => !p)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--land-sans)", fontSize: 12, fontWeight: 600, background: "var(--land-accent)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "white" }}
                >
                  <IcoPlus /> Add Skill
                </button>
                <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--land-rule)", background: "transparent", color: "var(--land-ink-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Close">
                  <IcoX />
                </button>
              </div>
            </div>

            {/* Category filter */}
            <div style={{ display: "flex", gap: 6, padding: "12px 24px", overflowX: "auto", flexShrink: 0, borderBottom: "1px solid var(--land-rule)" }}>
              {presentCategories.map((c) => (
                <button key={c} onClick={() => setCategory(c)} style={{ fontFamily: "var(--land-sans)", fontSize: 12, fontWeight: activeCategory === c ? 600 : 400, background: activeCategory === c ? "var(--land-accent)" : "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 20, padding: "5px 14px", cursor: "pointer", color: activeCategory === c ? "white" : "var(--land-ink-2)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence>
                {showAddForm && (
                  <motion.div key="add-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <AddSkillForm onAdd={addSkill} onCancel={() => setShowAddForm(false)} />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {filtered.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onToggle={toggleSkill}
                    onDelete={deleteSkill}
                    onInvoke={handleInvokeSkill}
                  />
                ))}
              </AnimatePresence>

              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--land-ink-3)", fontFamily: "var(--land-sans)", fontSize: 14 }}>
                  <p style={{ margin: 0 }}>No skills in this category.</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12 }}>Click "Add Skill" to create your first custom skill!</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Invoke dialog */}
      <InvokeDialog skill={invokingSkill} onClose={() => setInvokingSkill(null)} onInvoke={(prompt) => { onSkillInvoke?.(prompt); onClose(); }} />
    </AnimatePresence>
  );
}

export default PluginManager;
