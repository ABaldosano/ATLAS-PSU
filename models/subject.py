"""ATLAS PSU - models/subject.py"""
from dataclasses import dataclass


@dataclass
class Subject:
    name: str
    type: str = "Core Theory"
    class_type: str = "LECTURE"   # LECTURE | LAB
    hours: int = 2
    semester: str = ""
    year: str = ""
    section: str = ""

    @classmethod
    def from_dict(cls, d: dict) -> "Subject":
        return cls(
            name=d.get("name", ""),
            type=d.get("type", "Core Theory"),
            class_type=d.get("class_type", "LECTURE"),
            hours=int(d.get("hours", 2)),
            semester=d.get("semester", ""),
            year=d.get("year", ""),
            section=d.get("section", ""),
        )

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.type,
            "class_type": self.class_type,
            "hours": self.hours,
            "semester": self.semester,
            "year": self.year,
            "section": self.section,
        }
