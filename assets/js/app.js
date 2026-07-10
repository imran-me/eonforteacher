/* ==========================================================
   EON FOR TEACHER — shared engine (assets/js/app.js)
   Chrome (sidebar/topbar), helpers, the analytics core every
   page reads, and the page initializers. Classic script, no
   framework, fully offline. Reads window.T (data/seed.js).
   ========================================================== */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtD = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); };
const daysUntil = (iso) => { const t = Date.parse(iso); return isNaN(t) ? null : Math.ceil((t - Date.now()) / 86400000); };
const pct = (x) => Math.round(x * 100);
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const initials = (name) => String(name).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
function toast(msg) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#111a2e;color:#fff;padding:10px 18px;border-radius:11px;font:600 13px Inter,sans-serif;z-index:200;box-shadow:0 10px 30px rgba(0,0,0,.3);transition:opacity .3s'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1'; clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = '0', 2600);
}
function openModal(title, bodyHtml, footHtml) {
  $('#tOverlay')?.remove();
  const o = document.createElement('div'); o.id = 'tOverlay'; o.className = 'overlay show';
  o.innerHTML = `<div class="modal"><div class="modal-head"><b>${title}</b><button class="x">✕</button></div><div class="modal-body">${bodyHtml}</div>${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}</div>`;
  document.body.appendChild(o);
  o.querySelector('.x').onclick = () => o.remove();
  o.addEventListener('click', e => { if (e.target === o) o.remove(); });
  return o;
}

