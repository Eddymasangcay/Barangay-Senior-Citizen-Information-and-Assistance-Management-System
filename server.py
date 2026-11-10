"""BSCIAMS web server.

Serves the existing pages, checks sign-in, and stores office records in SQLite.
"""

import os
from datetime import timedelta

from flask import Flask, jsonify, redirect, request, send_from_directory, session

import database

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
HTML_DIR = os.path.join(BASE_DIR, "html")
CSS_DIR = os.path.join(BASE_DIR, "css")
JS_DIR = os.path.join(BASE_DIR, "js")

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "bscims-local-class-server"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("RENDER") == "true",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,
)

database.init_db()

PUBLIC_API = {
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/activity",
}


def _origin_allowed():
    origin = request.headers.get("Origin")
    if not origin:
        return True
    return origin == request.host_url.rstrip("/")


def _require_login():
    if "user" not in session:
        return jsonify(ok=False, errors={"form": "Please sign in."}), 401
    return None


@app.before_request
def guard_request():
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and not _origin_allowed():
        return jsonify(ok=False, errors={"form": "This request was blocked."}), 403
    if request.path.startswith("/html/") and "user" not in session:
        return redirect("/OfficeLanding.html")
    if request.path.startswith("/api/") and request.path not in PUBLIC_API:
        blocked = _require_login()
        if blocked:
            return blocked
    return None


@app.get("/")
def home():
    return redirect("/OfficeLanding.html")


@app.get("/Main.html")
def login_page_legacy():
    return redirect("/OfficeLanding.html")


@app.get("/OfficeLanding.html")
def login_page():
    response = send_from_directory(BASE_DIR, "OfficeLanding.html")
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/css/<path:filename>")
def styles(filename):
    if not filename.endswith(".css"):
        return ("Not found", 404)
    return send_from_directory(CSS_DIR, filename)


@app.get("/js/<path:filename>")
def scripts(filename):
    if not filename.endswith(".js"):
        return ("Not found", 404)
    return send_from_directory(JS_DIR, filename)


@app.get("/html/<path:filename>")
def pages(filename):
    if not filename.endswith(".html"):
        return ("Not found", 404)
    response = send_from_directory(HTML_DIR, filename)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    account = database.authenticate(data.get("username"), data.get("password"))
    if account and account.get("disabled"):
        return jsonify(ok=False, errors={"form": "This account is disabled. Contact your administrator."}), 403
    if not account:
        return jsonify(ok=False, errors={"form": "Invalid username or password."}), 401
    session.clear()
    session["user"] = {"username": account["username"], "name": account["name"], "role": account["role"]}
    session.permanent = bool(data.get("remember"))
    return jsonify(ok=True, user=session["user"])


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/auth/me")
def current_user():
    user = session.get("user")
    if not user:
        return jsonify(ok=False), 401
    return jsonify(ok=True, user=user)


@app.get("/api/records")
def get_records():
    return jsonify(database.dump_store())


@app.put("/api/records")
def put_records():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify(ok=False, errors={"form": "Invalid record payload."}), 400
    return jsonify(ok=True, store=database.load_store(payload, imported=False))


@app.post("/api/activity")
def public_activity():
    entry = request.get_json(silent=True) or {}
    if entry.get("action") != "Failed Login":
        blocked = _require_login()
        if blocked:
            return blocked
    database.append_activity(entry)
    return jsonify(ok=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    print(f"BSCIAMS is running at http://{host}:{port}")
    print(f"SQLite file: {database.DB_PATH}")
    app.run(host=host, port=port, debug=False)
