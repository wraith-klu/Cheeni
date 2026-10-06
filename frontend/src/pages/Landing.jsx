import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { UserDataContext } from "../context/userDataContext";
import { useTheme } from "../context/ThemeContext";
import avatar1 from "../assets/image1.jpg";
import avatar2 from "../assets/image2.jpg";
import avatar3 from "../assets/image6.jpg";

/* ─── SVG icons — no external icon library ───────────────────────────── */
const IcoSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const IcoMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const IcoDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v13M5 14l7 7 7-7"/><path d="M3 21h18"/>
  </svg>
);
const IcoWindows = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.949"/>
  </svg>
);
const IcoPlay = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IcoStop = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
  </svg>
);
const IcoRefresh = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IcoVol = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
);
const IcoMonitor = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
);
const IcoFolder = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/>
  </svg>
);
const IcoGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IcoShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IcoGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);

const CAPS = [
  { Ico: IcoVol,     label: "Voice and persona",       desc: "Speak to Cheeni and she speaks back. Set her name, voice pitch, speech speed, and pick one of 15 avatar styles from the onboarding screen." },
  { Ico: IcoMonitor, label: "System control",           desc: "Set volume, lock the screen, put the machine to sleep, restart, or shut down from a single voice command." },
  { Ico: IcoGrid,    label: "Window management",        desc: "Snap windows left or right, minimize all to show the desktop, maximize, or switch virtual desktops." },
  { Ico: IcoFolder,  label: "Filesystem search",        desc: "Search your user directory by filename or extension, read text and code files, and create or rename folders." },
  { Ico: IcoGlobe,   label: "Web and news",             desc: "Pull live answers from the web, get today's headlines, and scrape article summaries into the conversation." },
  { Ico: IcoShield,  label: "Safe execution",           desc: "Shutdown, restart, and file deletion commands require your explicit confirmation before Cheeni carries them out." },
];

/* ─── Style constants ─────────────────────────────────────────────────── */
const S = {
  page:    { background: "var(--land-bg)", color: "var(--land-ink)", fontFamily: "var(--land-sans)", minHeight: "100vh", overflowX: "hidden" },
  serif:   { fontFamily: "var(--land-serif)" },
  rule:    { border: "none", borderTop: "1px solid var(--land-rule)", margin: 0 },
  wrap:    { maxWidth: 1120, margin: "0 auto", padding: "0 24px" },
  label:   { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--land-accent)", display: "block", marginBottom: 18 },
  h1:      { fontFamily: "var(--land-serif)", fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.03em", color: "var(--land-ink)", margin: "0 0 28px", fontSize: "clamp(44px, 6.5vw, 76px)" },
  h2:      { fontFamily: "var(--land-serif)", fontWeight: 400, lineHeight: 1.12, letterSpacing: "-0.025em", color: "var(--land-ink)", margin: "0 0 52px", fontSize: "clamp(30px, 4vw, 50px)" },
  body:    { fontSize: 16, lineHeight: 1.65, color: "var(--land-ink-2)" },
  small:   { fontSize: 13, lineHeight: 1.6, color: "var(--land-ink-3)" },
};
const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "12px 22px", borderRadius: 7, border: "none",
  background: "var(--land-accent)", color: "#fff",
  fontFamily: "var(--land-sans)", fontSize: 14, fontWeight: 600,
  cursor: "pointer", textDecoration: "none", lineHeight: 1,
};
const btnOutline = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "11px 20px", borderRadius: 7,
  background: "transparent", color: "var(--land-ink-2)",
  border: "1px solid var(--land-rule)",
  fontFamily: "var(--land-sans)", fontSize: 14, fontWeight: 500,
  cursor: "pointer", textDecoration: "none", lineHeight: 1,
};
const btnGhost = {
  display: "inline-flex", alignItems: "center",
  padding: "11px 16px", borderRadius: 7,
  background: "transparent", color: "var(--land-ink-2)",
  border: "1px solid transparent",
  fontFamily: "var(--land-sans)", fontSize: 14, fontWeight: 500,
  cursor: "pointer", textDecoration: "none", lineHeight: 1,
};
const navA  = { fontSize: 14, fontWeight: 500, color: "var(--land-ink-2)", textDecoration: "none", fontFamily: "var(--land-sans)" };
const footA = { fontSize: 13, color: "var(--land-ink-3)", textDecoration: "none", fontFamily: "var(--land-sans)" };

