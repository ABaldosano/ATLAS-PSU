"""ATLAS PSU - models/schedule.py"""
from dataclasses import dataclass


@dataclass
class Assignment:
    faculty: str
    subject: str
    type: str
    class_type: str
    slot: str          # "Mon: 07:00-09:00"
    slot_display: str  # "Mon: 7:00 AM - 9:00 AM"
    semester: str
    year: str
    section: str
    room: str

    def to_dict(self) -> dict:
        return {
            "faculty":      self.faculty,
            "subject":      self.subject,
            "type":         self.type,
            "class_type":   self.class_type,
            "slot":         self.slot,
            "slot_display": self.slot_display,
            "semester":     self.semester,
            "year":         self.year,
            "section":      self.section,
            "room":         self.room,
        }
