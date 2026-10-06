@echo off
REM ============================================================
REM  Cheeni Auto-Start Uninstaller
REM  Removes Cheeni from Windows Startup folder
REM ============================================================

set "SHORTCUT_LNK=%STARTUP_DIR%\Cheeni Agent.lnk"
set "SHORTCUT_VBS=%STARTUP_DIR%\Cheeni Agent.vbs"

set "REMOVED=0"

if exist "%SHORTCUT_LNK%" (
    del /F /Q "%SHORTCUT_LNK%" >nul 2>&1
    set "REMOVED=1"
)

if exist "%SHORTCUT_VBS%" (
    del /F /Q "%SHORTCUT_VBS%" >nul 2>&1
    set "REMOVED=1"
)

if "%REMOVED%"=="1" (
    echo  [SUCCESS] Cheeni auto-start has been removed.
    echo            Cheeni will no longer launch on Windows boot.
) else (
    echo  [INFO] Cheeni auto-start was not enabled. Nothing to remove.
)

echo.
pause
