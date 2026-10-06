@echo off
REM ============================================================
REM  Cheeni Auto-Start Installer
REM  Copies start_cheeni.vbs to Windows Startup folder
REM  Run this ONCE to enable auto-launch on boot
REM ============================================================

set "CHEENI_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%CHEENI_DIR%start_cheeni.vbs"
set "SHORTCUT_TARGET=%STARTUP_DIR%\Cheeni Agent.vbs"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║     Cheeni Desktop Agent — Auto-Start Setup      ║
echo  ╚══════════════════════════════════════════════════╝
echo.

if not exist "%VBS_FILE%" (
    echo [ERROR] Cannot find start_cheeni.vbs in %CHEENI_DIR%
    echo         Please make sure this script is in the Cheeni project root.
    pause
    exit /b 1
)

set "SHORTCUT_LNK=%STARTUP_DIR%\Cheeni Agent.lnk"
set "SHORTCUT_VBS=%STARTUP_DIR%\Cheeni Agent.vbs"

REM Create a proper Windows shortcut (.lnk) with WorkingDirectory set to CHEENI_DIR
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_LNK%'); $s.TargetPath = '%VBS_FILE%'; $s.WorkingDirectory = '%CHEENI_DIR%'; $s.Description = 'Cheeni AI Desktop Agent'; $s.Save()" >nul 2>&1

REM Also copy VBS directly as secondary fallback
copy /Y "%VBS_FILE%" "%SHORTCUT_VBS%" >nul 2>&1

if exist "%SHORTCUT_LNK%" (
    echo  [SUCCESS] Cheeni will now auto-launch on Windows startup!
    echo.
    echo  Startup shortcut created: %SHORTCUT_LNK%
    echo  Target: %VBS_FILE%
    echo  Working Directory: %CHEENI_DIR%
    echo.
    echo  To remove auto-start, run: uninstall_autostart.bat
) else if exist "%SHORTCUT_VBS%" (
    echo  [SUCCESS] Cheeni startup script installed!
    echo.
    echo  Startup file: %SHORTCUT_VBS%
    echo.
    echo  To remove auto-start, run: uninstall_autostart.bat
) else (
    echo  [ERROR] Failed to set up startup entry.
    echo          Try running this script as Administrator.
)

echo.
pause
