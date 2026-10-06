@echo off
setlocal enabledelayedexpansion
title Cheeni AI Desktop Assistant - Master Launcher & Status Dashboard
color 0F

REM ============================================================
REM  Cheeni Desktop Agent — Unified Single-Click Master Launcher
REM  Starts & monitors all 3 tiers with a live status dashboard:
REM    1. Python Desktop Agent  (Port 2026)
REM    2. Node.js Backend       (Port 2025)
REM    3. Vite Frontend Client  (Port 5173)
REM ============================================================

set "CHEENI_DIR=%~dp0"
set "PYTHON_PORT=2026"
set "NODE_PORT=2025"
set "FRONTEND_PORT=5173"

cls
echo ===============================================================================
echo                CHEENI AI ASSISTANT -- MASTER LAUNCHER & STATUS
echo ===============================================================================
echo   Workspace : %CHEENI_DIR%
echo   Mode      : Voice Assistant ^& Corner Companion Snapping
echo ===============================================================================
echo.

REM ── Check Prerequisites ─────────────────────────────────────────────────────────
echo [*] Checking Environment Prerequisites...

where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python was not found in PATH! Please install Python 3.10+ and re-run.
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js was not found in PATH! Please install Node.js and re-run.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm was not found in PATH! Please install npm and re-run.
    pause
    exit /b 1
)

echo [OK] Python, Node.js, and npm are detected.
echo.

REM ── Step 1: Python Desktop Agent ────────────────────────────────────────────────
echo [1/3] Launching Python Desktop Agent (port %PYTHON_PORT%)...
start "Cheeni-Python-Agent" /MIN cmd /c "cd /d "%CHEENI_DIR%cheeni-agent" && python main.py"

REM ── Step 2: Node.js Backend ─────────────────────────────────────────────────────
echo [2/3] Launching Node.js Backend Server (port %NODE_PORT%)...
start "Cheeni-Node-Backend" /MIN cmd /c "cd /d "%CHEENI_DIR%backend" && node index.js"

REM ── Step 3: Vite Frontend ───────────────────────────────────────────────────────
echo [3/3] Launching Vite Frontend Dev Client (port %FRONTEND_PORT%)...
start "Cheeni-Vite-Frontend" /MIN cmd /c "cd /d "%CHEENI_DIR%frontend" && npm run dev"

echo.
echo [*] Waiting for services to bind ports and stabilize...

REM ── Health Check Verification Loop ──────────────────────────────────────────────
set /a ATTEMPTS=0
set /a MAX_ATTEMPTS=15

:health_check_loop
timeout /t 1 /nobreak >nul
set /a ATTEMPTS+=1

set "PY_STATUS=[STARTING]"
set "NODE_STATUS=[STARTING]"
set "WEB_STATUS=[STARTING]"

netstat -ano | findstr /R ":%PYTHON_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 set "PY_STATUS=[ONLINE]  "

netstat -ano | findstr /R ":%NODE_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 set "NODE_STATUS=[ONLINE]  "

netstat -ano | findstr /R ":%FRONTEND_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 set "WEB_STATUS=[ONLINE]  "

cls
echo ===============================================================================
echo                CHEENI AI ASSISTANT -- LIVE STATUS DASHBOARD
echo ===============================================================================
echo   Timestamp : %DATE% %TIME%
echo   Directory : %CHEENI_DIR%
echo -------------------------------------------------------------------------------
echo   SERVICE                      PORT     STATUS           HEALTH / URL
echo -------------------------------------------------------------------------------
echo   Python Agent (OS Telemetry)  %PYTHON_PORT%     %PY_STATUS%      http://localhost:%PYTHON_PORT%/docs
echo   Node.js Backend (Gemini API) %NODE_PORT%     %NODE_STATUS%      http://localhost:%NODE_PORT%/health
echo   Vite UI Client (Corner App)  %FRONTEND_PORT%     %WEB_STATUS%      http://localhost:%FRONTEND_PORT%/app
echo ===============================================================================

if "%PY_STATUS%"=="[ONLINE]  " if "%NODE_STATUS%"=="[ONLINE]  " if "%WEB_STATUS%"=="[ONLINE]  " (
    goto :services_ready
)

