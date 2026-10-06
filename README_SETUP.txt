============================================================
  Cheeni AI Desktop Agent -- 1-Click Windows Setup
============================================================

Thank you for downloading Cheeni AI Desktop Agent!

QUICK START INSTRUCTIONS:
1. Extract all files from this ZIP to your Cheeni project directory
   (or keep them together in your Cheeni folder).
2. Double-click "install_autostart.bat" (or right-click and run as Administrator).
3. That's it! Cheeni is now registered in your Windows Startup.

WHENEVER YOU OPEN YOUR LAPTOP:
- Windows will automatically awaken Cheeni in the background silently.
- The Python desktop agent, backend server, and Agent Home Page will launch.
- Cheeni will be ready immediately for voice commands, window management,
  app launching, web search, and filesystem control!

TO UNINSTALL AUTO-START:
- Run "uninstall_autostart.bat" anytime to remove the startup shortcut.

SYSTEM REQUIREMENTS:
- Windows 10 or Windows 11 (64-bit)
- Python 3.10+ (for Python agent tools)
- Node.js 18+
- Google Chrome or Microsoft Edge

ENVIRONMENT & DEPLOYMENT CONFIGURATION:
- ALLOWED_ORIGINS: Comma-separated list of allowed frontend origins (no trailing slashes).
  Example for local dev: ALLOWED_ORIGINS=http://localhost:5173
  Example for production: ALLOWED_ORIGINS=https://cheeni.vercel.app,http://localhost:5173
- In production (NODE_ENV=production), ALLOWED_ORIGINS is strictly enforced and must be defined on your hosting platform (Render/Railway/Vercel Environment Variables dashboard). If missing in production, the server will fail fast to prevent security vulnerabilities.
- In local development, if ALLOWED_ORIGINS is omitted, it defaults safely to http://localhost:5173.

SECURITY & AUTHENTICATION MIGRATION:
- JWT authentication has been upgraded from static 30-day tokens to short-lived access tokens (15m) paired with rotating httpOnly refresh tokens (7d).
- When deploying this update, all existing user sessions with legacy tokens will be invalidated once. Users simply need to log in again to receive new rotated access + refresh token credentials.
============================================================
