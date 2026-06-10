<div align="center">
<img src="/assets/images/favicon.png" alt="ATLAS PSU" width="72" />

# ATLAS PSU

**Automated Teaching Load Assignment System · Palawan State University · College of Sciences**

*Hybrid CP-SAT + Genetic Algorithm scheduling engine. Assigns faculty workloads with zero hard-constraint violations — no templates, no manual scheduling.*

[![Status](https://img.shields.io/badge/status-active%20development-c9a96e?style=flat-square)](#)
[![Built With](https://img.shields.io/badge/built%20with-Python%20%7C%20Flask%20%7C%20Vanilla%20JS-4a90d9?style=flat-square)](#technologies-used)
[![License](https://img.shields.io/badge/license-Proprietary-gray?style=flat-square)](#license)
[![Location](https://img.shields.io/badge/based%20in-Puerto%20Princesa%2C%20Palawan%20🇵🇭-0a7ab8?style=flat-square)](#)

</div>

---

## What Is This?

ATLAS PSU is an institutional-grade **Faculty Workload Assignment System** built for Department Chairpersons of the College of Sciences at Palawan State University. It replaces manual scheduling with a two-phase optimization engine: a CP-SAT constraint solver guarantees hard-constraint validity, followed by a Genetic Algorithm that optimizes faculty preferences. All 77 assignments, zero conflicts.

---

## Features

- **CP-SAT Constraint Solver** — deterministic, conflict-free schedule generation
- **Genetic Algorithm Optimizer** — preference-based secondary optimization
- Faculty workload balancing and load distribution
- Specialization-aware subject assignment
- Room conflict prevention (lecture and laboratory)
- Faculty availability enforcement
- Analytics dashboard with utilization and satisfaction metrics
- Load distribution reports

---

## Technologies Used

- Python · Flask · OR-Tools CP-SAT
- HTML · CSS · Vanilla JavaScript
- Genetic Algorithm (custom engine)

---

## Project Structure

```
app.py                  ← Flask bootstrap
config/settings.py      ← Constants, weights, solver config
solver/
  cp_sat_solver.py      ← Phase 1: hard constraint solver
  ga_optimizer.py       ← Phase 2: preference optimizer
  constraints.py
  objective_functions.py
services/
  schedule_service.py
  analytics_service.py
routes/
  schedule_routes.py
  analytics_routes.py
models/                 ← Faculty, Subject, Room, Schedule
```

---

## Installation

```bash
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000` in your browser.

> **Note:** OR-Tools is used when available. A pure-Python backtracking solver runs as fallback if OR-Tools is not installed.

---

## Author

**Arthur V. Baldosano Jr.**
Palawan State University — College of Sciences
PSU-SITE President · Full-Stack Developer · Puerto Princesa, Palawan

---

## License

Proprietary. All rights reserved.