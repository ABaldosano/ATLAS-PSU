/* ============================================================
   ATLAS PSU - main-script.js
   Automated Teaching Load Assignment System
   ============================================================ */

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

const MAX_UNITS = 24;

const DATA_VERSION = 'v2'; // bump to wipe stale localStorage on deploy

const SPECIALIZATIONS = [
  'Computer Science Education',
  'Software Engineering / Programming Languages',
  'Applied Mathematics / Theoretical Computer Science',
  'Human-Computer Interaction (HCI)',
  'Computer Graphics / Visual Computing',
  'Algorithms & Data Structures / Theoretical Computer Science',
  'Information Technology (General Elective)',
  'Data Science / Applied Mathematics',
  'Information Systems / Database Management',
  'Operations Research / Computational Modelling',
  'Computer Networks',
  'Software Engineering / Systems Integration',
  'Systems Architecture / Enterprise Systems',
  'Database Systems / Information Systems',
  'Computer Networks / Network Engineering',
  'Cybersecurity / Information Assurance',
  'Web Development / Web Technologies',
  'Multimedia Computing / Digital Media',
  'Emerging Technologies / Application Development',
  'Geographic Information Systems (GIS)',
  'Embedded Systems Engineering'
];

const INITIAL_FACULTY = [
  { name: 'Rodriguez',  specialization: ['Cybersecurity / Information Assurance'],          max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Arelliano',  specialization: ['Systems Architecture / Enterprise Systems'],       max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Taganas',    specialization: ['Software Engineering / Programming Languages'],    max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Flores',     specialization: ['Data Science / Applied Mathematics'],              max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Castillo',   specialization: ['Computer Networks / Network Engineering'],         max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Bravo',      specialization: ['Emerging Technologies / Application Development'], max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Villanueva', specialization: ['Software Engineering / Systems Integration'],      max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Ampongan',   specialization: ['Information Systems / Database Management'],       max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Pontillas',  specialization: ['Human-Computer Interaction (HCI)'],                max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
  { name: 'Aquino',     specialization: ['Database Systems / Information Systems'],          max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu','Fri','Sat'] }
];

const DEFAULT_SUBJECTS = [
  { name: 'Introduction to Computing',                           type: 'Software',    year: '1st Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Computer Programming 1',                             type: 'Software',    year: '1st Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Discrete Mathematics',                               type: 'Software',    year: '1st Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Introduction to Human Computer Interaction',         type: 'Software',    year: '1st Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Computer Programming 2',                             type: 'Software',    year: '1st Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Graphics and Visual Computing',                      type: 'Software',    year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Data Structures and Algorithms',                     type: 'Software',    year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'IT Elective 1',                                      type: 'Elective',    year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'IT Elective 2',                                      type: 'Elective',    year: '2nd Year', semester: '1st Semester', lec_units: 2, lab_units: 0 },
  { name: 'Mathematics for Data Science',                       type: 'Software',    year: '2nd Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Information Management 1',                           type: 'Database',    year: '2nd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Quantitative Methods w/ Modelling and Simulation',   type: 'Software',    year: '2nd Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Network Technologies 1',                             type: 'Networking',  year: '2nd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Integrative Programming Technologies 1',             type: 'Software',    year: '2nd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Systems Integration and Architecture 1',             type: 'Software',    year: '2nd Year', semester: '2nd Semester', lec_units: 3, lab_units: 0 },
  { name: 'Advanced Database Systems',                          type: 'Database',    year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Network Technologies 2',                             type: 'Networking',  year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Information Assurance and Security 1',               type: 'Software',    year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 0 },
  { name: 'Web Systems and Technologies 1',                     type: 'Software',    year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'Multimedia Systems',                                 type: 'Software',    year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 1 },
  { name: 'IT Elective 3',                                      type: 'Elective',    year: '3rd Year', semester: '1st Semester', lec_units: 2, lab_units: 0 },
  { name: 'Application Development and Emerging Technologies 1',type: 'Software',    year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Geographic Information System',                      type: 'Software',    year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Embedded System',                                    type: 'Software',    year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 1 },
  { name: 'Information Assurance and Security 2',               type: 'Software',    year: '3rd Year', semester: '2nd Semester', lec_units: 2, lab_units: 0 }
];

// Table sort state
let lastSort = { key: 'slot', ascending: true };

// Last known GA result for re-rendering
let lastGAResult = [];

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
                let status = v > MAX_UNITS ? ' ⚠ OVERLOAD' : v === MAX_UNITS ? ' ⚠ MAX LOAD' : v <= 2 ? ' ⚠ TOO LOW' : '';
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
                const status = v > MAX_UNITS ? ' (OVERLOAD)' : v === MAX_UNITS ? ' (MAX LOAD)' : '';
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
function getLoadColor(value) {
  if (value > MAX_UNITS) return '#FF0000';
  if (value === MAX_UNITS) return '#FF6700';
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

  const counts = {};
  data.forEach(item => {
    if (!item.faculty) return;
    counts[item.faculty] = (counts[item.faculty] || 0) + 2;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => Number(e[1]));
  const colors = values.map(getLoadColor);

  // Dashboard chart
  if (dashboardChart) {
    dashboardChart.data.labels = labels;
    dashboardChart.data.datasets[0].data = values;
    dashboardChart.data.datasets[0].backgroundColor = colors;
    dashboardChart.update();
    dashboardChart.resize();
  }

  // Bar chart
  if (reportsBarChart) {
    reportsBarChart.data.labels = labels;
    reportsBarChart.data.datasets[0].data = values;
    reportsBarChart.data.datasets[0].backgroundColor = colors;
    reportsBarChart.update();
  }

  // Pie chart
  if (reportsChart) {
    reportsChart.data.labels = Object.keys(counts);
    reportsChart.data.datasets[0].data = Object.values(counts);
    reportsChart.update();
  }

  // Update stat cards
  updateDashboardStats(counts);
}

function updateDashboardStats(counts) {
  const values = Object.values(counts);
  if (!values.length) return;

  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const overloaded = values.filter(v => v > MAX_UNITS).length;
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

function updateMiniFromServer(data) {
  if (!data || !data.result || !Array.isArray(data.result)) return;

  const counts = {};
  data.result.forEach(item => {
    counts[item.faculty] = (counts[item.faculty] || 0) + 2;
  });

  if (!miniDashChart) return;

  miniDashChart.data.labels = Object.keys(counts);
  miniDashChart.data.datasets[0].data = Object.values(counts);
  miniDashChart.data.datasets[0].backgroundColor = Object.values(counts).map(getLoadColor);
  miniDashChart.update();
}

/* ============================================================
   6. REPORTS PANEL UPDATE
   ============================================================ */
function updateReportsPanel(data) {
  if (!data || !data.length) return;

  // Group by faculty
  const byFaculty = {};
  data.forEach(item => {
    if (!item.faculty) return;
    if (!byFaculty[item.faculty]) byFaculty[item.faculty] = [];
    byFaculty[item.faculty].push(item);
  });

  const tbody = document.querySelector('#reportsSummaryTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  Object.keys(byFaculty).sort().forEach(faculty => {
    const assignments = byFaculty[faculty];
    const totalUnits = assignments.length * 2;

    assignments.forEach((item, idx) => {
      const day = item.slot.split(':')[0].trim();
      const tr = document.createElement('tr');
      tr.className = 'summary-row';

      const subjectSlotHTML = `
        <td class="subject-slot-cell">
          <span class="subj-name-text">${escapeHTML(item.subject)}</span>
          <span class="slot-badge slot-${escapeHTML(day)}">${escapeHTML(item.slot)}</span>
        </td>
      `;

      if (idx === 0) {
        tr.innerHTML = `
          <td class="faculty-name-cell" rowspan="${assignments.length}">
            <div class="faculty-name-inner">
              <span class="faculty-avatar">${escapeHTML(faculty.charAt(0))}</span>
              <span>${escapeHTML(faculty)}</span>
            </div>
          </td>
          ${subjectSlotHTML}
          <td class="total-units-cell" rowspan="${assignments.length}">
            <span class="units-badge ${totalUnits > MAX_UNITS ? 'units-over' : totalUnits === MAX_UNITS ? 'units-max' : 'units-ok'}">${totalUnits}</span>
          </td>
          <td class="actions-cell" rowspan="${assignments.length}">
            <button class="btn-edit-faculty" data-faculty="${escapeAttr(faculty)}">&#9998; Edit</button>
          </td>
        `;
      } else {
        tr.innerHTML = subjectSlotHTML;
      }

      tbody.appendChild(tr);
    });
  });

  // Bind edit buttons
  tbody.querySelectorAll('.btn-edit-faculty').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.faculty));
  });
}

