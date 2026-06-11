/* ============================================================
   ATLAS PSU - main-script.js
   Automated Teaching Load Assignment System
   Single universal script for index, login, and dashboard.
   ============================================================ */

/* ── Auth guard (dashboard only, runs before DOMContentLoaded) ── */
(function authGuard() {
  if (document.getElementById('navUserLabel') !== null) return; // DOM not ready yet; handled in initDashboardPage
  // Check via URL path so the guard only fires on the dashboard page
  if (window.location.pathname.includes('dashboard') && !sessionStorage.getItem('atlasUser')) {
    window.location.href = 'login.html';
  }
})();

'use strict';

/* ============================================================
   1. CONSTANTS & STATE
   ============================================================ */
const API_BASE = 'http://localhost:5000';

const DAY_MAP = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday'
};

const DAY_ORDER = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 };

const DAY_COLORS = {
  Mon: 'Mon', Tue: 'Tue', Wed: 'Wed',
  Thu: 'Thu', Fri: 'Fri', Sat: 'Sat'
};

// MAX_UNITS is now dynamic — read from Settings (localStorage), default 24
function getMaxUnits() {
  try {
    const s = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    return parseInt(s.max_units) || 24;
  } catch(e) { return 24; }
}
// Keep a live reference updated on each access
Object.defineProperty(window, 'MAX_UNITS', { get: getMaxUnits });

// UNITS_PER_ASSIGNMENT — dynamic, read from Settings (localStorage), default 2
function getUnitsPerAssignment() {
  try {
    const s = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    return parseInt(s.units_per_assignment) || 2;
  } catch(e) { return 2; }
}

// Per-faculty max_units lookup (falls back to global Standard Max Units)
function getFacultyMaxUnitsMap() {
  const map = {};
  (typeof getFacultyFromTable === 'function' ? getFacultyFromTable() : []).forEach(f => {
    map[f.name] = f.max_units || getMaxUnits();
  });
  return map;
}

const DATA_VERSION = 'v5'; // bump to wipe stale localStorage on deploy

const SPECIALIZATIONS = [
  'Core Theory',
  'Programming',
  'Systems',
  'Data Management',
  'Networks & Security',
  'Applied Computing',
  'Mathematics',
  'Web & App Dev',
  'Research & Capstone',
  'Industry Practice',
  'Elective'
];

const SUBJECT_TYPES = [
  'Core Theory',
  'Programming',
  'Systems',
  'Data Management',
  'Networks & Security',
  'Applied Computing',
  'Mathematics',
  'Web & App Dev',
  'Research & Capstone',
  'Industry Practice',
  'Elective'
];

const LECTURE_ROOMS = [
  'CL1','CL2','CL3',
  'IT Room 1','IT Room 2','IT Room 3',
  'GA Bldg 16','GA Bldg 17','GA Bldg 18','GA Bldg 19','GA Bldg 20',
  'GA Bldg 21','GA Bldg 22','GA Bldg 23','GA Bldg 24','GA Bldg 25'
];

const LABORATORY_ROOMS = ['MTC1','MTC2','IT101','NIT1','NIT3'];

const ALL_ROOMS = [...LECTURE_ROOMS, ...LABORATORY_ROOMS];

// Room capacity defaults — mirrors backend config/settings.py ROOM_CAPACITY
const DEFAULT_ROOM_CAPACITY = {
  'CL1':       { recommended: 35, max: 52 },
  'CL2':       { recommended: 35, max: 52 },
  'CL3':       { recommended: 35, max: 52 },
  'IT Room 1': { recommended: 45, max: 60 },
  'IT Room 2': { recommended: 45, max: 60 },
  'IT Room 3': { recommended: 45, max: 60 },
  'GA Bldg 16':{ recommended: 40, max: 55 },
  'GA Bldg 17':{ recommended: 40, max: 55 },
  'GA Bldg 18':{ recommended: 40, max: 55 },
  'GA Bldg 19':{ recommended: 40, max: 55 },
  'GA Bldg 20':{ recommended: 40, max: 55 },
  'GA Bldg 21':{ recommended: 40, max: 55 },
  'GA Bldg 22':{ recommended: 40, max: 55 },
  'GA Bldg 23':{ recommended: 40, max: 55 },
  'GA Bldg 24':{ recommended: 40, max: 55 },
  'GA Bldg 25':{ recommended: 40, max: 55 },
  'MTC1':      { recommended: 32, max: 45 },
  'MTC2':      { recommended: 32, max: 45 },
  'IT101':     { recommended: 30, max: 40 },
  'NIT1':      { recommended: 40, max: 45 },
  'NIT3':      { recommended: 40, max: 45 },
};

// Class size data - editable via UI in future phases; loaded from defaults on first startup
const DEFAULT_CLASS_SIZES = {
  IT1B1: { year: '1st Year', block: 'B1', size: 54 },
  IT1B2: { year: '1st Year', block: 'B2', size: 54 },
  IT2B1: { year: '2nd Year', block: 'B1', size: 45 },
  IT2B2: { year: '2nd Year', block: 'B2', size: 39 },
  IT3B1: { year: '3rd Year', block: 'B1', size: 34 },
  IT3B2: { year: '3rd Year', block: 'B2', size: 32 },
  IT3B3: { year: '3rd Year', block: 'B3', size: 32 },
  IT4B1: { year: '4th Year', block: 'B1', size: 33 },
  IT4B2: { year: '4th Year', block: 'B2', size: 32 },
  IT4B3: { year: '4th Year', block: 'B3', size: 32 },
};

const INITIAL_FACULTY = [
  { name: 'Prof A',  specialization: ['Networks & Security'],    max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof B',  specialization: ['Systems'],                max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof C',  specialization: ['Programming'],            max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof D',  specialization: ['Mathematics'],            max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof E',  specialization: ['Networks & Security'],    max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof F',  specialization: ['Web & App Dev'],          max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof G',  specialization: ['Systems'],                max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof H',  specialization: ['Data Management'],        max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof I',  specialization: ['Applied Computing'],      max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof J',  specialization: ['Data Management'],        max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] }
];

const DEFAULT_SUBJECTS = [
  { name: 'Introduction to Computing',                           type: 'Core Theory',       year: '1st Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Computer Programming 1',                             type: 'Programming',        year: '1st Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Discrete Mathematics',                               type: 'Mathematics',        year: '1st Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Introduction to Human Computer Interaction',         type: 'Applied Computing',  year: '1st Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Computer Programming 2',                             type: 'Programming',        year: '1st Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Graphics and Visual Computing',                      type: 'Applied Computing',  year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Data Structures and Algorithms',                     type: 'Programming',        year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'IT Elective 1',                                      type: 'Elective',           year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'IT Elective 2',                                      type: 'Elective',           year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 0 },
  { name: 'Mathematics for Data Science',                       type: 'Mathematics',        year: '2nd Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Information Management 1',                           type: 'Data Management',    year: '2nd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Quantitative Methods w/ Modelling and Simulation',   type: 'Mathematics',        year: '2nd Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Network Technologies 1',                             type: 'Networks & Security',year: '2nd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Integrative Programming Technologies 1',             type: 'Programming',        year: '2nd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Systems Integration and Architecture 1',             type: 'Systems',            year: '2nd Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Advanced Database Systems',                          type: 'Data Management',    year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Network Technologies 2',                             type: 'Networks & Security',year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Information Assurance and Security 1',               type: 'Networks & Security',year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 0 },
  { name: 'Web Systems and Technologies 1',                     type: 'Web & App Dev',      year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Multimedia Systems',                                 type: 'Applied Computing',  year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'IT Elective 3',                                      type: 'Elective',           year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 0 },
  { name: 'Application Development and Emerging Technologies 1',type: 'Web & App Dev',      year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Geographic Information System',                      type: 'Applied Computing',  year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Embedded System',                                    type: 'Applied Computing',  year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Information Assurance and Security 2',               type: 'Networks & Security',year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 0 },
  { name: 'Capstone Project and Research 1',                    type: 'Research & Capstone',year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 0 },
  { name: 'Systems Administration and Maintenance',             type: 'Systems',            year: '4th Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Capstone Project and Research 2',                    type: 'Research & Capstone',year: '4th Year', semester: '1st Semester', lec_units: 2, lab_units: 0 },
  { name: 'IT Elective 4',                                      type: 'Elective',           year: '4th Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Educational Tour in IT Industry',                    type: 'Industry Practice',  year: '4th Year', semester: '1st Semester', lec_units: 3, lab_units: 0 },
  { name: 'Thesis Writing and Colloquium',                      type: 'Research & Capstone',year: '4th Year', semester: '2nd Semester', lec_units: 2, lab_units: 0 },
  { name: 'Practicum (486 Hours)',                              type: 'Industry Practice',  year: '4th Year', semester: '2nd Semester', lec_units: 6, lab_units: 0 },
];

// Table sort state
let lastSort = { key: 'slot', ascending: true };

// Last known GA result for re-rendering
let lastGAResult = [];

/* ============================================================
   SECTION LABEL UTILITY
   Maps year field to section keys e.g. "1st Year" → ["IT1B1","IT1B2"]
   ============================================================ */
function getSectionLabelsForYear(year) {
  const sizes = getClassSizes();
  const labels = Object.entries(sizes)
    .filter(([, v]) => v.year === year)
    .map(([k]) => k)
    .sort();
  return labels;
}

function getSectionBadgeHTML(year) {
  if (!year) return '';
  const labels = getSectionLabelsForYear(year);
  if (!labels.length) return '';
  return labels.map(l =>
    `<span class="section-badge">${escapeHTML(l)}</span>`
  ).join('');
}

/* ============================================================
   2. CHART INSTANCES
   ============================================================ */
let dashboardChart = null;
let reportsChart    = null;
let reportsBarChart = null;
let miniDashChart   = null;

function initCharts() {
  // Dashboard bar chart
  const ctxDash = document.getElementById('dashboardChart');
  if (ctxDash) {
    dashboardChart = new Chart(ctxDash, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Units per Faculty', data: [], backgroundColor: [] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              generateLabels: () => [
                { text: 'Normal',         fillStyle: '#88E788' },
                { text: 'Max Load',       fillStyle: '#FF6700' },
                { text: 'Over/Under Load',fillStyle: '#FF0000' }
              ]
            },
            onClick: (e, legendItem, legend) => {
              const selColor = legendItem.fillStyle;
              const chart = legend.chart;
              const ds = chart.data.datasets[0];
              let combined = chart.data.labels.map((label, i) => ({
                label, value: ds.data[i], color: ds.backgroundColor[i]
              }));
              if (!chart.sortOrder) chart.sortOrder = 'asc';
              const orderMap = { '#88E788': 0, '#FF6700': 1, '#FF0000': 2 };
              combined.sort((a, b) => {
                if (a.color === selColor) return -1;
                if (b.color === selColor) return 1;
                return (orderMap[a.color] - orderMap[b.color]);
              });
              chart.data.labels = combined.map(d => d.label);
              ds.data = combined.map(d => d.value);
              ds.backgroundColor = combined.map(d => d.color);
              chart.update();
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.raw;
                const fmax = getFacultyMaxUnitsMap()[ctx.label] || MAX_UNITS;
                let status = v > fmax ? ' OVERLOAD' : v === fmax ? ' MAX LOAD' : v <= 2 ? ' TOO LOW' : '';
                return `${ctx.label}: ${v} units${status}`;
              }
            }
          }
        }
      }
    });
  }

  // Reports pie chart
  const ctxPie = document.getElementById('reportsChart');
  if (ctxPie) {
    reportsChart = new Chart(ctxPie, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ['#7ED6DF','#F0932B','#EB4D4B','#6AB04C','#BE2EDD',
                            '#22A6B3','#F9CA24','#BADC58','#E056FD','#FF7979',
                            '#badc58','#f9ca24','#6ab04c','#22a6b3']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.raw;
                const fmax = getFacultyMaxUnitsMap()[ctx.label] || MAX_UNITS;
                const status = v > fmax ? ' (OVERLOAD)' : v === fmax ? ' (MAX LOAD)' : '';
                return `${ctx.label}: ${v} units${status}`;
              }
            }
          }
        }
      }
    });
  }

  // Reports bar chart
  const ctxBar = document.getElementById('reportsBarChart');
  if (ctxBar) {
    reportsBarChart = new Chart(ctxBar, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Total Teaching Units', data: [], backgroundColor: [] }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, y: { ticks: { autoSkip: false } } }
      }
    });
  }

  // Mini live chart
  const ctxMini = document.getElementById('miniDashChart');
  if (ctxMini) {
    miniDashChart = new Chart(ctxMini, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Load', data: [], backgroundColor: [] }] },
      options: {
        responsive: false,
        animation: { duration: 150 },
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 35, grid: { display: false } }, x: { grid: { display: false }, ticks: { font: { size: 8 } } } }
      }
    });
  }
}

/* ============================================================
   3. PANEL NAVIGATION
   ============================================================ */
let currentPanel = 0;

function initNavigation() {
  const panels   = document.querySelectorAll('.panel');
  const navItems = document.querySelectorAll('.nav-item[data-panel]');

  if (!panels.length) return;

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.panel, 10);
      switchPanel(idx);
    });
  });

  // Switch to panel 0 on load
  switchPanel(0);

  // Resize chart on window resize
  window.addEventListener('resize', debounce(() => {
    if (dashboardChart) dashboardChart.resize();
  }, 200));
}

function switchPanel(index) {
  const panels    = document.querySelectorAll('.panel');
  const navItems  = document.querySelectorAll('.nav-item[data-panel]');

  panels.forEach((p, i) => p.classList.toggle('active', i === index));
  navItems.forEach((item, i) => item.classList.toggle('active', i === index));
  currentPanel = index;

  // Resize charts after panel is visible
  setTimeout(() => {
    if (dashboardChart) dashboardChart.resize();
    if (reportsChart)   reportsChart.resize();
    if (reportsBarChart) reportsBarChart.resize();
  }, 50);
}

/* ============================================================
   4. COLOR HELPERS
   ============================================================ */
