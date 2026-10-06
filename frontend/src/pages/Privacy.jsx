import React from "react";
import { Link } from "react-router-dom";

const S = {
  page:  { background:"var(--land-bg)", color:"var(--land-ink)", fontFamily:"var(--land-sans)", minHeight:"100vh" },
  wrap:  { maxWidth:720, margin:"0 auto", padding:"80px 24px 120px" },
  serif: { fontFamily:"var(--land-serif)" },
  h1:    { fontFamily:"var(--land-serif)", fontSize:"clamp(32px,5vw,52px)", fontWeight:400, letterSpacing:"-0.025em", lineHeight:1.1, color:"var(--land-ink)", margin:"0 0 16px" },
  h2:    { fontFamily:"var(--land-sans)", fontSize:17, fontWeight:700, color:"var(--land-ink)", margin:"40px 0 10px" },
  p:     { fontSize:15, lineHeight:1.75, color:"var(--land-ink-2)", marginBottom:16 },
  small: { fontSize:12, lineHeight:1.6, color:"var(--land-ink-3)" },
  draft: { display:"block", background:"#FDF3E7", border:"1px solid #E6C07A", borderRadius:8, padding:"10px 16px", fontSize:13, color:"#7A4A10", marginBottom:36 },
};

export default function Privacy() {
  return (
    <div style={S.page}>
      <header style={{ borderBottom:"1px solid rgba(26,25,22,0.12)", padding:"0 24px", height:56, display:"flex", alignItems:"center" }}>
        <Link to="/" style={{ fontFamily:"var(--land-serif)", fontSize:18, color:"var(--land-ink)", textDecoration:"none" }}>Cheeni</Link>
      </header>

      <div style={S.wrap}>
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--land-accent)", display:"block", marginBottom:20 }}>Legal</span>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p style={{ ...S.small, marginBottom:32 }}>Last updated: {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })} &nbsp;·&nbsp; Effective from the same date</p>

        <span style={S.draft}>
          Draft — Review before publishing. Sections marked [FILL IN] require accurate details from the product owner before this page goes live.
        </span>

        <p style={S.p}>
          This Privacy Policy describes how Cheeni ("we", "our", or "us") collects, uses, and protects information when you use the Cheeni desktop agent and web dashboard (collectively, "the Service").
        </p>

        <h2 style={S.h2}>1. Information we collect</h2>
        <p style={S.p}><strong>Account information.</strong> When you create an account, we collect your email address and a hashed version of your password. We do not store your password in plain text.</p>
        <p style={S.p}><strong>Assistant preferences.</strong> Your chosen assistant name, avatar selection, voice pitch, and speech rate are stored in our database to personalise your experience.</p>
        <p style={S.p}><strong>Conversation history.</strong> Messages between you and Cheeni are stored in your account to provide contextual responses. You can delete your conversation history at any time from the dashboard.</p>
        <p style={S.p}><strong>System activity.</strong> The desktop agent runs locally on your machine. Commands you issue (volume control, window snapping, file search, web queries) are processed locally and sent to the backend only to generate an AI response. We do not log raw system activity beyond what is needed to fulfil your request.</p>
        <p style={S.p}><strong>Technical data.</strong> We may collect browser type, operating system version, and agent connectivity status for debugging and service improvement. [FILL IN: confirm exact data collected and retention period]</p>

        <h2 style={S.h2}>2. How we use your information</h2>
        <p style={S.p}>We use your information to: provide and operate the Service; generate AI responses to your voice commands; remember your preferences; send you a one-time email verification code when you register; and improve the reliability of the Service.</p>
        <p style={S.p}>We do not sell your personal information to third parties.</p>

        <h2 style={S.h2}>3. AI and third-party services</h2>
        <p style={S.p}>Your conversation messages are sent to third-party AI providers (Google Gemini and OpenRouter) to generate responses. These providers process your text under their own privacy policies. We recommend reviewing those policies. [FILL IN: add links to Gemini and OpenRouter privacy pages]</p>

        <h2 style={S.h2}>4. Email communications</h2>
        <p style={S.p}>We send a one-time verification code to your email address during sign-up. We do not send marketing emails without your consent. [FILL IN: confirm email provider and opt-out mechanism]</p>

        <h2 style={S.h2}>5. Data storage and security</h2>
        <p style={S.p}>Account and conversation data is stored in a MongoDB database hosted on [FILL IN: hosting provider and region]. We use short-lived access tokens and rotating httpOnly refresh tokens for authentication. Passwords are hashed with bcrypt before storage.</p>

        <h2 style={S.h2}>6. Data retention</h2>
        <p style={S.p}>Your account data is retained until you delete your account. Conversation history can be deleted at any time from within the dashboard. [FILL IN: confirm what happens to data after account deletion and the timeline]</p>

        <h2 style={S.h2}>7. Your rights</h2>
        <p style={S.p}>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at [FILL IN: contact email]. If you are in the European Economic Area, you may also have rights under the GDPR including the right to data portability and to lodge a complaint with your local supervisory authority.</p>

        <h2 style={S.h2}>8. Cookies</h2>
        <p style={S.p}>The Service uses an httpOnly cookie to store your refresh token for session management. No advertising or analytics cookies are used. [FILL IN: confirm if any analytics service is added in future]</p>

        <h2 style={S.h2}>9. Changes to this policy</h2>
        <p style={S.p}>We may update this policy periodically. When we make material changes, we will update the date at the top of this page. Your continued use of the Service after changes are posted constitutes your acceptance of the updated policy.</p>

        <h2 style={S.h2}>10. Contact</h2>
        <p style={S.p}>For privacy-related questions, email us at [FILL IN: contact email].</p>

        <div style={{ marginTop:48, paddingTop:24, borderTop:"1px solid rgba(26,25,22,0.12)" }}>
          <Link to="/" style={{ fontSize:13, color:"var(--land-accent)", textDecoration:"none" }}>Back to home</Link>
          &nbsp;&nbsp;&middot;&nbsp;&nbsp;
          <Link to="/terms" style={{ fontSize:13, color:"var(--land-ink-3)", textDecoration:"none" }}>Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