/* ============================================================
   7. GA SCHEDULE TABLE
   ============================================================ */
function renderGASchedule(data) {
  const tbody = document.querySelector('#gaScheduleTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Sort by day then time slot
  const sorted = [...data].sort((a, b) => {
    const parseSlot = s => {
      const [dayPart, timePart] = s.split(':');
      return { day: dayPart.trim(), unit: parseInt((timePart || '0').trim()) };
    };
    const sA = parseSlot(a.slot), sB = parseSlot(b.slot);
    return (DAY_ORDER[sA.day] - DAY_ORDER[sB.day]) || (sA.unit - sB.unit);
  });

  // Apply current sort
  applySort(sorted, lastSort.key, lastSort.ascending);

  sorted.forEach(item => {
    const day = item.slot.split(':')[0].trim();
    const tr = document.createElement('tr');
    tr.dataset.day = day;
    tr.innerHTML = `
      <td>${escapeHTML(item.faculty)}</td>
      <td>${escapeHTML(item.subject)}</td>
      <td>${escapeHTML(item.type)}</td>
      <td>${escapeHTML(item.slot)}</td>
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
        return { day: d.trim(), unit: parseInt((t || '0').trim()) };
      };
      const sA = ps(a.slot), sB = ps(b.slot);
      const dd = DAY_ORDER[sA.day] - DAY_ORDER[sB.day];
      if (dd !== 0) return dd * dir;
      return (sA.unit - sB.unit) * dir;
    }
    const va = String(a[key] || ''), vb = String(b[key] || '');
    if (!isNaN(va) && !isNaN(vb)) return (Number(va) - Number(vb)) * dir;
    return va.localeCompare(vb) * dir;
  });
}

function enableTableSort() {
  const table = document.getElementById('gaScheduleTable');
  if (!table) return;

  const headers = table.querySelectorAll('th[data-key]');
  headers.forEach(header => {
    // Remove old listeners by cloning
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);

    newHeader.addEventListener('click', () => {
      const key = newHeader.dataset.key;
      if (lastSort.key === key) {
        lastSort.ascending = !lastSort.ascending;
      } else {
        lastSort.key = key;
        lastSort.ascending = true;
      }

      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));

      const rowData = rows.map(r => ({
        faculty: r.children[0]?.textContent.trim() || '',
        subject: r.children[1]?.textContent.trim() || '',
        type:    r.children[2]?.textContent.trim() || '',
        slot:    r.children[3]?.textContent.trim() || '',
        el:      r
      }));

      applySort(rowData, lastSort.key, lastSort.ascending);
      tbody.innerHTML = '';
      rowData.forEach(d => tbody.appendChild(d.el));

      table.querySelectorAll('th[data-key] .sort-arrow').forEach(el => { el.innerHTML = '&#9650;'; });
      const arrow = newHeader.querySelector('.sort-arrow');
      if (arrow) arrow.innerHTML = lastSort.ascending ? '&#9650;' : '&#9660;';
    });
  });
}

/* ============================================================
   8. GA PROGRESS BAR
   ============================================================ */
const progressFill = document.querySelector('#gaProgressBar .fill');

function updateProgress(current, total) {
  const pct = Math.min(100, (current / total) * 100);
  if (!progressFill) return;
  progressFill.style.width = pct + '%';
  progressFill.style.backgroundColor = getProgressColor(pct);
}

/* ============================================================
   9. RUN GA
   ============================================================ */
async function startGA(population, generations, mutation, crossover) {
  let subjects = getSubjectsFromTable();
  if (!subjects || !subjects.length) subjects = DEFAULT_SUBJECTS;

  const expandedSubjects = subjects.map(sub => ({
    name:  sub.name,
    type:  sub.type,
    hours: (Number(sub.lec_units) || 0) + ((Number(sub.lab_units) || 0) * 3)
  }));

  const payload = {
    faculty:     getFacultyFromTable(),
    subjects:    expandedSubjects,
    population:  Number(population),
    generations: Number(generations),
    mutation:    Number(mutation),
    crossover:   Number(crossover)
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
  const runBtn      = document.getElementById('runGA');
  const loading     = document.getElementById('gaLoading');
  const tableWrapper= document.getElementById('gaTableWrapper');
  const genCounter  = document.getElementById('generationCounter');

  if (!runBtn) return;

  runBtn.addEventListener('click', async () => {
    const popSize    = document.getElementById('populationSize').value;
    const generations= document.getElementById('numGenerations').value;
    const mutRate    = document.getElementById('mutationRate').value;
    const crossover  = document.getElementById('crossoverRate').value;

    loading.classList.remove('hidden');
    tableWrapper.classList.add('hidden');
    runBtn.disabled = true;

    if (progressFill) { progressFill.style.width = '0%'; }
    if (genCounter) genCounter.textContent = '0';

    try {
      await startGA(popSize, generations, mutRate, crossover);
    } catch (err) {
      console.error('GA start error:', err);
      loading.classList.add('hidden');
      runBtn.disabled = false;
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API_BASE}/progress`);
        const data = await res.json();

        const pct = data.total ? Math.min(100, (data.current / data.total) * 100) : 0;
        if (genCounter) genCounter.textContent = data.current || '0';
        updateProgress(data.current, data.total);
        updateMiniFromServer(data);

        if (!data.running) {
          clearInterval(interval);
          tableWrapper.classList.remove('hidden');
          loading.classList.add('hidden');
          runBtn.disabled = false;

          if (Array.isArray(data.result) && data.result.length > 0) {
            lastGAResult = data.result;
            renderGASchedule(data.result);
            updateCharts(data.result);
            updateReportsPanel(data.result);
            renderTimetable(data.result);
            renderFacultySubjectsSummary(data.result);
          }
        }
      } catch (err) {
        console.error('Progress poll error:', err);
      }
    }, 200);
  });
}

