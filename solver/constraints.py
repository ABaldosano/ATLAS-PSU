"""
ATLAS PSU - solver/constraints.py
Hard constraint definitions and validation utilities.
All schedule generation must satisfy every constraint in this module.
"""

from config.settings import SPECIALIZATION_MAP, UNITS_PER_ASSIGNMENT


# ── Qualification ─────────────────────────────────────────────────────────────

def get_required_specs(subject_name: str, static_lookup: dict) -> list:
    return static_lookup.get(subject_name, SPECIALIZATION_MAP.get(subject_name, []))


def faculty_qualifies(faculty: dict, subject_name: str, static_lookup: dict) -> bool:
    """True if faculty can teach this subject (specialization match or elective)."""
    if subject_name.startswith("IT Elective"):
        return True
    required = get_required_specs(subject_name, static_lookup)
    if not required:
        return True
    return any(spec in faculty.get("specialization", []) for spec in required)


def is_exact_spec_match(faculty: dict, subject_name: str, static_lookup: dict) -> bool:
    required = get_required_specs(subject_name, static_lookup)
    if not required:
        return True
    return any(spec in faculty.get("specialization", []) for spec in required)


# ── Availability ──────────────────────────────────────────────────────────────

def slot_day(slot_str: str) -> str:
    try:
        return slot_str.split(":")[0].strip()
    except Exception:
        return ""


def faculty_available_at(faculty: dict, slot_str: str) -> bool:
    return slot_day(slot_str) in faculty.get("availability", [])


# ── Load ──────────────────────────────────────────────────────────────────────

def faculty_load_ok(current_units: int, faculty: dict) -> bool:
    return current_units + UNITS_PER_ASSIGNMENT <= faculty.get("absolute_max_units", 30)


# ── Room Compatibility ────────────────────────────────────────────────────────

def room_compatible(room_name: str, class_type: str, lab_rooms: list) -> bool:
    if class_type == "LAB":
        return room_name in lab_rooms
    return True


# ── Schedule Validator ────────────────────────────────────────────────────────

def validate_schedule(assignments: list, faculty_list: list, static_lookup: dict,
                       lab_rooms: list) -> list:
    """
    Returns list of violation strings.
    Empty list = fully valid schedule.
    """
    violations = []
    fac_map = {f["name"]: f for f in faculty_list}

    # Track occupancy
    fac_slot: dict = {}     # (faculty, slot) → subject+section
    room_slot: dict = {}    # (room, slot) → subject+section
    fac_load: dict = {f["name"]: 0 for f in faculty_list}

    for a in assignments:
        key = f"{a['faculty']}|{a['slot']}"
        room_key = f"{a['room']}|{a['slot']}"
        label = f"{a['subject']}({a['section']})"

        # No faculty double-booking
        if key in fac_slot:
            violations.append(f"FACULTY_OVERLAP: {a['faculty']} at {a['slot']}: {fac_slot[key]} vs {label}")
        else:
            fac_slot[key] = label

        # No room conflict
        if room_key in room_slot:
            violations.append(f"ROOM_CONFLICT: {a['room']} at {a['slot']}: {room_slot[room_key]} vs {label}")
        else:
            room_slot[room_key] = label

        fac = fac_map.get(a["faculty"])
        if not fac:
            violations.append(f"UNKNOWN_FACULTY: {a['faculty']}")
            continue

        # Availability
        if not faculty_available_at(fac, a["slot"]):
            violations.append(f"UNAVAILABLE: {a['faculty']} not available {a['slot']}")

        # Qualification
        if not faculty_qualifies(fac, a["subject"], static_lookup):
            violations.append(f"UNQUALIFIED: {a['faculty']} → {a['subject']}")

        # Room compatibility
        if not room_compatible(a["room"], a["class_type"], lab_rooms):
            violations.append(f"ROOM_INCOMPATIBLE: {a['room']} for {a['class_type']} class {label}")

        fac_load[a["faculty"]] = fac_load.get(a["faculty"], 0) + UNITS_PER_ASSIGNMENT

    # Load caps
    for f in faculty_list:
        load = fac_load.get(f["name"], 0)
        if load > f.get("absolute_max_units", 30):
            violations.append(f"OVERLOAD: {f['name']} assigned {load} > {f['absolute_max_units']}")

    return violations
