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
# FLASK APP SETUP
# ============================================================
app = Flask(__name__)
CORS(app)

ga_lock = Lock()
ga_progress = {"current": 0, "total": 0, "running": False, "result": []}

SPECIALIZATION_MAP = {
    "Introduction to Computing":                           ["Computer Science Education"],
    "Computer Programming 1":                             ["Software Engineering / Programming Languages"],
    "Discrete Mathematics":                               ["Applied Mathematics / Theoretical Computer Science"],
    "Introduction to Human Computer Interaction":         ["Human-Computer Interaction (HCI)"],
    "Computer Programming 2":                             ["Software Engineering / Programming Languages"],
    "Graphics and Visual Computing":                      ["Computer Graphics / Visual Computing"],
    "Data Structures and Algorithms":                     ["Algorithms & Data Structures / Theoretical Computer Science"],
    "IT Elective 1":                                      ["Information Technology (General Elective)"],
    "IT Elective 2":                                      ["Information Technology (General Elective)"],
    "Mathematics for Data Science":                       ["Data Science / Applied Mathematics"],
    "Information Management 1":                           ["Information Systems / Database Management"],
    "Quantitative Methods w/ Modelling and Simulation":   ["Operations Research / Computational Modelling"],
    "Network Technologies 1":                             ["Computer Networks"],
    "Integrative Programming Technologies 1":             ["Software Engineering / Systems Integration"],
    "Systems Integration and Architecture 1":             ["Systems Architecture / Enterprise Systems"],
    "Advanced Database Systems":                          ["Database Systems / Information Systems"],
    "Network Technologies 2":                             ["Computer Networks / Network Engineering"],
    "Information Assurance and Security 1":               ["Cybersecurity / Information Assurance"],
    "Web Systems and Technologies 1":                     ["Web Development / Web Technologies"],
    "Multimedia Systems":                                 ["Multimedia Computing / Digital Media"],
    "IT Elective 3":                                      ["Information Technology (General Elective)"],
    "Application Development and Emerging Technologies 1":["Emerging Technologies / Application Development"],
    "Geographic Information System":                      ["Geographic Information Systems (GIS)"],
    "Embedded System":                                    ["Embedded Systems Engineering"],
    "Information Assurance and Security 2":               ["Cybersecurity / Information Assurance"],
}

ai_specialization_cache = {}

# Static dictionary map to completely avoid function call overrides inside optimization loops
STATIC_SPEC_LOOKUP = {}

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
                    f"Give the best IT specialization for the subject: {subject_name}. "
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
    """Builds a complete, zero-latency lookup dictionary before GA runs."""
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
                STATIC_SPEC_LOOKUP[name] = ["Information Technology (General Elective)"]

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

    required_specs = STATIC_SPEC_LOOKUP.get(subject_name, ["Information Technology (General Elective)"])
    required = {s.strip().lower() for s in required_specs}
    prof_specs = {s.strip().lower() for s in prof.get("specialization", [])}

    return bool(required & prof_specs)

def build_slot_key(day: str, start: int, end: int) -> str:
    return f"{day}: {start}-{end}"

def all_slot_keys() -> list[str]:
    return [build_slot_key(d, s, e) for d, s, e in TIME_SLOTS]

# ============================================================
# GA CORE OPERATIONS
# ============================================================
def greedy_schedule(faculty: list[dict], subjects: list[dict]) -> list[dict]:
    schedule = []
    faculty_load  = {f["name"]: 0 for f in faculty}
    faculty_slots = {f["name"]: set() for f in faculty}

    sorted_subjects = sorted(subjects, key=lambda x: -x.get("hours", 2))

    for subj in sorted_subjects:
        remaining = subj.get("hours", 2)
        attempts = 0

        while remaining > 0 and attempts < 60:
            attempts += 1

            eligible = [
                f for f in faculty
                if is_eligible(f, subj["name"], faculty_load[f["name"]], None)
            ]

            if not eligible:
                # FIX: Fallback matches availability constraints systematically
                eligible = [f for f in faculty if can_take_more(f, faculty_load[f["name"]])]

            if not eligible:
                break

            eligible.sort(key=lambda f: faculty_load[f["name"]])
            
            chosen = None
            slot_key = None
            
            for prof in eligible:
                free_slots = [
                    sk for sk in all_slot_keys()
                    if sk not in faculty_slots[prof["name"]]
                    and get_slot_day(sk) in prof.get("availability", [])
                ]
                if free_slots:
                    chosen = prof
                    slot_key = random.choice(free_slots)
                    break
            
            if not chosen or not slot_key:
                break

            schedule.append({
                "faculty": chosen["name"],
                "subject": subj["name"],
                "type":    subj.get("type", "Software"),
                "slot":    slot_key,
            })

            faculty_load[chosen["name"]] += 1
            faculty_slots[chosen["name"]].add(slot_key)
            remaining -= 1

    return schedule

