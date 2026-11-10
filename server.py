"""BSCIAMS web server.

Serves the existing pages, checks sign-in, and stores office records in SQLite.
"""

import os
from datetime import timedelta

from urllib.parse import urlparse

from flask import Flask, jsonify, redirect, request, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix

import database

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
HTML_DIR = os.path.join(BASE_DIR, "html")
CSS_DIR = os.path.join(BASE_DIR, "css")
JS_DIR = os.path.join(BASE_DIR, "js")

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "bscims-local-class-server"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("RENDER") == "true",
    SESSION_COOKIE_PATH="/",
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

OFFICE_PAGES = frozenset({
    "Dashboard",
    "ReportsAnalytics",
    "SeniorRegistry",
    "PrintSeniorId",
    "ProgramManagement",
    "AssistanceManagement",
    "AuditTrail",
    "StaffAccounts",
    "DatabaseBackup",
})


def _office_name(path):
    name = path.strip("/")
    if name.startswith("html/"):
        name = name[5:]
    if name.endswith(".html"):
        name = name[:-5]
    return name


def _redirect_keep_query(path):
    query = request.query_string.decode("utf-8")
    if query:
        return redirect(f"{path}?{query}")
    return redirect(path)


def _send_html(directory, filename):
    response = send_from_directory(directory, filename)
    response.headers["Cache-Control"] = "no-store"
    return response


def _origin_allowed():
    origin = request.headers.get("Origin")
    if not origin:
        return True
    origin_host = (urlparse(origin).hostname or "").lower()
    request_host = (request.host or "").split(":")[0].lower()
    return bool(origin_host) and origin_host == request_host


def _require_login():
    if "user" not in session:
        return jsonify(ok=False, errors={"form": "Please sign in."}), 401
    return None


def _current_account():
    user = session.get("user") or {}
    return database.get_staff(user.get("username"))


def _require_admin():
    blocked = _require_login()
    if blocked:
        return blocked
    account = _current_account()
    if not account or account["status"] != "Active" or account["role"] != "Administrator":
        return jsonify(ok=False, errors={"form": "Only Administrators can manage staff accounts."}), 403
    return None


@app.before_request
def guard_request():
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and not _origin_allowed():
        return jsonify(ok=False, errors={"form": "This request was blocked."}), 403
    if _office_name(request.path) in OFFICE_PAGES and "user" not in session:
        return redirect("/OfficeLanding")
    if "user" in session and (
        request.path.startswith("/api/") or _office_name(request.path) in OFFICE_PAGES
    ):
        account = _current_account()
        if not account or account["status"] != "Active":
            session.clear()
            session.modified = True
            if request.path.startswith("/api/"):
                return jsonify(ok=False, errors={"form": "Please sign in."}), 401
            return redirect("/OfficeLanding?signedout=1")
    if request.path.startswith("/api/") and request.path not in PUBLIC_API:
        blocked = _require_login()
        if blocked:
            return blocked
    return None


@app.get("/")
@app.get("/OfficeLanding")
@app.post("/OfficeLanding")
def login_page():
    return _send_html(BASE_DIR, "OfficeLanding.html")


@app.get("/OfficeLanding.html")
@app.get("/Main.html")
def login_page_legacy():
    return _redirect_keep_query("/OfficeLanding")


@app.get("/css/<path:filename>")
def styles(filename):
    if not filename.endswith(".css"):
        return ("Not found", 404)
    return _send_html(CSS_DIR, filename)


@app.get("/js/<path:filename>")
def scripts(filename):
    if not filename.endswith(".js"):
        return ("Not found", 404)
    return _send_html(JS_DIR, filename)


@app.get("/html/<path:filename>")
def pages_legacy(filename):
    name = _office_name(filename)
    if name in OFFICE_PAGES:
        return _redirect_keep_query(f"/{name}")
    return ("Not found", 404)