/* ---------- inline SVG mini-charts (offline, no libs) ---------- */
function sparkSvg(vals, w = 90, h = 26, color = 'var(--primary)') {
  if (!vals || vals.length < 2) return '';
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v - min) / span * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/><circle r="2.5" fill="${color}" cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}"/></svg>`;
}
function lineChart(series, labels, { w = 520, h = 170, fmt = (v) => v } = {}) {
  const all = series.flatMap(s => s.vals);
  const min = Math.min(...all) * 0.97, max = Math.max(...all) * 1.03, span = (max - min) || 1;
  const X = i => 42 + i / (labels.length - 1 || 1) * (w - 60);
  const Y = v => 14 + (1 - (v - min) / span) * (h - 44);
  const grid = [0, .5, 1].map(f => { const v = min + f * span; return `<line x1="42" x2="${w - 14}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="36" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="var(--text-faint)" font-family="JetBrains Mono">${fmt(Math.round(v * 10) / 10)}</text>`; }).join('');
  const lines = series.map(s => `<polyline points="${s.vals.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.4"/>` + s.vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${s.color}"><title>${s.name}: ${fmt(v)}</title></circle>`).join('')).join('');
  const xl = labels.map((l, i) => `<text x="${X(i)}" y="${h - 6}" text-anchor="middle" font-size="9" fill="var(--text-faint)" font-family="Inter">${esc(String(l).slice(0, 12))}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%">${grid}${lines}${xl}</svg>`;
}
function histogram(values, totalMarks, { w = 480, h = 150 } = {}) {
  const B = 10, buckets = new Array(B).fill(0);
  values.forEach(v => buckets[Math.min(B - 1, Math.floor(v / totalMarks * B))]++);
  const max = Math.max(...buckets, 1), bw = (w - 50) / B;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%">${buckets.map((c, i) => {
    const bh = c / max * (h - 42), x = 34 + i * bw;
    return `<rect x="${x + 2}" y="${h - 26 - bh}" width="${bw - 5}" height="${bh}" rx="4" fill="${i < 4 ? 'var(--red)' : i < 6 ? 'var(--amber)' : 'var(--primary)'}" opacity=".82"><title>${c} students</title></rect>
      <text x="${x + bw / 2}" y="${h - 12}" text-anchor="middle" font-size="8.5" fill="var(--text-faint)" font-family="JetBrains Mono">${i * 10}-${i * 10 + 10}</text>
      ${c ? `<text x="${x + bw / 2}" y="${h - 30 - bh}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--text-soft)" font-family="JetBrains Mono">${c}</text>` : ''}`;
  }).join('')}</svg>`;
}

/* ==========================================================
   ANALYTICS CORE — cohort-shaped, read by every page + EON
   ========================================================== */
const A = {
  /* all assessments for a course(+section), oldest → newest */
  of(course, section) { return T.assessments.filter(a => a.course === course && (!section || a.section === section)).sort((x, y) => x.date.localeCompare(y.date)); },

  /* one student's % history across this teacher's courses */
  history(sid) {
    const rows = [];
    T.assessments.forEach(a => { const m = a.marks.find(r => r.sid === sid); if (m) rows.push({ id: a.id, course: a.course, title: a.title, type: a.type, date: a.date, got: m.total, total: a.totalMarks, p: m.total / a.totalMarks }); });
    return rows.sort((x, y) => x.date.localeCompare(y.date));
  },

  /* risk score 0-100 (higher = riskier) + tier */
  risk(st) {
    const h = this.history(st.id);
    const avg = h.length ? mean(h.map(r => r.p)) : 0.6;
    const trend = h.length >= 3 ? mean(h.slice(-2).map(r => r.p)) - mean(h.slice(0, 2).map(r => r.p)) : 0;
    let score = 0;
    score += (1 - st.attendanceRate) * 38;
    score += Math.max(0, 0.62 - avg) * 90;
    score += Math.max(0, -trend) * 95;
    score += st.lateSubRate * 16;
    score = Math.round(Math.min(100, score));
    return { score, avg, trend, tier: score >= 55 ? 'red' : score >= 32 ? 'amber' : 'green' };
  },

  /* topic-wise class correct-rate (Layer 1) */
  topics(course, section) {
    const agg = {};
    this.of(course, section).forEach(a => a.questions.forEach(q => {
      const got = mean(a.marks.map(r => r.perQ.find(x => x.no === q.no).got));
      const k = q.topic; (agg[k] = agg[k] || { got: 0, tot: 0, n: 0 });
      agg[k].got += got; agg[k].tot += q.marks; agg[k].n++;
    }));
    return Object.entries(agg).map(([topic, v]) => ({ topic, rate: v.got / v.tot, n: v.n })).sort((a, b) => a.rate - b.rate);
  },

  /* CO attainment % (share of students reaching ≥50% on CO-mapped marks) */
  cos(course, section) {
    const c = T.course(course); const out = [];
    c.cos.forEach(co => {
      let reach = 0, tot = 0;
      const roster = (T.enrolled[course][section] || []);
      roster.forEach(st => {
        let got = 0, max = 0;
        this.of(course, section).forEach(a => { const m = a.marks.find(r => r.sid === st.id); if (!m) return; a.questions.forEach(q => { if (q.co === co.id) { max += q.marks; got += m.perQ.find(x => x.no === q.no).got; } }); });
        if (max > 0) { tot++; if (got / max >= 0.5) reach++; }
      });
      out.push({ co: co.id, text: co.text, attain: tot ? Math.round(reach / tot * 100) : null, target: c.coTarget });
    });
    return out;
  },

  /* error-taxonomy rollup (Layer 1) */
  errors(course, section) {
    const cnt = {};
    this.of(course, section).forEach(a => a.marks.forEach(r => r.perQ.forEach(x => { if (x.err) cnt[x.err] = (cnt[x.err] || 0) + 1; })));
    return Object.entries(cnt).map(([k, v]) => ({ kind: k, n: v })).sort((a, b) => b.n - a.n);
  },

  /* Layer 2 — behaviour ↔ outcome correlations, cohort-wide */
  correlations(course, section) {
    const roster = T.enrolled[course][section] || [];
    const perf = (st) => { const h = this.history(st.id).filter(r => r.course === course); return h.length ? mean(h.map(r => r.p)) : null; };
    const grp = (f) => { const g = roster.filter(f).map(perf).filter(x => x != null); return g.length ? mean(g) : null; };
    const out = [];
    const n1 = grp(s => s.opensNotes), n0 = grp(s => !s.opensNotes);
    if (n1 != null && n0 != null) out.push({ what: 'opened the posted notes', with_: pct(n1), without: pct(n0), gap: pct(n1 - n0) });
    const a1 = grp(s => s.attendanceRate >= 0.8), a0 = grp(s => s.attendanceRate < 0.8);
    if (a1 != null && a0 != null) out.push({ what: 'attendance ≥ 80%', with_: pct(a1), without: pct(a0), gap: pct(a1 - a0) });
    const l1 = grp(s => s.lateSubRate < 0.25), l0 = grp(s => s.lateSubRate >= 0.25);
    if (l1 != null && l0 != null) out.push({ what: 'submit on time', with_: pct(l1), without: pct(l0), gap: pct(l1 - l0) });
    return out.sort((x, y) => y.gap - x.gap);
  },

  /* Layer 3 — Monte-Carlo forecast of final course average & pass-rate */
  forecast(course, section, runs = 250) {
    const roster = T.enrolled[course][section] || [];
    const done = this.of(course, section);
    const wDone = done.reduce((s, a) => s + a.weight, 0);
    const wLeft = Math.max(10, 100 - wDone);
    let passSum = 0; const avgs = [];
    for (let r = 0; r < runs; r++) {
      let pass = 0; const totals = [];
      roster.forEach(st => {
        const h = this.history(st.id).filter(x => x.course === course);
        const cur = h.length ? mean(h.map(x => x.p)) : 0.6;
        const drift = st.trend * 1.6;
        const future = Math.max(0.05, Math.min(1, cur + drift + (Math.random() - 0.5) * 0.16));
        const final = (cur * wDone + future * wLeft) / (wDone + wLeft);
        totals.push(final); if (final >= 0.4) pass++;
      });
      passSum += pass / roster.length; avgs.push(mean(totals));
    }
    return { passRate: Math.round(passSum / runs * 100), avg: Math.round(mean(avgs) * 100), weightDone: wDone };
  },

  /* flagged students, ranked (Layer 2/3) */
  flagged(limit = 8) {
    return T.students.filter(s => s.batch === '231')
      .map(s => ({ s, r: this.risk(s) }))
      .filter(x => x.r.tier !== 'green')
      .sort((x, y) => y.r.score - x.r.score).slice(0, limit);
  },
};

/* ---------- static weekly class schedule (demo) ---------- */
const SCHEDULE = [
  { course: 'CSE311', section: 'A', day: 0, time: '08:30–10:00', room: 'AB4-402' },
  { course: 'CSE311', section: 'B', day: 0, time: '11:40–13:10', room: 'AB4-403' },
  { course: 'CSE220', section: 'A', day: 1, time: '10:00–11:30', room: 'AB4-501' },
  { course: 'CSE220', section: 'B', day: 1, time: '14:00–15:30', room: 'AB4-501' },
  { course: 'CSE311', section: 'A', day: 2, time: '08:30–10:00', room: 'AB4-402' },
  { course: 'CSE311', section: 'B', day: 2, time: '11:40–13:10', room: 'AB4-403' },
  { course: 'CSE220', section: 'A', day: 3, time: '10:00–11:30', room: 'AB4-501' },
  { course: 'CSE220', section: 'B', day: 3, time: '14:00–15:30', room: 'AB4-501' },
  { course: 'ENG103', section: 'A', day: 4, time: '09:00–10:30', room: 'AB1-201' },
];

/* ==========================================================
   CHROME
   ========================================================== */
const NAV = [
  { grp: 'Teach' },
  { page: 'index', href: 'index.html', ic: '▦', label: 'Dashboard' },
  { page: 'courses', href: 'courses.html', ic: '📚', label: 'Courses & Batches' },
  { page: 'students', href: 'students.html', ic: '👥', label: 'Students' },
  { page: 'assessments', href: 'assessments.html', ic: '📝', label: 'Exams & Question Bank' },
  { page: 'results', href: 'results.html', ic: '✅', label: 'Results & Grading' },
  { grp: 'Grow' },
  { page: 'kpi', href: 'kpi.html', ic: '📈', label: 'KPI & Growth' },
  { page: 'opportunities', href: 'opportunities.html', ic: '🧭', label: 'My Opportunities' },
  { grp: 'Intelligence' },
  { page: 'eon', href: 'eon.html', ic: '🧠', label: 'EON Intelligence' },
  { page: 'integrity', href: 'integrity.html', ic: '🛡️', label: 'Exam Integrity', hot: true },
];
const TITLES = {
  index: ['Dashboard', 'Your day across every section, batch and course'],
  courses: ['Courses & Batches', 'Sections, outcomes and cohort comparisons'],
  students: ['Students', 'Rosters, profiles, risk flags and advising'],
  assessments: ['Exams & Question Bank', 'Build assessments from tagged questions; publish resources'],
  results: ['Results & Grading', 'Marks, distributions and CO/PO attainment'],
  kpi: ['KPI & Growth', 'Batch and department trends across semesters'],
  opportunities: ['My Opportunities', 'Grants, conferences, journals — your own pipeline'],
  eon: ['EON Intelligence', 'The cohort brain — diagnostic → predictive → prescriptive'],
  integrity: ['Exam Integrity', 'Similarity, stylometry & AI-likelihood — flagged for YOUR review'],
};
function renderChrome(page) {
  const [title, sub] = TITLES[page] || ['', ''];
  $('#sidebar').innerHTML = `
    <div class="logo"><div class="mark">E</div><div><b>Eon for Teacher</b><small>DIU · faculty companion</small></div></div>
    <nav class="nav">${NAV.map(n => n.grp ? `<div class="nav-label">${n.grp}</div>` :
      `<a href="${n.href}" class="${n.page === page ? 'active' : ''}"><span class="ic">${n.ic}</span>${n.label}${n.hot ? '<span class="count">new</span>' : ''}</a>`).join('')}</nav>`;
  $('#topbar').innerHTML = `
    <div><h1>${title}</h1><div class="sub">${sub}</div></div>
    <div class="right"><span class="chip outline">Summer 2026</span>
      <div class="teacher-chip"><span class="av">${initials(T.teacher.name)}</span><span><b>${esc(T.teacher.name)}</b><small>${esc(T.teacher.designation)} · ${esc(T.teacher.department)}</small></span></div>
    </div>`;
  const f = document.createElement('div'); f.className = 'footer';
  f.innerHTML = `Eon for Teacher — synthetic demo data · designed & developed by <b>Md Imran Hossain</b> · same brain as the student system, different uniform`;
  $('.page').appendChild(f);
}

/* ==========================================================
   PAGES
   ========================================================== */
function initIndex() {
  const p = $('#content');
  const totalStudents = T.students.length;
  const flagged = A.flagged();
  const gradingQueue = T.assessments.filter(a => Date.parse(a.date) > Date.now() - 14 * 86400000);
  const today = new Date().getDay();
  const todays = SCHEDULE.filter(s => s.day === today);
  const nextUp = T.upcoming.map(u => ({ ...u, d: daysUntil(u.date) })).sort((a, b) => a.d - b.d);
  const kNow = T.kpiHistory[T.kpiHistory.length - 1];

  p.innerHTML = `
  <div class="stats">
    <div class="stat"><div class="ic t-primary">📚</div><div class="v">${T.courses.length}</div><div class="l">Courses · ${T.courses.reduce((s, c) => s + c.sections.length, 0)} sections</div></div>
    <div class="stat"><div class="ic t-blue">👥</div><div class="v">${totalStudents}</div><div class="l">Students across batches</div></div>
    <div class="stat"><div class="ic t-amber">🗂️</div><div class="v">${gradingQueue.length}</div><div class="l">Recent scripts to review</div></div>
    <div class="stat"><div class="ic t-violet">📅</div><div class="v">${nextUp.length}</div><div class="l">Upcoming exams</div></div>
    <div class="stat"><div class="ic t-red">🚩</div><div class="v">${flagged.length}</div><div class="l">Students flagged</div></div>
    <div class="stat"><div class="ic t-green">🎯</div><div class="v">${kNow ? kNow.coAttain + '%' : '—'}</div><div class="l">Dept CO attainment</div></div>
  </div>

  <div class="grid g2">
    <div class="card"><div class="card-head"><span class="sec-title">Today's classes</span></div>
      ${todays.length ? todays.map(s => { const c = T.course(s.course); return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--line-2)">
        <span class="num" style="font-family:var(--font-mono);font-weight:700;font-size:12px;min-width:88px">${s.time}</span>
        <span style="flex:1"><b>${s.course} — ${esc(c.title)}</b><br><small class="hint">Section ${s.section} · ${s.room} · ${T.enrolled[s.course][s.section].length} students</small></span>
        <span class="chip outline">${s.room}</span></div>`; }).join('') : '<p class="hint">No classes today — grading &amp; research day. 🌿</p>'}
      <div class="card-head" style="margin:16px 0 8px"><span class="sec-title">Upcoming exams</span></div>
      ${nextUp.map(u => `<div style="display:flex;align-items:center;gap:11px;padding:7px 0">
        <span class="chip ${u.d <= 5 ? 'red' : u.d <= 10 ? 'amber' : 'blue'}">${u.d}d</span>
        <span style="flex:1"><b>${esc(u.title)}</b> <small class="hint">· ${u.course} · Sec ${u.section} · ${u.weight}%</small></span></div>`).join('')}
    </div>

    <div class="card"><div class="card-head"><span class="sec-title">Students needing attention</span><span class="spacer"></span><a class="btn ghost sm" href="students.html">All students</a></div>
      ${flagged.slice(0, 6).map(({ s, r }) => `<div style="display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid var(--line-2)">
        <span class="risk-dot" style="background:var(--${r.tier})"></span>
        <span style="flex:1"><b>${esc(s.name)}</b> <small class="hint">${s.id} · Sec ${s.section}</small><br>
          <small class="hint">attendance ${pct(s.attendanceRate)}% · avg ${pct(r.avg)}% · trend ${r.trend >= 0 ? '+' : ''}${pct(r.trend)}%</small></span>
        <span class="chip ${r.tier}">risk ${r.score}</span></div>`).join('')}
      <div class="card-head" style="margin:16px 0 8px"><span class="sec-title">Grading queue</span></div>
      ${gradingQueue.map(a => `<div style="display:flex;gap:10px;align-items:center;padding:6px 0"><span class="chip slate">${a.type}</span><span style="flex:1">${esc(a.title)} <small class="hint">· Sec ${a.section}</small></span><a class="btn soft sm" href="results.html">Open</a></div>`).join('') || '<p class="hint">Queue clear.</p>'}
    </div>
  </div>

  <div class="card mb"><div class="card-head"><span class="sec-title">EON — today's brief</span><span class="spacer"></span><a class="btn sm" href="eon.html">Open intelligence</a></div>
    ${eonBrief()}
  </div>`;
}
function eonBrief() {
  const lines = [];
  const t311a = A.topics('CSE311', 'A')[0];
  if (t311a && t311a.rate < 0.55) lines.push(`<div class="eonline">Weakest topic right now: <b>${esc(t311a.topic)}</b> in CSE311 Sec A — class-wide correct-rate <b>${pct(t311a.rate)}%</b>. Worth re-covering before Quiz 3.</div>`);
  const fl = A.flagged(3);
  if (fl.length) lines.push(`<div class="eonline"><b>${fl.length} students</b> are trending toward trouble — top: ${fl.map(x => esc(x.s.name.split(' ')[0])).join(', ')}. Their combined signal is attendance + late submissions, not just marks.</div>`);
  const fc = A.forecast('CSE311', 'A');
  lines.push(`<div class="eonline">Forecast (Monte-Carlo): CSE311 Sec A is heading to a <b>${fc.passRate}% pass rate</b> and <b>${fc.avg}%</b> average with ${100 - fc.weightDone}% of the grade still to play for.</div>`);
  const rem = T.remediations[0];
  if (rem) lines.push(`<div class="eonline">Loop check: after you re-taught <b>${esc(rem.topic)}</b> (Sec ${rem.section}), the midterm on that topic <b>improved</b> — see Layer 5.</div>`);
  return lines.join('');
}

function initCourses() {
  const p = $('#content');
  p.innerHTML = `<div class="grid g2">` + T.courses.map(c => {
    const secHtml = c.sections.map(sec => {
      const roster = T.enrolled[c.code][sec];
      const avg = mean(roster.map(st => { const h = A.history(st.id).filter(r => r.course === c.code); return h.length ? mean(h.map(r => r.p)) : 0; }));
      return `<div style="border:1px solid var(--line);border-radius:12px;padding:11px 13px;flex:1;min-width:150px">
        <b style="font-family:var(--font-mono)">Section ${sec}</b> <small class="hint">· ${roster.length} students</small>
        <div class="bar" style="margin:8px 0 4px"><i style="width:${pct(avg)}%"></i></div>
        <small class="hint">running average <b>${pct(avg)}%</b></small></div>`;
    }).join('');
    const cos = c.sections.map(sec => A.cos(c.code, sec));
    return `<div class="card"><div class="card-head">
        <span style="width:12px;height:12px;border-radius:4px;background:${c.color}"></span>
        <b style="font-family:var(--font-mono)">${c.code}</b><b>${esc(c.title)}</b>
        <span class="spacer"></span><span class="chip outline">${c.credit} cr · ${esc(c.semester)}</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">${secHtml}</div>
      <div class="sec-title" style="margin-bottom:8px">Course outcomes — attainment vs ${c.coTarget}% target</div>
      <table class="dt">${c.cos.map((co, i) => `<tr><td style="width:52px"><b class="num">${co.id}</b></td><td>${esc(co.text)}</td>
        ${c.sections.map((sec, si) => { const at = cos[si][i].attain; return `<td style="width:96px">${at == null ? '<span class="hint">—</span>' : `<span class="chip ${at >= c.coTarget ? 'green' : 'red'}">Sec ${sec} · ${at}%</span>`}</td>`; }).join('')}</tr>`).join('')}</table>
      <div class="sec-title" style="margin:14px 0 8px">Topic health (all sections)</div>
      ${A.topics(c.code).map(t => `<div style="display:flex;align-items:center;gap:10px;margin:5px 0">
        <span style="flex:0 0 150px;font-size:12px;text-transform:capitalize">${esc(t.topic)}</span>
        <span class="bar" style="flex:1"><i style="width:${pct(t.rate)}%;background:${t.rate < 0.5 ? 'var(--red)' : t.rate < 0.68 ? 'var(--amber)' : 'var(--green)'}"></i></span>
        <b class="num" style="font-size:12px;min-width:36px;text-align:right">${pct(t.rate)}%</b></div>`).join('')}
    </div>`;
  }).join('') + `</div>`;
}

function initStudents() {
  const p = $('#content');
  const groups = [['231', 'A'], ['231', 'B'], ['233', 'A']];
  let cur = 0;
  const draw = () => {
    const [batch, sec] = groups[cur];
    const roster = T.roster(batch, sec);
    $('#roster').innerHTML = `<table class="dt"><thead><tr><th>Student</th><th>Attendance</th><th>Trend</th><th>Average</th><th>Risk</th><th></th></tr></thead><tbody>
      ${roster.map(st => { const r = A.risk(st); const h = A.history(st.id); return `<tr class="rowlink" data-id="${st.id}">
        <td><b>${esc(st.name)}</b><br><small class="hint">${st.id}${st.clubs.length ? ' · ' + esc(st.clubs[0]) : ''}</small></td>
        <td style="width:130px"><div class="bar"><i style="width:${pct(st.attendanceRate)}%;background:${st.attendanceRate < 0.75 ? 'var(--red)' : 'var(--green)'}"></i></div><small class="hint">${pct(st.attendanceRate)}%</small></td>
        <td>${sparkSvg(h.map(x => x.p), 74, 22, r.trend < -0.05 ? 'var(--red)' : 'var(--primary)')}</td>
        <td><b class="num">${pct(r.avg)}%</b></td>
        <td><span class="chip ${r.tier}">${r.tier === 'green' ? 'on track' : r.tier === 'amber' ? 'watch' : 'at risk'} · ${r.score}</span></td>
        <td><button class="btn ghost sm" data-open="${st.id}">Profile</button></td></tr>`; }).join('')}</tbody></table>`;
    $$('#roster [data-open]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openStudent(b.dataset.open); });
    $$('#roster tr.rowlink').forEach(tr => tr.onclick = () => openStudent(tr.dataset.id));
  };
  p.innerHTML = `
    <div class="card"><div class="card-head">
      <span class="sec-title">Roster</span>
      <div class="pills" id="grpPills">${groups.map((g, i) => `<button class="pill ${i === 0 ? 'on' : ''}" data-i="${i}">Batch ${g[0]} · Sec ${g[1]}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn soft sm" id="bulkAnnounce">📣 Announce to section</button>
      <button class="btn ghost sm" id="bulkRelease">Release grades</button>
    </div><div id="roster"></div></div>`;
  $$('#grpPills .pill').forEach(b => b.onclick = () => { cur = +b.dataset.i; $$('#grpPills .pill').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#bulkAnnounce').onclick = () => { const [b, s] = groups[cur]; openModal(`Announce — Batch ${b} Sec ${s}`, `<div class="field"><label>Message to ${T.roster(b, s).length} students</label><textarea rows="4">Reminder: Quiz 3 (Indexing) is on ${fmtD(T.upcoming[0].date)}. Practice sheet R2 is in the Resource Hub.</textarea></div>`, `<button class="btn" onclick="toast('Announcement queued for the section ✓');document.getElementById('tOverlay').remove()">Send</button>`); };
  $('#bulkRelease').onclick = () => toast('Grades released to section ✓ (demo)');
  draw();
}
function eonStudentSummary(st) {
  const r = A.risk(st); const h = A.history(st.id);
  const attn = st.attendanceRate < 0.7 ? 'poor' : st.attendanceRate < 0.82 ? 'inconsistent' : 'solid';
  const dir = r.trend > 0.04 ? 'improving' : r.trend < -0.05 ? 'declining — the drop is recent, not chronic' : 'flat';
  const late = st.lateSubRate > 0.35 ? ' Submissions are frequently late, which usually precedes a grade slide.' : '';
  const notes = st.opensNotes ? '' : ' Has not been opening the posted resources — worth a direct nudge.';
  const extra = st.clubs.length ? ` Active in ${st.clubs[0]}, so engagement exists — it needs redirecting, not creating.` : '';
  return `${st.name.split(' ')[0]} is averaging ${pct(r.avg)}% across ${h.length} assessments with ${attn} attendance (${pct(st.attendanceRate)}%). The trajectory is ${dir}.${late}${notes}${extra} ${r.tier === 'red' ? 'Recommend an advising session this week.' : r.tier === 'amber' ? 'Keep on the watch list; check in within two weeks.' : 'No intervention needed.'}`;
}
function openStudent(sid) {
  const st = T.student(sid); if (!st) return;
  const r = A.risk(st); const h = A.history(sid);
  const adv = T.advising.filter(a => a.sid === sid).sort((x, y) => y.date.localeCompare(x.date));
  openModal(`${esc(st.name)} <span class="chip ${r.tier}" style="margin-left:6px">risk ${r.score}</span>`, `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px">
      <div><div class="hint">ID</div><b class="num">${st.id}</b></div>
      <div><div class="hint">Batch · Sec</div><b>${st.batch} · ${st.section}</b></div>
      <div><div class="hint">Attendance</div><b class="num">${pct(st.attendanceRate)}%</b></div>
      <div><div class="hint">Late submissions</div><b class="num">${pct(st.lateSubRate)}%</b></div>
      <div><div class="hint">Opens resources</div><b>${st.opensNotes ? 'Yes' : 'No'}</b></div>
    </div>
    <div class="card" style="background:var(--primary-soft);border-color:transparent;padding:13px 15px;margin-bottom:14px">
      <div class="sec-title" style="margin-bottom:6px">EON's read</div>
      <div style="font-size:13px;line-height:1.6">${esc(eonStudentSummary(st))}</div></div>
    <div class="sec-title" style="margin-bottom:8px">Assessment history</div>
    <table class="dt">${h.map(x => `<tr><td>${esc(x.title)} <small class="hint">· ${x.course}</small></td><td class="num">${x.got}/${x.total}</td>
      <td style="width:100px"><div class="bar"><i style="width:${pct(x.p)}%;background:${x.p < 0.4 ? 'var(--red)' : 'var(--primary)'}"></i></div></td></tr>`).join('')}</table>
    ${st.clubs.length || st.awards.length ? `<div class="sec-title" style="margin:12px 0 6px">Co-curricular</div>
      <div>${st.clubs.map(c => `<span class="chip violet">${esc(c)}</span> `).join('')}${st.awards.map(a => `<span class="chip green">🏆 ${esc(a)}</span> `).join('')}</div>` : ''}
    <div class="sec-title" style="margin:14px 0 6px">Advising log</div>
    ${adv.length ? adv.map(a => `<div style="padding:7px 0;border-bottom:1px solid var(--line-2)"><b>${fmtD(a.date)}</b> — ${esc(a.topic)}<br><small class="hint">${esc(a.action)}${a.followUp ? ' · <b style="color:var(--amber)">follow-up needed</b>' : ''}</small></div>`).join('') : '<p class="hint">No advising sessions logged yet.</p>'}`,
    `<button class="btn ghost sm" onclick="toast('Advising session scheduled ✓ (demo)')">📅 Schedule advising</button>
     <button class="btn soft sm" onclick="toast('Flag saved ✓')">🚩 Flag</button>
     <button class="btn sm" id="draftMsg">✉️ Draft message</button>`);
  $('#draftMsg').onclick = () => {
    const draft = r.tier === 'red'
      ? `Dear ${st.name.split(' ')[0]},\n\nI've noticed your recent ${['CSE311', 'CSE220'].map(c => c).join('/')} results and attendance sliding, and I'd like to help before the finals. Please see me after Sunday's class, or book any slot in my office hours — we'll make a simple recovery plan together.\n\n— ${T.teacher.name}`
      : `Dear ${st.name.split(' ')[0]},\n\nYou've been doing genuinely well this term — your ${pct(r.avg)}% average puts you near the top of the section. If you're interested, I'd like to discuss a research-assistant role on my current project.\n\n— ${T.teacher.name}`;
    openModal('Draft message — ' + esc(st.name), `<div class="field"><textarea rows="9">${esc(draft)}</textarea></div>`, `<button class="btn" onclick="toast('Message queued ✓ (demo)');document.getElementById('tOverlay').remove()">Send</button>`);
  };
}

function initAssessments() {
  const p = $('#content');
  let paper = [];
  const draw = () => {
    const fc = $('#fCourse').value, ft = $('#fTopic').value, fb = $('#fBloom').value, fd = $('#fDiff').value;
    const rows = T.bank.filter(q => (!fc || q.course === fc) && (!ft || q.topic === ft) && (!fb || q.bloom === fb) && (!fd || q.difficulty === fd));
    $('#bank').innerHTML = `<table class="dt"><thead><tr><th>Question</th><th>Topic</th><th>Bloom</th><th>Difficulty</th><th>Last used</th><th></th></tr></thead><tbody>
      ${rows.map(q => { const reused = q.lastUsedDaysAgo != null && q.lastUsedDaysAgo < 90; return `<tr>
        <td style="max-width:340px"><b style="font-family:var(--font-mono);font-size:11px">${q.id}</b> ${esc(q.text)}</td>
        <td style="text-transform:capitalize">${esc(q.topic)}</td><td><span class="chip blue">${q.bloom}</span></td>
        <td><span class="chip ${q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'amber' : 'green'}">${q.difficulty}</span></td>
        <td>${q.lastUsedDaysAgo == null ? '<span class="chip green">never</span>' : `<span class="chip ${reused ? 'red' : 'slate'}">${q.lastUsedDaysAgo}d ago${reused ? ' ⚠ reuse' : ''}</span>`}</td>
        <td><button class="btn soft sm" data-add="${q.id}">${paper.includes(q.id) ? '✓ added' : '+ Add'}</button></td></tr>`; }).join('')}</tbody></table>`;
    $$('#bank [data-add]').forEach(b => b.onclick = () => { const id = b.dataset.add; paper.includes(id) ? paper = paper.filter(x => x !== id) : paper.push(id); draw(); drawPaper(); });
  };
  const drawPaper = () => {
    const qs = paper.map(id => T.bank.find(q => q.id === id));
    const reuse = qs.filter(q => q.lastUsedDaysAgo != null && q.lastUsedDaysAgo < 90);
    $('#paper').innerHTML = qs.length ? `
      ${qs.map((q, i) => `<div style="display:flex;gap:9px;padding:6px 0;border-bottom:1px solid var(--line-2)"><b class="num">${i + 1}.</b><span style="flex:1;font-size:12.5px">${esc(q.text)}</span><span class="chip outline">${q.bloom}</span></div>`).join('')}
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <span class="chip blue">${qs.length} questions</span>
        <span class="chip violet">Blooms: ${[...new Set(qs.map(q => q.bloom))].join(', ')}</span>
        ${reuse.length ? `<span class="chip red">⚠ ${reuse.length} recently-used question${reuse.length > 1 ? 's' : ''} — swap for fairness</span>` : '<span class="chip green">✓ no recent reuse</span>'}
      </div>` : '<p class="hint">Filter the bank and add questions — the paper assembles here.</p>';
  };
  p.innerHTML = `
    <div class="card"><div class="card-head"><span class="sec-title">Create assessment</span></div>
      <div class="form-grid">
        <div class="field"><label>Course</label><select id="aCourse">${T.courses.map(c => `<option>${c.code}</option>`).join('')}</select></div>
        <div class="field"><label>Type</label><select><option>Quiz</option><option>CT</option><option>Midterm</option><option>Final</option></select></div>
        <div class="field"><label>Date</label><input type="date" value="${T.upcoming[0].date}"></div>
        <div class="field"><label>Sections</label><select><option>A + B</option><option>A</option><option>B</option></select></div>
        <div class="field"><label>Duration (min)</label><input type="number" value="60"></div>
        <div class="field"><label>Total marks</label><input type="number" value="20"></div>
      </div></div>
    <div class="grid g21 mb">
      <div class="card"><div class="card-head"><span class="sec-title">Question bank</span><span class="spacer"></span>
        <select id="fCourse" style="border:1px solid var(--line);border-radius:8px;padding:5px 8px"><option value="">All courses</option>${T.courses.map(c => `<option>${c.code}</option>`).join('')}</select>
        <select id="fTopic" style="border:1px solid var(--line);border-radius:8px;padding:5px 8px"><option value="">All topics</option>${[...new Set(T.bank.map(q => q.topic))].map(t => `<option>${t}</option>`).join('')}</select>
        <select id="fBloom" style="border:1px solid var(--line);border-radius:8px;padding:5px 8px"><option value="">All Bloom</option>${['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'].map(b => `<option>${b}</option>`).join('')}</select>
        <select id="fDiff" style="border:1px solid var(--line);border-radius:8px;padding:5px 8px"><option value="">Any difficulty</option><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
        <div id="bank"></div></div>
      <div class="card"><div class="card-head"><span class="sec-title">Paper draft</span><span class="spacer"></span><button class="btn sm" onclick="toast('Assessment saved ✓ (demo)')">Save</button></div><div id="paper"></div></div>
    </div>
    <div class="card mb"><div class="card-head"><span class="sec-title">Resource hub</span><span class="spacer"></span><button class="btn soft sm" onclick="toast('Upload added to hub ✓ (demo)')">⬆ Upload</button></div>
      <table class="dt"><thead><tr><th>Resource</th><th>Course</th><th>Kind</th><th>Opened by</th><th>Visibility</th></tr></thead><tbody>
      ${T.resources.map(r => `<tr><td><b>${esc(r.title)}</b></td><td class="num">${r.course}</td><td><span class="chip outline">${r.kind}</span></td>
        <td class="num">${r.opened}</td>
        <td><button class="btn ${r.published ? 'soft' : 'ghost'} sm" data-pub="${r.id}">${r.published ? '● Published' : '○ Draft'}</button></td></tr>`).join('')}</tbody></table></div>`;
  ['fCourse', 'fTopic', 'fBloom', 'fDiff'].forEach(id => $('#' + id).onchange = draw);
  $$('#content [data-pub]').forEach(b => b.onclick = () => { const r = T.resources.find(x => x.id === b.dataset.pub); r.published = !r.published; b.className = `btn ${r.published ? 'soft' : 'ghost'} sm`; b.textContent = r.published ? '● Published' : '○ Draft'; toast(r.published ? 'Published to students ✓' : 'Moved to draft'); });
  draw(); drawPaper();
}

function initResults() {
  const p = $('#content');
  let cur = T.assessments.findIndex(a => a.id === 'A4-A');
  const draw = () => {
    const a = T.assessments[cur];
    const c = T.course(a.course);
    const totals = a.marks.map(r => r.total);
    const avg = mean(totals);
    const qRates = a.questions.map(q => ({ q, rate: mean(a.marks.map(r => r.perQ.find(x => x.no === q.no).got)) / q.marks }));
    const cos = {};
    a.questions.forEach(q => { const k = q.co; (cos[k] = cos[k] || { got: 0, max: 0 }); });
    a.marks.forEach(r => r.perQ.forEach((x, i) => { const q = a.questions[i]; cos[q.co].got += x.got; cos[q.co].max += q.marks; }));
    $('#resBody').innerHTML = `
      <div class="grid g2">
        <div class="card"><div class="card-head"><span class="sec-title">Distribution</span><span class="spacer"></span>
          <span class="chip blue">avg ${avg.toFixed(1)}/${a.totalMarks} (${pct(avg / a.totalMarks)}%)</span></div>
          ${histogram(totals, a.totalMarks)}
          <div class="sec-title" style="margin:12px 0 8px">Per-question correct rate</div>
          ${qRates.map(x => `<div style="display:flex;align-items:center;gap:10px;margin:5px 0">
            <span style="flex:0 0 210px;font-size:12px">Q${x.q.no} · <span style="text-transform:capitalize">${esc(x.q.topic)}</span> <small class="hint">(${x.q.co} · ${x.q.bloom})</small></span>
            <span class="bar" style="flex:1"><i style="width:${pct(x.rate)}%;background:${x.rate < 0.5 ? 'var(--red)' : x.rate < 0.68 ? 'var(--amber)' : 'var(--green)'}"></i></span>
            <b class="num" style="min-width:38px;text-align:right;font-size:12px">${pct(x.rate)}%</b></div>`).join('')}
          <div class="sec-title" style="margin:12px 0 8px">CO attainment (this paper)</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(cos).map(([co, v]) => { const at = pct(v.got / v.max); return `<span class="chip ${at >= c.coTarget ? 'green' : 'red'}">${co} · ${at}% ${at >= c.coTarget ? '✓' : '· below ' + c.coTarget + '%'}</span>`; }).join('')}</div>
        </div>
        <div class="card"><div class="card-head"><span class="sec-title">Marks — editable</span><span class="spacer"></span><button class="btn sm" onclick="toast('Marks saved ✓ (demo)')">Save</button></div>
          <div style="max-height:460px;overflow:auto"><table class="dt"><thead><tr><th>Student</th>${a.questions.map(q => `<th>Q${q.no}<small class="hint">/${q.marks}</small></th>`).join('')}<th>Total</th></tr></thead><tbody>
          ${a.marks.map(r => { const st = T.student(r.sid); return `<tr><td><b>${esc(st.name)}</b><br><small class="hint">${st.id}</small></td>
            ${r.perQ.map(x => `<td><input type="number" value="${x.got}" style="width:52px;border:1px solid var(--line);border-radius:7px;padding:4px 6px" step="0.5"></td>`).join('')}
            <td><b class="num" style="color:${r.total / a.totalMarks < 0.4 ? 'var(--red)' : 'inherit'}">${r.total}</b></td></tr>`; }).join('')}</tbody></table></div>
        </div>
      </div>`;
  };
  p.innerHTML = `<div class="card"><div class="card-head"><span class="sec-title">Assessment</span>
      <select id="pickA" style="border:1px solid var(--line);border-radius:9px;padding:7px 10px;font-weight:600">
        ${T.assessments.map((a, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>${a.course} · Sec ${a.section} — ${a.title} (${fmtD(a.date)})</option>`).join('')}</select>
    </div></div><div id="resBody" class="mb"></div>`;
  $('#pickA').onchange = e => { cur = +e.target.value; draw(); };
  draw();
}

function initKpi() {
  const p = $('#content');
  // current-semester live numbers (from seeded assessments)
  const cur = (() => {
    const perf = T.students.filter(s => s.batch === '231').map(s => { const h = A.history(s.id); return h.length ? mean(h.map(r => r.p)) : null; }).filter(x => x != null);
    const gpa = 2.0 + mean(perf) * 2.0;                      // rough %→GPA mapping for the demo
    const pass = pct(perf.filter(x => x >= 0.4).length / perf.length);
    const co = Math.round(mean(['CSE311', 'CSE220'].flatMap(c => T.course(c).sections.flatMap(s => A.cos(c, s).map(x => x.attain).filter(v => v != null)))));
    return { sem: 'Summer 2026 (this batch, live)', gpaAvg: Math.round(gpa * 100) / 100, passRate: pass, atRisk: A.flagged(99).length, coAttain: co, research: 4, coCurricular: pct(T.students.filter(s => s.clubs.length).length / T.students.length) };
  })();
  const H = [...T.kpiHistory, cur];
  const labels = H.map(x => x.sem.split(' (')[0]);
  const prevAtPoint = T.kpiHistory[2];
  p.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="ic t-primary">🎓</div><div class="v">${cur.gpaAvg}</div><div class="l">Batch avg GPA (live)</div></div>
      <div class="stat"><div class="ic t-green">✅</div><div class="v">${cur.passRate}%</div><div class="l">Projected pass rate</div></div>
      <div class="stat"><div class="ic t-red">🚩</div><div class="v">${cur.atRisk}</div><div class="l">At-risk students</div></div>
      <div class="stat"><div class="ic t-violet">🎯</div><div class="v">${cur.coAttain}%</div><div class="l">CO attainment</div></div>
      <div class="stat"><div class="ic t-blue">📄</div><div class="v">${cur.research}</div><div class="l">Research outputs</div></div>
      <div class="stat"><div class="ic t-amber">🎭</div><div class="v">${cur.coCurricular}%</div><div class="l">Co-curricular engagement</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><span class="sec-title">Batch GPA trend</span></div>${lineChart([{ name: 'Avg GPA', vals: H.map(x => x.gpaAvg), color: 'var(--primary)' }], labels)}</div>
      <div class="card"><div class="card-head"><span class="sec-title">Pass rate & CO attainment</span></div>${lineChart([{ name: 'Pass %', vals: H.map(x => x.passRate), color: 'var(--green)' }, { name: 'CO %', vals: H.map(x => x.coAttain), color: 'var(--violet)' }], labels, { fmt: v => v + '%' })}</div>
      <div class="card"><div class="card-head"><span class="sec-title">At-risk students</span></div>${lineChart([{ name: 'At-risk', vals: H.map(x => x.atRisk), color: 'var(--red)' }], labels)}</div>
      <div class="card"><div class="card-head"><span class="sec-title">Research & co-curricular</span></div>${lineChart([{ name: 'Research', vals: H.map(x => x.research), color: 'var(--accent)' }, { name: 'Co-curricular %', vals: H.map(x => x.coCurricular), color: 'var(--amber)' }], labels)}</div>
    </div>
    <div class="card mb"><div class="card-head"><span class="sec-title">EON — batch vs previous batch at the same point</span></div>
      <div class="eonline">This batch is averaging <b>GPA ${cur.gpaAvg}</b> vs <b>${prevAtPoint.gpaAvg}</b> for the previous batch at the same point — ${cur.gpaAvg >= prevAtPoint.gpaAvg ? '<b style="color:var(--green)">ahead of pace ✓</b>' : '<b style="color:var(--red)">behind pace</b>'}.</div>
      <div class="eonline">At-risk count is <b>${cur.atRisk}</b> vs ${prevAtPoint.atRisk} last cycle — the gap is concentrated in Batch 231's tail, not spread evenly (see Students → risk column).</div>
      <div class="eonline">CO attainment <b>${cur.coAttain}%</b> vs target 60% — dragged mainly by <b>CO3 (normalization)</b> in CSE311 Sec A. Fixing one topic moves the department metric.</div>
    </div>
    <div class="card mb"><div class="card-head"><span class="sec-title">Teaching load</span></div>
      <table class="dt"><thead><tr><th>Course</th><th>Sections</th><th>Students</th><th>Assessments run</th></tr></thead><tbody>
      ${T.courses.map(c => `<tr><td><b class="num">${c.code}</b> ${esc(c.title)}</td><td>${c.sections.join(', ')}</td>
        <td class="num">${c.sections.reduce((s, x) => s + T.enrolled[c.code][x].length, 0)}</td>
        <td class="num">${A.of(c.code).length}</td></tr>`).join('')}</tbody></table></div>`;
}

