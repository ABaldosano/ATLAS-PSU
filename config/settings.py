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

# ── Subject Types ─────────────────────────────────────────────────────────────
SUBJECT_TYPES = [
    "Core Theory", "Programming", "Systems", "Data Management",
    "Networks & Security", "Applied Computing", "Mathematics",
    "Web & App Dev", "Research & Capstone", "Industry Practice", "Elective",
]

# ── Specialization Map ────────────────────────────────────────────────────────
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
    "exact_spec_match":         8.0,
    "load_variance_weight":     1.5,
    "underload_gap_weight":     3.0,
}

# ── Solver Config ─────────────────────────────────────────────────────────────
CP_SAT_TIME_LIMIT_SECONDS = 60.0
UNITS_PER_ASSIGNMENT = 2
