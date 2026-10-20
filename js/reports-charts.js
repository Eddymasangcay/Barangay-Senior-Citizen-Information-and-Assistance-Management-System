/* ==========================================================================
   reports-charts.js: Chart.js initialization for demographic reports,
   plus report filters, summary table, and CSV / print exports
   ========================================================================== */
(function () {
  'use strict';

  const App = window.App;
  if (!App || !App.ready) return;

  const { DB, utils, constants } = App;
  const { $, $$, esc, fmtMoney, fmtNumber, fmtDate, fmtDateTime, ageOf, ageBracket, toISODate, parseDate, fullName, debounce } = utils;
  const { PUROKS, AGE_BRACKETS, PENSION_TYPES, CONDITIONS } = constants;

  const form = $('#reportFilters');
  if (!form) return;

  const theme = App.chartTheme();
  const charts = {};
  const state = { from: '', to: '', purok: '' };
  const pad = (n) => String(n).padStart(2, '0');

  const CANVAS = {
    ages: $('#agePyramidChart'),
    gender: $('#genderChart'),
    pension: $('#pensionChart'),
    conditions: $('#conditionsChart'),
    disbursement: $('#disbursementChart')
  };
  if (!theme) Object.values(CANVAS).forEach((c) => App.chartFallback(c));

  /* Filters -------------------------------------------------------------- */
  function setRange(range) {
    const to = new Date();
    const from = range === 'ytd'
      ? new Date(to.getFullYear(), 0, 1)
      : new Date(to.getFullYear(), to.getMonth() - Number(range) + 1, 1);
    state.from = toISODate(from);
    state.to = toISODate(to);
    form.elements.from.value = state.from;
    form.elements.to.value = state.to;
    form.elements.to.min = state.from;
    $$('[data-range]', form).forEach((chip) => chip.classList.toggle('is-active', chip.dataset.range === String(range)));
  }

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', debounce(() => {
    let from = form.elements.from.value;
    let to = form.elements.to.value;
    if (from && to && from > to) { [from, to] = [to, from]; form.elements.from.value = from; form.elements.to.value = to; }
    form.elements.to.min = from || '';
    state.from = from;
    state.to = to;
    state.purok = form.elements.purok.value;
    $$('[data-range]', form).forEach((chip) => chip.classList.remove('is-active'));
    render();
  }, 200));

  $$('[data-range]', form).forEach((chip) => chip.addEventListener('click', () => { setRange(chip.dataset.range); render(); }));
  $('#rpReset').addEventListener('click', () => {
    form.elements.purok.value = '';
    state.purok = '';
    setRange(12);
    render();
  });

  /* Data ----------------------------------------------------------------- */
  function dataset() {
    const all = DB.all('seniors');
    const map = new Map(all.map((s) => [s.id, s]));
    const seniors = all.filter((s) => s.status === 'Active' && (!state.purok || s.purok === state.purok));
    const assistance = DB.all('assistance').filter((a) => {
      const s = map.get(a.seniorId);
      if (state.purok && (!s || s.purok !== state.purok)) return false;
      const day = toISODate(new Date(a.requestedAt));
      if (state.from && day < state.from) return false;
      if (state.to && day > state.to) return false;
      return true;
    });
    return { seniors, assistance, map };
  }

  function monthBuckets() {
    const start = parseDate(state.from) || new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
    const end = parseDate(state.to) || new Date();
    const multiYear = start.getFullYear() !== end.getFullYear();
    const out = [];
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end && out.length < 36) {
      out.push({
        key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
        label: d.toLocaleDateString('en-PH', multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' })
      });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }
  const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

  function purokRows({ seniors, assistance, map }) {
    const puroks = state.purok ? [state.purok] : PUROKS;
    return puroks.map((p) => {
      const list = seniors.filter((s) => s.purok === p);
      const ages = list.map((s) => ageOf(s.birthdate));
      const released = assistance.filter((a) => a.status === 'Released' && map.get(a.seniorId)?.purok === p);
      return {
        purok: p,
        total: list.length,
        female: list.filter((s) => s.sex === 'Female').length,
        male: list.filter((s) => s.sex === 'Male').length,
        avgAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
        eighty: ages.filter((a) => a >= 80).length,
        pensioners: list.filter((s) => s.pension !== 'None').length,
        pwd: list.filter((s) => s.pwd).length,
        indigent: list.filter((s) => s.indigent).length,
        aid: released.reduce((sum, a) => sum + a.amount, 0)
      };
    });
  }

  function totalsOf(rows, seniors) {
    const ages = seniors.map((s) => ageOf(s.birthdate));
    return rows.reduce((t, r) => {
      ['total', 'female', 'male', 'eighty', 'pensioners', 'pwd', 'indigent', 'aid'].forEach((k) => { t[k] += r[k]; });
      return t;
    }, { purok: 'Total', total: 0, female: 0, male: 0, eighty: 0, pensioners: 0, pwd: 0, indigent: 0, aid: 0, avgAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0 });
  }

  /* KPIs & summary ------------------------------------------------------ */
  function renderKpis({ seniors, assistance }) {
    const total = seniors.length;
    const ages = seniors.map((s) => ageOf(s.birthdate));
    const female = seniors.filter((s) => s.sex === 'Female').length;
    const pensioned = seniors.filter((s) => s.pension !== 'None').length;
    const released = assistance.filter((a) => a.status === 'Released');

    $('#kpiTotal').textContent = fmtNumber(total);
    $('#kpiTotalMeta').textContent = `${ages.filter((a) => a >= 80).length} aged 80 and above`;
    $('#kpiAvgAge').textContent = total ? `${(ages.reduce((a, b) => a + b, 0) / total).toFixed(1)}` : '—';
    $('#kpiAvgAgeMeta').textContent = total ? `Oldest resident: ${Math.max(...ages)} yrs` : 'No data';
    $('#kpiFemale').textContent = `${pct(female, total)}%`;
    $('#kpiFemaleMeta').textContent = `${female} female · ${total - female} male`;
    $('#kpiPension').textContent = `${pct(pensioned, total)}%`;
    $('#kpiPensionMeta').textContent = `${seniors.filter((s) => s.pension === 'Social Pension').length} on social pension`;
    $('#kpiAid').textContent = fmtMoney(released.reduce((sum, a) => sum + a.amount, 0));
    $('#kpiAidMeta').textContent = `${released.length} of ${assistance.length} requests released`;
  }

  function renderSummary(data) {
    const rows = purokRows(data);
    const t = totalsOf(rows, data.seniors);
    const row = (r, tag = 'td') => `
      <tr>
        <${tag === 'th' ? 'th scope="row"' : 'td'}>${esc(r.purok)}</${tag === 'th' ? 'th' : 'td'}>
        <td class="text-right">${fmtNumber(r.total)}</td>
        <td class="text-right">${fmtNumber(r.female)}</td>
        <td class="text-right">${fmtNumber(r.male)}</td>
        <td class="text-right">${r.total ? r.avgAge.toFixed(1) : '—'}</td>
        <td class="text-right">${fmtNumber(r.eighty)}</td>
        <td class="text-right">${fmtNumber(r.pensioners)}</td>
        <td class="text-right">${fmtNumber(r.pwd)}</td>
        <td class="text-right">${fmtNumber(r.indigent)}</td>
        <td class="text-right">${fmtMoney(r.aid)}</td>
      </tr>`;
    $('#summaryBody').innerHTML = rows.map((r) => row(r, 'th')).join('');
    $('#summaryFoot').innerHTML = rows.length > 1 ? row(t) : '';
  }

  /* Charts --------------------------------------------------------------- */
  function upsert(key, config) {
    if (!theme || !CANVAS[key]) return;
    if (charts[key]) {
      charts[key].data = config.data;
      charts[key].options = config.options;
      charts[key].update();
    } else {
      charts[key] = new Chart(CANVAS[key], config);
    }
  }

  function renderCharts({ seniors, assistance }) {
    if (!theme) return;
    const P = theme.palette;

    /* Age pyramid */
    const brackets = [...AGE_BRACKETS].reverse();
    const countBy = (sex, b) => seniors.filter((s) => s.sex === sex && ageBracket(ageOf(s.birthdate)) === b).length;
    const male = brackets.map((b) => -countBy('Male', b));
    const female = brackets.map((b) => countBy('Female', b));
    const maxAbs = Math.max(1, ...male.map(Math.abs), ...female);
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find((n) => maxAbs / n <= 4) || Math.ceil(maxAbs / 4);
    const bound = Math.ceil(maxAbs / step) * step;
    upsert('ages', {
      type: 'bar',
      data: {
        labels: brackets,
        datasets: [
          { label: 'Male', data: male, backgroundColor: P[2], borderRadius: 4, barPercentage: 0.9, categoryPercentage: 0.85 },
          { label: 'Female', data: female, backgroundColor: P[0], borderRadius: 4, barPercentage: 0.9, categoryPercentage: 0.85 }
        ]
      },
      options: {
        indexAxis: 'y',
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${Math.abs(c.parsed.x)}` } }
        },
        scales: {
          x: { stacked: true, min: -bound, max: bound, ticks: { precision: 0, stepSize: step, callback: (v) => Math.abs(v) }, grid: { color: theme.border }, border: { display: false } },
          y: { stacked: true, grid: { display: false }, border: { display: false } }
        }
      }
    });

    /* Sex ratio */
    const f = seniors.filter((s) => s.sex === 'Female').length;
    const m = seniors.length - f;
    upsert('gender', {
      type: 'pie',
      data: { labels: ['Female', 'Male'], datasets: [{ data: [f, m], backgroundColor: [P[0], P[2]], borderColor: '#fff', borderWidth: 3, hoverOffset: 4 }] },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${pct(c.parsed, f + m)}%)` } }
        }
      }
    });

    /* Pension coverage */
    const pensionCounts = PENSION_TYPES.map((t) => seniors.filter((s) => s.pension === t).length);
    upsert('pension', {
      type: 'doughnut',
      data: { labels: PENSION_TYPES, datasets: [{ data: pensionCounts, backgroundColor: [P[0], P[1], P[2], theme.approved, P[6]], borderColor: '#fff', borderWidth: 3, hoverOffset: 4 }] },
      options: {
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${pct(c.parsed, seniors.length)}%)` } }
        }
      }
    });

    /* Health conditions */
    const cond = CONDITIONS.map((c) => ({ c, n: seniors.filter((s) => (s.conditions || []).includes(c)).length }))
      .sort((a, b) => b.n - a.n);
    upsert('conditions', {
      type: 'bar',
      data: {
        labels: cond.map((x) => x.c),
        datasets: [{ label: 'Seniors', data: cond.map((x) => x.n), backgroundColor: cond.map((_, i) => (i < 3 ? P[0] : P[2])), borderRadius: 4, maxBarThickness: 18 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: theme.border }, border: { display: false } },
          y: { grid: { display: false }, border: { display: false } }
        }
      }
    });

    /* Disbursement */
    const months = monthBuckets();
    const releasedByMonth = months.map((mo) => assistance.filter((a) => a.status === 'Released' && monthKey(a.updatedAt) === mo.key).reduce((sum, a) => sum + a.amount, 0));
    const filedByMonth = months.map((mo) => assistance.filter((a) => monthKey(a.requestedAt) === mo.key).length);
    $('#disbursementSubtitle').textContent = `Released amount and requests filed per month · ${fmtDate(state.from)} – ${fmtDate(state.to)}`;
    upsert('disbursement', {
      type: 'bar',
      data: {
        labels: months.map((mo) => mo.label),
        datasets: [
          { type: 'bar', label: 'Amount released', data: releasedByMonth, backgroundColor: P[0], borderRadius: 4, maxBarThickness: 28, yAxisID: 'y', order: 2 },
          { type: 'line', label: 'Requests filed', data: filedByMonth, borderColor: theme.pending, backgroundColor: theme.pending, borderWidth: 2, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#fff', pointBorderWidth: 2, yAxisID: 'y1', order: 1 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (c) => (c.dataset.yAxisID === 'y' ? ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}` : ` ${c.dataset.label}: ${c.parsed.y}`) } }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: theme.border }, border: { display: false }, ticks: { callback: (v) => (v >= 1000 ? `₱${v / 1000}k` : `₱${v}`) } },
          y1: { beginAtZero: true, position: 'right', grid: { display: false }, border: { display: false }, ticks: { precision: 0 } }
        }
      }
    });
  }

  function render() {
    const data = dataset();
    renderKpis(data);
    renderSummary(data);
    renderCharts(data);
  }

  /* Exports ------------------------------------------------------------- */
  const periodLabel = () => `${state.from ? fmtDate(state.from) : 'Start'} – ${state.to ? fmtDate(state.to) : 'Today'}`;
  const scopeLabel = () => state.purok || 'All puroks';

  const REPORTS = {
    demographic: {
      label: 'Demographic summary',
      rows(data) {
        const rows = purokRows(data);
        const t = totalsOf(rows, data.seniors);
        return [
          ['Purok', 'Total', 'Female', 'Male', 'Average Age', 'Aged 80+', 'Pensioners', 'PWD', 'Indigent', 'Aid Released (PHP)'],
          ...[...rows, ...(rows.length > 1 ? [t] : [])].map((r) => [r.purok, r.total, r.female, r.male, r.total ? r.avgAge.toFixed(1) : '', r.eighty, r.pensioners, r.pwd, r.indigent, r.aid])
        ];
      }
    },
    assistance: {
      label: 'Assistance disbursement',
      rows({ assistance, map }) {
        return [
          ['Request ID', 'Requested', 'OSCA ID', 'Beneficiary', 'Purok', 'Type', 'Amount (PHP)', 'Status', 'Handled By', 'Purpose'],
          ...assistance.map((a) => { const s = map.get(a.seniorId); return [a.id, fmtDateTime(a.requestedAt), s?.oscaId || '', fullName(s), s?.purok || '', a.type, a.amount, a.status, a.handledBy, a.purpose]; })
        ];
      }
    },
    masterlist: {
      label: 'Senior masterlist',
      rows({ seniors }) {
        return [
          ['OSCA ID', 'Name', 'Sex', 'Birthdate', 'Age', 'Purok', 'Address', 'Contact', 'Pension', 'PWD', 'Indigent'],
          ...utils.sortBy(seniors, 'lastName', 'asc').map((s) => [s.oscaId, fullName(s), s.sex, s.birthdate, ageOf(s.birthdate), s.purok, s.address, s.contact, s.pension, s.pwd ? 'Yes' : 'No', s.indigent ? 'Yes' : 'No'])
        ];
      }
    },
    pension: {
      label: 'Pension beneficiaries',
      rows({ seniors }) {
        return [
          ['OSCA ID', 'Name', 'Sex', 'Age', 'Purok', 'Pension Type', 'Indigent', 'Contact'],
          ...utils.sortBy(seniors.filter((s) => s.pension !== 'None'), 'pension', 'asc').map((s) => [s.oscaId, fullName(s), s.sex, ageOf(s.birthdate), s.purok, s.pension, s.indigent ? 'Yes' : 'No', s.contact])
        ];
      }
    }
  };

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  function exportCSV(type) {
    const report = REPORTS[type];
    const rows = report.rows(dataset());
    App.downloadCSV(`${slug(report.label)}-${slug(scopeLabel())}-${App.fileStamp()}.csv`, rows);
    DB.log('Export', 'Reports & Analytics', `Generated ${report.label} (CSV, ${scopeLabel()}, ${periodLabel()})`);
    App.toast(`${report.label} exported (${rows.length - 1} rows).`, 'success', 'Report ready');
  }

  function printTable(type) {
    const report = REPORTS[type];
    const [head, ...body] = report.rows(dataset());
    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) { App.toast('Allow pop-ups for this site to print reports.', 'warning', 'Pop-up blocked'); return; }
    const session = App.Session.get();
    win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(report.label)}</title>
      <style>
        body{font-family:Inter,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1E1A24;margin:24px;font-size:12px}
        h1{font-size:18px;color:#3D007A;margin:0 0 4px} p{margin:0 0 16px;color:#6B6575}
        table{border-collapse:collapse;width:100%} th,td{border:1px solid #DDD8E3;padding:6px 8px;text-align:left}
        th{background:#F4EEFA;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
        tr:nth-child(even) td{background:#FBFAFC} @page{margin:12mm}
      </style></head><body>
      <h1>${esc(report.label)}</h1>
      <p>Barangay Senior Citizen Information and Assistance Management System · ${esc(scopeLabel())} · ${esc(periodLabel())} · Generated ${esc(fmtDateTime(new Date().toISOString()))} by ${esc(session?.name || '')}</p>
      <table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
    DB.log('Export', 'Reports & Analytics', `Printed ${report.label} (${scopeLabel()}, ${periodLabel()})`);
  }

  const updatePrintMeta = () => {
    const session = App.Session.get();
    $('#printMeta').textContent = `${scopeLabel()} · Assistance period ${periodLabel()} · Generated ${fmtDateTime(new Date().toISOString())} by ${session?.name || ''}`;
  };
  window.addEventListener('beforeprint', updatePrintMeta);

  $('#printReport').addEventListener('click', () => { updatePrintMeta(); window.print(); });
  $('#exportSummary').addEventListener('click', (e) => { if (!e.currentTarget.disabled) exportCSV('demographic'); });

  $('#reportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!App.can('report.export')) return;
    const type = e.currentTarget.elements.reportType.value;
    const format = e.currentTarget.elements.format.value;
    if (format === 'csv') exportCSV(type);
    else if (type === 'demographic') { updatePrintMeta(); window.print(); DB.log('Export', 'Reports & Analytics', `Printed Demographic summary (${scopeLabel()}, ${periodLabel()})`); }
    else printTable(type);
  });

  setRange(12);
  render();
})();
