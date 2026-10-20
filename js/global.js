/* ==========================================================================
   Barangay Senior Citizen Information and Assistance Management System
   global.js: data layer, session, app shell, shared UI and page modules
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Constants
     ------------------------------------------------------------------------ */
  const STORE_KEY = 'bscims_db';
  const SESSION_KEY = 'bscims_session';
  const READ_KEY = 'bscims_read_notifications';
  const NAV_KEY = 'bscims_nav_groups';
  const FLASH_KEY = 'bscims_flash';
  const THEME_KEY = 'bscims_theme';
  const LAST_USER_KEY = 'bscims_last_user';
  const DB_VERSION = 2;
  const STORAGE_QUOTA = 5 * 1024 * 1024;

  const PAGE = document.body.dataset.page || '';
  const IS_LOGIN = PAGE === 'login';
  const HTML_BASE = IS_LOGIN ? 'html/' : '';
  const LOGIN_URL = IS_LOGIN ? 'Main.html' : '../Main.html';

  const PUROKS = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6', 'Purok 7'];
  const AGE_BRACKETS = ['60–64', '65–69', '70–74', '75–79', '80+'];
  const PENSION_TYPES = ['Social Pension', 'SSS', 'GSIS', 'Veterans', 'None'];
  const CONDITIONS = ['Hypertension', 'Diabetes', 'Arthritis', 'Heart Disease', 'Visual Impairment', 'Hearing Loss', 'Asthma / COPD', 'Osteoporosis', 'Dementia'];
  const CIVIL_STATUSES = ['Married', 'Widowed', 'Single', 'Separated'];
  const SENIOR_STATUSES = ['Active', 'Deceased', 'Transferred'];
  const AID_TYPES = ['Financial', 'Medical', 'Food Pack', 'Assistive Device', 'Burial'];
  const AID_STATUSES = ['Pending', 'Approved', 'Released', 'Denied'];
  const PROGRAM_TYPES = ['Pension', 'Health', 'Outreach'];

  const OPTION_SETS = {
    puroks: PUROKS,
    ageBrackets: AGE_BRACKETS,
    pension: PENSION_TYPES,
    civil: CIVIL_STATUSES,
    seniorStatus: SENIOR_STATUSES,
    aidTypes: AID_TYPES,
    aidStatus: AID_STATUSES,
    programTypes: PROGRAM_TYPES
  };

  const STATUS_TONE = {
    Active: 'approved', Deceased: 'neutral', Transferred: 'info',
    Pending: 'pending', Approved: 'approved', Released: 'distributed', Distributed: 'distributed', Denied: 'alert',
    Upcoming: 'violet', Completed: 'approved', Cancelled: 'neutral',
    Info: 'info', Warning: 'pending', Critical: 'alert'
  };

  const AID_ICONS = {
    Financial: 'fa-peso-sign', Medical: 'fa-kit-medical', 'Food Pack': 'fa-basket-shopping',
    'Assistive Device': 'fa-wheelchair', Burial: 'fa-dove'
  };
  const PROGRAM_ICONS = { Pension: 'fa-money-bill-wave', Health: 'fa-heart-pulse', Outreach: 'fa-people-roof' };

  const PERMISSIONS = {
    Administrator: ['*'],
    'Barangay Staff': ['senior.write', 'program.write', 'assistance.write', 'assistance.approve', 'report.export', 'audit.view', 'backup.create'],
    'Health Worker': ['senior.write', 'program.write', 'assistance.write', 'report.export']
  };

  /* Names and roles for demo records. Passwords are checked by server.py. */
  const SEED_USERS = [
    { username: 'emasangcay', name: 'Eduardo Masangcay', role: 'Administrator', status: 'Active' },
    { username: 'jencampi', name: 'Jenzai Campilan', role: 'Administrator', status: 'Active' },
    { username: 'jecab', name: 'Jeziel Cabarse', role: 'Barangay Staff', status: 'Active' },
    { username: 'kmorta', name: 'Keith Morta', role: 'Barangay Staff', status: 'Active' },
    { username: 'vrosalita', name: 'Vincent Rosalita', role: 'Health Worker', status: 'Active' }
  ];

  const NAV = [
    { label: 'Overview', items: [
      { page: 'dashboard', href: 'dashboard.html', icon: 'fa-gauge-high', text: 'Dashboard' },
      { page: 'reports', href: 'reports-analytics.html', icon: 'fa-chart-pie', text: 'Reports & Analytics' }
    ] },
    { label: 'Management', group: 'records', groupLabel: 'Records', groupIcon: 'fa-folder-open', items: [
      { page: 'registry', href: 'senior-registry.html', icon: 'fa-users', text: 'Senior Registry' },
      { page: 'programs', href: 'program-management.html', icon: 'fa-calendar-check', text: 'Programs & Events' },
      { page: 'assistance', href: 'assistance-management.html', icon: 'fa-hand-holding-medical', text: 'Assistance', badge: 'pending' }
    ] },
    { label: 'Administration', group: 'system', groupLabel: 'System & Security', groupIcon: 'fa-shield-halved', items: [
      { page: 'audit', href: 'audit-trail.html', icon: 'fa-clock-rotate-left', text: 'Audit Trail' },
      { page: 'backup', href: 'database-backup.html', icon: 'fa-database', text: 'Backup & Settings' }
    ] }
  ];

  /* ------------------------------------------------------------------------
     2. Utilities
     ------------------------------------------------------------------------ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const THEMES = ['light', 'dark', 'high-contrast'];
  const THEME_META = {
    light: { label: 'Light theme', next: 'Switch to dark theme', icon: 'fa-sun', color: '#3D007A' },
    dark: { label: 'Dark theme', next: 'Switch to high contrast', icon: 'fa-moon', color: '#141018' },
    'high-contrast': { label: 'High contrast', next: 'Switch to light theme', icon: 'fa-circle-half-stroke', color: '#2A0057' }
  };
  const Theme = {
    get() {
      try {
        const t = localStorage.getItem(THEME_KEY);
        return THEMES.includes(t) ? t : 'light';
      } catch (_) { return 'light'; }
    },
    apply(theme) {
      const next = THEMES.includes(theme) ? theme : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = THEME_META[next].color;
      this.syncToggle();
    },
    cycle() {
      const next = THEMES[(THEMES.indexOf(this.get()) + 1) % THEMES.length];
      this.apply(next);
      return next;
    },
    syncToggle(root = document) {
      $$('#themeToggle, [data-theme-toggle]', root).forEach((btn) => {
        const info = THEME_META[this.get()];
        btn.setAttribute('aria-label', info.next);
        btn.setAttribute('data-tooltip', info.next);
        btn.innerHTML = `<i class="fa-solid ${info.icon}" aria-hidden="true"></i>`;
      });
    },
    bind(root = document) {
      $$('#themeToggle, [data-theme-toggle]', root).forEach((btn) => {
        if (btn.dataset.themeBound) return;
        btn.dataset.themeBound = 'true';
        btn.addEventListener('click', () => {
          const next = this.cycle();
          toast(`${THEME_META[next].label} is on.`, 'info', 'Display');
        });
      });
      this.syncToggle(root);
    }
  };
  Theme.apply(Theme.get());

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => {
    if (!s) return null;
    if (s.length === 10) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(s);
  };
  const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

  const fmtDate = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
    const d = parseDate(s);
    return d && !isNaN(d) ? d.toLocaleDateString('en-PH', opts) : '—';
  };
  const fmtDateTime = (s) => {
    const d = parseDate(s);
    return d && !isNaN(d)
      ? d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '—';
  };
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  };
  const fmtMoney = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });
  const fmtNumber = (n) => Number(n || 0).toLocaleString('en-PH');
  const fmtBytes = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);

  const relTime = (iso) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return fmtDate(iso);
  };

  const ageOf = (birthdate) => {
    const b = parseDate(birthdate);
    if (!b) return 0;
    const t = new Date();
    let age = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
    return age;
  };
  const ageBracket = (age) => (age >= 80 ? '80+' : age >= 75 ? '75–79' : age >= 70 ? '70–74' : age >= 65 ? '65–69' : '60–64');

  const fullName = (s) => (s ? `${s.lastName}, ${s.firstName}${s.middleName ? ' ' + s.middleName.charAt(0) + '.' : ''}` : 'Unknown resident');
  const displayName = (s) => (s ? `${s.firstName} ${s.lastName}` : 'Unknown resident');
  const initials = (name) => String(name || '?').split(/[\s,]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('');
  const PHOTO_ASPECT = 3 / 4;
  const ID_CARD_ASPECT = 85.6 / 53.98;

  function cropToCanvas(source, { aspect, maxW, maxH, quality = 0.68, mirror = false } = {}) {
    const isVideo = source instanceof HTMLVideoElement;
    const srcW = isVideo ? source.videoWidth : source.naturalWidth || source.width;
    const srcH = isVideo ? source.videoHeight : source.naturalHeight || source.height;
    if (!srcW || !srcH) return '';
    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (aspect) {
      const srcAspect = srcW / srcH;
      if (srcAspect > aspect) { sw = srcH * aspect; sx = (srcW - sw) / 2; }
      else { sh = srcW / aspect; sy = (srcH - sh) / 2; }
    }
    const scale = Math.min(maxW / sw, maxH / sh, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext('2d');
    if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The file could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  async function compressFile(file, opts) {
    const src = await readFileAsDataURL(file);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The image could not be read.'));
      image.src = src;
    });
    return cropToCanvas(img, opts);
  }

  const debounce = (fn, ms = 200) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const params = new URLSearchParams(location.search);

  const highlight = (text, q) => {
    const safe = esc(text);
    if (!q) return safe;
    return safe.replace(new RegExp(escapeRegex(esc(q)), 'ig'), (m) => `<mark>${m}</mark>`);
  };

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------------
     3. Seed data
     ------------------------------------------------------------------------ */
  function buildSeed() {
    const rand = mulberry32(20260929);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const now = new Date();
    const shift = (days, h = 9, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; };
    const capNow = (d) => (d > now ? new Date(now.getTime() - 60000) : d);
    const sample = (arr, n) => {
      const c = [...arr];
      for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
      return c.slice(0, n);
    };

    const FIRST_M = ['Jose', 'Antonio', 'Ramon', 'Eduardo', 'Ernesto', 'Rodolfo', 'Fernando', 'Manuel', 'Roberto', 'Alfredo', 'Danilo', 'Romeo', 'Rogelio', 'Teodoro', 'Leonardo', 'Crisanto', 'Benigno'];
    const FIRST_F = ['Maria', 'Rosario', 'Luzviminda', 'Corazon', 'Teresita', 'Remedios', 'Erlinda', 'Gloria', 'Leticia', 'Milagros', 'Norma', 'Felicidad', 'Estrella', 'Perla', 'Aurora', 'Consolacion', 'Nenita'];
    const LAST = ['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Bautista', 'Villanueva', 'Ramos', 'Aquino', 'Castillo', 'Rivera', 'Navarro', 'Torres', 'Flores', 'Gonzales', 'Mercado', 'Salazar', 'Domingo', 'Pascual', 'Soriano', 'Manalo', 'Del Rosario', 'Tolentino', 'Lopez'];
    const STREETS = ['Mabini', 'Rizal', 'Bonifacio', 'Luna', 'Del Pilar', 'Malvar', 'Aguinaldo', 'Burgos', 'Jacinto', 'Magsaysay'];

    const seniors = [];
    const used = new Set();
    for (let i = 0; i < 64; i++) {
      const sex = rand() < 0.56 ? 'Female' : 'Male';
      let firstName; let lastName;
      do { firstName = pick(sex === 'Female' ? FIRST_F : FIRST_M); lastName = pick(LAST); } while (used.has(firstName + lastName));
      used.add(firstName + lastName);

      const age = 60 + Math.floor(Math.pow(rand(), 1.5) * 33);
      const birth = new Date(now.getFullYear() - age, int(0, 11), int(1, 28));
      const thisYearBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
      if (thisYearBirthday > now) birth.setFullYear(birth.getFullYear() - 1);

      const reg = shift(-int(2, 364), int(8, 16), int(0, 59));
      const pr = rand();
      const pension = pr < 0.46 ? 'Social Pension' : pr < 0.64 ? 'SSS' : pr < 0.74 ? 'GSIS' : pr < 0.78 ? 'Veterans' : 'None';
      const conditions = [];
      const nCond = rand() < 0.25 ? 0 : rand() < 0.6 ? 1 : 2;
      while (conditions.length < nCond) { const c = pick(CONDITIONS); if (!conditions.includes(c)) conditions.push(c); }
      const purok = PUROKS[Math.min(PUROKS.length - 1, Math.floor(Math.pow(rand(), 0.9) * PUROKS.length))];
      const status = [7, 31, 52].includes(i) ? 'Deceased' : [19, 44].includes(i) ? 'Transferred' : 'Active';

      seniors.push({
        id: `SC-${pad(i + 1, 4)}`,
        oscaId: `OSCA-${reg.getFullYear()}-${pad(i + 1, 4)}`,
        firstName,
        middleName: pick(LAST),
        lastName,
        sex,
        birthdate: toISODate(birth),
        civilStatus: age > 78 ? (rand() < 0.6 ? 'Widowed' : 'Married') : pick(['Married', 'Married', 'Widowed', 'Single', 'Separated']),
        contact: `09${int(10, 99)}${pad(int(0, 9999999), 7)}`,
        purok,
        address: `${int(1, 250)} ${pick(STREETS)} St., ${purok}`,
        pension,
        pwd: rand() < 0.18,
        indigent: rand() < 0.3,
        conditions,
        status,
        registeredAt: reg.toISOString(),
        updatedAt: reg.toISOString()
      });
    }

    const active = seniors.filter((s) => s.status === 'Active');
    const pensioners = active.filter((s) => s.pension === 'Social Pension');
    const withConditions = active.filter((s) => s.conditions.length);

    const program = (id, title, type, offset, time, venue, description, capacity, pool, count, cancelled = false) => ({
      id, title, type,
      date: toISODate(shift(offset)),
      time, venue, description, capacity,
      beneficiaries: sample(pool, Math.min(count, capacity)).map((s) => s.id),
      cancelled,
      createdAt: shift(Math.min(offset, 0) - int(10, 30)).toISOString()
    });

    const programs = [
      program('PG-0001', 'Monthly Social Pension Payout', 'Pension', 5, '08:00', 'Barangay Hall, Main Session Room', 'Distribution of the monthly social pension stipend for indigent senior citizens. Bring OSCA ID and one valid ID.', 40, pensioners, 26),
      program('PG-0002', 'Free BP & Blood Sugar Screening', 'Health', 3, '07:30', 'Barangay Health Center', 'Routine blood pressure and capillary blood glucose screening with free maintenance medicine consultation.', 50, withConditions, 22),
      program('PG-0003', 'Flu & Pneumonia Vaccination Drive', 'Health', 12, '08:30', 'Covered Court, Purok 3', 'Free influenza and pneumococcal vaccines in partnership with the City Health Office.', 80, active, 31),
      program('PG-0004', 'Elderly Filipino Week Celebration', 'Outreach', 20, '14:00', 'Barangay Multi-Purpose Hall', 'Annual celebration honoring our elders with a short program, raffle, and snacks.', 120, active, 48),
      program('PG-0005', 'Home Visits: Bedridden Seniors', 'Outreach', 8, '09:00', 'House-to-house (Purok 5–7)', 'Barangay health workers visit homebound seniors to deliver medicines and check vital signs.', 15, active.filter((s) => ageOf(s.birthdate) >= 75), 9),
      program('PG-0006', 'Quarterly Social Pension Payout', 'Pension', -25, '08:00', 'Barangay Hall, Main Session Room', 'Release of the quarterly social pension stipend.', 40, pensioners, 28),
      program('PG-0007', 'Free Eye Check-up & Reading Glasses', 'Health', -41, '09:00', 'Barangay Health Center', 'Visual acuity screening with free reading glasses courtesy of a partner optical clinic.', 60, active, 37),
      program('PG-0008', 'Zumba & Wellness for Seniors', 'Outreach', -10, '06:00', 'Barangay Plaza', 'Low-impact exercise session followed by a short talk on healthy aging.', 50, active, 24),
      program('PG-0009', 'Dental Mission', 'Health', -3, '08:00', 'Barangay Health Center', 'Free tooth extraction and denture consultation. Postponed due to weather.', 30, active, 12, true)
    ];

    const PURPOSES = {
      Financial: ['Emergency financial assistance', 'Support for daily living expenses', 'Assistance after house fire'],
      Medical: ['Purchase of maintenance medicines', 'Hospital bill assistance', 'Laboratory and diagnostic tests'],
      'Food Pack': ['Monthly food pack distribution', 'Relief goods after typhoon'],
      'Assistive Device': ['Wheelchair request', 'Walking cane and walker', 'Hearing aid request'],
      Burial: ['Burial assistance for family of the deceased']
    };
    const AMOUNT = {
      Financial: () => int(10, 50) * 100,
      Medical: () => int(20, 100) * 100,
      'Food Pack': () => int(5, 8) * 100,
      'Assistive Device': () => int(15, 60) * 100,
      Burial: () => int(100, 150) * 100
    };

    const living = seniors.filter((s) => s.status !== 'Deceased');
    const deceased = seniors.filter((s) => s.status === 'Deceased');
    const admins = SEED_USERS.filter((u) => u.role === 'Administrator');
    const staff = SEED_USERS.filter((u) => u.role === 'Barangay Staff');
    const assistance = [];
    for (let i = 0; i < 48; i++) {
      const tr = rand();
      const type = i < 3 ? 'Burial' : tr < 0.32 ? 'Medical' : tr < 0.58 ? 'Food Pack' : tr < 0.84 ? 'Financial' : 'Assistive Device';
      const senior = type === 'Burial' ? deceased[i % deceased.length] : pick(living);
      const ago = i < 8 ? int(0, 9) : int(0, 330);
      const requested = shift(-ago, int(8, 16), int(0, 59));
      let status;
      if (ago < 10) status = pick(['Pending', 'Pending', 'Approved']);
      else if (ago < 30) status = pick(['Pending', 'Approved', 'Released', 'Released']);
      else status = rand() < 0.86 ? 'Released' : 'Denied';

      const filer = pick(SEED_USERS);
      const approver = rand() < 0.6 ? pick(admins) : pick(staff);
      const history = [{ status: 'Pending', at: capNow(requested).toISOString(), by: filer.name, note: 'Request filed' }];
      if (status !== 'Pending') {
        const decided = new Date(requested); decided.setDate(decided.getDate() + int(1, 3));
        const isDenied = status === 'Denied';
        history.push({ status: isDenied ? 'Denied' : 'Approved', at: capNow(decided).toISOString(), by: approver.name, note: isDenied ? 'Incomplete supporting documents' : 'Approved for release' });
        if (status === 'Released') {
          const released = new Date(decided); released.setDate(released.getDate() + int(1, 5));
          history.push({ status: 'Released', at: capNow(released).toISOString(), by: pick(staff).name, note: 'Released to beneficiary' });
        }
      }
      const last = history[history.length - 1];
      assistance.push({
        id: `AR-${1001 + i}`,
        seniorId: senior.id,
        type,
        amount: AMOUNT[type](),
        purpose: pick(PURPOSES[type]),
        remarks: status === 'Denied' ? last.note : '',
        status,
        requestedAt: history[0].at,
        updatedAt: last.at,
        handledBy: last.by,
        history
      });
    }
    assistance.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

    const logs = [];
    const ip = () => `192.168.1.${int(10, 60)}`;
    const logAt = (d, user, action, module, details, severity = 'Info', address = ip()) => {
      if (d > now) d.setDate(d.getDate() - 1);
      logs.push({ id: `LOG-${pad(logs.length + 1, 5)}`, ts: d.toISOString(), user: user.name, role: user.role, action, module, details, severity, ip: address });
    };
    for (let i = 0; i < 70; i++) {
      const when = shift(-int(0, 20), int(7, 18), int(0, 59));
      const user = pick(SEED_USERS);
      const s = pick(seniors);
      const a = pick(assistance);
      const p = pick(programs);
      const r = rand();
      if (r < 0.2) logAt(when, user, 'Login', 'Authentication', `${user.name} signed in as ${user.role}`);
      else if (r < 0.32) logAt(when, user, 'Create', 'Senior Registry', `Registered ${displayName(s)} (${s.oscaId})`);
      else if (r < 0.44) logAt(when, user, 'Update', 'Senior Registry', `Updated profile of ${displayName(s)}`);
      else if (r < 0.54) logAt(when, pick(admins), 'Approve', 'Assistance Management', `Approved ${a.type} request ${a.id}`);
      else if (r < 0.62) logAt(when, pick(staff), 'Release', 'Assistance Management', `Released ${fmtMoney(a.amount)} ${a.type} assistance (${a.id})`);
      else if (r < 0.7) logAt(when, user, 'Update', 'Program Management', `Updated beneficiaries of “${p.title}”`);
      else if (r < 0.77) logAt(when, user, 'Export', 'Reports & Analytics', 'Exported demographic summary (CSV)');
      else if (r < 0.84) logAt(when, pick(admins), 'Backup', 'Database Backup', 'Automatic backup completed');
      else if (r < 0.92) logAt(when, { name: pick(['admin', 'staff01', 'guest', 'root']), role: '—' }, 'Failed Login', 'Authentication', 'Failed sign-in attempt: invalid credentials', 'Warning', `203.177.${int(1, 254)}.${int(1, 254)}`);
      else if (r < 0.97) logAt(when, user, 'Logout', 'Authentication', `${user.name} signed out`);
      else logAt(when, pick(admins), 'Delete', 'Senior Registry', `Removed duplicate record of ${displayName(s)}`, 'Warning');
    }
    logAt(shift(-12, 10, 15), pick(admins), 'Restore', 'Database Backup', 'Database restored from backup file bscims-backup.json', 'Critical');
    logAt(shift(-6, 15, 40), pick(admins), 'Update', 'Settings', 'Session timeout changed to 30 minutes', 'Warning');
    logs.sort((a, b) => b.ts.localeCompare(a.ts));

    const backups = [];
    for (let i = 1; i <= 6; i++) {
      backups.push({ id: `BK-${pad(i, 4)}`, ts: shift(-i, 2, 0).toISOString(), type: 'Automatic', size: int(170, 230) * 1024, by: 'System', records: seniors.length + assistance.length + programs.length });
    }
    backups.push({ id: 'BK-0007', ts: shift(-3, 16, 22).toISOString(), type: 'Manual', size: 214 * 1024, by: pick(admins).name, records: seniors.length + assistance.length + programs.length });
    backups.sort((a, b) => b.ts.localeCompare(a.ts));

    return {
      version: DB_VERSION,
      seededAt: now.toISOString(),
      seniors,
      programs,
      assistance,
      logs,
      backups,
      settings: {
        autoBackup: true,
        backupFrequency: 'Daily',
        retention: '30',
        notifications: true,
        emailAlerts: false,
        twoFactor: false,
        sessionTimeout: '30'
      }
    };
  }

  /* ------------------------------------------------------------------------
     4. Data layer (localStorage)
     ------------------------------------------------------------------------ */
  const MODULE_OF = { seniors: 'Senior Registry', programs: 'Program Management', assistance: 'Assistance Management', backups: 'Database Backup' };
  const MAX_LOGS = 1500;

  const DB = {
    _data: null,

    load() {
      if (this._data) return this._data;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === DB_VERSION) { this._data = parsed; return parsed; }
        }
      } catch (err) {
        console.warn('[BSCIAMS] Stored data is unreadable. Re-seeding.', err);
      }
      this._data = buildSeed();
      this.save();
      return this._data;
    },

    save() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        document.dispatchEvent(new CustomEvent('db:change'));
        return true;
      } catch (err) {
        console.error('[BSCIAMS] Unable to persist data.', err);
        toast('Browser storage is full or unavailable. Your latest change may not persist.', 'error');
        return false;
      }
    },

    all(col) { return this.load()[col] || []; },
    find(col, id) { return this.all(col).find((x) => x.id === id); },

    add(col, item, opts = {}) {
      const record = { ...item, id: item.id || uid(col.slice(0, 2)) };
      this.load()[col].unshift(record);
      this.log(opts.action || 'Create', opts.module || MODULE_OF[col], opts.details || `Created record ${record.id}`, opts.severity || 'Info', { persist: false });
      this.save();
      return record;
    },

    update(col, id, patch, opts = {}) {
      const list = this.all(col);
      const idx = list.findIndex((x) => x.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
      this.log(opts.action || 'Update', opts.module || MODULE_OF[col], opts.details || `Updated record ${id}`, opts.severity || 'Info', { persist: false });
      this.save();
      return list[idx];
    },

    remove(col, id, opts = {}) {
      const data = this.load();
      const before = data[col].length;
      data[col] = data[col].filter((x) => x.id !== id);
      if (data[col].length === before) return false;
      this.log('Delete', opts.module || MODULE_OF[col], opts.details || `Deleted record ${id}`, opts.severity || 'Warning', { persist: false });
      this.save();
      return true;
    },

    log(action, module, details, severity = 'Info', opts = {}) {
      const session = Session.get();
      const entry = {
        id: uid('LOG'),
        ts: new Date().toISOString(),
        user: opts.user || (session ? session.name : 'System'),
        role: opts.role || (session ? session.role : '—'),
        action, module, details, severity,
        ip: opts.ip || (session ? session.ip : '127.0.0.1')
      };
      const data = this.load();
      data.logs.unshift(entry);
      if (data.logs.length > MAX_LOGS) data.logs.length = MAX_LOGS;
      if (opts.persist !== false) this.save();
      return entry;
    },

    get settings() { return this.load().settings; },
    setSettings(patch, details) {
      this.load().settings = { ...this.load().settings, ...patch };
      this.log('Update', 'Settings', details || 'System settings updated', 'Warning', { persist: false });
      this.save();
    },

    sizeBytes() { return new Blob([JSON.stringify(this.load())]).size; },

    exportData() { return { ...this.load(), exportedAt: new Date().toISOString(), exportedBy: Session.get()?.name || 'System' }; },

    validate(obj) {
      if (!obj || typeof obj !== 'object') return 'The file is not a valid backup.';
      if (obj.version !== DB_VERSION) return `Unsupported backup version (${obj.version ?? 'missing'}).`;
      for (const key of ['seniors', 'programs', 'assistance', 'logs']) {
        if (!Array.isArray(obj[key])) return `Backup is missing the "${key}" collection.`;
      }
      const badSenior = obj.seniors.find((s) => !s || !s.id || !s.firstName || !s.lastName || !s.birthdate);
      if (badSenior) return 'One or more senior records are incomplete.';
      return '';
    },

    importData(obj) {
      const seed = buildSeed();
      this._data = {
        version: DB_VERSION,
        seededAt: obj.seededAt || seed.seededAt,
        seniors: obj.seniors,
        programs: obj.programs,
        assistance: obj.assistance,
        logs: obj.logs,
        backups: Array.isArray(obj.backups) ? obj.backups : [],
        settings: { ...seed.settings, ...(obj.settings || {}) }
      };
      return this.save();
    },

    reset() { this._data = buildSeed(); return this.save(); }
  };

  /* ------------------------------------------------------------------------
     5. Auth — the Flask server checks the password and keeps the sign-in cookie
     ------------------------------------------------------------------------ */
  const Auth = {
    ROLES: Object.keys(PERMISSIONS),

    validateUsername(username) {
      const value = String(username || '').trim();
      if (!value) return 'Username is required.';
      if (value.length < 3) return 'Username must be at least 3 characters.';
      if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Use letters, numbers, dots, hyphens, or underscores only.';
      return '';
    },

    validatePassword(password) {
      const value = String(password || '');
      if (!value) return 'Password is required.';
      if (value.length < 8) return 'Password must be at least 8 characters.';
      return '';
    },

    validateRole(role) {
      if (!role) return 'This account has no role assigned.';
      if (!this.ROLES.includes(role)) return 'This account does not have a valid system role.';
      return '';
    },

    validateEntry(payload) {
      const errors = {};
      const usernameError = this.validateUsername(payload.username);
      const passwordError = this.validatePassword(payload.password);
      if (usernameError) errors.username = usernameError;
      if (passwordError) errors.password = passwordError;
      return errors;
    },

    async currentUser() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!res.ok) return null;
        const body = await res.json();
        if (!body.user || this.validateRole(body.user.role)) return null;
        return body.user;
      } catch (_) {
        return null;
      }
    },

    async logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', keepalive: true });
      } catch (_) {}
    },

    async authenticate(payload) {
      const errors = this.validateEntry(payload);
      if (Object.keys(errors).length) return { ok: false, errors };

      let res;
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            username: payload.username,
            password: payload.password,
            remember: !!payload.remember
          })
        });
      } catch (_) {
        return { ok: false, errors: { form: 'The sign-in server is not running. Start it, then open http://127.0.0.1:5000.' } };
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok || !body.user) {
        return { ok: false, errors: body.errors || { form: 'Invalid username or password.' } };
      }
      const roleError = this.validateRole(body.user.role);
      if (roleError) return { ok: false, errors: { form: roleError } };
      return { ok: true, user: body.user };
    }
  };

  /* ------------------------------------------------------------------------
     6. Session & permissions
     ------------------------------------------------------------------------ */
  const Session = {
    _cache: undefined,

    get() {
      if (this._cache !== undefined) return this._cache;
      let s = null;
      try { s = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { s = null; }
      this._cache = s;
      return s;
    },

    start(user, remember) {
      const session = {
        name: user.name,
        role: user.role,
        username: user.username || '',
        loginAt: new Date().toISOString(),
        lastActive: Date.now(),
        ip: `192.168.1.${10 + Math.floor(Math.random() * 40)}`,
        remember: !!remember
      };
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
      this._cache = session;
      return session;
    },

    touch() {
      const s = this.get();
      if (!s) return;
      s.lastActive = Date.now();
      (s.remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
    },

    isExpired() {
      const s = this.get();
      if (!s) return true;
      const minutes = Number(DB.settings.sessionTimeout || 30);
      return Date.now() - (s.lastActive || 0) > minutes * 60000;
    },

    end(reason = 'signedout') {
      const s = this.get();
      if (s) DB.log('Logout', 'Authentication', reason === 'expired' ? `${s.name}'s session expired` : `${s.name} signed out`);
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      this._cache = null;
      const next = `${LOGIN_URL}?${reason}=1`;
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', keepalive: true })
        .catch(() => {})
        .finally(() => { location.href = next; });
    }
  };

  const can = (perm) => {
    const s = Session.get();
    if (!s) return false;
    const list = PERMISSIONS[s.role] || [];
    return list.includes('*') || list.includes(perm);
  };

  function applyPermissions(root = document) {
    $$('[data-perm]', root).forEach((el) => {
      if (can(el.dataset.perm)) return;
      if ('permHide' in el.dataset) { el.hidden = true; return; }
      el.disabled = true;
      el.classList.add('is-locked');
      el.setAttribute('title', 'Your role does not have access to this action');
      el.setAttribute('aria-disabled', 'true');
    });
  }

  /* ------------------------------------------------------------------------
     6. Toasts, flash messages, downloads
     ------------------------------------------------------------------------ */
  function toast(message, type = 'success', title) {
    let stack = $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const titles = { success: 'Success', error: 'Something went wrong', warning: 'Heads up', info: 'Notice' };
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info}" aria-hidden="true"></i>
      <div class="toast__body">
        <strong class="toast__title">${esc(title || titles[type] || titles.info)}</strong>
        <span class="toast__msg">${esc(message)}</span>
      </div>
      <button type="button" class="icon-btn icon-btn--sm" aria-label="Dismiss notification"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
    stack.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
    const remove = () => { el.classList.remove('is-visible'); setTimeout(() => el.remove(), 260); };
    const timer = setTimeout(remove, 4200);
    el.querySelector('button').addEventListener('click', () => { clearTimeout(timer); remove(); });
  }

  const flash = (message, type = 'success', title) => sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type, title }));
  function showFlash() {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FLASH_KEY);
    try { const f = JSON.parse(raw); toast(f.message, f.type, f.title); } catch (_) { /* ignore malformed flash */ }
  }

  function downloadBlob(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCSV(filename, rows) {
    const csv = rows.map((row) => row.map((v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\r\n');
    downloadBlob('\ufeff' + csv, filename, 'text/csv;charset=utf-8');
  }

  const fileStamp = () => { const d = new Date(); return `${toISODate(d).replace(/-/g, '')}-${pad(d.getHours())}${pad(d.getMinutes())}`; };

  /* ------------------------------------------------------------------------
     7. Modal & drawer manager, confirm dialog
     ------------------------------------------------------------------------ */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusables = (el) => $$(FOCUSABLE, el).filter((x) => x.offsetParent !== null || x === document.activeElement);

  const Modal = {
    stack: [],

    open(target) {
      const el = typeof target === 'string' ? document.getElementById(target) : target;
      if (!el || el.classList.contains('is-open')) return el;
      el._returnFocus = document.activeElement;
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      this.stack.push(el);
      document.body.classList.add('no-scroll');
      requestAnimationFrame(() => {
        const list = focusables(el);
        const first = el.querySelector('[autofocus]') || list.find((x) => !x.matches('[data-close]')) || list[0];
        if (first) first.focus({ preventScroll: true });
      });
      el.dispatchEvent(new CustomEvent('modal:open'));
      return el;
    },

    close(target) {
      const el = target ? (typeof target === 'string' ? document.getElementById(target) : target) : this.top();
      if (!el || !el.classList.contains('is-open')) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      this.stack = this.stack.filter((x) => x !== el);
      if (!this.stack.length) document.body.classList.remove('no-scroll');
      if (el._returnFocus && document.contains(el._returnFocus)) el._returnFocus.focus({ preventScroll: true });
      el.dispatchEvent(new CustomEvent('modal:close'));
    },

    top() { return this.stack[this.stack.length - 1]; }
  };

  function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', tone = 'danger', icon = 'fa-triangle-exclamation', input = null } = {}) {
    return new Promise((resolve) => {
      let m = document.getElementById('confirmModal');
      if (!m) {
        m = document.createElement('div');
        m.className = 'modal modal--sm';
        m.id = 'confirmModal';
        m.setAttribute('aria-hidden', 'true');
        m.innerHTML = `
          <div class="modal__backdrop" data-close></div>
          <div class="modal__dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
            <div class="modal__body">
              <div class="confirm-body">
                <span class="confirm-icon" id="confirmIcon" aria-hidden="true"></span>
                <div style="flex:1;min-width:0">
                  <h2 class="modal__title" id="confirmTitle"></h2>
                  <p class="muted mt-2" id="confirmMessage"></p>
                  <div class="field mt-4" id="confirmInputWrap" hidden>
                    <label class="label" for="confirmInput" id="confirmInputLabel"></label>
                    <textarea class="textarea" id="confirmInput" rows="3"></textarea>
                    <small class="field__error"></small>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal__footer">
              <button type="button" class="btn btn--secondary" data-close id="confirmCancel"></button>
              <button type="button" class="btn" id="confirmOk"></button>
            </div>
          </div>`;
        document.body.appendChild(m);
      }
      const tones = {
        danger: ['tone-alert', 'btn--danger'],
        warning: ['tone-pending', 'btn--primary'],
        primary: ['tone-violet', 'btn--primary'],
        success: ['tone-approved', 'btn--success']
      };
      const [iconTone, btnTone] = tones[tone] || tones.primary;
      $('#confirmIcon', m).className = `confirm-icon ${iconTone}`;
      $('#confirmIcon', m).innerHTML = `<i class="fa-solid ${icon}"></i>`;
      $('#confirmTitle', m).textContent = title;
      $('#confirmMessage', m).textContent = message;
      $('#confirmCancel', m).textContent = cancelText;
      const ok = $('#confirmOk', m);
      ok.className = `btn ${btnTone}`;
      ok.textContent = confirmText;

      const wrap = $('#confirmInputWrap', m);
      const field = $('#confirmInput', m);
      wrap.hidden = !input;
      field.value = '';
      Form.clearErrors(m);
      if (input) {
        $('#confirmInputLabel', m).textContent = input.label || 'Remarks';
        field.placeholder = input.placeholder || '';
      }

      let settled = false;
      const cleanup = () => { ok.removeEventListener('click', onOk); m.removeEventListener('modal:close', onClose); };
      const onOk = () => {
        if (input) {
          const value = field.value.trim();
          if (input.required && !value) { Form.setError(field, 'Please provide a reason.'); field.focus(); return; }
          settled = true; cleanup(); Modal.close(m); resolve(value);
        } else {
          settled = true; cleanup(); Modal.close(m); resolve(true);
        }
      };
      const onClose = () => { cleanup(); if (!settled) resolve(input ? null : false); };
      ok.addEventListener('click', onOk);
      m.addEventListener('modal:close', onClose);
      Modal.open(m);
    });
  }

  /* ------------------------------------------------------------------------
     8. Form helpers
     ------------------------------------------------------------------------ */
  const Form = {
    data(form) {
      const out = {};
      $$('input, select, textarea', form).forEach((el) => {
        if (!el.name || el.type === 'file') return;
        if (el.type === 'checkbox') {
          const group = form.querySelectorAll(`input[type="checkbox"][name="${el.name}"]`);
          if (group.length > 1) {
            out[el.name] = out[el.name] || [];
            if (el.checked) out[el.name].push(el.value);
          } else {
            out[el.name] = el.checked;
          }
        } else if (el.type === 'radio') {
          if (el.checked) out[el.name] = el.value;
          else if (!(el.name in out)) out[el.name] = '';
        } else if (el.type === 'number') {
          out[el.name] = el.value === '' ? '' : Number(el.value);
        } else {
          out[el.name] = el.value.trim();
        }
      });
      return out;
    },

    fill(form, data) {
      $$('input, select, textarea', form).forEach((el) => {
        if (!el.name || !(el.name in data) || el.type === 'file') return;
        const v = data[el.name];
        if (el.type === 'checkbox') el.checked = Array.isArray(v) ? v.includes(el.value) : !!v;
        else if (el.type === 'radio') el.checked = el.value === v;
        else el.value = v ?? '';
      });
    },

    reset(form) { form.reset(); this.clearErrors(form); },

    clearErrors(scope) {
      $$('.is-invalid', scope).forEach((el) => { el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); });
      $$('.field__error', scope).forEach((el) => { el.textContent = ''; });
    },

    setError(el, message) {
      el.classList.add('is-invalid');
      el.setAttribute('aria-invalid', 'true');
      const field = el.closest('.field');
      if (field) field.classList.add('is-invalid');
      const named = field?.querySelector(`[data-error-for="${el.name}"]`);
      const err = named || field?.querySelector('.field__error');
      if (err) err.textContent = message;
    },

    message(el) {
      const v = el.validity;
      if (el.dataset.error && !v.valueMissing) return el.dataset.error;
      if (v.valueMissing) return el.type === 'radio' ? 'Please choose an option.' : 'This field is required.';
      if (v.typeMismatch) return 'Please enter a valid value.';
      if (v.patternMismatch) return el.title || 'Please match the requested format.';
      if (v.tooShort) return `Must be at least ${el.minLength} characters.`;
      if (v.rangeUnderflow) return `Must be at least ${el.min}.`;
      if (v.rangeOverflow) return `Must be at most ${el.max}.`;
      return 'Please check this value.';
    },

    validate(form, custom) {
      this.clearErrors(form);
      let first = null;
      $$('input, select, textarea', form).forEach((el) => {
        if (el.disabled || el.type === 'hidden' || el.type === 'file') return;
        if (!el.checkValidity()) {
          this.setError(el, this.message(el));
          first = first || el;
        }
      });
      if (custom) {
        const errors = custom(this.data(form)) || {};
        Object.entries(errors).forEach(([name, msg]) => {
          if (!msg) return;
          const node = form.elements[name];
          const el = node instanceof RadioNodeList ? node[0] : node;
          if (el) { this.setError(el, msg); first = first || el; }
        });
      }
      if (first) first.focus();
      return !first;
    }
  };

  document.addEventListener('input', (e) => {
    const el = e.target;
    const field = el.closest?.('.field');
    if (!el.classList || (!el.classList.contains('is-invalid') && !field?.classList.contains('is-invalid'))) return;
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
    if (field) field.classList.remove('is-invalid');
    const err = field?.querySelector('.field__error');
    if (err) err.textContent = '';
  });

  function fillOptionSets(root = document) {
    $$('select[data-options]', root).forEach((sel) => {
      const set = OPTION_SETS[sel.dataset.options];
      if (!set || sel.dataset.filled) return;
      sel.insertAdjacentHTML('beforeend', set.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join(''));
      sel.dataset.filled = 'true';
    });
  }

  /* ------------------------------------------------------------------------
     9. Render helpers
     ------------------------------------------------------------------------ */
  const badge = (text, tone, attrs = '') => `<span class="badge badge--${tone || STATUS_TONE[text] || 'neutral'}" ${attrs}>${esc(text)}</span>`;
  const avatar = (name, cls = '', photo) => photo
    ? `<span class="avatar ${cls} avatar--photo" aria-hidden="true"><img src="${photo}" alt=""></span>`
    : `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(name))}</span>`;
  const emptyState = (title, text, icon = 'fa-inbox') => `
    <div class="empty-state">
      <span class="empty-state__icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
      <strong>${esc(title)}</strong>
      <span>${esc(text)}</span>
    </div>`;
  const emptyRow = (cols, title, text, icon) => `<tr><td colspan="${cols}">${emptyState(title, text, icon)}</td></tr>`;

  const skeletonRows = (cols, count = 6) => Array.from({ length: count }, () => `
    <tr>
      ${Array.from({ length: cols }, (_, i) => `<td>${i === 1 || i === 0
        ? `<div class="skeleton-row"><span class="skeleton skeleton--avatar"></span><div class="skeleton-row__body"><span class="skeleton skeleton--text"></span><span class="skeleton skeleton--text-sm"></span></div></div>`
        : `<span class="skeleton ${i === cols - 1 ? 'skeleton--badge' : 'skeleton--text'}"></span>`}</td>`).join('')}
    </tr>`).join('');

  function renderIdCard(s) {
    if (s.idCardImage) {
      return `<article class="id-card id-card--scan"><img class="id-card__scan" src="${s.idCardImage}" alt="Senior Citizen ID for ${esc(displayName(s))}"></article>`;
    }
    const issued = parseDate(s.registeredAt);
    const expiry = issued ? issued.getFullYear() + 3 : new Date().getFullYear() + 3;
    const photo = s.photo
      ? `<img src="${s.photo}" alt="">`
      : esc(initials(`${s.firstName} ${s.lastName}`));
    return `
      <article class="id-card">
        <header class="id-card__banner">
          <span class="id-card__seal" aria-hidden="true"><i class="fa-solid fa-landmark-flag"></i></span>
          <span class="id-card__office">
            <span class="id-card__kicker">Republic of the Philippines</span>
            <span class="id-card__title">Senior Citizen ID</span>
          </span>
          <span class="id-card__ra">R.A. 9994</span>
        </header>
        <div class="id-card__body">
          <div class="id-card__photo">${photo}</div>
          <div class="id-card__meta">
            <h3 class="id-card__name">${esc(`${s.firstName} ${s.middleName ? s.middleName[0] + '. ' : ''}${s.lastName}`)}</h3>
            <dl class="id-card__dl">
              <div><dt>Sex</dt><dd>${esc(s.sex)}</dd></div>
              <div><dt>Birth</dt><dd>${esc(fmtDate(s.birthdate, { month: 'short', day: 'numeric', year: 'numeric' }))}</dd></div>
              <div><dt>Purok</dt><dd>${esc(s.purok)}</dd></div>
            </dl>
            <span class="id-card__number">${esc(s.oscaId)}</span>
          </div>
          <div class="id-card__codes">
            <div class="id-card__qr" role="img" aria-label="QR code placeholder for ${esc(s.oscaId)}"></div>
            <div class="id-card__barcode" role="img" aria-label="Barcode placeholder"></div>
          </div>
        </div>
        <footer class="id-card__footer">
          <span>Barangay OSCA</span>
          <span>Valid until ${expiry}</span>
        </footer>
      </article>`;
  }

  function printIdCards(seniors) {
    const sheet = $('#idPrintSheet');
    if (!sheet || !seniors.length) {
      toast('Select at least one senior citizen to print IDs.', 'warning');
      return;
    }
    sheet.innerHTML = seniors.map(renderIdCard).join('');
    sheet.hidden = false;
    document.body.classList.add('is-printing-ids');
    const restore = () => {
      document.body.classList.remove('is-printing-ids');
      sheet.hidden = true;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  function renderPagination(el, { total, page, perPage, onChange }) {
    if (!el) return 1;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const current = Math.min(Math.max(1, page), pages);
    const start = total ? (current - 1) * perPage + 1 : 0;
    const end = Math.min(total, current * perPage);

    let list = [];
    if (pages <= 7) list = Array.from({ length: pages }, (_, i) => i + 1);
    else {
      list = [1];
      const from = Math.max(2, current - 1);
      const to = Math.min(pages - 1, current + 1);
      if (from > 2) list.push('…');
      for (let i = from; i <= to; i++) list.push(i);
      if (to < pages - 1) list.push('…');
      list.push(pages);
    }

    el.innerHTML = `
      <span>Showing <strong>${start}–${end}</strong> of <strong>${fmtNumber(total)}</strong></span>
      <div class="pagination__pages">
        <button type="button" class="page-btn" data-goto="${current - 1}" ${current <= 1 ? 'disabled' : ''} aria-label="Previous page"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        ${list.map((p) => (p === '…'
          ? '<span class="page-btn" aria-hidden="true" style="border:0;display:grid;place-items:center">…</span>'
          : `<button type="button" class="page-btn ${p === current ? 'is-active' : ''}" data-goto="${p}" ${p === current ? 'aria-current="page"' : ''}>${p}</button>`)).join('')}
        <button type="button" class="page-btn" data-goto="${current + 1}" ${current >= pages ? 'disabled' : ''} aria-label="Next page"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
      </div>`;
    el.onclick = (e) => {
      const btn = e.target.closest('[data-goto]');
      if (btn && !btn.disabled) onChange(Number(btn.dataset.goto));
    };
    return current;
  }

  const paginate = (items, page, perPage) => items.slice((page - 1) * perPage, page * perPage);

  function sortBy(list, key, dir, getters = {}) {
    const get = getters[key] || ((x) => x[key]);
    const mult = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
      return String(va ?? '').localeCompare(String(vb ?? '')) * mult;
    });
  }

  function syncSortHeaders(table, key, dir) {
    $$('.th-sort', table).forEach((btn) => {
      const active = btn.dataset.sort === key;
      btn.classList.toggle('is-sorted', active);
      btn.closest('th').setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const icon = btn.querySelector('i');
      if (icon) icon.className = `fa-solid ${active ? (dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-arrows-up-down'}`;
    });
  }

  function runProgress(wrap, steps, speed = 140) {
    return new Promise((resolve) => {
      const fill = $('.progress__fill', wrap);
      const label = $('.progress__label', wrap);
      const pct = $('.progress__pct', wrap);
      const bar = $('.progress', wrap);
      wrap.hidden = false;
      let p = 0;
      fill.style.width = '0%';
      const timer = setInterval(() => {
        p = Math.min(100, p + 5 + Math.random() * 11);
        fill.style.width = `${p}%`;
        pct.textContent = `${Math.round(p)}%`;
        label.textContent = steps[Math.min(steps.length - 1, Math.floor((p / 100) * steps.length))];
        if (bar) bar.setAttribute('aria-valuenow', String(Math.round(p)));
        if (p >= 100) { clearInterval(timer); setTimeout(resolve, 300); }
      }, speed);
    });
  }

  /* ------------------------------------------------------------------------
     10. Domain helpers
     ------------------------------------------------------------------------ */
  const programStatus = (p) => (p.cancelled ? 'Cancelled' : parseDate(p.date) >= startOfDay() ? 'Upcoming' : 'Completed');

  const nextOscaId = () => {
    const year = new Date().getFullYear();
    const max = DB.all('seniors').reduce((m, s) => Math.max(m, Number(String(s.oscaId).split('-').pop()) || 0), 0);
    return `OSCA-${year}-${pad(max + 1, 4)}`;
  };
  const nextRequestId = () => {
    const max = DB.all('assistance').reduce((m, a) => Math.max(m, Number(String(a.id).replace(/\D/g, '')) || 0), 1000);
    return `AR-${max + 1}`;
  };
  const nextProgramId = () => {
    const max = DB.all('programs').reduce((m, p) => Math.max(m, Number(String(p.id).replace(/\D/g, '')) || 0), 0);
    return `PG-${pad(max + 1, 4)}`;
  };

  const seniorOptions = (filter = (s) => s.status === 'Active') => sortBy(DB.all('seniors').filter(filter), 'lastName', 'asc')
    .map((s) => `<option value="${esc(s.id)}">${esc(fullName(s))} (${esc(s.oscaId)})</option>`).join('');

  function detectDevice() {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
    return `${browser} on ${os}`;
  }

  /* ------------------------------------------------------------------------
     11. App shell: sidebar, topbar, search, notifications
     ------------------------------------------------------------------------ */
  function navGroupState() {
    try { return JSON.parse(localStorage.getItem(NAV_KEY) || '{}'); } catch (_) { return {}; }
  }

  function renderSidebar() {
    const sidebar = $('#sidebar');
    if (!sidebar) return;
    const session = Session.get();
    const groups = navGroupState();
    const pending = DB.all('assistance').filter((a) => a.status === 'Pending').length;

    const link = (item) => `
      <a class="nav-link ${item.page === PAGE ? 'is-active' : ''}" href="${item.href}" ${item.page === PAGE ? 'aria-current="page"' : ''}>
        <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
        <span>${esc(item.text)}</span>
        ${item.badge === 'pending' && pending ? `<span class="nav-link__badge" aria-label="${pending} pending">${pending}</span>` : ''}
      </a>`;

    const sections = NAV.map((section) => {
      if (!section.group) return `<p class="nav-label">${esc(section.label)}</p>${section.items.map(link).join('')}`;
      const containsActive = section.items.some((i) => i.page === PAGE);
      const open = containsActive || groups[section.group] !== false;
      return `
        <p class="nav-label">${esc(section.label)}</p>
        <div class="nav-group ${open ? 'is-open' : ''}" data-group="${section.group}">
          <button type="button" class="nav-group__toggle" aria-expanded="${open}" aria-controls="nav-${section.group}">
            <i class="fa-solid ${section.groupIcon}" aria-hidden="true"></i>
            <span>${esc(section.groupLabel)}</span>
            <i class="fa-solid fa-chevron-down nav-group__chev" aria-hidden="true"></i>
          </button>
          <div class="nav-group__panel" id="nav-${section.group}">
            <div class="nav-group__inner">${section.items.map(link).join('')}</div>
          </div>
        </div>`;
    }).join('');

    sidebar.innerHTML = `
      <div class="sidebar__brand">
        <a class="brand" href="dashboard.html" aria-label="BSCIAMS home">
          <span class="brand__mark" aria-hidden="true"><i class="fa-solid fa-hand-holding-heart"></i></span>
          <span class="brand__text"><strong>BSCIAMS</strong><small>Barangay Senior Care</small></span>
        </a>
        <button type="button" class="icon-btn sidebar__close" id="sidebarClose" aria-label="Close navigation"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <nav class="sidebar__nav" aria-label="Main">${sections}</nav>
      <div class="sidebar__footer">
        <div class="sidebar-user">
          ${avatar(session.name, 'avatar--solid')}
          <div class="sidebar-user__text"><strong>${esc(session.name)}</strong><small>${esc(session.role)}</small></div>
          <button type="button" class="icon-btn icon-btn--sm" data-action="logout" aria-label="Sign out" title="Sign out"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i></button>
        </div>
      </div>`;

    $$('.nav-group__toggle', sidebar).forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.nav-group');
        const open = !group.classList.contains('is-open');
        group.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        const state = navGroupState();
        state[group.dataset.group] = open;
        localStorage.setItem(NAV_KEY, JSON.stringify(state));
      });
    });
    $('#sidebarClose', sidebar).addEventListener('click', () => toggleSidebar(false));
  }

  function toggleSidebar(force) {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebarOverlay');
    const btn = $('#menuToggle');
    if (!sidebar) return;
    const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', open);
    overlay?.classList.toggle('is-open', open);
    btn?.setAttribute('aria-expanded', String(open));
    if (open) $('.nav-link.is-active', sidebar)?.focus({ preventScroll: true });
  }

  function renderTopbar() {
    const topbar = $('#topbar');
    if (!topbar) return;
    const session = Session.get();
    topbar.innerHTML = `
      <button type="button" class="icon-btn topbar__menu" id="menuToggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>

      <form class="search" id="globalSearch" role="search" autocomplete="off">
        <label for="globalSearchInput" class="sr-only">Search the system</label>
        <i class="fa-solid fa-magnifying-glass search__icon" aria-hidden="true"></i>
        <input type="search" class="search__input" id="globalSearchInput" placeholder="Search seniors, programs, requests…"
               role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="searchResults">
        <kbd class="search__kbd" aria-hidden="true">/</kbd>
        <div class="dropdown-panel search__results" id="searchResults" role="listbox" aria-label="Search results"></div>
      </form>

      <div class="topbar__actions">
        <button type="button" class="theme-toggle" id="themeToggle" data-theme-toggle data-tooltip="Switch theme" data-tooltip-pos="down" aria-label="Switch theme">
          <i class="fa-solid fa-sun" aria-hidden="true"></i>
        </button>

        <div class="dropdown" id="notifDropdown">
          <button type="button" class="icon-btn" data-dropdown-toggle aria-haspopup="true" aria-expanded="false" aria-label="Notifications">
            <i class="fa-regular fa-bell" aria-hidden="true"></i>
            <span class="dot-badge" id="notifCount" hidden>0</span>
          </button>
          <div class="dropdown-panel dropdown-panel--right notif-panel">
            <div class="notif-panel__head">
              <strong>Notifications</strong>
              <button type="button" class="link small" id="markAllRead">Mark all as read</button>
            </div>
            <div class="notif-list" id="notifList"></div>
            <div class="notif-panel__foot"><a class="link small" href="assistance-management.html">View assistance queue</a></div>
          </div>
        </div>

        <div class="dropdown" id="userDropdown">
          <button type="button" class="user-chip" data-dropdown-toggle aria-haspopup="true" aria-expanded="false" aria-label="Account menu">
            ${avatar(session.name, 'avatar--sm')}
            <span class="user-chip__text"><strong>${esc(session.name)}</strong><small>${esc(session.role)}</small></span>
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
          <div class="dropdown-panel dropdown-panel--right">
            <div class="dropdown-head">
              <strong>${esc(session.name)}</strong>
              <small>${esc(session.role)} · Signed in ${esc(relTime(session.loginAt).toLowerCase())}</small>
            </div>
            <div class="dropdown-menu">
              <a class="dropdown-item" href="dashboard.html"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i>Dashboard</a>
              <a class="dropdown-item" href="database-backup.html#settings"><i class="fa-solid fa-gear" aria-hidden="true"></i>System settings</a>
              <a class="dropdown-item" href="audit-trail.html"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>Activity log</a>
              <div class="dropdown-divider"></div>
              <button type="button" class="dropdown-item dropdown-item--danger" data-action="logout"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>Sign out</button>
            </div>
          </div>
        </div>
      </div>`;

    $('#menuToggle').addEventListener('click', () => toggleSidebar());
    $('#sidebarOverlay')?.addEventListener('click', () => toggleSidebar(false));
    $('#markAllRead').addEventListener('click', () => {
      const read = new Set(readNotifications());
      buildNotifications().forEach((n) => read.add(n.id));
      localStorage.setItem(READ_KEY, JSON.stringify([...read].slice(-300)));
      renderNotifications();
    });
    initSearch();
    renderNotifications();
    Theme.bind(topbar);
  }

  /* Global search ------------------------------------------------------- */
  function searchAll(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const seniors = DB.all('seniors');
    const byId = new Map(seniors.map((s) => [s.id, s]));

    const seniorHits = seniors.filter((s) => `${s.firstName} ${s.middleName} ${s.lastName} ${s.oscaId} ${s.purok}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({ group: 'Seniors', icon: 'fa-user', title: displayName(s), meta: `${s.oscaId} · ${s.purok} · ${ageOf(s.birthdate)} yrs`, href: `senior-registry.html?view=${encodeURIComponent(s.id)}` }));

    const programHits = DB.all('programs').filter((p) => `${p.title} ${p.venue} ${p.type}`.toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => ({ group: 'Programs', icon: PROGRAM_ICONS[p.type] || 'fa-calendar', title: p.title, meta: `${p.type} · ${fmtDate(p.date)} · ${programStatus(p)}`, href: `program-management.html?open=${encodeURIComponent(p.id)}` }));

    const aidHits = DB.all('assistance').filter((a) => {
      const s = byId.get(a.seniorId);
      return `${a.id} ${a.type} ${a.status} ${s ? displayName(s) : ''}`.toLowerCase().includes(q);
    }).slice(0, 4)
      .map((a) => ({ group: 'Assistance requests', icon: AID_ICONS[a.type] || 'fa-hand-holding-medical', title: `${a.id} · ${a.type}`, meta: `${displayName(byId.get(a.seniorId))} · ${fmtMoney(a.amount)} · ${a.status}`, href: `assistance-management.html?request=${encodeURIComponent(a.id)}` }));

    return [...seniorHits, ...programHits, ...aidHits];
  }

  function initSearch() {
    const form = $('#globalSearch');
    const input = $('#globalSearchInput');
    const panel = $('#searchResults');
    let active = -1;

    const setOpen = (open) => {
      form.classList.toggle('is-open', open);
      input.setAttribute('aria-expanded', String(open));
      if (!open) { active = -1; input.removeAttribute('aria-activedescendant'); }
    };

    const render = () => {
      const q = input.value.trim();
      if (q.length < 2) { setOpen(false); panel.innerHTML = ''; return; }
      const results = searchAll(q);
      active = -1;
      if (!results.length) {
        panel.innerHTML = `<div class="search-empty">No matches for “${esc(q)}”</div>`;
      } else {
        let lastGroup = '';
        panel.innerHTML = results.map((r, i) => {
          const heading = r.group !== lastGroup ? `<div class="search-group__label">${esc(r.group)}</div>` : '';
          lastGroup = r.group;
          return `${heading}
            <a class="search-item" id="search-opt-${i}" role="option" href="${r.href}">
              <span class="search-item__icon"><i class="fa-solid ${r.icon}" aria-hidden="true"></i></span>
              <span class="search-item__text"><strong>${highlight(r.title, q)}</strong><small>${highlight(r.meta, q)}</small></span>
            </a>`;
        }).join('');
      }
      setOpen(true);
    };

    input.addEventListener('input', debounce(render, 150));
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) render(); });
    input.addEventListener('keydown', (e) => {
      const items = $$('.search-item', panel);
      if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('is-active', i === active));
        input.setAttribute('aria-activedescendant', items[active].id);
        items[active].scrollIntoView({ block: 'nearest' });
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const items = $$('.search-item', panel);
      const target = items[active] || items[0];
      if (target) location.href = target.getAttribute('href');
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) setOpen(false); });
    form._close = () => setOpen(false);
  }

  /* Notifications ------------------------------------------------------- */
  const readNotifications = () => { try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); } catch (_) { return []; } };

  function buildNotifications() {
    const items = [];
    const today = startOfDay();
    const seniors = DB.all('seniors');
    const byId = new Map(seniors.map((s) => [s.id, s]));

    DB.all('assistance').filter((a) => a.status === 'Pending').slice(0, 6).forEach((a) => {
      items.push({
        id: `req-${a.id}`, icon: AID_ICONS[a.type] || 'fa-hand-holding-medical', tone: 'pending',
        title: `Pending ${a.type.toLowerCase()} request`,
        text: `${displayName(byId.get(a.seniorId))} · ${fmtMoney(a.amount)}`,
        when: relTime(a.requestedAt), sort: new Date(a.requestedAt).getTime(),
        href: `assistance-management.html?request=${encodeURIComponent(a.id)}`
      });
    });

    DB.all('programs').filter((p) => programStatus(p) === 'Upcoming').forEach((p) => {
      const days = daysBetween(today, parseDate(p.date));
      if (days > 7) return;
      items.push({
        id: `prog-${p.id}-${p.date}`, icon: PROGRAM_ICONS[p.type], tone: 'violet',
        title: p.title, text: `${fmtDate(p.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${p.venue}`,
        when: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`, sort: Date.now() - days * 1000,
        href: `program-management.html?open=${encodeURIComponent(p.id)}`
      });
    });

    seniors.filter((s) => s.status === 'Active').forEach((s) => {
      const b = parseDate(s.birthdate);
      let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
      const days = daysBetween(today, next);
      if (days > 7) return;
      const turning = next.getFullYear() - b.getFullYear();
      items.push({
        id: `bday-${s.id}-${next.getFullYear()}`, icon: 'fa-cake-candles', tone: 'approved',
        title: `Birthday: ${displayName(s)}`, text: `Turns ${turning} on ${fmtDate(toISODate(next), { month: 'short', day: 'numeric' })}`,
        when: days === 0 ? 'Today' : `In ${days} day${days > 1 ? 's' : ''}`, sort: Date.now() - days * 1000 - 500,
        href: `senior-registry.html?view=${encodeURIComponent(s.id)}`
      });
    });

    if (can('audit.view')) {
      const since = Date.now() - 86400000;
      const failed = DB.all('logs').filter((l) => l.action === 'Failed Login' && new Date(l.ts).getTime() > since);
      if (failed.length) {
        items.push({
          id: `sec-${failed[0].id}`, icon: 'fa-shield-halved', tone: 'alert',
          title: `${failed.length} failed sign-in attempt${failed.length > 1 ? 's' : ''}`, text: 'In the last 24 hours. Review the audit trail.',
          when: relTime(failed[0].ts), sort: new Date(failed[0].ts).getTime(),
          href: 'audit-trail.html?action=Failed%20Login'
        });
      }
    }
    return items.sort((a, b) => b.sort - a.sort);
  }

  function renderNotifications() {
    const list = $('#notifList');
    const count = $('#notifCount');
    if (!list) return;
    if (!DB.settings.notifications) {
      list.innerHTML = emptyState('Notifications are off', 'Turn them on in System settings.', 'fa-bell-slash');
      count.hidden = true;
      return;
    }
    const read = new Set(readNotifications());
    const items = buildNotifications();
    const unread = items.filter((n) => !read.has(n.id)).length;
    count.hidden = unread === 0;
    count.textContent = unread > 9 ? '9+' : String(unread);
    list.innerHTML = items.length ? items.map((n) => `
      <a class="notif-item ${read.has(n.id) ? '' : 'is-unread'}" href="${n.href}" data-notif="${esc(n.id)}">
        <span class="notif-item__icon tone-${n.tone}"><i class="fa-solid ${n.icon}" aria-hidden="true"></i></span>
        <span class="notif-item__body">
          <span class="notif-item__title">${esc(n.title)}</span>
          <span class="notif-item__text">${esc(n.text)}</span>
          <span class="notif-item__time">${esc(n.when)}</span>
        </span>
      </a>`).join('') : emptyState("You're all caught up", 'No new notifications right now.', 'fa-bell');

    list.onclick = (e) => {
      const item = e.target.closest('[data-notif]');
      if (!item) return;
      const set = new Set(readNotifications());
      set.add(item.dataset.notif);
      localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-300)));
    };
  }

  /* Global event wiring ------------------------------------------------- */
  function closeDropdown(d) {
    d.classList.remove('is-open');
    d.querySelector('[data-dropdown-toggle]')?.setAttribute('aria-expanded', 'false');
  }

  function initGlobalEvents() {
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-dropdown-toggle]');
      $$('.dropdown.is-open').forEach((d) => { if (!d.contains(e.target)) closeDropdown(d); });
      if (toggle) {
        const d = toggle.closest('.dropdown');
        const open = !d.classList.contains('is-open');
        d.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
      }

      const closer = e.target.closest('[data-close]');
      if (closer) Modal.close(closer.closest('.modal, .drawer'));

      const opener = e.target.closest('[data-open]');
      if (opener && !opener.disabled) Modal.open(opener.dataset.open);

      if (e.target.closest('[data-action="logout"]')) Session.end();
    });

    document.addEventListener('keydown', (e) => {
      const top = Modal.top();
      if (e.key === 'Escape') {
        if (top) { Modal.close(top); return; }
        const openDd = $('.dropdown.is-open');
        if (openDd) { closeDropdown(openDd); openDd.querySelector('[data-dropdown-toggle]')?.focus(); return; }
        const search = $('#globalSearch');
        if (search?.classList.contains('is-open')) { search._close(); return; }
        if ($('#sidebar')?.classList.contains('is-open')) toggleSidebar(false);
      }
      if (e.key === 'Tab' && top) {
        const list = focusables(top);
        if (!list.length) return;
        const first = list[0]; const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.key === '/' && !top && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        const input = $('#globalSearchInput');
        if (input) { e.preventDefault(); input.focus(); }
      }
    });

    const touch = debounce(() => Session.touch(), 1000);
    ['click', 'keydown'].forEach((evt) => document.addEventListener(evt, touch, { passive: true }));
    setInterval(() => { if (Session.isExpired()) { flash('Your session expired due to inactivity.', 'warning', 'Signed out'); Session.end('expired'); } }, 60000);

    document.addEventListener('db:change', debounce(() => {
      renderNotifications();
      const badgeEl = $('.nav-link__badge');
      const pending = DB.all('assistance').filter((a) => a.status === 'Pending').length;
      if (badgeEl) { badgeEl.textContent = pending; badgeEl.hidden = pending === 0; }
    }, 100));

    window.matchMedia('(min-width: 1024px)').addEventListener('change', (mq) => { if (mq.matches) toggleSidebar(false); });
  }

  /* ------------------------------------------------------------------------
     12. Chart helpers (used by dashboard-charts.js & reports-charts.js)
     ------------------------------------------------------------------------ */
  function chartTheme() {
    if (typeof window.Chart === 'undefined') return null;
    const C = window.Chart;
    const muted = cssVar('--text-muted');
    const border = cssVar('--border-light');
    C.defaults.font.family = cssVar('--font-main') || 'Inter, sans-serif';
    C.defaults.font.size = 12;
    C.defaults.color = muted;
    C.defaults.borderColor = border;
    C.defaults.animation.duration = 300;
    C.defaults.maintainAspectRatio = false;
    C.defaults.plugins.legend.labels.usePointStyle = true;
    C.defaults.plugins.legend.labels.boxWidth = 8;
    C.defaults.plugins.legend.labels.boxHeight = 8;
    C.defaults.plugins.legend.labels.padding = 16;
    Object.assign(C.defaults.plugins.tooltip, {
      backgroundColor: cssVar('--text-dark'), padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4,
      titleFont: { weight: '600' }
    });
    return {
      primary: cssVar('--primary-toxic-violet'),
      primarySoft: cssVar('--primary-soft-2'),
      approved: cssVar('--status-approved'),
      pending: cssVar('--status-pending'),
      alert: cssVar('--status-alert'),
      muted, border,
      palette: ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7'].map(cssVar)
    };
  }

  function chartFallback(canvas, message = 'Charts are unavailable offline. Connect to the internet to load Chart.js.') {
    const box = canvas?.parentElement;
    if (box) box.innerHTML = `<div class="chart-fallback"><span><i class="fa-solid fa-chart-simple" aria-hidden="true"></i><br>${esc(message)}</span></div>`;
  }

  const monthKeys = (count = 12) => {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
      return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleDateString('en-PH', { month: 'short' }), date: d };
    });
  };

  /* ------------------------------------------------------------------------
     13. Page modules
     ------------------------------------------------------------------------ */
  const Pages = {};

  /* Login ----------------------------------------------------------------- */
  Pages.login = async function () {
    const remote = await Auth.currentUser();
    const existing = Session.get();
    if (remote) {
      const samePerson = existing && existing.username === remote.username;
      if (samePerson && Session.isExpired()) {
        await Auth.logout();
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        Session._cache = null;
      } else {
        if (!samePerson) Session.start(remote, true);
        location.replace('html/dashboard.html');
        return;
      }
    } else if (existing) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      Session._cache = null;
    }

    if (params.has('signedout')) toast('You have been signed out securely.', 'info', 'Signed out');
    if (params.has('expired')) toast('Your session expired due to inactivity. Please sign in again.', 'warning', 'Session expired');
    if (params.has('signedout') || params.has('expired')) history.replaceState(null, '', location.pathname);

    const form = $('#loginForm');
    const pwd = $('#password');
    const toggle = $('#togglePassword');
    const loginAlert = $('#loginAlert');
    const lastUser = localStorage.getItem(LAST_USER_KEY);
    if (lastUser) form.elements.username.value = lastUser;

    const hideAlert = () => {
      if (!loginAlert) return;
      loginAlert.hidden = true;
      loginAlert.querySelector('span').textContent = '';
    };

    const showAlert = (message) => {
      if (!loginAlert) return;
      loginAlert.hidden = false;
      loginAlert.querySelector('span').textContent = message;
    };

    toggle.addEventListener('click', () => {
      const show = pwd.type === 'password';
      pwd.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      toggle.innerHTML = `<i class="fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>`;
    });

    $('#forgotLink').addEventListener('click', (e) => {
      e.preventDefault();
      toast('Please contact your barangay system administrator to reset your password.', 'info', 'Password reset');
    });

    form.addEventListener('input', hideAlert);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Form.data(form);
      Form.clearErrors(form);
      hideAlert();

      const result = await Auth.authenticate(data);
      if (!result.ok) {
        Object.entries(result.errors || {}).forEach(([name, msg]) => {
          if (name === 'form') { showAlert(msg); return; }
          const node = form.elements[name];
          const el = node instanceof RadioNodeList ? node[0] : node;
          if (el) Form.setError(el, msg);
        });
        if (result.errors?.form) {
          DB.log('Failed Login', 'Authentication', `Failed sign-in attempt for "${data.username || 'unknown'}"`, 'Warning', { user: data.username || 'unknown', role: '—', ip: '192.168.1.5' });
        }
        const first = form.querySelector('.is-invalid, [aria-invalid="true"]');
        if (first) first.focus();
        return;
      }

      Session.start(result.user, data.remember);
      localStorage.setItem(LAST_USER_KEY, result.user.username);
      DB.log('Login', 'Authentication', `${result.user.name} signed in as ${result.user.role}`);
      flash(`Signed in as ${result.user.role}.`, 'success', `Welcome, ${result.user.name.split(' ')[0]}!`);
      location.href = 'html/dashboard.html';
    });
  };

  /* Dashboard ------------------------------------------------------------- */
  Pages.dashboard = function () {
    const session = Session.get();
    const now = new Date();
    const hour = now.getHours();
    $('#greeting').textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, ${session.name.split(' ')[0]}`;
    $('#todayDate').textContent = now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const seniors = DB.all('seniors');
    const active = seniors.filter((s) => s.status === 'Active');
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = seniors.filter((s) => new Date(s.registeredAt) >= monthStart).length;
    const pensioners = active.filter((s) => s.pension !== 'None').length;
    const pending = DB.all('assistance').filter((a) => a.status === 'Pending');
    const upcoming = sortBy(DB.all('programs').filter((p) => programStatus(p) === 'Upcoming'), 'date', 'asc');

    $('#statTotal').textContent = fmtNumber(active.length);
    $('#statTotalMeta').innerHTML = `<span class="stat-card__trend is-up"><i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i>+${newThisMonth}</span> registered this month`;
    $('#statPension').textContent = fmtNumber(pensioners);
    $('#statPensionMeta').innerHTML = `<strong>${active.length ? Math.round((pensioners / active.length) * 100) : 0}%</strong> of active seniors covered`;
    $('#statPending').textContent = fmtNumber(pending.length);
    $('#statPendingMeta').innerHTML = `<strong>${fmtMoney(pending.reduce((sum, a) => sum + a.amount, 0))}</strong> awaiting approval`;
    $('#statPrograms').textContent = fmtNumber(upcoming.length);
    $('#statProgramsMeta').innerHTML = upcoming.length ? `Next on <strong>${fmtDate(upcoming[0].date, { month: 'short', day: 'numeric' })}</strong>` : 'No scheduled events';

    const events = $('#upcomingEvents');
    events.innerHTML = upcoming.length ? upcoming.slice(0, 4).map((p) => {
      const d = parseDate(p.date);
      return `
        <li>
          <a class="event-item" href="program-management.html?open=${encodeURIComponent(p.id)}">
            <span class="event-item__date"><small>${d.toLocaleDateString('en-PH', { month: 'short' })}</small><strong>${d.getDate()}</strong></span>
            <span class="event-item__body">
              <strong>${esc(p.title)}</strong>
              <small><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(fmtTime(p.time))} · ${esc(p.venue)}</small>
            </span>
            ${badge(p.type, 'violet', 'style="margin-left:auto"')}
          </a>
        </li>`;
    }).join('') : `<li>${emptyState('No upcoming programs', 'Schedule one from Programs & Events.', 'fa-calendar')}</li>`;

    const ACTION_ICON = { Create: 'fa-plus', Update: 'fa-pen', Delete: 'fa-trash', Login: 'fa-right-to-bracket', Logout: 'fa-right-from-bracket', Approve: 'fa-check', Release: 'fa-hand-holding-dollar', Deny: 'fa-ban', Export: 'fa-file-export', Backup: 'fa-database', Restore: 'fa-rotate-left', 'Failed Login': 'fa-shield-halved' };
    const activity = DB.all('logs').filter((l) => l.action !== 'Failed Login').slice(0, 6);
    $('#recentActivity').innerHTML = activity.map((l) => `
      <li class="activity-item">
        <span class="activity-item__icon tone-${STATUS_TONE[l.severity] || 'info'}"><i class="fa-solid ${ACTION_ICON[l.action] || 'fa-circle'}" aria-hidden="true"></i></span>
        <span class="activity-item__body">
          <span>${esc(l.details)}</span>
          <small>${esc(l.user)} · ${esc(relTime(l.ts))}</small>
        </span>
      </li>`).join('') || `<li>${emptyState('No activity yet', 'Actions will appear here.', 'fa-clock-rotate-left')}</li>`;
  };

  /* Senior registry ------------------------------------------------------- */
  Pages.registry = function () {
    const state = { q: '', purok: '', sex: '', age: '', pension: '', status: '', sort: 'registeredAt', dir: 'desc', page: 1, perPage: 10 };
    const table = $('#registryTable');
    const tbody = $('#registryBody');
    const form = $('#seniorForm');
    const modal = $('#seniorModal');
    const dupAlert = $('#duplicateAlert');
    const selected = new Set();
    let editingId = null;
    let firstPaint = true;
    let pageIds = [];
    let cameraStream = null;

    function stopRegCamera() {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
      }
      const video = $('#regCamVideo');
      if (video) { video.srcObject = null; video.hidden = true; }
    }

    function syncPhotoButtons(state) {
      $('#regCamStart').hidden = state === 'live' || state === 'captured';
      $('#regCamSnap').hidden = state !== 'live';
      $('#regCamRetake').hidden = state !== 'captured';
      $('#regPhotoClear').hidden = state !== 'captured';
    }

    function setPhoto(dataUrl) {
      $('#regPhoto').value = dataUrl || '';
      const img = $('#regPhotoPreview');
      const stage = $('#regCamStage');
      if (dataUrl) {
        img.src = dataUrl;
        img.hidden = false;
        stage.dataset.state = 'captured';
      } else {
        img.removeAttribute('src');
        img.hidden = true;
        stage.dataset.state = 'idle';
      }
      syncPhotoButtons(stage.dataset.state);
    }

    function setIdCard(dataUrl) {
      $('#regIdCard').value = dataUrl || '';
      const img = $('#regIdPreview');
      const frame = $('.id-import__frame');
      if (dataUrl) {
        img.src = dataUrl;
        img.hidden = false;
        frame.dataset.empty = 'false';
        $('#regIdClear').hidden = false;
      } else {
        img.removeAttribute('src');
        img.hidden = true;
        frame.dataset.empty = 'true';
        $('#regIdClear').hidden = true;
      }
    }

    async function startRegCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast('This browser cannot use a webcam. Upload a photo instead.', 'warning', 'Camera');
        return;
      }
      try {
        stopRegCamera();
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false
        });
        const video = $('#regCamVideo');
        video.srcObject = cameraStream;
        video.hidden = false;
        await video.play();
        $('#regCamStage').dataset.state = 'live';
        $('#regPhotoPreview').hidden = true;
        syncPhotoButtons('live');
      } catch (err) {
        console.warn(err);
        toast('Camera access was blocked or unavailable. Upload a photo instead.', 'error', 'Camera');
      }
    }

    $('#regCamStart').addEventListener('click', startRegCamera);
    $('#regCamSnap').addEventListener('click', () => {
      const data = cropToCanvas($('#regCamVideo'), { aspect: PHOTO_ASPECT, maxW: 240, maxH: 320, quality: 0.68, mirror: true });
      if (!data) { toast('Wait for the camera preview, then capture again.', 'warning'); return; }
      stopRegCamera();
      setPhoto(data);
    });
    $('#regCamRetake').addEventListener('click', startRegCamera);
    $('#regPhotoClear').addEventListener('click', () => { stopRegCamera(); setPhoto(''); });
    $('#regPhotoFile').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        stopRegCamera();
        setPhoto(await compressFile(file, { aspect: PHOTO_ASPECT, maxW: 240, maxH: 320, quality: 0.68 }));
      } catch (_) {
        toast('That photo could not be read. Try another image.', 'error');
      }
    });

    async function importIdFile(file) {
      if (!file || !String(file.type || '').startsWith('image/')) {
        toast('Please choose an image of the CR80 ID card.', 'warning');
        return;
      }
      try {
        setIdCard(await compressFile(file, { aspect: ID_CARD_ASPECT, maxW: 512, maxH: 324, quality: 0.72 }));
        toast('ID card imported at CR80 size (85.6 × 53.98 mm).', 'success', 'ID imported');
      } catch (_) {
        toast('That ID image could not be read. Try another file.', 'error');
      }
    }

    $('#regIdFile').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      importIdFile(file);
    });
    $('#regIdClear').addEventListener('click', () => setIdCard(''));

    const idDrop = $('#regIdDrop');
    ['dragenter', 'dragover'].forEach((evt) => idDrop.addEventListener(evt, (e) => { e.preventDefault(); idDrop.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach((evt) => idDrop.addEventListener(evt, (e) => { e.preventDefault(); idDrop.classList.remove('is-dragover'); }));
    idDrop.addEventListener('drop', (e) => importIdFile(e.dataTransfer.files && e.dataTransfer.files[0]));
    idDrop.addEventListener('click', () => $('#regIdFile').click());
    idDrop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#regIdFile').click(); }
    });
    modal.addEventListener('modal:close', stopRegCamera);

    $('#conditionsGrid').innerHTML = CONDITIONS.map((c) => `
      <label class="check-pill"><input type="checkbox" name="conditions" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('');

    const maxBirth = new Date(); maxBirth.setFullYear(maxBirth.getFullYear() - 60);
    form.elements.birthdate.max = toISODate(maxBirth);

    const getters = {
      name: (s) => `${s.lastName} ${s.firstName}`.toLowerCase(),
      age: (s) => ageOf(s.birthdate),
      purok: (s) => s.purok,
      registeredAt: (s) => s.registeredAt
    };

    function filtered() {
      const q = state.q.toLowerCase();
      return DB.all('seniors').filter((s) => {
        if (q && !`${s.firstName} ${s.middleName} ${s.lastName} ${s.oscaId} ${s.address} ${s.contact}`.toLowerCase().includes(q)) return false;
        if (state.purok && s.purok !== state.purok) return false;
        if (state.sex && s.sex !== state.sex) return false;
        if (state.age && ageBracket(ageOf(s.birthdate)) !== state.age) return false;
        if (state.pension && s.pension !== state.pension) return false;
        if (state.status && s.status !== state.status) return false;
        return true;
      });
    }

    function renderStats() {
      const all = DB.all('seniors');
      const active = all.filter((s) => s.status === 'Active');
      $('#regTotal').textContent = fmtNumber(all.length);
      $('#regActive').textContent = fmtNumber(active.length);
      $('#regPwd').textContent = fmtNumber(active.filter((s) => s.pwd).length);
      $('#regIndigent').textContent = fmtNumber(active.filter((s) => s.indigent).length);
    }

    function eligibilityTags(s) {
      const parts = [];
      if (s.pwd) parts.push('<span class="tag tag--pwd">PWD</span>');
      if (s.indigent) parts.push('<span class="tag tag--indigent">Indigent</span>');
      if (s.pensionDistributedAt) parts.push(badge('Distributed', 'distributed', 'data-plain'));
      if (!parts.length) parts.push('<span class="muted">—</span>');
      return `<div class="tag-list">${parts.join('')}</div>`;
    }

    function selectedSeniors() {
      return DB.all('seniors').filter((s) => selected.has(s.id));
    }

    function syncBulk() {
      const bar = $('#bulkBar');
      const n = selected.size;
      if (bar) {
        bar.hidden = n === 0;
        bar.classList.toggle('is-visible', n > 0);
      }
      if ($('#bulkCount')) $('#bulkCount').innerHTML = n ? `${n} selected` : '0 selected';
      const allBox = $('#registrySelectAll');
      if (allBox) {
        const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
        const some = pageIds.some((id) => selected.has(id));
        allBox.checked = allOnPage;
        allBox.indeterminate = some && !allOnPage;
      }
    }

    function render() {
      if (firstPaint) {
        firstPaint = false;
        tbody.innerHTML = skeletonRows(9, 6);
        setTimeout(render, 220);
        return;
      }
      const list = sortBy(filtered(), state.sort, state.dir, getters);
      state.page = renderPagination($('#registryPagination'), { total: list.length, page: state.page, perPage: state.perPage, onChange: (p) => { state.page = p; render(); } });
      $('#registryCount').textContent = `${fmtNumber(list.length)} record${list.length === 1 ? '' : 's'}`;
      syncSortHeaders(table, state.sort, state.dir);
      const canWrite = can('senior.write');
      const canDelete = can('senior.delete');
      const rows = paginate(list, state.page, state.perPage);
      pageIds = rows.map((s) => s.id);

      tbody.innerHTML = rows.map((s) => `
        <tr class="${selected.has(s.id) ? 'is-selected' : ''}">
          <td class="table__select">
            <label class="table-check">
              <span class="sr-only">Select ${esc(displayName(s))}</span>
              <input type="checkbox" data-select value="${esc(s.id)}" ${selected.has(s.id) ? 'checked' : ''}>
            </label>
          </td>
          <td>
            <div class="cell-person">
              ${avatar(`${s.firstName} ${s.lastName}`, '', s.photo)}
              <div class="cell-person__text"><strong>${esc(fullName(s))}</strong><small>${esc(s.oscaId)}</small></div>
            </div>
          </td>
          <td class="nowrap">${ageOf(s.birthdate)} yrs<br><small class="muted">${esc(s.sex)}</small></td>
          <td class="nowrap">${esc(s.purok)}</td>
          <td>${s.pension === 'None' ? '<span class="muted">None</span>' : badge(s.pension, 'violet', 'data-plain')}</td>
          <td>${eligibilityTags(s)}</td>
          <td>${badge(s.status)}</td>
          <td class="nowrap">${fmtDate(s.registeredAt)}</td>
          <td class="actions table__actions">
            <button type="button" class="icon-btn icon-btn--sm" data-action="view" data-id="${esc(s.id)}" aria-label="View profile of ${esc(displayName(s))}" data-tooltip="View profile"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
            <button type="button" class="icon-btn icon-btn--sm" data-action="edit" data-id="${esc(s.id)}" aria-label="Edit ${esc(displayName(s))}" data-tooltip="Edit record" ${canWrite ? '' : 'disabled'}><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i></button>
            <button type="button" class="icon-btn icon-btn--sm" data-action="id" data-id="${esc(s.id)}" aria-label="Print ID for ${esc(displayName(s))}" data-tooltip="Print Senior Citizen ID"><i class="fa-solid fa-id-card" aria-hidden="true"></i></button>
            <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-action="delete" data-id="${esc(s.id)}" aria-label="Delete ${esc(displayName(s))}" data-tooltip="${canDelete ? 'Delete record' : 'Administrator only'}" ${canDelete ? '' : 'disabled'}><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
          </td>
        </tr>`).join('') || emptyRow(9, 'No seniors found', 'Try adjusting your filters or search term.', 'fa-user-slash');
      renderStats();
      syncBulk();
      applyPermissions(tbody);
    }

    /* Filters */
    const filterForm = $('#registryFilters');
    filterForm.addEventListener('input', debounce((e) => {
      if (!e.target.name) return;
      state[e.target.name] = e.target.value;
      state.page = 1;
      render();
    }, 180));
    filterForm.addEventListener('submit', (e) => e.preventDefault());
    $('#registryReset').addEventListener('click', () => {
      filterForm.reset();
      Object.assign(state, { q: '', purok: '', sex: '', age: '', pension: '', status: '', page: 1 });
      render();
    });

    table.querySelector('thead').addEventListener('click', (e) => {
      const btn = e.target.closest('.th-sort');
      if (!btn) return;
      const key = btn.dataset.sort;
      state.dir = state.sort === key && state.dir === 'asc' ? 'desc' : 'asc';
      state.sort = key;
      render();
    });

    tbody.addEventListener('change', (e) => {
      const input = e.target.closest('input[data-select]');
      if (!input) return;
      if (input.checked) selected.add(input.value);
      else selected.delete(input.value);
      e.target.closest('tr')?.classList.toggle('is-selected', input.checked);
      syncBulk();
    });

    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const s = DB.find('seniors', btn.dataset.id);
      if (!s) return;
      if (btn.dataset.action === 'view') openProfile(s.id);
      if (btn.dataset.action === 'edit') openForm(s);
      if (btn.dataset.action === 'id') printIdCards([s]);
      if (btn.dataset.action === 'delete') {
        const ok = await confirmDialog({
          title: 'Delete senior record?',
          message: `${displayName(s)} (${s.oscaId}) will be permanently removed. Assistance history will be kept for audit purposes.`,
          confirmText: 'Delete record', icon: 'fa-trash-can'
        });
        if (!ok) return;
        DB.remove('seniors', s.id, { details: `Deleted senior record ${displayName(s)} (${s.oscaId})` });
        selected.delete(s.id);
        toast(`${displayName(s)} was removed from the registry.`, 'success', 'Record deleted');
        render();
      }
    });

    /* Duplicate detection */
    const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    function findDuplicates() {
      const fn = norm(form.elements.firstName.value);
      const ln = norm(form.elements.lastName.value);
      const bd = form.elements.birthdate.value;
      if (!fn || !ln) return { exact: [], similar: [] };
      const matches = DB.all('seniors').filter((s) => s.id !== editingId && norm(s.firstName) === fn && norm(s.lastName) === ln);
      return { exact: matches.filter((s) => bd && s.birthdate === bd), similar: matches.filter((s) => !bd || s.birthdate !== bd) };
    }

    function renderDuplicateAlert() {
      const { exact, similar } = findDuplicates();
      const matches = [...exact, ...similar];
      dupAlert.hidden = !matches.length;
      if (!matches.length) { $('#duplicateAck').checked = false; return; }
      dupAlert.classList.toggle('duplicate-alert--exact', exact.length > 0);
      $('#duplicateTitle').textContent = exact.length ? 'Possible duplicate record detected' : 'A senior with the same name already exists';
      $('#duplicateText').textContent = exact.length
        ? 'A record with the same full name and birthdate is already registered. Please verify before saving.'
        : 'The birthdate differs, but please confirm this is a different person.';
      $('#duplicateList').innerHTML = matches.map((s) => `
        <li><strong>${esc(fullName(s))}</strong> · ${esc(s.oscaId)} · Born ${fmtDate(s.birthdate)} · ${esc(s.purok)} ${badge(s.status)}</li>`).join('');
    }

    ['firstName', 'lastName', 'birthdate'].forEach((name) => {
      form.elements[name].addEventListener('input', debounce(renderDuplicateAlert, 200));
    });

    const updateAge = () => {
      const v = form.elements.birthdate.value;
      $('#ageDisplay').value = v ? `${ageOf(v)} years old` : '';
    };
    form.elements.birthdate.addEventListener('input', updateAge);

    function openForm(senior) {
      editingId = senior ? senior.id : null;
      Form.reset(form);
      dupAlert.hidden = true;
      $('#duplicateAck').checked = false;
      $('#seniorModalTitle').textContent = senior ? 'Edit senior profile' : 'Register senior citizen';
      $('#seniorModalSubtitle').textContent = senior ? `${senior.oscaId} · Last updated ${fmtDate(senior.updatedAt)}` : 'All fields marked * are required.';
      $('#seniorSubmit').innerHTML = senior ? '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save changes' : '<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Register senior';
      $('#statusField').hidden = !senior;
      if (senior) Form.fill(form, senior);
      else Form.fill(form, { oscaId: nextOscaId(), status: 'Active', pension: 'None', civilStatus: 'Married' });
      stopRegCamera();
      setPhoto(senior && senior.photo ? senior.photo : '');
      setIdCard(senior && senior.idCardImage ? senior.idCardImage : '');
      updateAge();
      if (senior) renderDuplicateAlert();
      Modal.open(modal);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const valid = Form.validate(form, (d) => {
        const errors = {};
        if (d.birthdate && ageOf(d.birthdate) < 60) errors.birthdate = 'Senior citizens must be at least 60 years old.';
        const oscaTaken = DB.all('seniors').some((s) => s.id !== editingId && s.oscaId.toLowerCase() === d.oscaId.toLowerCase());
        if (oscaTaken) errors.oscaId = 'This OSCA ID is already assigned to another senior.';
        return errors;
      });
      if (!valid) return;

      renderDuplicateAlert();
      if (!dupAlert.hidden && !$('#duplicateAck').checked) {
        dupAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        $('#duplicateAck').focus();
        toast('Please review the possible duplicate and confirm before saving.', 'warning', 'Duplicate check');
        return;
      }

      const data = Form.data(form);
      delete data.ageDisplay;
      delete data.duplicateAck;
      if (editingId) {
        const updated = DB.update('seniors', editingId, data, { details: `Updated profile of ${data.firstName} ${data.lastName} (${data.oscaId})` });
        toast(`${displayName(updated)}'s profile was updated.`, 'success', 'Changes saved');
      } else {
        const created = DB.add('seniors', { ...data, id: uid('SC'), status: 'Active', registeredAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { details: `Registered ${data.firstName} ${data.lastName} (${data.oscaId})${!dupAlert.hidden ? ' after duplicate review' : ''}` });
        toast(`${displayName(created)} is now in the registry.`, 'success', 'Senior registered');
        state.sort = 'registeredAt'; state.dir = 'desc'; state.page = 1;
      }
      Modal.close(modal);
      render();
      if ($('#profileDrawer').classList.contains('is-open') && editingId) openProfile(editingId);
    });

    $('#addSeniorBtn').addEventListener('click', () => openForm(null));

    /* Profile drawer */
    function openProfile(id) {
      const s = DB.find('seniors', id);
      if (!s) { toast('That senior record could not be found.', 'error'); return; }
      const requests = sortBy(DB.all('assistance').filter((a) => a.seniorId === id), 'requestedAt', 'desc');
      const released = requests.filter((a) => a.status === 'Released').reduce((sum, a) => sum + a.amount, 0);
      const programs = sortBy(DB.all('programs').filter((p) => p.beneficiaries.includes(id)), 'date', 'desc');

      $('#profileBody').innerHTML = `
        <div class="profile-head">
          ${avatar(`${s.firstName} ${s.lastName}`, 'avatar--lg', s.photo)}
          <div class="profile-head__text">
            <h3>${esc(`${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`)}</h3>
            <p class="muted">${esc(s.oscaId)} · Registered ${fmtDate(s.registeredAt)}</p>
            <div class="tag-list mt-2">${badge(s.status)}${s.pwd ? '<span class="tag tag--pwd">PWD</span>' : ''}${s.indigent ? '<span class="tag tag--indigent">Indigent</span>' : ''}</div>
          </div>
        </div>

        ${renderIdCard(s).replace('class="id-card', 'class="id-card id-card--preview')}

        <div class="profile-kpis">
          <div><span>Age</span><strong>${ageOf(s.birthdate)}</strong></div>
          <div><span>Requests</span><strong>${requests.length}</strong></div>
          <div><span>Aid received</span><strong>${fmtMoney(released)}</strong></div>
        </div>

        <section class="profile-section">
          <h4 class="profile-section__title">Personal information</h4>
          <dl class="detail-list">
            <div><dt>Sex</dt><dd>${esc(s.sex)}</dd></div>
            <div><dt>Birthdate</dt><dd>${fmtDate(s.birthdate)}</dd></div>
            <div><dt>Civil status</dt><dd>${esc(s.civilStatus)}</dd></div>
            <div><dt>Contact</dt><dd>${esc(s.contact || '—')}</dd></div>
            <div><dt>Purok</dt><dd>${esc(s.purok)}</dd></div>
            <div><dt>Pension</dt><dd>${esc(s.pension)}</dd></div>
            <div class="full"><dt>Address</dt><dd>${esc(s.address || '—')}</dd></div>
          </dl>
        </section>

        <section class="profile-section">
          <h4 class="profile-section__title">Health conditions</h4>
          <div class="tag-list">${(s.conditions || []).map((c) => `<span class="tag">${esc(c)}</span>`).join('') || '<span class="muted">No recorded conditions</span>'}</div>
        </section>

        <section class="profile-section">
          <h4 class="profile-section__title">Assistance history</h4>
          ${requests.length ? `
            <ul class="history-mini">
              ${requests.slice(0, 6).map((a) => `
                <li>
                  <span class="history-mini__icon"><i class="fa-solid ${AID_ICONS[a.type]}" aria-hidden="true"></i></span>
                  <span class="history-mini__body"><strong>${esc(a.type)} · ${fmtMoney(a.amount)}</strong><small>${esc(a.id)} · ${fmtDate(a.requestedAt)}</small></span>
                  ${badge(a.status)}
                </li>`).join('')}
            </ul>
            ${requests.length > 6 ? `<a class="link small mt-2" style="display:inline-block" href="assistance-management.html?senior=${encodeURIComponent(s.id)}">View all ${requests.length} requests</a>` : ''}`
            : '<p class="muted">No assistance requests yet.</p>'}
        </section>

        <section class="profile-section">
          <h4 class="profile-section__title">Programs</h4>
          ${programs.length ? `<div class="tag-list">${programs.map((p) => `<span class="tag"><i class="fa-solid ${PROGRAM_ICONS[p.type]}" aria-hidden="true"></i>${esc(p.title)}</span>`).join('')}</div>` : '<p class="muted">Not enrolled in any program.</p>'}
        </section>`;

      $('#profileEdit').onclick = () => { if (can('senior.write')) openForm(s); };
      $('#profileEdit').disabled = !can('senior.write');
      $('#profilePrintId').onclick = () => printIdCards([s]);
      $('#profileRequest').href = `assistance-management.html?action=new&senior=${encodeURIComponent(s.id)}`;
      Modal.open('profileDrawer');
    }

    $('#exportRegistry').addEventListener('click', () => {
      const list = sortBy(filtered(), state.sort, state.dir, getters);
      downloadCSV(`senior-registry-${fileStamp()}.csv`, [
        ['OSCA ID', 'Last Name', 'First Name', 'Middle Name', 'Sex', 'Birthdate', 'Age', 'Civil Status', 'Purok', 'Address', 'Contact', 'Pension', 'PWD', 'Indigent', 'Conditions', 'Status', 'Registered'],
        ...list.map((s) => [s.oscaId, s.lastName, s.firstName, s.middleName, s.sex, s.birthdate, ageOf(s.birthdate), s.civilStatus, s.purok, s.address, s.contact, s.pension, s.pwd ? 'Yes' : 'No', s.indigent ? 'Yes' : 'No', (s.conditions || []).join('; '), s.status, fmtDate(s.registeredAt)])
      ]);
      DB.log('Export', 'Senior Registry', `Exported ${list.length} senior records (CSV)`);
      toast(`${list.length} records exported to CSV.`, 'success', 'Export ready');
    });

    $('#registrySelectAll')?.addEventListener('change', (e) => {
      if (e.target.checked) pageIds.forEach((id) => selected.add(id));
      else pageIds.forEach((id) => selected.delete(id));
      render();
    });

    $('#bulkBar')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-bulk]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.bulk;
      if (action === 'clear') { selected.clear(); render(); return; }
      const rows = selectedSeniors();
      if (!rows.length) { toast('Select at least one record first.', 'warning'); return; }
      if (action === 'print') {
        printIdCards(rows);
        DB.log('Export', 'Senior Registry', `Printed ${rows.length} Senior Citizen ID${rows.length === 1 ? '' : 's'}`);
        return;
      }
      if (action === 'export') {
        downloadCSV(`senior-selected-${fileStamp()}.csv`, [
          ['OSCA ID', 'Last Name', 'First Name', 'Sex', 'Purok', 'Pension', 'Status'],
          ...rows.map((s) => [s.oscaId, s.lastName, s.firstName, s.sex, s.purok, s.pension, s.status])
        ]);
        DB.log('Export', 'Senior Registry', `Exported ${rows.length} selected senior records (CSV)`);
        toast(`${rows.length} selected records exported.`, 'success', 'Export ready');
        return;
      }
      if (action === 'pension') {
        const eligible = rows.filter((s) => s.pension && s.pension !== 'None');
        if (!eligible.length) {
          toast('None of the selected seniors have a recorded pension.', 'warning', 'No pensioners');
          return;
        }
        const ok = await confirmDialog({
          title: 'Mark pension as distributed?',
          message: `${eligible.length} selected pensioner${eligible.length === 1 ? '' : 's'} will be tagged as Distributed for this payout cycle.`,
          confirmText: 'Mark distributed', icon: 'fa-peso-sign'
        });
        if (!ok) return;
        const at = new Date().toISOString();
        eligible.forEach((s) => DB.update('seniors', s.id, { pensionDistributedAt: at }, { details: `Marked pension distributed for ${displayName(s)} (${s.oscaId})` }));
        toast(`Pension marked distributed for ${eligible.length} senior${eligible.length === 1 ? '' : 's'}.`, 'success', 'Pension payout');
        render();
      }
    });

    render();
    if (params.get('view')) openProfile(params.get('view'));
    if (params.get('action') === 'new' && can('senior.write')) openForm(null);
  };

  /* Program management ---------------------------------------------------- */
  Pages.programs = function () {
    const state = { type: '', status: '', q: '' };
    const grid = $('#programGrid');
    const form = $('#programForm');
    const modal = $('#programModal');
    let editingId = null;
    let benProgramId = null;
    let benSet = new Set();

    const seniorsById = () => new Map(DB.all('seniors').map((s) => [s.id, s]));

    function filtered() {
      const q = state.q.toLowerCase();
      return DB.all('programs').filter((p) => {
        if (state.type && p.type !== state.type) return false;
        if (state.status && programStatus(p) !== state.status) return false;
        if (q && !`${p.title} ${p.venue} ${p.description}`.toLowerCase().includes(q)) return false;
        return true;
      }).sort((a, b) => {
        const order = { Upcoming: 0, Completed: 1, Cancelled: 2 };
        const sa = programStatus(a); const sb = programStatus(b);
        if (sa !== sb) return order[sa] - order[sb];
        return sa === 'Upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      });
    }

    function renderStats() {
      const all = DB.all('programs');
      const reached = new Set(all.filter((p) => !p.cancelled).flatMap((p) => p.beneficiaries));
      const year = new Date().getFullYear();
      $('#pgTotal').textContent = all.length;
      $('#pgUpcoming').textContent = all.filter((p) => programStatus(p) === 'Upcoming').length;
      $('#pgReached').textContent = reached.size;
      $('#pgCompleted').textContent = all.filter((p) => programStatus(p) === 'Completed' && parseDate(p.date).getFullYear() === year).length;

      const counts = { '': all.length };
      PROGRAM_TYPES.forEach((t) => { counts[t] = all.filter((p) => p.type === t).length; });
      $$('#programTypeChips [data-type]').forEach((chip) => {
        chip.querySelector('.chip__count').textContent = counts[chip.dataset.type] ?? 0;
        chip.classList.toggle('is-active', chip.dataset.type === state.type);
        chip.setAttribute('aria-pressed', String(chip.dataset.type === state.type));
      });
    }

    function renderGrid() {
      const map = seniorsById();
      const canWrite = can('program.write');
      const list = filtered();
      grid.innerHTML = list.map((p) => {
        const status = programStatus(p);
        const count = p.beneficiaries.length;
        const pct = p.capacity ? Math.min(100, Math.round((count / p.capacity) * 100)) : 0;
        const names = p.beneficiaries.slice(0, 3).map((id) => map.get(id)).filter(Boolean);
        return `
          <article class="card card--hover program-card program-card--${p.type.toLowerCase()} ${status === 'Cancelled' ? 'is-cancelled' : ''}" id="program-${esc(p.id)}">
            <div class="program-card__top">
              <span class="program-card__icon"><i class="fa-solid ${PROGRAM_ICONS[p.type]}" aria-hidden="true"></i></span>
              <div class="program-card__badges">${badge(p.type, 'neutral', 'data-plain')}${badge(status)}</div>
            </div>
            <h3 class="program-card__title">${esc(p.title)}</h3>
            <p class="program-card__desc">${esc(p.description)}</p>
            <ul class="program-card__meta">
              <li><i class="fa-regular fa-calendar" aria-hidden="true"></i>${fmtDate(p.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${esc(fmtTime(p.time))}</li>
              <li><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${esc(p.venue)}</li>
            </ul>
            <div class="program-card__capacity">
              <div class="row row--between small"><span class="muted">Beneficiaries</span><strong>${count} / ${p.capacity}</strong></div>
              <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${p.capacity}" aria-valuenow="${count}" aria-label="Capacity used"><div class="meter__fill ${pct >= 100 ? 'is-full' : ''}" style="width:${pct}%"></div></div>
            </div>
            <div class="beneficiary-tags">
              ${names.map((s) => `<span class="beneficiary-tag">${avatar(displayName(s), 'avatar--xs', s.photo)}${esc(s.firstName)} ${esc(s.lastName.charAt(0))}.</span>`).join('')}
              ${count > 3 ? `<span class="beneficiary-tag beneficiary-tag--more">+${count - 3} more</span>` : ''}
              ${!count ? '<span class="muted small">No beneficiaries yet</span>' : ''}
            </div>
            <footer class="program-card__footer">
              <button type="button" class="btn btn--soft btn--sm" data-action="beneficiaries" data-id="${esc(p.id)}" ${canWrite && status !== 'Cancelled' ? '' : 'disabled'}><i class="fa-solid fa-user-group" aria-hidden="true"></i>Beneficiaries</button>
              <div class="btn-group">
                <button type="button" class="icon-btn icon-btn--sm" data-action="edit" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.title)}" title="Edit" ${canWrite ? '' : 'disabled'}><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i></button>
                <button type="button" class="icon-btn icon-btn--sm" data-action="toggle-cancel" data-id="${esc(p.id)}" aria-label="${p.cancelled ? 'Reinstate' : 'Cancel'} ${esc(p.title)}" title="${p.cancelled ? 'Reinstate' : 'Cancel event'}" ${canWrite ? '' : 'disabled'}><i class="fa-solid ${p.cancelled ? 'fa-rotate-left' : 'fa-ban'}" aria-hidden="true"></i></button>
                <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-action="delete" data-id="${esc(p.id)}" aria-label="Delete ${esc(p.title)}" title="${can('program.delete') ? 'Delete' : 'Administrator only'}" ${can('program.delete') ? '' : 'disabled'}><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
              </div>
            </footer>
          </article>`;
      }).join('') || `<div class="card program-grid__empty">${emptyState('No programs match', 'Try a different filter or create a new program.', 'fa-calendar-xmark')}</div>`;
      $('#programCount').textContent = `${list.length} program${list.length === 1 ? '' : 's'}`;
    }

    function renderTimeline() {
      const all = DB.all('programs');
      const upcoming = sortBy(all.filter((p) => programStatus(p) === 'Upcoming'), 'date', 'asc');
      const recent = sortBy(all.filter((p) => programStatus(p) === 'Completed'), 'date', 'desc').slice(0, 3);
      const today = startOfDay();
      const item = (p, done) => {
        const days = daysBetween(today, parseDate(p.date));
        const when = done
          ? (days === -1 ? 'Yesterday' : `${-days} days ago`)
          : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
        return `
          <li class="timeline__item timeline__item--${p.type.toLowerCase()} ${done ? 'is-done' : ''}">
            <span class="timeline__dot" aria-hidden="true"></span>
            <div class="timeline__date">${fmtDate(p.date, { month: 'short', day: 'numeric' })} · ${esc(fmtTime(p.time))} <span class="timeline__when">${esc(when)}</span></div>
            <a class="timeline__title" href="#program-${esc(p.id)}" data-focus="${esc(p.id)}">${esc(p.title)}</a>
            <div class="timeline__meta"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc(p.venue)} · ${p.beneficiaries.length} enrolled</div>
          </li>`;
      };
      $('#programTimeline').innerHTML = `
        ${upcoming.length ? `<ol class="timeline">${upcoming.map((p) => item(p, false)).join('')}</ol>` : emptyState('Nothing scheduled', 'Upcoming events will appear here.', 'fa-calendar')}
        ${recent.length ? `<p class="timeline__group">Recently completed</p><ol class="timeline">${recent.map((p) => item(p, true)).join('')}</ol>` : ''}`;
    }

    const renderAll = () => { renderStats(); renderGrid(); renderTimeline(); };

    function focusProgram(id) {
      state.type = ''; state.status = ''; state.q = '';
      $('#programSearch').value = ''; $('#programStatus').value = '';
      renderAll();
      const card = document.getElementById(`program-${id}`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('is-highlighted');
      setTimeout(() => card.classList.remove('is-highlighted'), 1600);
    }

    $('#programTypeChips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-type]');
      if (!chip) return;
      state.type = chip.dataset.type;
      renderStats(); renderGrid();
    });
    $('#programStatus').addEventListener('change', (e) => { state.status = e.target.value; renderGrid(); });
    $('#programSearch').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); renderGrid(); }, 180));
    $('#programTimeline').addEventListener('click', (e) => {
      const link = e.target.closest('[data-focus]');
      if (!link) return;
      e.preventDefault();
      focusProgram(link.dataset.focus);
    });

    /* Program form */
    function openForm(p) {
      editingId = p ? p.id : null;
      Form.reset(form);
      $('#programModalTitle').textContent = p ? 'Edit program' : 'New program or event';
      $('#programSubmit').innerHTML = p ? '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save changes' : '<i class="fa-solid fa-calendar-plus" aria-hidden="true"></i> Create program';
      if (p) Form.fill(form, p);
      else Form.fill(form, { type: 'Health', time: '08:00', capacity: 50, date: toISODate(new Date(Date.now() + 7 * 86400000)) });
      Modal.open(modal);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const existing = editingId ? DB.find('programs', editingId) : null;
      const valid = Form.validate(form, (d) => (existing && d.capacity < existing.beneficiaries.length
        ? { capacity: `Capacity cannot be lower than the ${existing.beneficiaries.length} enrolled beneficiaries.` } : {}));
      if (!valid) return;
      const data = Form.data(form);
      if (existing) {
        DB.update('programs', editingId, data, { details: `Updated program “${data.title}”` });
        toast(`“${data.title}” was updated.`, 'success', 'Program saved');
      } else {
        DB.add('programs', { ...data, id: nextProgramId(), beneficiaries: [], cancelled: false, createdAt: new Date().toISOString() }, { details: `Scheduled program “${data.title}” on ${fmtDate(data.date)}` });
        toast(`“${data.title}” has been scheduled.`, 'success', 'Program created');
      }
      Modal.close(modal);
      renderAll();
    });

    $('#addProgramBtn').addEventListener('click', () => openForm(null));

    /* Card actions */
    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const p = DB.find('programs', btn.dataset.id);
      if (!p) return;
      const action = btn.dataset.action;
      if (action === 'edit') openForm(p);
      if (action === 'beneficiaries') openBeneficiaries(p);
      if (action === 'toggle-cancel') {
        const cancelling = !p.cancelled;
        const ok = await confirmDialog(cancelling
          ? { title: 'Cancel this program?', message: `“${p.title}” will be marked as cancelled. ${p.beneficiaries.length} enrolled seniors should be informed.`, confirmText: 'Cancel program', icon: 'fa-ban', cancelText: 'Keep program' }
          : { title: 'Reinstate this program?', message: `“${p.title}” will be restored to the schedule.`, confirmText: 'Reinstate', tone: 'primary', icon: 'fa-rotate-left' });
        if (!ok) return;
        DB.update('programs', p.id, { cancelled: cancelling }, { details: `${cancelling ? 'Cancelled' : 'Reinstated'} program “${p.title}”`, severity: cancelling ? 'Warning' : 'Info' });
        toast(`“${p.title}” was ${cancelling ? 'cancelled' : 'reinstated'}.`, cancelling ? 'warning' : 'success');
        renderAll();
      }
      if (action === 'delete') {
        const ok = await confirmDialog({ title: 'Delete program?', message: `“${p.title}” and its beneficiary list will be permanently deleted.`, confirmText: 'Delete program', icon: 'fa-trash-can' });
        if (!ok) return;
        DB.remove('programs', p.id, { details: `Deleted program “${p.title}”` });
        toast(`“${p.title}” was deleted.`, 'success', 'Program deleted');
        renderAll();
      }
    });

    /* Beneficiaries */
    const ELIGIBLE = {
      Pension: { label: 'Add Social Pension recipients', test: (s) => s.pension === 'Social Pension' },
      Health: { label: 'Add seniors with health conditions', test: (s) => (s.conditions || []).length > 0 },
      Outreach: { label: 'Add 75+ or indigent seniors', test: (s) => ageOf(s.birthdate) >= 75 || s.indigent }
    };

    function openBeneficiaries(p) {
      benProgramId = p.id;
      benSet = new Set(p.beneficiaries);
      $('#benTitle').textContent = p.title;
      $('#benSubtitle').textContent = `${p.type} · ${fmtDate(p.date)} · ${p.venue}`;
      $('#benEligible').innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> ${ELIGIBLE[p.type].label}`;
      $('#benSearch').value = '';
      renderBeneficiaries();
      Modal.open('beneficiaryModal');
    }

    function renderBeneficiaries() {
      const p = DB.find('programs', benProgramId);
      const map = seniorsById();
      const full = benSet.size >= p.capacity;
      $('#benCount').textContent = `${benSet.size} / ${p.capacity}`;
      $('#benMeter').style.width = `${Math.min(100, (benSet.size / p.capacity) * 100)}%`;
      $('#benMeter').classList.toggle('is-full', full);
      $('#benFull').hidden = !full;

      const tags = [...benSet].map((id) => map.get(id)).filter(Boolean);
      $('#benTags').innerHTML = tags.length ? tags.map((s) => `
        <span class="beneficiary-tag beneficiary-tag--removable">
          ${esc(displayName(s))}
          <button type="button" data-remove="${esc(s.id)}" aria-label="Remove ${esc(displayName(s))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </span>`).join('') : '<span class="muted small">No beneficiaries yet. Search the registry below to add seniors.</span>';

      const q = $('#benSearch').value.trim().toLowerCase();
      const candidates = DB.all('seniors').filter((s) => s.status === 'Active' && !benSet.has(s.id)
        && (!q || `${s.firstName} ${s.lastName} ${s.oscaId} ${s.purok}`.toLowerCase().includes(q)));
      $('#benResults').innerHTML = candidates.slice(0, 8).map((s) => `
        <li class="ben-result">
          <div class="cell-person">
            ${avatar(displayName(s), 'avatar--sm', s.photo)}
            <div class="cell-person__text"><strong>${esc(fullName(s))}</strong><small>${esc(s.oscaId)} · ${esc(s.purok)} · ${ageOf(s.birthdate)} yrs</small></div>
          </div>
          <button type="button" class="btn btn--soft btn--sm" data-add="${esc(s.id)}" ${full ? 'disabled' : ''}><i class="fa-solid fa-plus" aria-hidden="true"></i> Add</button>
        </li>`).join('') || `<li class="muted small" style="padding:12px 0">${q ? 'No matching active seniors.' : 'All active seniors are already enrolled.'}</li>`;
    }

    $('#benSearch').addEventListener('input', debounce(renderBeneficiaries, 150));
    $('#benTags').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (btn) { benSet.delete(btn.dataset.remove); renderBeneficiaries(); }
    });
    $('#benResults').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add]');
      if (btn && !btn.disabled) { benSet.add(btn.dataset.add); renderBeneficiaries(); $('#benSearch').focus(); }
    });
    $('#benEligible').addEventListener('click', () => {
      const p = DB.find('programs', benProgramId);
      const rule = ELIGIBLE[p.type];
      let added = 0;
      DB.all('seniors').filter((s) => s.status === 'Active' && !benSet.has(s.id) && rule.test(s)).forEach((s) => {
        if (benSet.size < p.capacity) { benSet.add(s.id); added++; }
      });
      renderBeneficiaries();
      toast(added ? `${added} eligible senior${added > 1 ? 's' : ''} added.` : 'No additional eligible seniors (or capacity reached).', added ? 'success' : 'info');
    });
    $('#benSave').addEventListener('click', () => {
      const p = DB.find('programs', benProgramId);
      const before = new Set(p.beneficiaries);
      const added = [...benSet].filter((id) => !before.has(id)).length;
      const removed = [...before].filter((id) => !benSet.has(id)).length;
      if (added || removed) {
        DB.update('programs', p.id, { beneficiaries: [...benSet] }, { details: `Updated beneficiaries of “${p.title}” (+${added} / −${removed}, ${benSet.size} total)` });
        toast(`${benSet.size} beneficiaries enrolled in “${p.title}”.`, 'success', 'Beneficiaries saved');
      }
      Modal.close('beneficiaryModal');
      renderAll();
    });

    renderAll();
    if (params.get('open')) focusProgram(params.get('open'));
  };

  /* Assistance management ------------------------------------------------- */
  Pages.assistance = function () {
    const state = { status: '', q: '', type: '', page: 1, perPage: 10 };
    const tbody = $('#requestBody');
    const form = $('#requestForm');
    const modal = $('#requestModal');
    const session = Session.get();

    const seniorMap = () => new Map(DB.all('seniors').map((s) => [s.id, s]));

    function filtered() {
      const map = seniorMap();
      const q = state.q.toLowerCase();
      return DB.all('assistance').filter((a) => {
        if (state.status && a.status !== state.status) return false;
        if (state.type && a.type !== state.type) return false;
        if (q) {
          const s = map.get(a.seniorId);
          if (!`${a.id} ${a.purpose} ${s ? `${s.firstName} ${s.lastName} ${s.oscaId}` : ''}`.toLowerCase().includes(q)) return false;
        }
        return true;
      });
    }

    function renderSummary() {
      const all = DB.all('assistance');
      const by = (st) => all.filter((a) => a.status === st);
      $('#asPending').textContent = by('Pending').length;
      $('#asApproved').textContent = by('Approved').length;
      $('#asReleased').textContent = fmtMoney(by('Released').reduce((s, a) => s + a.amount, 0));
      $('#asDenied').textContent = by('Denied').length;
      $$('#statusTabs [data-status]').forEach((tab) => {
        const st = tab.dataset.status;
        tab.querySelector('.tab__count').textContent = st ? by(st).length : all.length;
        const active = st === state.status;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
    }

    const actionButtons = (a) => {
      const approve = can('assistance.approve');
      const view = `<button type="button" class="icon-btn icon-btn--sm" data-action="view" data-id="${esc(a.id)}" aria-label="View ${esc(a.id)}" data-tooltip="View details"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>`;
      if (a.status === 'Pending') {
        return `${view}
          <button type="button" class="icon-btn icon-btn--sm icon-btn--success" data-action="Approved" data-id="${esc(a.id)}" aria-label="Approve ${esc(a.id)}" data-tooltip="${approve ? 'Approve request' : 'Requires approver role'}" ${approve ? '' : 'disabled'}><i class="fa-solid fa-check" aria-hidden="true"></i></button>
          <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-action="Denied" data-id="${esc(a.id)}" aria-label="Deny ${esc(a.id)}" data-tooltip="${approve ? 'Deny request' : 'Requires approver role'}" ${approve ? '' : 'disabled'}><i class="fa-solid fa-ban" aria-hidden="true"></i></button>`;
      }
      if (a.status === 'Approved') {
        return `${view}
          <button type="button" class="btn btn--soft btn--sm" data-action="Released" data-id="${esc(a.id)}" ${approve ? '' : 'disabled'}><i class="fa-solid fa-hand-holding-dollar" aria-hidden="true"></i> Release</button>`;
      }
      return view;
    };

    function render() {
      const map = seniorMap();
      const list = filtered();
      state.page = renderPagination($('#requestPagination'), { total: list.length, page: state.page, perPage: state.perPage, onChange: (p) => { state.page = p; render(); } });
      tbody.innerHTML = paginate(list, state.page, state.perPage).map((a) => {
        const s = map.get(a.seniorId);
        return `
          <tr data-row="${esc(a.id)}">
            <td class="nowrap"><strong class="mono">${esc(a.id)}</strong></td>
            <td>
              <div class="cell-person">
                ${avatar(displayName(s), 'avatar--sm', s.photo)}
                <div class="cell-person__text"><strong>${esc(fullName(s))}</strong><small>${s ? `${esc(s.oscaId)} · ${esc(s.purok)}` : 'Record removed'}</small></div>
              </div>
            </td>
            <td><span class="aid-type"><i class="fa-solid ${AID_ICONS[a.type]}" aria-hidden="true"></i>${esc(a.type)}</span></td>
            <td class="nowrap mono strong">${fmtMoney(a.amount)}</td>
            <td class="nowrap">${fmtDate(a.requestedAt)}<br><small class="muted">${esc(relTime(a.requestedAt))}</small></td>
            <td>${badge(a.status, null, `data-badge-for="${esc(a.id)}"`)}</td>
            <td class="nowrap">${esc(a.handledBy || '—')}</td>
            <td class="actions table__actions">${actionButtons(a)}</td>
          </tr>`;
      }).join('') || emptyRow(8, 'No requests here', state.status ? `There are no ${state.status.toLowerCase()} requests matching your filters.` : 'Try adjusting your filters.', 'fa-folder-open');
      renderSummary();
    }

    $('#statusTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-status]');
      if (!tab) return;
      state.status = tab.dataset.status;
      state.page = 1;
      render();
    });
    $('#asSearch').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.page = 1; render(); }, 180));
    $('#asType').addEventListener('change', (e) => { state.type = e.target.value; state.page = 1; render(); });

    /* Status transitions */
    async function changeStatus(id, next) {
      const a = DB.find('assistance', id);
      if (!a || !can('assistance.approve')) return;
      const s = DB.find('seniors', a.seniorId);
      const who = displayName(s);
      let note = '';
      if (next === 'Denied') {
        note = await confirmDialog({ title: `Deny request ${a.id}?`, message: `${fmtMoney(a.amount)} ${a.type.toLowerCase()} assistance for ${who}.`, confirmText: 'Deny request', icon: 'fa-ban', input: { label: 'Reason for denial', placeholder: 'e.g. Incomplete supporting documents', required: true } });
        if (note === null) return;
      } else if (next === 'Approved') {
        const ok = await confirmDialog({ title: `Approve request ${a.id}?`, message: `Approve ${fmtMoney(a.amount)} ${a.type.toLowerCase()} assistance for ${who}.`, confirmText: 'Approve', tone: 'success', icon: 'fa-circle-check' });
        if (!ok) return;
        note = 'Approved for release';
      } else if (next === 'Released') {
        const ok = await confirmDialog({ title: 'Confirm release', message: `Confirm that ${fmtMoney(a.amount)} ${a.type.toLowerCase()} assistance was handed over to ${who}.`, confirmText: 'Mark as released', tone: 'primary', icon: 'fa-hand-holding-dollar' });
        if (!ok) return;
        note = 'Released to beneficiary';
      }

      const at = new Date().toISOString();
      const verbs = { Approved: ['Approve', 'Approved'], Denied: ['Deny', 'Denied'], Released: ['Release', 'Released'] };
      const badgeEl = document.querySelector(`[data-badge-for="${CSS.escape(id)}"]`);
      if (badgeEl) { badgeEl.className = `badge badge--${STATUS_TONE[next]}`; badgeEl.textContent = next; }
      DB.update('assistance', id, {
        status: next, handledBy: session.name,
        remarks: next === 'Denied' ? note : a.remarks,
        history: [...(a.history || []), { status: next, at, by: session.name, note }]
      }, { action: verbs[next][0], details: `${verbs[next][1]} ${a.type} request ${a.id} for ${who} (${fmtMoney(a.amount)})`, severity: next === 'Denied' ? 'Warning' : 'Info' });
      toast(`Request ${a.id} is now ${next.toLowerCase()}.`, next === 'Denied' ? 'warning' : 'success', `Request ${next.toLowerCase()}`);
      setTimeout(() => { render(); renderHistory(); if ($('#requestDetailModal').classList.contains('is-open')) openDetail(id); }, 300);
    }

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      if (btn.dataset.action === 'view') openDetail(btn.dataset.id);
      else changeStatus(btn.dataset.id, btn.dataset.action);
    });

    /* Detail modal with status tracker */
    function openDetail(id) {
      const a = DB.find('assistance', id);
      if (!a) { toast('That request could not be found.', 'error'); return; }
      const s = DB.find('seniors', a.seniorId);
      const steps = a.status === 'Denied' ? ['Pending', 'Denied'] : ['Pending', 'Approved', 'Released'];
      const reached = new Map((a.history || []).map((h) => [h.status, h]));
      const currentIdx = steps.indexOf(a.status);

      $('#detailTitle').textContent = `Request ${a.id}`;
      $('#detailSubtitle').textContent = `${a.type} assistance · Filed ${fmtDateTime(a.requestedAt)}`;
      $('#requestDetailBody').innerHTML = `
        <ol class="status-tracker ${a.status === 'Denied' ? 'is-denied' : ''}" aria-label="Request progress">
          ${steps.map((st, i) => {
            const h = reached.get(st);
            const cls = i < currentIdx ? 'is-done' : i === currentIdx ? 'is-current' : '';
            return `
              <li class="status-tracker__step ${cls} status-tracker__step--${st.toLowerCase()}">
                <span class="status-tracker__dot"><i class="fa-solid ${st === 'Denied' ? 'fa-xmark' : i <= currentIdx ? 'fa-check' : 'fa-circle'}" aria-hidden="true"></i></span>
                <span class="status-tracker__label">${st === 'Pending' ? 'Requested' : st}</span>
                <small>${h ? esc(fmtDate(h.at, { month: 'short', day: 'numeric' })) : '—'}</small>
              </li>`;
          }).join('')}
        </ol>

        <dl class="detail-list mt-6">
          <div><dt>Beneficiary</dt><dd>${esc(fullName(s))}</dd></div>
          <div><dt>OSCA ID</dt><dd>${esc(s ? s.oscaId : '—')}</dd></div>
          <div><dt>Assistance type</dt><dd>${esc(a.type)}</dd></div>
          <div><dt>Amount / value</dt><dd class="strong">${fmtMoney(a.amount)}</dd></div>
          <div class="full"><dt>Purpose</dt><dd>${esc(a.purpose)}</dd></div>
          ${a.remarks ? `<div class="full"><dt>Remarks</dt><dd>${esc(a.remarks)}</dd></div>` : ''}
        </dl>

        <h4 class="profile-section__title mt-6">Activity</h4>
        <ul class="request-log">
          ${[...(a.history || [])].reverse().map((h) => `
            <li>${badge(h.status)}<span><strong>${esc(h.by)}</strong> · ${esc(h.note || '')}<small>${esc(fmtDateTime(h.at))}</small></span></li>`).join('')}
        </ul>`;

      const approve = can('assistance.approve');
      $('#requestDetailFooter').innerHTML = `
        <button type="button" class="btn btn--secondary" data-close>Close</button>
        ${a.status === 'Pending' ? `
          <button type="button" class="btn btn--danger-soft" data-status-to="Denied" ${approve ? '' : 'disabled'}><i class="fa-solid fa-ban" aria-hidden="true"></i> Deny</button>
          <button type="button" class="btn btn--success" data-status-to="Approved" ${approve ? '' : 'disabled'}><i class="fa-solid fa-check" aria-hidden="true"></i> Approve</button>` : ''}
        ${a.status === 'Approved' ? `<button type="button" class="btn btn--primary" data-status-to="Released" ${approve ? '' : 'disabled'}><i class="fa-solid fa-hand-holding-dollar" aria-hidden="true"></i> Mark as released</button>` : ''}`;
      $('#requestDetailFooter').onclick = (e) => {
        const b = e.target.closest('[data-status-to]');
        if (b && !b.disabled) changeStatus(a.id, b.dataset.statusTo);
      };
      Modal.open('requestDetailModal');
    }

    /* New request form */
    const reqSenior = form.elements.seniorId;
    reqSenior.insertAdjacentHTML('beforeend', seniorOptions((s) => s.status !== 'Transferred'));

    function renderSeniorInfo() {
      const s = DB.find('seniors', reqSenior.value);
      const info = $('#reqSeniorInfo');
      const warn = $('#reqRecentAlert');
      if (!s) { info.hidden = true; warn.hidden = true; return; }
      const history = sortBy(DB.all('assistance').filter((a) => a.seniorId === s.id), 'requestedAt', 'desc');
      const last = history[0];
      info.hidden = false;
      info.innerHTML = `
        ${avatar(displayName(s), '', s.photo)}
        <div>
          <strong>${esc(fullName(s))}</strong>
          <small>${ageOf(s.birthdate)} yrs · ${esc(s.purok)} · ${esc(s.pension)}${s.indigent ? ' · Indigent' : ''}${s.status === 'Deceased' ? ' · Deceased' : ''}</small>
          <small>${last ? `Last request: ${esc(last.type)} ${fmtMoney(last.amount)} on ${fmtDate(last.requestedAt)} (${esc(last.status)})` : 'No previous assistance on record'}</small>
        </div>`;
      const type = form.elements.type.value;
      const recent = history.find((a) => a.type === type && a.status !== 'Denied' && Date.now() - new Date(a.requestedAt).getTime() < 30 * 86400000);
      warn.hidden = !recent;
      if (recent) $('#reqRecentText').textContent = `${displayName(s)} already has a ${type.toLowerCase()} request (${recent.id}, ${recent.status.toLowerCase()}) filed on ${fmtDate(recent.requestedAt)}.`;
    }
    reqSenior.addEventListener('change', renderSeniorInfo);
    form.elements.type.addEventListener('change', renderSeniorInfo);

    function openRequestForm(seniorId) {
      Form.reset(form);
      if (seniorId) reqSenior.value = seniorId;
      renderSeniorInfo();
      Modal.open(modal);
    }
    $('#newRequestBtn').addEventListener('click', () => openRequestForm());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!Form.validate(form, (d) => {
        const s = DB.find('seniors', d.seniorId);
        if (s && s.status === 'Deceased' && d.type !== 'Burial') return { type: 'Only burial assistance can be filed for a deceased senior.' };
        return {};
      })) return;
      const d = Form.data(form);
      const s = DB.find('seniors', d.seniorId);
      const at = new Date().toISOString();
      const id = nextRequestId();
      DB.add('assistance', {
        id, seniorId: d.seniorId, type: d.type, amount: d.amount, purpose: d.purpose, remarks: d.remarks,
        status: 'Pending', requestedAt: at, updatedAt: at, handledBy: session.name,
        history: [{ status: 'Pending', at, by: session.name, note: 'Request filed' }]
      }, { details: `Filed ${d.type} request ${id} for ${displayName(s)} (${fmtMoney(d.amount)})` });
      Modal.close(modal);
      toast(`Request ${id} for ${displayName(s)} was filed and is awaiting approval.`, 'success', 'Request submitted');
      state.status = ''; state.page = 1;
      render();
      renderHistory();
    });

    /* Resident history */
    const historySelect = $('#historySenior');
    historySelect.insertAdjacentHTML('beforeend', seniorOptions(() => true));

    function renderHistory() {
      const id = historySelect.value;
      const s = DB.find('seniors', id);
      const rows = sortBy(DB.all('assistance').filter((a) => a.seniorId === id), 'requestedAt', 'desc');
      const released = rows.filter((a) => a.status === 'Released');
      $('#historySummary').innerHTML = s ? `
        <div class="history-summary__item"><span>Total requests</span><strong>${rows.length}</strong></div>
        <div class="history-summary__item"><span>Released</span><strong>${released.length}</strong></div>
        <div class="history-summary__item"><span>Total received</span><strong>${fmtMoney(released.reduce((sum, a) => sum + a.amount, 0))}</strong></div>
        <div class="history-summary__item"><span>Last received</span><strong>${released[0] ? fmtDate(released[0].updatedAt) : '—'}</strong></div>` : '';
      $('#historyBody').innerHTML = rows.map((a) => `
        <tr>
          <td class="mono strong">${esc(a.id)}</td>
          <td><span class="aid-type"><i class="fa-solid ${AID_ICONS[a.type]}" aria-hidden="true"></i>${esc(a.type)}</span></td>
          <td>${esc(a.purpose)}</td>
          <td class="nowrap mono">${fmtMoney(a.amount)}</td>
          <td class="nowrap">${fmtDate(a.requestedAt)}</td>
          <td>${badge(a.status)}</td>
          <td class="nowrap">${esc(a.handledBy || '—')}</td>
        </tr>`).join('') || emptyRow(7, 'No assistance history', s ? `${displayName(s)} has not requested assistance yet.` : 'Select a resident to view their history.', 'fa-clock-rotate-left');
      $('#historyNewBtn').disabled = !s || !can('assistance.write') || s.status === 'Transferred';
    }
    historySelect.addEventListener('change', renderHistory);
    $('#historyNewBtn').addEventListener('click', () => openRequestForm(historySelect.value));

    const counts = DB.all('assistance').reduce((m, a) => m.set(a.seniorId, (m.get(a.seniorId) || 0) + 1), new Map());
    const topSenior = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    historySelect.value = params.get('senior') && DB.find('seniors', params.get('senior')) ? params.get('senior') : (topSenior ? topSenior[0] : '');

    $('#exportAssistance').addEventListener('click', () => {
      const map = seniorMap();
      const list = filtered();
      downloadCSV(`assistance-requests-${fileStamp()}.csv`, [
        ['Request ID', 'OSCA ID', 'Beneficiary', 'Purok', 'Type', 'Amount', 'Purpose', 'Status', 'Requested', 'Last Updated', 'Handled By', 'Remarks'],
        ...list.map((a) => { const s = map.get(a.seniorId); return [a.id, s?.oscaId, fullName(s), s?.purok, a.type, a.amount, a.purpose, a.status, fmtDateTime(a.requestedAt), fmtDateTime(a.updatedAt), a.handledBy, a.remarks]; })
      ]);
      DB.log('Export', 'Assistance Management', `Exported ${list.length} assistance records (CSV)`);
      toast(`${list.length} requests exported to CSV.`, 'success', 'Export ready');
    });

    render();
    renderHistory();
    if (params.get('request')) openDetail(params.get('request'));
    if (params.get('action') === 'new' && can('assistance.write')) openRequestForm(params.get('senior'));
    else if (params.get('senior')) setTimeout(() => $('#historyCard').scrollIntoView({ behavior: 'smooth' }), 150);
  };

  /* Audit trail ----------------------------------------------------------- */
  Pages.audit = function () {
    if (!can('audit.view')) {
      $('#auditContent').hidden = true;
      $('#auditRestricted').hidden = false;
      $('#exportAudit').hidden = true;
      return;
    }
    const state = { q: '', user: '', action: params.get('action') || '', severity: '', from: '', to: '', page: 1, perPage: 15 };
    const session = Session.get();
    const logs = () => DB.all('logs');

    const users = [...new Set(logs().map((l) => l.user))].sort();
    const actions = [...new Set(logs().map((l) => l.action))].sort();
    $('#auUser').insertAdjacentHTML('beforeend', users.map((u) => `<option>${esc(u)}</option>`).join(''));
    $('#auAction').insertAdjacentHTML('beforeend', actions.map((a) => `<option>${esc(a)}</option>`).join(''));
    if (state.action) $('#auAction').value = state.action;

    function filtered() {
      const q = state.q.toLowerCase();
      return logs().filter((l) => {
        if (state.user && l.user !== state.user) return false;
        if (state.action && l.action !== state.action) return false;
        if (state.severity && l.severity !== state.severity) return false;
        const day = toISODate(new Date(l.ts));
        if (state.from && day < state.from) return false;
        if (state.to && day > state.to) return false;
        if (q && !`${l.details} ${l.user} ${l.module} ${l.ip} ${l.action}`.toLowerCase().includes(q)) return false;
        return true;
      });
    }

    function renderStats() {
      const all = logs();
      const today = toISODate(new Date());
      const week = Date.now() - 7 * 86400000;
      const recent = all.filter((l) => new Date(l.ts).getTime() > week);
      $('#auToday').textContent = all.filter((l) => toISODate(new Date(l.ts)) === today).length;
      $('#auWarnings').textContent = recent.filter((l) => l.severity === 'Warning').length;
      $('#auCritical').textContent = recent.filter((l) => l.severity === 'Critical').length;
      $('#auFailed').textContent = recent.filter((l) => l.action === 'Failed Login').length;
    }

    const ACTION_TONE = { Create: 'approved', Approve: 'approved', Release: 'violet', Update: 'info', Login: 'neutral', Logout: 'neutral', Export: 'info', Backup: 'violet', Delete: 'alert', Deny: 'alert', Restore: 'alert', 'Failed Login': 'alert', 'Revoke Session': 'pending', Reset: 'alert' };

    function render() {
      const list = filtered();
      state.page = renderPagination($('#auditPagination'), { total: list.length, page: state.page, perPage: state.perPage, onChange: (p) => { state.page = p; render(); } });
      $('#auditCount').textContent = `${fmtNumber(list.length)} event${list.length === 1 ? '' : 's'}`;
      $('#auditBody').innerHTML = paginate(list, state.page, state.perPage).map((l) => `
        <tr class="audit-row audit-row--${l.severity.toLowerCase()}">
          <td class="nowrap"><span class="audit-time">${esc(fmtDate(l.ts))}</span><small class="muted">${new Date(l.ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</small></td>
          <td>
            <div class="cell-person" style="min-width:160px">
              ${avatar(l.user, 'avatar--sm')}
              <div class="cell-person__text"><strong>${esc(l.user)}</strong><small>${esc(l.role)}</small></div>
            </div>
          </td>
          <td>${badge(l.action, ACTION_TONE[l.action] || 'neutral', 'data-plain')}</td>
          <td class="nowrap">${esc(l.module)}</td>
          <td class="audit-details">${esc(l.details)}</td>
          <td class="nowrap mono muted">${esc(l.ip || '—')}</td>
          <td>${badge(l.severity)}</td>
        </tr>`).join('') || emptyRow(7, 'No matching events', 'Try widening the date range or clearing filters.', 'fa-magnifying-glass');
      renderStats();
    }

    function renderSecurity() {
      const failed = logs().filter((l) => l.action === 'Failed Login').slice(0, 5);
      $('#failedLogins').innerHTML = failed.map((l) => `
        <li class="security-item">
          <span class="security-item__icon tone-alert"><i class="fa-solid fa-user-lock" aria-hidden="true"></i></span>
          <span class="security-item__body"><strong>${esc(l.user)}</strong><small>${esc(l.ip)} · ${esc(relTime(l.ts))}</small></span>
          ${badge('Blocked', 'alert', 'data-plain')}
        </li>`).join('') || `<li>${emptyState('No failed attempts', 'All recent sign-ins were successful.', 'fa-shield')}</li>`;

      const sessions = [
        { id: 'current', name: session.name, role: session.role, ip: session.ip, device: detectDevice(), since: session.loginAt, current: true },
        ...SEED_USERS.filter((u) => u.name !== session.name).map((u, i) => ({ id: `demo-${i}`, name: u.name, role: u.role, ip: `192.168.1.${24 + i * 13}`, device: i ? 'Safari on iOS' : 'Chrome on Windows', since: new Date(Date.now() - (i ? 35 : 140) * 60000).toISOString() }))
      ];
      const revoked = JSON.parse(sessionStorage.getItem('bscims_revoked') || '[]');
      $('#activeSessions').innerHTML = sessions.filter((s) => !revoked.includes(s.id)).map((s) => `
        <li class="security-item">
          <span class="security-item__icon tone-${s.current ? 'approved' : 'violet'}"><i class="fa-solid ${/iOS|Android/.test(s.device) ? 'fa-mobile-screen' : 'fa-desktop'}" aria-hidden="true"></i></span>
          <span class="security-item__body"><strong>${esc(s.name)} ${s.current ? '<span class="badge badge--approved badge--plain">This device</span>' : ''}</strong><small>${esc(s.role)} · ${esc(s.device)} · ${esc(s.ip)} · since ${esc(relTime(s.since).toLowerCase())}</small></span>
          ${s.current ? '' : `<button type="button" class="btn btn--ghost btn--sm" data-revoke="${esc(s.id)}" data-name="${esc(s.name)}" ${can('session.revoke') ? '' : 'disabled title="Administrator only"'}>Revoke</button>`}
        </li>`).join('');
    }

    $('#activeSessions').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-revoke]');
      if (!btn || btn.disabled) return;
      const ok = await confirmDialog({ title: 'Revoke session?', message: `${btn.dataset.name} will be signed out on that device immediately.`, confirmText: 'Revoke session', icon: 'fa-user-slash' });
      if (!ok) return;
      const revoked = JSON.parse(sessionStorage.getItem('bscims_revoked') || '[]');
      revoked.push(btn.dataset.revoke);
      sessionStorage.setItem('bscims_revoked', JSON.stringify(revoked));
      DB.log('Revoke Session', 'Security', `Revoked active session of ${btn.dataset.name}`, 'Warning');
      toast(`${btn.dataset.name}'s session was revoked.`, 'success');
      renderSecurity(); render();
    });

    const filterForm = $('#auditFilters');
    filterForm.addEventListener('submit', (e) => e.preventDefault());
    filterForm.addEventListener('input', debounce((e) => {
      if (!e.target.name) return;
      state[e.target.name] = e.target.value;
      state.page = 1;
      render();
    }, 180));
    $('#auReset').addEventListener('click', () => {
      filterForm.reset();
      Object.assign(state, { q: '', user: '', action: '', severity: '', from: '', to: '', page: 1 });
      render();
    });

    $('#exportAudit').addEventListener('click', () => {
      if (!can('report.export')) return;
      const list = filtered();
      downloadCSV(`audit-trail-${fileStamp()}.csv`, [
        ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Details', 'IP Address', 'Severity'],
        ...list.map((l) => [fmtDateTime(l.ts), l.user, l.role, l.action, l.module, l.details, l.ip, l.severity])
      ]);
      DB.log('Export', 'Audit Trail', `Exported ${list.length} audit events (CSV)`);
      toast(`${list.length} events exported to CSV.`, 'success', 'Export ready');
      render();
    });

    render();
    renderSecurity();
  };

  /* Database backup & settings ------------------------------------------- */
  Pages.backup = function () {
    const session = Session.get();
    const settingsForm = $('#settingsForm');
    let pendingRestore = null;

    const FREQ_MS = { Daily: 86400000, Weekly: 7 * 86400000 };
    function simulateAutoBackup() {
      const s = DB.settings;
      if (!s.autoBackup) return;
      const lastAuto = DB.all('backups').find((b) => b.type === 'Automatic');
      const scheduled = new Date(); scheduled.setHours(2, 0, 0, 0);
      if (scheduled > new Date()) scheduled.setDate(scheduled.getDate() - 1);
      if (lastAuto && new Date(scheduled) - new Date(lastAuto.ts) < (FREQ_MS[s.backupFrequency] || FREQ_MS.Daily) - 60000) return;
      DB.load().backups.unshift({ id: uid('BK'), ts: scheduled.toISOString(), type: 'Automatic', size: DB.sizeBytes(), by: 'System', records: recordCount() });
      DB.log('Backup', 'Database Backup', `Automatic ${s.backupFrequency.toLowerCase()} backup completed`, 'Info', { user: 'System', role: 'Scheduler', ip: '127.0.0.1' });
    }

    const recordCount = () => ['seniors', 'programs', 'assistance'].reduce((n, k) => n + DB.all(k).length, 0);

    function renderOverview() {
      const size = DB.sizeBytes();
      const last = DB.all('backups')[0];
      $('#lastBackup').textContent = last ? relTime(last.ts) : 'Never';
      $('#lastBackupMeta').textContent = last ? `${last.type} · ${fmtDateTime(last.ts)}` : 'Create your first backup';
      $('#dbSize').textContent = fmtBytes(size);
      $('#recordCount').textContent = fmtNumber(recordCount());
      $('#recordBreakdown').textContent = `${DB.all('seniors').length} seniors · ${DB.all('assistance').length} requests · ${DB.all('programs').length} programs`;
      const pct = Math.min(100, (size / STORAGE_QUOTA) * 100);
      $('#storageFill').style.width = `${Math.max(pct, 1)}%`;
      $('#storageFill').classList.toggle('is-warning', pct > 70);
      $('#storageText').textContent = `${fmtBytes(size)} of ~5 MB browser storage used (${pct.toFixed(1)}%)`;
      $('#storageBar').setAttribute('aria-valuenow', pct.toFixed(1));
      $('#nextBackup').textContent = DB.settings.autoBackup ? `Next automatic backup: ${DB.settings.backupFrequency === 'Weekly' ? 'in 7 days' : 'tomorrow'} at 2:00 AM` : 'Automatic backups are turned off';
    }

    function renderHistory() {
      const list = DB.all('backups');
      $('#backupHistoryBody').innerHTML = list.slice(0, 12).map((b) => `
        <tr>
          <td class="nowrap"><strong>${esc(fmtDate(b.ts))}</strong><br><small class="muted">${new Date(b.ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</small></td>
          <td>${badge(b.type, b.type === 'Manual' ? 'violet' : b.type === 'Restore point' ? 'pending' : 'info', 'data-plain')}</td>
          <td class="nowrap mono">${fmtBytes(b.size)}</td>
          <td class="nowrap mono">${fmtNumber(b.records)}</td>
          <td class="nowrap">${esc(b.by)}</td>
          <td>${badge('Completed', 'approved')}</td>
        </tr>`).join('') || emptyRow(6, 'No backups yet', 'Create a backup to see it here.', 'fa-database');
    }

    /* Create backup */
    $('#createBackupBtn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;
      await runProgress($('#backupProgress'), ['Collecting senior records…', 'Packaging assistance history…', 'Bundling audit logs…', 'Finalizing backup file…']);
      const payload = DB.exportData();
      const json = JSON.stringify(payload, null, 2);
      const filename = `bscims-backup-${fileStamp()}.json`;
      downloadBlob(json, filename, 'application/json');
      DB.load().backups.unshift({ id: uid('BK'), ts: new Date().toISOString(), type: 'Manual', size: new Blob([json]).size, by: session.name, records: recordCount() });
      DB.log('Backup', 'Database Backup', `Manual backup created (${filename}, ${fmtBytes(new Blob([json]).size)})`);
      toast(`${filename} was downloaded. Store it somewhere safe.`, 'success', 'Backup complete');
      $('#backupProgress .progress__label').textContent = 'Backup completed successfully';
      btn.disabled = false;
      renderOverview(); renderHistory();
      setTimeout(() => { $('#backupProgress').hidden = true; }, 2500);
    });

    /* Restore */
    const restoreInput = $('#restoreInput');
    const dropZone = $('#restoreDrop');

    function handleFile(file) {
      pendingRestore = null;
      $('#restoreBtn').disabled = true;
      const info = $('#restoreFileInfo');
      if (!file) { info.hidden = true; return; }
      if (!/\.json$/i.test(file.name)) { showRestoreError('Please choose a .json backup file.'); return; }
      if (file.size > STORAGE_QUOTA) { showRestoreError('This file is larger than the browser storage limit.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        let obj;
        try { obj = JSON.parse(reader.result); } catch (_) { showRestoreError('The file could not be read as JSON.'); return; }
        const err = DB.validate(obj);
        if (err) { showRestoreError(err); return; }
        pendingRestore = { obj, name: file.name, size: file.size };
        info.hidden = false;
        info.className = 'restore-file alert alert--approved';
        info.innerHTML = `
          <i class="fa-solid fa-file-circle-check" aria-hidden="true"></i>
          <div><strong>${esc(file.name)} · ${fmtBytes(file.size)}</strong>
          <span>${obj.seniors.length} seniors · ${obj.assistance.length} requests · ${obj.programs.length} programs${obj.exportedAt ? ` · Exported ${esc(fmtDateTime(obj.exportedAt))}` : ''}</span></div>`;
        $('#restoreBtn').disabled = !can('backup.restore');
      };
      reader.onerror = () => showRestoreError('The file could not be read.');
      reader.readAsText(file);
    }

    function showRestoreError(msg) {
      const info = $('#restoreFileInfo');
      info.hidden = false;
      info.className = 'restore-file alert alert--alert';
      info.innerHTML = `<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><div><strong>Invalid backup file</strong><span>${esc(msg)}</span></div>`;
      restoreInput.value = '';
    }

    restoreInput.addEventListener('change', () => handleFile(restoreInput.files[0]));
    ['dragenter', 'dragover'].forEach((evt) => dropZone.addEventListener(evt, (e) => { e.preventDefault(); if (!restoreInput.disabled) dropZone.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach((evt) => dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('is-dragover'); }));
    dropZone.addEventListener('drop', (e) => { if (!restoreInput.disabled) handleFile(e.dataTransfer.files[0]); });

    $('#restoreBtn').addEventListener('click', async () => {
      if (!pendingRestore || !can('backup.restore')) return;
      const ok = await confirmDialog({
        title: 'Restore from backup?',
        message: `All current records will be replaced with the contents of ${pendingRestore.name}. This cannot be undone. Consider creating a backup first.`,
        confirmText: 'Restore data', icon: 'fa-rotate-left'
      });
      if (!ok) return;
      $('#restoreBtn').disabled = true;
      await runProgress($('#restoreProgress'), ['Validating backup…', 'Replacing records…', 'Rebuilding indexes…', 'Finishing up…']);
      const backups = DB.all('backups');
      if (DB.importData(pendingRestore.obj)) {
        DB.load().backups = [{ id: uid('BK'), ts: new Date().toISOString(), type: 'Restore point', size: pendingRestore.size, by: session.name, records: recordCount() }, ...backups];
        DB.log('Restore', 'Database Backup', `Database restored from ${pendingRestore.name}`, 'Critical');
        flash(`Data restored from ${pendingRestore.name}.`, 'success', 'Restore complete');
        location.reload();
      }
    });

    /* Settings */
    Form.fill(settingsForm, DB.settings);
    const canEditSettings = can('settings.edit');
    if (!canEditSettings) {
      $$('input, select', settingsForm).forEach((el) => { el.disabled = true; });
      $('#settingsLocked').hidden = false;
    }
    const syncFrequency = () => { settingsForm.elements.backupFrequency.disabled = !canEditSettings || !settingsForm.elements.autoBackup.checked; };
    settingsForm.elements.autoBackup.addEventListener('change', syncFrequency);
    syncFrequency();

    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!canEditSettings) return;
      const next = Form.data(settingsForm);
      const current = DB.settings;
      const LABELS = { autoBackup: 'Automatic backup', backupFrequency: 'Backup frequency', retention: 'Log retention', notifications: 'In-app notifications', emailAlerts: 'Email alerts', twoFactor: 'Two-factor authentication', sessionTimeout: 'Session timeout' };
      const changes = Object.keys(LABELS).filter((k) => k in next && String(next[k]) !== String(current[k]));
      if (!changes.length) { toast('No changes to save.', 'info'); return; }
      const summary = changes.map((k) => `${LABELS[k]}: ${typeof next[k] === 'boolean' ? (next[k] ? 'On' : 'Off') : next[k]}`).join(', ');
      DB.setSettings(next, `Settings changed. ${summary}`);
      toast(`${changes.length} setting${changes.length > 1 ? 's' : ''} updated.`, 'success', 'Settings saved');
      renderOverview();
      renderNotifications();
    });

    /* Reset */
    $('#resetDataBtn').addEventListener('click', async (e) => {
      if (e.currentTarget.disabled) return;
      const ok = await confirmDialog({ title: 'Reset all data?', message: 'Every senior, program, request, and log will be replaced with the original demo data. Download a backup first if you need your current records.', confirmText: 'Reset to demo data', icon: 'fa-triangle-exclamation' });
      if (!ok) return;
      DB.reset();
      DB.log('Reset', 'Database Backup', 'All data reset to demo seed', 'Critical');
      flash('All data was reset to the demo dataset.', 'success', 'Data reset');
      location.reload();
    });

    simulateAutoBackup();
    renderOverview();
    renderHistory();
    if (location.hash === '#settings') setTimeout(() => $('#settings').scrollIntoView({ behavior: 'smooth' }), 100);
  };

  /* ------------------------------------------------------------------------
     14. Bootstrap
     ------------------------------------------------------------------------ */
  const App = {
    ready: false,
    DB, Session, Modal, Form,
    can, toast, flash, confirmDialog, downloadCSV, downloadBlob, fileStamp,
    chartTheme, chartFallback, monthKeys, cssVar, Theme,
    utils: { $, $$, esc, fmtDate, fmtDateTime, fmtMoney, fmtNumber, ageOf, ageBracket, fullName, displayName, parseDate, toISODate, debounce, sortBy, programStatus, startOfDay },
    constants: { PUROKS, AGE_BRACKETS, PENSION_TYPES, CONDITIONS, AID_TYPES, AID_STATUSES, PROGRAM_TYPES }
  };
  window.App = App;

  async function boot() {
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
    DB.load();
    Theme.bind();

    if (IS_LOGIN) {
      await Pages.login();
      App.ready = true;
      return;
    }

    const remote = await Auth.currentUser();
    let session = Session.get();
    if (!remote) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      Session._cache = null;
      location.replace(LOGIN_URL);
      return;
    }
    if (session && session.username === remote.username && Session.isExpired()) {
      Session.end('expired');
      return;
    }
    if (!session || session.username !== remote.username) Session.start(remote, !!(session && session.remember));
    session = Session.get();
    if (!session || !PERMISSIONS[session.role]) {
      location.replace(LOGIN_URL);
      return;
    }
    Session.touch();

    renderSidebar();
    renderTopbar();
    initGlobalEvents();
    fillOptionSets();

    const init = Pages[PAGE];
    if (init) {
      try { init(); } catch (err) {
        console.error(`[BSCIAMS] Failed to initialise "${PAGE}" page.`, err);
        toast('Part of this page failed to load. Please refresh.', 'error');
      }
    }
    applyPermissions();
    App.ready = true;
    showFlash();
  }

  boot();
})();
