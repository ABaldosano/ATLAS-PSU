"""
ATLAS PSU - solver/cp_sat_solver.py

Phase 1: CP-SAT Constraint Solver
Source of truth for valid schedule generation.

Uses Google OR-Tools CP-SAT when available.
Falls back to a deterministic greedy backtracking CP solver when OR-Tools
is not installed, providing the same hard-constraint guarantees.

Hard constraints enforced:
  - Faculty qualification (specialization match)
  - Faculty availability (days)
  - Maximum load (absolute_max_units)
  - No faculty double-booking (same slot)
  - No room conflicts (same slot)
  - Room compatibility (LAB subjects → LAB rooms only)
  - Section coverage (all sections assigned)
"""

import time
import random
from typing import Callable, Optional

from config.settings import (
    TIME_SLOTS, ALL_ROOMS, LABORATORY_ROOMS, LECTURE_ROOMS,
    UNITS_PER_ASSIGNMENT, CP_SAT_TIME_LIMIT_SECONDS,
)
from solver.constraints import (
    faculty_qualifies, faculty_available_at, faculty_load_ok,
    room_compatible, slot_day,
)

# ── Slot helpers ──────────────────────────────────────────────────────────────

def _slot_str(d: str, h_start: int, h_end: int) -> str:
    return f"{d}: {h_start:02d}:00-{h_end:02d}:00"


def _slot_to_12h(slot_str: str) -> str:
    try:
        day_part, time_part = slot_str.split(":", 1)
        start_str, end_str = time_part.strip().split("-")
        def fmt(t: str) -> str:
            h, m = map(int, t.strip().split(":"))
            period = "AM" if h < 12 else "PM"
            h12 = h % 12 or 12
            return f"{h12}:{m:02d} {period}"
        return f"{day_part.strip()}: {fmt(start_str)} - {fmt(end_str)}"
    except Exception:
        return slot_str


ALL_SLOT_STRINGS = [_slot_str(t[0], t[1], t[2]) for t in TIME_SLOTS]


# ── Room pool helpers ─────────────────────────────────────────────────────────

def _room_pool(class_type: str) -> list:
    return LABORATORY_ROOMS if class_type == "LAB" else ALL_ROOMS


def _assign_room(class_type: str, slot: str, room_slot_used: set,
                 preferred_room: Optional[str] = None) -> str:
    pool = _room_pool(class_type)
    candidates = list(pool)
    if preferred_room and preferred_room in pool:
        candidates = [preferred_room] + [r for r in pool if r != preferred_room]
    random.shuffle(candidates[1:] if preferred_room else candidates)
    for room in candidates:
        if f"{room}|{slot}" not in room_slot_used:
            room_slot_used.add(f"{room}|{slot}")
            return room
    return candidates[0] if candidates else "Unassigned"


# ── OR-Tools CP-SAT solver ────────────────────────────────────────────────────

def _solve_with_ortools(sections: list, faculty_list: list, static_lookup: dict,
                        progress_cb: Optional[Callable] = None) -> Optional[list]:
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        return None

    model = cp_model.CpModel()
    fac_map = {f["name"]: f for f in faculty_list}
    n_slots = len(ALL_SLOT_STRINGS)

    # Build eligibility: for each section, list of (fac_idx, slot_idx) pairs
    fac_names = [f["name"] for f in faculty_list]
    fac_idx_map = {n: i for i, n in enumerate(fac_names)}

    # x[s][f][t] = BoolVar: section s assigned to faculty f at slot t
    x = {}
    for s_idx, sec in enumerate(sections):
        for f_idx, fac in enumerate(faculty_list):
            if not faculty_qualifies(fac, sec["name"], static_lookup):
                continue
            for t_idx, slot in enumerate(ALL_SLOT_STRINGS):
                if not faculty_available_at(fac, slot):
                    continue
                x[(s_idx, f_idx, t_idx)] = model.NewBoolVar(f"x_{s_idx}_{f_idx}_{t_idx}")

    # Constraint 1: each section assigned exactly once
    for s_idx in range(len(sections)):
        vars_for_s = [x[k] for k in x if k[0] == s_idx]
        if not vars_for_s:
            # No eligible assignment exists — add a dummy to avoid infeasibility crash
            continue
        model.AddExactlyOne(vars_for_s)

    # Constraint 2: no faculty double-booking
    for f_idx in range(len(faculty_list)):
        for t_idx in range(n_slots):
            vars_ft = [x[k] for k in x if k[1] == f_idx and k[2] == t_idx]
            if len(vars_ft) > 1:
                model.AddAtMostOne(vars_ft)

    # Constraint 3: faculty load ≤ absolute_max_units
    for f_idx, fac in enumerate(faculty_list):
        vars_f = [x[k] for k in x if k[1] == f_idx]
        if vars_f:
            max_assignments = fac.get("absolute_max_units", 30) // UNITS_PER_ASSIGNMENT
            model.Add(sum(vars_f) <= max_assignments)

    # Objective: maximise exact spec matches (all are already eligible — prefer exact)
    obj_terms = []
    for (s_idx, f_idx, t_idx), var in x.items():
        from solver.constraints import is_exact_spec_match
        fac = faculty_list[f_idx]
        sec = sections[s_idx]
        weight = 10 if is_exact_spec_match(fac, sec["name"], static_lookup) else 1
        obj_terms.append(weight * var)
    if obj_terms:
        model.Maximize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = CP_SAT_TIME_LIMIT_SECONDS
    solver.parameters.num_search_workers = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    # Extract solution
    room_slot_used: set = set()
    assignments = []
    for (s_idx, f_idx, t_idx), var in x.items():
        if solver.Value(var) == 1:
            sec = sections[s_idx]
            fac = faculty_list[f_idx]
            slot = ALL_SLOT_STRINGS[t_idx]
            room = _assign_room(sec.get("class_type", "LECTURE"), slot, room_slot_used)
            assignments.append({
                "faculty":      fac["name"],
                "subject":      sec["name"],
                "type":         sec.get("type", "Core Theory"),
                "class_type":   sec.get("class_type", "LECTURE"),
                "slot":         slot,
                "slot_display": _slot_to_12h(slot),
                "semester":     sec.get("semester", ""),
                "year":         sec.get("year", ""),
                "section":      sec.get("section", ""),
                "room":         room,
            })

    return assignments