/* ============================================================
   10. FACULTY MANAGEMENT
   ============================================================ */
function getFacultyFromTable() {
  const rows = document.querySelectorAll('#facultyInputTable tbody tr');
  const result = [];

  rows.forEach(row => {
    const nameEl  = row.querySelector('td:nth-child(1) input[type="text"]');
    const maxEl   = row.querySelector('td:nth-child(3) input[type="number"]');
    if (!nameEl || !maxEl) return;

    const name = nameEl.value.trim();
    const specialization = Array.from(
      row.querySelectorAll('td:nth-child(2) input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    const availability = [];
    row.querySelectorAll('td:nth-child(4) input[type="checkbox"]').forEach(cb => {
      if (cb.checked) {
        for (const key in DAY_MAP) {
          if (DAY_MAP[key] === cb.value) availability.push(key);
        }
      }
    });

    const absolute_max_units = parseInt(maxEl.value) || 30;

    if (name && specialization.length > 0) {
      result.push({
        name,
        specialization,
        max_units: absolute_max_units,
        absolute_max_units,
        availability
      });
    }
  });

  return result;
}

function addFacultyRow(facultyData = null) {
  const tbody = document.querySelector('#facultyInputTable tbody');
  if (!tbody) return;

  const nameValue    = facultyData?.name || '';
  const specsSelected= facultyData?.specialization || [];
  const daysSelected = (facultyData?.availability || []).map(d => DAY_MAP[d]);
  const maxUnits     = facultyData?.absolute_max_units || 30;

  const tr = document.createElement('tr');

  const checkboxHTML = SPECIALIZATIONS.map(spec => `
    <label>
      <input type="checkbox" value="${escapeAttr(spec)}" ${specsSelected.includes(spec) ? 'checked' : ''}>
      ${escapeHTML(spec)}
    </label>
  `).join('');

  const daysHTML = Object.entries(DAY_MAP).map(([short, long]) => `
    <label>
      <input type="checkbox" value="${long}" ${daysSelected.includes(long) ? 'checked' : ''}>${short}
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
    <td><input type="number" value="${maxUnits}" min="0" max="50"></td>
    <td><div class="avail-checkboxes">${daysHTML}</div></td>
    <td><button type="button" class="btn-remove btn">Remove</button></td>
  `;

  // Dropdown toggle
  const dropBtn = tr.querySelector('.dropdown-btn');
  const dropContent = tr.querySelector('.dropdown-content');
  const dropdown = tr.querySelector('.multi-select-dropdown');

  dropBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');

    // Close all other dropdowns first
    document.querySelectorAll('.multi-select-dropdown.open').forEach(d => {
      d.classList.remove('open');
    });

    if (!isOpen) {
      dropdown.classList.add('open');
      // Position dropdown using fixed coords so it escapes any overflow:hidden parent
      const rect = dropBtn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const panelH = Math.min(260, spaceBelow - 8);
      dropContent.style.top    = (rect.bottom + 4) + 'px';
      dropContent.style.left   = rect.left + 'px';
      dropContent.style.width  = Math.max(300, rect.width) + 'px';
      dropContent.style.maxHeight = Math.max(120, panelH) + 'px';
    }
  });

  // OK button
  const okBtn = tr.querySelector('.dropdown-ok-btn');
  okBtn.addEventListener('click', e => {
    e.stopPropagation();
    confirmDropdownSelection(dropdown);
  });

  // Remove button
  tr.querySelector('.btn-remove').addEventListener('click', () => {
    tr.remove();
    saveFacultyToStorage();
  });

  // Save on input change
  tr.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', saveFacultyToStorage);
    inp.addEventListener('input', saveFacultyToStorage);
  });

  tbody.appendChild(tr);
}