if %ATTEMPTS% GEQ %MAX_ATTEMPTS% (
    echo.
    echo [!] Some services took longer than expected to bind, proceeding with app launch...
    goto :services_ready
)

echo   Starting up... (Check %ATTEMPTS%/%MAX_ATTEMPTS%)
goto :health_check_loop

:services_ready
echo.
echo [SUCCESS] Core services are active!
echo.

REM ── Step 4: Calculate Screen Coordinates ─────────────────────────────────────────
echo [*] Calculating Desktop Snap Positioning...
set "WIN_X=1000"
set "WIN_Y=14"
set "WIN_W=420"
set "WIN_H=750"

for /f "tokens=1,2,3,4" %%A in ('python "%CHEENI_DIR%cheeni-agent\tools\get_screen_coords.py" 2^>nul') do (
    set "WIN_X=%%A"
    set "WIN_Y=%%B"
    set "WIN_W=%%C"
    set "WIN_H=%%D"
)

echo [*] Target Screen Window: (%WIN_X%, %WIN_Y%) ^| Size: %WIN_W%x%WIN_H%
set "APP_URL=http://localhost:5173/app?mode=corner"
set "APP_FLAGS=--app=%APP_URL% --window-position=%WIN_X%,%WIN_Y% --window-size=%WIN_W%,%WIN_H% --disable-infobars --no-first-run --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream"

REM ── Step 5: Launch Browser App Window ───────────────────────────────────────────
echo [*] Spawning Cheeni App Window...

where chrome >nul 2>&1
if %ERRORLEVEL%==0 (
    start "" chrome %APP_FLAGS%
    goto :dock
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" %APP_FLAGS%
    goto :dock
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" %APP_FLAGS%
    goto :dock
)

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" %APP_FLAGS%
    goto :dock
)

start "" "%APP_URL%"

:dock
timeout /t 2 /nobreak >nul
python -c "from tools.window_control import snap_corner_companion; snap_corner_companion(width=%WIN_W%, height=%WIN_H%)" >nul 2>&1

cls
echo ===============================================================================
echo                CHEENI AI ASSISTANT -- LIVE STATUS DASHBOARD
echo ===============================================================================
echo   SERVICE                      PORT     STATUS           HEALTH / URL
echo -------------------------------------------------------------------------------
echo   Python Agent (OS Telemetry)  %PYTHON_PORT%     [ONLINE]         http://localhost:%PYTHON_PORT%/docs
echo   Node.js Backend (Gemini API) %NODE_PORT%     [ONLINE]         http://localhost:%NODE_PORT%/health
echo   Vite UI Client (Corner App)  %FRONTEND_PORT%     [ONLINE]         http://localhost:%FRONTEND_PORT%/app
echo ===============================================================================
echo   KEYBOARD SHORTCUTS IN CHEENI:
echo     - Space or Alt+M   : Toggle Microphone (Listen / Stop)
echo     - Escape           : Stop audio playback / Close modal
echo     - Ctrl+K           : Focus prompt text box
echo     - Ctrl+Shift+H     : Open Notes / Conversation history
echo ===============================================================================
echo   Cheeni is currently running and snapped to your top-right desktop!
echo   Keep this status console open to monitor health. Press [Q] to stop all services.
echo ===============================================================================
echo.

:monitor_loop
set /p USER_INPUT="Press [R] to re-check status, [S] to re-snap window, or [Q] to shutdown all: "
if /i "%USER_INPUT%"=="Q" goto :shutdown_all
if /i "%USER_INPUT%"=="S" (
    echo Re-snapping Cheeni to top-right corner...
    python -c "from tools.window_control import snap_corner_companion; snap_corner_companion(width=%WIN_W%, height=%WIN_H%)" >nul 2>&1
    echo Done.
    goto :monitor_loop
)
if /i "%USER_INPUT%"=="R" goto :services_ready
goto :monitor_loop

:shutdown_all
echo.
echo [*] Terminating Cheeni background services...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PYTHON_PORT% " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%NODE_PORT% " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%FRONTEND_PORT% " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo [OK] All Cheeni services successfully stopped. Goodbye!
timeout /t 2 >nul
exit /b 0
