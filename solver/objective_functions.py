"""
ATLAS PSU - solver/objective_functions.py
Soft-constraint scoring for GA preference optimizer.
Weights are configurable via config/settings.py GA_WEIGHTS.
"""

from config.settings import GA_WEIGHTS
import config.settings as _cfg_obj
from solver.constraints import room_capacity_score


def score_preference(assignment: dict, soft_constraints: dict,
                     class_sizes: dict = None) -> float:
    """
    Compute soft-preference score for a single assignment.
    Positive = preference satisfied. Negative = preference violated.
    Includes room capacity scoring.
    """
    sc = soft_constraints.get(assignment.get("faculty", ""), {})
    score = 0.0
    slot = assignment.get("slot", "")
    room = assignment.get("room", "")
    w = GA_WEIGHTS

    # Parse slot
    slot_start_hour = -1
    if slot:
        try:
            _, time_part = slot.split(":", 1)
            slot_start_hour = int(time_part.strip().split("-")[0].strip().split(":")[0])
        except Exception:
            pass

    slot_day_str = slot.split(":")[0].strip() if slot else ""

    if sc:
        # Period preference
        preferred_period = sc.get("preferred_period")
        if preferred_period and slot_start_hour >= 0:
            hit = (
                (preferred_period == "morning"   and 7  <= slot_start_hour < 12) or
                (preferred_period == "afternoon" and 12 <= slot_start_hour < 17) or
                (preferred_period == "evening"   and slot_start_hour >= 17)
            )
            score += w["preferred_period_match"] if hit else w["preferred_period_miss"]

        # Room preference
        preferred_room = sc.get("preferred_room")
        if preferred_room and room:
            score += w["preferred_room_match"] if room == preferred_room else w["preferred_room_miss"]

        # Building preference
        preferred_building = sc.get("preferred_building")
        if preferred_building and room:
            score += (w["preferred_building_match"] if preferred_building.lower() in room.lower()
                      else w["preferred_building_miss"])

        # Floor preference
        preferred_floor = sc.get("preferred_floor")
        if preferred_floor and room:
            if str(preferred_floor).lower() in room.lower():
                score += w["preferred_floor_match"]

        # Restricted days
        restricted_days = sc.get("restricted_days", [])
        if restricted_days and slot_day_str and slot_day_str in restricted_days:
            score += w["restricted_day_penalty"]

        # Maternity/leave flag
        if sc.get("maternity_leave"):
            score += w["maternity_leave_penalty"]

        # Date-based unavailability / leave ranges (soft penalty — discourages
        # but does not hard-block, since slots are recurring weekly patterns
        # without concrete calendar dates).
        if sc.get("unavailable_dates") or sc.get("leave_dates"):
            score += w.get("leave_penalty", -10.0)

    # Room capacity score (always applied when room and student count are known)
    if room and room != "Unassigned" and class_sizes:
        section_key = assignment.get("section", "")
        size_entry = class_sizes.get(section_key)
        student_count = size_entry.get("size", 0) if isinstance(size_entry, dict) else 0
        if student_count > 0:
            score += room_capacity_score(room, student_count)

    return score


