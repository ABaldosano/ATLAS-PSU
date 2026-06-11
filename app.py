"""
ATLAS PSU - app.py
Bootstrap: Flask init + route registration only.
All scheduling logic lives in /solver, /services, /routes.
"""

import copy
from flask import Flask, jsonify, request
from flask_cors import CORS

from config.settings import SUBJECT_TYPES, DEFAULT_CLASS_SIZES
from routes.schedule_routes import schedule_bp
from routes.analytics_routes import analytics_bp

app = Flask(__name__)
CORS(app)

# ── Runtime-mutable stores ────────────────────────────────────────────────────
# (mutated by POST endpoints; accessed by services via `import app`)
class_sizes_store = copy.deepcopy(DEFAULT_CLASS_SIZES)
faculty_runtime_list: list = []   # populated on each /run-ga call for analytics re-compute

# ── Register blueprints ───────────────────────────────────────────────────────
app.register_blueprint(schedule_bp)
app.register_blueprint(analytics_bp)

# ── Static data endpoints ─────────────────────────────────────────────────────

@app.route("/rooms", methods=["GET"])
def get_rooms():
    import config.settings as _cfg
    return jsonify({
        "lecture_rooms":    list(_cfg.LECTURE_ROOMS),
        "laboratory_rooms": list(_cfg.LABORATORY_ROOMS),
        "all_rooms":        list(_cfg.ALL_ROOMS),
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