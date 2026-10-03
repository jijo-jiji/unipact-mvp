"""Working-day arithmetic for the deadlines in the client and talent agreements.

A working day is Monday to Friday in Malaysian time. Public holidays are not excluded, so a deadline that
spans one falls a day earlier than a strict reading would give: the client or UniPact simply has one day less.
"""
from datetime import timedelta
from zoneinfo import ZoneInfo

MALAYSIA = ZoneInfo('Asia/Kuala_Lumpur')


def add_working_days(start, days):
    """The moment `days` working days after `start`, at the same local time of day. A start on a weekend
    counts from the following Monday."""
    current = start.astimezone(MALAYSIA)
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:
            remaining -= 1
    return current