function initOpportunities() {
  const p = $('#content');
  const opps = T.teacherOpps.map(o => ({ ...o, d: daysUntil(o.deadline) })).sort((a, b) => a.d - b.d);
  const stale = T.advising.filter(a => (Date.now() - Date.parse(a.date)) / 86400000 > 30 && a.followUp);
  p.innerHTML = `
    <div class="card"><div class="card-head"><span class="sec-title">Your deadlines</span><span class="hint">— the same radar the student side has, pointed at your career</span></div>
      <div class="grid g3">
      ${opps.map(o => `<div style="border:1px solid var(--line);border-left:3px solid ${o.d <= 15 ? 'var(--red)' : o.d <= 35 ? 'var(--amber)' : 'var(--primary)'};border-radius:12px;padding:12px 14px">
        <div style="display:flex;gap:8px;align-items:center"><span class="chip ${o.d <= 15 ? 'red' : o.d <= 35 ? 'amber' : 'blue'}">${o.d}d</span><span class="chip outline">${o.kind}</span></div>
        <b style="display:block;margin:8px 0 3px">${esc(o.title)}</b>
        <small class="hint">${esc(o.note)} · due ${fmtD(o.deadline)}</small></div>`).join('')}
      </div></div>
    <div class="grid g2 mb">
      <div class="card"><div class="card-head"><span class="sec-title">Advising follow-ups overdue</span></div>
        ${stale.length ? stale.map(a => { const st = T.student(a.sid); return `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2)">
          <span class="chip amber">${Math.floor((Date.now() - Date.parse(a.date)) / 86400000)}d silent</span>
          <span style="flex:1"><b>${esc(st.name)}</b><br><small class="hint">${esc(a.topic)}</small></span>
          <button class="btn ghost sm" onclick="toast('Check-in drafted ✓ (demo)')">✉️ Check in</button></div>`; }).join('') : '<p class="hint">No overdue follow-ups. 🌿</p>'}
      </div>
      <div class="card"><div class="card-head"><span class="sec-title">Co-curricular engagement</span></div>
        ${(() => { const withClub = T.students.filter(s => s.clubs.length); const byClub = {}; withClub.forEach(s => byClub[s.clubs[0]] = (byClub[s.clubs[0]] || 0) + 1);
          return `<div class="eonline"><b>${withClub.length}</b> of ${T.students.length} students (${pct(withClub.length / T.students.length)}%) are active in at least one club — a department KPI in its own right.</div>` +
            Object.entries(byClub).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<div style="display:flex;align-items:center;gap:10px;margin:5px 0">
              <span style="flex:0 0 190px;font-size:12px">${esc(c)}</span><span class="bar" style="flex:1"><i style="width:${pct(n / withClub.length)}%"></i></span><b class="num" style="font-size:12px">${n}</b></div>`).join(''); })()}
      </div>
    </div>`;
}

/* ---------- router ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  renderChrome(page);
  const fn = { index: initIndex, courses: initCourses, students: initStudents, assessments: initAssessments, results: initResults, kpi: initKpi, opportunities: initOpportunities, eon: window.initEonPage, integrity: window.initIntegrityPage }[page];
  if (typeof fn === 'function') { try { fn(); } catch (e) { console.error(e); $('#content').innerHTML = `<div class="card">Something went wrong rendering this page — check the console.</div>`; } }
});
