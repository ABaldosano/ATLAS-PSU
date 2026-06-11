"""
ATLAS PSU - solver/constraints.py
Hard constraint definitions and validation utilities.
All schedule generation must satisfy every constraint in this module.
"""

from config.settings import SPECIALIZATION_MAP, ROOM_CAPACITY
import config.settings as _settings

# Runtime room capacity — overrides ROOM_CAPACITY when set via set_runtime_room_capacity()
_runtime_room_capacity: dict = {}

# UNITS_PER_ASSIGNMENT is read dynamically from config.settings so route overrides propagate
def _get_upa():
    return getattr(_settings, 'UNITS_PER_ASSIGNMENT', 2)

# Module-level alias kept for imports elsewhere; always reads live value
# UNITS_PER_ASSIGNMENT accessed via _settings.UNITS_PER_ASSIGNMENT below


def set_runtime_room_capacity(capacity: dict) -> None:
    """Replace runtime room capacity with values received from the frontend."""
    global _runtime_room_capacity
    _runtime_room_capacity = {k: v for k, v in capacity.items() if isinstance(v, dict)}


# ── Qualification ─────────────────────────────────────────────────────────────

def get_required_specs(subject_name: str, static_lookup: dict) -> list:
    return static_lookup.get(subject_name, SPECIALIZATION_MAP.get(subject_name, []))


def faculty_qualifies(faculty: dict, subject_name: str, static_lookup: dict) -> bool:
    if subject_name.startswith("IT Elective"):
        return True
    required = get_required_specs(subject_name, static_lookup)
    if "Elective" in required and not any(
        s for s in required if s != "Elective"
    ):
        return True  # open assignment — any faculty qualifies
    if "Elective" in required:
        fac_specs = faculty.get("specialization", [])
        primary = [s for s in required if s != "Elective"]
        return any(spec in fac_specs for spec in primary) or True
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
    return current_units + _settings.UNITS_PER_ASSIGNMENT <= faculty.get("absolute_max_units", 30)


# ── Room Compatibility ────────────────────────────────────────────────────────

def room_compatible(room_name: str, class_type: str, lab_rooms: list) -> bool:
    if class_type == "LAB":
        return room_name in lab_rooms
    return True


# ── Room Capacity ─────────────────────────────────────────────────────────────

def get_room_capacity(room_name: str) -> dict:
    """Return capacity config for a room. Runtime values take precedence over defaults."""
    if _runtime_room_capacity:
        cap = _runtime_room_capacity.get(room_name)
        if cap:
            return cap
    return ROOM_CAPACITY.get(room_name, {"recommended": 9999, "max": 9999})


def room_exceeds_hard_max(room_name: str, student_count: int) -> bool:
    """
    Hard constraint: True if student_count exceeds the room's absolute maximum.
    This prevents assignment entirely.
    """
    if student_count <= 0:
        return False
    cap = get_room_capacity(room_name)
    return student_count > cap.get("max", 9999)


def room_capacity_penalty(room_name: str, student_count: int) -> float:
    """
    Tiered penalty score for room capacity violations (negative = penalty).
    Returns 0.0 if within recommended capacity.
    Returns negative penalty if over recommended but under hard max.
    Should not be called when room_exceeds_hard_max is True.
    """
    if student_count <= 0:
        return 0.0

    cap = get_room_capacity(room_name)
    recommended = cap.get("recommended", 9999)

    if student_count <= recommended:
        return 0.0  # No penalty — fits comfortably

    tiers = cap.get("tiers")
    if tiers:
        # Tiered penalty: find applicable tier
        penalty = 0.0
        prev_threshold = recommended
        sorted_tiers = sorted(tiers, key=lambda t: t[0])
        for threshold, rate in sorted_tiers:
            if student_count >= threshold:
                # Students in this band
                band_start = max(prev_threshold + 1, threshold)
                band_end = student_count
                # Next tier threshold or student_count
                next_thresholds = [t[0] for t in sorted_tiers if t[0] > threshold]
                if next_thresholds:
                    band_end = min(student_count, next_thresholds[0] - 1)
                students_in_band = max(0, band_end - band_start + 1)
                penalty += students_in_band * rate
                prev_threshold = threshold
        # Remaining students above last tier threshold
        last_threshold, last_rate = sorted_tiers[-1]
        if student_count > last_threshold:
            students_above = student_count - max(prev_threshold, last_threshold)
            if students_above > 0:
                penalty += students_above * last_rate
        return -penalty
    else:
        # Default: flat penalty per student over recommended
        from config.settings import CAPACITY_OVER_PENALTY_PER_STUDENT
        over = student_count - recommended
        return -(over * CAPACITY_OVER_PENALTY_PER_STUDENT)