/* ─── Component ───────────────────────────────────────────────────────── */
function Landing() {
  const { userData, serverURL } = useContext(UserDataContext);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [agentOk,       setAgentOk]       = useState(false);
  const [agentChecking, setAgentChecking] = useState(true);
  const [dlDone,        setDlDone]        = useState(false);
  const [speaking,      setSpeaking]      = useState(false);

  const checkAgent = async () => {
    setAgentChecking(true);
    try {
      const r = await axios.get(`${serverURL}/api/agent/ping`, { timeout: 3500 });
      setAgentOk(!!r.data?.connected);
    } catch { setAgentOk(false); }
    finally  { setAgentChecking(false); }
  };

  useEffect(() => {
    checkAgent();
    const id = setInterval(checkAgent, 15000);
    return () => clearInterval(id);
  }, []);

  const download = (type = "zip") => {
    const url  = type === "zip" ? "/downloads/Cheeni-Desktop-Agent-Setup.zip" : "/downloads/install_autostart.bat";
    const name = type === "zip" ? "Cheeni-Desktop-Agent-Setup.zip" : "install_autostart.bat";
    const a = Object.assign(document.createElement("a"), { href: url });
    a.setAttribute("download", name);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setDlDone(true);
    setTimeout(() => setDlDone(false), 6000);
  };

  const hearVoice = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    const u = new SpeechSynthesisUtterance(
      "Hello! I am Cheeni, your personal desktop assistant. I start automatically every time you open your laptop and I am ready to help."
    );
    const vs   = window.speechSynthesis.getVoices();
    const pick = vs.find(v => v.name.includes("Zira") || v.name.includes("Jenny") || v.name.includes("Aria") || (v.name.includes("Female") && v.lang.startsWith("en")))
              || vs.find(v => v.lang.startsWith("en"));
    if (pick) u.voice = pick;
    u.pitch = 1.1; u.rate = 1.0;
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  return (
    <div style={S.page}>
      {/* skip link */}
      <a href="#main" className="sr-only focus:not-sr-only" style={{ position:"absolute", top:8, left:8, padding:"8px 16px", background:"var(--land-accent)", color:"#fff", borderRadius:6, fontFamily:"var(--land-sans)", fontSize:13, zIndex:999 }}>
        Skip to content
      </a>

      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <header style={{ position:"sticky", top:0, zIndex:50, background:"var(--land-bg)", borderBottom:"1px solid var(--land-rule)" }}>
        <div style={{ ...S.wrap, height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <Link to="/" style={{ textDecoration:"none" }}>
            <span style={{ ...S.serif, fontSize:21, fontWeight:400, color:"var(--land-ink)", letterSpacing:"-0.02em" }}>Cheeni</span>
          </Link>

          <nav aria-label="Primary" style={{ display:"flex", alignItems:"center", gap:28 }}>
            <a href="#how-it-works" style={navA}>How it works</a>
            <a href="#capabilities"  style={navA}>Capabilities</a>
            <a href="#download"      style={navA}>Download</a>
          </nav>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Sun / Moon Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              aria-label="Toggle theme"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid var(--land-rule)",
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "var(--land-bg-2)",
                color: isDark ? "#fbbf24" : "var(--land-ink)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {isDark ? <IcoSun /> : <IcoMoon />}
            </button>

            <button
              onClick={checkAgent}
              title="Click to recheck agent status"
              style={{ ...btnGhost, fontSize:12, padding:"6px 10px", border:"1px solid var(--land-rule)", gap:6, color: agentOk ? "#2A7A3B" : "var(--land-ink-3)" }}
            >
              <span style={{ width:6, height:6, borderRadius:"50%", background: agentOk ? "#2A7A3B" : "#bbb", display:"inline-block", flexShrink:0 }} />
              {agentChecking ? "Checking…" : agentOk ? "Agent running" : "Agent offline"}
              <IcoRefresh />
            </button>

            {userData
              ? <button onClick={() => navigate("/app")} style={btnPrimary} id="nav-dashboard">Open dashboard</button>
              : <>
                  <Link to="/signin" style={btnGhost} id="nav-signin">Sign in</Link>
                  <Link to="/signup" style={btnPrimary} id="nav-signup">Get started</Link>
                </>
            }
          </div>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <main id="main">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section style={{ ...S.wrap, padding:"88px 24px 80px" }}>
          <div style={{ maxWidth:640 }}>
            <span style={S.label}>Autonomous desktop agent for Windows</span>

            <h1 style={S.h1}>
              Your assistant starts<br />before you do.
            </h1>

            <p style={{ ...S.body, maxWidth:520, marginBottom:44 }}>
              Cheeni runs silently the moment you open your laptop. It listens for your voice, controls your system, searches the web, and reads your files without you opening a single app.
            </p>

            <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:18 }}>
              <button onClick={() => download("zip")} style={btnPrimary} id="hero-download">
                <IcoWindows />
                Download for Windows
                <IcoDownload />
              </button>
              {userData
                ? <button onClick={() => navigate("/app")} style={btnOutline} id="hero-open">Open dashboard</button>
                : <Link to="/signup" style={btnOutline} id="hero-signup">Create account</Link>
              }
            </div>

            {dlDone && <p role="status" style={{ fontSize:13, color:"#2A7A3B", marginBottom:8 }}>Download started. Check your downloads folder.</p>}

            <p style={{ ...S.small, marginTop:12 }}>Windows 10 and 11 &nbsp;·&nbsp; Python 3.10+ required &nbsp;·&nbsp; No cloud subscription</p>
          </div>

          {/* Product illustration */}
          <div style={{ marginTop:64, display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>
            {/* Mock chat window */}
            <div style={{ background:"var(--land-bg-2)", border:"1px solid var(--land-rule)", borderRadius:14, overflow:"hidden", flexGrow:1, minWidth:280, maxWidth:500 }}>
              <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--land-rule)", display:"flex", alignItems:"center", gap:7 }}>
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#E47466", display:"inline-block" }} />
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#D4A445", display:"inline-block" }} />
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#5BAD72", display:"inline-block" }} />
                <span style={{ marginLeft:6, fontSize:11, color:"var(--land-ink-3)", fontFamily:"var(--land-sans)" }}>Cheeni — Agent Dashboard</span>
              </div>
              <div style={{ padding:"20px 18px 24px", display:"flex", flexDirection:"column", gap:12 }}>
                <Bubble avatar={avatar1} text="Good morning. Battery is at 86%. Want me to read today's tech headlines?" left />
                <Bubble text="Yes, and snap this window to the right." />
                <Bubble avatar={avatar1} text="Snapping window now. Here are your top 3 headlines for today…" left />
              </div>
            </div>

            {/* Avatar panel */}
            <div style={{ display:"flex", flexDirection:"column", gap:12, minWidth:160 }}>
              <span style={{ ...S.small, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Choose her look</span>
              {[avatar1, avatar2, avatar3].map((src, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <img src={src} alt={`Avatar ${i+1}`}
                    style={{ width:48, height:48, borderRadius:10, objectFit:"cover",
                      border: i===0 ? "2px solid var(--land-accent)" : "2px solid var(--land-rule)" }} />
                  {i===0 && <span style={{ fontSize:11, fontWeight:600, color:"var(--land-accent)" }}>Active</span>}
                </div>
              ))}
              <button
                onClick={hearVoice}
                disabled={speaking}
                style={{ ...btnOutline, fontSize:13, padding:"8px 13px", marginTop:4 }}
                id="hero-voice"
                aria-label="Hear Cheeni's voice"
              >
                {speaking ? <IcoStop /> : <IcoPlay />}
                {speaking ? "Speaking…" : "Hear her voice"}
              </button>
            </div>
          </div>
        </section>

        <hr style={S.rule} />

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section id="how-it-works" style={{ ...S.wrap, padding:"88px 24px" }}>
          <span style={S.label}>Zero-effort startup</span>
          <h2 style={{ ...S.h2, maxWidth:480 }}>Three steps from download to always-on.</h2>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", borderTop:"1px solid var(--land-rule)" }}>
            {[
              {
                n:"01", title:"Download the bundle",
                body:"Get the ZIP. It contains the startup installer, launcher scripts, and the auto-start configuration for Windows.",
                cta: <button onClick={() => download("zip")} style={{ ...btnPrimary, fontSize:13, padding:"9px 16px" }} id="step1-dl"><IcoDownload /> Download .ZIP</button>,
              },
              {
                n:"02", title:"Run the installer once",
                body:"Double-click install_autostart.bat. It registers a silent Windows Startup shortcut. No administrator account needed.",
                cta: <button onClick={() => download("bat")} style={{ ...btnOutline, fontSize:13, padding:"8px 15px" }} id="step2-bat"><IcoWindows /> .bat only</button>,
              },
              {
                n:"03", title:"Open your laptop",
                body:"That is it. The agent, backend, and dashboard launch in the background on every Windows login from this point forward.",
                cta: <span style={{ fontSize:13, color:"#2A7A3B", fontWeight:500 }}>Runs automatically</span>,
              },
            ].map(s => (
              <div key={s.n} style={{ padding:"40px 32px", borderLeft:"1px solid var(--land-rule)" }}>
                <p style={{ fontSize:34, fontWeight:300, color:"var(--land-ink-3)", lineHeight:1, marginBottom:22, fontFamily:"var(--land-sans)" }}>{s.n}</p>
                <h3 style={{ fontSize:17, fontWeight:600, color:"var(--land-ink)", marginBottom:10 }}>{s.title}</h3>
                <p style={{ fontSize:14, lineHeight:1.7, color:"var(--land-ink-2)", marginBottom:24 }}>{s.body}</p>
                {s.cta}
              </div>
            ))}
          </div>
        </section>

        <hr style={S.rule} />

        {/* ── CAPABILITIES ─────────────────────────────────────────────── */}
        <section id="capabilities" style={{ ...S.wrap, padding:"88px 24px" }}>
          <span style={S.label}>Capabilities</span>
          <h2 style={{ ...S.h2, maxWidth:440 }}>What Cheeni can do on your machine.</h2>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(270px, 1fr))" }}>
            {CAPS.map(({ Ico, label, desc }, i) => (
              <div key={i} style={{ padding:"32px 28px", borderTop:"1px solid var(--land-rule)", borderRight: (i%2===0) ? "1px solid var(--land-rule)" : "none" }}>
                <div style={{ color:"var(--land-accent)", marginBottom:14 }}><Ico /></div>
                <h3 style={{ fontSize:15, fontWeight:600, color:"var(--land-ink)", marginBottom:8, textTransform:"capitalize" }}>{label}</h3>
                <p style={{ fontSize:13.5, lineHeight:1.7, color:"var(--land-ink-2)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <hr style={S.rule} />

        {/* ── DOWNLOAD ─────────────────────────────────────────────────── */}
        <section id="download" style={{ ...S.wrap, padding:"88px 24px" }}>
          <div style={{ maxWidth:600 }}>
            <span style={S.label}>Download</span>
            <h2 style={S.h2}>Ready when you are.</h2>
            <p style={{ ...S.body, marginBottom:40 }}>
              Download the setup bundle, run the installer, and create a free account to configure your assistant's name, voice, and persona. The agent starts automatically from that point on.
            </p>

            <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:28 }}>
              <button onClick={() => download("zip")} style={{ ...btnPrimary, fontSize:15, padding:"13px 24px" }} id="dl-main">
                <IcoWindows /> Download for Windows <IcoDownload />
              </button>
              <button onClick={() => download("bat")} style={{ ...btnOutline, fontSize:14, padding:"12px 18px" }} id="dl-bat">
                install_autostart.bat only
              </button>
            </div>

            {dlDone && <p role="status" style={{ fontSize:13, color:"#2A7A3B", marginBottom:20 }}>Download started. Check your downloads folder.</p>}

            <div style={{ display:"flex", flexWrap:"wrap", gap:32, paddingTop:24, borderTop:"1px solid var(--land-rule)" }}>
              {[["Platform","Windows 10 / 11 (64-bit)"],["Bundle","3.5 KB ZIP"],["Requires","Python 3.10+, Node 18+"],["Cost","Free to use"]].map(([k,v]) => (
                <div key={k}>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--land-ink-3)", marginBottom:4 }}>{k}</p>
                  <p style={{ fontSize:14, fontWeight:600, color:"var(--land-ink)" }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr style={S.rule} />

        {/* ── ACCOUNT CTA ──────────────────────────────────────────────── */}
        {!userData && (
          <section style={{ ...S.wrap, padding:"72px 24px 88px" }}>
            <div style={{ background:"var(--land-accent-light)", borderRadius:14, padding:"56px 48px", display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:32 }}>
              <div style={{ maxWidth:460 }}>
                <h2 style={{ fontFamily:"var(--land-serif)", fontSize:"clamp(24px, 3.5vw, 38px)", fontWeight:400, lineHeight:1.2, letterSpacing:"-0.025em", color:"var(--land-ink)", marginBottom:12 }}>
                  Set up your assistant's voice and persona.
                </h2>
                <p style={{ fontSize:15, lineHeight:1.65, color:"var(--land-ink-2)" }}>
                  Create a free account to give Cheeni a name, choose her voice settings, and pick an avatar. Your preferences sync across devices.
                </p>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <Link to="/signup" style={{ ...btnPrimary, fontSize:15, padding:"13px 22px" }} id="cta-signup">Create account</Link>
                <Link to="/signin" style={{ ...btnGhost,   fontSize:15, padding:"13px 18px", border:"1px solid var(--land-rule)" }} id="cta-signin">Sign in</Link>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:"1px solid var(--land-rule)", padding:"44px 24px" }}>
        <div style={{ maxWidth:1120, margin:"0 auto" }}>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:20, marginBottom:20 }}>
            <span style={{ fontFamily:"var(--land-serif)", fontSize:18, color:"var(--land-ink)", fontWeight:400 }}>Cheeni</span>
            <div style={{ display:"flex", flexWrap:"wrap", gap:24 }}>
              <a href="#how-it-works" style={footA}>How it works</a>
              <a href="#download"     style={footA}>Download</a>
              <Link to="/signin"      style={footA}>Sign in</Link>
              <Link to="/privacy"     style={footA}>Privacy Policy</Link>
              <Link to="/terms"       style={footA}>Terms of Service</Link>
            </div>
          </div>
          <p style={{ fontSize:11, color:"var(--land-ink-3)" }}>
            &copy; {new Date().getFullYear()} Cheeni. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─── Chat bubble ─────────────────────────────────────────────────────── */
function Bubble({ avatar, text, left }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:8, flexDirection: left ? "row" : "row-reverse" }}>
      {left && avatar && (
        <img src={avatar} alt="Cheeni" style={{ width:28, height:28, borderRadius:7, objectFit:"cover", flexShrink:0, marginTop:2 }} />
      )}
      <div style={{
        maxWidth:"76%", padding:"9px 13px",
        borderRadius: left ? "3px 12px 12px 12px" : "12px 3px 12px 12px",
        background: left ? "var(--land-bg)" : "var(--land-accent)",
        color: left ? "var(--land-ink-2)" : "#fff",
        border: left ? "1px solid var(--land-rule)" : "none",
        fontSize:13, lineHeight:1.55,
      }}>
        {text}
      </div>
    </div>
  );
}

export default Landing;
