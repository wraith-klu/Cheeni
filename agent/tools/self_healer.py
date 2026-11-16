"""
Capability 15 — Self-Healing & Diagnostic Agent (Auto-Remediation)
-------------------------------------------------------------------
Connects Capability 8 (Chronos Telemetry) and Capability 9 (Threat Anomaly)
to an automated diagnostic engine. Identifies rogue PIDs, port collisions,
memory leaks and offers one-click fixes.

STATUS: Stub — full implementation in sprint 2.
"""

import logging
import asyncio

logger = logging.getLogger("cheeni.self_healer")

SAFE_ACTIONS = {"kill_pid", "free_port", "clear_cache", "restart_service"}


class SelfHealer:
    """
    Automated diagnostic + remediation engine.

    Planned stack:
        Telemetry   : psutil (CPU, RAM, disk, network per PID)
        Port scan   : socket.connect_ex probe on watched ports
        Anomaly     : Re-uses cheeni-threat-onnx_09 autoencoder
        Actions     : subprocess / taskkill (Windows) with confirm gate
    """

    def __init__(self):
        logger.info("🛠️ SelfHealer stub initialised — auto-remediation not yet active")

    async def diagnose(self) -> dict:
        """
        Run a full system health sweep.
        Returns issues detected and suggested fixes.
        """
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory()
            issues = []

            if cpu > 90:
                top = sorted(psutil.process_iter(["pid", "name", "cpu_percent"]),
                             key=lambda p: p.info["cpu_percent"] or 0, reverse=True)[:3]
                issues.append({
                    "type": "high_cpu",
                    "value": cpu,
                    "top_pids": [{"pid": p.info["pid"], "name": p.info["name"],
                                  "cpu": p.info["cpu_percent"]} for p in top],
                    "suggestion": "kill_pid",
                })
            if mem.percent > 90:
                issues.append({
                    "type": "high_memory",
                    "value": mem.percent,
                    "suggestion": "clear_cache",
                })
            return {"ok": True, "issues": issues, "cpu_pct": cpu, "mem_pct": mem.percent}
        except ImportError:
            return {"ok": False, "error": "psutil not installed", "issues": []}

    async def free_port(self, port: int) -> dict:
        """Kill the process occupying `port` on Windows."""
        try:
            import subprocess, re
            result = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True, text=True
            )
            pid = None
            for line in result.stdout.splitlines():
                if f":{port} " in line and "LISTENING" in line:
                    m = re.search(r"\s(\d+)$", line.strip())
                    if m:
                        pid = int(m.group(1))
                        break
            if pid:
                subprocess.run(["taskkill", "/PID", str(pid), "/F"])
                return {"ok": True, "freed_port": port, "killed_pid": pid}
            return {"ok": False, "error": f"No process found on port {port}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