def room_capacity_score(room_name: str, student_count: int) -> float:
    """
    Combined capacity score for use in fitness/objective functions.
    Positive bonus when at or under recommended; negative penalty when over.
    """
    if student_count <= 0:
        return 0.0

    cap = get_room_capacity(room_name)
    recommended = cap.get("recommended", 9999)

    if student_count <= recommended:
        from config.settings import CAPACITY_FIT_BONUS
        return CAPACITY_FIT_BONUS  # flat fit bonus
    else:
        return room_capacity_penalty(room_name, student_count)


def room_fits_students(room_name: str, student_count: int) -> bool:
    """True if room can physically accommodate the students (not over hard max)."""
    return not room_exceeds_hard_max(room_name, student_count)


# ── Building helpers ──────────────────────────────────────────────────────────

def get_building(room_name: str) -> str:
    """
    Extract the logical building group from a room name.
    Used for per-day building affinity and section clustering.
    Scalable: any future room name maps to itself as its own building.
    """
    r = room_name.strip()
    if r.startswith("GA Bldg"):  return "GA Bldg"
    if r.startswith("IT Room"):  return "IT Room"
    if r.startswith("CL"):       return "CL"
    if r.startswith("MTC"):      return "MTC"
    if r.startswith("NIT"):      return "NIT"
    return r  # fallback — handles future rooms gracefully


def rank_rooms_by_capacity_fit(room_pool: list, student_count: int) -> list:
    """
    Sort rooms by best fit for the given student count.
    Prefers rooms where student_count <= recommended.
    Among those, prefers tightest fit (smallest recommended >= student_count).
    Excludes rooms where student_count > max (hard constraint).
    """
    if student_count <= 0:
        return list(room_pool)

    eligible = [r for r in room_pool if not room_exceeds_hard_max(r, student_count)]

    def fit_key(room_name: str):
        cap = get_room_capacity(room_name)
        recommended = cap.get("recommended", 9999)
        max_cap = cap.get("max", 9999)
        over = max(0, student_count - recommended)
        # Primary: over_recommended (0 = fits); Secondary: tightest recommended >= student_count
        gap = recommended - student_count if student_count <= recommended else -recommended
        return (over, gap)

    return sorted(eligible, key=fit_key)


# ── Schedule Validator ────────────────────────────────────────────────────────

def validate_schedule(assignments: list, faculty_list: list, static_lookup: dict,
                       lab_rooms: list, class_sizes: dict = None) -> list:
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

        # Room capacity (hard max violation)
        if class_sizes:
            section_key = a.get("section", "")
            student_count = class_sizes.get(section_key, {}).get("size", 0) if isinstance(
                class_sizes.get(section_key), dict) else 0
            if student_count > 0 and room_exceeds_hard_max(a["room"], student_count):
                cap = get_room_capacity(a["room"])
                violations.append(
                    f"CAPACITY_EXCEEDED: {a['room']} (max {cap.get('max')}) cannot fit "
                    f"{student_count} students for {label}"
                )

        fac_load[a["faculty"]] = fac_load.get(a["faculty"], 0) + _settings.UNITS_PER_ASSIGNMENT

    # Load caps
    for f in faculty_list:
        load = fac_load.get(f["name"], 0)
        if load > f.get("absolute_max_units", 30):
            violations.append(f"OVERLOAD: {f['name']} assigned {load} > {f['absolute_max_units']}")

    return violations