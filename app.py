"""Meeting Speaker Timer — PyWebView Desktop App (Dual-Window)."""

import os
import sys
import shutil
import ctypes

# Tell Windows this is its own app (not "python.exe") so the taskbar
# shows our custom icon instead of Python's default icon.
try:
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("MeetingTimer.App")
except Exception:
    pass

# Force qtpy to use PySide6, as we only installed PySide6
os.environ["QT_API"] = "pyside6"

import time
import threading
import winsound
import webview

from timer_engine import TimerEngine

# ── Path Resolution (works both as .py script and packaged .exe) ────
if getattr(sys, 'frozen', False):
    RESOURCE_DIR = sys._MEIPASS                          # Bundled read-only assets
    DATA_DIR = os.path.dirname(sys.executable)            # Writable user data (next to .exe)
    SOUNDS_DIR = os.path.join(DATA_DIR, "sounds")         # Uploaded sounds persist here
    IMAGE_DIR = os.path.join(DATA_DIR, "image")           # Uploaded images persist here
else:
    RESOURCE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = RESOURCE_DIR
    SOUNDS_DIR = os.path.join(RESOURCE_DIR, "ui", "sounds")  # Same as before
    IMAGE_DIR = os.path.join(RESOURCE_DIR, "ui", "image")    # Same as before

UI_DIR = os.path.join(RESOURCE_DIR, "ui")

# Keep references to windows
display_window = None
control_window = None
config_window = None


