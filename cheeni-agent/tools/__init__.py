"""
Cheeni Desktop Agent — Tools Package (V1–V20)
"""
from .system_status import (
    get_full_system_status,
    get_battery_status,
    get_cpu_status,
    get_ram_status,
    get_disk_status,
    get_datetime_status,
    get_hardware_specs,
    lock_workstation,
    sleep_system,
    restart_system,
    shutdown_system,
)
from .app_control import (
    launch_app,
    close_app,
    is_app_running,
    list_running_apps,
    focus_app,
)
from .volume_control import (
    get_volume,
    set_volume,
    adjust_volume_delta,
    mute_volume,
    unmute_volume,
    toggle_mute,
)
from .router import route_command, RouterResult, detect_intent
from .digest_agent import get_digest_agent
from .connectors import get_connector_registry
from .notes_indexer import get_notes_indexer

__all__ = [
    # System Status & Telemetry
    "get_full_system_status",
    "get_battery_status",
    "get_cpu_status",
    "get_ram_status",
    "get_disk_status",
    "get_datetime_status",
    "get_hardware_specs",
    # Power Controls
    "lock_workstation",
    "sleep_system",
    "restart_system",
    "shutdown_system",
    # App Control
    "launch_app",
    "close_app",
    "is_app_running",
    "list_running_apps",
    "focus_app",
    # Volume Control
    "get_volume",
    "set_volume",
    "adjust_volume_delta",
    "mute_volume",
    "unmute_volume",
    "toggle_mute",
    # Router
    "route_command",
    "RouterResult",
    "detect_intent",
    # V17: Morning Digest
    "get_digest_agent",
    # V18: Connectors
    "get_connector_registry",
    # V20: Notes Indexer
    "get_notes_indexer",
]
