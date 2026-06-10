"""
ATLAS PSU - services/schedule_service.py
Orchestrates Phase 1 (CP-SAT) → Phase 2 (GA) → Phase 3 (Analytics).
Thread-safe progress store for polling endpoint.
"""

import copy
import threading
import time

from config.settings import SPECIALIZATION_MAP, DEFAULT_CLASS_SIZES
from solver.cp_sat_solver import solve as cp_solve
from solver.ga_optimizer import optimize as ga_optimize
from services.analytics_service import compute_analytics

# ── Progress store (thread-safe) ──────────────────────────────────────────────

_lock = threading.Lock()
_progress = {
    "current":   0,
    "total":     0,
    "running":   False,
    "phase":     "",        # "cp_sat" | "ga" | "done"
    "result":    [],
    "analytics": {},
    "metrics":   {},
    "warnings":  [],
}


def get_progress() -> dict:
    with _lock:
        return copy.deepcopy(_progress)


def is_running() -> bool:
    with _lock:
        return _progress["running"]


def _set_progress(**kwargs):
    with _lock:
        _progress.update(kwargs)


# ── Static lookup cache ───────────────────────────────────────────────────────

_static_lookup: dict = {}
_lookup_lock = threading.Lock()


def build_static_lookup(subjects: list) -> dict:
    global _static_lookup
    with _lookup_lock:
        lookup = copy.deepcopy(SPECIALIZATION_MAP)
        for s in subjects:
            name = s.get("name", "").strip()
            if name and name not in lookup:
                lookup[name] = ["Elective"]
        _static_lookup = lookup
        return lookup


def get_static_lookup() -> dict:
    with _lookup_lock:
        return copy.deepcopy(_static_lookup)


# ── Section expansion ─────────────────────────────────────────────────────────

def expand_subjects_to_sections(subjects_raw: list, active_semester: str,
                                  class_sizes: dict) -> list:
    """
    Expand subject definitions to (subject × section) pairs.
    Each pair becomes one scheduling unit.
    """
    filtered = subjects_raw
    if active_semester:
        filtered = [s for s in subjects_raw
                    if not s.get("semester") or s.get("semester") == active_semester]

    sections = []
    for s in filtered:
        if not s.get("name"):
            continue
        year = s.get("year", "")
        sec_keys = sorted([
            k for k, v in class_sizes.items() if v.get("year") == year
        ]) if year else [""]
        if not sec_keys:
            sec_keys = [""]

        for sec_key in sec_keys:
            sections.append({
                "name":       s.get("name", ""),
                "type":       s.get("type", "Core Theory"),
                "class_type": s.get("class_type", "LECTURE"),
                "hours":      int(s.get("hours", 2)),
                "semester":   s.get("semester", active_semester or ""),
                "year":       year,
                "section":    sec_key,
            })
    return sections


# ── Soft constraint store ─────────────────────────────────────────────────────

_soft_constraints: dict = {}
_sc_lock = threading.Lock()


def get_soft_constraints(faculty_name: str = None) -> dict:
    with _sc_lock:
        if faculty_name:
            return copy.deepcopy(_soft_constraints.get(faculty_name, {}))
        return copy.deepcopy(_soft_constraints)


def set_soft_constraint(faculty_name: str, key: str, value) -> None:
    with _sc_lock:
        _soft_constraints.setdefault(faculty_name, {})[key] = value


def load_soft_constraints(incoming: dict) -> None:
    with _sc_lock:
        for fac_name, constraints in incoming.items():
            if isinstance(constraints, dict):
                _soft_constraints.setdefault(fac_name, {}).update(constraints)


# ── Main scheduling job ───────────────────────────────────────────────────────

def run_scheduling_job(
    faculty_list: list,
    sections: list,
    static_lookup: dict,
    ga_params: dict,
    class_sizes: dict,
) -> None:
    """
    Background thread: CP-SAT → GA → Analytics.
    Updates _progress throughout.
    """
    try:
        _set_progress(running=True, phase="cp_sat", current=0, result=[], warnings=[])
        sc = get_soft_constraints()

        # ── Phase 1: CP-SAT ───────────────────────────────────────────────────
        def cp_progress(done, total):
            pct = int(done / total * 40) if total else 0  # CP-SAT = 0-40%
            _set_progress(current=pct, total=100)

        cp_assignments, cp_metrics = cp_solve(sections, faculty_list, static_lookup, cp_progress)

        _set_progress(phase="ga", current=40)

        # ── Phase 2: GA optimizer ─────────────────────────────────────────────
        generations    = max(1, ga_params.get("generations", 50))
        population     = max(4, ga_params.get("population", 20))
        mutation_rate  = float(ga_params.get("mutation", 0.15))

        def ga_progress(gen, total):
            pct = 40 + int(gen / total * 50) if total else 40  # GA = 40-90%
            _set_progress(current=pct, total=100)

        best_assignments, ga_metrics = ga_optimize(
            base_schedule=cp_assignments,
            faculty_list=faculty_list,
            static_lookup=static_lookup,
            soft_constraints=sc,
            generations=generations,
            population_size=population,
            mutation_rate=mutation_rate,
            progress_cb=ga_progress,
        )

        _set_progress(current=90, phase="analytics")

        # ── Phase 3: Analytics ────────────────────────────────────────────────
        combined_metrics = {**cp_metrics, **ga_metrics}
        analytics = compute_analytics(
            best_assignments, faculty_list, static_lookup, sc, combined_metrics
        )

        # Warnings
        warnings = []
        unassigned = sum(1 for a in best_assignments if not a.get("faculty"))
        if unassigned:
            warnings.append(f"{unassigned} section(s) could not be assigned to any faculty.")
        if cp_metrics.get("solver_used") == "cp_backtracking":
            warnings.append("OR-Tools not available — used backtracking solver.")

        _set_progress(
            current=100,
            total=100,
            running=False,
            phase="done",
            result=best_assignments,
            analytics=analytics,
            metrics=combined_metrics,
            warnings=warnings,
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        _set_progress(
            running=False,
            phase="error",
            warnings=[f"Scheduling engine error: {str(e)}"],
        )


def start_scheduling(
    faculty_raw: list,
    subjects_raw: list,
    active_semester: str,
    ga_params: dict,
    soft_constraints_incoming: dict,
    class_sizes: dict,
) -> dict:
    """
    Validate inputs, build sections, start background thread.
    Returns {status} or {error}.
    """
    if is_running():
        return {"error": "Scheduling is already running."}

    if not faculty_raw:
        return {"error": "No faculty provided."}
    if not subjects_raw:
        return {"error": "No subjects provided."}

    # Load soft constraints
    if soft_constraints_incoming:
        load_soft_constraints(soft_constraints_incoming)

    sections = expand_subjects_to_sections(subjects_raw, active_semester, class_sizes)
    if not sections:
        return {"error": "No sections generated. Check semester and subject data."}

    static_lookup = build_static_lookup(subjects_raw)

    thread = threading.Thread(
        target=run_scheduling_job,
        args=(faculty_raw, sections, static_lookup, ga_params, class_sizes),
        daemon=True,
    )
    thread.start()

    return {"status": "started", "sections": len(sections)}
