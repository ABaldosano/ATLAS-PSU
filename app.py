"""
ATLAS PSU - app.py
Bootstrap: Flask init + route registration only.
All scheduling logic lives in /solver, /services, /routes.
"""

import copy
from flask import Flask, jsonify, request
from flask_cors import CORS

from config.settings import (
    LECTURE_ROOMS, LABORATORY_ROOMS, ALL_ROOMS,
    SUBJECT_TYPES, DEFAULT_CLASS_SIZES,
)
from routes.schedule_routes import schedule_bp
from routes.analytics_routes import analytics_bp

app = Flask(__name__)
CORS(app)

# ── Runtime-mutable stores ────────────────────────────────────────────────────
# (mutated by POST endpoints; accessed by services via `import app`)
LECTURE_ROOMS_RT  = list(LECTURE_ROOMS)
LABORATORY_ROOMS_RT = list(LABORATORY_ROOMS)
ALL_ROOMS_RT      = list(ALL_ROOMS)
class_sizes_store = copy.deepcopy(DEFAULT_CLASS_SIZES)
faculty_runtime_list: list = []   # populated on each /run-ga call for analytics re-compute

# ── Register blueprints ───────────────────────────────────────────────────────
app.register_blueprint(schedule_bp)
app.register_blueprint(analytics_bp)

# ── Static data endpoints ─────────────────────────────────────────────────────

@app.route("/rooms", methods=["GET"])
def get_rooms():
    return jsonify({
        "lecture_rooms":    LECTURE_ROOMS_RT,
        "laboratory_rooms": LABORATORY_ROOMS_RT,
        "all_rooms":        ALL_ROOMS_RT,
    })


@app.route("/rooms", methods=["POST"])
def update_rooms():
    global LECTURE_ROOMS_RT, LABORATORY_ROOMS_RT, ALL_ROOMS_RT
    from config import settings as _s
    data = request.get_json() or {}
    if "lecture_rooms" in data:
        LECTURE_ROOMS_RT = [str(r).strip() for r in data["lecture_rooms"] if str(r).strip()]
        _s.LECTURE_ROOMS = LECTURE_ROOMS_RT
    if "laboratory_rooms" in data:
        LABORATORY_ROOMS_RT = [str(r).strip() for r in data["laboratory_rooms"] if str(r).strip()]
        _s.LABORATORY_ROOMS = LABORATORY_ROOMS_RT
    ALL_ROOMS_RT = LECTURE_ROOMS_RT + LABORATORY_ROOMS_RT
    _s.ALL_ROOMS  = ALL_ROOMS_RT
    return jsonify({
        "success": True,
        "data": {
            "lecture_rooms":    LECTURE_ROOMS_RT,
            "laboratory_rooms": LABORATORY_ROOMS_RT,
            "all_rooms":        ALL_ROOMS_RT,
        },
        "metrics": {}, "warnings": [],
    })


@app.route("/subject-types", methods=["GET"])
def get_subject_types():
    return jsonify({"success": True, "data": {"subject_types": SUBJECT_TYPES},
                    "metrics": {}, "warnings": []})


@app.route("/class-sizes", methods=["GET"])
def get_class_sizes():
    return jsonify(class_sizes_store)


@app.route("/class-sizes", methods=["POST"])
def update_class_sizes():
    data = request.get_json() or {}
    for key, val in data.items():
        if key in class_sizes_store:
            if isinstance(val, dict):
                class_sizes_store[key].update(val)
            elif isinstance(val, int):
                class_sizes_store[key]["size"] = val
        else:
            class_sizes_store[key] = val
    return jsonify({"success": True, "data": {"class_sizes": class_sizes_store},
                    "metrics": {}, "warnings": []})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
