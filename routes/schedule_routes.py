"""
ATLAS PSU - routes/schedule_routes.py
"""

from flask import Blueprint, jsonify, request

from services.schedule_service import (
    start_scheduling, get_progress,
    get_soft_constraints, set_soft_constraint,
)

schedule_bp = Blueprint("schedule", __name__)


def _ok(data=None, metrics=None, warnings=None):
    return jsonify({
        "success":  True,
        "data":     data or {},
        "metrics":  metrics or {},
        "warnings": warnings or [],
    })


def _err(msg: str, code: int = 400):
    return jsonify({"success": False, "error": msg, "data": {}, "metrics": {}, "warnings": []}), code


# ── /run-ga (backward-compatible: now triggers CP-SAT + GA) ──────────────────

@schedule_bp.route("/run-ga", methods=["POST"])
def run_ga():
    import app as _app

    data = request.get_json() or {}
    if not data:
        return _err("Empty payload.")

    # Cache faculty list for analytics re-compute endpoint
    _app.faculty_runtime_list = data.get("faculty", [])

    result = start_scheduling(
        faculty_raw=data.get("faculty", []),
        subjects_raw=data.get("subjects", []),
        active_semester=data.get("active_semester"),
        ga_params={
            "generations": data.get("generations", 50),
            "population":  data.get("population",  20),
            "mutation":    data.get("mutation",     0.15),
            "crossover":   data.get("crossover",    0.8),
        },
        soft_constraints_incoming=data.get("soft_constraints", {}),
        class_sizes={**_app.class_sizes_store, **data.get("class_sizes", {})},
    )

    if "error" in result:
        return _err(result["error"])
    return jsonify({"status": "started", "sections": result.get("sections", 0)})


# ── /progress ─────────────────────────────────────────────────────────────────

@schedule_bp.route("/progress", methods=["GET"])
def progress():
    p = get_progress()
    return jsonify({
        "current":   p["current"],
        "total":     p["total"],
        "running":   p["running"],
        "phase":     p["phase"],
        "result":    p["result"],
        "analytics": p.get("analytics", {}),
        "metrics":   p.get("metrics", {}),
        "warnings":  p.get("warnings", []),
    })


# ── /soft-constraints ─────────────────────────────────────────────────────────

@schedule_bp.route("/soft-constraints", methods=["GET"])
def get_sc():
    fac = request.args.get("faculty")
    if fac:
        return jsonify({fac: get_soft_constraints(fac)})
    return jsonify(get_soft_constraints())


@schedule_bp.route("/soft-constraints", methods=["POST"])
def set_sc():
    data = request.get_json() or {}
    fac_name = data.get("faculty")
    if not fac_name:
        return _err("faculty name required.")
    for k, v in data.get("constraints", {}).items():
        set_soft_constraint(fac_name, k, v)
    return _ok({"faculty": fac_name, "constraints": get_soft_constraints(fac_name)})