function confirmDropdownSelection(dropdown) {
  const checked = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => cb.value);
  const display = checked.length ? checked.join(', ') : 'Choose Specialization';
  const btn = dropdown.querySelector('.dropdown-btn');
  const truncated = display.length > 45 ? display.substring(0, 45) + '...' : display;
  btn.textContent = truncated;
  btn.title = display;
  dropdown.classList.remove('open');
  saveFacultyToStorage();
}

function saveFacultyToStorage() {
  try {
    localStorage.setItem('facultyData', JSON.stringify(getFacultyFromTable()));
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

function initFacultyManagement() {
  const addBtn = document.getElementById('addFacultyRow');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addFacultyRow();
      saveFacultyToStorage();
    });
  }

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.multi-select-dropdown')) {
      document.querySelectorAll('.multi-select-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });

  // Reposition on scroll/resize — keeps fixed dropdown aligned with button
  const reposition = () => {
    document.querySelectorAll('.multi-select-dropdown.open').forEach(d => {
      const btn = d.querySelector('.dropdown-btn');
      const content = d.querySelector('.dropdown-content');
      if (!btn || !content) return;
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const panelH = Math.min(260, spaceBelow - 8);
      content.style.top  = (rect.bottom + 4) + 'px';
      content.style.left = rect.left + 'px';
      content.style.maxHeight = Math.max(120, panelH) + 'px';
    });
  };
  document.querySelectorAll('.panel').forEach(p =>
    p.addEventListener('scroll', reposition, { passive: true })
  );
  window.addEventListener('resize', reposition, { passive: true });
}

