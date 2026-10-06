"""
Cheeni Desktop Agent -- Screen Coordinate Calculator
Outputs: X Y WIDTH HEIGHT
Positioned at the top-right corner of the primary Windows monitor's work area.
"""
import ctypes

def get_top_right_coords(width: int = 420, height: int = 750, margin_right: int = 14, margin_top: int = 14):
    try:
        user32 = ctypes.windll.user32
        rect = (ctypes.c_long * 4)()
        # SPI_GETWORKAREA = 0x0030
        user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0)
        left, top, right, bottom = rect[0], rect[1], rect[2], rect[3]
        total_w = right - left
        total_h = bottom - top

        win_w = min(width, total_w - 40)
        win_h = min(height, total_h - 28)

        win_x = right - win_w - margin_right
        win_y = top + margin_top

        return win_x, win_y, win_w, win_h
    except Exception:
        # Fallback to standard safe top-right coordinates
        return 1000, 14, 420, 740

if __name__ == "__main__":
    x, y, w, h = get_top_right_coords()
    print(f"{x} {y} {w} {h}")