function getLoadColor(value, max = MAX_UNITS) {
  if (value > max) return '#FF0000';
  if (value === max) return '#FF6700';
  if (value <= 2) return '#FF0000';
  return '#88E788';
}

function getProgressColor(percent) {
  if (percent <= 50) {
    return `rgb(255, ${Math.floor(255 * (percent / 50))}, 0)`;
  }
  return `rgb(${Math.floor(255 * ((100 - percent) / 50))}, 255, 0)`;
}

/* ============================================================
   5. CHART UPDATE FUNCTIONS
   ============================================================ */
function updateCharts(data) {
  if (!data || !data.length) return;

  const upa = getUnitsPerAssignment();
  const facMaxMap = getFacultyMaxUnitsMap();

  const counts = {};
  data.forEach(item => {
    if (!item.faculty) return;
    counts[item.faculty] = (counts[item.faculty] || 0) + upa;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(x => x[0]);
  const values = sorted.map(x => x[1]);
  const colors = values.map((v, i) => getLoadColor(v, facMaxMap[labels[i]] || MAX_UNITS));

  if (dashboardChart) {
    dashboardChart.data.labels = labels;
    dashboardChart.data.datasets[0].data = values;
    dashboardChart.data.datasets[0].backgroundColor = colors;
    dashboardChart.update();
  }
  if (miniDashChart) {
    miniDashChart.data.labels = labels;
    miniDashChart.data.datasets[0].data = values;
    miniDashChart.data.datasets[0].backgroundColor = colors;
    miniDashChart.update();
  }
  if (reportsChart) {
    reportsChart.data.labels = labels;
    reportsChart.data.datasets[0].data = values;
    reportsChart.update();
  }
  if (reportsBarChart) {
    reportsBarChart.data.labels = labels;
    reportsBarChart.data.datasets[0].data = values;
    reportsBarChart.data.datasets[0].backgroundColor = colors;
    reportsBarChart.update();
  }

  updateDashboardStats(counts, facMaxMap);
}

/* ============================================================
   5b. DASHBOARD STAT CARDS
   ============================================================ */
function updateDashboardStats(counts, facMaxMap = {}) {
  const values = Object.values(counts);
  if (!values.length) return;
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const overloaded = Object.entries(counts).filter(([name, v]) => v > (facMaxMap[name] || MAX_UNITS)).length;
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const balance = maxV > 0 ? ((1 - (maxV - minV) / maxV) * 100).toFixed(0) : 100;
  const elAvg  = document.getElementById('statAvgLoad');
  const elOver = document.getElementById('statOverloaded');
  const elBal  = document.getElementById('statBalance');
  if (elAvg)  elAvg.textContent  = avg;
  if (elOver) elOver.textContent = overloaded;
  if (elBal)  elBal.textContent  = balance + '%';
}

/* ============================================================
   5b-2. CAPACITY METRICS DASHBOARD CARD
   ============================================================ */
function renderCapacityMetrics(capacityMetrics) {
  const card = document.getElementById('capacitySummaryCard');
  if (!card) return;

  card.style.display = '';

  if (!capacityMetrics) capacityMetrics = {};

  card.style.display = '';

  const total  = capacityMetrics.total_evaluated || 0;
  const okCnt  = capacityMetrics.within_recommended_count || 0;
  const warnCt = capacityMetrics.over_recommended_count   || 0;
  const hardCt = capacityMetrics.hard_violation_count     || 0;

  const pct = n => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '–';

  document.getElementById('capMetricTotal').textContent   = total;
  document.getElementById('capMetricOk').textContent      = okCnt;
  document.getElementById('capMetricOkPct').textContent   = pct(okCnt);
  document.getElementById('capMetricWarn').textContent    = warnCt;
  document.getElementById('capMetricWarnPct').textContent = pct(warnCt);
  document.getElementById('capMetricHard').textContent    = hardCt;
  document.getElementById('capMetricHardPct').textContent = pct(hardCt);

  // Populate persistent dashboard capacity stat row
  const dashRow = document.getElementById('dashCapStatsRow');
  if (dashRow) {
    const setD = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setD('dashCapOk',      okCnt);
    setD('dashCapOkPct',   pct(okCnt) + ' compliant');
    setD('dashCapWarn',    warnCt);
    setD('dashCapWarnPct', pct(warnCt) + ' of assignments');
    setD('dashCapHard',    hardCt);
    setD('dashCapHardPct', hardCt > 0 ? pct(hardCt) + ' of assignments' : 'none detected');
  }

  // Overall status badge
  const badge = document.getElementById('capacityOverallBadge');
  if (badge) {
    if (hardCt > 0) {
      badge.textContent = `${hardCt} Hard Violation${hardCt > 1 ? 's' : ''}`;
      badge.className = 'capacity-overall-badge badge-hard';
    } else if (warnCt > 0) {
      badge.textContent = `${warnCt} Over Recommended`;
      badge.className = 'capacity-overall-badge badge-warn';
    } else {
      badge.textContent = 'All Rooms Within Capacity';
      badge.className = 'capacity-overall-badge badge-ok';
    }
  }

  // Hard violations detail list
  const violList = document.getElementById('capacityHardViolationsList');
  const violItems = document.getElementById('capacityHardViolationsItems');
  const violations = capacityMetrics.hard_violations || [];
  if (violList && violItems) {
    if (violations.length > 0) {
      violList.style.display = '';
      violItems.innerHTML = violations.map(v => `
        <div class="capacity-violation-row">
          <span class="viol-room">${escapeHTML(v.room || '?')}</span>
          <span class="viol-detail">
            ${escapeHTML(v.subject || '')} · ${escapeHTML(v.section || '')}
            <span class="viol-counts">${v.student_count} students / max ${v.max_cap} (+${v.excess})</span>
          </span>
        </div>
      `).join('');
    } else {
      violList.style.display = 'none';
    }
  }
}

/* ============================================================
   5c. TIMETABLE RENDER
   ============================================================ */
function renderTimetable(data) {
  const container = document.getElementById('facultyTimetableContainer');
  if (!container) return;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SLOT_DEFS = [
    { label: '7–9',   startH: 7,  endH: 9  },
    { label: '9–11',  startH: 9,  endH: 11 },
    { label: '13–15', startH: 13, endH: 15 },
    { label: '15–17', startH: 15, endH: 17 },
    { label: '17–19', startH: 17, endH: 19 },
  ];

  // Build lookup keyed by "Day-startH-endH"
  const lookup = {};
  data.forEach(item => {
    const slot = item.slot || '';
    const dayMatch  = slot.match(/^(\w+):/);
    const timeMatch = slot.match(/(\d+):00-(\d+):00/);
    if (!dayMatch || !timeMatch) return;
    const day    = dayMatch[1].trim();
    const startH = parseInt(timeMatch[1], 10);
    const endH   = parseInt(timeMatch[2], 10);
    const key    = `${day}-${startH}-${endH}`;
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push({
      faculty:      item.faculty,
      subject:      item.subject,
      class_type:   item.class_type || 'LECTURE',
      room:         item.room || '',
      slot_display: item.slot_display || item.slot,
      section:      item.section || '',
      year:         item.year || ''
    });
  });

  let html = '<div class="timetable-scroll"><table class="timetable-grid"><thead><tr>';
  html += '<th class="tt-time-col">Time</th>';
  DAYS.forEach(d => { html += `<th class="tt-day-col tt-hd-${d}">${d}</th>`; });
  html += '</tr></thead><tbody>';

  SLOT_DEFS.forEach(({ label, startH, endH }) => {
    html += `<tr><td class="tt-time-label">${label}</td>`;
    DAYS.forEach(day => {
      const key     = `${day}-${startH}-${endH}`;
      const entries = lookup[key] || [];
      if (!entries.length) {
        html += `<td class="tt-cell tt-empty"></td>`;
      } else {
        html += `<td class="tt-cell tt-filled tt-bg-${day}">`;
        entries.forEach(e => {
          const ctClass = (e.class_type || 'LECTURE').toLowerCase();
          const secTag = e.section ? `<span class="tt-section-tag">${escapeHTML(e.section)}</span>` : '';
          html += `<div class="tt-entry">
            <span class="tt-class-tag ${ctClass}">${escapeHTML(e.class_type || 'LECTURE')}</span>
            ${secTag}
            <div class="tt-faculty-tag">${escapeHTML(e.faculty)}</div>
            <div class="tt-subject-tag">${escapeHTML(e.subject)}</div>
            ${e.room ? `<span class="tt-room-tag"> ${escapeHTML(e.room)}</span>` : ''}
          </div>`;
        });
        html += `</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/* ============================================================
   5d. REPORTS SUMMARY TABLE
   ============================================================ */
function updateReportsPanel(data) {
  if (!data || !data.length) return;

  const byFaculty = {};
  data.forEach(item => {
    if (!item.faculty) return;
    if (!byFaculty[item.faculty]) byFaculty[item.faculty] = [];
    byFaculty[item.faculty].push(item);
  });

  // Find the legacy table wrapper — we replace its parent or insert sibling
  const legacyTable = document.getElementById('reportsSummaryTable');
  if (!legacyTable) return;

  // Build or reuse the summary grid container
  let grid = document.getElementById('reportsSummaryGrid');
  if (!grid) {
    grid = document.createElement('div');
    grid.id = 'reportsSummaryGrid';
    grid.className = 'summary-faculty-grid';
    legacyTable.parentNode.insertBefore(grid, legacyTable);
    legacyTable.style.display = 'none'; // hide old table
  }
  grid.innerHTML = '';

  const sortedFaculty = Object.keys(byFaculty).sort();

  const upa = getUnitsPerAssignment();
  const facMaxMap = getFacultyMaxUnitsMap();

  sortedFaculty.forEach(faculty => {
    const assignments = byFaculty[faculty];
    const totalUnits  = assignments.length * upa;
    const fmax        = facMaxMap[faculty] || MAX_UNITS;
    const unitsCls    = totalUnits > fmax ? 'units-over' : totalUnits === fmax ? 'units-max' : 'units-ok';

    // Sort assignments: by day order then time
    const sorted = [...assignments].sort((a, b) => {
      const parseSlot = s => {
        const [d, t] = (s || '').split(':');
        return (DAY_ORDER[d.trim()] || 0) * 100 + parseInt(t || '0');
      };
      return parseSlot(a.slot) - parseSlot(b.slot);
    });

    const rowsHTML = sorted.map(item => {
      const day         = (item.slot || '').split(':')[0].trim();
      const displaySlot = item.slot_display || item.slot || '';
      const ctClass     = (item.class_type || 'LECTURE').toLowerCase();
      const sectionTag  = item.section
        ? `<span class="section-badge">${escapeHTML(item.section)}</span>`
        : (item.year ? `<span class="subject-year-badge">${escapeHTML(item.year.replace(' Year','Y'))}</span>` : '');
      const stuTag  = item.student_count > 0 ? `<span class="student-count-tag">${item.student_count}</span>` : '';
      const capBadge = buildCapacityBadge(item);

      return `
        <tr>
          <td><div class="summary-subj-name">${escapeHTML(item.subject)}</div></td>
          <td>
            <span class="class-type-tag ${ctClass}">${escapeHTML(item.class_type || 'LECTURE')}</span>
            ${sectionTag}
          </td>
          <td>${displaySlot ? `<span class="slot-badge slot-${escapeHTML(day)}">${escapeHTML(displaySlot)}</span>` : '<span class="text-muted">—</span>'}</td>
          <td>
            ${item.room ? `<span class="room-badge">${escapeHTML(item.room)}</span>` : '<span class="text-muted">—</span>'}
            ${stuTag}
            ${capBadge}
          </td>
        </tr>`;
    }).join('');

    const initials = faculty.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const card = document.createElement('div');
    card.className = 'summary-faculty-card';
    card.innerHTML = `
      <div class="summary-fac-header">
        <div class="summary-fac-avatar">${escapeHTML(initials)}</div>
        <div class="summary-fac-info">
          <div class="summary-fac-name">${escapeHTML(faculty)}</div>
          <div class="summary-fac-count">${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="summary-fac-actions">
          <span class="units-badge ${unitsCls}">${totalUnits} units</span>
          <button class="btn-edit-faculty btn" data-faculty="${escapeAttr(faculty)}">&#9998; Edit</button>
        </div>
      </div>
      <table class="summary-assignments-table">
        <colgroup>
          <col class="col-subject">
          <col class="col-type">
          <col class="col-schedule">
          <col class="col-room">
        </colgroup>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Type</th>
            <th>Schedule</th>
            <th>Room</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>`;

    grid.appendChild(card);
  });
}


const TYPE_SPEC_KEYWORDS = {
  'Core Theory':        ['core','theory','introduction','computing','fundamentals'],
  'Programming':        ['programming','software','algorithms','data structures','coding','development'],
  'Systems':            ['systems','architecture','integration','administration','maintenance'],
  'Data Management':    ['database','information management','data management','information systems'],
  'Networks & Security':['network','cybersecurity','information assurance','security'],
  'Applied Computing':  ['multimedia','gis','geographic','embedded','graphics','visual','hci','human-computer','applied'],
  'Mathematics':        ['mathematics','math','quantitative','modelling','simulation','data science'],
  'Web & App Dev':      ['web','application','emerging','app','technologies'],
  'Research & Capstone':['capstone','research','thesis','colloquium'],
  'Industry Practice':  ['practicum','tour','industry','practice'],
  'Elective':           []
};

function specMatchesType(specList, subjectType) {
  if (!subjectType || subjectType === 'Elective') return true;
  const keywords = TYPE_SPEC_KEYWORDS[subjectType] || [];
  if (!keywords.length) return true;
  return specList.some(sp => keywords.some(kw => sp.toLowerCase().includes(kw)) );
}

function computeFairnessReport(data) {
  if (!data || !data.length) return;

  // Build per-faculty load map
  const upa = getUnitsPerAssignment();
  const loadMap = {};
  data.forEach(item => {
    if (!item.faculty) return;
    loadMap[item.faculty] = (loadMap[item.faculty] || 0) + upa; // units per assignment (configurable)
  });

  const facultyData = getFacultyFromTable();
  const facMeta = {};
  facultyData.forEach(f => { facMeta[f.name] = f; });

  const totalAssigned = data.length;
  let matchedSpecs = 0;
  const perFaculty = {};

  // Initialize per-faculty trackers
  facultyData.forEach(f => {
    perFaculty[f.name] = { total: 0, matched: 0, load: loadMap[f.name] || 0 };
  });

  data.forEach(item => {
    if (!item.faculty || !perFaculty[item.faculty]) return;
    perFaculty[item.faculty].total++;
    
    const meta = facMeta[item.faculty];
    if (meta) {
      const isMatch = specMatchesType(meta.specialization, item.type);
      if (isMatch) {
        matchedSpecs++;
        perFaculty[item.faculty].matched++;
      }
    }
  });

  // 1. Match Rate
  const matchRate = totalAssigned ? (matchedSpecs / totalAssigned) * 100 : 0;

  // 2. Jain's Fairness Index & Std Dev
  const loads = facultyData.map(f => loadMap[f.name] || 0);
  const n = loads.length;
  let sumLoads = 0, sumSqLoads = 0;
  loads.forEach(l => { sumLoads += l; sumSqLoads += l * l; });

  const jain = (sumLoads * sumLoads) / (n * sumSqLoads || 1);
  const mean = sumLoads / (n || 1);
  let varianceSum = 0;
  loads.forEach(l => { varianceSum += Math.pow(l - mean, 2); });
  const stdDev = Math.sqrt(varianceSum / (n || 1));

  // Overall combined rating score (0 - 100%)
  const fairnessScore = Math.round((jain * 0.6 + (matchRate / 100) * 0.4) * 100);
  const scoreClass = fairnessScore >= 85 ? 'good' : fairnessScore >= 60 ? 'warning' : 'danger';
  const scoreLabel = fairnessScore >= 85 ? 'Excellent - Highly balanced' : fairnessScore >= 60 ? 'Moderate - minor imbalances' : 'Poor - significant imbalances';

  // Update summary cards
  const el = id => document.getElementById(id);
  el('fairnessScore').textContent = fairnessScore + '%';
  el('fairnessScore').className = 'fairness-card-value ' + scoreClass;
  el('fairnessScoreLabel').textContent = scoreLabel;
  el('fairnessJain').textContent = jain.toFixed(4);
  el('fairnessStdDev').textContent = stdDev.toFixed(2) + ' u';
  el('fairnessMatchRate').textContent = matchRate.toFixed(1) + '%';

  // Per-faculty table
  const container = document.getElementById('fairnessPerFaculty');
  if (!container) return;

  const rows = Object.keys(perFaculty).sort().map(name => {
    const d = perFaculty[name];
    const pct = d.total ? Math.round((d.matched / d.total) * 100) : 0;
    const cls = pct === 100 ? 'match-yes' : pct >= 50 ? 'match-partial' : 'match-no';
    const facMax = facMeta[name]?.max_units || MAX_UNITS;
    const loadCls = d.load > facMax ? 'badge-danger' : d.load === facMax ? 'badge-warning' : 'badge-success';

    return `
      <tr>
        <td><strong>${escapeHTML(name)}</strong></td>
        <td><span class="load-badge ${loadCls}">${d.load} / ${facMeta[name]?.max_units || 24} u</span></td>
        <td>${d.total} classes</td>
        <td><span class="match-indicator ${cls}">${pct}% match (${d.matched}/${d.total})</span></td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="data-table layout-fixed">
      <thead>
        <tr>
          <th>Faculty Member</th>
          <th>Workload Status</th>
          <th>Total Classes</th>
          <th>Specialization Accuracy</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('') || '<tr><td colspan="4" class="empty-state-msg">No faculty metrics computed yet.</td></tr>'}
      </tbody>
    </table>
  `;
}

/* ============================================================
   7. TABLE RENDERING & SORTING
   ============================================================ */
function renderTable(data) {
  const tbody = document.querySelector('#gaScheduleTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state-msg">No optimal assignments found. Adjust parameters and click "Run Engine".</td></tr>';
    return;
  }

  // Pre-sort by Day Order then Slot Order by default
  const sorted = [...data].sort((a, b) => {
    const parseSlot = s => {
      const [dayPart, timePart] = (s || '').split(':');
      return { day: dayPart.trim(), unit: parseInt((timePart || '0').trim()) };
    };
    const sA = parseSlot(a.slot), sB = parseSlot(b.slot);
    return (DAY_ORDER[sA.day] - DAY_ORDER[sB.day]) || (sA.unit - sB.unit);
  });

  // Apply current sort
  applySort(sorted, lastSort.key, lastSort.ascending);

  sorted.forEach(item => {
    const day = item.slot.split(':')[0].trim();
    const displaySlot = item.slot_display || item.slot;
    const tr = document.createElement('tr');
    tr.dataset.day = day;
    const sectionHTML = item.section
      ? `<span class="section-badge">${escapeHTML(item.section)}</span>`
      : (item.year ? getSectionBadgeHTML(item.year) : '<span class="text-muted">N/A</span>');
    tr.innerHTML = `
      <td>${escapeHTML(item.faculty)}</td>
      <td>${escapeHTML(item.subject)}</td>
      <td class="section-cell">${sectionHTML}</td>
      <td>${escapeHTML(item.type)}</td>
      <td><span class="class-type-tag ${(item.class_type||'LECTURE').toLowerCase()}">${escapeHTML(item.class_type || 'LECTURE')}</span></td>
      <td>${escapeHTML(displaySlot)}</td>
      <td>${item.room ? `<span class="room-badge"> ${escapeHTML(item.room)}</span>` : '<span class="text-muted">N/A</span>'}</td>
      <td>${item.student_count > 0 ? `<span class="student-count-tag">${item.student_count}</span>` : '<span class="text-muted">—</span>'}</td>
      <td>${buildCapacityBadge(item)}</td>
    `;
    tbody.appendChild(tr);
  });

  enableTableSort();
}

function applySort(data, key, ascending) {
  data.sort((a, b) => {
    const dir = ascending ? 1 : -1;
    if (key === 'slot') {
      const ps = s => {
        const [d, t] = s.split(':');
        return (DAY_ORDER[d.trim()] * 100) + parseInt(t || '0');
      };
      return (ps(a.slot) - ps(b.slot)) * dir;
    }
    return (a[key] || '').localeCompare(b[key] || '') * dir;
  });
}

function enableTableSort() {
  document.querySelectorAll('#gaScheduleTable th[data-key]').forEach(th => {
    // Clean old listeners
    const cloned = th.cloneNode(true);
    th.parentNode.replaceChild(cloned, th);

    // Active arrow indicator
    if (cloned.dataset.key === lastSort.key) {
      cloned.classList.add('sorted-active');
      cloned.classList.toggle('sorted-desc', !lastSort.ascending);
    } else {
      cloned.classList.remove('sorted-active', 'sorted-desc');
    }

    cloned.addEventListener('click', () => {
      if (lastSort.key === cloned.dataset.key) {
        lastSort.ascending = !lastSort.ascending;
      } else {
        lastSort.key = cloned.dataset.key;
        lastSort.ascending = true;
      }
      renderTable(lastGAResult);
    });
  });
}

/* ============================================================
   8. RUN GENETIC ALGORITHM ENGINE
   ============================================================ */
let progressInterval = null;
const progressFill = document.querySelector('#gaProgressBar .fill');

async function triggerGARunAPI() {
  const population  = document.getElementById('populationSize').value;
  const generations = document.getElementById('numGenerations').value;
  const mutation    = document.getElementById('mutationRate').value;
  const crossover   = document.getElementById('crossoverRate').value;

  const rawSubjects = getSubjectsFromTable();

  // Filter by active academic semester - strict: only matching semester subjects
  const mode = getActiveSemester();
  let filteredSubjects = rawSubjects;
  if (mode && mode.semester) {
    filteredSubjects = rawSubjects.filter(s => s.semester === mode.semester);
  }

  if (!filteredSubjects.length) {
    throw new Error(
      mode
        ? `No subjects found for ${mode.semester}. Add subjects tagged for this semester or change the active period.`
        : 'No subjects configured. Add subjects in the Faculty & Subjects panel.'
    );
  }

  const expandedSubjects = [];
  filteredSubjects.forEach(s => {
    if (s.lec_units > 0) {
      const lecCount = Math.ceil(s.lec_units / 2);
      for (let i = 0; i < lecCount; i++) {
        expandedSubjects.push({ name: s.name, type: s.type, class_type: 'LECTURE', hours: 2, semester: s.semester, year: s.year });
      }
    }
    if (s.lab_units > 0) {
      expandedSubjects.push({ name: s.name, type: s.type, class_type: 'LAB', hours: 3, semester: s.semester, year: s.year });
    }
  });

  if (!expandedSubjects.length) {
    throw new Error('No subjects with assigned units found for the selected semester.');
  }

  // Load soft constraints and include in payload for backend scoring
  const softConstraints = loadSoftConstraintsFromStorage();

  const sysCfg = getSystemSettings();

  const payload = {
    faculty:          getFacultyFromTable(),
    subjects:         expandedSubjects,
    population:       Number(population),
    generations:      Number(generations),
    mutation:         Number(mutation),
    crossover:        Number(crossover),
    soft_constraints: softConstraints,
    active_semester:  mode ? mode.semester : null,
    class_sizes:      getClassSizes(),
    room_capacity:    runtimeRoomCapacity,
    units_per_assignment: sysCfg.units_per_assignment,
    cp_sat_time_limit:    sysCfg.cp_sat_time_limit,
  };

  const response = await fetch(`${API_BASE}/run-ga`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.status) throw new Error('GA start failed');
}

function initRunGA() {
  const runBtn = document.getElementById('runGA');
  const loading = document.getElementById('gaLoading');
  const tableWrapper= document.getElementById('gaTableWrapper');
  const genCounter = document.getElementById('generationCounter');

  if (!runBtn) return;

  runBtn.addEventListener('click', async () => {
    const popSize = document.getElementById('populationSize').value;
    const generations= document.getElementById('numGenerations').value;
    const mutRate = document.getElementById('mutationRate').value;
    const crossover = document.getElementById('crossoverRate').value;

    loading.classList.remove('hidden');
    tableWrapper.classList.add('hidden');
    runBtn.disabled = true;
    if (progressFill) {
      progressFill.style.width = '0%';
    }

    try {
      await triggerGARunAPI();

      // Poll progress endpoint loop integration routine
      progressInterval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/progress`);
          const status = await res.json();

          if (status.total > 0) {
            const pct = Math.min(100, Math.round((status.current / status.total) * 100));
            if (progressFill) {
              progressFill.style.width = pct + '%';
              progressFill.style.backgroundColor = getProgressColor(pct);
            }
            if (genCounter) {
              const phaseLabel = status.phase === 'cp_sat' ? 'CP-SAT Solving'
                : status.phase === 'ga' ? 'GA Optimizing'
                : status.phase === 'analytics' ? 'Computing Analytics'
                : 'Processing';
              genCounter.textContent = `${phaseLabel}: ${pct}%`;
            }
          }

          if (!status.running) {
            clearInterval(progressInterval);
            loading.classList.add('hidden');
            tableWrapper.classList.remove('hidden');
            runBtn.disabled = false;

            lastGAResult = status.result || [];
            if (status.analytics && status.analytics.capacity_metrics) {
              mergeCapacityStatuses(status.analytics);
            }
            const displayResult = filterResultBySemester(lastGAResult);
            renderTable(displayResult);
            updateCharts(displayResult);
            computeFairnessReport(displayResult);
            renderDashboardAssignments(displayResult);
            renderTimetable(displayResult);
            updateReportsPanel(displayResult);
            renderSubjectsGrouped();

            // Store analytics from backend if available
            if (status.analytics && Object.keys(status.analytics).length > 0) {
              try {
                window.__atlasAnalytics = status.analytics;
                renderCapacityMetrics(resolveCapacityMetrics(status.analytics));
                renderCapacityAnalytics(status.analytics);
                localStorage.setItem('atlasAnalyticsCache', JSON.stringify(status.analytics));
              } catch(e) { console.warn('Analytics render error:', e); }
            }
            // Display backend warnings
            if (status.warnings && status.warnings.length > 0) {
              status.warnings.forEach(w => console.warn('[ATLAS]', w));
            }

            try { localStorage.setItem('lastGAResult', JSON.stringify(lastGAResult)); } catch(e) {}
            const metricsSuffix = status.metrics && status.metrics.solve_time_sec
              ? ` (CP-SAT: ${status.metrics.solve_time_sec}s, GA: ${status.metrics.ga_time_sec || 0}s)`
              : '';
            showToast('Optimization Complete!' + metricsSuffix, 'success');
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 400);

    } catch (e) {
      clearInterval(progressInterval);
      loading.classList.add('hidden');
      runBtn.disabled = false;
      alert('Failed to connect to backend engine: ' + e.message);
    }
  });
}

/* ============================================================
   9. FACULTY MANAGEMENT SYSTEM
   ============================================================ */
function addFacultyRow(data = {}) {
  const tbody = document.querySelector('#facultyTable tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');

  const nameValue     = data.name || '';
  const specsSelected = data.specialization || [];
  const maxUnits      = data.max_units !== undefined ? data.max_units : getSystemSettings().max_units;
  const overloadBuffer = data.overload_buffer !== undefined ? data.overload_buffer : 6;
  // Availability is stored and sent to the backend as short names (Mon, Tue, Wed, Thu, Fri, Sat)
  // matching DAYS in app.py. Normalize any legacy long-name values on load.
  const DAY_LONG_TO_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat' };
  const rawAvail = data.availability || ['Mon','Tue','Wed','Thu','Fri','Sat'];
  const daysSelected = rawAvail.map(d => DAY_LONG_TO_SHORT[d] || d);

  const checkboxHTML = SPECIALIZATIONS.map(spec => `
    <label>
      <input type="checkbox" value="${escapeAttr(spec)}" ${specsSelected.includes(spec) ? 'checked' : ''}>
      ${escapeHTML(spec)}
    </label>
  `).join('');

  // Checkbox value is the short name (Mon/Tue/…) - this is what getFacultyFromTable
  // reads and what app.py expects in the availability array.
  const daysHTML = Object.entries(DAY_MAP).map(([short, long]) => `
    <label>
      <input type="checkbox" value="${short}" ${daysSelected.includes(short) ? 'checked' : ''}>${short}
    </label>
  `).join('');

  const displayText = specsSelected.length ? specsSelected.join(', ') : 'Choose Specialization';

  tr.innerHTML = `
    <td><input type="text" placeholder="Enter Name" value="${escapeAttr(nameValue)}"></td>
    <td>
      <div class="multi-select-dropdown">
        <div class="dropdown-btn" title="${escapeAttr(displayText)}">${escapeHTML(displayText.length > 45 ? displayText.substring(0, 45) + '...' : displayText)}</div>
        <div class="dropdown-content">
          ${checkboxHTML}
          <button type="button" class="dropdown-ok-btn btn">OK</button>
        </div>
      </div>
    </td>
    <td><input type="number" value="${maxUnits}" min="0" max="50" title="Max Units"></td>
    <td><input type="number" value="${overloadBuffer}" min="0" max="20" title="Overload Buffer (added to Max Units for absolute hard cap)"></td>
    <td><div class="avail-checkboxes">${daysHTML}</div></td>
    <td><button type="button" class="btn-delete row-action-btn" title="Delete Row">Delete</button></td>
  `;

  // Bind dropdown toggle action handler listener sequence hook event context capture bubble logic
  const btn = tr.querySelector('.dropdown-btn');
  const dropdown = tr.querySelector('.multi-select-dropdown');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.contains('open');
    document.querySelectorAll('.multi-select-dropdown.open').forEach(d => d.classList.remove('open'));
    if (!open) {
      dropdown.classList.add('open');
      repositionDropdown(dropdown);
    }
  });

  // Bind OK button handler loop cycle tracking event trigger layer
  tr.querySelector('.dropdown-ok-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.remove('open');
    updateDropdownLabel(dropdown);
    saveFaculty();
  });

  // Checkbox change tracker hooks
  dropdown.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
      updateDropdownLabel(dropdown);
      saveFaculty();
    });
  });

  // Input fields change auto save triggers
  tr.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
    input.addEventListener('input', debounce(saveFaculty, 500));
  });

  tr.querySelectorAll('.avail-checkboxes input').forEach(chk => {
    chk.addEventListener('change', () => {
      saveFaculty();
      updateAllSelectAllBtnStates();
    });
  });

  // Row delete handler action integration layer
  tr.querySelector('.btn-delete').addEventListener('click', () => {
    tr.remove();
    saveFaculty();
    updateAllSelectAllBtnStates();
  });

  tbody.appendChild(tr);
}