def fitness(schedule: list[dict], faculty: list[dict]) -> float:
    if not schedule:
        return 0.0

    faculty_load = {f["name"]: 0 for f in faculty}
    spec_score   = 0.0
    slot_conflicts = 0

    faculty_by_name = {f["name"]: f for f in faculty}

    for item in schedule:
        fname = item["faculty"]
        faculty_load[fname] = faculty_load.get(fname, 0) + 1

        prof = faculty_by_name.get(fname)
        if not prof:
            continue

        required = STATIC_SPEC_LOOKUP.get(item["subject"], ["Information Technology (General Elective)"])
        prof_specs = {s.strip().lower() for s in prof.get("specialization", [])}
        matches = sum(
            1 for rs in required
            if any(rs.lower() in ps or ps in rs.lower() for ps in prof_specs)
        )
        spec_score += (matches / len(required)) if required else 1.0

    slot_usage = {}
    for item in schedule:
        key = (item["faculty"], item["slot"])
        slot_usage[key] = slot_usage.get(key, 0) + 1
        if slot_usage[key] > 1:
            slot_conflicts += 1

    loads = list(faculty_load.values())
    mean_load = sum(loads) / len(loads) if loads else 0
    load_variance = sum((l - mean_load) ** 2 for l in loads) / len(loads) if loads else 0

    overload_penalty = sum(
        max(0, faculty_load.get(f["name"], 0) - f["absolute_max_units"])
        for f in faculty
    ) * 10

    n = len(schedule)
    score = (
        0.50 * (spec_score / n) +
        0.20 * (1.0 - slot_conflicts / (n + 1)) +
        0.20 * max(0.0, 1.0 - load_variance / 10) +
        0.10 * 1.0
    ) - overload_penalty / (n + 1)

    return score

def repair(schedule: list[dict], faculty: list[dict]) -> list[dict]:
    faculty_load  = {f["name"]: 0 for f in faculty}
    faculty_slots = {f["name"]: set() for f in faculty}
    faculty_by_name = {f["name"]: f for f in faculty}

    for item in schedule:
        fname = item["faculty"]
        slot  = item["slot"]

        prof = faculty_by_name.get(fname)
        if not prof:
            continue

        required_specs = STATIC_SPEC_LOOKUP.get(item["subject"], ["Information Technology (General Elective)"])
        conflict = (
            slot in faculty_slots[fname]
            or faculty_load[fname] >= prof["absolute_max_units"]
            or get_slot_day(slot) not in prof.get("availability", [])
        )

        if conflict:
            eligible = sorted(
                [p for p in faculty if is_eligible(p, item["subject"], faculty_load[p["name"]], None)],
                key=lambda p: (
                    -len(set(p.get("specialization", [])) & set(required_specs)),
                    faculty_load[p["name"]]
                )
            )
            if not eligible:
                continue

            new_prof = eligible[0]
            item["faculty"] = new_prof["name"]

            free_slots = [
                sk for sk in all_slot_keys()
                if sk not in faculty_slots[new_prof["name"]]
                and get_slot_day(sk) in new_prof.get("availability", [])
            ]
            if free_slots:
                item["slot"] = free_slots[0]

        if faculty_load[item["faculty"]] < faculty_by_name[item["faculty"]]["absolute_max_units"]:
            faculty_load[item["faculty"]] += 1
            faculty_slots[item["faculty"]].add(item["slot"])

    return schedule

def mutate(schedule: list[dict], faculty: list[dict], mut_rate: float = 0.1) -> list[dict]:
    current_fit = fitness(schedule, faculty)
    faculty_by_name = {f["name"]: f for f in faculty}

    # Track current occupied slots across mutations to prevent creating overlap errors
    occupied_slots = {(item["faculty"], item["slot"]) for item in schedule}

    for item in schedule:
        adaptive_rate = max(mut_rate * 0.25, mut_rate * (1.0 - min(max(current_fit, 0.0), 1.0)))
        if random.random() >= adaptive_rate:
            continue

        required_specs = STATIC_SPEC_LOOKUP.get(item["subject"], ["Information Technology (General Elective)"])
        eligible = sorted(
            [
                f for f in faculty
                if f["name"] != item["faculty"]
                and is_eligible(f, item["subject"], 0, None)
            ],
            key=lambda f: (
                -len(set(f.get("specialization", [])) & set(required_specs)),
                f["absolute_max_units"]
            )
        )
        if not eligible:
            continue

        new_prof = eligible[0]
        
        # FIX: Find slots that are physically unassigned to prevent downstream logic breakage
        free_slots = [
            sk for sk in all_slot_keys()
            if get_slot_day(sk) in new_prof.get("availability", [])
            and (new_prof["name"], sk) not in occupied_slots
        ]
        
        if free_slots:
            occupied_slots.discard((item["faculty"], item["slot"]))
            item["faculty"] = new_prof["name"]
            item["slot"] = random.choice(free_slots)
            occupied_slots.add((item["faculty"], item["slot"]))

    return schedule

def crossover(parent1: list[dict], parent2: list[dict], faculty: list[dict]) -> list[dict]:
    child = []
    for g1, g2 in zip(parent1, parent2):
        child.append(copy.deepcopy(g1 if fitness([g1], faculty) >= fitness([g2], faculty) else g2))
    return repair(child, faculty)

