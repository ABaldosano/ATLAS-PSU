"""ATLAS PSU - models/faculty.py"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class Faculty:
    name: str
    specialization: List[str] = field(default_factory=list)
    max_units: int = 24
    absolute_max_units: int = 30
    availability: List[str] = field(default_factory=list)
    designation: str = ""        # dean | chairperson | coordinator | ""
    research_hours: int = 0      # reserved hours for research

    @classmethod
    def from_dict(cls, d: dict) -> "Faculty":
        return cls(
            name=d.get("name", ""),
            specialization=d.get("specialization", []),
            max_units=int(d.get("max_units", 24)),
            absolute_max_units=int(d.get("absolute_max_units", 30)),
            availability=d.get("availability", []),
            designation=d.get("designation", ""),
            research_hours=int(d.get("research_hours", 0)),
        )

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "specialization": self.specialization,
            "max_units": self.max_units,
            "absolute_max_units": self.absolute_max_units,
            "availability": self.availability,
            "designation": self.designation,
            "research_hours": self.research_hours,
        }