function updateDropdownLabel(dropdown) {
  const checked = Array.from(dropdown.querySelectorAll('.dropdown-content input:checked')).map(c => c.value);
  const btn = dropdown.querySelector('.dropdown-btn');
  const txt = checked.length ? checked.join(', ') : 'Choose Specialization';
  btn.textContent = txt.length > 45 ? txt.substring(0, 45) + '...' : txt;
  btn.title = txt;
}

function repositionDropdown(dropdown) {
  const content = dropdown.querySelector('.dropdown-content');
  const rect = dropdown.getBoundingClientRect();
  
  content.style.position = 'fixed';
  content.style.top = (rect.bottom + window.scrollY) + 'px';
  content.style.left = (rect.left + window.scrollX) + 'px';
  content.style.width = rect.width + 'px';
  content.style.zIndex = '9999';
}

function selectAllByDay(dayShort) {
  // Checkboxes now use short names as values (Mon, Tue, …) - query directly by dayShort.
  const checkboxes = document.querySelectorAll(`#facultyTable tbody .avail-checkboxes input[value="${dayShort}"]`);
  if (!checkboxes.length) return;

  const allChecked = Array.from(checkboxes).every(c => c.checked);
  checkboxes.forEach(c => { c.checked = !allChecked; });

  saveFaculty();
  updateAllSelectAllBtnStates();
}

