"""Meeting Speaker Timer — State Machine, History, Tiered Cost & JSON Config."""

import time
import csv
import io
import os
import json
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional


CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "config.json"
)


class Phase(str, Enum):
    IDLE = "idle"
    COUNTDOWN = "countdown"
    WARNING = "warning"
    OVERTIME = "overtime"
    COLLECTING = "collecting"
    THANKYOU = "thankyou"


@dataclass
class CostTier:
    threshold_mins: float  # overtime minutes where this tier starts (0 = first tier)
    rate_amount: float     # ¥ per tick
    rate_interval: int     # seconds per tick

    def to_dict(self):
        return {
            "threshold_mins": self.threshold_mins,
            "rate_amount": self.rate_amount,
            "rate_interval": self.rate_interval,
        }

    @staticmethod
    def from_dict(d):
        return CostTier(
            threshold_mins=float(d.get("threshold_mins", 0)),
            rate_amount=float(d.get("rate_amount", 5)),
            rate_interval=int(d.get("rate_interval", 5)),
        )


@dataclass
class SpeakerRecord:
    name: str
    allocated_seconds: int
    tiers: list = field(default_factory=list)
    max_cost: float = 2500.0
    actual_seconds: float = 0
    overtime_seconds: float = 0
    cost: float = 0
    time_added: int = 0
    start_dt: str = ""
    end_dt: str = ""


