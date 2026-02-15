gio"""Meeting Speaker Timer — PyWebView Desktop App (Dual-Window)."""

import ctypes
import os
import sys
import time

import webview

from timer_engine import TimerEngine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.join(BASE_DIR, "ui")


def _make_window_translucent(window, alpha=51):
    """Make window semi-transparent. alpha: 0=invisible, 255=opaque.
    51 = ~20% opacity.
    """
    if sys.platform != "win32":
        return
    try:
        hwnd = window.native.Handle
        if hasattr(hwnd, 'ToInt64'):
            hwnd = hwnd.ToInt64()
        elif hasattr(hwnd, 'ToInt32'):
            hwnd = hwnd.ToInt32()
        else:
            hwnd = int(hwnd)
    except Exception:
        return

    user32 = ctypes.windll.user32
    GWL_EXSTYLE = -20
    WS_EX_LAYERED = 0x80000
    LWA_ALPHA = 0x2

    style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
    user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED)
    user32.SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)


# Keep references to windows
display_window = None
control_window = None


class TimerAPI:
    def __init__(self):
        self.engine = TimerEngine()

    # ── Timer Control ─────────────────────────────────────────────

    def configure(self, speaker: str, minutes: int, seconds: int):
        self.engine.configure(speaker, minutes, seconds)

    def start_timer(self):
        self.engine.start()

    def stop_timer(self):
        self.engine.stop()

    def finish_animation(self):
        self.engine.finish_animation()

    def next_speaker(self):
        self.engine.next_speaker()

    def add_time(self, seconds: int):
        self.engine.add_time(seconds)

    # ── State & History ───────────────────────────────────────────

    def get_state(self):
        return self.engine.get_state()

    def get_history(self):
        return self.engine.get_history()

    def export_csv(self):
        return self.engine.export_csv()

    # ── Config ────────────────────────────────────────────────────

    def get_config(self):
        return self.engine.get_config()

    def save_config(self, tiers_data: list, max_cost: float,
                    alarm_1: int, alarm_2: int):
        self.engine.save_config(tiers_data, max_cost, alarm_1, alarm_2)

    # ── Quote & Speaker List ────────────────────────────────────

    def set_quote(self, text: str):
        self.engine.set_quote(text)

    def get_speakers(self):
        return self.engine.get_speakers()

    def set_speakers(self, speakers_data: list):
        self.engine.set_speakers(speakers_data)

    def load_next_speaker(self):
        return self.engine.load_next_speaker()

    def import_speakers_from_excel(self):
        """Open file dialog and import speakers from Excel."""
        global control_window
        file_types = ('Excel Files (*.xlsx;*.xls)', 'All Files (*.*)')
        result = control_window.create_file_dialog(
            webview.FileDialog.OPEN,
            file_types=file_types,
        )
        if not result:
            return []
        filepath = result[0] if isinstance(result, (list, tuple)) else result
        return self.engine.import_speakers_from_excel(filepath)

    # ── Window Management ─────────────────────────────────────────

    def set_display_size(self, width, height):
        global display_window
        if display_window:
            display_window.resize(int(width), int(height))

    def go_fullscreen(self):
        global display_window
        if display_window:
            display_window.toggle_fullscreen()

    def go_floating(self, panel_open=False):
        global display_window
        if display_window:
            display_window.toggle_fullscreen()
            time.sleep(0.15)
            display_window.resize(500, 120)


def main():
    global display_window, control_window

    api = TimerAPI()

    display_window = webview.create_window(
        title="Meeting Timer",
        url=os.path.join(UI_DIR, "display.html"),
        js_api=api,
        width=500,
        height=120,
        min_size=(300, 60),
        frameless=True,
        easy_drag=True,
        on_top=True,
        resizable=True,
        background_color="#0a0a0f",
    )

    control_window = webview.create_window(
        title="Meeting Timer — Control Panel",
        url=os.path.join(UI_DIR, "control.html"),
        js_api=api,
        width=700,
        height=800,
        min_size=(500, 600),
        frameless=False,
        easy_drag=False,
        on_top=False,
        resizable=True,
        background_color="#0a0a0f",
    )

    def on_start():
        time.sleep(0.5)
        display_window.resize(500, 120)
        # 51 = 20% opacity background. Text compensated via CSS.
        _make_window_translucent(display_window, alpha=51)

    webview.start(on_start, debug=False)


if __name__ == "__main__":
    main()
