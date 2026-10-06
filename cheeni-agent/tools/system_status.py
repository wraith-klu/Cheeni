"""
Cheeni Desktop Agent — System Status & Power Control (Step 12)
Reads real hardware telemetry (battery health, CPU, RAM, disk partitions, specs)
and executes safe Windows power actions (screen lock, sleep, restart, shutdown).
"""
import psutil
import platform
import subprocess
import ctypes
import os
from datetime import datetime
from utils.logging import logger


# ── Hardware Telemetry ────────────────────────────────────────────────────────

def get_battery_status() -> dict:
    """Returns real battery level, charging state, and time remaining."""
    try:
        battery = psutil.sensors_battery()
        if battery is None:
            return {"level": 100, "charging": "plugged in (desktop)", "time_remaining": "N/A", "plugged": True}

        level = round(battery.percent)
        plugged = battery.power_plugged
        charging = "charging" if plugged else "on battery power"

        secs = battery.secsleft
        if secs == psutil.POWER_TIME_UNLIMITED or secs < 0:
            time_remaining = "calculating..." if not plugged else "fully charged"
        else:
            hours, rem = divmod(secs, 3600)
            minutes = rem // 60
            time_remaining = f"{hours}h {minutes}m remaining" if hours else f"{minutes} minutes remaining"

        return {
            "level": level,
            "charging": charging,
            "time_remaining": time_remaining,
            "plugged": plugged,
        }
    except Exception as e:
        logger.error(f"Battery read error: {e}")
        return {"level": -1, "charging": "unknown", "time_remaining": "N/A", "plugged": False}


def get_cpu_status() -> dict:
    """Returns CPU usage percentage, core counts, and frequency."""
    try:
        usage = psutil.cpu_percent(interval=0.2)
        logical_cores = psutil.cpu_count(logical=True)
        physical_cores = psutil.cpu_count(logical=False)
        freq = psutil.cpu_freq()
        freq_ghz = round(freq.current / 1000, 2) if freq and freq.current else None
        return {
            "usage_percent": usage,
            "cores_logical": logical_cores,
            "cores_physical": physical_cores,
            "freq_ghz": freq_ghz,
        }
    except Exception as e:
        logger.error(f"CPU read error: {e}")
        return {"usage_percent": -1, "cores_logical": 0, "cores_physical": 0}


def get_ram_status() -> dict:
    """Returns RAM usage statistics."""
    try:
        mem = psutil.virtual_memory()
        return {
            "total_gb": round(mem.total / (1024 ** 3), 1),
            "used_gb": round(mem.used / (1024 ** 3), 1),
            "available_gb": round(mem.available / (1024 ** 3), 1),
            "usage_percent": mem.percent,
        }
    except Exception as e:
        logger.error(f"RAM read error: {e}")
        return {"usage_percent": -1}


def get_disk_status() -> dict:
    """Returns consolidated disk partitions and storage space."""
    try:
        partitions_info = []
        for part in psutil.disk_partitions(all=False):
            try:
                usage = psutil.disk_usage(part.mountpoint)
                partitions_info.append({
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "total_gb": round(usage.total / (1024 ** 3), 1),
                    "used_gb": round(usage.used / (1024 ** 3), 1),
                    "free_gb": round(usage.free / (1024 ** 3), 1),
                    "usage_percent": usage.percent,
                })
            except (PermissionError, OSError):
                continue

        primary = psutil.disk_usage("C:\\") if os.path.exists("C:\\") else None
        return {
            "primary": {
                "total_gb": round(primary.total / (1024 ** 3), 1) if primary else 0,
                "used_gb": round(primary.used / (1024 ** 3), 1) if primary else 0,
                "free_gb": round(primary.free / (1024 ** 3), 1) if primary else 0,
                "usage_percent": primary.percent if primary else 0,
            },
            "partitions": partitions_info,
        }
    except Exception as e:
        logger.error(f"Disk read error: {e}")
        return {"primary": {"total_gb": 0, "free_gb": 0, "usage_percent": -1}, "partitions": []}