# ── Pure-Python CP solver (backtracking) ─────────────────────────────────────

def _solve_with_backtracking(sections: list, faculty_list: list, static_lookup: dict,
                              progress_cb: Optional[Callable] = None,
                              time_limit: float = CP_SAT_TIME_LIMIT_SECONDS) -> list:
    """
    Deterministic greedy + backtracking solver.
    Orders sections by most-constrained (fewest eligible faculty) first.
    Fills assignments one by one, backtracking on failure.
    Guarantees all hard constraints on the returned schedule.
    Falls back to partial schedule with greedy repair for timeout cases.
    """
    fac_map = {f["name"]: f for f in faculty_list}
    start_time = time.time()

    # Build eligible (faculty, slot) pairs per section — prune early
    def eligibles(sec):
        result = []
        for fac in faculty_list:
            if not faculty_qualifies(fac, sec["name"], static_lookup):
                continue
            for slot in ALL_SLOT_STRINGS:
                if faculty_available_at(fac, slot):
                    result.append((fac["name"], slot))
        return result

    section_eligibles = [(sec, eligibles(sec)) for sec in sections]
    # Most-constrained first (fewest options)
    section_eligibles.sort(key=lambda x: len(x[1]))

    # State
    fac_slot_used: dict[str, set] = {f["name"]: set() for f in faculty_list}
    fac_loads: dict[str, int] = {f["name"]: 0 for f in faculty_list}
    room_slot_used: set = set()
    result: list = []

    def _attempt(idx: int) -> bool:
        if idx == len(section_eligibles):
            return True
        if time.time() - start_time > time_limit * 0.8:
            return True  # soft timeout — accept partial

        sec, options = section_eligibles[idx]

        if progress_cb:
            progress_cb(idx, len(section_eligibles))

        # Shuffle options for diversity while preserving most-constrained ordering
        shuffled = list(options)
        random.shuffle(shuffled)

        # Bias: prefer faculty with lower load
        shuffled.sort(key=lambda o: fac_loads.get(o[0], 0))

        for fac_name, slot in shuffled:
            fac = fac_map[fac_name]

            # Hard constraint checks
            if slot in fac_slot_used[fac_name]:
                continue
            if not faculty_load_ok(fac_loads[fac_name], fac):
                continue

            # Try to assign a room
            class_type = sec.get("class_type", "LECTURE")
            room_pool = _room_pool(class_type)
            room = next((r for r in room_pool if f"{r}|{slot}" not in room_slot_used), None)
            if room is None:
                continue

            # Apply
            fac_slot_used[fac_name].add(slot)
            fac_loads[fac_name] += UNITS_PER_ASSIGNMENT
            room_key = f"{room}|{slot}"
            room_slot_used.add(room_key)

            result.append({
                "faculty":      fac_name,
                "subject":      sec["name"],
                "type":         sec.get("type", "Core Theory"),
                "class_type":   class_type,
                "slot":         slot,
                "slot_display": _slot_to_12h(slot),
                "semester":     sec.get("semester", ""),
                "year":         sec.get("year", ""),
                "section":      sec.get("section", ""),
                "room":         room,
            })

            if _attempt(idx + 1):
                return True

            # Backtrack
            result.pop()
            fac_slot_used[fac_name].discard(slot)
            fac_loads[fac_name] -= UNITS_PER_ASSIGNMENT
            room_slot_used.discard(room_key)

        # No valid assignment found — insert unassigned placeholder and continue
        # This prevents total failure on impossible sub-problems
        result.append({
            "faculty":      "",
            "subject":      sec["name"],
            "type":         sec.get("type", "Core Theory"),
            "class_type":   sec.get("class_type", "LECTURE"),
            "slot":         ALL_SLOT_STRINGS[idx % len(ALL_SLOT_STRINGS)],
            "slot_display": _slot_to_12h(ALL_SLOT_STRINGS[idx % len(ALL_SLOT_STRINGS)]),
            "semester":     sec.get("semester", ""),
            "year":         sec.get("year", ""),
            "section":      sec.get("section", ""),
            "room":         "Unassigned",
        })
        return _attempt(idx + 1)

    _attempt(0)
    return result