/* ============================================================
   11. SUBJECTS MANAGEMENT
   ============================================================ */
function addSubjectRow(subject = {}) {
  const tbody = document.querySelector('#subjectsTable tbody');
  if (!tbody) return;

  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <select class="subject-year">
        <option value="1st Year">1st Year</option>
        <option value="2nd Year">2nd Year</option>
        <option value="3rd Year">3rd Year</option>
      </select>
    </td>
    <td>
      <select class="subject-semester">
        <option value="1st Semester">1st Semester</option>
        <option value="2nd Semester">2nd Semester</option>
      </select>
    </td>
    <td><input type="text" class="subject-name" placeholder="Subject name"></td>
    <td>
      <select class="subject-type">
        <option value="Software">Software</option>
        <option value="Database">Database</option>
        <option value="Networking">Networking</option>
        <option value="Elective">Elective</option>
      </select>
    </td>
    <td><input type="number" class="lec" min="0"></td>
    <td><input type="number" class="lab" min="0"></td>
    <td class="total-hours">0</td>
    <td><button type="button" class="btn-delete btn">Delete</button></td>
  `;

  // Set values
  row.querySelector('.subject-year').value     = subject.year || '1st Year';
  row.querySelector('.subject-semester').value = subject.semester || '1st Semester';
  row.querySelector('.subject-name').value     = subject.name || '';
  row.querySelector('.subject-type').value     = subject.type || 'Software';
  row.querySelector('.lec').value              = subject.lec_units ?? 0;
  row.querySelector('.lab').value              = subject.lab_units ?? 0;

  const lecInput  = row.querySelector('.lec');
  const labInput  = row.querySelector('.lab');
  const totalCell = row.querySelector('.total-hours');

  const updateTotal = () => {
    totalCell.textContent = (parseInt(lecInput.value) || 0) + (parseInt(labInput.value) || 0);
    saveSubjects();
  };

  lecInput.addEventListener('input', updateTotal);
  labInput.addEventListener('input', updateTotal);
  updateTotal();

  row.querySelector('.btn-delete').addEventListener('click', () => {
    row.remove();
    saveSubjects();
    renderSubjectsGrouped();
  });

  row.querySelectorAll('select, input[type="text"]').forEach(el => {
    el.addEventListener('change', () => { saveSubjects(); renderSubjectsGrouped(); });
  });

  tbody.appendChild(row);
}

function getSubjectsFromTable() {
  return Array.from(document.querySelectorAll('#subjectsTable tbody tr')).map(row => ({
    year:      row.querySelector('.subject-year')?.value || '',
    semester:  row.querySelector('.subject-semester')?.value || '',
    name:      row.querySelector('.subject-name')?.value || '',
    type:      row.querySelector('.subject-type')?.value || '',
    lec_units: Number(row.querySelector('.lec')?.value || 0),
    lab_units: Number(row.querySelector('.lab')?.value || 0),
    hours:     (Number(row.querySelector('.lec')?.value || 0)) +
               (Number(row.querySelector('.lab')?.value || 0) * 3)
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
  const grouped  = {};

  subjects.forEach(sub => {
    const key = `${sub.year} – ${sub.semester}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(sub);
  });

  container.innerHTML = '';

  Object.entries(grouped).forEach(([key, items]) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>${escapeHTML(key)}</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Type</th><th>Lec</th><th>Lab</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(s => `
            <tr>
              <td>${escapeHTML(s.name)}</td>
              <td>${escapeHTML(s.type)}</td>
              <td>${s.lec_units}</td>
              <td>${s.lab_units}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.appendChild(div);
  });
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
   11b. TIMETABLE RENDER
   ============================================================ */
function renderTimetable(data) {
  const container = document.getElementById('facultyTimetableContainer');
  if (!container) return;

  const TIME_SLOTS = ['7-9', '9-11', '11-13', '13-15', '15-17', '17-19'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build lookup: "Day-time" -> [{faculty, subject}]
  const lookup = {};
  data.forEach(item => {
    const parts = item.slot.split(':');
    const day  = parts[0].trim();
    const time = (parts[1] || '').trim();
    const key  = `${day}-${time}`;
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push({ faculty: item.faculty, subject: item.subject });
  });

  let html = '<div class="timetable-scroll"><table class="timetable-grid"><thead><tr>';
  html += '<th class="tt-time-col">Time</th>';
  DAYS.forEach(d => { html += `<th class="tt-day-col tt-hd-${d}">${d}</th>`; });
  html += '</tr></thead><tbody>';

  TIME_SLOTS.forEach(slot => {
    html += `<tr><td class="tt-time-label">${slot}</td>`;
    DAYS.forEach(day => {
      const key = `${day}-${slot}`;
      const entries = lookup[key] || [];
      if (entries.length === 0) {
        html += `<td class="tt-cell tt-empty"></td>`;
      } else {
        html += `<td class="tt-cell tt-filled tt-bg-${day}">`;
        entries.forEach(e => {
          html += `<div class="tt-entry">
            <div class="tt-faculty-tag">${escapeHTML(e.faculty)}</div>
            <div class="tt-subject-tag">${escapeHTML(e.subject)}</div>
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
   11c. DASHBOARD FACULTY SUBJECT SUMMARY
   ============================================================ */
function renderFacultySubjectsSummary(data) {
  const container = document.getElementById('dashboardFacultyAssignments');
  if (!container) return;

  const byFaculty = {};
  data.forEach(item => {
    if (!item.faculty) return;
    if (!byFaculty[item.faculty]) byFaculty[item.faculty] = new Set();
    byFaculty[item.faculty].add(item.subject);
  });

  if (!Object.keys(byFaculty).length) {
    container.innerHTML = '<p class="empty-state-msg">No assignments to display.</p>';
    return;
  }

  let html = '<div class="fac-assign-grid">';
  Object.keys(byFaculty).sort().forEach(faculty => {
    const subjects = Array.from(byFaculty[faculty]);
    const units = (data.filter(d => d.faculty === faculty).length) * 2;
    const colorClass = units > MAX_UNITS ? 'units-over' : units === MAX_UNITS ? 'units-max' : 'units-ok';
    html += `<div class="fac-assign-card">
      <div class="fac-assign-header">
        <span class="fac-assign-avatar">${escapeHTML(faculty.charAt(0))}</span>
        <span class="fac-assign-name">${escapeHTML(faculty)}</span>
        <span class="units-badge ${colorClass}">${units}u</span>
      </div>
      <div class="fac-assign-chips">
        ${subjects.map(s => `<span class="subject-chip">${escapeHTML(s)}</span>`).join('')}
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

/* ============================================================
   11d. EDIT MODAL
   ============================================================ */
function openEditModal(facultyName) {
  const modal    = document.getElementById('editModal');
  const nameInp  = document.getElementById('editFacultyName');
  const maxInp   = document.getElementById('editMaxUnits');
  const title    = document.getElementById('editModalTitle');
  if (!modal) return;

  // Find stored max units
  const stored = loadFacultyFromStorage() || INITIAL_FACULTY;
  const fac = stored.find(f => f.name === facultyName);

  if (title)   title.textContent = `Edit: ${facultyName}`;
  if (nameInp) nameInp.value = facultyName;
  if (maxInp)  maxInp.value  = fac ? (fac.absolute_max_units || fac.max_units || 30) : 30;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => maxInp && maxInp.focus(), 120);
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function initEditModal() {
  const modal     = document.getElementById('editModal');
  const closeBtn  = document.getElementById('editModalClose');
  const cancelBtn = document.getElementById('editModalCancel');
  const saveBtn   = document.getElementById('editModalSave');

  closeBtn?.addEventListener('click',  closeEditModal);
  cancelBtn?.addEventListener('click', closeEditModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeEditModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditModal();
  });

  saveBtn?.addEventListener('click', () => {
    const facultyName = document.getElementById('editFacultyName')?.value;
    const newMax = parseInt(document.getElementById('editMaxUnits')?.value) || 30;
    if (!facultyName) return;

    // Update the faculty table row
    document.querySelectorAll('#facultyInputTable tbody tr').forEach(row => {
      const nameEl = row.querySelector('td:nth-child(1) input[type="text"]');
      if (nameEl && nameEl.value.trim() === facultyName) {
        const maxEl = row.querySelector('td:nth-child(3) input[type="number"]');
        if (maxEl) maxEl.value = newMax;
      }
    });

    saveFacultyToStorage();
    closeEditModal();
    showToast(`✓ Updated ${facultyName}'s max units → ${newMax}`);
  });
}

function showToast(msg) {
  const t = document.getElementById('toastNotif');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* ============================================================
   12. EXPORT FUNCTIONS
   ============================================================ */
function initExports() {
  const csvBtn = document.getElementById('exportCSV');
  const pdfBtn = document.getElementById('exportPDF');

  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      const rows = Array.from(document.querySelectorAll('#reportsSummaryTable tr'));
      const csv  = rows.map(r =>
        Array.from(r.children).map(td => `"${td.innerText.replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      downloadFile(csv, 'atlas_psu_reports.csv', 'text/csv');
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      if (!window.jspdf) { alert('jsPDF not loaded.'); return; }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const table = document.getElementById('reportsSummaryTable');
      if (!table) return;

      let y = 16;
      doc.setFontSize(14);
      doc.text('ATLAS PSU - Faculty Load Summary', 14, y);
      y += 10;
      doc.setFontSize(10);

      Array.from(table.rows).forEach(row => {
        Array.from(row.cells).forEach((cell, j) => {
          doc.text(cell.innerText, 14 + j * 60, y);
        });
        y += 8;
        if (y > 280) { doc.addPage(); y = 16; }
      });

      doc.save('atlas_psu_reports.pdf');
    });
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href  = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ============================================================
   13. UTILITY FUNCTIONS
   ============================================================ */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    localStorage.setItem('atlasDataVersion', DATA_VERSION);
  }

  initCharts();
  initNavigation();
  initRunGA();
  initFacultyManagement();
  initSubjectsManagement();
  initExports();
  initEditModal();

  // Load faculty
  const savedFaculty = loadFacultyFromStorage();
  if (savedFaculty && savedFaculty.length > 0) {
    savedFaculty.forEach(f => addFacultyRow(f));
  } else {
    INITIAL_FACULTY.forEach(f => addFacultyRow(f));
  }

  // Load subjects
  const savedSubjects = loadSubjectsFromStorage();
  if (savedSubjects && savedSubjects.length > 0) {
    savedSubjects.forEach(s => addSubjectRow(s));
  } else {
    DEFAULT_SUBJECTS.forEach(s => addSubjectRow(s));
  }

  renderSubjectsGrouped();
});

// Expose needed globals for inline HTML (legacy support)
window.switchPanel = switchPanel;