function updateAllSelectAllBtnStates() {
  Object.entries(DAY_MAP).forEach(([short, long]) => {
    const btn = document.querySelector(`.btn-select-day[data-day="${short}"]`);
    if (!btn) return;

    // Checkboxes use short names as values - query by short name.
    const checkboxes = document.querySelectorAll(`#facultyTable tbody .avail-checkboxes input[value="${short}"]`);
    if (!checkboxes.length) {
      btn.classList.remove('active');
      return;
    }

    const allChecked = Array.from(checkboxes).every(c => c.checked);
    btn.classList.toggle('active', allChecked);
  });
}

function getFacultyFromTable() {
  return Array.from(document.querySelectorAll('#facultyTable tbody tr')).map(row => {
    const name = row.querySelector('input[type="text"]').value.trim();
    const specs = Array.from(row.querySelectorAll('.dropdown-content input:checked')).map(c => c.value);
    const numInputs = row.querySelectorAll('input[type="number"]');
    const maxUnits = parseInt(numInputs[0]?.value, 10) || 24;
    const overloadBuffer = parseInt(numInputs[1]?.value, 10) || 6;
    const avail = Array.from(row.querySelectorAll('.avail-checkboxes input:checked')).map(c => c.value);

    return {
      name,
      specialization: specs,
      max_units: maxUnits,
      overload_buffer: overloadBuffer,
      absolute_max_units: maxUnits + overloadBuffer,
      availability: avail
    };
  }).filter(f => f.name);
}

