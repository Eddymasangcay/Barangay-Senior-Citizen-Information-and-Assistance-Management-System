-- BSCIMS office registry
-- SQLite 3. File: database/bscims.db

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS StaffAccounts (
  AccountId       INTEGER PRIMARY KEY AUTOINCREMENT,
  Username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  PasswordHash    TEXT    NOT NULL,
  FullName        TEXT    NOT NULL,
  Role            TEXT    NOT NULL CHECK (Role IN ('Administrator', 'Barangay Staff', 'Health Worker')),
  AccountStatus   TEXT    NOT NULL DEFAULT 'Active' CHECK (AccountStatus IN ('Active', 'Disabled'))
);

CREATE TABLE IF NOT EXISTS SeniorCitizens (
  RecordId         TEXT PRIMARY KEY,
  OscaId           TEXT NOT NULL UNIQUE,
  FirstName        TEXT NOT NULL,
  MiddleName       TEXT,
  LastName         TEXT NOT NULL,
  Sex              TEXT NOT NULL CHECK (Sex IN ('Female', 'Male')),
  Birthdate        TEXT NOT NULL,
  CivilStatus      TEXT,
  ContactNo        TEXT,
  Purok            TEXT,
  HomeAddress      TEXT,
  PensionType      TEXT,
  IsPwd            INTEGER NOT NULL DEFAULT 0 CHECK (IsPwd IN (0, 1)),
  IsIndigent       INTEGER NOT NULL DEFAULT 0 CHECK (IsIndigent IN (0, 1)),
  LivingStatus     TEXT NOT NULL DEFAULT 'Active' CHECK (LivingStatus IN ('Active', 'Deceased', 'Transferred')),
  Portrait         TEXT,
  DateRegistered   TEXT NOT NULL,
  DateUpdated      TEXT
);

CREATE INDEX IF NOT EXISTS IdxSeniorPurok ON SeniorCitizens (Purok);
CREATE INDEX IF NOT EXISTS IdxSeniorStatus ON SeniorCitizens (LivingStatus);
CREATE INDEX IF NOT EXISTS IdxSeniorName ON SeniorCitizens (LastName, FirstName);

CREATE TABLE IF NOT EXISTS SeniorAilments (
  AilmentId    INTEGER PRIMARY KEY AUTOINCREMENT,
  RecordId     TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  AilmentName  TEXT NOT NULL,
  UNIQUE (RecordId, AilmentName)
);

CREATE TABLE IF NOT EXISTS OutreachPrograms (
  ProgramId     TEXT PRIMARY KEY,
  Title         TEXT NOT NULL,
  ProgramType   TEXT NOT NULL,
  EventDate     TEXT NOT NULL,
  StartTime     TEXT,
  Venue         TEXT,
  Description   TEXT,
  SlotLimit     INTEGER,
  IsCancelled   INTEGER NOT NULL DEFAULT 0 CHECK (IsCancelled IN (0, 1)),
  DateCreated   TEXT
);

CREATE TABLE IF NOT EXISTS ProgramEnrollees (
  EnrolleeId  INTEGER PRIMARY KEY AUTOINCREMENT,
  ProgramId   TEXT NOT NULL REFERENCES OutreachPrograms (ProgramId) ON DELETE CASCADE,
  RecordId    TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  UNIQUE (ProgramId, RecordId)
);

CREATE TABLE IF NOT EXISTS AidRequests (
  RequestId       TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  AidType         TEXT NOT NULL,
  Amount          REAL NOT NULL CHECK (Amount >= 0),
  Purpose         TEXT,
  Remarks         TEXT,
  RequestStatus   TEXT NOT NULL,
  DateFiled       TEXT NOT NULL,
  DateUpdated     TEXT,
  HandledBy       TEXT
);

CREATE INDEX IF NOT EXISTS IdxAidStatus ON AidRequests (RequestStatus);
CREATE INDEX IF NOT EXISTS IdxAidFiled ON AidRequests (DateFiled);

CREATE TABLE IF NOT EXISTS AidStatusHistory (
  HistoryId       INTEGER PRIMARY KEY AUTOINCREMENT,
  RequestId       TEXT NOT NULL REFERENCES AidRequests (RequestId) ON DELETE CASCADE,
  RequestStatus   TEXT NOT NULL,
  LoggedAt        TEXT NOT NULL,
  LoggedBy        TEXT,
  Notes           TEXT
);

CREATE TABLE IF NOT EXISTS ActivityLog (
  LogId        TEXT PRIMARY KEY,
  LoggedAt     TEXT NOT NULL,
  ActorName    TEXT,
  ActorRole    TEXT,
  ActionType   TEXT NOT NULL,
  ModuleName   TEXT,
  Details      TEXT,
  Severity     TEXT,
  IpAddress    TEXT
);

CREATE INDEX IF NOT EXISTS IdxActivityTime ON ActivityLog (LoggedAt);

CREATE TABLE IF NOT EXISTS BackupHistory (
  BackupId      TEXT PRIMARY KEY,
  RanAt         TEXT NOT NULL,
  BackupType    TEXT,
  FileSize      INTEGER,
  CreatedBy     TEXT,
  RecordCount   INTEGER
);

CREATE TABLE IF NOT EXISTS OfficeConfig (
  ConfigId              INTEGER PRIMARY KEY CHECK (ConfigId = 1),
  AutoBackup            INTEGER NOT NULL DEFAULT 1 CHECK (AutoBackup IN (0, 1)),
  BackupFrequency       TEXT NOT NULL DEFAULT 'Daily',
  LogRetention          TEXT NOT NULL DEFAULT '30',
  InAppNotices          INTEGER NOT NULL DEFAULT 1 CHECK (InAppNotices IN (0, 1)),
  EmailAlerts           INTEGER NOT NULL DEFAULT 0 CHECK (EmailAlerts IN (0, 1)),
  TwoFactor             INTEGER NOT NULL DEFAULT 0 CHECK (TwoFactor IN (0, 1)),
  SessionMinutes        TEXT NOT NULL DEFAULT '30',
  StoreVersion          INTEGER NOT NULL DEFAULT 2,
  SeededAt              TEXT,
  ImportedFromBrowser   INTEGER NOT NULL DEFAULT 0 CHECK (ImportedFromBrowser IN (0, 1))
);
