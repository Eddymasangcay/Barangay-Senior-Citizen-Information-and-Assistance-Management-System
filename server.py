"""BSCIAMS web server.

Serves the existing pages and checks sign-in. Senior records, programs,
assistance, and audit logs stay in the browser. This server has no database.
"""

import hashlib
import hmac
import os
from datetime import timedelta

from flask import Flask, jsonify, redirect, request, send_from_directory, session


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
HTML_DIR = os.path.join(BASE_DIR, "html")
CSS_DIR = os.path.join(BASE_DIR, "css")
JS_DIR = os.path.join(BASE_DIR, "js")

# Demo accounts. The browser no longer receives these passwords.
ACCOUNTS = (
    {"username": "emasangcay", "password": "Admin@123", "name": "Eduardo Masangcay", "role": "Administrator", "status": "Active"},
    {"username": "jencampi", "password": "Admin@123", "name": "Jenzai Campilan", "role": "Administrator", "status": "Active"},
    {"username": "jecab", "password": "Staff@123", "name": "Jeziel Cabarse", "role": "Barangay Staff", "status": "Active"},
    {"username": "kmorta", "password": "Staff@123", "name": "Keith Morta", "role": "Barangay Staff", "status": "Active"},
    {"username": "vrosalita", "password": "Health@123", "name": "Vincent Rosalita", "role": "Health Worker", "status": "Active"},
)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "bscims-local-class-server"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
)


def _password_matches(stored, given):
    if not isinstance(given, str):
        return False
    return hmac.compare_digest(
        hashlib.sha256(stored.encode("utf-8")).digest(),
        hashlib.sha256(given.encode("utf-8")).digest(),
    )


def _public_user(account):
    return {"username": account["username"], "name": account["name"], "role": account["role"]}


def _find_account(username):
    key = str(username or "").strip().lower()
    for account in ACCOUNTS:
        if account["username"].lower() == key:
            return account
    return None


def _origin_allowed():
    origin = request.headers.get("Origin")
    if not origin:
        return True
    return origin == request.host_url.rstrip("/")


@app.before_request
def guard_request():
    if request.method == "POST" and not _origin_allowed():
        return jsonify(ok=False, errors={"form": "This sign-in request was blocked."}), 403
    if request.path.startswith("/html/") and "user" not in session:
        return redirect("/Main.html")
    return None


@app.get("/")
def home():
    return redirect("/Main.html")


@app.get("/Main.html")
def login_page():
    response = send_from_directory(BASE_DIR, "Main.html")
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
    account = _find_account(data.get("username"))
    password = data.get("password")
    if not account or not _password_matches(account["password"], password):
        return jsonify(ok=False, errors={"form": "Invalid username or password."}), 401
    if account["status"] != "Active":
        return jsonify(ok=False, errors={"form": "This account is disabled. Contact your administrator."}), 403
    session.clear()
    session["user"] = _public_user(account)
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


if __name__ == "__main__":
    print("BSCIAMS is running at http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