@app.get("/<name>")
def office_page(name):
    if name.endswith(".html"):
        stem = name[:-5]
        if stem == "OfficeLanding":
            return _redirect_keep_query("/OfficeLanding")
        if stem in OFFICE_PAGES:
            return _redirect_keep_query(f"/{stem}")
        return ("Not found", 404)
    if name not in OFFICE_PAGES:
        return ("Not found", 404)
    return _send_html(HTML_DIR, f"{name}.html")


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
    session.modified = True
    response = jsonify(ok=True)
    response.delete_cookie(
        app.config.get("SESSION_COOKIE_NAME", "session"),
        path=app.config.get("SESSION_COOKIE_PATH") or "/",
        secure=bool(app.config.get("SESSION_COOKIE_SECURE")),
        httponly=True,
        samesite=app.config.get("SESSION_COOKIE_SAMESITE") or "Lax",
    )
    return response


@app.get("/api/auth/me")
def current_user():
    user = session.get("user")
    if not user:
        return jsonify(ok=False), 401
    account = database.get_staff(user.get("username"))
    if not account or account["status"] != "Active":
        session.clear()
        session.modified = True
        return jsonify(ok=False), 401
    live = {"username": account["username"], "name": account["name"], "role": account["role"]}
    session["user"] = live
    return jsonify(ok=True, user=live)


@app.get("/api/records")
def get_records():
    return jsonify(database.dump_store())


@app.put("/api/records")
def put_records():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify(ok=False, errors={"form": "Invalid record payload."}), 400
    try:
        store = database.load_store(payload, imported=False)
    except database.StoreError as exc:
        return jsonify(ok=False, errors={"form": str(exc)}), 400
    return jsonify(ok=True, store=store)


@app.get("/api/staff")
def staff_list():
    blocked = _require_admin()
    if blocked:
        return blocked
    return jsonify(ok=True, staff=database.list_staff())


@app.post("/api/staff")
def staff_create():
    blocked = _require_admin()
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(ok=False, errors={"form": "Invalid staff payload."}), 400
    try:
        account = database.create_staff(
            data.get("username"),
            data.get("password"),
            data.get("name"),
            data.get("role"),
        )
    except database.StaffError as exc:
        return jsonify(ok=False, errors=exc.errors), 400
    return jsonify(ok=True, staff=account), 201


@app.patch("/api/staff/<username>")
def staff_update(username):
    blocked = _require_admin()
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(ok=False, errors={"form": "Invalid staff payload."}), 400
    actor = (session.get("user") or {}).get("username") or ""
    if actor.lower() == username.lower() and data.get("status") == "Disabled":
        return jsonify(ok=False, errors={"form": "You cannot disable the account you are signed in with."}), 400
    password = data.get("password")
    if password == "":
        password = None
    try:
        account = database.update_staff(
            username,
            name=data.get("name"),
            role=data.get("role"),
            status=data.get("status"),
            password=password,
        )
    except database.StaffError as exc:
        status = 404 if exc.errors.get("form") == "That staff account was not found." else 400
        return jsonify(ok=False, errors=exc.errors), status
    if actor.lower() == account["username"].lower():
        session["user"] = {
            "username": account["username"],
            "name": account["name"],
            "role": account["role"],
        }
        session.modified = True
    return jsonify(ok=True, staff=account)


@app.post("/api/activity")
def public_activity():
    entry = request.get_json(silent=True) or {}
    if not isinstance(entry, dict):
        return jsonify(ok=False, errors={"form": "Invalid activity payload."}), 400
    if entry.get("action") != "Failed Login":
        blocked = _require_login()
        if blocked:
            return blocked
    database.append_activity(entry, ip=request.remote_addr)
    return jsonify(ok=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    print(f"BSCIAMS is running at http://{host}:{port}")
    if database.using_postgres():
        print("Database: PostgreSQL (DATABASE_URL)")
    else:
        print(f"SQLite file: {database.DB_PATH}")
    app.run(host=host, port=port, debug=False)
