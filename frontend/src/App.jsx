import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserDataContext } from "./context/userDataContext";

import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Customize from "./pages/Customize";
import Customize2 from "./pages/Customize2";
import Home from "./pages/Home";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

function App() {
  const { userData, authLoading } = useContext(UserDataContext);

  // Block rendering routes until silent refresh attempt resolves.
  // Prevents authenticated users from flash-redirecting to /signin on hard reload.
  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#050713] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <p className="text-slate-500 text-sm">Restoring session…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* ── Public Landing Page (Download Agent & Setup) ── */}
      <Route path="/" element={<Landing />} />

      {/* ── Authentication Flow ── */}
      <Route
        path="/signin"
        element={!userData ? <SignIn /> : <Navigate to="/app" />}
      />
      <Route
        path="/signup"
        element={!userData ? <SignUp /> : <Navigate to="/app" />}
      />

      {/* ── Assistant Customization Onboarding ── */}
      <Route
        path="/customize"
        element={userData ? <Customize /> : <Navigate to="/signin" />}
      />
      <Route
        path="/customize2"
        element={userData ? <Customize2 /> : <Navigate to="/signin" />}
      />

      {/* ── Agent Home Page (Voice, Persona & System Control Dashboard) ── */}
      <Route
        path="/app"
        element={
          userData ? (
            userData?.assistantImage && userData?.assistantName ? (
              <Home />
            ) : (
              <Navigate to="/customize" />
            )
          ) : (
            <Navigate to="/signin" />
          )
        }
      />
      <Route path="/home" element={<Navigate to="/app" />} />

      {/* ── Legal Pages ── */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms"   element={<Terms />} />

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