class TimerEngine:
    WARNING_THRESHOLD = 30  # seconds before end for visual warning

    def __init__(self):
        self.phase = Phase.IDLE
        self.speaker_name = ""
        self.allocated_seconds = 0
        self.time_added = 0
        self.start_time: Optional[float] = None
        self.overtime_start: Optional[float] = None
        self.history: list[SpeakerRecord] = []
        self._current_record: Optional[SpeakerRecord] = None

        # Tiered cost config
        self.tiers: list[CostTier] = [CostTier(0, 5.0, 5)]
        self.max_cost: float = 2500.0

        # Alarm thresholds (seconds remaining)
        self.alarm_threshold_1: float = 300  # 5 minutes
        self.alarm_threshold_2: float = 60   # 1 minute
        self._alarm_1_fired: bool = False
        self._alarm_2_fired: bool = False

        # Quote & Speaker list
        self.quote: str = ""
        self.speakers: list[dict] = []  # [{name, time_secs, words}]
        self._next_speaker_index: int = 0

        # Export folder
        self._export_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "exports"
        )

        # Load saved config
        self._load_config()

    # ── Config Persistence ────────────────────────────────────────

    def _load_config(self):
        if not os.path.exists(CONFIG_PATH):
            return
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "tiers" in data:
                self.tiers = [CostTier.from_dict(t) for t in data["tiers"]]
            if "max_cost" in data:
                self.max_cost = float(data["max_cost"])
            if "alarm_threshold_1" in data:
                self.alarm_threshold_1 = float(data["alarm_threshold_1"])
            if "alarm_threshold_2" in data:
                self.alarm_threshold_2 = float(data["alarm_threshold_2"])
            if "quote" in data:
                self.quote = str(data["quote"])
            if "speakers" in data:
                self.speakers = list(data["speakers"])
        except Exception as e:
            print(f"[timer] Failed to load config: {e}")

    def save_config(self, tiers_data: list, max_cost: float,
                    alarm_1: float, alarm_2: float):
        """Save tier config + alarm thresholds to JSON and update in-memory."""
        self.tiers = [CostTier.from_dict(t) for t in tiers_data]
        self.max_cost = max_cost
        self.alarm_threshold_1 = alarm_1
        self.alarm_threshold_2 = alarm_2

        data = {
            "tiers": [t.to_dict() for t in self.tiers],
            "max_cost": self.max_cost,
            "alarm_threshold_1": self.alarm_threshold_1,
            "alarm_threshold_2": self.alarm_threshold_2,
            "quote": self.quote,
            "speakers": self.speakers,
        }
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[timer] Failed to save config: {e}")

    def get_config(self) -> dict:
        return {
            "tiers": [t.to_dict() for t in self.tiers],
            "max_cost": self.max_cost,
            "alarm_threshold_1": self.alarm_threshold_1,
            "alarm_threshold_2": self.alarm_threshold_2,
            "quote": self.quote,
            "speakers": self.speakers,
        }

    # ── Quote ─────────────────────────────────────────────────────

    def set_quote(self, text: str):
        self.quote = text
        self._persist_config()

    # ── Speakers List ─────────────────────────────────────────────

    def get_speakers(self) -> list:
        return self.speakers

    def set_speakers(self, speakers_data: list):
        self.speakers = speakers_data
        self._next_speaker_index = 0
        self._persist_config()

    def load_next_speaker(self) -> dict:
        """Return the next speaker from the list and advance the index."""
        if not self.speakers:
            return {}
        if self._next_speaker_index >= len(self.speakers):
            self._next_speaker_index = 0
        speaker = self.speakers[self._next_speaker_index]
        self._next_speaker_index += 1
        # Use speaker's words as the animation quote
        if speaker.get("words"):
            self.quote = speaker["words"]
        return speaker

    def import_speakers_from_excel(self, filepath: str) -> list:
        """Read speakers from an Excel file. Columns: Speaker Name, time in secs, words."""
        try:
            from openpyxl import load_workbook
        except ImportError:
            print("[timer] openpyxl not installed")
            return []

        try:
            wb = load_workbook(filepath, read_only=True, data_only=True)
            ws = wb.active
            speakers = []
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                if not row or len(row) < 2:
                    continue
                name = str(row[0] or "").strip()
                if not name:
                    continue
                time_secs = 0
                try:
                    time_secs = int(float(row[1] or 0))
                except (ValueError, TypeError):
                    pass
                words = str(row[2] or "").strip() if len(row) > 2 else ""
                speakers.append({
                    "name": name,
                    "time_secs": time_secs,
                    "words": words,
                })
            wb.close()
            self.speakers = speakers
            self._next_speaker_index = 0
            self._persist_config()
            return speakers
        except Exception as e:
            print(f"[timer] Failed to import Excel: {e}")
            return []

    def _persist_config(self):
        """Helper to persist current config to disk."""
        data = {
            "tiers": [t.to_dict() for t in self.tiers],
            "max_cost": self.max_cost,
            "alarm_threshold_1": self.alarm_threshold_1,
            "alarm_threshold_2": self.alarm_threshold_2,
            "quote": self.quote,
            "speakers": self.speakers,
        }
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[timer] Failed to save config: {e}")

    # ── Timer Control ─────────────────────────────────────────────

    def configure(self, speaker: str, minutes: float, seconds: float):
        self.speaker_name = speaker
        self.allocated_seconds = minutes * 60 + seconds

    def start(self):
        if self.phase != Phase.IDLE:
            return
        self.phase = Phase.COUNTDOWN
        self.start_time = time.time()
        self.overtime_start = None
        self.time_added = 0
        self._alarm_1_fired = False
        self._alarm_2_fired = False
        self._current_record = SpeakerRecord(
            name=self.speaker_name,
            allocated_seconds=self.allocated_seconds,
            tiers=[t.to_dict() for t in self.tiers],
            max_cost=self.max_cost,
            start_dt=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )

    def stop(self):
        if self.phase in (Phase.IDLE, Phase.COLLECTING, Phase.THANKYOU):
            return
        state = self.get_state()
        self.phase = Phase.COLLECTING
        if self._current_record:
            self._current_record.actual_seconds = state["elapsed"]
            self._current_record.overtime_seconds = state["overtime_seconds"]
            self._current_record.cost = state["cost"]
            self._current_record.time_added = self.time_added
            self._current_record.end_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def finish_animation(self):
        if self.phase != Phase.COLLECTING:
            return
        self.phase = Phase.THANKYOU

    def next_speaker(self):
        if self._current_record and self.phase in (Phase.THANKYOU, Phase.COLLECTING):
            self.history.append(self._current_record)
            self._export_to_excel(self._current_record)
        self.phase = Phase.IDLE
        self.speaker_name = ""
        self.start_time = None
        self.overtime_start = None
        self.time_added = 0
        self._current_record = None
        self._alarm_1_fired = False
        self._alarm_2_fired = False

    def add_time(self, seconds: float):
        """Add time to running timer. Can revert WARNING→COUNTDOWN."""
        if self.phase in (Phase.IDLE, Phase.COLLECTING, Phase.THANKYOU):
            return
        self.allocated_seconds += seconds
        self.time_added += seconds

        # Recalculate: if we're in warning/overtime but now have enough time,
        # revert phase
        now = time.time()
        elapsed = (now - self.start_time) if self.start_time else 0
        remaining = self.allocated_seconds - elapsed

        if remaining > self.WARNING_THRESHOLD:
            if self.phase in (Phase.WARNING, Phase.OVERTIME):
                self.phase = Phase.COUNTDOWN
                self.overtime_start = None
        elif remaining > 0:
            if self.phase == Phase.OVERTIME:
                self.phase = Phase.WARNING
                self.overtime_start = None

        # Reset alarm flags if remaining goes back above thresholds
        if remaining > self.alarm_threshold_1:
            self._alarm_1_fired = False
        if remaining > self.alarm_threshold_2:
            self._alarm_2_fired = False

    # ── Tiered Cost Calculation ───────────────────────────────────

    def _compute_cost(self, overtime_seconds: float) -> float:
        if overtime_seconds <= 0 or not self.tiers:
            return 0.0

        # Sort tiers by threshold
        sorted_tiers = sorted(self.tiers, key=lambda t: t.threshold_mins)
        total_cost = 0.0

        for i, tier in enumerate(sorted_tiers):
            tier_start_secs = tier.threshold_mins * 60
            if i + 1 < len(sorted_tiers):
                tier_end_secs = sorted_tiers[i + 1].threshold_mins * 60
            else:
                tier_end_secs = float("inf")

            if overtime_seconds <= tier_start_secs:
                break

            effective_end = min(overtime_seconds, tier_end_secs)
            duration_in_tier = effective_end - tier_start_secs

            if duration_in_tier > 0 and tier.rate_interval > 0:
                ticks = duration_in_tier / tier.rate_interval
                total_cost += ticks * tier.rate_amount

        return min(total_cost, self.max_cost)

    # ── Excel Auto-Export ─────────────────────────────────────────

    def _export_to_excel(self, record: SpeakerRecord):
        try:
            from openpyxl import Workbook, load_workbook
            from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        except ImportError:
            print("[timer] openpyxl not installed — skipping Excel export")
            return

        os.makedirs(self._export_dir, exist_ok=True)

        filename = datetime.now().strftime("%Y%m%d") + ".xlsx"
        filepath = os.path.join(self._export_dir, filename)

        headers = [
            "Speaker",
            "Allocated Time",
            "Time Added",
            "Cost Tiers",
            "Actual Duration",
            "Start Time",
            "End Time",
            "Amount Due (￥)",
        ]

        am, as_ = divmod(int(record.actual_seconds), 60)
        m, s = divmod(int(record.allocated_seconds), 60)

        # Format tiers for display
        tier_strs = []
        for t in (record.tiers if record.tiers else []):
            if isinstance(t, dict):
                tier_strs.append(
                    f">{t.get('threshold_mins', 0)}min: "
                    f"￥{t.get('rate_amount', 0)}/{t.get('rate_interval', 5)}s"
                )
        tier_display = " | ".join(tier_strs) if tier_strs else "N/A"

        added_m, added_s = divmod(int(record.time_added), 60)

        row = [
            record.name,
            f"{m:02d}:{s:02d}",
            f"+{added_m:02d}:{added_s:02d}" if record.time_added else "—",
            tier_display,
            f"{am:02d}:{as_:02d}",
            record.start_dt,
            record.end_dt,
            f"￥{record.cost:.2f}",
        ]

        if os.path.exists(filepath):
            wb = load_workbook(filepath)
            ws = wb.active
        else:
            wb = Workbook()
            ws = wb.active
            ws.title = "Meeting Log"

            header_font = Font(name="Inter", bold=True, size=11, color="FFFFFF")
            header_fill = PatternFill(start_color="1a1a2e", end_color="1a1a2e", fill_type="solid")
            header_align = Alignment(horizontal="center", vertical="center")
            thin_border = Border(
                bottom=Side(style="thin", color="333333")
            )

            for col_idx, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col_idx, value=header)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_align
                cell.border = thin_border

            widths = [18, 16, 14, 30, 16, 22, 22, 18]
            for i, w in enumerate(widths, 1):
                ws.column_dimensions[chr(64 + i)].width = w

        ws.append(row)
        wb.save(filepath)

    # ── State ─────────────────────────────────────────────────────

    def get_state(self) -> dict:
        now = time.time()
        elapsed = (now - self.start_time) if self.start_time else 0
        remaining = max(0, self.allocated_seconds - elapsed)

        # Auto-transition countdown → warning → overtime
        if self.phase == Phase.COUNTDOWN and remaining <= self.WARNING_THRESHOLD:
            self.phase = Phase.WARNING
        if self.phase == Phase.WARNING and remaining <= 0:
            self.phase = Phase.OVERTIME
            self.overtime_start = now - (elapsed - self.allocated_seconds)

        # Alarm triggers (one-shot)
        # Skip alarm if threshold >= allocated time (entire meeting is shorter
        # than the warning window, so the alarm would fire immediately).
        alarm_1_trigger = False
        alarm_2_trigger = False
        if self.phase in (Phase.COUNTDOWN, Phase.WARNING):
            if (self.alarm_threshold_1 < self.allocated_seconds
                    and not self._alarm_1_fired
                    and remaining <= self.alarm_threshold_1):
                self._alarm_1_fired = True
                alarm_1_trigger = True
            if (self.alarm_threshold_2 < self.allocated_seconds
                    and not self._alarm_2_fired
                    and remaining <= self.alarm_threshold_2):
                self._alarm_2_fired = True
                alarm_2_trigger = True

        overtime_seconds = 0.0
        cost = 0.0
        if self.phase == Phase.OVERTIME and self.overtime_start:
            overtime_seconds = now - self.overtime_start
            cost = self._compute_cost(overtime_seconds)
        elif self.phase in (Phase.COLLECTING, Phase.THANKYOU) and self._current_record:
            overtime_seconds = self._current_record.overtime_seconds
            cost = self._current_record.cost

        minutes_r, seconds_r = divmod(int(remaining), 60)

        return {
            "phase": self.phase.value,
            "speaker": self.speaker_name,
            "allocated": self.allocated_seconds,
            "elapsed": round(elapsed, 1),
            "remaining": round(remaining, 1),
            "remaining_display": f"{minutes_r:02d}:{seconds_r:02d}",
            "overtime_seconds": round(overtime_seconds, 1),
            "cost": round(cost, 2),
            "progress": min(1.0, elapsed / self.allocated_seconds) if self.allocated_seconds > 0 else 0,
            "time_added": self.time_added,
            "alarm_1": alarm_1_trigger,
            "alarm_2": alarm_2_trigger,
            "quote": self.quote,
        }

    def get_history(self) -> list[dict]:
        records = []
        for r in self.history:
            m, s = divmod(int(r.allocated_seconds), 60)
            am, as_ = divmod(int(r.actual_seconds), 60)
            records.append({
                "name": r.name,
                "allocated": f"{m:02d}:{s:02d}",
                "actual": f"{am:02d}:{as_:02d}",
                "overtime": round(r.overtime_seconds, 1),
                "cost": round(r.cost, 2),
                "time_added": r.time_added,
            })
        return records

    def export_csv(self) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Speaker", "Allocated", "Actual", "Time Added (s)",
                         "Overtime (s)", "Cost (￥)"])
        for r in self.history:
            m, s = divmod(int(r.allocated_seconds), 60)
            am, as_ = divmod(int(r.actual_seconds), 60)
            writer.writerow([
                r.name,
                f"{m:02d}:{s:02d}",
                f"{am:02d}:{as_:02d}",
                r.time_added,
                round(r.overtime_seconds, 1),
                round(r.cost, 2),
            ])
        return output.getvalue()
