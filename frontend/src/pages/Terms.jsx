import React from "react";
import { Link } from "react-router-dom";

const S = {
  page:  { background:"var(--land-bg)", color:"var(--land-ink)", fontFamily:"var(--land-sans)", minHeight:"100vh" },
  wrap:  { maxWidth:720, margin:"0 auto", padding:"80px 24px 120px" },
  h1:    { fontFamily:"var(--land-serif)", fontSize:"clamp(32px,5vw,52px)", fontWeight:400, letterSpacing:"-0.025em", lineHeight:1.1, color:"var(--land-ink)", margin:"0 0 16px" },
  h2:    { fontFamily:"var(--land-sans)", fontSize:17, fontWeight:700, color:"var(--land-ink)", margin:"40px 0 10px" },
  p:     { fontSize:15, lineHeight:1.75, color:"var(--land-ink-2)", marginBottom:16 },
  small: { fontSize:12, lineHeight:1.6, color:"var(--land-ink-3)" },
  draft: { display:"block", background:"#FDF3E7", border:"1px solid #E6C07A", borderRadius:8, padding:"10px 16px", fontSize:13, color:"#7A4A10", marginBottom:36 },
};

export default function Terms() {
  return (
    <div style={S.page}>
      <header style={{ borderBottom:"1px solid rgba(26,25,22,0.12)", padding:"0 24px", height:56, display:"flex", alignItems:"center" }}>
        <Link to="/" style={{ fontFamily:"var(--land-serif)", fontSize:18, color:"var(--land-ink)", textDecoration:"none" }}>Cheeni</Link>
      </header>

      <div style={S.wrap}>
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--land-accent)", display:"block", marginBottom:20 }}>Legal</span>
        <h1 style={S.h1}>Terms of Service</h1>
        <p style={{ ...S.small, marginBottom:32 }}>Last updated: {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })} &nbsp;·&nbsp; Effective from the same date</p>

        <span style={S.draft}>
          Draft — Review before publishing. Sections marked [FILL IN] require accurate details from the product owner before this page goes live.
        </span>

        <p style={S.p}>
          By downloading, installing, or using Cheeni ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
        </p>

        <h2 style={S.h2}>1. Description of the Service</h2>
        <p style={S.p}>Cheeni is a voice-first autonomous desktop agent for Windows. It runs locally on your computer and connects to a cloud backend to process your voice commands using large language model (LLM) services. The web dashboard allows you to configure your assistant's persona and review conversation history.</p>

        <h2 style={S.h2}>2. Account eligibility</h2>
        <p style={S.p}>You must be at least 13 years old (or the minimum digital age in your jurisdiction) to create an account. By creating an account, you represent that the information you provide is accurate and that you are eligible to form a binding agreement.</p>

        <h2 style={S.h2}>3. Acceptable use</h2>
        <p style={S.p}>You may use the Service for lawful personal and educational purposes. You may not: use the Service to perform actions that harm other users or third parties; attempt to reverse-engineer, decompile, or tamper with the software; use automated scripts to abuse the API; or circumvent any security measures in the Service.</p>

        <h2 style={S.h2}>4. System access and local execution</h2>
        <p style={S.p}>The desktop agent executes commands on your local Windows machine including volume control, window management, file search, and system power commands. You are responsible for reviewing the commands you issue. Destructive actions (shutdown, restart, file operations) require your explicit confirmation within the agent interface.</p>
        <p style={S.p}>We are not responsible for data loss or system changes resulting from commands you explicitly authorise through the agent.</p>

        <h2 style={S.h2}>5. Third-party AI services</h2>
        <p style={S.p}>Cheeni uses third-party AI providers (Google Gemini, OpenRouter) to generate responses. The availability, accuracy, and content of those responses are subject to those providers' terms and are outside our direct control. We are not liable for inaccurate, offensive, or harmful AI-generated content, though we apply content filtering where feasible.</p>

        <h2 style={S.h2}>6. Intellectual property</h2>
        <p style={S.p}>The Cheeni software, design, and brand are the property of [FILL IN: legal entity name]. You are granted a limited, non-exclusive, non-transferable licence to use the Service for personal purposes. You may not redistribute, sublicense, or commercialise the Service without written permission.</p>

        <h2 style={S.h2}>7. Availability and changes</h2>
        <p style={S.p}>We aim to keep the Service available but do not guarantee uninterrupted access. We may modify, suspend, or discontinue any part of the Service at any time. Where possible, we will give reasonable advance notice of significant changes.</p>

        <h2 style={S.h2}>8. Disclaimer of warranties</h2>
        <p style={S.p}>The Service is provided "as is" without warranties of any kind, express or implied. We do not warrant that the Service will be error-free, secure, or continuously available.</p>

        <h2 style={S.h2}>9. Limitation of liability</h2>
        <p style={S.p}>To the maximum extent permitted by applicable law, we are not liable for indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to loss of data or system damage caused by commands executed through the agent.</p>

        <h2 style={S.h2}>10. Governing law</h2>
        <p style={S.p}>These Terms are governed by the laws of [FILL IN: jurisdiction, e.g. India / State of X]. Disputes shall be resolved in the courts of [FILL IN: city and jurisdiction].</p>

        <h2 style={S.h2}>11. Contact</h2>
        <p style={S.p}>For questions about these Terms, contact us at [FILL IN: contact email].</p>

        <div style={{ marginTop:48, paddingTop:24, borderTop:"1px solid rgba(26,25,22,0.12)" }}>
          <Link to="/" style={{ fontSize:13, color:"var(--land-accent)", textDecoration:"none" }}>Back to home</Link>
          &nbsp;&nbsp;&middot;&nbsp;&nbsp;
          <Link to="/privacy" style={{ fontSize:13, color:"var(--land-ink-3)", textDecoration:"none" }}>Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