def _sync_user_data():
    """EXE mode: copy user-uploaded files from persistent DATA_DIR into the
    temp _MEIPASS folder so HTML can reference them via relative paths."""
    if not getattr(sys, 'frozen', False):
        return
    for subfolder in ['sounds', 'image']:
        src_dir = os.path.join(DATA_DIR, subfolder)
        dst_dir = os.path.join(UI_DIR, subfolder)
        if not os.path.isdir(src_dir):
            continue
        os.makedirs(dst_dir, exist_ok=True)
        for fname in os.listdir(src_dir):
            src = os.path.join(src_dir, fname)
            dst = os.path.join(dst_dir, fname)
            if os.path.isfile(src) and not os.path.exists(dst):
                try:
                    shutil.copy2(src, dst)
                except Exception as e:
                    print(f"[Sync] Failed to copy {fname}: {e}")


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

    def add_time(self, seconds: float):
        self.engine.add_time(seconds)

    def subtract_time(self, seconds: float):
        self.engine.subtract_time(seconds)

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
        # Check writable DATA_DIR first, then fall back to bundled defaults
        wav_path = os.path.join(SOUNDS_DIR, sound_file)
        if not os.path.exists(wav_path):
            wav_path = os.path.join(RESOURCE_DIR, "ui", "sounds", sound_file)
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

    # ── Quote, Language & Speaker List ──────────────────────────

    def set_quote(self, text: str):
        self.engine.set_quote(text)

    def get_language(self) -> str:
        return self.engine.get_language()

    def set_language(self, lang: str):
        self.engine.set_language(lang)

    def get_speakers(self):
        return self.engine.get_speakers()

    def set_speakers(self, speakers_data: list):
        self.engine.set_speakers(speakers_data)

    def reset_speaker_list(self):
        self.engine.reset_speaker_list()

    def load_next_speaker(self):
        return self.engine.load_next_speaker()

    def load_specific_speaker(self, index: int):
        return self.engine.load_specific_speaker(index)

    def load_previous_speaker(self):
        return self.engine.load_previous_speaker()

    def get_upcoming_speakers(self, count: int = 5):
        return self.engine.get_upcoming_speakers(count)

    def toggle_alarms_enabled(self):
        self.engine.alarms_enabled = not self.engine.alarms_enabled
        self.engine._persist_config()
        return self.engine.alarms_enabled

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

    def generate_excel_template(self):
        """Open save file dialog and generate Excel template."""
        global control_window
        file_types = ('Excel Files (*.xlsx)', 'All Files (*.*)')
        result = control_window.create_file_dialog(
            webview.FileDialog.SAVE,
            file_types=file_types,
            save_filename="speaker_template.xlsx"
        )
        if not result:
            return False
        filepath = result[0] if isinstance(result, (list, tuple)) else result
        if not filepath.lower().endswith('.xlsx'):
            filepath += '.xlsx'
        return self.engine.generate_excel_template(filepath)

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
        dest = os.path.join(IMAGE_DIR, filename)
        os.makedirs(IMAGE_DIR, exist_ok=True)
        try:
            shutil.copy2(filepath, dest)
        except shutil.SameFileError:
            pass
        # EXE mode: also copy into bundled ui/image/ so HTML can find it
        if getattr(sys, 'frozen', False):
            bundled_dest = os.path.join(UI_DIR, "image", filename)
            os.makedirs(os.path.join(UI_DIR, "image"), exist_ok=True)
            try:
                shutil.copy2(filepath, bundled_dest)
            except Exception:
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

        # EXE mode: also copy into bundled ui/sounds/ so fallback path works
        if getattr(sys, 'frozen', False):
            bundled_dest = os.path.join(UI_DIR, "sounds", filename)
            os.makedirs(os.path.join(UI_DIR, "sounds"), exist_ok=True)
            try:
                shutil.copy2(dest, bundled_dest)
            except Exception:
                pass

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
            except Exception:
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
            # Save current size before going fullscreen
            self._saved_width = display_window.width
            self._saved_height = display_window.height
            display_window.toggle_fullscreen()

    def go_floating(self, panel_open=False):
        global display_window
        if display_window:
            display_window.toggle_fullscreen()
            time.sleep(0.4)
            # Restore saved size (or default if never resized)
            w = getattr(self, '_saved_width', 400)
            h = getattr(self, '_saved_height', 60)
            display_window.resize(w, h)

    def move_window(self, dx, dy):
        global display_window
        if display_window:
            display_window.move(int(display_window.x + dx), int(display_window.y + dy))

    def resize_window(self, dw, dh):
        global display_window
        if display_window:
            new_w = max(150, int(display_window.width + dw))
            new_h = max(30, int(display_window.height + dh))
            display_window.resize(new_w, new_h)

    def get_display_size(self):
        global display_window
        if display_window:
            return {"width": display_window.width, "height": display_window.height}
        return {"width": 400, "height": 60}

    def enter_live_mode(self):
        """Switch control window to compact live mode strip."""
        global control_window
        if not control_window:
            return
        # Save current geometry
        self._saved_ctrl_x = control_window.x
        self._saved_ctrl_y = control_window.y
        self._saved_ctrl_w = control_window.width
        self._saved_ctrl_h = control_window.height

        # Set always-on-top
        control_window.on_top = True
        time.sleep(0.05)

        # Resize to compact strip
        control_window.resize(640, 200)
        time.sleep(0.05)

    def exit_live_mode(self):
        """Restore control window from live mode."""
        global control_window
        if not control_window:
            return
        control_window.on_top = False
        w = getattr(self, '_saved_ctrl_w', 700)
        h = getattr(self, '_saved_ctrl_h', 800)
        x = getattr(self, '_saved_ctrl_x', 100)
        y = getattr(self, '_saved_ctrl_y', 100)
        control_window.resize(w, h)
        time.sleep(0.1)
        control_window.move(x, y)


    def set_control_size(self, width, height):
        """Resize control window (for live mode expand/collapse)."""
        global control_window
        if control_window:
            control_window.resize(int(width), int(height))

    def get_control_position(self):
        """Get control window position (for drag)."""
        global control_window
        if control_window:
            return {"x": control_window.x, "y": control_window.y}
        return {"x": 0, "y": 0}

    def set_control_position(self, x, y):
        """Set control window absolute position (for drag)."""
        global control_window
        if control_window:
            control_window.move(int(x), int(y))

    def move_control_window(self, dx, dy):
        """Move control window by delta (for live mode drag)."""
        global control_window
        if control_window:
            control_window.move(int(control_window.x + dx), int(control_window.y + dy))


def main():
    global display_window, control_window

    _sync_user_data()  # Restore user files into bundled dir (EXE mode only)
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
        min_size=(400, 180),
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
    icon_path = os.path.join(RESOURCE_DIR, "app_icon.ico")
    webview.start(on_start, debug=False, gui='qt', icon=icon_path if os.path.exists(icon_path) else None)


if __name__ == "__main__":
    main()
