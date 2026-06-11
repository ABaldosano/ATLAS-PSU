"""
ATLAS PSU - config/settings.py
Central configuration for scheduling engine and system parameters.
"""

# ── Time Grid ─────────────────────────────────────────────────────────────────
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
HOURS = [(7, 9), (9, 11), (13, 15), (15, 17), (17, 19)]
TIME_SLOTS = [(d, h[0], h[1]) for d in DAYS for h in HOURS]  # 30 slots

# ── Room Definitions ──────────────────────────────────────────────────────────
LECTURE_ROOMS = [
    "CL1", "CL2", "CL3",
    "IT Room 1", "IT Room 2", "IT Room 3",
    "GA Bldg 16", "GA Bldg 17", "GA Bldg 18", "GA Bldg 19", "GA Bldg 20",
    "GA Bldg 21", "GA Bldg 22", "GA Bldg 23", "GA Bldg 24", "GA Bldg 25",
]
LABORATORY_ROOMS = ["MTC1", "MTC2", "IT101", "NIT1", "NIT3"]
ALL_ROOMS = LECTURE_ROOMS + LABORATORY_ROOMS

# ── Room Capacity Configuration ───────────────────────────────────────────────
# Each room entry: {recommended, max, penalties: [(threshold, penalty_per_student), ...]}
# Tiered Penalty Constraint: soft penalty when over recommended but under max;
# Hard rejection when student_count > max.
ROOM_CAPACITY = {
    # CL1-CL3: Recommended 35, reject >52 (50% over as realistic hard max)
    "CL1":      {"recommended": 35, "max": 52},
    "CL2":      {"recommended": 35, "max": 52},
    "CL3":      {"recommended": 35, "max": 52},

    # IT Rooms: Recommended 45, reject >60
    "IT Room 1": {"recommended": 45, "max": 60},
    "IT Room 2": {"recommended": 45, "max": 60},
    "IT Room 3": {"recommended": 45, "max": 60},

    # GA Building Rooms: Recommended 40, reject >55
    "GA Bldg 16": {"recommended": 40, "max": 55},
    "GA Bldg 17": {"recommended": 40, "max": 55},
    "GA Bldg 18": {"recommended": 40, "max": 55},
    "GA Bldg 19": {"recommended": 40, "max": 55},
    "GA Bldg 20": {"recommended": 40, "max": 55},
    "GA Bldg 21": {"recommended": 40, "max": 55},
    "GA Bldg 22": {"recommended": 40, "max": 55},
    "GA Bldg 23": {"recommended": 40, "max": 55},
    "GA Bldg 24": {"recommended": 40, "max": 55},
    "GA Bldg 25": {"recommended": 40, "max": 55},

    # MTC1-MTC2: Computer cubicle lab — hard max 45, reject >45
    # Tiers: <=32 comfortable, 33-40 moderate penalty, 41-45 higher penalty
    "MTC1": {"recommended": 32, "max": 45,
              "tiers": [(33, 2.0), (41, 5.0)]},  # per-student penalty per tier start
    "MTC2": {"recommended": 32, "max": 45,
              "tiers": [(33, 2.0), (41, 5.0)]},

    # IT101: Recommended 30, hard max 40
    # Tiers: <=30 ok, 31-35 moderate, 36-40 higher penalty
    "IT101": {"recommended": 30, "max": 40,
               "tiers": [(31, 2.0), (36, 5.0)]},

    # NIT1-NIT3: Recommended 40, hard max 45
    "NIT1": {"recommended": 40, "max": 45},
    "NIT3": {"recommended": 40, "max": 45},
}

# Penalty per student over recommended capacity (default for rooms without tiers)
CAPACITY_OVER_PENALTY_PER_STUDENT = 3.0
# Bonus per student under or at recommended capacity (reward good fit)
CAPACITY_FIT_BONUS = 2.0

# ── Subject Types ─────────────────────────────────────────────────────────────
SUBJECT_TYPES = [
    "Core Theory", "Programming", "Systems", "Data Management",
    "Networks & Security", "Applied Computing", "Mathematics",
    "Web & App Dev", "Research & Capstone", "Industry Practice", "Elective",
]

# ── Specialization Map ────────────────────────────────────────────────────────
SPECIALIZATION_MAP = {
    "Introduction to Computing":                          ["Core Theory", "Elective"],
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
    "Capstone Project and Research 1":                    ["Research & Capstone", "Elective"],
    "Systems Administration and Maintenance":             ["Systems"],
    "Capstone Project and Research 2":                    ["Research & Capstone", "Elective"],
    "IT Elective 4":                                      ["Elective"],
    "Educational Tour in IT Industry":                    ["Industry Practice", "Elective"],
    "Thesis Writing and Colloquium":                      ["Research & Capstone", "Elective"],
    "Practicum (486 Hours)":                              ["Industry Practice", "Elective"],
}

# ── Default Class Sizes ───────────────────────────────────────────────────────
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

# ── GA Optimizer Weights (configurable) ──────────────────────────────────────
GA_WEIGHTS = {
    "preferred_period_match":   5.0,
    "preferred_period_miss":   -2.0,
    "preferred_room_match":     5.0,
    "preferred_room_miss":     -1.0,
    "preferred_building_match": 3.0,
    "preferred_building_miss": -0.5,
    "preferred_floor_match":    2.0,
    "restricted_day_penalty": -12.0,
    "maternity_leave_penalty": -20.0,
    "leave_penalty": -10.0,
    "exact_spec_match":         8.0,
    "load_variance_weight":     1.5,
    "underload_gap_weight":     3.0,
    # Room capacity weights (integrated into fitness)
    "capacity_fit_bonus":       2.0,   # per student under/at recommended
    "capacity_over_penalty":    3.0,   # per student over recommended (default)
    # Building affinity weights
    "building_affinity_bonus":  4.0,   # reward faculty staying in same building per day
    "building_affinity_penalty":-3.0,  # penalise each extra building a faculty uses per day
    "section_cluster_bonus":    3.0,   # reward section staying in same building per day
    "section_cluster_penalty": -2.5,   # penalise each extra building a section uses per day
}

# ── Solver Config ─────────────────────────────────────────────────────────────
CP_SAT_TIME_LIMIT_SECONDS = 60.0
UNITS_PER_ASSIGNMENT = 2