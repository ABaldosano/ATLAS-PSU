"""
ATLAS PSU - routes/analytics_routes.py
"""

from flask import Blueprint, jsonify, request

from services.schedule_service import get_progress, get_soft_constraints, get_static_lookup
from services.analytics_service import compute_analytics

analytics_bp = Blueprint("analytics", __name__)


def _ok(data=None, metrics=None, warnings=None):
    return jsonify({
        "success":  True,
        "data":     data or {},
        "metrics":  metrics or {},
        "warnings": warnings or [],
    })


@analytics_bp.route("/analytics", methods=["GET"])
def get_analytics():
    """Return analytics for the most recent completed schedule."""
    p = get_progress()
    if p.get("running"):
        return _ok(data={"status": "running"}, warnings=["Schedule still in progress."])
    if not p.get("result"):
        return _ok(data={"status": "no_schedule"}, warnings=["No schedule generated yet."])

    analytics = p.get("analytics")
    if not analytics:
        # Re-compute on demand (e.g. after server restart with cached result)
        import app as _app
        static_lookup = get_static_lookup()
        sc = get_soft_constraints()
        analytics = compute_analytics(
            p["result"],
            _app.faculty_runtime_list,
            static_lookup,
            sc,
            p.get("metrics", {}),
        )

    return _ok(data=analytics, metrics=p.get("metrics", {}), warnings=p.get("warnings", []))


@analytics_bp.route("/analytics/workload", methods=["GET"])
def get_workload():
    """Workload distribution subset."""
    p = get_progress()
    analytics = p.get("analytics", {})
    return _ok(data={
        "faculty_utilization":   analytics.get("faculty_utilization", []),
        "workload_distribution": analytics.get("workload_distribution", {}),
    })


@analytics_bp.route("/analytics/specialization", methods=["GET"])
def get_specialization():
    p = get_progress()
    analytics = p.get("analytics", {})
    return _ok(data=analytics.get("specialization_metrics", {}))


@analytics_bp.route("/analytics/rooms", methods=["GET"])
def get_room_analytics():
    p = get_progress()
    analytics = p.get("analytics", {})
    return _ok(data=analytics.get("room_utilization", []))


@analytics_bp.route("/analytics/satisfaction", methods=["GET"])
def get_satisfaction():
    p = get_progress()
    analytics = p.get("analytics", {})
    return _ok(data=analytics.get("satisfaction_metrics", {}))
