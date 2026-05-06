"""Biometric attendance integration.

Phase 0 ships the data ingest schema and adapters. Phase 4 (Attendance module)
wires it to actual `AttendanceRecord` entries.

Common Indian biometric device families:
  - eSSL (X990, K90, eTimeTrackLite cloud)  → push-API CSV or pyzk over TCP
  - Matrix (COSEC NGT, COSEC ARGO)          → REST API
  - Realtime (T502)                         → pyzk
  - ZKTeco                                  → pyzk

We standardise all device output into a `PunchEvent` dict, then route to
attendance.tasks for processing.
"""
from __future__ import annotations
import csv
import io
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable, Literal


@dataclass
class PunchEvent:
    """Normalised punch record from any biometric device."""
    employee_code: str            # employee_id mapped from device template
    device_id: str                # MAC / serial of the device
    timestamp: datetime
    direction: Literal["IN", "OUT", "UNKNOWN"] = "UNKNOWN"
    method: Literal["FINGER", "FACE", "CARD", "PIN", "PALM"] = "FINGER"
    raw: dict = field(default_factory=dict)


# ─── eSSL / ZKTeco style CSV (pulled hourly from device or eTimeTrackLite) ────

def parse_essl_csv(content: str) -> list[PunchEvent]:
    """eSSL/ZKTeco CSV: enrollno,name,date,time,InOutMode,terminalid,...
    Headers vary by firmware - this handles the common 3-col format.
    """
    events: list[PunchEvent] = []
    reader = csv.reader(io.StringIO(content))
    for row in reader:
        if not row or len(row) < 3:
            continue
        # Skip header
        if row[0].lower() in ("enrollno", "userid", "user_id", "employee_id"):
            continue
        try:
            emp = row[0].strip()
            ts = _parse_datetime(row[1].strip(), row[2].strip() if len(row) > 2 else "00:00:00")
            mode = (row[3].strip().upper() if len(row) > 3 else "")
            direction: Literal["IN", "OUT", "UNKNOWN"] = (
                "IN" if mode in ("0", "I", "IN", "CHECK-IN") else
                "OUT" if mode in ("1", "O", "OUT", "CHECK-OUT") else
                "UNKNOWN"
            )
            device = row[5].strip() if len(row) > 5 else "ESSL_UNKNOWN"
            events.append(PunchEvent(
                employee_code=emp, device_id=device,
                timestamp=ts, direction=direction,
                raw={"row": row},
            ))
        except Exception:
            continue
    return events


def _parse_datetime(date_str: str, time_str: str) -> datetime:
    """Tries common DD-MM-YYYY / YYYY-MM-DD formats."""
    for date_fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d"):
        for time_fmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(f"{date_str} {time_str}", f"{date_fmt} {time_fmt}")
            except ValueError:
                continue
    raise ValueError(f"Unable to parse datetime: {date_str!r} {time_str!r}")


# ─── Matrix COSEC REST payload ─────────────────────────────

def parse_matrix_payload(payload: dict) -> list[PunchEvent]:
    """Matrix COSEC pushes JSON to a configured webhook. Format:
    {
      "events": [
        {"userId":"E101","timestamp":"2025-05-06T09:14:22","direction":"IN",
         "deviceId":"COSEC-NGT-001","authMethod":"FINGER"}, ...
      ]
    }
    """
    events: list[PunchEvent] = []
    for e in payload.get("events", []):
        try:
            events.append(PunchEvent(
                employee_code=str(e["userId"]),
                device_id=str(e.get("deviceId", "MATRIX_UNKNOWN")),
                timestamp=datetime.fromisoformat(e["timestamp"]),
                direction=e.get("direction", "UNKNOWN").upper(),  # type: ignore
                method=e.get("authMethod", "FINGER").upper(),     # type: ignore
                raw=e,
            ))
        except Exception:
            continue
    return events


# ─── pyzk live polling adapter (ZKTeco / eSSL TCP) ─────────

def fetch_zk_punches(host: str, port: int = 4370, timeout: int = 10) -> list[PunchEvent]:
    """Polls a ZKTeco/eSSL device over TCP using pyzk.
    Requires `pip install pyzk`. Returns punches and clears device buffer.
    """
    try:
        from zk import ZK  # type: ignore
    except ImportError as e:
        raise RuntimeError("pyzk not installed; pip install pyzk") from e

    events: list[PunchEvent] = []
    zk = ZK(host, port=port, timeout=timeout)
    conn = zk.connect()
    try:
        for att in conn.get_attendance():
            events.append(PunchEvent(
                employee_code=str(att.user_id),
                device_id=f"{host}:{port}",
                timestamp=att.timestamp,
                direction="IN" if att.punch == 0 else "OUT" if att.punch == 1 else "UNKNOWN",
                raw={"status": att.status, "punch": att.punch},
            ))
        # Optional: clear after successful fetch
        # conn.clear_attendance()
    finally:
        conn.disconnect()
    return events


# ─── Apply to AttendanceRecord (Phase 4) ───────────────────

def ingest_punches(events: Iterable[PunchEvent], *, hospital, dry_run: bool = True) -> dict:
    """Inserts punches into the AttendanceRecord model (when Phase 4 ships).
    Phase 0: dry-run only — counts matches per employee_code. Phase 4 will
    replace the body with real DB writes.
    """
    summary: dict = {"total": 0, "matched": 0, "unmatched_codes": set(), "errors": 0}
    User = None
    if not dry_run:
        from apps.accounts.models import User as _User
        User = _User
    for ev in events:
        summary["total"] += 1
        if dry_run:
            continue
        user = User.objects.filter(hospital=hospital, employee_code=ev.employee_code).first()
        if not user:
            summary["unmatched_codes"].add(ev.employee_code)
            continue
        # Phase 4: AttendanceRecord.objects.create(...)
        summary["matched"] += 1
    summary["unmatched_codes"] = sorted(summary["unmatched_codes"])
    return summary
