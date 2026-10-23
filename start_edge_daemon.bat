@echo off
title Cheeni Edge Client Daemon
color 0B

echo ===================================================
echo     Cheeni Edge Desktop Daemon (Windows Client)
echo ===================================================
echo.
echo Connecting local laptop automation to Cheeni Brain...
echo.

if not exist "cheeni-agent\venv" (
    echo [INFO] Python virtual environment not found in cheeni-agent.
    echo Running with default system python...
    python cheeni_edge_daemon.py
) else (
    echo [INFO] Activating virtual environment...
    call cheeni-agent\venv\Scripts\activate
    python cheeni_edge_daemon.py
)

pause