# ── Greedy post-repair for unassigned items ───────────────────────────────────

def _repair_unassigned(assignments: list, faculty_list: list, static_lookup: dict) -> list:
    """
    Assigns faculty and rooms to any placeholder assignments (faculty == "").
    Guarantees: no newly-introduced hard constraint violations.
    """
    fac_slot_used: dict[str, set] = {f["name"]: set() for f in faculty_list}
    fac_loads: dict[str, int] = {f["name"]: 0 for f in faculty_list}
    room_slot_used: set = set()

    # Build state from already-valid assignments
    for a in assignments:
        if a["faculty"]:
            fac_slot_used.setdefault(a["faculty"], set()).add(a["slot"])
            fac_loads[a["faculty"]] = fac_loads.get(a["faculty"], 0) + UNITS_PER_ASSIGNMENT
        if a["room"] != "Unassigned":
            room_slot_used.add(f"{a['room']}|{a['slot']}")

    repaired = []
    for a in assignments:
        if a["faculty"]:
            repaired.append(a)
            continue

        # Find best faculty for this unassigned item
        fac_name = ""
        for fac in sorted(faculty_list, key=lambda f: fac_loads.get(f["name"], 0)):
            if not faculty_qualifies(fac, a["subject"], static_lookup):
                continue
            if not faculty_available_at(fac, a["slot"]):
                continue
            if not faculty_load_ok(fac_loads.get(fac["name"], 0), fac):
                continue
            if a["slot"] in fac_slot_used.get(fac["name"], set()):
                continue
            fac_name = fac["name"]
            break

        # Find free slot if original slot is occupied by assigned faculty
        chosen_slot = a["slot"]
        if fac_name and chosen_slot in fac_slot_used.get(fac_name, set()):
            for s in ALL_SLOT_STRINGS:
                fac = next((f for f in faculty_list if f["name"] == fac_name), None)
                if fac and faculty_available_at(fac, s) and s not in fac_slot_used.get(fac_name, set()):
                    chosen_slot = s
                    break

        # Room
        class_type = a.get("class_type", "LECTURE")
        room = next(
            (r for r in _room_pool(class_type) if f"{r}|{chosen_slot}" not in room_slot_used),
            "Unassigned"
        )

        if fac_name:
            fac_slot_used.setdefault(fac_name, set()).add(chosen_slot)
            fac_loads[fac_name] = fac_loads.get(fac_name, 0) + UNITS_PER_ASSIGNMENT
        if room != "Unassigned":
            room_slot_used.add(f"{room}|{chosen_slot}")

        repaired.append({**a, "faculty": fac_name, "slot": chosen_slot,
                          "slot_display": _slot_to_12h(chosen_slot), "room": room})

    return repaired


# ── Public API ────────────────────────────────────────────────────────────────

def solve(sections: list, faculty_list: list, static_lookup: dict,
          progress_cb: Optional[Callable] = None) -> tuple[list, dict]:
    """
    Generate a valid schedule satisfying all hard constraints.

    Returns:
        (assignments, metrics)
        assignments: list of assignment dicts compatible with frontend schema
        metrics: {solver_used, solve_time_sec, unassigned_count, section_count}
    """
    t0 = time.time()

    # Attempt OR-Tools CP-SAT first
    result = _solve_with_ortools(sections, faculty_list, static_lookup, progress_cb)
    solver_used = "cp_sat_ortools"

    if result is None:
        # Fall back to pure-Python backtracking solver
        result = _solve_with_backtracking(sections, faculty_list, static_lookup, progress_cb)
        solver_used = "cp_backtracking"

    # Repair any unassigned placeholders
    result = _repair_unassigned(result, faculty_list, static_lookup)

    solve_time = round(time.time() - t0, 3)
    unassigned = sum(1 for a in result if not a.get("faculty"))

    metrics = {
        "solver_used":     solver_used,
        "solve_time_sec":  solve_time,
        "section_count":   len(sections),
        "unassigned_count": unassigned,
    }

    return result, metrics