def get_datetime_status() -> dict:
    """Returns current system date and time."""
    now = datetime.now()
    return {
        "time": now.strftime("%I:%M %p"),
        "date": now.strftime("%A, %B %d, %Y"),
        "iso": now.isoformat(),
    }


def get_hardware_specs() -> dict:
    """
    Returns a comprehensive hardware specifications snapshot of the machine.
    """
    cpu = get_cpu_status()
    ram = get_ram_status()
    disk = get_disk_status()
    battery = get_battery_status()

    # Read CPU brand name from Windows registry or platform
    cpu_brand = platform.processor()
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
        val, _ = winreg.QueryValueEx(key, "ProcessorNameString")
        if val:
            cpu_brand = val.strip()
    except Exception:
        pass

    return {
        "processor": cpu_brand,
        "cpu_usage": f"{cpu.get('usage_percent', 0)}%",
        "cores": f"{cpu.get('cores_physical', 0)} physical / {cpu.get('cores_logical', 0)} logical",
        "clock_speed": f"{cpu.get('freq_ghz', 'N/A')} GHz",
        "ram": f"{ram.get('used_gb', 0)} GB used of {ram.get('total_gb', 0)} GB ({ram.get('usage_percent', 0)}%)",
        "storage": f"{disk.get('primary', {}).get('free_gb', 0)} GB free of {disk.get('primary', {}).get('total_gb', 0)} GB on C:",
        "battery": f"{battery.get('level', 100)}% ({battery.get('charging', 'N/A')})",
        "os": f"{platform.system()} {platform.release()} (Build {platform.version()})",
        "machine": platform.machine(),
        "hostname": platform.node(),
    }


def get_full_system_status() -> dict:
    """Returns a full consolidated system telemetry snapshot."""
    return {
        "battery": get_battery_status(),
        "cpu": get_cpu_status(),
        "ram": get_ram_status(),
        "disk": get_disk_status(),
        "datetime": get_datetime_status(),
        "platform": platform.system(),
        "hostname": platform.node(),
    }


# ── Windows Power & Security Controls ─────────────────────────────────────────

def lock_workstation() -> dict:
    """
    Locks the Windows workstation screen immediately.
    Equivalent to pressing Win + L.
    """
    try:
        result = ctypes.windll.user32.LockWorkStation()
        if result != 0:
            logger.info("Workstation locked successfully.")
            return {"success": True, "message": "Workstation locked."}
        else:
            # Fallback to rundll32
            subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"], check=True)
            return {"success": True, "message": "Workstation locked."}
    except Exception as e:
        logger.error(f"Failed to lock workstation: {e}")
        return {"success": False, "message": f"Could not lock screen: {str(e)}"}


def sleep_system() -> dict:
    """
    Puts the laptop into sleep / standby mode.
    """
    try:
        subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
        return {"success": True, "message": "Putting laptop to sleep."}
    except Exception as e:
        return {"success": False, "message": f"Failed putting system to sleep: {str(e)}"}


def restart_system(delay_sec: int = 5) -> dict:
    """
    Safely restarts Windows after the specified delay.
    """
    try:
        subprocess.Popen(["shutdown", "/r", "/t", str(delay_sec)])
        return {"success": True, "message": f"Restarting system in {delay_sec} seconds."}
    except Exception as e:
        return {"success": False, "message": f"Failed restarting system: {str(e)}"}


def shutdown_system(delay_sec: int = 5) -> dict:
    """
    Safely shuts down Windows after the specified delay.
    """
    try:
        subprocess.Popen(["shutdown", "/s", "/t", str(delay_sec)])
        return {"success": True, "message": f"Shutting down laptop in {delay_sec} seconds."}
    except Exception as e:
        return {"success": False, "message": f"Failed shutting down system: {str(e)}"}
