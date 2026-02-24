"""Meeting Speaker Timer — PyWebView Desktop App (Dual-Window)."""

import os

# Force qtpy to use PySide6, as we only installed PySide6
os.environ["QT_API"] = "pyside6"

import time
import threading
import winsound
import webview

from timer_engine import TimerEngine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.join(BASE_DIR, "ui")
SOUNDS_DIR = os.path.join(UI_DIR, "sounds")


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

    def pause_timer(self):
        self.engine.pause()

    def resume_timer(self):
        self.engine.resume()

    def finish_animation(self):
        self.engine.finish_animation()

    def next_speaker(self):
        self.engine.next_speaker()

    def add_time(self, seconds: int):
        self.engine.add_time(seconds)

    # ── State & History ───────────────────────────────────────────

    def get_state(self):
        state = self.engine.get_state()
        # Play alarms natively — bypasses browser autoplay policy
        if state.get("alarm_1"):
            self._play_sound(1)
        if state.get("alarm_2"):
            self._play_sound(2)
        if state.get("alarm_3"):
            self._play_sound(3)
        return state

    def _play_sound(self, num):
        """Play alarm WAV natively via winsound in a background thread."""
        wav = os.path.join(SOUNDS_DIR, f"{num}.wav")
        if not os.path.exists(wav):
            return
        def _do():
            try:
                winsound.PlaySound(wav, winsound.SND_FILENAME)
            except Exception:
                pass
        threading.Thread(target=_do, daemon=True).start()

    def get_history(self):
        return self.engine.get_history()

    def export_csv(self):
        return self.engine.export_csv()

    # ── Config ────────────────────────────────────────────────────

    def get_config(self):
        return self.engine.get_config()

    def save_config(self, tiers_data: list, max_cost: float,
                    alarm_1: int, alarm_2: int, alarms_enabled: bool = True,
                    alarm_3_interval: float = 60):
        self.engine.save_config(tiers_data, max_cost, alarm_1, alarm_2, alarms_enabled, alarm_3_interval)

    # ── Quote & Speaker List ────────────────────────────────────

    def set_quote(self, text: str):
        self.engine.set_quote(text)

    def get_speakers(self):
        return self.engine.get_speakers()

    def set_speakers(self, speakers_data: list):
        self.engine.set_speakers(speakers_data)

    def reset_speaker_list(self):
        self.engine.reset_speaker_list()

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
            # Increased width to 320 to fit large numbers
            display_window.resize(290, 60)

    def move_window(self, dx, dy):
        global display_window
        if display_window:
            display_window.move(int(display_window.x + dx), int(display_window.y + dy))


def main():
    global display_window, control_window

    api = TimerAPI()

    display_window = webview.create_window(
        title="Meeting Timer",
        url=os.path.join(UI_DIR, "display.html"),
        js_api=api,
        width=290,
        height=60,
        min_size=(150, 30),
        frameless=True,
        easy_drag=False,
        on_top=True,
        resizable=True,
        transparent=True,  # Qt supports per-pixel alpha
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
        display_window.resize(320, 60)

    # Force Qt backend
    webview.start(on_start, debug=False, gui='qt')


if __name__ == "__main__":
    main()
