"""ATLAS PSU - models/room.py"""
from dataclasses import dataclass


@dataclass
class Room:
    name: str
    room_type: str = "LECTURE"    # LECTURE | LAB

    def compatible_with(self, class_type: str) -> bool:
        if class_type == "LAB":
            return self.room_type == "LAB"
        return True  # LECTURE class can use any room

    def to_dict(self) -> dict:
        return {"name": self.name, "room_type": self.room_type}