def tournament_selection(population: list, faculty: list[dict], k: int = 5) -> list[dict]:
    sample = random.sample(population, min(k, len(population)))
    return max(sample, key=lambda x: fitness(x, faculty))

def balance_workload(population: list, faculty: list[dict]) -> None:
    faculty_by_name = {f["name"]: f for f in faculty}

    for schedule in population:
        faculty_load = {f["name"]: 0 for f in faculty}
        for item in schedule:
            faculty_load[item["faculty"]] = faculty_load.get(item["faculty"], 0) + 1

        for _ in range(10):
            max_l = max(faculty_load.values())
            min_l = min(faculty_load.values())
            if max_l - min_l <= 1:
                break

            high = [f for f, l in faculty_load.items() if l == max_l]
            low  = [f for f, l in faculty_load.items() if l == min_l]

            for h in high:
                for lo in low:
                    candidates = [i for i in schedule if i["faculty"] == h]
                    for c in candidates:
                        prof_lo = faculty_by_name.get(lo)
                        if prof_lo and is_eligible(prof_lo, c["subject"], faculty_load[lo], None):
                            c["faculty"] = lo
                            faculty_load[h]  -= 1
                            faculty_load[lo] += 1
                            break

# ============================================================
# MAIN GA LOOP
# ============================================================
def run_ga(
    faculty: list[dict],
    subjects: list[dict],
    pop_size: int = 20,
    num_generations: int = 50,
    mut_rate: float = 0.1,
    cross_rate: float = 0.8,
) -> list[dict]:
    global ga_progress

    # Initialize population
    population = []
    for _ in range(pop_size):
        if random.random() < 0.5:
            population.append(greedy_schedule(faculty, subjects))
        else:
            base = greedy_schedule(faculty, subjects)
            population.append(mutate(copy.deepcopy(base), faculty, mut_rate=0.3))

    best_history = []
    stagnation   = 0
    elite_size   = max(3, pop_size // 5)
    stagnation_limit = max(20, num_generations // 3)
    stagnation_window = 10

    for gen in range(1, num_generations + 1):
        with ga_lock:
            ga_progress["current"] = gen

        population.sort(key=lambda x: fitness(x, faculty), reverse=True)
        best_fit = fitness(population[0], faculty)
        best_history.append(best_fit)

        if len(best_history) > stagnation_window:
            recent = best_history[-stagnation_window:]
            if max(recent) - min(recent) < 1e-6:
                stagnation += 1
            else:
                stagnation = 0
        if stagnation >= stagnation_limit:
            print(f"[GA] Early stop at generation {gen}")
            break

        next_gen = population[:elite_size]
        attempts = 0

        while len(next_gen) < pop_size and attempts < 1000:
            attempts += 1
            p1 = tournament_selection(population, faculty)
            p2 = tournament_selection(population, faculty)

            child = crossover(p1, p2, faculty) if random.random() < cross_rate else copy.deepcopy(p1)
            child = mutate(child, faculty, mut_rate)
            next_gen.append(child)

        population = next_gen
        balance_workload(population, faculty)

        best = max(population, key=lambda x: fitness(x, faculty))
        with ga_lock:
            ga_progress["result"] = best

    best_final = max(population, key=lambda x: fitness(x, faculty))
    with ga_lock:
        ga_progress.update({"current": num_generations, "running": False, "result": best_final})

    print(f"[GA] Done. Fitness: {fitness(best_final, faculty):.4f}")
    return best_final

def safe_run_ga(*args):
    try:
        run_ga(*args)
    except Exception as e:
        print(f"[GA] CRASHED: {e}")
        with ga_lock:
            ga_progress["running"] = False

# ============================================================
# API ROUTES
# ============================================================
@app.route("/run-ga", methods=["POST"])
def run_ga_api():
    global ga_progress
    
    # FIX: Block multiple simultaneous background processing requests
    with ga_lock:
        if ga_progress["running"]:
            return jsonify({"error": "GA optimization is already running"}), 409

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No data provided"}), 400

    faculty  = data.get("faculty", [])
    subjects_raw = data.get("subjects", [])

    subjects = [
        {
            "name":  s.get("name", ""),
            "type":  s.get("type", "Software"),
            "hours": int(s.get("hours", 2)),
        }
        for s in subjects_raw
        if s.get("name")
    ]

    pop_size    = max(5,  int(data.get("population",  20)))
    generations = max(10, int(data.get("generations", 50)))
    mut_rate    = min(1.0, max(0.0, float(data.get("mutation",  0.1))))
    cross_rate  = min(1.0, max(0.0, float(data.get("crossover", 0.8))))

    print(f"[GA] Instantiating run for {len(faculty)} faculty.")

    # FIX: Synchronously build our static lookup context to keep execution safe
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

@app.route("/progress")
def get_progress():
    # FIX: Guard reading with thread lock to ensure safe state management
    with ga_lock:
        return jsonify(ga_progress)

@app.route("/health")
def health_check():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)