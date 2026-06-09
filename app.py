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
        
    required_specs = STATIC_SPEC_LOOKUP.get(subject_name, [])
    prof_specs = prof.get("specialization", [])
    
    if not required_specs:
        return True
    return any(spec in prof_specs for spec in required_specs)

def calculate_fitness(chromosome: list[dict], faculty_list: list[dict], subject_list: list[dict]) -> float:
    # Build internal maps
    fac_map = {f["name"]: f for f in faculty_list}
    prof_loads = {f["name"]: 0 for f in faculty_list}
    prof_slots = {f["name"]: set() for f in faculty_list}
    slot_assigned = set()

    penalty = 0
    matches = 0

    for gene in chromosome:
        prof_name = gene["faculty"]
        subj_name = gene["subject"]
        slot = gene["slot"]

        if not prof_name:
            penalty += 15
            continue

        # Double booking check
        if slot in slot_assigned:
            penalty += 40
        slot_assigned.add(slot)

        # Professor overlapping slots
        if slot in prof_slots[prof_name]:
            penalty += 50
        prof_slots[prof_name].add(slot)

        prof = fac_map.get(prof_name)
        if not prof:
            penalty += 20
            continue

        # Day availability compliance
        day = get_slot_day(slot)
        if day not in prof.get("availability", []):
            penalty += 45

        # Workload calculation
        prof_loads[prof_name] += 2

        # Specialization mapping bonus/penalty
        req_specs = STATIC_SPEC_LOOKUP.get(subj_name, [])
        if any(sp in prof.get("specialization", []) for sp in req_specs):
            matches += 1
        else:
            if not subj_name.startswith("IT Elective"):
                penalty += 12

    # Overload checks
    for p_name, load in prof_loads.items():
        prof = fac_map[p_name]
        if load > prof["absolute_max_units"]:
            penalty += (load - prof["absolute_max_units"]) * 15
        elif load > prof["max_units"]:
            penalty += (load - prof["max_units"]) * 5

    # Target maximum specialization match yield
    match_score = matches * 15
    return max(0.1, 1000 - penalty + match_score)

def generate_individual(faculty_list: list[dict], subject_list: list[dict]) -> list[dict]:
    chromosome = []
    shuffled_slots = list(TIME_SLOTS)
    random.shuffle(shuffled_slots)

    slot_idx = 0
    for subj in subject_list:
        # Every subject section needs 1 schedule entry chunk mapping
        if slot_idx >= len(shuffled_slots):
            slot_idx = 0
            random.shuffle(shuffled_slots)

        slot = shuffled_slots[slot_idx]
        slot_str = f"{slot[0]}: {slot[1]:02d}:00-{slot[2]:02d}:00"
        slot_idx += 1

        eligible_profs = [f["name"] for f in faculty_list if is_eligible(f, subj["name"], 0, slot_str)]
        selected_prof = random.choice(eligible_profs) if eligible_profs else random.choice([f["name"] for f in faculty_list])

        chromosome.append({
            "faculty": selected_prof,
            "subject": subj["name"],
            "type": subj.get("type", "Software"),
            "slot": slot_str
        })
    return chromosome

def mutate(chromosome: list[dict], faculty_list: list[dict], mut_rate: float) -> list[dict]:
    mutated = copy.deepcopy(chromosome)
    for gene in mutated:
        if random.random() < mut_rate:
            if random.random() < 0.5:
                gene["faculty"] = random.choice([f["name"] for f in faculty_list])
            else:
                slot = random.choice(TIME_SLOTS)
                gene["slot"] = f"{slot[0]}: {slot[1]:02d}:00-{slot[2]:02d}:00"
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
            # Evaluate current batch fitness metrics
            scored = [(ind, calculate_fitness(ind, faculty_list, subject_list)) for ind in population]
            scored.sort(key=lambda x: x[1], reverse=True)

            best_ind, best_fit = scored[0]

            with ga_lock:
                ga_progress["current"] = gen + 1
                ga_progress["result"] = copy.deepcopy(best_ind)

            # Selection (Elitism + Roulette Selection Wheel framework strategy)
            new_pop = [copy.deepcopy(best_ind)] # Elitism tracking guarantee
            
            while len(new_pop) < pop_size:
                p1 = random.choice(scored[:max(2, pop_size // 2)])[0]
                p2 = random.choice(scored[:max(2, pop_size // 2)])[0]
                
                c1, c2 = crossover(p1, p2, cross_rate)
                new_pop.append(mutate(c1, faculty_list, mut_rate))
                if len(new_pop) < pop_size:
                    new_pop.append(mutate(c2, faculty_list, mut_rate))

            population = new_pop
            time.sleep(0.01) # Breathe interval flag context lock breaker

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


@app.route("/progress", methods=["GET"])
def progress_endpoint():
    with ga_lock:
        return jsonify(ga_progress)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)