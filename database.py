"""SQLite access for the barangay office registry."""

import os
import sqlite3
import threading
from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_DIR = os.path.join(BASE_DIR, "database")
DB_PATH = os.path.join(DB_DIR, "bscims.db")
SCHEMA_PATH = os.path.join(DB_DIR, "schema.sql")

STAFF_SEED = (
    ("emasangcay", "Admin@123", "Eduardo Masangcay", "Administrator"),
    ("jencampi", "Admin@123", "Jenzai Campilan", "Administrator"),
    ("jecab", "Staff@123", "Jeziel Cabarse", "Barangay Staff"),
    ("kmorta", "Staff@123", "Keith Morta", "Barangay Staff"),
    ("vrosalita", "Health@123", "Vincent Rosalita", "Health Worker"),
)

DEFAULT_SETTINGS = {
    "autoBackup": True,
    "backupFrequency": "Daily",
    "retention": "30",
    "notifications": True,
    "emailAlerts": False,
    "twoFactor": False,
    "sessionTimeout": "30",
}

LEGACY_TABLES = (
    "aid_status_history",
    "aid_requests",
    "program_enrollees",
    "outreach_programs",
    "senior_ailments",
    "senior_citizens",
    "activity_log",
    "backup_history",
    "office_config",
    "staff_accounts",
)

_WRITE_LOCK = threading.Lock()


def _now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def connect():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn


