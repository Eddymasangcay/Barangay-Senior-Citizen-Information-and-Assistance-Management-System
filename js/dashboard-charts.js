/* ==========================================================================
   dashboard-charts.js: Chart.js initialization for the main dashboard
   ========================================================================== */
(function () {
  'use strict';

  const App = window.App;
  if (!App || !App.ready) return;

  const canvases = {
    registrations: document.getElementById('registrationsChart'),
    aidType: document.getElementById('aidTypeChart'),
    purok: document.getElementById('purokChart')
  };

  const theme = App.chartTheme();
  if (!theme) {
    Object.values(canvases).forEach((c) => App.chartFallback(c));
    return;
  }

  const { DB, utils, constants } = App;
  const seniors = DB.all('seniors');
  const assistance = DB.all('assistance');
  const months = App.monthKeys(12);
  const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const rgba = (hex, alpha) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  };

  /* Monthly registrations: line ------------------------------------------ */
  if (canvases.registrations) {
    const counts = months.map((m) => seniors.filter((s) => monthKey(s.registeredAt) === m.key).length);
    const total = counts.reduce((a, b) => a + b, 0);
    const badge = document.getElementById('regTotalBadge');
    if (badge) badge.textContent = `${utils.fmtNumber(total)} in 12 months`;

    new Chart(canvases.registrations, {
      type: 'line',
      data: {
        labels: months.map((m) => m.label),
        datasets: [{
          label: 'New registrations',
          data: counts,
          borderColor: theme.primary,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const area = chart.chartArea;
            if (!area) return 'transparent';
            const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, rgba(theme.primary, 0.18));
            g.addColorStop(1, rgba(theme.primary, 0));
            return g;
          },
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: theme.primary,
          pointBorderWidth: 2
        }]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: theme.border }, border: { display: false } }
        }
      }
    });
  }

  /* Assistance by type: doughnut ---------------------------------------- */
  if (canvases.aidType) {
    const since = new Date(); since.setFullYear(since.getFullYear() - 1);
    const recent = assistance.filter((a) => new Date(a.requestedAt) >= since);
    const counts = constants.AID_TYPES.map((t) => recent.filter((a) => a.type === t).length);
    const total = counts.reduce((a, b) => a + b, 0);

    const centerText = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = App.cssVar('--text-dark');
        ctx.font = '700 24px Inter, sans-serif';
        ctx.fillText(String(total), x, y - 8);
        ctx.fillStyle = theme.muted;
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillText('requests', x, y + 13);
        ctx.restore();
      }
    };

    new Chart(canvases.aidType, {
      type: 'doughnut',
      data: {
        labels: constants.AID_TYPES,
        datasets: [{
          data: counts,
          backgroundColor: [theme.palette[0], theme.palette[1], theme.palette[2], theme.approved, theme.pending],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 4
        }]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${total ? Math.round((ctx.parsed / total) * 100) : 0}%)`
            }
          }
        }
      },
      plugins: [centerText]
    });
  }

  /* Seniors by purok: stacked bar --------------------------------------- */
  if (canvases.purok) {
    const active = seniors.filter((s) => s.status === 'Active');
    const bySex = (sex) => constants.PUROKS.map((p) => active.filter((s) => s.purok === p && s.sex === sex).length);

    new Chart(canvases.purok, {
      type: 'bar',
      data: {
        labels: constants.PUROKS.map((p) => p.replace('Purok ', 'P')),
        datasets: [
          { label: 'Female', data: bySex('Female'), backgroundColor: theme.primary, borderRadius: 4, maxBarThickness: 22 },
          { label: 'Male', data: bySex('Male'), backgroundColor: theme.palette[2], borderRadius: 4, maxBarThickness: 22 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { title: (items) => constants.PUROKS[items[0].dataIndex] } }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, border: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: theme.border }, border: { display: false } }
        }
      }
    });
  }
})();
