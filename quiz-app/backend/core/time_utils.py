from datetime import datetime
import pytz

def get_current_utc_time():
    """Standardizes current time to UTC"""
    return datetime.now(pytz.utc)

def get_current_iso_week() -> str:
    """Returns absolute current ISO week identifier, e.g., '2024-W51' (based on system time)"""
    now = datetime.now()
    iso_cal = now.isocalendar()
    # Use iso_cal[0] (ISO year) not now.year, because Dec 31 may belong to Week 1 of next year
    return f"{iso_cal[0]}-W{iso_cal[1]:02d}"
