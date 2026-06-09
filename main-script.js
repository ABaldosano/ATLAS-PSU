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
  { name: 'Prof A',  specialization: ['Cybersecurity / Information Assurance'],          max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof B',  specialization: ['Systems Architecture / Enterprise Systems'],       max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof C',    specialization: ['Software Engineering / Programming Languages'],    max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof D',     specialization: ['Data Science / Applied Mathematics'],              max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof E',   specialization: ['Computer Networks / Network Engineering'],         max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof F',      specialization: ['Emerging Technologies / Application Development'], max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof G', specialization: ['Software Engineering / Systems Integration'],      max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof H',   specialization: ['Information Systems / Database Management'],       max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof I',  specialization: ['Human-Computer Interaction (HCI)'],                max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] },
  { name: 'Prof J',     specialization: ['Database Systems / Information Systems'],          max_units: 24, absolute_max_units: 30, availability: ['Mon','Tue','Wed','Thu'] }
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
  { name: 'Systems Integration and Architecture 1',             type: 'Software',    year: '2nd Year', semester: '3rd Semester', lec_units: 3, lab_units: 0 },
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
  const labels = sorted.map(x => x[0]);
  const values = sorted.map(x => x[1]);
  const colors = values.map(v => getLoadColor(v));

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
}

/* ============================================================
   6. ANALYTICS & FAIRNESS REPORT
   ============================================================ */
