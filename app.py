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
    """Returns a positive score bonus for satisfying soft constraints (0.0 - 30.0)."""
    bonus = 0.0
    faculty_name = gene.get("faculty", "")
    slot = gene.get("slot", "")
    room = gene.get("room", "")
    constraints = get_soft_constraints(faculty_name)
    if not constraints:
        return 0.0

    # 1. Preferred teaching period
    preferred_period = constraints.get("preferred_period")
    if preferred_period and slot:
        try:
            hour_part = slot.split(":")[1].strip()
            start_hour = int(hour_part.split("-")[0].strip().split(":")[0])
            if preferred_period == "morning" and 7 <= start_hour < 12:
                bonus += 5.0
            elif preferred_period == "afternoon" and 12 <= start_hour < 17:
                bonus += 5.0
            elif preferred_period == "evening" and start_hour >= 17:
                bonus += 5.0
        except Exception:
            pass

    # 2. Room preference
    preferred_room = constraints.get("preferred_room")
    if preferred_room and room and room == preferred_room:
        bonus += 4.0

    # 3. Building preference
    preferred_building = constraints.get("preferred_building")
    if preferred_building and room and preferred_building.lower() in room.lower():
        bonus += 3.0

    # 4. Floor preference (encoded in room name as "Floor X")
    preferred_floor = constraints.get("preferred_floor")
    if preferred_floor and room and str(preferred_floor).lower() in room.lower():
        bonus += 2.0

    # 5. Date unavailability (list of "YYYY-MM-DD" strings to avoid - soft)
    unavailable_dates = constraints.get("unavailable_dates", [])
    # Cannot evaluate against a specific date from slot alone; skip scoring (no penalty applied)

    # 6. Leave periods (list of {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"})
    # No per-slot date info in slot string; leave scoring deferred to scheduler extension

    # 7. Maternity leave flag (bool) - same deferral
    # 8. Temporary schedule restrictions (list of day strings)
    restricted_days = constraints.get("restricted_days", [])
    if restricted_days and slot:
        slot_day = slot.split(":")[0].strip()
        if slot_day in restricted_days:
            bonus -= 8.0  # soft penalty, not hard block

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
    # Try preferred room first (soft)
    if preferred_room and preferred_room in pool:
        candidates = [preferred_room] + [r for r in pool if r != preferred_room]
    else:
        candidates = pool[:]

    random.shuffle(candidates) if not preferred_room else None

    for room in candidates:
        key = f"{room}|{slot}"
        if key not in room_usage:
            room_usage[key] = True
            return room

    # Fallback: return first room even if conflict (will be penalized)
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

    penalty = 0
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
        slot_key_full = f"{prof_name}|{slot}"
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

        # Day availability compliance
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

        # Soft constraint scoring
        soft_bonus += score_soft_constraints(gene)

    for p_name, load in prof_loads.items():
        prof = fac_map[p_name]
        if load > prof["absolute_max_units"]:
            penalty += (load - prof["absolute_max_units"]) * 15
        elif load > prof["max_units"]:
            penalty += (load - prof["max_units"]) * 5

    match_score = matches * 15
    return max(0.1, 1000 - penalty + match_score + soft_bonus)

def generate_individual(faculty_list: list[dict], subject_list: list[dict]) -> list[dict]:
    chromosome = []
    shuffled_slots = list(TIME_SLOTS)
    random.shuffle(shuffled_slots)
    room_usage = {}

    slot_idx = 0
    for subj in subject_list:
        if slot_idx >= len(shuffled_slots):
            slot_idx = 0
            random.shuffle(shuffled_slots)

        slot = shuffled_slots[slot_idx]
        slot_str = f"{slot[0]}: {slot[1]:02d}:00-{slot[2]:02d}:00"
        slot_idx += 1

        class_type = subj.get("class_type", "LECTURE")
        eligible_profs = [f["name"] for f in faculty_list if is_eligible(f, subj["name"], 0, slot_str)]
        selected_prof = random.choice(eligible_profs) if eligible_profs else random.choice([f["name"] for f in faculty_list])

        gene = {
            "faculty": selected_prof,
            "subject": subj["name"],
            "type": subj.get("type", "Core Theory"),
            "class_type": class_type,
            "slot": slot_str,
            "slot_display": slot_to_12h(slot_str),
        }
        gene["room"] = assign_room(gene, room_usage)
        chromosome.append(gene)
    return chromosome

def mutate(chromosome: list[dict], faculty_list: list[dict], mut_rate: float) -> list[dict]:
    mutated = copy.deepcopy(chromosome)
    for gene in mutated:
        if random.random() < mut_rate:
            choice = random.random()
            if choice < 0.33:
                gene["faculty"] = random.choice([f["name"] for f in faculty_list])
            elif choice < 0.66:
                slot = random.choice(TIME_SLOTS)
                new_slot = f"{slot[0]}: {slot[1]:02d}:00-{slot[2]:02d}:00"
                gene["slot"] = new_slot
                gene["slot_display"] = slot_to_12h(new_slot)
            else:
                # Mutate room assignment
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

    subjects = [
        {
            "name":       s.get("name", ""),
            "type":       s.get("type", "Core Theory"),
            "class_type": s.get("class_type", "LECTURE"),
            "hours":      int(s.get("hours", 2)),
        }
        for s in subjects_raw
        if s.get("name")
    ]

    pop_size    = max(5,  int(data.get("population",  20)))
    generations = max(10, int(data.get("generations", 50)))
    mut_rate    = min(1.0, max(0.0, float(data.get("mutation",  0.1))))
    cross_rate  = min(1.0, max(0.0, float(data.get("crossover", 0.8))))

    print(f"[GA] Instantiating run for {len(faculty)} faculty.")
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