def _table_names(conn):
    return {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def _dump_legacy(conn):
    ailments = {}
    for row in conn.execute("SELECT record_id, ailment_name FROM senior_ailments ORDER BY ailment_id"):
        ailments.setdefault(row["record_id"], []).append(row["ailment_name"])

    seniors = []
    for row in conn.execute("SELECT * FROM senior_citizens ORDER BY date_registered DESC"):
        seniors.append({
            "id": row["record_id"],
            "oscaId": row["osca_id"],
            "firstName": row["first_name"],
            "middleName": row["middle_name"] or "",
            "lastName": row["last_name"],
            "sex": row["sex"],
            "birthdate": row["birthdate"],
            "civilStatus": row["civil_status"] or "",
            "contact": row["contact_no"] or "",
            "purok": row["purok"] or "",
            "address": row["home_address"] or "",
            "pension": row["pension_type"] or "None",
            "pwd": bool(row["is_pwd"]),
            "indigent": bool(row["is_indigent"]),
            "conditions": ailments.get(row["record_id"], []),
            "status": row["living_status"],
            "photo": row["portrait"] or "",
            "registeredAt": row["date_registered"],
            "updatedAt": row["date_updated"] or row["date_registered"],
        })

    enrollees = {}
    for row in conn.execute("SELECT program_id, record_id FROM program_enrollees ORDER BY enrollee_id"):
        enrollees.setdefault(row["program_id"], []).append(row["record_id"])

    programs = []
    for row in conn.execute("SELECT * FROM outreach_programs ORDER BY event_date DESC"):
        programs.append({
            "id": row["program_id"],
            "title": row["title"],
            "type": row["program_type"],
            "date": row["event_date"],
            "time": row["start_time"] or "",
            "venue": row["venue"] or "",
            "description": row["description"] or "",
            "capacity": int(row["slot_limit"] or 0),
            "beneficiaries": enrollees.get(row["program_id"], []),
            "cancelled": bool(row["is_cancelled"]),
            "createdAt": row["date_created"] or row["event_date"],
        })

    history = {}
    for row in conn.execute("SELECT * FROM aid_status_history ORDER BY history_id"):
        history.setdefault(row["request_id"], []).append({
            "status": row["request_status"],
            "at": row["logged_at"],
            "by": row["logged_by"] or "",
            "note": row["notes"] or "",
        })

    assistance = []
    for row in conn.execute("SELECT * FROM aid_requests ORDER BY date_filed DESC"):
        assistance.append({
            "id": row["request_id"],
            "seniorId": row["record_id"],
            "type": row["aid_type"],
            "amount": float(row["amount"] or 0),
            "purpose": row["purpose"] or "",
            "remarks": row["remarks"] or "",
            "status": row["request_status"],
            "requestedAt": row["date_filed"],
            "updatedAt": row["date_updated"] or row["date_filed"],
            "handledBy": row["handled_by"] or "",
            "history": history.get(row["request_id"], []),
        })

    logs = []
    for row in conn.execute("SELECT * FROM activity_log ORDER BY logged_at DESC"):
        logs.append({
            "id": row["log_id"],
            "ts": row["logged_at"],
            "user": row["actor_name"] or "",
            "role": row["actor_role"] or "—",
            "action": row["action_type"],
            "module": row["module_name"] or "",
            "details": row["details"] or "",
            "severity": row["severity"] or "Info",
            "ip": row["ip_address"] or "",
        })

    backups = []
    for row in conn.execute("SELECT * FROM backup_history ORDER BY ran_at DESC"):
        backups.append({
            "id": row["backup_id"],
            "ts": row["ran_at"],
            "type": row["backup_type"] or "Manual",
            "size": int(row["file_size"] or 0),
            "by": row["created_by"] or "",
            "records": int(row["record_count"] or 0),
        })

    config = conn.execute("SELECT * FROM office_config WHERE config_id = 1").fetchone()
    return {
        "version": int(config["store_version"]) if config else 2,
        "seededAt": (config["seeded_at"] if config else None) or _now(),
        "seniors": seniors,
        "programs": programs,
        "assistance": assistance,
        "logs": logs,
        "backups": backups,
        "settings": {
            "autoBackup": bool(config["auto_backup"]) if config else True,
            "backupFrequency": config["backup_frequency"] if config else "Daily",
            "retention": config["log_retention"] if config else "30",
            "notifications": bool(config["in_app_notices"]) if config else True,
            "emailAlerts": bool(config["email_alerts"]) if config else False,
            "twoFactor": bool(config["two_factor"]) if config else False,
            "sessionTimeout": config["session_minutes"] if config else "30",
        },
    }


def init_db():
    snapshot = None
    with connect() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        names = _table_names(conn)
        if "senior_citizens" in names:
            snapshot = _dump_legacy(conn)
            conn.execute("PRAGMA foreign_keys = OFF")
            for table in LEGACY_TABLES:
                conn.execute(f"DROP TABLE IF EXISTS {table}")
            conn.execute("PRAGMA foreign_keys = ON")
            conn.commit()

        with open(SCHEMA_PATH, "r", encoding="utf-8") as fh:
            conn.executescript(fh.read())

        if conn.execute("SELECT COUNT(*) FROM StaffAccounts").fetchone()[0] == 0:
            conn.executemany(
                """
                INSERT INTO StaffAccounts (Username, PasswordHash, FullName, Role, AccountStatus)
                VALUES (?, ?, ?, ?, 'Active')
                """,
                [
                    (user, generate_password_hash(password), name, role)
                    for user, password, name, role in STAFF_SEED
                ],
            )
        if conn.execute("SELECT COUNT(*) FROM OfficeConfig").fetchone()[0] == 0:
            conn.execute(
                """
                INSERT INTO OfficeConfig (
                    ConfigId, AutoBackup, BackupFrequency, LogRetention,
                    InAppNotices, EmailAlerts, TwoFactor, SessionMinutes,
                    StoreVersion, SeededAt, ImportedFromBrowser
                ) VALUES (1, 1, 'Daily', '30', 1, 0, 0, '30', 2, ?, 0)
                """,
                (_now(),),
            )
        conn.commit()

    if snapshot:
        load_store(snapshot, imported=False)
    return DB_PATH


def authenticate(username, password):
    key = str(username or "").strip()
    if not key or not isinstance(password, str):
        return None
    with connect() as conn:
        row = conn.execute(
            """
            SELECT Username, PasswordHash, FullName, Role, AccountStatus
            FROM StaffAccounts
            WHERE Username = ? COLLATE NOCASE
            """,
            (key,),
        ).fetchone()
    if not row or not check_password_hash(row["PasswordHash"], password):
        return None
    if row["AccountStatus"] != "Active":
        return {"disabled": True}
    return {"username": row["Username"], "name": row["FullName"], "role": row["Role"]}


def file_size():
    try:
        return os.path.getsize(DB_PATH)
    except OSError:
        return 0


def _settings_from_row(row):
    if not row:
        return dict(DEFAULT_SETTINGS)
    return {
        "autoBackup": bool(row["AutoBackup"]),
        "backupFrequency": row["BackupFrequency"],
        "retention": row["LogRetention"],
        "notifications": bool(row["InAppNotices"]),
        "emailAlerts": bool(row["EmailAlerts"]),
        "twoFactor": bool(row["TwoFactor"]),
        "sessionTimeout": row["SessionMinutes"],
    }


def dump_store():
    with connect() as conn:
        ailments = {}
        for row in conn.execute("SELECT RecordId, AilmentName FROM SeniorAilments ORDER BY AilmentId"):
            ailments.setdefault(row["RecordId"], []).append(row["AilmentName"])

        seniors = []
        for row in conn.execute("SELECT * FROM SeniorCitizens ORDER BY DateRegistered DESC"):
            seniors.append({
                "id": row["RecordId"],
                "oscaId": row["OscaId"],
                "firstName": row["FirstName"],
                "middleName": row["MiddleName"] or "",
                "lastName": row["LastName"],
                "sex": row["Sex"],
                "birthdate": row["Birthdate"],
                "civilStatus": row["CivilStatus"] or "",
                "contact": row["ContactNo"] or "",
                "purok": row["Purok"] or "",
                "address": row["HomeAddress"] or "",
                "pension": row["PensionType"] or "None",
                "pwd": bool(row["IsPwd"]),
                "indigent": bool(row["IsIndigent"]),
                "conditions": ailments.get(row["RecordId"], []),
                "status": row["LivingStatus"],
                "photo": row["Portrait"] or "",
                "registeredAt": row["DateRegistered"],
                "updatedAt": row["DateUpdated"] or row["DateRegistered"],
            })

        enrollees = {}
        for row in conn.execute("SELECT ProgramId, RecordId FROM ProgramEnrollees ORDER BY EnrolleeId"):
            enrollees.setdefault(row["ProgramId"], []).append(row["RecordId"])

        programs = []
        for row in conn.execute("SELECT * FROM OutreachPrograms ORDER BY EventDate DESC"):
            programs.append({
                "id": row["ProgramId"],
                "title": row["Title"],
                "type": row["ProgramType"],
                "date": row["EventDate"],
                "time": row["StartTime"] or "",
                "venue": row["Venue"] or "",
                "description": row["Description"] or "",
                "capacity": int(row["SlotLimit"] or 0),
                "beneficiaries": enrollees.get(row["ProgramId"], []),
                "cancelled": bool(row["IsCancelled"]),
                "createdAt": row["DateCreated"] or row["EventDate"],
            })

        history = {}
        for row in conn.execute("SELECT * FROM AidStatusHistory ORDER BY HistoryId"):
            history.setdefault(row["RequestId"], []).append({
                "status": row["RequestStatus"],
                "at": row["LoggedAt"],
                "by": row["LoggedBy"] or "",
                "note": row["Notes"] or "",
            })

        assistance = []
        for row in conn.execute("SELECT * FROM AidRequests ORDER BY DateFiled DESC"):
            assistance.append({
                "id": row["RequestId"],
                "seniorId": row["RecordId"],
                "type": row["AidType"],
                "amount": float(row["Amount"] or 0),
                "purpose": row["Purpose"] or "",
                "remarks": row["Remarks"] or "",
                "status": row["RequestStatus"],
                "requestedAt": row["DateFiled"],
                "updatedAt": row["DateUpdated"] or row["DateFiled"],
                "handledBy": row["HandledBy"] or "",
                "history": history.get(row["RequestId"], []),
            })

        logs = []
        for row in conn.execute("SELECT * FROM ActivityLog ORDER BY LoggedAt DESC"):
            logs.append({
                "id": row["LogId"],
                "ts": row["LoggedAt"],
                "user": row["ActorName"] or "",
                "role": row["ActorRole"] or "—",
                "action": row["ActionType"],
                "module": row["ModuleName"] or "",
                "details": row["Details"] or "",
                "severity": row["Severity"] or "Info",
                "ip": row["IpAddress"] or "",
            })

        backups = []
        for row in conn.execute("SELECT * FROM BackupHistory ORDER BY RanAt DESC"):
            backups.append({
                "id": row["BackupId"],
                "ts": row["RanAt"],
                "type": row["BackupType"] or "Manual",
                "size": int(row["FileSize"] or 0),
                "by": row["CreatedBy"] or "",
                "records": int(row["RecordCount"] or 0),
            })

        config = conn.execute("SELECT * FROM OfficeConfig WHERE ConfigId = 1").fetchone()

    return {
        "version": int(config["StoreVersion"]) if config else 2,
        "seededAt": (config["SeededAt"] if config else None) or _now(),
        "seniors": seniors,
        "programs": programs,
        "assistance": assistance,
        "logs": logs,
        "backups": backups,
        "settings": _settings_from_row(config),
        "empty": len(seniors) == 0,
        "dbFileBytes": file_size(),
        "importedFromBrowser": bool(config["ImportedFromBrowser"]) if config else False,
    }


def _flag(value):
    return 1 if value else 0


def load_store(payload, imported=False):
    seniors = payload.get("seniors") or []
    programs = payload.get("programs") or []
    assistance = payload.get("assistance") or []
    logs = payload.get("logs") or []
    backups = payload.get("backups") or []
    settings = {**DEFAULT_SETTINGS, **(payload.get("settings") or {})}
    known = {row["id"] for row in seniors if row and row.get("id")}

    with _WRITE_LOCK, connect() as conn:
        conn.execute("DELETE FROM AidStatusHistory")
        conn.execute("DELETE FROM AidRequests")
        conn.execute("DELETE FROM ProgramEnrollees")
        conn.execute("DELETE FROM OutreachPrograms")
        conn.execute("DELETE FROM SeniorAilments")
        conn.execute("DELETE FROM SeniorCitizens")
        conn.execute("DELETE FROM ActivityLog")
        conn.execute("DELETE FROM BackupHistory")

        for senior in seniors:
            if not senior or not senior.get("id"):
                continue
            conn.execute(
                """
                INSERT INTO SeniorCitizens (
                    RecordId, OscaId, FirstName, MiddleName, LastName, Sex, Birthdate,
                    CivilStatus, ContactNo, Purok, HomeAddress, PensionType, IsPwd,
                    IsIndigent, LivingStatus, Portrait, DateRegistered, DateUpdated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    senior.get("id"),
                    senior.get("oscaId") or senior.get("id"),
                    senior.get("firstName") or "",
                    senior.get("middleName") or "",
                    senior.get("lastName") or "",
                    senior.get("sex") if senior.get("sex") in ("Female", "Male") else "Female",
                    senior.get("birthdate") or "",
                    senior.get("civilStatus") or "",
                    senior.get("contact") or "",
                    senior.get("purok") or "",
                    senior.get("address") or "",
                    senior.get("pension") or "None",
                    _flag(senior.get("pwd")),
                    _flag(senior.get("indigent")),
                    senior.get("status") if senior.get("status") in ("Active", "Deceased", "Transferred") else "Active",
                    senior.get("photo") or "",
                    senior.get("registeredAt") or _now(),
                    senior.get("updatedAt") or senior.get("registeredAt") or _now(),
                ),
            )
            for ailment in senior.get("conditions") or []:
                name = str(ailment).strip()
                if not name:
                    continue
                conn.execute(
                    "INSERT OR IGNORE INTO SeniorAilments (RecordId, AilmentName) VALUES (?, ?)",
                    (senior["id"], name),
                )

        for program in programs:
            if not program or not program.get("id"):
                continue
            conn.execute(
                """
                INSERT INTO OutreachPrograms (
                    ProgramId, Title, ProgramType, EventDate, StartTime, Venue,
                    Description, SlotLimit, IsCancelled, DateCreated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    program.get("id"),
                    program.get("title") or "",
                    program.get("type") or "Outreach",
                    program.get("date") or "",
                    program.get("time") or "",
                    program.get("venue") or "",
                    program.get("description") or "",
                    int(program.get("capacity") or 0),
                    _flag(program.get("cancelled")),
                    program.get("createdAt") or _now(),
                ),
            )
            for record_id in program.get("beneficiaries") or []:
                if record_id not in known:
                    continue
                conn.execute(
                    "INSERT OR IGNORE INTO ProgramEnrollees (ProgramId, RecordId) VALUES (?, ?)",
                    (program["id"], record_id),
                )

        for request in assistance:
            if not request or not request.get("id") or request.get("seniorId") not in known:
                continue
            conn.execute(
                """
                INSERT INTO AidRequests (
                    RequestId, RecordId, AidType, Amount, Purpose, Remarks,
                    RequestStatus, DateFiled, DateUpdated, HandledBy
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request.get("id"),
                    request.get("seniorId"),
                    request.get("type") or "Financial",
                    float(request.get("amount") or 0),
                    request.get("purpose") or "",
                    request.get("remarks") or "",
                    request.get("status") or "Pending",
                    request.get("requestedAt") or _now(),
                    request.get("updatedAt") or request.get("requestedAt") or _now(),
                    request.get("handledBy") or "",
                ),
            )
            for event in request.get("history") or []:
                conn.execute(
                    """
                    INSERT INTO AidStatusHistory (
                        RequestId, RequestStatus, LoggedAt, LoggedBy, Notes
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        request["id"],
                        event.get("status") or request.get("status") or "Pending",
                        event.get("at") or _now(),
                        event.get("by") or "",
                        event.get("note") or "",
                    ),
                )

        for entry in logs[:1500]:
            if not entry or not entry.get("id"):
                continue
            conn.execute(
                """
                INSERT INTO ActivityLog (
                    LogId, LoggedAt, ActorName, ActorRole, ActionType,
                    ModuleName, Details, Severity, IpAddress
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry.get("id"),
                    entry.get("ts") or _now(),
                    entry.get("user") or "",
                    entry.get("role") or "—",
                    entry.get("action") or "Update",
                    entry.get("module") or "",
                    entry.get("details") or "",
                    entry.get("severity") or "Info",
                    entry.get("ip") or "",
                ),
            )

        for backup in backups:
            if not backup or not backup.get("id"):
                continue
            conn.execute(
                """
                INSERT INTO BackupHistory (
                    BackupId, RanAt, BackupType, FileSize, CreatedBy, RecordCount
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    backup.get("id"),
                    backup.get("ts") or _now(),
                    backup.get("type") or "Manual",
                    int(backup.get("size") or 0),
                    backup.get("by") or "",
                    int(backup.get("records") or 0),
                ),
            )

        conn.execute(
            """
            UPDATE OfficeConfig SET
                AutoBackup = ?, BackupFrequency = ?, LogRetention = ?,
                InAppNotices = ?, EmailAlerts = ?, TwoFactor = ?,
                SessionMinutes = ?, StoreVersion = ?, SeededAt = ?,
                ImportedFromBrowser = CASE WHEN ? = 1 THEN 1 ELSE ImportedFromBrowser END
            WHERE ConfigId = 1
            """,
            (
                _flag(settings.get("autoBackup")),
                settings.get("backupFrequency") or "Daily",
                str(settings.get("retention") if settings.get("retention") is not None else "30"),
                _flag(settings.get("notifications")),
                _flag(settings.get("emailAlerts")),
                _flag(settings.get("twoFactor")),
                str(settings.get("sessionTimeout") if settings.get("sessionTimeout") is not None else "30"),
                int(payload.get("version") or 2),
                payload.get("seededAt") or _now(),
                1 if imported else 0,
            ),
        )
        conn.commit()
    return dump_store()


def append_activity(entry):
    with _WRITE_LOCK, connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO ActivityLog (
                LogId, LoggedAt, ActorName, ActorRole, ActionType,
                ModuleName, Details, Severity, IpAddress
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry.get("id") or f"LOG-{int(datetime.now().timestamp())}",
                entry.get("ts") or _now(),
                entry.get("user") or "",
                entry.get("role") or "—",
                entry.get("action") or "Update",
                entry.get("module") or "",
                entry.get("details") or "",
                entry.get("severity") or "Info",
                entry.get("ip") or "",
            ),
        )
        conn.commit()