const TYPE_SPEC_KEYWORDS = {
  Software:  ['software','programming','application','emerging','integration','web','multimedia','embedded','hci','human-computer','graphics','visual','algorithms','data structures','gis','geographic'],
  Database:  ['database','information systems','information management'],
  Networking:['network','cybersecurity','information assurance'],
  Elective:  [] // electives match any
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
  const loadMap = {};
  data.forEach(item => {
    if (!item.faculty) return;
    loadMap[item.faculty] = (loadMap[item.faculty] || 0) + 2; // each item is 2 units
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
  el('fairnessSumUnits').textContent = sumLoads + ' u';
  el('fairnessStdDev').textContent = stdDev.toFixed(2) + ' u';
  el('fairnessMatchRate').textContent = matchRate.toFixed(1) + '%';

  // Per-faculty table
  const container = document.getElementById('fairnessPerFaculty');
  if (!container) return;

  const rows = Object.keys(perFaculty).sort().map(name => {
    const d = perFaculty[name];
    const pct = d.total ? Math.round((d.matched / d.total) * 100) : 0;
    const cls = pct === 100 ? 'match-yes' : pct >= 50 ? 'match-partial' : 'match-no';
    const loadCls = d.load > MAX_UNITS ? 'badge-danger' : d.load === MAX_UNITS ? 'badge-warning' : 'badge-success';

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
  const tbody = document.querySelector('#gaResultsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state-msg">No optimal assignments found. Adjust parameters and click "Run Engine".</td></tr>';
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
        return (DAY_ORDER[d.trim()] * 100) + parseInt(t || '0');
      };
      return (ps(a.slot) - ps(b.slot)) * dir;
    }
    return (a[key] || '').localeCompare(b[key] || '') * dir;
  });
}

function enableTableSort() {
  document.querySelectorAll('#gaResultsTable th[data-sort]').forEach(th => {
    // Clean old listeners
    const cloned = th.cloneNode(true);
    th.parentNode.replaceChild(cloned, th);

    // Active arrow indicator
    if (cloned.dataset.sort === lastSort.key) {
      cloned.classList.add('sorted-active');
      cloned.classList.toggle('sorted-desc', !lastSort.ascending);
    } else {
      cloned.classList.remove('sorted-active', 'sorted-desc');
    }

    cloned.addEventListener('click', () => {
      if (lastSort.key === cloned.dataset.sort) {
        lastSort.ascending = !lastSort.ascending;
      } else {
        lastSort.key = cloned.dataset.sort;
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
const progressFill = document.getElementById('gaProgressFill');

async function triggerGARunAPI() {
  const population  = document.getElementById('populationSize').value;
  const generations = document.getElementById('numGenerations').value;
  const mutation    = document.getElementById('mutationRate').value;
  const crossover   = document.getElementById('crossoverRate').value;

  // Transform UI subjects list to match backend specification format properties payload architecture requirements
  const rawSubjects = getSubjectsFromTable();
  const expandedSubjects = [];
  rawSubjects.forEach(s => {
    const count = s.hours / 2; // Assuming 2 hours per block segment schedule layout structure paradigm
    for(let i=0; i<count; i++) {
      expandedSubjects.push({ name: s.name, type: s.type, hours: 2 });
    }
  });

  const payload = {
    faculty:    getFacultyFromTable(),
    subjects:   expandedSubjects,
    population: Number(population),
    generations:Number(generations),
    mutation:   Number(mutation),
    crossover:  Number(crossover)
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
            const pct = Math.round((status.current / status.total) * 100);
            if (progressFill) {
              progressFill.style.width = pct + '%';
              progressFill.style.backgroundColor = getProgressColor(pct);
            }
            if (genCounter) {
              genCounter.textContent = `Generations Optimized: ${status.current} / ${status.total}`;
            }
          }

          if (!status.running) {
            clearInterval(progressInterval);
            loading.classList.add('hidden');
            tableWrapper.classList.remove('hidden');
            runBtn.disabled = false;

            lastGAResult = status.result || [];
            renderTable(lastGAResult);
            updateCharts(lastGAResult);
            computeFairnessReport(lastGAResult);
            renderDashboardAssignments(lastGAResult);
            renderSubjectsGrouped();
            showToast('Optimization Run Complete!', 'success');
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
  const tbody = document.querySelector('#facultyInputTable tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');

  const nameValue     = data.name || '';
  const specsSelected = data.specialization || [];
  const maxUnits      = data.max_units !== undefined ? data.max_units : 24;
  const daysSelected  = data.availability || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

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
    <td><button type="button" class="btn-delete row-action-btn" title="Delete Row">×</button></td>
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

function selectAllByDay(dayLong) {
  const checkboxes = document.querySelectorAll(`#facultyTable tbody input[value="${dayLong}"]`);
  if (!checkboxes.length) return;

  // Check if all are currently checked to toggle state correctly
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  checkboxes.forEach(c => { c.checked = !allChecked; });
  
  saveFaculty();
  updateAllSelectAllBtnStates();
}

function updateAllSelectAllBtnStates() {
  Object.entries(DAY_MAP).forEach(([short, long]) => {
    const btn = document.querySelector(`.btn-select-day[data-day="${long}"]`);
    if (!btn) return;

    const checkboxes = document.querySelectorAll(`#facultyTable tbody input[value="${long}"]`);
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
    const maxUnits = parseInt(row.querySelector('input[type="number"]').value, 10) || 24;
    const avail = Array.from(row.querySelectorAll('.avail-checkboxes input:checked')).map(c => c.value);

    return {
      name,
      specialization: specs,
      max_units: maxUnits,
      absolute_max_units: maxUnits + 6, // Buffer margin limit definition mapping metric rules
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

function initFacultyManagement() {
  const addBtn = document.getElementById('addFacultyRow');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addFacultyRow();
      saveFacultyToStorage();
      updateAllSelectAllBtnStates();
    });
  }

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
  const type     = data.type || 'Software';
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
        <option ${type==='Software'?'selected':''}>Software</option>
        <option ${type==='Database'?'selected':''}>Database</option>
        <option ${type==='Networking'?'selected':''}>Networking</option>
        <option ${type==='Elective'?'selected':''}>Elective</option>
      </select>
    </td>
    <td><input type="number" class="unit-input lec" value="${lec}" min="0" max="10"></td>
    <td><input type="number" class="unit-input lab" value="${lab}" min="0" max="10"></td>
    <td><button type="button" class="btn-delete row-action-btn" title="Delete Row">×</button></td>
  `;

  // Dynamic change tracker loops listeners attachments
  tr.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', saveSubjects);
    if(el.tagName === 'INPUT') {
      el.addEventListener('input', debounce(saveSubjects, 500));
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
    container.innerHTML = '<p class="empty-state-msg">No subjects mapped yet. Populate the table configuration list layout profile.</p>';
    return;
  }

  let html = '<div class="curriculum-grid">';
  Object.keys(grouped).sort().forEach(key => {
    html += `
      <div class="curriculum-card">
        <div class="curriculum-header">${escapeHTML(key)}</div>
        <div class="curriculum-body">
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
                  <td><span class="type-tag ${s.type.toLowerCase()}">${escapeHTML(s.type)}</span></td>
                  <td class="txt-center">${s.lec_units}</td>
                  <td class="txt-center">${s.lab_units}</td>
                  <td class="txt-center font-mono">${s.hours}h</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
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

    html += `
      <div class="fac-assign-card">
        <div class="fac-assign-header">
          <span class="fac-assign-avatar">${escapeHTML(faculty.charAt(0))}</span>
          <span class="fac-assign-name">${escapeHTML(faculty)}</span>
          <span class="units-badge ${colorClass}">${units}u</span>
        </div>
        <div class="fac-assign-body">
          <ul class="fac-assign-list">
            ${subjects.map(s => `
              <li>
                <span class="dot"></span>
                <span class="name" title="${escapeAttr(s)}">${escapeHTML(s)}</span>
              </li>
            `).join('')}
          </ul>
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
      const headers = ['Faculty Member', 'Subject Title', 'Classification Type', 'Schedule Slot Assigned'];
      const rows = Array.from(document.querySelectorAll('#gaResultsTable tbody tr'));
      
      const csv = [headers.join(',')].concat(
        rows.map(r => Array.from(r.children).map(td => `"${td.innerText.replace(/"/g, '""')}"`).join(','))
      ).join('\n');

      downloadFile(csv, 'atlas_psu_reports.csv', 'text/csv');
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

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  // Compute breakdown mapping metric profiles internally
  const byFaculty = {};
  lastGAResult.forEach(item => {
    if (!item.faculty) return;
    if (!byFaculty[item.faculty]) byFaculty[item.faculty] = [];
    byFaculty[item.faculty].push(item);
  });

  const facultyRows = Object.keys(byFaculty).sort().map(facName => {
    const items = byFaculty[facName];
    const units = items.length * 2;
    const subjectsList = Array.from(new Set(items.map(i => i.subject))).join(', ');
    const loadStatus = units > MAX_UNITS ? 'OVERLOAD' : units === MAX_UNITS ? 'MAX LOAD' : 'NORMAL';
    return `
      <tr>
        <td><strong>${escapeHTML(facName)}</strong></td>
        <td class="txt-center font-mono">${units} u</td>
        <td><span class="print-status-tag ${loadStatus.toLowerCase().replace(' ', '')}">${loadStatus}</span></td>
        <td>${escapeHTML(subjectsList)}</td>
      </tr>
    `;
  }).join('');

  const scheduleRows = [...lastGAResult].sort((a, b) => {
    const ps = s => {
      const [d, t] = s.split(':');
      return (DAY_ORDER[d.trim()] * 100) + parseInt(t || '0');
    };
    return ps(a.slot) - ps(b.slot);
  }).map(item => `
    <tr>
      <td class="font-mono"><strong>${escapeHTML(item.slot)}</strong></td>
      <td>${escapeHTML(item.subject)}</td>
      <td><span class="type-tag ${item.type.toLowerCase()}">${escapeHTML(item.type)}</span></td>
      <td><strong>${escapeHTML(item.faculty)}</strong></td>
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
      font-family: 'Inter', Arial, sans-serif;
      font-size: 10.5pt;
      color: #1e293b;
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
      background: linear-gradient(145deg, #1a0a04 0%, #6b2106 55%, #c0440a 100%);
      color: #fff;
      page-break-after: always;
    }
    .cover-logo {
      width: 72px;
      height: 72px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      font-size: 24pt;
      font-weight: bold;
    }
    .cover h1 {
      font-size: 28pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 12px;
    }
    .cover .subtitle {
      font-size: 14pt;
      opacity: 0.9;
      margin-bottom: 48px;
      font-weight: 400;
    }
    .cover-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      max-width: 500px;
      width: 100%;
      text-align: left;
      background: rgba(0, 0, 0, 0.2);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .cover-meta-item {
      display: flex;
      flex-direction: column;
    }
    .cover-meta-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
      margin-bottom: 4px;
    }
    .cover-meta-value {
      font-size: 11pt;
      font-weight: 600;
    }

    /* ── REPORT CONTENT STYLES ── */
    .page {
      padding: 50px 60px;
      page-break-after: always;
    }
    .page:last-child {
      page-break-after: avoid;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 30px;
    }
    .page-header h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .page-header .page-meta {
      font-size: 9pt;
      color: #64748b;
    }
    h3 {
      font-size: 12pt;
      color: #0f172a;
      margin-bottom: 16px;
      font-weight: 700;
    }

    /* ── ANALYTICS CARDS ── */
    .fairness-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 32px;
    }
    .fairness-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      background: #f8fafc;
    }
    .fairness-item .f-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #64748b;
      font-weight: 600;
    }
    .fairness-item .f-value {
      font-size: 22pt;
      font-weight: 700;
      margin: 4px 0 2px;
      line-height: 1;
    }
    .fairness-item .f-sub {
      font-size: 8pt;
      color: #94a3b8;
    }

    /* ── FACULTY TABLE ── */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-bottom: 24px;
    }
    .report-table thead tr {
      background: #1a0a04;
      color: #fff;
    }
    .report-table th {
      padding: 10px 12px;
      font-weight: 600;
      text-align: left;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .report-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .report-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .txt-center { text-align: center !important; }
    .font-mono { font-family: 'JetBrains Mono', Consolas, monospace; }

    /* Tags */
    .print-status-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .print-status-tag.normal { background: #dcfce7; color: #15803d; }
    .print-status-tag.maxload { background: #fef3c7; color: #b45309; }
    .print-status-tag.overload { background: #fee2e2; color: #b91c1c; }

    .type-tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
    }
    .type-tag.software { background: #e0f2fe; color: #0369a1; }
    .type-tag.database { background: #f3e8ff; color: #6b21a8; }
    .type-tag.networking { background: #e2e8f0; color: #475569; }
    .type-tag.elective { background: #fef3c7; color: #d97706; }

    /* ── SIGNATURE STAMPS ── */
    .sign-zone {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .sign-block {
      width: 240px;
      text-align: center;
    }
    .sign-line {
      border-top: 1px solid #94a3b8;
      margin-top: 45px;
      margin-bottom: 6px;
    }
    .sign-title {
      font-size: 9pt;
      color: #64748b;
    }

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
        <div class="f-sub">Equality metric (0-1)</div>
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
          <th style="width: 130px;">Status Tag</th>
          <th>Subjects Pool Matrix Track</th>
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
        <strong>Dr. Jane Doe</strong><br>
        <span class="sign-title">College Dean</span>
      </div>
    </div>
  </div>

  <div class="page">
    <div class="page-header">
      <h2>II. Master Schedule Allocations Matrix</h2>
      <span class="page-meta">ATLAS PSU Engine · Page 3</span>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 180px;">Time Slot & Day</th>
          <th>Subject Description Name Title</th>
          <th style="width: 120px;">Domain Type</th>
          <th>Assigned Professor</th>
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
    localStorage.setItem('atlasDataVersion', DATA_VERSION);
  }

  initCharts();
  initNavigation();
  initRunGA();
  initFacultyManagement();
  initSubjectsManagement();
  initExports();

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
});