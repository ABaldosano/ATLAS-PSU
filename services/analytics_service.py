"""
ATLAS PSU - services/analytics_service.py
Faculty Workload Analytics - Phase 3.
Pure computation — no Flask dependencies.
"""

from config.settings import UNITS_PER_ASSIGNMENT
from solver.constraints import get_required_specs, is_exact_spec_match
from solver.objective_functions import compute_satisfaction_metrics


def compute_analytics(assignments: list, faculty_list: list, static_lookup: dict,
                       soft_constraints: dict, solver_metrics: dict) -> dict:
    """
    Compute all analytics from a completed schedule.

    Returns:
        Full analytics payload matching Phase 3 spec.
    """
    if not assignments or not faculty_list:
        return _empty_analytics()

    fac_map = {f["name"]: f for f in faculty_list}

    # ── Faculty load per person ───────────────────────────────────────────────
    fac_loads: dict = {f["name"]: 0 for f in faculty_list}
    fac_subjects: dict = {f["name"]: [] for f in faculty_list}
    for a in assignments:
        if a.get("faculty"):
            fac_loads[a["faculty"]] = fac_loads.get(a["faculty"], 0) + UNITS_PER_ASSIGNMENT
            fac_subjects.setdefault(a["faculty"], []).append(a)

    # ── Faculty utilization ───────────────────────────────────────────────────
    faculty_utilization = []
    for f in faculty_list:
        name = f["name"]
        assigned = fac_loads.get(name, 0)
        available = f.get("max_units", 24)
        abs_max = f.get("absolute_max_units", 30)
        util_pct = round(assigned / available * 100, 1) if available > 0 else 0.0
        faculty_utilization.append({
            "faculty":          name,
            "assigned_units":   assigned,
            "max_units":        available,
            "absolute_max":     abs_max,
            "utilization_pct":  util_pct,
            "status": (
                "overload"   if assigned > abs_max  else
                "max_load"   if assigned > available else
                "normal"     if assigned > 0         else
                "unassigned"
            ),
        })

    # ── Workload distribution ─────────────────────────────────────────────────
    load_values = [fac_loads[f["name"]] for f in faculty_list]
    n = len(load_values) or 1
    mean_load = sum(load_values) / n
    sorted_loads = sorted(load_values)
    mid = n // 2
    median_load = (sorted_loads[mid] if n % 2 == 1
                   else (sorted_loads[mid - 1] + sorted_loads[mid]) / 2)

    max_units_per_fac = {f["name"]: f.get("max_units", 24) for f in faculty_list}
    abs_max_per_fac = {f["name"]: f.get("absolute_max_units", 30) for f in faculty_list}
    overload_count  = sum(1 for f in faculty_list if fac_loads[f["name"]] > abs_max_per_fac[f["name"]])
    at_max_count    = sum(1 for f in faculty_list if max_units_per_fac[f["name"]] < fac_loads[f["name"]] <= abs_max_per_fac[f["name"]])
    underload_count = sum(1 for f in faculty_list if 0 < fac_loads[f["name"]] < max_units_per_fac[f["name"]])
    unassigned_count = sum(1 for f in faculty_list if fac_loads[f["name"]] == 0)

    workload_distribution = {
        "mean_load":       round(mean_load, 2),
        "median_load":     round(median_load, 2),
        "overload_count":  overload_count,
        "at_max_count":    at_max_count,
        "underload_count": underload_count,
        "unassigned_count": unassigned_count,
        "total_faculty":   len(faculty_list),
    }

    # ── Specialization metrics ────────────────────────────────────────────────
    total_assignments = len(assignments)
    exact_matches = 0
    mismatches = 0

    for a in assignments:
        fac = fac_map.get(a.get("faculty", ""))
        if not fac:
            mismatches += 1
            continue
        subj = a.get("subject", "")
        if subj.startswith("IT Elective"):
            exact_matches += 1
            continue
        if is_exact_spec_match(fac, subj, static_lookup):
            exact_matches += 1
        else:
            mismatches += 1

    acceptable = total_assignments - exact_matches - mismatches
    spec_metrics = {
        "total_assignments": total_assignments,
        "exact_match_count": exact_matches,
        "mismatch_count":    mismatches,
        "exact_match_pct":   round(exact_matches / total_assignments * 100, 1) if total_assignments else 0.0,
        "mismatch_pct":      round(mismatches / total_assignments * 100, 1)    if total_assignments else 0.0,
    }

    # ── Room utilization ──────────────────────────────────────────────────────
    from config.settings import ALL_ROOMS, TIME_SLOTS
    total_slots = len(TIME_SLOTS)
    room_usage: dict = {}
    for a in assignments:
        if a.get("room") and a["room"] != "Unassigned":
            room_usage[a["room"]] = room_usage.get(a["room"], 0) + 1

    room_utilization = []
    for room in ALL_ROOMS:
        used = room_usage.get(room, 0)
        occupancy_pct = round(used / total_slots * 100, 1)
        room_utilization.append({
            "room": room,
            "assigned_count": used,
            "total_slots": total_slots,
            "occupancy_pct": occupancy_pct,
        })
    room_utilization.sort(key=lambda r: r["occupancy_pct"], reverse=True)

    # ── Satisfaction metrics ──────────────────────────────────────────────────
    satisfaction = compute_satisfaction_metrics(assignments, faculty_list, soft_constraints)

    # ── Compose result ────────────────────────────────────────────────────────
    return {
        "faculty_utilization":    faculty_utilization,
        "workload_distribution":  workload_distribution,
        "specialization_metrics": spec_metrics,
        "room_utilization":       room_utilization,
        "satisfaction_metrics":   satisfaction,
        "optimization_metrics":   {
            "cp_sat_time_sec":    solver_metrics.get("solve_time_sec", 0),
            "ga_time_sec":        solver_metrics.get("ga_time_sec", 0),
            "total_runtime_sec":  round(
                solver_metrics.get("solve_time_sec", 0) +
                solver_metrics.get("ga_time_sec", 0), 3
            ),
            "solver_used":        solver_metrics.get("solver_used", "unknown"),
            "ga_improvement":     solver_metrics.get("improvement", 0),
            "ga_generations_run": solver_metrics.get("generations_run", 0),
        },
    }


def _empty_analytics() -> dict:
    return {
        "faculty_utilization":    [],
        "workload_distribution":  {},
        "specialization_metrics": {},
        "room_utilization":       [],
        "satisfaction_metrics":   {},
        "optimization_metrics":   {},
    }
