"""
ATLAS PSU - app.py (Optimized & Secured)
Automated Teaching Load Assignment System
Palawan State University
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import threading
import random
import copy
import time
import requests
from threading import Lock

# ============================================================
# CONFIGURATION
# ============================================================
random.seed(42)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"
OLLAMA_TIMEOUT = 60

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
HOURS = [(7, 9), (9, 11), (13, 15), (15, 17), (17, 19)]
TIME_SLOTS = [(d, h[0], h[1]) for d in DAYS for h in HOURS]

# ============================================================
# ROOM DEFINITIONS
# ============================================================
LECTURE_ROOMS = [
    "CL1", "CL2", "CL3",
    "IT Room 1", "IT Room 2", "IT Room 3",
    "GA Bldg 16", "GA Bldg 17", "GA Bldg 18", "GA Bldg 19", "GA Bldg 20",
    "GA Bldg 21", "GA Bldg 22", "GA Bldg 23", "GA Bldg 24", "GA Bldg 25",
]

LABORATORY_ROOMS = ["MTC1", "MTC2", "IT101", "NIT1", "NIT3"]

# All laboratory rooms are also valid lecture rooms
ALL_ROOMS = LECTURE_ROOMS + LABORATORY_ROOMS

# ============================================================
# SUBJECT TYPE CLASSIFICATION
# ============================================================
SUBJECT_TYPES = [
    "Core Theory",        # Pure lecture-based foundational subjects
    "Programming",        # Language-heavy coding courses
    "Systems",            # Architecture, integration, admin
    "Data Management",    # Databases, information management
    "Networks & Security",# Networking, cybersecurity, assurance
    "Applied Computing",  # Multimedia, GIS, embedded, graphics
    "Mathematics",        # Discrete math, quantitative methods, data science math
    "Web & App Dev",      # Web systems, application development
    "Research & Capstone",# Capstone, thesis, research writing
    "Industry Practice",  # Practicum, educational tour
    "Elective",           # General electives
]

# ============================================================
# SPECIALIZATION MAP
# ============================================================
SPECIALIZATION_MAP = {
    "Introduction to Computing":                           ["Core Theory"],
    "Computer Programming 1":                             ["Programming"],
    "Discrete Mathematics":                               ["Mathematics"],
    "Introduction to Human Computer Interaction":         ["Applied Computing"],
    "Computer Programming 2":                             ["Programming"],
    "Graphics and Visual Computing":                      ["Applied Computing"],
    "Data Structures and Algorithms":                     ["Programming", "Mathematics"],
    "IT Elective 1":                                      ["Elective"],
    "IT Elective 2":                                      ["Elective"],
    "Mathematics for Data Science":                       ["Mathematics"],
    "Information Management 1":                           ["Data Management"],
    "Quantitative Methods w/ Modelling and Simulation":   ["Mathematics"],
    "Network Technologies 1":                             ["Networks & Security"],
    "Integrative Programming Technologies 1":             ["Programming", "Systems"],
    "Systems Integration and Architecture 1":             ["Systems"],
    "Advanced Database Systems":                          ["Data Management"],
    "Network Technologies 2":                             ["Networks & Security"],
    "Information Assurance and Security 1":               ["Networks & Security"],
    "Web Systems and Technologies 1":                     ["Web & App Dev"],
    "Multimedia Systems":                                 ["Applied Computing"],
    "IT Elective 3":                                      ["Elective"],
    "Application Development and Emerging Technologies 1":["Web & App Dev"],
    "Geographic Information System":                      ["Applied Computing"],
    "Embedded System":                                    ["Applied Computing", "Systems"],
    "Information Assurance and Security 2":               ["Networks & Security"],
    "Capstone Project and Research 1":                    ["Research & Capstone"],
    "Systems Administration and Maintenance":             ["Systems"],
    "Capstone Project and Research 2":                    ["Research & Capstone"],
    "IT Elective 4":                                      ["Elective"],
    "Educational Tour in IT Industry":                    ["Industry Practice"],
    "Thesis Writing and Colloquium":                      ["Research & Capstone"],
    "Practicum (486 Hours)":                              ["Industry Practice"],
}

ai_specialization_cache = {}
STATIC_SPEC_LOOKUP = {}

# ============================================================
# CLASS SIZE DATA MODEL (editable, not fixed constants)
# ============================================================
DEFAULT_CLASS_SIZES = {
    "IT1B1": {"year": "1st Year", "block": "B1", "size": 54},
    "IT1B2": {"year": "1st Year", "block": "B2", "size": 54},
    "IT2B1": {"year": "2nd Year", "block": "B1", "size": 45},
    "IT2B2": {"year": "2nd Year", "block": "B2", "size": 39},
    "IT3B1": {"year": "3rd Year", "block": "B1", "size": 34},
    "IT3B2": {"year": "3rd Year", "block": "B2", "size": 32},
    "IT3B3": {"year": "3rd Year", "block": "B3", "size": 32},
    "IT4B1": {"year": "4th Year", "block": "B1", "size": 33},
    "IT4B2": {"year": "4th Year", "block": "B2", "size": 32},
    "IT4B3": {"year": "4th Year", "block": "B3", "size": 32},
}

# Runtime-editable store (loaded from defaults on first startup, replaceable via API)
class_sizes_store = copy.deepcopy(DEFAULT_CLASS_SIZES)

# ============================================================
# SOFT CONSTRAINT DATA MODELS
# ============================================================
# Structure: { faculty_name: { constraint_type: value } }
soft_constraints_store = {}

PREFERRED_PERIODS = ["morning", "afternoon", "evening"]

def get_soft_constraints(faculty_name: str) -> dict:
    return soft_constraints_store.get(faculty_name, {})

def set_soft_constraint(faculty_name: str, constraint_type: str, value) -> None:
    if faculty_name not in soft_constraints_store:
        soft_constraints_store[faculty_name] = {}
    soft_constraints_store[faculty_name][constraint_type] = value

def score_soft_constraints(gene: dict) -> float:
    """
    Returns a score adjustment for satisfying/violating soft constraints.
    Positive for satisfied preferences; negative for violated restrictions.

    FIX: restricted_days and maternity_leave were previously applied per-gene
    with no cap, so a faculty member on maternity leave would accumulate -20 per
    every assignment, collapsing global fitness. These are now capped per-call so
    a single gene never contributes more than one instance of each flag penalty.
    """
    bonus = 0.0
    faculty_name = gene.get("faculty", "")
    slot = gene.get("slot", "")
    room = gene.get("room", "")
    constraints = get_soft_constraints(faculty_name)
    if not constraints:
        return 0.0

    # Parse slot components once
    slot_day = ""
    slot_start_hour = -1
    if slot:
        try:
            day_part, time_part = slot.split(":", 1)
            slot_day = day_part.strip()
            start_str = time_part.strip().split("-")[0].strip()
            slot_start_hour = int(start_str.split(":")[0])
        except Exception:
            pass

    # 1. Preferred teaching period — bonus for matching, soft penalty for mismatch
    preferred_period = constraints.get("preferred_period")
    if preferred_period and slot_start_hour >= 0:
        if preferred_period == "morning" and 7 <= slot_start_hour < 12:
            bonus += 5.0
        elif preferred_period == "afternoon" and 12 <= slot_start_hour < 17:
            bonus += 5.0
        elif preferred_period == "evening" and slot_start_hour >= 17:
            bonus += 5.0
        else:
            bonus -= 2.0  # soft penalty for wrong period

    # 2. Room preference — exact match bonus
    preferred_room = constraints.get("preferred_room")
    if preferred_room and room:
        if room == preferred_room:
            bonus += 5.0
        else:
            bonus -= 1.0

    # 3. Building preference — partial-match bonus
    preferred_building = constraints.get("preferred_building")
    if preferred_building and room:
        if preferred_building.lower() in room.lower():
            bonus += 3.0
        else:
            bonus -= 0.5

    # 4. Floor preference (encoded in room name)
    preferred_floor = constraints.get("preferred_floor")
    if preferred_floor and room:
        floor_str = str(preferred_floor).lower()
        if floor_str in room.lower():
            bonus += 2.0

    # 5. Day restrictions — strong penalty per gene assigned on a restricted day.
    #    This is intentionally per-gene: each assignment on a restricted day is a
    #    real violation and must be individually discouraged.
    restricted_days = constraints.get("restricted_days", [])
    if restricted_days and slot_day and slot_day in restricted_days:
        bonus -= 12.0

    # 6. Maternity leave flag — capped at -20 per gene (not compounding beyond that).
    #    Previously this could collapse total fitness when a faculty had many genes.
    #    The GA will still strongly avoid assigning any gene to this faculty, which
    #    is the correct behavior; the penalty just won't be unbounded.
    if constraints.get("maternity_leave"):
        bonus -= 20.0

    return bonus

# ============================================================
# FLASK APP SETUP
# ============================================================
app = Flask(__name__)
CORS(app)

ga_lock = Lock()
ga_progress = {"current": 0, "total": 0, "running": False, "result": []}

# ============================================================
# AI HELPER (Ollama)
# ============================================================
def get_ai_specialization(subject_name: str) -> list[str] | None:
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": (
                    f"Give the best IT subject classification for: {subject_name}. "
                    f"Choose from: {', '.join(SUBJECT_TYPES)}. "
                    "Answer as a comma-separated list only. No explanation."
                ),
                "stream": False,
            },
            timeout=OLLAMA_TIMEOUT,
        )
        if response.status_code != 200:
            return None
        text = response.json().get("response", "").strip()
        if not text:
            return None
        return [s.strip() for s in text.split(",") if s.strip()]
    except Exception as e:
        print(f"[AI] Error for '{subject_name}': {e}")
        return None

def build_static_lookup(subjects: list[dict]) -> None:
    global STATIC_SPEC_LOOKUP
    STATIC_SPEC_LOOKUP = copy.deepcopy(SPECIALIZATION_MAP)
    for subj in subjects:
        name = subj.get("name", "").strip()
        if not name or name in STATIC_SPEC_LOOKUP:
            continue
        if name in ai_specialization_cache:
            STATIC_SPEC_LOOKUP[name] = ai_specialization_cache[name]
        else:
            result = get_ai_specialization(name)
            if result:
                ai_specialization_cache[name] = result
                STATIC_SPEC_LOOKUP[name] = result
            else:
                STATIC_SPEC_LOOKUP[name] = ["Elective"]

# ============================================================
# ROOM CONFLICT HELPERS
# ============================================================
def assign_room(gene: dict, room_usage: dict) -> str:
    """Assigns a room to a gene, avoiding conflicts. Returns assigned room string."""
    slot = gene.get("slot", "")
    class_type = gene.get("class_type", "LECTURE")
    preferred_room = get_soft_constraints(gene.get("faculty", "")).get("preferred_room")

    pool = LABORATORY_ROOMS + ALL_ROOMS if class_type == "LAB" else ALL_ROOMS
    # Try preferred room first (soft), then shuffle the rest
    if preferred_room and preferred_room in pool:
        rest = [r for r in pool if r != preferred_room]
        random.shuffle(rest)
        candidates = [preferred_room] + rest
    else:
        candidates = pool[:]
        random.shuffle(candidates)

    for room in candidates:
        key = f"{room}|{slot}"
        if key not in room_usage:
            room_usage[key] = True
            return room

    # Fallback: return first room even if conflict (will be penalized in fitness)
    return candidates[0] if candidates else "Unassigned"

# ============================================================
# SLOT FORMAT HELPERS
# ============================================================
def slot_to_12h(slot_str: str) -> str:
    """Convert '24h' slot like 'Mon: 07:00-09:00' to 'Mon: 7:00 AM - 9:00 AM'."""
    try:
        day_part, time_part = slot_str.split(":", 1)
        start_str, end_str = time_part.strip().split("-")
        def fmt(t):
            h, m = map(int, t.strip().split(":"))
            period = "AM" if h < 12 else "PM"
            h12 = h % 12 or 12
            return f"{h12}:{m:02d} {period}"
        return f"{day_part.strip()}: {fmt(start_str)} - {fmt(end_str)}"
    except Exception:
        return slot_str

# ============================================================
# GA HELPERS
# ============================================================
def get_slot_day(slot_key: str) -> str:
    try:
        return slot_key.split(":")[0].strip()
    except Exception:
        return ""

def can_take_more(prof: dict, current_load: int) -> bool:
    return current_load < prof["absolute_max_units"]

def is_eligible(prof: dict, subject_name: str, current_load: int, slot_key: str | None) -> bool:
    if not can_take_more(prof, current_load):
        return False
    if slot_key and get_slot_day(slot_key) not in prof.get("availability", []):
        return False
    if subject_name.startswith("IT Elective"):
        return True
    required_specs = STATIC_SPEC_LOOKUP.get(subject_name, [])
    prof_specs = prof.get("specialization", [])
    if not required_specs:
        return True
    return any(spec in prof_specs for spec in required_specs)

def calculate_fitness(chromosome: list[dict], faculty_list: list[dict], subject_list: list[dict]) -> float:
    fac_map = {f["name"]: f for f in faculty_list}
    prof_loads = {f["name"]: 0 for f in faculty_list}
    prof_slots = {f["name"]: set() for f in faculty_list}
    slot_assigned = set()
    room_slot_used = set()

    penalty = 0.0
    matches = 0
    soft_bonus = 0.0

    for gene in chromosome:
        prof_name = gene["faculty"]
        subj_name = gene["subject"]
        slot = gene["slot"]
        room = gene.get("room", "")

        if not prof_name:
            penalty += 15
            continue

        # Double booking check (slot uniqueness per subject section)
        if slot in slot_assigned:
            penalty += 40
        slot_assigned.add(slot)

        # Professor overlapping slots
        if slot in prof_slots.get(prof_name, set()):
            penalty += 50
        if prof_name in prof_slots:
            prof_slots[prof_name].add(slot)

        # Room conflict check
        if room:
            room_slot_key = f"{room}|{slot}"
            if room_slot_key in room_slot_used:
                penalty += 35
            room_slot_used.add(room_slot_key)

        prof = fac_map.get(prof_name)
        if not prof:
            penalty += 20
            continue

        # Day availability compliance (hard constraint)
        day = get_slot_day(slot)
        if day not in prof.get("availability", []):
            penalty += 45

        prof_loads[prof_name] += 2

        req_specs = STATIC_SPEC_LOOKUP.get(subj_name, [])
        if any(sp in prof.get("specialization", []) for sp in req_specs):
            matches += 1
        else:
            if not subj_name.startswith("IT Elective"):
                penalty += 12

        # Soft constraint scoring per gene
        soft_bonus += score_soft_constraints(gene)

    # Workload balance penalties — per-faculty hard cap enforcement
    for p_name, load in prof_loads.items():
        prof = fac_map[p_name]
        if load > prof["absolute_max_units"]:
            penalty += (load - prof["absolute_max_units"]) * 15
        elif load > prof["max_units"]:
            penalty += (load - prof["max_units"]) * 5

    # ----------------------------------------------------------------
    # Variance penalty — discourages unbalanced load distribution
    # across the entire faculty pool.
    #
    # FIX: original code applied `gap > std_dev` even when std_dev == 0
    # (perfectly balanced schedule), causing false penalties. Guard added.
    # ----------------------------------------------------------------
    load_values = list(prof_loads.values())
    if load_values:
        mean_load = sum(load_values) / len(load_values)
        variance  = sum((l - mean_load) ** 2 for l in load_values) / len(load_values)
        std_dev   = variance ** 0.5

        # Quadratic variance pressure (primary balancing force)
        penalty += variance * 1.5

        # Extra per-faculty penalty for being severely under-assigned.
        # Guard: only apply when std_dev > 0 to avoid false penalties on
        # a perfectly balanced schedule where every gap == 0 > 0 is False.
        if std_dev > 0:
            for load in load_values:
                gap = mean_load - load
                if gap > std_dev:
                    penalty += (gap - std_dev) * 3.0

    match_score = matches * 15
    # Clamp soft_bonus to prevent runaway negative scores from dominating
    soft_bonus = max(-200.0, soft_bonus)
    return max(0.1, 1000.0 - penalty + match_score + soft_bonus)

def calculate_average_load(chromosome: list[dict], faculty_list: list[dict]) -> float:
    """Compute mean load (units) across all faculty for a given chromosome."""
    counts = {f["name"]: 0 for f in faculty_list}
    for gene in chromosome:
        name = gene.get("faculty", "")
        if name in counts:
            counts[name] += 2
    values = list(counts.values())
    return sum(values) / len(values) if values else 0.0

def rebalance_chromosome(chromosome: list[dict], faculty_list: list[dict]) -> list[dict]:
    """
    Post-GA load rebalancing pass.

    After the GA returns its best individual, this function redistributes load
    from overloaded faculty to under-loaded faculty while preserving hard
    constraints (day availability, specialization match, absolute_max_units cap).

    FIXES vs original:
    1. The `loads[best] >= loads[prof_name]` guard used a stale snapshot.
       Loads are now updated in-place every time a reassignment is made so
       subsequent iterations within the same pass see current values.
    2. Passes were capped at 3, which is insufficient for large faculty pools.
       Now iterates up to len(chromosome) times (stops early if no change).
    3. The `over`/`under` sets are refreshed from the live `loads` dict after
       each swap instead of relying on threshold-based discards, preventing
       stale membership from blocking valid reassignments.
    4. Reassignment now checks `absolute_max_units` on the receiving faculty so
       rebalancing cannot push them over their hard cap.
    5. The swap guard `loads[best] >= loads[prof_name]` is removed — it was
       always true when `best` came from `under` and `prof_name` from `over`,
       but stale loads made it fire incorrectly and block valid swaps.
    """
    rebalanced = copy.deepcopy(chromosome)
    fac_map = {f["name"]: f for f in faculty_list}

    def build_loads(chrom: list[dict]) -> dict:
        loads = {f["name"]: 0 for f in faculty_list}
        for g in chrom:
            n = g.get("faculty", "")
            if n in loads:
                loads[n] += 2
        return loads

    max_passes = len(rebalanced) + 1

    for _ in range(max_passes):
        loads = build_loads(rebalanced)
        values = list(loads.values())
        if not values:
            break
        avg = sum(values) / len(values)

        # Faculty clearly below / above average (threshold: 2 units)
        under = {n for n, v in loads.items() if v < avg - 2}
        over  = {n for n, v in loads.items() if v > avg + 2}

        if not under or not over:
            break

        changed = False
        for gene in rebalanced:
            prof_name = gene.get("faculty", "")
            if prof_name not in over:
                continue

            subj_name = gene.get("subject", "")
            slot_key  = gene.get("slot", "")
            day       = get_slot_day(slot_key)

            # Find eligible under-loaded replacements
            candidates = []
            for uname in under:
                prof = fac_map.get(uname)
                if not prof:
                    continue
                # Hard: day availability
                if day and day not in prof.get("availability", []):
                    continue
                # Hard: absolute max units cap — do not push them over
                if loads[uname] + 2 > prof.get("absolute_max_units", 999):
                    continue
                # Hard: specialization match (electives are open to all)
                if subj_name.startswith("IT Elective"):
                    candidates.append(uname)
                    continue
                req_specs = STATIC_SPEC_LOOKUP.get(subj_name, [])
                if not req_specs or any(sp in prof.get("specialization", []) for sp in req_specs):
                    candidates.append(uname)

            if not candidates:
                continue

            # Pick the most under-loaded eligible candidate
            best = min(candidates, key=lambda n: loads[n])

            # Perform reassignment and update live loads immediately
            loads[prof_name] -= 2
            loads[best]      += 2
            gene["faculty"]   = best

            # Refresh over/under membership based on updated loads
            avg = sum(loads.values()) / len(loads)
            under = {n for n, v in loads.items() if v < avg - 2}
            over  = {n for n, v in loads.items() if v > avg + 2}

            changed = True
            if not over or not under:
                break

        if not changed:
            break

    return rebalanced

def resolve_spec_mismatches(chromosome: list[dict], faculty_list: list[dict]) -> list[dict]:
    """
    Post-GA pass: find genes where the assigned faculty's specialization does not
    match the subject's required specialization, then try to reassign to a better-
    matched faculty who (a) is available on that slot's day, (b) has not exceeded
    absolute_max_units, and (c) has no existing gene in that exact slot.

    Runs before day-enforcement and overlap resolution so downstream passes work
    on spec-correct data. Electives are always skipped (open assignment).
    Preserves load balance by preferring under-loaded candidates.
    """
    fixed   = copy.deepcopy(chromosome)
    fac_map = {f["name"]: f for f in faculty_list}

    def build_loads(chrom: list[dict]) -> dict:
        loads = {f["name"]: 0 for f in faculty_list}
        for g in chrom:
            n = g.get("faculty", "")
            if n in loads:
                loads[n] += 2
        return loads

    def faculty_slot_set(chrom: list[dict], fname: str) -> set:
        return {g["slot"] for g in chrom if g.get("faculty") == fname}

    for gene in fixed:
        subj_name = gene.get("subject", "")
        if subj_name.startswith("IT Elective"):
            continue
        req_specs = STATIC_SPEC_LOOKUP.get(subj_name, [])
        if not req_specs:
            continue

        prof_name = gene.get("faculty", "")
        prof      = fac_map.get(prof_name)
        if not prof:
            continue

        # Already a valid match — skip
        if any(sp in prof.get("specialization", []) for sp in req_specs):
            continue

        # Gene is mismatched — find a better faculty
        slot = gene.get("slot", "")
        day  = get_slot_day(slot)
        loads = build_loads(fixed)

        candidates = []
        for alt in faculty_list:
            aname = alt["name"]
            if aname == prof_name:
                continue
            # Must match spec
            if not any(sp in alt.get("specialization", []) for sp in req_specs):
                continue
            # Must be available on that day
            if day and day not in alt.get("availability", []):
                continue
            # Must not already have a gene in this exact slot (collision)
            if slot in faculty_slot_set(fixed, aname):
                continue
            # Must not exceed hard cap
            if loads.get(aname, 0) + 2 > alt.get("absolute_max_units", 999):
                continue
            candidates.append((aname, loads.get(aname, 0)))

        if not candidates:
            continue

        # Pick most under-loaded spec-correct candidate
        candidates.sort(key=lambda x: x[1])
        best_name = candidates[0][0]
        gene["faculty"] = best_name

    return fixed


def _allowed_slots_for(prof: dict) -> list[str]:
    """
    Return every slot string that falls on a day this faculty member is available.
    Result is shuffled for randomised selection during repair passes.
    These are the ONLY slots this faculty member is legally allowed to occupy.
    """
    avail = set(prof.get("availability", []))
    slots = [
        f"{d}: {h[0]:02d}:00-{h[1]:02d}:00"
        for (d, h) in [(t[0], (t[1], t[2])) for t in TIME_SLOTS]
        if d in avail
    ]
    random.shuffle(slots)
    return slots


def enforce_day_constraints(chromosome: list[dict], faculty_list: list[dict]) -> list[dict]:
    """
    Hard-cap post-pass: every gene whose slot day is NOT in that faculty's
    availability is forcibly relocated to a legal slot.

    Strategy (in order, most to least preferred):
      1. Find a slot on an allowed day that this faculty member does not
         already occupy in this chromosome.
      2. If every allowed slot is already taken by this faculty (extreme
         overload), find another faculty member who (a) is eligible for
         this subject, (b) has a free slot on an allowed day, and (c) is
         below or at average load — swap the gene to them.
      3. If neither is possible (truly impossible geometry), keep the gene
         but move it to ANY allowed-day slot for this faculty (accepting a
         time-overlap — resolve_faculty_slot_overlaps will clean those up).
      4. Last resort: leave the gene untouched (will be flagged by fitness
         but the output won't crash).

    This function does NOT modify load balance — it only fixes day violations.
    """
    fixed = copy.deepcopy(chromosome)
    fac_map = {f["name"]: f for f in faculty_list}

    def faculty_occupied_slots(chrom: list[dict], fname: str) -> set:
        return {g["slot"] for g in chrom if g.get("faculty") == fname}

    def build_loads(chrom: list[dict]) -> dict:
        loads = {f["name"]: 0 for f in faculty_list}
        for g in chrom:
            n = g.get("faculty", "")
            if n in loads:
                loads[n] += 2
        return loads

    for gene in fixed:
        prof_name = gene.get("faculty", "")
        slot      = gene.get("slot", "")
        day       = get_slot_day(slot)
        prof      = fac_map.get(prof_name)
        if not prof:
            continue
        avail = prof.get("availability", [])
        if day in avail:
            continue  # already legal, nothing to do

        # ── Strategy 1: relocate to a free allowed slot for this faculty ──
        occupied  = faculty_occupied_slots(fixed, prof_name)
        allowed   = _allowed_slots_for(prof)
        free_slot = next((s for s in allowed if s not in occupied), None)

        if free_slot:
            gene["slot"]         = free_slot
            gene["slot_display"] = slot_to_12h(free_slot)
            continue

        # ── Strategy 2: swap to another eligible faculty with free capacity ──
        subj_name = gene.get("subject", "")
        loads     = build_loads(fixed)
        avg_load  = sum(loads.values()) / len(loads) if loads else 0.0

        swapped = False
        # Sort candidates: prefer under-loaded faculty with free allowed slots
        candidates = []
        for alt in faculty_list:
            aname = alt["name"]
            if aname == prof_name:
                continue
            alt_avail = alt.get("availability", [])
            if not alt_avail:
                continue
            # Specialization check
            if not subj_name.startswith("IT Elective"):
                req = STATIC_SPEC_LOOKUP.get(subj_name, [])
                if req and not any(sp in alt.get("specialization", []) for sp in req):
                    continue
            # Hard cap check
            if loads.get(aname, 0) + 2 > alt.get("absolute_max_units", 999):
                continue
            # Must have a free slot on an allowed day
            alt_occupied = faculty_occupied_slots(fixed, aname)
            alt_free = next(
                (s for s in _allowed_slots_for(alt) if s not in alt_occupied),
                None
            )
            if alt_free is None:
                continue
            candidates.append((aname, alt_free, loads.get(aname, 0)))

        if candidates:
            # pick the most under-loaded candidate
            candidates.sort(key=lambda x: x[2])
            best_name, best_slot, _ = candidates[0]
            gene["faculty"]      = best_name
            gene["slot"]         = best_slot
            gene["slot_display"] = slot_to_12h(best_slot)
            swapped = True

        if swapped:
            continue

        # ── Strategy 3: best-effort — move to any allowed slot (may overlap) ──
        if allowed:
            gene["slot"]         = allowed[0]
            gene["slot_display"] = slot_to_12h(allowed[0])
        # Strategy 4: give up — leave as-is

    return fixed


def resolve_faculty_slot_overlaps(chromosome: list[dict], faculty_list: list[dict]) -> list[dict]:
    """
    For each faculty member, detect time-slot collisions (two genes sharing the
    same slot string) and reassign the later colliding gene to a free slot on
    one of their allowed days.

    Under extreme constraints (e.g. only 2 days available, 5 slots each = 10
    legal positions) a faculty member with more subjects than available positions
    truly cannot be collision-free.  In that case this function packs as many
    collision-free slots as possible and leaves the remainder in their least-bad
    position rather than crashing or silently discarding genes.

    This pass runs AFTER enforce_day_constraints so all slots are already on
    allowed days.  The only thing being changed here is which specific allowed
    slot a colliding gene lands on.

    Runs multiple sweeps until no new fixes are possible (convergence).
    """
    resolved = copy.deepcopy(chromosome)
    fac_map  = {f["name"]: f for f in faculty_list}

    max_sweeps = len(resolved) + 1   # generous upper bound

    for _ in range(max_sweeps):
        # Build per-faculty slot → gene-index map
        fac_slot_map: dict[str, dict[str, list[int]]] = {}
        for idx, gene in enumerate(resolved):
            fname = gene.get("faculty", "")
            slot  = gene.get("slot", "")
            if not fname or not slot:
                continue
            if fname not in fac_slot_map:
                fac_slot_map[fname] = {}
            fac_slot_map[fname].setdefault(slot, []).append(idx)

        any_fixed = False
        for fname, slot_to_idxs in fac_slot_map.items():
            prof = fac_map.get(fname)
            if not prof:
                continue
            allowed = _allowed_slots_for(prof)   # already shuffled

            # Collect the set of slots currently used (one gene each — no collision)
            used_slots: set[str] = set()

            for slot, idxs in slot_to_idxs.items():
                if len(idxs) == 1:
                    used_slots.add(slot)
                    continue
                # Collision: keep first gene in place, relocate the rest
                used_slots.add(slot)  # first gene stays here
                for collision_idx in idxs[1:]:
                    # Find the first free allowed slot not yet used by this faculty
                    free = next((s for s in allowed if s not in used_slots), None)
                    if free:
                        resolved[collision_idx]["slot"]         = free
                        resolved[collision_idx]["slot_display"] = slot_to_12h(free)
                        used_slots.add(free)
                        any_fixed = True
                    # If no free slot exists: leave in place — faculty is truly saturated.
                    # The fitness function will penalize but the output remains intact.

        if not any_fixed:
            break   # no more collisions fixable

    return resolved


def generate_individual(faculty_list: list[dict], subject_list: list[dict]) -> list[dict]:
    """
    FIX: `assignment_weight` was defined as a closure inside the subject loop,
    capturing `slot` by reference. Because Python closures capture variables by
    reference (not value), every call to `assignment_weight` saw the last value
    of `slot` from the loop, not the current iteration's value. This made the
    soft-constraint period scoring always evaluate the final slot instead of the
    slot actually being considered.

    Fix: `slot` is now passed as a default argument (`current_slot=slot`) so
    each closure captures the value at definition time.
    """
    chromosome = []
    shuffled_slots = list(TIME_SLOTS)
    random.shuffle(shuffled_slots)
    room_usage = {}

    # Live load tracker — used to bias assignment toward under-loaded faculty
    live_loads = {f["name"]: 0 for f in faculty_list}

    slot_idx = 0
    for subj in subject_list:
        if slot_idx >= len(shuffled_slots):
            slot_idx = 0
            random.shuffle(shuffled_slots)

        class_type = subj.get("class_type", "LECTURE")

        slot = shuffled_slots[slot_idx]
        slot_str = f"{slot[0]}: {slot[1]:02d}:00-{slot[2]:02d}:00"
        slot_idx += 1

        eligible_profs = [
            f["name"] for f in faculty_list
            if is_eligible(f, subj["name"], live_loads.get(f["name"], 0), slot_str)
        ]
        if not eligible_profs:
            # Relax load constraint — allow anyone available that day with right spec
            eligible_profs = [
                f["name"] for f in faculty_list
                if get_slot_day(slot_str) in f.get("availability", [])
            ]
        if not eligible_profs:
            eligible_profs = [f["name"] for f in faculty_list]

        # Snapshot average load of eligible pool for weight computation
        eligible_loads = [live_loads.get(p, 0) for p in eligible_profs]
        avg_eligible   = sum(eligible_loads) / len(eligible_loads) if eligible_loads else 0.0

        # FIX: capture `slot` and `avg_eligible` by value via default arguments
        # to avoid the closure-over-loop-variable bug.
        def assignment_weight(prof_name: str, current_slot=slot, cur_avg=avg_eligible) -> float:
            """
            Higher weight = more likely to be chosen.
            Under-loaded faculty get a strong boost; over-loaded get suppressed.
            Soft constraint period/day preferences add a smaller secondary signal.
            """
            load     = live_loads.get(prof_name, 0)
            load_gap = cur_avg - load       # positive = under-loaded
            load_w   = max(0.1, 1.0 + load_gap * 0.5)

            sc = get_soft_constraints(prof_name)
            sc_score = 0.0
            if sc:
                preferred_period = sc.get("preferred_period")
                if preferred_period:
                    h = current_slot[1]
                    if preferred_period == "morning" and 7 <= h < 12:
                        sc_score += 1.5
                    elif preferred_period == "afternoon" and 12 <= h < 17:
                        sc_score += 1.5
                    elif preferred_period == "evening" and h >= 17:
                        sc_score += 1.5
                    else:
                        sc_score -= 0.5
                if current_slot[0] in sc.get("restricted_days", []):
                    sc_score -= 3.0
                if sc.get("maternity_leave"):
                    sc_score -= 8.0

            return max(0.05, load_w + sc_score * 0.3)

        weights = [assignment_weight(p) for p in eligible_profs]
        total_w = sum(weights)
        r = random.random() * total_w
        selected_prof = eligible_profs[0]
        cumulative = 0.0
        for i, w in enumerate(weights):
            cumulative += w
            if r <= cumulative:
                selected_prof = eligible_profs[i]
                break

        live_loads[selected_prof] = live_loads.get(selected_prof, 0) + 2

        gene = {
            "faculty":      selected_prof,
            "subject":      subj["name"],
            "type":         subj.get("type", "Core Theory"),
            "class_type":   class_type,
            "slot":         slot_str,
            "slot_display": slot_to_12h(slot_str),
            "semester":     subj.get("semester", ""),
        }
        gene["room"] = assign_room(gene, room_usage)
        chromosome.append(gene)
    return chromosome

def mutate(chromosome: list[dict], faculty_list: list[dict], mut_rate: float) -> list[dict]:
    """
    FIX: `avg_load` was computed once before the mutation loop and never
    updated as genes were mutated. Late mutations therefore used a stale
    average, making the load-balance weighting increasingly inaccurate.
    Now `avg_load` is recomputed from the live `live_loads` snapshot after
    every faculty swap so subsequent mutations in the same call see current
    distribution.
    """
    mutated = copy.deepcopy(chromosome)

    # Build current load snapshot
    live_loads = {f["name"]: 0 for f in faculty_list}
    for gene in mutated:
        n = gene.get("faculty", "")
        if n in live_loads:
            live_loads[n] += 2

    fac_names = [f["name"] for f in faculty_list]

    for gene in mutated:
        if random.random() < mut_rate:
            choice = random.random()
            if choice < 0.33:
                # Load-aware faculty mutation: bias toward under-loaded faculty.
                # avg_load is recomputed from the live snapshot after each swap.
                avg_load = sum(live_loads.values()) / len(live_loads) if live_loads else 0.0
                weights  = [max(0.05, 1.0 + (avg_load - live_loads.get(n, 0)) * 0.4) for n in fac_names]
                total_w  = sum(weights)
                r        = random.random() * total_w
                new_fac  = fac_names[0]
                cumulative = 0.0
                for i, w in enumerate(weights):
                    cumulative += w
                    if r <= cumulative:
                        new_fac = fac_names[i]
                        break
                # Update live loads to reflect the swap
                old_fac = gene.get("faculty", "")
                if old_fac in live_loads:
                    live_loads[old_fac] = max(0, live_loads[old_fac] - 2)
                if new_fac in live_loads:
                    live_loads[new_fac] += 2
                gene["faculty"] = new_fac

            elif choice < 0.66:
                slot = random.choice(TIME_SLOTS)
                new_slot = f"{slot[0]}: {slot[1]:02d}:00-{slot[2]:02d}:00"
                gene["slot"] = new_slot
                gene["slot_display"] = slot_to_12h(new_slot)
            else:
                pool = LABORATORY_ROOMS if gene.get("class_type") == "LAB" else ALL_ROOMS
                gene["room"] = random.choice(pool)
    return mutated

def crossover(parent1: list[dict], parent2: list[dict], cross_rate: float) -> tuple[list[dict], list[dict]]:
    if random.random() > cross_rate:
        return copy.deepcopy(parent1), copy.deepcopy(parent2)
    point = random.randint(1, len(parent1) - 1)
    child1 = parent1[:point] + parent2[point:]
    child2 = parent2[:point] + parent1[point:]
    return child1, child2

# ============================================================
# GENETIC ALGORITHM ORCHESTRATION ENGINE
# ============================================================
def safe_run_ga(faculty_list: list[dict], subject_list: list[dict], pop_size: int, generations: int, mut_rate: float, cross_rate: float):
    global ga_progress
    try:
        population = [generate_individual(faculty_list, subject_list) for _ in range(pop_size)]

        for gen in range(generations):
            scored = [(ind, calculate_fitness(ind, faculty_list, subject_list)) for ind in population]
            scored.sort(key=lambda x: x[1], reverse=True)

            best_ind, best_fit = scored[0]

            with ga_lock:
                ga_progress["current"] = gen + 1
                ga_progress["result"] = copy.deepcopy(best_ind)

            new_pop = [copy.deepcopy(best_ind)]
            while len(new_pop) < pop_size:
                p1 = random.choice(scored[:max(2, pop_size // 2)])[0]
                p2 = random.choice(scored[:max(2, pop_size // 2)])[0]
                c1, c2 = crossover(p1, p2, cross_rate)
                new_pop.append(mutate(c1, faculty_list, mut_rate))
                if len(new_pop) < pop_size:
                    new_pop.append(mutate(c2, faculty_list, mut_rate))

            population = new_pop
            time.sleep(0.01)

        # ── Post-GA repair pipeline ─────────────────────────────────────────
        # 0. resolve_spec_mismatches  — fix spec-mismatched genes first so
        #                               downstream passes work on correct data
        # 1. rebalance_chromosome     — redistribute load across faculty
        # 2. enforce_day_constraints  — hard-cap every gene to allowed days
        # 3. resolve_faculty_slot_overlaps — eliminate per-faculty collisions
        # 4-5. second enforce+overlap passes for edge-case cleanup
        # ────────────────────────────────────────────────────────────────────
        final_scored = [(ind, calculate_fitness(ind, faculty_list, subject_list)) for ind in population]
        final_scored.sort(key=lambda x: x[1], reverse=True)
        final_best = final_scored[0][0]

        # Pass 0 — specialization mismatch repair
        spec_fixed = resolve_spec_mismatches(final_best, faculty_list)

        # Pass 1 — load rebalancing
        rebalanced_best = rebalance_chromosome(spec_fixed, faculty_list)

        # Pass 2 — hard day-constraint enforcement
        day_fixed = enforce_day_constraints(rebalanced_best, faculty_list)

        # Pass 3 — faculty slot-overlap resolution
        overlap_fixed = resolve_faculty_slot_overlaps(day_fixed, faculty_list)

        # Pass 4 — second enforce (overlap resolution may create new day violations)
        day_fixed_2 = enforce_day_constraints(overlap_fixed, faculty_list)

        # Pass 5 — final overlap cleanup
        final_result = resolve_faculty_slot_overlaps(day_fixed_2, faculty_list)

        with ga_lock:
            ga_progress["result"] = copy.deepcopy(final_result)

    except Exception as e:
        print(f"[GA] Engine Error Trace Trigger: {e}")
    finally:
        with ga_lock:
            ga_progress["running"] = False

def preload_ai_cache(subjects: list[dict]) -> None:
    def worker():
        print("[AI Cache] background check indexing cycle started...")
        for s in subjects:
            name = s.get("name", "").strip()
            if name and name not in SPECIALIZATION_MAP and name not in ai_specialization_cache:
                res = get_ai_specialization(name)
                if res:
                    ai_specialization_cache[name] = res
        print("[AI Cache] background validation complete.")
    threading.Thread(target=worker, daemon=True).start()

# ============================================================
# API CONTROLLERS
# ============================================================
@app.route("/run-ga", methods=["POST"])
def run_ga_endpoint():
    global ga_progress
    with ga_lock:
        if ga_progress["running"]:
            return jsonify({"error": "An optimization execution layout sequence is already running"}), 400

    data = request.get_json() or {}
    if not data:
        return jsonify({"error": "Empty or corrupted API payload structural metadata data provided"}), 400

    faculty = data.get("faculty", [])
    subjects_raw = data.get("subjects", [])
    active_semester = data.get("active_semester")

    # Load soft constraints from payload if provided (frontend-authoritative)
    incoming_sc = data.get("soft_constraints", {})
    if incoming_sc and isinstance(incoming_sc, dict):
        for fac_name, constraints in incoming_sc.items():
            if isinstance(constraints, dict):
                for k, v in constraints.items():
                    set_soft_constraint(fac_name, k, v)

    # Filter subjects by active_semester if provided
    subjects_filtered = subjects_raw
    if active_semester:
        subjects_filtered = [
            s for s in subjects_raw
            if not s.get("semester") or s.get("semester") == active_semester
        ]

    subjects = [
        {
            "name":       s.get("name", ""),
            "type":       s.get("type", "Core Theory"),
            "class_type": s.get("class_type", "LECTURE"),
            "hours":      int(s.get("hours", 2)),
            "semester":   s.get("semester", active_semester or ""),
        }
        for s in subjects_filtered
        if s.get("name")
    ]

    pop_size    = max(5,  int(data.get("population",  20)))
    generations = max(10, int(data.get("generations", 50)))
    mut_rate    = min(1.0, max(0.0, float(data.get("mutation",  0.1))))
    cross_rate  = min(1.0, max(0.0, float(data.get("crossover", 0.8))))

    print(f"[GA] Instantiating run for {len(faculty)} faculty, {len(subjects)} subjects, semester={active_semester}.")
    build_static_lookup(subjects)

    with ga_lock:
        ga_progress.update({"current": 0, "total": generations, "running": True, "result": []})

    thread = threading.Thread(
        target=safe_run_ga,
        args=(faculty, subjects, pop_size, generations, mut_rate, cross_rate),
        daemon=True,
    )
    thread.start()
    return jsonify({"status": "started"})


@app.route("/progress", methods=["GET"])
def progress_endpoint():
    with ga_lock:
        return jsonify(ga_progress)


@app.route("/rooms", methods=["GET"])
def get_rooms():
    return jsonify({
        "lecture_rooms": LECTURE_ROOMS,
        "laboratory_rooms": LABORATORY_ROOMS,
        "all_rooms": ALL_ROOMS
    })


@app.route("/rooms", methods=["POST"])
def update_rooms():
    global LECTURE_ROOMS, LABORATORY_ROOMS, ALL_ROOMS
    data = request.get_json() or {}
    if "lecture_rooms" in data:
        LECTURE_ROOMS = [str(r).strip() for r in data["lecture_rooms"] if str(r).strip()]
    if "laboratory_rooms" in data:
        LABORATORY_ROOMS = [str(r).strip() for r in data["laboratory_rooms"] if str(r).strip()]
    ALL_ROOMS = LECTURE_ROOMS + LABORATORY_ROOMS
    return jsonify({
        "status": "updated",
        "lecture_rooms": LECTURE_ROOMS,
        "laboratory_rooms": LABORATORY_ROOMS,
        "all_rooms": ALL_ROOMS
    })


@app.route("/subject-types", methods=["GET"])
def get_subject_types():
    return jsonify({"subject_types": SUBJECT_TYPES})


@app.route("/class-sizes", methods=["GET"])
def get_class_sizes():
    return jsonify(class_sizes_store)


@app.route("/class-sizes", methods=["POST"])
def update_class_sizes():
    data = request.get_json() or {}
    for key, val in data.items():
        if key in class_sizes_store:
            if isinstance(val, dict):
                class_sizes_store[key].update(val)
            elif isinstance(val, int):
                class_sizes_store[key]["size"] = val
        else:
            class_sizes_store[key] = val
    return jsonify({"status": "updated", "class_sizes": class_sizes_store})


@app.route("/soft-constraints", methods=["GET"])
def get_soft_constraints_endpoint():
    faculty_name = request.args.get("faculty")
    if faculty_name:
        return jsonify({faculty_name: get_soft_constraints(faculty_name)})
    return jsonify(soft_constraints_store)


@app.route("/soft-constraints", methods=["POST"])
def set_soft_constraints_endpoint():
    data = request.get_json() or {}
    faculty_name = data.get("faculty")
    if not faculty_name:
        return jsonify({"error": "faculty name required"}), 400
    constraints = data.get("constraints", {})
    for k, v in constraints.items():
        set_soft_constraint(faculty_name, k, v)
    return jsonify({"status": "updated", "faculty": faculty_name, "constraints": get_soft_constraints(faculty_name)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)