function saveFaculty() {
  try {
    localStorage.setItem('facultyData', JSON.stringify(getFacultyFromTable()));
    updateAllSelectAllBtnStates();
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function loadFacultyFromStorage() {
  try {
    const data = localStorage.getItem('facultyData');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function initEditFacultyModal() {
  const modal       = document.getElementById('editModal');
  const closeBtn    = document.getElementById('editModalClose');
  const cancelBtn   = document.getElementById('editModalCancel');
  const saveBtn     = document.getElementById('editModalSave');
  const nameInput   = document.getElementById('editFacultyName');
  const unitsInput  = document.getElementById('editMaxUnits');
  const titleEl     = document.getElementById('editModalTitle');
  if (!modal) return;

  // ── Build the expanded modal body once ──────────────────────────────
  const existingBody = modal.querySelector('.modal-body');
  if (existingBody && !existingBody.querySelector('.modal-section-label')) {
    // Append assignment editor below the units field
    existingBody.insertAdjacentHTML('beforeend', `
      <hr class="modal-section-divider">
      <div class="modal-section-label">Assigned Subjects, Times &amp; Rooms</div>
      <div id="editAssignmentList" class="modal-assignment-list"></div>
      <button type="button" id="editAddAssignment" class="modal-add-assignment-btn">
        <span style="font-size:1.1em;">+</span> Add Assignment
      </button>
    `);
  }

  const TIME_SLOTS = [
    'Mon: 7:00-9:00',   'Mon: 9:00-11:00',
    'Mon: 13:00-15:00', 'Mon: 15:00-17:00',   'Mon: 17:00-19:00',
    'Tue: 7:00-9:00',   'Tue: 9:00-11:00',
    'Tue: 13:00-15:00', 'Tue: 15:00-17:00',   'Tue: 17:00-19:00',
    'Wed: 7:00-9:00',   'Wed: 9:00-11:00',
    'Wed: 13:00-15:00', 'Wed: 15:00-17:00',   'Wed: 17:00-19:00',
    'Thu: 7:00-9:00',   'Thu: 9:00-11:00',
    'Thu: 13:00-15:00', 'Thu: 15:00-17:00',   'Thu: 17:00-19:00',
    'Fri: 7:00-9:00',   'Fri: 9:00-11:00',
    'Fri: 13:00-15:00', 'Fri: 15:00-17:00',   'Fri: 17:00-19:00',
    'Sat: 7:00-9:00',   'Sat: 9:00-11:00',
    'Sat: 13:00-15:00', 'Sat: 15:00-17:00',   'Sat: 17:00-19:00',
  ];

  function buildSlotOptions(selected) {
    return TIME_SLOTS.map(s =>
      `<option value="${escapeAttr(s)}" ${selected === s ? 'selected' : ''}>${escapeHTML(s)}</option>`
    ).join('');
  }

  function buildRoomOptions(selected) {
    const rooms = [...runtimeLectureRooms, ...runtimeLabRooms];
    const opts = rooms.map(r =>
      `<option value="${escapeAttr(r)}" ${selected === r ? 'selected' : ''}>${escapeHTML(r)}</option>`
    ).join('');
    return `<option value="">— Room —</option>${opts}`;
  }

  function buildSubjectOptions(selected) {
    const subjects = getSubjectsFromTable().filter(s => s.name);
    const opts = subjects.map(s =>
      `<option value="${escapeAttr(s.name)}" ${selected === s.name ? 'selected' : ''}>${escapeHTML(s.name)}</option>`
    ).join('');
    return `<option value="">— Subject —</option>${opts}`;
  }

  function addAssignmentRow(item = {}) {
    const list = document.getElementById('editAssignmentList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'modal-assign-row';
    row.innerHTML = `
      <select class="edit-assign-subject">${buildSubjectOptions(item.subject || '')}</select>
      <select class="edit-assign-slot">${buildSlotOptions(item.slot || '')}</select>
      <select class="edit-assign-room">${buildRoomOptions(item.room || '')}</select>
      <button type="button" class="modal-assign-delete" title="Remove">&times;</button>
    `;
    row.querySelector('.modal-assign-delete').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  function openModal(facultyName) {
    const rows = Array.from(document.querySelectorAll('#facultyTable tbody tr'));
    const row  = rows.find(r => r.querySelector('input[type="text"]')?.value.trim() === facultyName);
    const currentUnits = row ? (parseInt(row.querySelector('input[type="number"]')?.value, 10) || 24) : 24;

    nameInput.value  = facultyName;
    unitsInput.value = currentUnits;
    if (titleEl) titleEl.textContent = `Edit: ${facultyName}`;

    // Populate assignment list from lastGAResult
    const list = document.getElementById('editAssignmentList');
    if (list) {
      list.innerHTML = '';
      const assignments = lastGAResult.filter(item => item.faculty === facultyName);
      assignments.forEach(item => addAssignmentRow(item));
    }

    modal.classList.add('open');
    modal.removeAttribute('aria-hidden');
    unitsInput.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Delegate: reports table Edit button
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-edit-faculty');
    if (!btn) return;
    e.stopPropagation();
    openModal(btn.dataset.faculty);
  });

  document.getElementById('editAddAssignment')?.addEventListener('click', () => addAssignmentRow());

  if (closeBtn)  closeBtn.addEventListener('click',  closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const name     = nameInput.value.trim();
      const newUnits = parseInt(unitsInput.value, 10);
      if (!name || isNaN(newUnits) || newUnits < 0) return;

      // 1. Update max units in faculty table
      const rows = Array.from(document.querySelectorAll('#facultyTable tbody tr'));
      const row  = rows.find(r => r.querySelector('input[type="text"]')?.value.trim() === name);
      if (row) {
        const numInput = row.querySelector('input[type="number"]');
        if (numInput) { numInput.value = newUnits; saveFaculty(); }
      }

      // 2. Apply edited assignments back to lastGAResult
      const assignRows = document.querySelectorAll('#editAssignmentList .modal-assign-row');
      if (assignRows.length) {
        // Remove all current assignments for this faculty
        lastGAResult = lastGAResult.filter(item => item.faculty !== name);

        // Add updated ones
        assignRows.forEach(r => {
          const subject = r.querySelector('.edit-assign-subject')?.value || '';
          const slot    = r.querySelector('.edit-assign-slot')?.value   || '';
          const room    = r.querySelector('.edit-assign-room')?.value   || '';
          if (!subject || !slot) return;

          // Find original item data to preserve type/section/year/class_type
          const subjectData = getSubjectsFromTable().find(s => s.name === subject) || {};
          const daySlotMatch = slot.match(/^(\w+):\s*(\d+):00-(\d+):00/);
          const slotDisplay = daySlotMatch
            ? `${DAY_MAP[daySlotMatch[1]] || daySlotMatch[1]}: ${
                parseInt(daySlotMatch[2]) >= 12
                  ? `${parseInt(daySlotMatch[2]) - 12 || 12}:00 PM`
                  : `${parseInt(daySlotMatch[2])}:00 AM`
              } – ${
                parseInt(daySlotMatch[3]) >= 12
                  ? `${parseInt(daySlotMatch[3]) - 12 || 12}:00 PM`
                  : `${parseInt(daySlotMatch[3])}:00 AM`
              }`
            : slot;

          lastGAResult.push({
            faculty:      name,
            subject,
            slot,
            slot_display: slotDisplay,
            room,
            type:         subjectData.type || '',
            year:         subjectData.year || '',
            semester:     subjectData.semester || '',
            class_type:   room && LABORATORY_ROOMS.includes(room) ? 'LAB' : 'LECTURE',
            section:      ''
          });
        });

        // Re-render all panels
        try { localStorage.setItem('lastGAResult', JSON.stringify(lastGAResult)); } catch(e) {}
        const displayResult = filterResultBySemester(lastGAResult);
        renderTable(displayResult);
        updateCharts(displayResult);
        computeFairnessReport(displayResult);
        renderDashboardAssignments(displayResult);
        renderTimetable(displayResult);
        updateReportsPanel(displayResult);
      }

      closeModal();
      showToast(`${name} — updated successfully.`, 'success');
    });
  }
}

function initFacultyManagement() {
  const addBtn = document.getElementById('addFacultyRow');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addFacultyRow();
      saveFaculty();
      updateAllSelectAllBtnStates();
    });
  }
  initEditFacultyModal();

  // Bind Select-All-Day buttons in the Availability header
  document.querySelectorAll('.btn-select-day').forEach(btn => {
    btn.addEventListener('click', () => {
      selectAllByDay(btn.dataset.day);
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.multi-select-dropdown')) {
      document.querySelectorAll('.multi-select-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });

  // Reposition on scroll/resize - keeps fixed dropdown aligned with button
  const reposition = () => {
    document.querySelectorAll('.multi-select-dropdown.open').forEach(repositionDropdown);
  };
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
}

/* ============================================================
   10. SUBJECTS MANAGEMENT SYSTEM
   ============================================================ */
function addSubjectRow(data = {}) {
  const tbody = document.querySelector('#subjectsTable tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');

  const year     = data.year || '1st Year';
  const semester = data.semester || '1st Semester';
  const name     = data.name || '';
  const type     = data.type || 'Core Theory';
  const lec      = data.lec_units !== undefined ? data.lec_units : 2;
  const lab      = data.lab_units !== undefined ? data.lab_units : 1;

  tr.innerHTML = `
    <td>
      <select class="subject-year">
        <option ${year==='1st Year'?'selected':''}>1st Year</option>
        <option ${year==='2nd Year'?'selected':''}>2nd Year</option>
        <option ${year==='3rd Year'?'selected':''}>3rd Year</option>
        <option ${year==='4th Year'?'selected':''}>4th Year</option>
      </select>
    </td>
    <td>
      <select class="subject-semester">
        <option ${semester==='1st Semester'?'selected':''}>1st Semester</option>
        <option ${semester==='2nd Semester'?'selected':''}>2nd Semester</option>
        <option ${semester==='Summer'?'selected':''}>Summer</option>
      </select>
    </td>
    <td><input type="text" class="subject-name" placeholder="Subject Title" value="${escapeAttr(name)}"></td>
    <td>
      <select class="subject-type">
        <option ${type==='Core Theory'?'selected':''}>Core Theory</option>
        <option ${type==='Programming'?'selected':''}>Programming</option>
        <option ${type==='Systems'?'selected':''}>Systems</option>
        <option ${type==='Data Management'?'selected':''}>Data Management</option>
        <option ${type==='Networks & Security'?'selected':''}>Networks & Security</option>
        <option ${type==='Applied Computing'?'selected':''}>Applied Computing</option>
        <option ${type==='Mathematics'?'selected':''}>Mathematics</option>
        <option ${type==='Web & App Dev'?'selected':''}>Web & App Dev</option>
        <option ${type==='Research & Capstone'?'selected':''}>Research & Capstone</option>
        <option ${type==='Industry Practice'?'selected':''}>Industry Practice</option>
        <option ${type==='Elective'?'selected':''}>Elective</option>
      </select>
    </td>
    <td><input type="number" class="unit-input lec" value="${lec}" min="0" max="10"></td>
    <td><input type="number" class="unit-input lab" value="${lab}" min="0" max="10"></td>
    <td class="total-cell txt-center">${lec + lab}</td>
    <td><button type="button" class="btn-delete row-action-btn" title="Delete Row">Delete</button></td>
  `;

  // Dynamic change tracker loops listeners attachments
  const updateTotal = () => {
    const l = parseInt(tr.querySelector('.lec')?.value || 0);
    const b = parseInt(tr.querySelector('.lab')?.value || 0);
    const tc = tr.querySelector('.total-cell');
    if (tc) tc.textContent = l + b;
  };
  tr.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', () => { saveSubjects(); updateTotal(); });
    if(el.tagName === 'INPUT') {
      el.addEventListener('input', debounce(() => { saveSubjects(); updateTotal(); }, 500));
    }
  });

  tr.querySelector('.btn-delete').addEventListener('click', () => {
    tr.remove();
    saveSubjects();
  });

  tbody.appendChild(tr);
}

function getSubjectsFromTable() {
  return Array.from(document.querySelectorAll('#subjectsTable tbody tr')).map(row => ({
    year:     row.querySelector('.subject-year')?.value || '',
    semester: row.querySelector('.subject-semester')?.value || '',
    name:     row.querySelector('.subject-name')?.value || '',
    type:     row.querySelector('.subject-type')?.value || '',
    lec_units:Number(row.querySelector('.lec')?.value || 0),
    lab_units:Number(row.querySelector('.lab')?.value || 0),
    hours:    (Number(row.querySelector('.lec')?.value || 0)) + (Number(row.querySelector('.lab')?.value || 0) * 3)
  }));
}

function saveSubjects() {
  try {
    localStorage.setItem('subjectsData', JSON.stringify(getSubjectsFromTable()));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function loadSubjectsFromStorage() {
  try {
    const data = localStorage.getItem('subjectsData');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function renderSubjectsGrouped() {
  const container = document.getElementById('subjectsContainer');
  if (!container) return;

  const subjects = getSubjectsFromTable().filter(s => s.name);
  const grouped = {};

  subjects.forEach(s => {
    const key = `${s.year} - ${s.semester}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  if (!Object.keys(grouped).length) {
    container.innerHTML = '<p class="empty-state-msg">No subjects configured yet.</p>';
    return;
  }

  let html = '<div class="curriculum-summary-wrap">';
  Object.keys(grouped).sort().forEach(key => {
    html += `
      <div class="curriculum-group">
        <div class="curriculum-header">${escapeHTML(key)}</div>
        <table class="curriculum-table">
          <thead>
            <tr>
              <th>Subject Name</th>
              <th>Type</th>
              <th class="txt-center">Lec</th>
              <th class="txt-center">Lab</th>
              <th class="txt-center">Hours</th>
            </tr>
          </thead>
          <tbody>
            ${grouped[key].map(s => `
              <tr>
                <td><strong>${escapeHTML(s.name)}</strong></td>
                <td><span class="type-tag ${s.type.toLowerCase().replace(/[\s&\/]+/g,'-')}">${escapeHTML(s.type)}</span></td>
                <td class="txt-center">${s.lec_units}</td>
                <td class="txt-center">${s.lab_units}</td>
                <td class="txt-center font-mono">${s.hours}h</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function initSubjectsManagement() {
  const addBtn = document.getElementById('addSubjectRow');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addSubjectRow();
      saveSubjects();
    });
  }
}

/* ============================================================
   11. DASHBOARD OVERVIEW ASSIGNMENT STREAM
   ============================================================ */
function renderDashboardAssignments(data) {
  const container = document.getElementById('dashboardFacultyAssignments');
  if (!container) return;

  const byFaculty = {};
  data.forEach(item => {
    if (!item.faculty) return;
    if (!byFaculty[item.faculty]) byFaculty[item.faculty] = [];
    byFaculty[item.faculty].push(item);
  });

  if (!Object.keys(byFaculty).length) {
    container.innerHTML = '<p class="empty-state-msg">No assignments to display.</p>';
    return;
  }

  const upa = getUnitsPerAssignment();
  const facMaxMap = getFacultyMaxUnitsMap();

  let html = '<div class="fac-assign-grid">';
  Object.keys(byFaculty).sort().forEach(faculty => {
    const items = byFaculty[faculty];
    const units = items.length * upa;
    const fmax  = facMaxMap[faculty] || MAX_UNITS;
    const colorClass = units > fmax ? 'units-over' : units === fmax ? 'units-max' : 'units-ok';

    // Sort items: by subject name then section
    const sorted = [...items].sort((a, b) => {
      const sc = (a.subject || '').localeCompare(b.subject || '');
      if (sc !== 0) return sc;
      return (a.section || '').localeCompare(b.section || '');
    });

    // Group rows by subject for a cleaner visual
    const rows = sorted.map(item => {
      const ctClass = (item.class_type || 'LECTURE').toLowerCase();
      const displaySlot = item.slot_display || item.slot || '';
      const dayAbbr = (item.slot || '').split(':')[0].trim();
      const sectionHTML = item.section
        ? `<span class="section-badge fac-assign-section">${escapeHTML(item.section)}</span>`
        : '';
      const stuTag   = item.student_count > 0 ? `<span class="student-count-tag">${item.student_count}</span>` : '';
      const capBadge = buildCapacityBadge(item);
      return `
        <li class="fac-assign-item-full">
          <span class="fac-assign-ct-dot ct-dot-${ctClass}"></span>
          <span class="fac-assign-item-inner">
            <span class="fac-assign-subject-name" title="${escapeAttr(item.subject)}">${escapeHTML(item.subject)}</span>
            <span class="fac-assign-meta">
              <span class="class-type-tag ${ctClass}">${escapeHTML(item.class_type || 'LECTURE')}</span>
              ${sectionHTML}
              ${displaySlot ? `<span class="fac-assign-slot slot-day-${escapeHTML(dayAbbr)}">${escapeHTML(displaySlot)}</span>` : ''}
              ${item.room ? `<span class="fac-assign-room">${escapeHTML(item.room)}</span>` : ''}
              ${stuTag}
              ${capBadge}
            </span>
          </span>
        </li>`;
    }).join('');

    html += `
      <div class="fac-assign-card">
        <div class="fac-assign-header">
          <span class="fac-assign-avatar">${escapeHTML(faculty.charAt(0))}</span>
          <div class="fac-assign-header-info">
            <span class="fac-assign-name">${escapeHTML(faculty)}</span>
            <span class="fac-assign-count">${items.length} assignment${items.length !== 1 ? 's' : ''}</span>
          </div>
          <span class="units-badge ${colorClass}">${units}u</span>
          <button class="btn-edit-faculty btn" data-faculty="${escapeAttr(faculty)}" title="Edit ${escapeAttr(faculty)}">&#9998;</button>
        </div>
        <div class="fac-assign-body">
          <ul class="fac-assign-list">${rows}</ul>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

/* ============================================================
   12. EXPORT AND PRINT UTILITIES (CSV / PRINT REPORT EXPORTS)
   ============================================================ */
function initExports() {
  const csvBtn = document.getElementById('exportCSV');
  const pdfBtn = document.getElementById('exportPDF');

  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      if (!lastGAResult || !lastGAResult.length) {
        alert('Run the optimization framework engine first before exporting data records.');
        return;
      }
      const exportData = filterResultBySemester(lastGAResult);
      const mode = getActiveSemester();
      const semLabel = mode ? (mode.year ? `${mode.year}_${mode.semester}` : mode.semester) : 'all';
      const headers = [
        'Faculty Member',
        'Subject Title',
        'Year',
        'Section',
        'Classification Type',
        'Class Type',
        'Schedule Slot',
        'Room',
        'Semester'
      ];
      const rows = exportData.map(item => [
        `"${(item.faculty||'').replace(/"/g,'""')}"`,
        `"${(item.subject||'').replace(/"/g,'""')}"`,
        `"${(item.year||'').replace(/"/g,'""')}"`,
        `"${(item.section||'').replace(/"/g,'""')}"`,
        `"${(item.type||'').replace(/"/g,'""')}"`,
        `"${(item.class_type||'LECTURE').replace(/"/g,'""')}"`,
        `"${(item.slot_display||item.slot||'').replace(/"/g,'""')}"`,
        `"${(item.room||'').replace(/"/g,'""')}"`,
        `"${(item.semester||mode?.semester||'').replace(/"/g,'""')}"`
      ].join(','));

      const csv = [headers.join(',')].concat(rows).join('\n');
      const fileName = `atlas_psu_${semLabel.replace(/[^a-zA-Z0-9_-]/g,'_')}.csv`;
      downloadFile(csv, fileName, 'text/csv');
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', generatePrintReport);
  }
}

function generatePrintReport() {
  if (!lastGAResult || !lastGAResult.length) {
    alert('Run the optimization first to generate a report.');
    return;
  }

  const dept = sessionStorage.getItem('atlasDept') || 'IT';
  const user = sessionStorage.getItem('atlasUser') || 'Administrator';
  const deptMap = {
    IT:   'Information Technology',
    CS:   'Computer Science',
    MB:   'Marine Biology',
    ES:   'Environmental Science',
    MedB: 'Medical Biology'
  };
  const deptFull = deptMap[dept] || dept;

  const mode = getActiveSemester();
  const semesterLabel = mode ? (mode.year ? `${mode.year} - ${mode.semester}` : mode.semester) : 'All Semesters';

  const reportData = filterResultBySemester(lastGAResult);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  // Compute breakdown mapping metric profiles internally
  const byFaculty = {};
  reportData.forEach(item => {
    if (!item.faculty) return;
    if (!byFaculty[item.faculty]) byFaculty[item.faculty] = [];
    byFaculty[item.faculty].push(item);
  });

  const upa = getUnitsPerAssignment();
  const facMaxMap = getFacultyMaxUnitsMap();

  const facultyRows = Object.keys(byFaculty).sort().map(facName => {
    const items = byFaculty[facName];
    const units = items.length * upa;
    const fmax  = facMaxMap[facName] || MAX_UNITS;
    const subjectsList = Array.from(new Set(items.map(i => i.subject))).join(', ');
    const loadStatus = units > fmax ? 'OVERLOAD' : units === fmax ? 'MAX LOAD' : 'NORMAL';
    return `
      <tr>
        <td><strong>${escapeHTML(facName)}</strong></td>
        <td class="txt-center font-mono">${units} u</td>
        <td><span class="print-status-tag ${loadStatus.toLowerCase().replace(' ', '')}">${loadStatus}</span></td>
        <td>${escapeHTML(subjectsList)}</td>
      </tr>
    `;
  }).join('');

  const scheduleRows = [...reportData].sort((a, b) => {
    const ps = s => {
      const [d, t] = s.split(':');
      return (DAY_ORDER[d.trim()] * 100) + parseInt(t || '0');
    };
    return ps(a.slot) - ps(b.slot);
  }).map(item => `
    <tr>
      <td class="font-mono"><strong>${escapeHTML(item.slot_display || item.slot)}</strong></td>
      <td>${escapeHTML(item.subject)}</td>
      <td><span class="type-tag ${item.type.toLowerCase()}">${escapeHTML(item.type)}</span></td>
      <td><strong>${escapeHTML(item.faculty)}</strong></td>
      <td><span class="room-cell">${escapeHTML(item.room || 'N/A')}</span></td>
      <td><span class="print-class-tag ${(item.class_type||'LECTURE').toLowerCase()}">${escapeHTML(item.class_type || 'LECTURE')}</span></td>
    </tr>
  `).join('');

  // Extract analytics stats directly safely
  const fScore  = document.getElementById('fairnessScore').textContent;
  const fJain   = document.getElementById('fairnessJain').textContent;
  const fMatch  = document.getElementById('fairnessMatchRate').textContent;
  const fStdDev = document.getElementById('fairnessStdDev').textContent;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ATLAS PSU - Teaching Load Optimization Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5pt;
      color: #000;
      background: #fff;
      line-height: 1.5;
    }

    /* ── COVER PAGE ── */
    .cover {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 60px 48px;
      background: #fff;
      color: #000;
      page-break-after: always;
      border-bottom: 3px solid #000;
    }
    .cover-logo {
      width: 72px;
      height: 72px;
      background: #000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      font-size: 24pt;
      font-weight: bold;
      color: #fff;
    }
    .cover h1 {
      font-size: 26pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 12px;
      color: #000;
    }
    .cover .subtitle {
      font-size: 13pt;
      margin-bottom: 48px;
      font-weight: 400;
      color: #333;
    }
    .cover-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      max-width: 500px;
      width: 100%;
      text-align: left;
      border: 2px solid #000;
      padding: 24px;
      border-radius: 8px;
    }
    .cover-meta-item { display: flex; flex-direction: column; }
    .cover-meta-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #666;
      margin-bottom: 4px;
    }
    .cover-meta-value { font-size: 11pt; font-weight: 700; color: #000; }

    /* ── PAGES ── */
    .page {
      padding: 50px 60px;
      page-break-after: always;
    }
    .page:last-child { page-break-after: avoid; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 30px;
    }
    .page-header h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .page-header .page-meta { font-size: 9pt; color: #555; }
    h3 { font-size: 11pt; color: #000; margin-bottom: 16px; font-weight: 700; }

    /* ── ANALYTICS CARDS ── */
    .fairness-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 32px;
    }
    .fairness-item {
      border: 1.5px solid #000;
      border-radius: 6px;
      padding: 14px 16px;
      background: #fff;
    }
    .fairness-item .f-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #555;
      font-weight: 600;
    }
    .fairness-item .f-value {
      font-size: 20pt;
      font-weight: 700;
      margin: 4px 0 2px;
      line-height: 1;
      color: #000;
    }
    .fairness-item .f-sub { font-size: 7.5pt; color: #777; }

    /* ── TABLES ── */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-bottom: 24px;
    }
    .report-table thead tr { background: #000; color: #fff; }
    .report-table th {
      padding: 9px 12px;
      font-weight: 700;
      text-align: left;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .report-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #ccc;
      color: #000;
    }
    .report-table tr:nth-child(even) { background: #f5f5f5; }
    .txt-center { text-align: center !important; }
    .font-mono { font-family: Consolas, 'Courier New', monospace; }

    /* ── TAGS (all B&W) ── */
    .print-status-tag {
      display: inline-block;
      padding: 2px 8px;
      border: 1.5px solid #000;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      background: #fff;
    }
    .print-class-tag {
      display: inline-block;
      padding: 2px 6px;
      border: 1px solid #555;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      background: #fff;
    }
    .room-cell {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 8.5pt;
      font-weight: 700;
      color: #000;
    }
    .type-tag {
      display: inline-block;
      padding: 2px 6px;
      border: 1px solid #555;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      color: #000;
      background: #fff;
    }

    /* ── SIGNATURE ── */
    .sign-zone {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .sign-block { width: 240px; text-align: center; }
    .sign-line { border-top: 1.5px solid #000; margin-top: 45px; margin-bottom: 6px; }
    .sign-title { font-size: 9pt; color: #555; }

    @media print {
      body { background: #fff; color: #000; }
      .cover { min-height: 100vh; }
    }
  </style>
</head>
<body>

  <div class="cover">
    <div class="cover-logo">A</div>
    <h1>Teaching Load Assignment<br>Optimization Analysis Report</h1>
    <p class="subtitle">Palawan State University, ${escapeHTML(deptFull)} Department</p>
    
    <div class="cover-meta">
      <div class="cover-meta-item">
        <span class="cover-meta-label">Generated</span>
        <span class="cover-meta-value">${dateStr}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Time</span>
        <span class="cover-meta-value">${timeStr}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Prepared by</span>
        <span class="cover-meta-value">${escapeHTML(user)}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Faculty Count</span>
        <span class="cover-meta-value">${Object.keys(byFaculty).length} members</span>
      </div>
      <div class="cover-meta-item" style="grid-column:1/-1;">
        <span class="cover-meta-label">Academic Period</span>
        <span class="cover-meta-value">${escapeHTML(semesterLabel)}</span>
      </div>
    </div>
  </div>

  <div class="page">
    <div class="page-header">
      <h2>I. Executive Distribution Analytics</h2>
      <span class="page-meta">ATLAS PSU Engine · Page 2</span>
    </div>

    <h3>Workload Balance Matrix</h3>
    <div class="fairness-summary-grid">
      <div class="fairness-item">
        <div class="f-label">Overall Balance Score</div>
        <div class="f-value">${fScore}</div>
        <div class="f-sub">Combined GA targets</div>
      </div>
      <div class="fairness-item">
        <div class="f-label">Jain's Index</div>
        <div class="f-value">${fJain}</div>
        <div class="f-sub">Equality metric (0–1)</div>
      </div>
      <div class="fairness-item">
        <div class="f-label">Specialization Match</div>
        <div class="f-value">${fMatch}</div>
        <div class="f-sub">Domain placement</div>
      </div>
      <div class="fairness-item">
        <div class="f-label">Load Std Deviation</div>
        <div class="f-value">${fStdDev}</div>
        <div class="f-sub">Spread index deviation</div>
      </div>
    </div>

    <h3 style="margin-top: 20px;">Faculty Workload Status</h3>
    <table class="report-table">
      <thead>
        <tr>
          <th>Faculty Member</th>
          <th class="txt-center" style="width: 100px;">Total Load</th>
          <th style="width: 130px;">Status</th>
          <th>Assigned Subjects</th>
        </tr>
      </thead>
      <tbody>
        ${facultyRows}
      </tbody>
    </table>

    <div class="sign-zone">
      <div class="sign-block">
        <div class="sign-line"></div>
        <strong>${escapeHTML(user)}</strong><br>
        <span class="sign-title">Department Chairperson</span>
      </div>
      <div class="sign-block">
        <div class="sign-line"></div>
        <strong>College Dean</strong><br>
        <span class="sign-title">College Dean</span>
      </div>
    </div>
  </div>

  <div class="page">
    <div class="page-header">
      <h2>II. Master Schedule Allocations</h2>
      <span class="page-meta">ATLAS PSU Engine · Page 3</span>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 160px;">Time Slot &amp; Day</th>
          <th>Subject</th>
          <th style="width: 110px;">Type</th>
          <th>Faculty</th>
          <th style="width: 90px;">Room</th>
          <th style="width: 70px;">Class</th>
        </tr>
      </thead>
      <tbody>
        ${scheduleRows}
      </tbody>
    </table>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Please allow pop-ups to generate the PDF report.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

function downloadFile(content, fileName, mimeType) {
  const a = document.createElement('a');
  const blob = new Blob([content], { type: mimeType });
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ============================================================
   13. SANITIZATION & STRING ESCAPE UTILITIES
   ============================================================ */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ============================================================
   14. INITIALIZATION
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  // Clear stale localStorage if data version changed
  if (localStorage.getItem('atlasDataVersion') !== DATA_VERSION) {
    localStorage.removeItem('facultyData');
    localStorage.removeItem('subjectsData');
    localStorage.removeItem('classSizesData');
    localStorage.removeItem('lastGAResult');
    localStorage.setItem('atlasDataVersion', DATA_VERSION);
  }

  // Load class sizes (editable, not fixed)
  if (!loadClassSizesFromStorage()) {
    saveClassSizes(DEFAULT_CLASS_SIZES);
  }

  initCharts();
  initNavigation();
  initRunGA();
  initFacultyManagement();
  initSubjectsManagement();
  initExports();
  initRoomManagement();
  initClassSizesManagement();
  initAcademicMode();
  initSystemSettings();

  // Load faculty
  const savedFaculty = loadFacultyFromStorage();
  if (savedFaculty && savedFaculty.length > 0) {
    savedFaculty.forEach(f => addFacultyRow(f));
  } else {
    INITIAL_FACULTY.forEach(f => addFacultyRow(f));
  }
  updateAllSelectAllBtnStates();

  // Load subjects
  const savedSubjects = loadSubjectsFromStorage();
  if (savedSubjects && savedSubjects.length > 0) {
    savedSubjects.forEach(s => addSubjectRow(s));
  } else {
    DEFAULT_SUBJECTS.forEach(s => addSubjectRow(s));
  }
  saveSubjects();
  renderSubjectsGrouped();

  // Init soft constraints (needs faculty loaded first)
  initSoftConstraints();

  // Update semester badges now that subjects are loaded
  updateAllSemesterBadges();

  // Restore last GA result and re-render all views
  try {
    const saved = localStorage.getItem('lastGAResult');
    if (saved) {
      lastGAResult = JSON.parse(saved);
      if (lastGAResult && lastGAResult.length) {
        const displayResult = filterResultBySemester(lastGAResult);
        renderTable(displayResult);
        updateCharts(displayResult);
        computeFairnessReport(displayResult);
        renderDashboardAssignments(displayResult);
        renderTimetable(displayResult);
        updateReportsPanel(displayResult);
      }
    }
  } catch(e) { lastGAResult = []; }

  // Restore analytics cache and re-populate capacity panels
  try {
    const savedAnalytics = localStorage.getItem('atlasAnalyticsCache');
    if (savedAnalytics) {
      const analytics = JSON.parse(savedAnalytics);
      window.__atlasAnalytics = analytics;
      mergeCapacityStatuses(analytics);
      renderCapacityMetrics(resolveCapacityMetrics(analytics));
      renderCapacityAnalytics(analytics);
    }
  } catch(e) {}
});

function getActiveSemester() {
  try {
    const mode = JSON.parse(localStorage.getItem('academicMode') || 'null');
    return mode && mode.semester ? mode : null;
  } catch (e) { return null; }
}

function getActiveSemesterLabel() {
  const mode = getActiveSemester();
  if (!mode) return null;
  return mode.year ? `${mode.year} · ${mode.semester}` : mode.semester;
}

function updateAllSemesterBadges() {
  const mode = getActiveSemester();
  const label = getActiveSemesterLabel();

  // Navbar badge
  const navBadge = document.getElementById('navSemesterBadge');
  if (navBadge) {
    if (mode) {
      navBadge.textContent = label;
      navBadge.style.display = 'flex';
    } else {
      navBadge.style.display = 'none';
    }
  }

  // Panel context badges
  ['dashboardSemContext', 'optimizationSemContext', 'reportsSemContext'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (mode) {
      el.textContent = `Showing: ${label}`;
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  });

  // Active banner in Settings
  const banner = document.getElementById('academicModeActiveBanner');
  const bannerText = document.getElementById('academicActiveBannerText');
  if (banner && bannerText) {
    if (mode) {
      bannerText.textContent = `Active Period: ${label}`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}

function filterResultBySemester(data) {
  // lastGAResult items carry the subject name; we filter by checking the subjects table
  // If no active semester set, return all
  const mode = getActiveSemester();
  if (!mode) return data;
  const semester = mode.semester;

  // Build a set of subject names valid for this semester
  const allSubjects = getSubjectsFromTable();
  const validNames = new Set(
    allSubjects.filter(s => s.semester === semester).map(s => s.name)
  );
  if (!validNames.size) return data; // no subject list to filter against, return all

  return data.filter(item => validNames.has(item.subject));
}

/* ============================================================
   SYSTEM SETTINGS (units_per_assignment, cp_sat_time_limit, max_units display)
   ============================================================ */
function getSystemSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    return {
      max_units:            parseInt(s.max_units)            || 24,
      units_per_assignment: parseInt(s.units_per_assignment) || 2,
      cp_sat_time_limit:    parseFloat(s.cp_sat_time_limit)  || 60.0,
    };
  } catch(e) {
    return { max_units: 24, units_per_assignment: 2, cp_sat_time_limit: 60.0 };
  }
}

function saveSystemSettings(settings) {
  try { localStorage.setItem('systemSettings', JSON.stringify(settings)); } catch(e) {}
}

function initSystemSettings() {
  const s = getSystemSettings();
  const inp = id => document.getElementById(id);
  if (inp('sysMaxUnits'))           inp('sysMaxUnits').value           = s.max_units;
  if (inp('sysUnitsPerAssignment')) inp('sysUnitsPerAssignment').value = s.units_per_assignment;
  if (inp('sysCpSatTimeLimit'))     inp('sysCpSatTimeLimit').value     = s.cp_sat_time_limit;

  document.getElementById('saveSystemSettings')?.addEventListener('click', () => {
    const updated = {
      max_units:            parseInt(inp('sysMaxUnits')?.value)           || 24,
      units_per_assignment: parseInt(inp('sysUnitsPerAssignment')?.value) || 2,
      cp_sat_time_limit:    parseFloat(inp('sysCpSatTimeLimit')?.value)   || 60.0,
    };
    saveSystemSettings(updated);
    showToast('System settings saved.', 'success');
  });
}

function initAcademicMode() {
  const yearInput = document.getElementById('academicYear');
  const semSel    = document.getElementById('academicSemester');
  const saveBtn   = document.getElementById('saveAcademicMode');
  const savedMsg  = document.getElementById('academicModeSaved');
  if (!yearInput || !semSel || !saveBtn) return;

  const saved = getActiveSemester();
  if (saved) {
    yearInput.value = saved.year || '';
    semSel.value    = saved.semester || '1st Semester';
  }

  updateAllSemesterBadges();

  saveBtn.addEventListener('click', () => {
    const year     = yearInput.value.trim();
    const semester = semSel.value;
    if (!year) {
      showToast('Please enter an Academic Year (e.g. 2024–2025).', 'info');
      yearInput.focus();
      return;
    }
    const mode = { year, semester };
    localStorage.setItem('academicMode', JSON.stringify(mode));
    updateAllSemesterBadges();
    if (savedMsg) {
      savedMsg.style.display = 'inline-flex';
      setTimeout(() => { savedMsg.style.display = 'none'; }, 2500);
    }
    showToast(`Active Period set: ${year} · ${semester}`, 'success');

    // If a GA result is loaded, re-filter and re-render views to respect new semester
    if (lastGAResult && lastGAResult.length) {
      const filtered = filterResultBySemester(lastGAResult);
      renderTable(filtered);
      updateCharts(filtered);
      computeFairnessReport(filtered);
      renderDashboardAssignments(filtered);
      renderTimetable(filtered);
      updateReportsPanel(filtered);
    }
  });
}

/* ============================================================
   CLASS SIZE STORAGE
   ============================================================ */
function loadClassSizesFromStorage() {
  try {
    const data = localStorage.getItem('classSizesData');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function saveClassSizes(sizes) {
  try {
    localStorage.setItem('classSizesData', JSON.stringify(sizes));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function getClassSizes() {
  return loadClassSizesFromStorage() || DEFAULT_CLASS_SIZES;
}

/* ============================================================
   ROOM MANAGEMENT UI
   ============================================================ */
const DEFAULT_LECTURE_ROOMS = [...LECTURE_ROOMS];
const DEFAULT_LABORATORY_ROOMS = [...LABORATORY_ROOMS];

let runtimeLectureRooms = [...LECTURE_ROOMS];
let runtimeLabRooms = [...LABORATORY_ROOMS];
let runtimeRoomCapacity = { ...DEFAULT_ROOM_CAPACITY };

function loadRoomsFromStorage() {
  try {
    const data = localStorage.getItem('roomsData');
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}

function saveRoomsToStorage() {
  try {
    localStorage.setItem('roomsData', JSON.stringify({
      lecture: runtimeLectureRooms,
      lab: runtimeLabRooms,
      capacity: runtimeRoomCapacity
    }));
  } catch (e) { console.warn('Rooms save failed:', e); }
}

function renderRoomList(containerId, rooms) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  rooms.forEach((room, idx) => {
    const cap = runtimeRoomCapacity[room] || { recommended: '', max: '' };
    const item = document.createElement('div');
    item.className = 'room-item';
    item.innerHTML = `
      <input type="text" value="${escapeAttr(room)}" placeholder="Room name" class="room-name-input" style="flex:2;min-width:0;">
      <input type="number" value="${cap.recommended !== '' ? cap.recommended : ''}" placeholder="Rec." class="room-cap-input room-rec-input" min="1" max="999" title="Recommended capacity">
      <input type="number" value="${cap.max !== '' ? cap.max : ''}" placeholder="Max" class="room-cap-input room-max-input" min="1" max="999" title="Hard max capacity">
      <button class="room-item-del" data-idx="${idx}" title="Delete">&times;</button>
    `;
    const nameInp = item.querySelector('.room-name-input');
    const recInp  = item.querySelector('.room-rec-input');
    const maxInp  = item.querySelector('.room-max-input');
    const isList  = containerId === 'lectureRoomsList';
    const list    = isList ? runtimeLectureRooms : runtimeLabRooms;

    nameInp.addEventListener('input', debounce(() => {
      const oldName = list[idx];
      const newName = nameInp.value.trim();
      // Migrate capacity key if name changed
      if (oldName !== newName) {
        if (runtimeRoomCapacity[oldName] !== undefined) {
          runtimeRoomCapacity[newName] = runtimeRoomCapacity[oldName];
          delete runtimeRoomCapacity[oldName];
        }
      }
      list[idx] = newName;
    }, 300));

    recInp.addEventListener('input', debounce(() => {
      const name = list[idx] || nameInp.value.trim();
      if (!runtimeRoomCapacity[name]) runtimeRoomCapacity[name] = {};
      runtimeRoomCapacity[name].recommended = parseInt(recInp.value) || '';
    }, 300));

    maxInp.addEventListener('input', debounce(() => {
      const name = list[idx] || nameInp.value.trim();
      if (!runtimeRoomCapacity[name]) runtimeRoomCapacity[name] = {};
      runtimeRoomCapacity[name].max = parseInt(maxInp.value) || '';
    }, 300));

    item.querySelector('.room-item-del').addEventListener('click', () => {
      if (isList) {
        runtimeLectureRooms.splice(idx, 1);
        renderRoomList('lectureRoomsList', runtimeLectureRooms);
      } else {
        runtimeLabRooms.splice(idx, 1);
        renderRoomList('labRoomsList', runtimeLabRooms);
      }
    });
    container.appendChild(item);
  });
}

function initRoomManagement() {
  const stored = loadRoomsFromStorage();
  if (stored) {
    runtimeLectureRooms = stored.lecture || [...LECTURE_ROOMS];
    runtimeLabRooms = stored.lab || [...LABORATORY_ROOMS];
    runtimeRoomCapacity = stored.capacity || { ...DEFAULT_ROOM_CAPACITY };
  }

  renderRoomList('lectureRoomsList', runtimeLectureRooms);
  renderRoomList('labRoomsList', runtimeLabRooms);

  document.getElementById('addLectureRoom')?.addEventListener('click', () => {
    runtimeLectureRooms.push('');
    renderRoomList('lectureRoomsList', runtimeLectureRooms);
  });

  document.getElementById('addLabRoom')?.addEventListener('click', () => {
    runtimeLabRooms.push('');
    renderRoomList('labRoomsList', runtimeLabRooms);
  });

  document.getElementById('saveRooms')?.addEventListener('click', async () => {
    // Sync name+capacity from DOM inputs before saving
    document.querySelectorAll('#lectureRoomsList .room-item').forEach((item, i) => {
      const name = item.querySelector('.room-name-input')?.value.trim() || '';
      const rec  = parseInt(item.querySelector('.room-rec-input')?.value) || '';
      const max  = parseInt(item.querySelector('.room-max-input')?.value) || '';
      runtimeLectureRooms[i] = name;
      if (name) runtimeRoomCapacity[name] = { recommended: rec, max };
    });
    document.querySelectorAll('#labRoomsList .room-item').forEach((item, i) => {
      const name = item.querySelector('.room-name-input')?.value.trim() || '';
      const rec  = parseInt(item.querySelector('.room-rec-input')?.value) || '';
      const max  = parseInt(item.querySelector('.room-max-input')?.value) || '';
      runtimeLabRooms[i] = name;
      if (name) runtimeRoomCapacity[name] = { recommended: rec, max };
    });
    runtimeLectureRooms = runtimeLectureRooms.filter(r => r);
    runtimeLabRooms = runtimeLabRooms.filter(r => r);
    saveRoomsToStorage();
    populateSCRoomDropdown();
  populateSCBuildingDropdown();
    showToast('Rooms saved successfully.', 'success');
    try {
      await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_rooms: runtimeLectureRooms,
          laboratory_rooms: runtimeLabRooms,
          room_capacity: runtimeRoomCapacity
        })
      });
    } catch (e) { /* backend optional sync */ }
  });

  document.getElementById('resetRooms')?.addEventListener('click', () => {
    runtimeLectureRooms = [...DEFAULT_LECTURE_ROOMS];
    runtimeLabRooms = [...DEFAULT_LABORATORY_ROOMS];
    runtimeRoomCapacity = { ...DEFAULT_ROOM_CAPACITY };
    renderRoomList('lectureRoomsList', runtimeLectureRooms);
    renderRoomList('labRoomsList', runtimeLabRooms);
    saveRoomsToStorage();
    showToast('Rooms reset to defaults.', 'info');
  });
}

/* ============================================================
   CLASS SIZES MANAGEMENT UI
   ============================================================ */
function renderClassSizesTable() {
  const tbody = document.querySelector('#classSizesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const sizes = getClassSizes();
  Object.entries(sizes).forEach(([key, val]) => {
    const tr = document.createElement('tr');
    tr.dataset.key = key;
    tr.innerHTML = `
      <td><span class="cs-key-badge">${escapeHTML(key)}</span><input type="hidden" class="cs-key" value="${escapeAttr(key)}"></td>
      <td>
        <select class="cs-year">
          <option ${val.year==='1st Year'?'selected':''}>1st Year</option>
          <option ${val.year==='2nd Year'?'selected':''}>2nd Year</option>
          <option ${val.year==='3rd Year'?'selected':''}>3rd Year</option>
          <option ${val.year==='4th Year'?'selected':''}>4th Year</option>
        </select>
      </td>
      <td><input type="text" class="cs-block" value="${escapeAttr(val.block||'')}" placeholder="e.g. B1" style="max-width:80px;"></td>
      <td><input type="number" class="cs-size" value="${val.size||0}" min="1" max="200" style="max-width:100px;"></td>
      <td><button type="button" class="btn-delete row-action-btn cs-del" title="Delete">Delete</button></td>
    `;
    tr.querySelector('.cs-del').addEventListener('click', () => {
      tr.remove();
    });
    tbody.appendChild(tr);
  });
}

function getClassSizesFromTable() {
  const result = {};
  document.querySelectorAll('#classSizesTable tbody tr').forEach(tr => {
    const key = tr.querySelector('.cs-key')?.value?.trim();
    if (!key) return;
    result[key] = {
      year:  tr.querySelector('.cs-year')?.value || '1st Year',
      block: tr.querySelector('.cs-block')?.value?.trim() || '',
      size:  parseInt(tr.querySelector('.cs-size')?.value || 0, 10)
    };
  });
  return result;
}

function initClassSizesManagement() {
  renderClassSizesTable();

  document.getElementById('saveClassSizes')?.addEventListener('click', async () => {
    const sizes = getClassSizesFromTable();
    saveClassSizes(sizes);
    showToast('Class sizes saved.', 'success');
    try {
      await fetch(`${API_BASE}/class-sizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sizes)
      });
    } catch (e) { /* optional backend sync */ }
  });

  document.getElementById('addClassSizeRow')?.addEventListener('click', () => {
    const tbody = document.querySelector('#classSizesTable tbody');
    if (!tbody) return;
    const newKey = `IT${Math.floor(Math.random()*90)+10}B${Math.floor(Math.random()*3)+1}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="cs-key" value="${newKey}" placeholder="e.g. IT1B1" style="max-width:90px;"></td>
      <td>
        <select class="cs-year">
          <option>1st Year</option>
          <option>2nd Year</option>
          <option>3rd Year</option>
          <option>4th Year</option>
        </select>
      </td>
      <td><input type="text" class="cs-block" value="B1" placeholder="e.g. B1" style="max-width:80px;"></td>
      <td><input type="number" class="cs-size" value="30" min="1" max="200" style="max-width:100px;"></td>
      <td><button type="button" class="btn-delete row-action-btn cs-del" title="Delete">Delete</button></td>
    `;
    tr.querySelector('.cs-del').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
  });

  document.getElementById('resetClassSizes')?.addEventListener('click', () => {
    saveClassSizes(DEFAULT_CLASS_SIZES);
    renderClassSizesTable();
    showToast('Class sizes reset to defaults.', 'info');
  });
}

/* ============================================================
   SOFT CONSTRAINTS (PROFESSOR PREFERENCES) UI
   ============================================================ */
let softConstraintsCache = {};

function loadSoftConstraintsFromStorage() {
  try {
    const data = localStorage.getItem('softConstraintsData');
    return data ? JSON.parse(data) : {};
  } catch (e) { return {}; }
}

function saveSoftConstraintsToStorage(data) {
  try {
    localStorage.setItem('softConstraintsData', JSON.stringify(data));
  } catch (e) { console.warn('SC save failed:', e); }
}

function populateSCFacultyDropdown() {
  const sel = document.getElementById('scFacultySelect');
  if (!sel) return;
  const faculty = getFacultyFromTable();
  sel.innerHTML = '<option value="">Select Faculty</option>' +
    faculty.map(f => `<option value="${escapeAttr(f.name)}">${escapeHTML(f.name)}</option>`).join('');
}

function populateSCRoomDropdown() {
  const sel = document.getElementById('scPreferredRoom');
  if (!sel) return;
  const allRooms = [...runtimeLectureRooms, ...runtimeLabRooms];
  sel.innerHTML = '<option value="">No Preference</option>' +
    allRooms.map(r => `<option value="${escapeAttr(r)}">${escapeHTML(r)}</option>`).join('');
}

function populateSCBuildingDropdown() {
  const sel = document.getElementById('scPreferredBuilding');
  if (!sel) return;
  // Derive unique building prefixes from runtime rooms using same logic as backend get_building()
  const allRooms = [...runtimeLectureRooms, ...runtimeLabRooms];
  const buildingSet = new Map();
  allRooms.forEach(r => {
    const name = r.trim();
    let bld, label;
    if (name.startsWith('GA Bldg'))  { bld = 'GA Bldg';  label = 'GA Building'; }
    else if (name.startsWith('IT Room')) { bld = 'IT Room'; label = 'IT Room Building'; }
    else if (name.startsWith('CL'))   { bld = 'CL';       label = 'CL Building'; }
    else if (name.startsWith('MTC'))  { bld = 'MTC';      label = 'MTC Building'; }
    else if (name.startsWith('NIT'))  { bld = 'NIT';      label = 'NIT Building'; }
    else { bld = name; label = name; }
    if (!buildingSet.has(bld)) buildingSet.set(bld, label);
  });
  const current = sel.value;
  sel.innerHTML = '<option value="">- No Preference -</option>' +
    Array.from(buildingSet.entries()).map(([bld, label]) =>
      `<option value="${escapeAttr(bld)}">${escapeHTML(label)}</option>`
    ).join('');
  if (current) sel.value = current;
}

function addUnavailDateEntry(container, value = '') {
  const div = document.createElement('div');
  div.className = 'date-entry';
  div.innerHTML = `
    <input type="date" value="${escapeAttr(value)}" style="flex:1;">
    <button class="date-entry-del" title="Remove">&times;</button>
  `;
  div.querySelector('.date-entry-del').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

function addLeaveDateEntry(container, start = '', end = '') {
  const div = document.createElement('div');
  div.className = 'date-entry';
  div.innerHTML = `
    <input type="date" value="${escapeAttr(start)}" placeholder="Start" style="flex:1;">
    <span style="font-size:0.75rem;color:var(--text-muted);">to</span>
    <input type="date" value="${escapeAttr(end)}" placeholder="End" style="flex:1;">
    <button class="date-entry-del" title="Remove">&times;</button>
  `;
  div.querySelector('.date-entry-del').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

function loadSCFormForFaculty(name) {
  const constraints = softConstraintsCache[name] || {};
  const form = document.getElementById('softConstraintForm');
  if (!form) return;
  form.classList.remove('hidden');

  document.getElementById('scPreferredPeriod').value = constraints.preferred_period || '';
  document.getElementById('scPreferredRoom').value = constraints.preferred_room || '';
  document.getElementById('scPreferredBuilding').value = constraints.preferred_building || '';
  document.getElementById('scPreferredFloor').value = constraints.preferred_floor || '';
  document.getElementById('scMaternityLeave').checked = !!constraints.maternity_leave;

  document.querySelectorAll('.sc-restrict-day').forEach(chk => {
    chk.checked = (constraints.restricted_days || []).includes(chk.value);
  });

  const unavailContainer = document.getElementById('unavailDatesContainer');
  unavailContainer.innerHTML = '';
  (constraints.unavailable_dates || []).forEach(d => addUnavailDateEntry(unavailContainer, d));

  const leaveContainer = document.getElementById('leaveDatesContainer');
  leaveContainer.innerHTML = '';
  (constraints.leave_dates || []).forEach(l => addLeaveDateEntry(leaveContainer, l.start, l.end));
}

function getSCFormData() {
  return {
    preferred_period:   document.getElementById('scPreferredPeriod').value || null,
    preferred_room:     document.getElementById('scPreferredRoom').value || null,
    preferred_building: document.getElementById('scPreferredBuilding').value || null,
    preferred_floor:    document.getElementById('scPreferredFloor').value || null,
    maternity_leave:    document.getElementById('scMaternityLeave').checked,
    restricted_days: Array.from(document.querySelectorAll('.sc-restrict-day:checked')).map(c => c.value),
    unavailable_dates: Array.from(document.querySelectorAll('#unavailDatesContainer .date-entry input[type="date"]'))
      .map(i => i.value).filter(Boolean),
    leave_dates: Array.from(document.querySelectorAll('#leaveDatesContainer .date-entry')).map(div => {
      const inputs = div.querySelectorAll('input[type="date"]');
      return { start: inputs[0]?.value || '', end: inputs[1]?.value || '' };
    }).filter(l => l.start || l.end)
  };
}

function initSoftConstraints() {
  softConstraintsCache = loadSoftConstraintsFromStorage();
  populateSCFacultyDropdown();
  populateSCRoomDropdown();
  populateSCBuildingDropdown();

  document.getElementById('scLoadBtn')?.addEventListener('click', () => {
    const name = document.getElementById('scFacultySelect')?.value;
    if (!name) { showToast('Select a faculty member first.', 'info'); return; }
    loadSCFormForFaculty(name);
  });

  document.getElementById('addUnavailDate')?.addEventListener('click', () => {
    addUnavailDateEntry(document.getElementById('unavailDatesContainer'));
  });

  document.getElementById('addLeaveDate')?.addEventListener('click', () => {
    addLeaveDateEntry(document.getElementById('leaveDatesContainer'));
  });

  document.getElementById('scSaveBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('scFacultySelect')?.value;
    if (!name) { showToast('Select a faculty member first.', 'info'); return; }
    const constraints = getSCFormData();
    softConstraintsCache[name] = constraints;
    saveSoftConstraintsToStorage(softConstraintsCache);
    showToast(`Preferences saved for ${name}.`, 'success');
    try {
      await fetch(`${API_BASE}/soft-constraints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty: name, constraints })
      });
    } catch (e) { /* optional backend sync */ }
  });

  document.getElementById('scClearBtn')?.addEventListener('click', () => {
    const name = document.getElementById('scFacultySelect')?.value;
    if (!name) return;
    delete softConstraintsCache[name];
    saveSoftConstraintsToStorage(softConstraintsCache);
    document.getElementById('softConstraintForm')?.classList.add('hidden');
    showToast(`Preferences cleared for ${name}.`, 'info');
  });
}

/* ============================================================
   GLOBAL EXPORTS & TOAST UTILITY
   ============================================================ */
/* ============================================================
   CAPACITY BADGE HELPER & ANALYTICS PANEL RENDERER
   ============================================================ */

function buildCapacityBadge(item) {
  const status = item._cap_status || item.capacity_status || null;
  if (status === 'hard_violation')   return `<span class="capacity-overall-badge badge-hard" title="Exceeds max capacity">Violation</span>`;
  if (status === 'over_recommended') return `<span class="capacity-overall-badge badge-warn" title="Exceeds recommended">Over Cap</span>`;
  if (status === 'ok')               return `<span class="capacity-overall-badge badge-ok"   title="Within recommended">OK</span>`;
  return '';
}

function mergeCapacityStatuses(analytics) {
  if (!analytics || !analytics.capacity_metrics) return;
  const details = analytics.capacity_metrics.capacity_details || [];
  if (!details.length || !lastGAResult.length) return;
  const lookup = {};
  details.forEach(d => {
    const key = `${d.room}||${d.section}||${d.subject}`;
    lookup[key] = { status: d.status, student_count: d.student_count };
  });
  lastGAResult.forEach(item => {
    const key = `${item.room || ''}||${item.section || ''}||${item.subject || ''}`;
    const match = lookup[key];
    if (match) {
      item._cap_status = match.status;
      if (!item.student_count) item.student_count = match.student_count;
    }
  });
}

/* ============================================================
   FRONTEND CAPACITY COMPUTATION
   Used when backend analytics have no student_count data (total_evaluated === 0).
   Derives capacity status from getClassSizes() + runtimeRoomCapacity.
   ============================================================ */
function computeCapacityMetricsFrontend(data) {
  if (!data || !data.length) return null;
  const classSizes = getClassSizes();
  let within = 0, over = 0, hard = 0, evaluated = 0;
  const hardViolations = [];
  const details = [];

  data.forEach(item => {
    if (!item.room || item.room === 'Unassigned') return;
    const section = item.section || '';
    const sizeEntry = classSizes[section];
    let studentCount = item.student_count > 0
      ? item.student_count
      : (sizeEntry ? (sizeEntry.size || 0) : 0);
    if (studentCount <= 0 && item.year) {
      const yearSizes = Object.values(classSizes)
        .filter(v => v && v.year === item.year && (v.size || 0) > 0)
        .map(v => v.size);
      if (yearSizes.length) studentCount = Math.max(...yearSizes);
    }
    if (studentCount <= 0) return;

    const cap = runtimeRoomCapacity[item.room] || {};
    const recommended = (cap.recommended && cap.recommended !== '') ? Number(cap.recommended) : 9999;
    const maxCap      = (cap.max        && cap.max        !== '') ? Number(cap.max)        : 9999;

    evaluated++;
    let status = 'ok';
    if (studentCount > maxCap) {
      status = 'hard_violation';
      hard++;
      hardViolations.push({ room: item.room, section, subject: item.subject || '',
        student_count: studentCount, max_cap: maxCap, excess: studentCount - maxCap });
    } else if (studentCount > recommended) {
      status = 'over_recommended';
      over++;
    } else {
      within++;
    }

    // Stamp back so badges render in table/assignment views
    item._cap_status = status;
    if (!item.student_count) item.student_count = studentCount;

    details.push({ room: item.room, section, subject: item.subject || '',
      student_count: studentCount, recommended_cap: recommended,
      max_cap: maxCap, status, capacity_penalty: 0 });
  });

  if (evaluated === 0) return null;

  return {
    within_recommended_count: within,
    over_recommended_count:   over,
    hard_violation_count:     hard,
    total_evaluated:          evaluated,
    within_recommended_pct:   Math.round(within / evaluated * 1000) / 10,
    total_capacity_penalty:   0,
    hard_violations:          hardViolations,
    capacity_details:         details,
  };
}

/**
 * Get best available capacity metrics:
 * Use backend data if it has evaluated assignments, else compute from frontend.
 */
function resolveCapacityMetrics(backendAnalytics) {
  const beCm = backendAnalytics && backendAnalytics.capacity_metrics;
  if (beCm && beCm.total_evaluated > 0) return beCm;
  const displayResult = filterResultBySemester(lastGAResult);
  return computeCapacityMetricsFrontend(displayResult) || beCm || {};
}

function renderCapacityAnalytics(analytics) {
  const cm = resolveCapacityMetrics(analytics);

  const total  = cm.total_evaluated          || 0;
  const okCnt  = cm.within_recommended_count || 0;
  const warnCt = cm.over_recommended_count   || 0;
  const hardCt = cm.hard_violation_count     || 0;
  const pct = n => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '–';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('analyticsCapTotal',          total  != null ? total  : '–');
  set('analyticsCapCompliant',      okCnt  != null ? okCnt  : '–');
  set('analyticsCapCompliantPct',   pct(okCnt));
  set('analyticsCapOver',           warnCt != null ? warnCt : '–');
  set('analyticsCapOverPct',        pct(warnCt));
  set('analyticsCapViolations',     hardCt != null ? hardCt : '–');
  set('analyticsCapViolationsPct',  pct(hardCt));

  // Room utilization table
  const ruBody = document.getElementById('roomUtilCapBody');
  if (ruBody && analytics.room_utilization && analytics.room_utilization.length) {
    ruBody.innerHTML = analytics.room_utilization.map(r => {
      const recCap = r.recommended_cap != null ? r.recommended_cap : 'N/A';
      const maxCap = r.max_cap         != null ? r.max_cap         : 'N/A';
      const cls    = r.occupancy_pct >= 80 ? 'match-no' : r.occupancy_pct >= 50 ? 'match-partial' : 'match-yes';
      return `<tr>
        <td><span class="room-badge">${escapeHTML(r.room)}</span></td>
        <td class="txt-center">${r.assigned_count}</td>
        <td class="txt-center"><span class="${cls}">${r.occupancy_pct}%</span></td>
        <td class="txt-center">${escapeHTML(String(recCap))}</td>
        <td class="txt-center">${escapeHTML(String(maxCap))}</td>
      </tr>`;
    }).join('');
  }

  // Capacity details table
  const details = cm.capacity_details || [];
  const cdBody = document.getElementById('capacityDetailsBody');
  const cdSection = document.getElementById('capacityDetailsSection');
  if (cdBody && details.length) {
    cdBody.innerHTML = details.map(d => {
      const utilPct = d.recommended_cap > 0 ? Math.round(d.student_count / d.recommended_cap * 100) : 0;
      const utilCls = d.status === 'hard_violation' ? 'match-no' : d.status === 'over_recommended' ? 'match-partial' : 'match-yes';
      const badgeCls   = d.status === 'hard_violation' ? 'badge-hard' : d.status === 'over_recommended' ? 'badge-warn' : 'badge-ok';
      const badgeLabel = d.status === 'hard_violation' ? 'Violation' : d.status === 'over_recommended' ? 'Over Cap' : 'OK';
      return `<tr>
        <td><span class="room-badge">${escapeHTML(d.room)}</span></td>
        <td>${d.section ? `<span class="section-badge">${escapeHTML(d.section)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td>${escapeHTML(d.subject || '')}</td>
        <td class="txt-center"><span class="student-count-tag">${d.student_count}</span></td>
        <td class="txt-center">${d.recommended_cap}</td>
        <td class="txt-center">${d.max_cap}</td>
        <td class="txt-center"><span class="${utilCls}">${utilPct}%</span></td>
        <td><span class="capacity-overall-badge ${badgeCls}">${badgeLabel}</span></td>
      </tr>`;
    }).join('');
    if (cdSection) cdSection.style.display = '';
  }
}

/* ============================================================
   GLOBAL EXPORTS & TOAST UTILITY
   ============================================================ */
function showToast(msg, type = 'info') {
  const t = document.getElementById('toastNotif');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast-notif show' + (type ? ' toast-' + type : '');
  setTimeout(() => { t.className = 'toast-notif'; }, 3000);
}

window.switchPanel = switchPanel;
/* ============================================================
   LOGIN PAGE — login.html inline script (migrated)
   ============================================================ */
(function initLoginPage() {
  const loginBtn = document.getElementById('loginBtn');
  if (!loginBtn) return; // not on login page

  loginBtn.addEventListener('click', () => {
    const dept = document.getElementById('department').value;
    const user = document.getElementById('username').value.trim();
    const err  = document.getElementById('errorMsg');

    if (!user) {
      err.textContent = 'Please enter your username.';
      err.classList.add('show');
      return;
    }

    sessionStorage.setItem('atlasDept', dept);
    sessionStorage.setItem('atlasUser', user);
    err.classList.remove('show');
    window.location.href = 'dashboard.html';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginBtn.click();
  });
})();

/* ============================================================
   DASHBOARD PAGE — dashboard.html inline script (migrated)
   ============================================================ */
(function initDashboardPage() {
  // Auth guard — runs after defer, DOM is available
  if (window.location.pathname.includes('dashboard') && !sessionStorage.getItem('atlasUser')) {
    window.location.href = 'login.html';
    return;
  }

  const navUserLabel = document.getElementById('navUserLabel');
  if (!navUserLabel) return; // not on dashboard

  window.addEventListener('DOMContentLoaded', () => {
    const deptMap = {
      IT:   'IT Dept',
      CS:   'CS Dept',
      MB:   'Marine Bio',
      ES:   'Env. Science',
      MedB: 'Med Biology',
    };
    const dept = sessionStorage.getItem('atlasDept');
    const user = sessionStorage.getItem('atlasUser');
    const lbl  = document.getElementById('navUserLabel');
    if (lbl && user) lbl.textContent = user + (dept ? ' · ' + (deptMap[dept] || dept) : '');

    // Profile dropdown — click to open/close
    const profileDrop = document.querySelector('.nav-item.dropdown');
    if (profileDrop) {
      profileDrop.addEventListener('click', e => {
        e.stopPropagation();
        profileDrop.classList.toggle('open');
      });
      document.addEventListener('click', () => {
        profileDrop.classList.remove('open');
      });
    }
  });
})();