def schedule_fitness(assignments: list, faculty_list: list, soft_constraints: dict,
                     static_lookup: dict, class_sizes: dict = None) -> float:
    """
    Compute total fitness of a schedule.
    Used by GA to compare candidate improvements.
    Higher = better.
    """
    fac_map = {f["name"]: f for f in faculty_list}
    w = GA_WEIGHTS

    preference_score = sum(
        score_preference(a, soft_constraints, class_sizes) for a in assignments
    )

    # Specialization quality bonus
    spec_score = 0.0
    for a in assignments:
        fac = fac_map.get(a.get("faculty", ""))
        if not fac:
            continue
        from solver.constraints import is_exact_spec_match
        if is_exact_spec_match(fac, a.get("subject", ""), static_lookup):
            spec_score += w["exact_spec_match"]

    # Workload fairness (penalise variance)
    loads = {f["name"]: 0 for f in faculty_list}
    for a in assignments:
        if a.get("faculty") in loads:
            loads[a["faculty"]] += _cfg_obj.UNITS_PER_ASSIGNMENT

    values = list(loads.values())
    variance = 0.0
    if values:
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std_dev = variance ** 0.5
        variance_penalty = variance * w["load_variance_weight"]
        under_penalty = 0.0
        if std_dev > 0:
            for v in values:
                gap = mean - v
                if gap > std_dev:
                    under_penalty += (gap - std_dev) * w["underload_gap_weight"]
    else:
        variance_penalty = 0.0
        under_penalty = 0.0

    # ── Building affinity: reward staying in same building per day ────────────
    from solver.constraints import get_building
    from collections import Counter

    fac_day_buildings:  dict = {}  # (fac, day) → Counter of buildings
    sec_day_buildings:  dict = {}  # (sec, day) → Counter of buildings

    for a in assignments:
        slot = a.get("slot", "")
        room = a.get("room", "")
        if not slot or not room or room == "Unassigned":
            continue
        day = slot.split(":")[0].strip()
        bld = get_building(room)
        fac = a.get("faculty", "")
        sec = a.get("section", "")
        if fac:
            fac_day_buildings.setdefault((fac, day), Counter())[bld] += 1
        if sec:
            sec_day_buildings.setdefault((sec, day), Counter())[bld] += 1

    affinity_score = 0.0
    bld_bonus   = w.get("building_affinity_bonus",   4.0)
    bld_penalty = w.get("building_affinity_penalty", -3.0)
    for counter in fac_day_buildings.values():
        n_buildings = len(counter)
        if n_buildings == 1:
            affinity_score += bld_bonus * 2           # fully consolidated
        else:
            affinity_score += bld_penalty * (n_buildings - 1)

    sec_bonus   = w.get("section_cluster_bonus",    3.0)
    sec_penalty = w.get("section_cluster_penalty", -2.5)
    for counter in sec_day_buildings.values():
        n_buildings = len(counter)
        if n_buildings == 1:
            affinity_score += sec_bonus * 2
        else:
            affinity_score += sec_penalty * (n_buildings - 1)

    return preference_score + spec_score - variance_penalty - under_penalty + affinity_score


def compute_satisfaction_metrics(assignments: list, faculty_list: list,
                                  soft_constraints: dict,
                                  class_sizes: dict = None) -> dict:
    """
    Returns per-faculty and aggregate satisfaction metrics.
    """
    if not assignments:
        return {"aggregate_satisfaction_pct": 0.0, "faculty_satisfaction": {}}

    fac_assignments = {}
    for a in assignments:
        fac_assignments.setdefault(a["faculty"], []).append(a)

    faculty_satisfaction = {}
    total_score = 0.0
    total_possible = 0.0

    for fac_name, fac_assigns in fac_assignments.items():
        sc = soft_constraints.get(fac_name, {})
        if not sc:
            faculty_satisfaction[fac_name] = {"satisfaction_pct": 100.0, "score": 0.0}
            continue

        raw = sum(score_preference(a, {fac_name: sc}, class_sizes) for a in fac_assigns)
        # Max possible: every preference satisfied
        max_possible = len(fac_assigns) * (
            GA_WEIGHTS["preferred_period_match"] +
            GA_WEIGHTS["preferred_room_match"] +
            GA_WEIGHTS["preferred_building_match"] +
            GA_WEIGHTS["preferred_floor_match"]
        )
        pct = max(0.0, min(100.0, (raw / max_possible * 100) if max_possible > 0 else 100.0))
        faculty_satisfaction[fac_name] = {
            "satisfaction_pct": round(pct, 1),
            "score": round(raw, 2),
        }
        total_score += raw
        total_possible += max_possible

    agg = max(0.0, min(100.0,
        (total_score / total_possible * 100) if total_possible > 0 else 100.0
    ))
    return {
        "aggregate_satisfaction_pct": round(agg, 1),
        "faculty_satisfaction": faculty_satisfaction,
    }