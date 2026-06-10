<div align="center">
<img src="/assets/images/favicon.png" alt="ATLAS PSU" width="72" />

# ATLAS PSU

**Automated Teaching Load Assignment System · Palawan State University · Information Technology Department**

*Hybrid CP-SAT + Genetic Algorithm scheduling engine. Assigns faculty workloads across all sections with zero hard-constraint violations — no templates, no manual scheduling.*

[![Status](https://img.shields.io/badge/status-active%20development-c9a96e?style=flat-square)](#)
[![Built With](https://img.shields.io/badge/built%20with-Python%20%7C%20Flask%20%7C%20Vanilla%20JS-4a90d9?style=flat-square)](#technologies-used)
[![License](https://img.shields.io/badge/license-Proprietary-gray?style=flat-square)](#license)
[![Location](https://img.shields.io/badge/based%20in-Puerto%20Princesa%2C%20Palawan%20🇵🇭-0a7ab8?style=flat-square)](#)

</div>

---

## What Is This?

ATLAS PSU is an institutional-grade **Faculty Workload Assignment System** built for Department Chairpersons at Palawan State University's Information Technology Department. It replaces manual scheduling with a two-phase optimization engine: a CP-SAT constraint solver handles hard-constraint validity in Phase 1, and a Genetic Algorithm optimizes faculty preferences in Phase 2. A third analytics phase computes workload fairness metrics and specialization match rates after each run.

---

## How the Engine Works

**Phase 1 — CP-SAT Solver** (`solver/cp_sat_solver.py`)

Uses Google OR-Tools CP-SAT to generate a conflict-free base schedule. If OR-Tools is not installed, the solver falls back to a deterministic greedy backtracking algorithm with the same hard-constraint guarantees.

Hard constraints enforced:
- Faculty qualification based on specialization map
- Faculty day availability
- Absolute maximum load per faculty (standard: 24 units, overload cap: 30 units per CHED CMO No. 40, s. 2006)
- No faculty double-booking within the same time slot
- No room conflicts within the same time slot
- Room type compatibility (LAB subjects go to laboratory rooms only)
- Full section coverage across all year levels and blocks

**Phase 2 — Genetic Algorithm Optimizer** (`solver/ga_optimizer.py`)

Takes the valid CP-SAT schedule as input and improves slot and room assignments based on faculty soft preferences. It never generates schedules from scratch and never violates hard constraints. Faculty assignments from Phase 1 are authoritative.

**Phase 3 — Analytics** (`services/analytics_service.py`)

Computes faculty utilization, Jain's Fairness Index, load standard deviation, and specialization match rates. Results feed the dashboard and the fairness report section.

---

## Features

- Two-phase optimization: CP-SAT for correctness, GA for preference satisfaction
- Configurable GA parameters: population size, generations, mutation rate, crossover rate
- Soft constraints per faculty: preferred periods, preferred rooms, preferred buildings, restricted days, unavailable dates, leave dates, and maternity leave flags
- Faculty workload balancing with per-faculty load caps and overload detection
- Specialization-aware subject assignment with a full curriculum-to-specialization map
- Room conflict prevention across lecture rooms (CL1-3, IT Room 1-3, GA Bldg 16-25) and laboratory rooms (MTC1, MTC2, IT101, NIT1, NIT3)
- Real-time progress polling during optimization runs
- Timetable grid view by day and time slot
- Workload fairness report with Jain's Index, standard deviation, and per-faculty match accuracy
- Academic period / semester context filter (results filter by active semester)
- Faculty designation support (dean, chairperson, coordinator)
- Research hours reservation per faculty member
- Class size configuration per section (IT1B1 through IT4B3)
- CSV and print-ready PDF export
- Editable rooms, class sizes, and soft constraints synced to the backend at runtime

---

## Technologies Used

**Backend**
- Python 3 / Flask 3.1 / flask-cors
- Google OR-Tools CP-SAT (ortools >= 9.7)
- Custom Genetic Algorithm engine
- Threading-based progress store for non-blocking GA runs

**Frontend**
- Vanilla HTML / CSS / JavaScript (no build step)
- Chart.js for load distribution and fairness charts
- localStorage for persisting faculty, subjects, class sizes, soft constraints, and last GA result across sessions

---

## Project Structure

```
app.py                        Flask bootstrap, runtime-mutable room/class-size stores,
                              and static data endpoints (/rooms, /class-sizes, /subject-types)

config/
  settings.py                 Time grid (30 slots), room definitions, subject types,
                              specialization map, class sizes, GA weights, CP-SAT time limit

solver/
  cp_sat_solver.py            Phase 1: hard constraint solver (OR-Tools + greedy fallback)
  ga_optimizer.py             Phase 2: preference optimizer (never violates hard constraints)
  constraints.py              Qualification, availability, load, and room compatibility checks
  objective_functions.py      Fitness scoring and satisfaction metrics used by the GA

services/
  schedule_service.py         Orchestrates CP-SAT → GA → Analytics; thread-safe progress store
  analytics_service.py        Phase 3: utilization, Jain's Index, std deviation, match rates

routes/
  schedule_routes.py          /run-ga, /progress, /soft-constraints
  analytics_routes.py         /analytics

models/
  faculty.py                  Faculty dataclass (name, specialization, load caps, availability,
                              designation, research hours)
  subject.py                  Subject model
  room.py                     Room model
  schedule.py                 Schedule/assignment model

assets/
  css/main-style.css          Full design system (ATLAS brand: rust orange / slate / off-white)
  js/main-script.js           Frontend logic: GA trigger, panel nav, chart updates, faculty and
                              subject management, export, soft constraints UI, localStorage sync

pages/
  dashboard.html              Main application (5 panels: Dashboard, Optimization, Faculty and
                              Subjects, Reports, Settings)
  login.html                  Department selection and session init

index.html                    Entry point (redirects to login or dashboard)
```

---

## Installation

```bash
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000` in your browser.

**Requirements:**
- `Flask==3.1.3`
- `flask-cors==6.0.2`
- `ortools>=9.7.2996`
- `Werkzeug==3.1.7`

> OR-Tools is strongly recommended. If unavailable, the built-in greedy backtracking solver runs as a fallback with the same hard-constraint guarantees but slower performance on large inputs.

---

## Configuration

Key constants in `config/settings.py`:

| Constant | Default | Description |
|---|---|---|
| `DAYS` | Mon-Sat | Available scheduling days |
| `HOURS` | 5 blocks per day | 07:00-09:00 through 17:00-19:00 |
| `TIME_SLOTS` | 30 total | Cartesian product of days x hours |
| `UNITS_PER_ASSIGNMENT` | 2 | Teaching units counted per assigned slot |
| `CP_SAT_TIME_LIMIT_SECONDS` | 60.0 | OR-Tools solver time limit |
| `GA_WEIGHTS` | See settings.py | Soft preference scoring weights for the GA |

---

## Author

**Arthur V. Baldosano Jr.**
Palawan State University, College of Sciences — Information Technology Department
PSU-SITE President · Full-Stack Developer · Puerto Princesa, Palawan

---

## License

Proprietary. All rights reserved.