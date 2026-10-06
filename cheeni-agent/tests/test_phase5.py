"""
Unit tests for Phase 5: Window Management & GUI Automation
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.window_control import (
    get_active_window,
    list_open_windows,
    _get_work_area,
    snap_window,
    snap_corner_companion,
    minimize_window,
    restore_window,
    maximize_window,
    show_desktop,
)


def test_work_area():
    area = _get_work_area()
    print("Work area:", area)
    assert len(area) == 4
    assert area[2] > 0
    assert area[3] > 0
    print("[OK] test_work_area passed")


def test_active_window():
    win = get_active_window()
    print("Active window:", win)
    assert "success" in win
    print("[OK] test_active_window passed")


def test_list_open_windows():
    windows = list_open_windows()
    print(f"Total open visible user windows: {len(windows)}")
    for w in windows[:8]:
        safe_title = w['title'].encode('ascii', 'replace').decode('ascii')
        print(f"  * [{w['pid']}] {safe_title[:50]}")
    assert isinstance(windows, list)
    print("[OK] test_list_open_windows passed")


def test_snap_corner_companion():
    # Calling snap_corner_companion for a mock or non-existent target should return graceful error dict
    res = snap_corner_companion(target="__non_existent_window_12345__", width=420, height=750)
    assert isinstance(res, dict)
    assert "success" in res
    print("[OK] test_snap_corner_companion passed")


if __name__ == "__main__":
    print("=== Running Phase 5 Window Tests ===")
    test_work_area()
    test_active_window()
    test_list_open_windows()
    test_snap_corner_companion()
    print("=== All Window Tests Passed! ===")

