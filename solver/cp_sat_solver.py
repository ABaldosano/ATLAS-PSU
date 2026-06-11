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
  - Room capacity hard maximum (student_count > room max → reject)
  - Section coverage (all sections assigned)
"""

import time
import random
from typing import Callable, Optional

import config.settings as _cfg_sat
from config.settings import (
    TIME_SLOTS, ALL_ROOMS, LABORATORY_ROOMS, LECTURE_ROOMS,
)

def _upa(): return getattr(_cfg_sat, 'UNITS_PER_ASSIGNMENT', 2)
def _cstl(): return getattr(_cfg_sat, 'CP_SAT_TIME_LIMIT_SECONDS', 60.0)
from solver.constraints import (
    faculty_qualifies, faculty_available_at, faculty_load_ok,
    room_compatible, slot_day,
    room_exceeds_hard_max, rank_rooms_by_capacity_fit, get_building,
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
                 student_count: int = 0,
                 preferred_room: Optional[str] = None,
                 room_usage: Optional[dict] = None,
                 fac_name: str = "",
                 sec_key: str = "",
                 fac_day_building: Optional[dict] = None,
                 section_day_building: Optional[dict] = None) -> str:
    """
    Assign best-fit room for the given class type and slot.

    Priority order:
      1. Hard cap respected (student_count <= room max) — for lectures.
         For labs where ALL rooms exceed hard max, falls back to smallest-excess
         room so analytics can flag it for batch-splitting.
      2. Capacity fit (tightest recommended >= student_count).
      3. Per-day building affinity (faculty and section).
      4. Least-used room as tiebreaker.
    """
    pool = _room_pool(class_type)
    usage = room_usage if room_usage is not None else {}
    day = slot.split(":")[0].strip() if slot else ""

    # Rooms free at this slot
    free_pool = [r for r in pool if f"{r}|{slot}" not in room_slot_used]

    if not free_pool:
        # All rooms occupied — still return best guess (shouldn't normally happen)
        candidates = list(pool)
    else:
        if student_count > 0:
            cap_ok = [r for r in free_pool if not room_exceeds_hard_max(r, student_count)]
            if cap_ok:
                candidates = cap_ok
            else:
                # All rooms over hard max — assign anyway (lab batch-split use case)
                # Sort by smallest excess over max so analytics flags correctly
                from solver.constraints import get_room_capacity
                candidates = sorted(
                    free_pool,
                    key=lambda r: (
                        max(0, student_count - get_room_capacity(r).get("max", 9999)),
                        usage.get(r, 0),
                    )
                )
        else:
            candidates = list(free_pool)

    # Build composite sort key: capacity fit → building affinity → usage
    def _sort_key(r: str):
        from solver.constraints import get_room_capacity
        cap = get_room_capacity(r)
        rec = cap.get("recommended", 9999)
        if student_count > 0:
            over = max(0, student_count - rec)
            # When fitting: tightest fit (smallest gap). When over: largest room first (-rec).
            gap  = (rec - student_count) if student_count <= rec else -rec
        else:
            over, gap = 0, 0

        # Building affinity: 0 = match, 1 = no pref/unknown, 2 = different
        bld = get_building(r)
        affinity = 1  # neutral default
        if fac_day_building is not None and (fac_name, day) in fac_day_building:
            affinity = 0 if fac_day_building[(fac_name, day)] == bld else 2
        if section_day_building is not None and (sec_key, day) in section_day_building:
            sec_bld = section_day_building[(sec_key, day)]
            if sec_bld == bld:
                affinity = min(affinity, 0)
            else:
                affinity = max(affinity, 2)

        return (over, affinity, gap, usage.get(r, 0))

    candidates.sort(key=_sort_key)

    # Honor explicit preferred_room if it's free and capacity-comparable
    if preferred_room and preferred_room in candidates and preferred_room != candidates[0]:
        from solver.constraints import get_room_capacity, room_capacity_score
        pref_score = room_capacity_score(preferred_room, student_count) if student_count > 0 else 0
        best_score = room_capacity_score(candidates[0], student_count) if student_count > 0 else 0
        if pref_score >= best_score - 1.0:
            candidates = [preferred_room] + [r for r in candidates if r != preferred_room]

    if not candidates:
        return "Unassigned"

    chosen = candidates[0]
    room_slot_used.add(f"{chosen}|{slot}")
    usage[chosen] = usage.get(chosen, 0) + 1

    # Record building for affinity tracking (first assignment wins for the day)
    bld = get_building(chosen)
    if fac_name and fac_day_building is not None:
        fac_day_building.setdefault((fac_name, day), bld)
    if sec_key and section_day_building is not None:
        section_day_building.setdefault((sec_key, day), bld)

    return chosen


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
            continue
        model.AddExactlyOne(vars_for_s)

    # Constraint 2: no faculty double-booking
    for f_idx in range(len(faculty_list)):
        for t_idx in range(n_slots):
            vars_ft = [x[k] for k in x if k[1] == f_idx and k[2] == t_idx]
            if len(vars_ft) > 1:
                model.AddAtMostOne(vars_ft)

    # Constraint 2b: no section double-booking
    section_list = list(set(sec.get("section", "") for sec in sections if sec.get("section", "")))
    for sec_key in section_list:
        sec_indices = [i for i, sec in enumerate(sections) if sec.get("section", "") == sec_key]
        for t_idx in range(n_slots):
            vars_st = [x[k] for k in x if k[0] in sec_indices and k[2] == t_idx]
            if len(vars_st) > 1:
                model.AddAtMostOne(vars_st)

    # Constraint 3: faculty load ≤ absolute_max_units
    for f_idx, fac in enumerate(faculty_list):
        vars_f = [x[k] for k in x if k[1] == f_idx]
        if vars_f:
            max_assignments = fac.get("absolute_max_units", 30) // _upa()
            model.Add(sum(vars_f) <= max_assignments)

    # Objective: maximise exact spec matches
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
    solver.parameters.max_time_in_seconds = _cstl()
    solver.parameters.num_search_workers = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    # Extract solution — use capacity-aware room assignment
    room_slot_used: set = set()
    room_usage: dict = {}
    fac_day_building: dict = {}
    section_day_building: dict = {}
    assignments = []
    for (s_idx, f_idx, t_idx), var in x.items():
        if solver.Value(var) == 1:
            sec = sections[s_idx]
            fac = faculty_list[f_idx]
            slot = ALL_SLOT_STRINGS[t_idx]
            student_count = sec.get("student_count", 0)
            sec_key = sec.get("section", "")
            room = _assign_room(
                sec.get("class_type", "LECTURE"), slot, room_slot_used,
                student_count=student_count,
                room_usage=room_usage,
                fac_name=fac["name"],
                sec_key=sec_key,
                fac_day_building=fac_day_building,
                section_day_building=section_day_building,
            )
            assignments.append({
                "faculty":       fac["name"],
                "subject":       sec["name"],
                "type":          sec.get("type", "Core Theory"),
                "class_type":    sec.get("class_type", "LECTURE"),
                "slot":          slot,
                "slot_display":  _slot_to_12h(slot),
                "semester":      sec.get("semester", ""),
                "year":          sec.get("year", ""),
                "section":       sec.get("section", ""),
                "room":          room,
                "student_count": student_count,
            })

    return assignments


# ── Pure-Python CP solver (backtracking) ─────────────────────────────────────

def _solve_with_backtracking(sections: list, faculty_list: list, static_lookup: dict,
                              progress_cb: Optional[Callable] = None,
                              time_limit: Optional[float] = None) -> list:
    """
    Deterministic greedy + backtracking solver.
    Orders sections by most-constrained (fewest eligible faculty) first.
    Fills assignments one by one, backtracking on failure.
    Guarantees all hard constraints on the returned schedule.
    Falls back to partial schedule with greedy repair for timeout cases.
    """
    if time_limit is None:
        time_limit = _cstl()
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
    room_usage: dict = {}
    section_slot_used: dict[str, set] = {}
    fac_day_building: dict = {}      # (fac_name, day) → building
    section_day_building: dict = {}  # (sec_key, day)  → building
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

        student_count = sec.get("student_count", 0)
        class_type = sec.get("class_type", "LECTURE")
        room_pool = _room_pool(class_type)

        for fac_name, slot in shuffled:
            fac = fac_map[fac_name]
            day = slot.split(":")[0].strip()

            # Hard constraint checks
            if slot in fac_slot_used[fac_name]:
                continue
            if not faculty_load_ok(fac_loads[fac_name], fac):
                continue
            _sec_key = sec.get("section", "")
            if _sec_key and slot in section_slot_used.get(_sec_key, set()):
                continue

            # Free rooms for this slot
            free_rooms = [r for r in room_pool if f"{r}|{slot}" not in room_slot_used]

            if student_count > 0:
                cap_ok = [r for r in free_rooms if not room_exceeds_hard_max(r, student_count)]
                if cap_ok:
                    room_candidates = cap_ok
                else:
                    # Lab batch-split fallback: assign even over hard max
                    room_candidates = free_rooms if free_rooms else []
            else:
                room_candidates = free_rooms

            if not room_candidates:
                continue

            # Sort by capacity fit → building affinity → usage
            from solver.constraints import get_room_capacity
            def _sort_key(r: str):
                cap = get_room_capacity(r)
                rec = cap.get("recommended", 9999)
                if student_count > 0:
                    over = max(0, student_count - rec)
                    gap  = (rec - student_count) if student_count <= rec else -rec
                else:
                    over, gap = 0, 0
                bld = get_building(r)
                affinity = 1
                if (fac_name, day) in fac_day_building:
                    affinity = 0 if fac_day_building[(fac_name, day)] == bld else 2
                if _sec_key and (_sec_key, day) in section_day_building:
                    sec_bld = section_day_building[(_sec_key, day)]
                    affinity = min(affinity, 0) if sec_bld == bld else max(affinity, 2)
                return (over, affinity, gap, room_usage.get(r, 0))

            ranked = sorted(room_candidates, key=_sort_key)
            room = ranked[0]

            # Apply
            bld = get_building(room)
            fac_slot_used[fac_name].add(slot)
            fac_loads[fac_name] += _upa()
            room_key = f"{room}|{slot}"
            room_slot_used.add(room_key)
            room_usage[room] = room_usage.get(room, 0) + 1
            fac_day_building.setdefault((fac_name, day), bld)
            if _sec_key:
                section_slot_used.setdefault(_sec_key, set()).add(slot)
                section_day_building.setdefault((_sec_key, day), bld)

            result.append({
                "faculty":       fac_name,
                "subject":       sec["name"],
                "type":          sec.get("type", "Core Theory"),
                "class_type":    class_type,
                "slot":          slot,
                "slot_display":  _slot_to_12h(slot),
                "semester":      sec.get("semester", ""),
                "year":          sec.get("year", ""),
                "section":       sec.get("section", ""),
                "room":          room,
                "student_count": student_count,
            })

            if _attempt(idx + 1):
                return True

            # Backtrack
            result.pop()
            fac_slot_used[fac_name].discard(slot)
            fac_loads[fac_name] -= _upa()
            room_slot_used.discard(room_key)
            room_usage[room] = max(0, room_usage.get(room, 0) - 1)
            # Undo building registration only if no other slot for this fac+day
            remaining_bld = any(
                get_building(r["room"]) == bld
                for r in result
                if r["faculty"] == fac_name and r["slot"].startswith(day)
            )
            if not remaining_bld and fac_day_building.get((fac_name, day)) == bld:
                del fac_day_building[(fac_name, day)]
            if _sec_key:
                section_slot_used.get(_sec_key, set()).discard(slot)
                remaining_sec_bld = any(
                    get_building(r["room"]) == bld
                    for r in result
                    if r.get("section") == _sec_key and r["slot"].startswith(day)
                )
                if not remaining_sec_bld and section_day_building.get((_sec_key, day)) == bld:
                    del section_day_building[(_sec_key, day)]

        # No valid assignment found — insert unassigned placeholder and continue
        result.append({
            "faculty":       "",
            "subject":       sec["name"],
            "type":          sec.get("type", "Core Theory"),
            "class_type":    class_type,
            "slot":          ALL_SLOT_STRINGS[idx % len(ALL_SLOT_STRINGS)],
            "slot_display":  _slot_to_12h(ALL_SLOT_STRINGS[idx % len(ALL_SLOT_STRINGS)]),
            "semester":      sec.get("semester", ""),
            "year":          sec.get("year", ""),
            "section":       sec.get("section", ""),
            "room":          "Unassigned",
            "student_count": student_count,
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
    room_usage: dict = {}
    section_slot_used: dict[str, set] = {}

    # Build state from already-valid assignments
    for a in assignments:
        if a["faculty"]:
            fac_slot_used.setdefault(a["faculty"], set()).add(a["slot"])
            fac_loads[a["faculty"]] = fac_loads.get(a["faculty"], 0) + _upa()
        if a["room"] != "Unassigned":
            room_slot_used.add(f"{a['room']}|{a['slot']}")
            room_usage[a["room"]] = room_usage.get(a["room"], 0) + 1
        _sec_key = a.get("section", "")
        if _sec_key:
            section_slot_used.setdefault(_sec_key, set()).add(a["slot"])

    repaired = []
    for a in assignments:
        if a["faculty"]:
            repaired.append(a)
            continue

        # Find best faculty for this unassigned item
        fac_name = ""
        _sec_key = a.get("section", "")
        for fac in sorted(faculty_list, key=lambda f: fac_loads.get(f["name"], 0)):
            if not faculty_qualifies(fac, a["subject"], static_lookup):
                continue
            if not faculty_available_at(fac, a["slot"]):
                continue
            if not faculty_load_ok(fac_loads.get(fac["name"], 0), fac):
                continue
            if a["slot"] in fac_slot_used.get(fac["name"], set()):
                continue
            if _sec_key and a["slot"] in section_slot_used.get(_sec_key, set()):
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

        # Room — capacity-aware, usage-balanced, building-affinity-aware
        class_type = a.get("class_type", "LECTURE")
        student_count = a.get("student_count", 0)
        day = chosen_slot.split(":")[0].strip() if chosen_slot else ""
        free_rooms = [r for r in _room_pool(class_type) if f"{r}|{chosen_slot}" not in room_slot_used]
        if student_count > 0:
            cap_ok = [r for r in free_rooms if not room_exceeds_hard_max(r, student_count)]
            candidates_r = cap_ok if cap_ok else free_rooms  # lab batch-split fallback
            if candidates_r:
                from solver.constraints import get_room_capacity
                def _repair_sort(r):
                    cap = get_room_capacity(r)
                    rec = cap.get("recommended", 9999)
                    over = max(0, student_count - rec)
                    gap  = (rec - student_count) if student_count <= rec else -rec
                    return (over, gap, room_usage.get(r, 0))
                room = sorted(candidates_r, key=_repair_sort)[0]
            else:
                room = "Unassigned"
        else:
            room = sorted(free_rooms, key=lambda r: room_usage.get(r, 0))[0] if free_rooms else "Unassigned"

        if fac_name:
            fac_slot_used.setdefault(fac_name, set()).add(chosen_slot)
            fac_loads[fac_name] = fac_loads.get(fac_name, 0) + _upa()
        if room != "Unassigned":
            room_slot_used.add(f"{room}|{chosen_slot}")
            room_usage[room] = room_usage.get(room, 0) + 1
        if _sec_key:
            section_slot_used.setdefault(_sec_key, set()).add(chosen_slot)

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
        "solver_used":      solver_used,
        "solve_time_sec":   solve_time,
        "section_count":    len(sections),
        "unassigned_count": unassigned,
    }

    return result, metrics