"""Meeting Speaker Timer — PyWebView Desktop App (Dual-Window)."""

import os
import shutil

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
config_window = None


class TimerAPI:
    __instance = None

    def __init__(self):
        self.engine = TimerEngine()
        TimerAPI.__instance = self

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
            self._play_sound(self.engine.alarm_sounds.get("1", "1.wav"), self.engine.alarm_durations.get("1", 0.0))
        if state.get("alarm_2"):
            self._play_sound(self.engine.alarm_sounds.get("2", "2.wav"), self.engine.alarm_durations.get("2", 0.0))
        if state.get("alarm_3"):
            self._play_sound(self.engine.alarm_sounds.get("3", "3.wav"), self.engine.alarm_durations.get("3", 0.0))
        return state

    def _play_sound(self, sound_file, duration):
        """Play WAV file via sounddevice. File should be padded on upload."""
        wav_path = os.path.join(SOUNDS_DIR, sound_file)
        if not os.path.exists(wav_path):
            return

        # Stop any currently playing sound if possible (winsound only supports one async sound)
        winsound.PlaySound(None, winsound.SND_PURGE)
        
        # Use simple async winsound
        winsound.PlaySound(wav_path, winsound.SND_FILENAME | winsound.SND_ASYNC)
        
        # If a duration was provided, schedule a stop (requires another PlaySound trick)
        if duration > 0:
            threading.Timer(duration, lambda: winsound.PlaySound(None, winsound.SND_PURGE)).start()

    def play_sound_preview(self, sound_file, duration):
        """Preview alarm WAV natively from the UI."""
        self._play_sound(sound_file, duration)

    def get_history(self):
        return self.engine.get_history()

    def export_csv(self):
        return self.engine.export_csv()

    # ── Config ────────────────────────────────────────────────────

    def get_config(self):
        return self.engine.get_config()

    def save_config(self, tiers_data: list, max_cost: float,
                    alarm_1: int, alarm_2: int, alarms_enabled: bool = True,
                    alarm_3_interval: float = 60,
                    alarm_sounds: dict = None, alarm_durations: dict = None):
        self.engine.save_config(tiers_data, max_cost, alarm_1, alarm_2, alarms_enabled, alarm_3_interval, alarm_sounds, alarm_durations)

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

    # ── Appearance ──────────────────────────────────────────────────

    def get_system_fonts(self):
        """Return sorted list of Windows system font family names."""
        import winreg
        import re
        families = set()
        try:
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"
            )
            i = 0
            while True:
                try:
                    name, _, _ = winreg.EnumValue(key, i)
                    # Strip type suffix like "(TrueType)", "(OpenType)"
                    name = re.sub(r'\s*\(.*?\)\s*$', '', name).strip()
                    # Strip style words to get family name
                    name = re.sub(r'\s+(Bold|Italic|Light|Thin|Medium|SemiBold|ExtraBold|Black|Regular|Condensed|SemiLight|ExtraLight)\b.*$', '', name, flags=re.IGNORECASE).strip()
                    if name:
                        families.add(name)
                    i += 1
                except OSError:
                    break
            winreg.CloseKey(key)
        except Exception as e:
            print(f"[Fonts] Registry read failed: {e}")
        return sorted(families, key=str.lower)

    def get_appearance(self):
        return self.engine.get_appearance()

    def set_appearance(self, data: dict):
        self.engine.set_appearance(data)

    def set_background_image(self):
        """Open file dialog to pick a background image, copy it to ui/image/."""
        global config_window, control_window
        dialog_win = config_window or control_window
        file_types = ('Image Files (*.jpg;*.jpeg;*.png;*.webp;*.bmp)', 'All Files (*.*)')
        result = dialog_win.create_file_dialog(
            webview.FileDialog.OPEN,
            file_types=file_types,
        )
        if not result:
            return None
        filepath = result[0] if isinstance(result, (list, tuple)) else result
        filename = os.path.basename(filepath)
        dest = os.path.join(UI_DIR, "image", filename)
        try:
            shutil.copy2(filepath, dest)
        except shutil.SameFileError:
            pass
        self.engine.set_appearance({"background_image": filename})
        return filename

    def select_sound_file(self):
        """Open file dialog to pick a WAV file, copy it to ui/sounds/."""
        global config_window, control_window
        dialog_win = config_window or control_window
        file_types = ('Audio Files (*.wav)', 'All Files (*.*)')
        result = dialog_win.create_file_dialog(
            webview.FileDialog.OPEN,
            file_types=file_types,
        )
        if not result:
            return None
        filepath = result[0] if isinstance(result, (list, tuple)) else result
        filename = os.path.basename(filepath)
        dest = os.path.join(SOUNDS_DIR, filename)
        os.makedirs(SOUNDS_DIR, exist_ok=True)

        # Stop any playing sound to free the file handle
        winsound.PlaySound(None, winsound.SND_PURGE)

        try:
            # We use pydub to add 500ms of silence to the beginning of the file.
            # This combats the Windows WASAPI audio device sleep issue, ensuring the
            # DAC wakes up during the silence and plays the actual sound unclipped.
            from pydub import AudioSegment
            
            audio = AudioSegment.from_file(filepath)
            silence = AudioSegment.silent(duration=500)
            padded_audio = silence + audio
            
            padded_audio.export(dest, format="wav")
            print(f"[Audio Processing] Added 500ms silence and exported to {filename}")
        except Exception as e:
            print(f"[Sound Copy/Padding Error] {e}")
            # Fallback to pure copy if pydub fails
            try:
                if os.path.normpath(filepath) != os.path.normpath(dest):
                    shutil.copy2(filepath, dest)
            except Exception as copy_error:
                print(f"[Sound Copy] {copy_error}")
                
        return filename

    # ── Window Management ─────────────────────────────────────────

    def open_config_window(self):
        """Open the configuration window (or focus it if already open)."""
        global config_window
        if config_window:
            try:
                config_window.show()
                config_window.on_top = True
                time.sleep(0.1)
                config_window.on_top = False
            except:
                config_window = None

        if not config_window:
            config_window = webview.create_window(
                title="Configuration",
                url=os.path.join(UI_DIR, "config.html"),
                js_api=TimerAPI.__instance,
                width=640,
                height=700,
                min_size=(400, 400),
                frameless=False,
                easy_drag=False,
                on_top=False,
                resizable=True,
                background_color="#0a0a0f",
            )
            def on_config_closed():
                global config_window
                config_window = None
            config_window.events.closed += on_config_closed

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
            display_window.resize(400, 60)

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
        width=400,
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
        display_window.resize(400, 60)

    # Force Qt backend
    webview.start(on_start, debug=False, gui='qt')


if __name__ == "__main__":
    main()
