# JavaScript for Table1 characteristic visualizations.
# Uses the shared cohort selector (initCohortSelector) and COLORS.

_TABLE1_VIZ_JS = """\
var NS = 'http://www.w3.org/2000/svg';
var cohortNames = DATA.map(function(c) { return c.cohort_name; });
var selected = initCohortSelector(cohortNames, 'controls', render);
var chartsDiv = document.getElementById('charts');

/* ── SVG helpers ─────────────────────────────────────────────────────── */
function el(tag, attrs, parent) {
  var e = document.createElementNS(NS, tag);
  if (attrs) Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
  if (parent) parent.appendChild(e);
  return e;
}
function txt(text, attrs, parent) {
  var e = el('text', attrs, parent);
  e.textContent = text;
  return e;
}

/* ── Row classification ──────────────────────────────────────────────── */
function classifyRows(rows) {
  var booleans = [], categoricals = {}, catOrder = [], numerics = [];
  rows.forEach(function(row) {
    if (row.Name === 'Cohort') return;
    if (row._level && row._level > 0) return;
    if (row.Name.indexOf('=') !== -1) {
      var eq = row.Name.indexOf('=');
      var pheno = row.Name.substring(0, eq);
      var cat = row.Name.substring(eq + 1);
      if (!categoricals[pheno]) { categoricals[pheno] = []; catOrder.push(pheno); }
      categoricals[pheno].push({ category: cat, N: row.N || 0, Pct: row.Pct || 0 });
    } else if (row.Mean != null && !isNaN(row.Mean)) {
      numerics.push(row);
    } else {
      booleans.push(row);
    }
  });
  return { booleans: booleans, categoricals: categoricals, catOrder: catOrder, numerics: numerics };
}

/* ── Boolean horizontal bar chart ────────────────────────────────────── */
function renderBooleanChart(cohortData) {
  var allNames = [], nameSet = {};
  cohortData.forEach(function(cd) {
    cd.classified.booleans.forEach(function(row) {
      if (!nameSet[row.Name]) { nameSet[row.Name] = true; allNames.push(row.Name); }
    });
  });
  if (!allNames.length) return;

  var section = document.createElement('div');
  section.className = 'chart-section';
  chartsDiv.appendChild(section);
  var h = document.createElement('h2');
  h.textContent = 'Boolean Characteristics';
  section.appendChild(h);

  var nc = cohortData.length;
  var barH = 16, barGap = 2, phenoGap = 14;
  var phenoH = nc * barH + (nc - 1) * barGap;
  var padL = 220, padR = 160, padT = 24, padB = 20;
  var barW = 400;
  var W = padL + barW + padR;
  var H = padT + allNames.length * (phenoH + phenoGap) - phenoGap + padB;

  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.display = 'block';
  section.appendChild(svg);

  /* grid */
  [0, 25, 50, 75, 100].forEach(function(p) {
    var x = padL + (p / 100) * barW;
    el('line', { x1: x, y1: padT - 4, x2: x, y2: H - padB, stroke: '#eee' }, svg);
    txt(p + '%', { x: x, y: padT - 8, 'text-anchor': 'middle', 'font-size': 10, fill: '#aaa' }, svg);
  });

  allNames.forEach(function(name, ni) {
    var y0 = padT + ni * (phenoH + phenoGap);
    txt(name, { x: padL - 8, y: y0 + phenoH / 2 + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#333' }, svg);

    cohortData.forEach(function(cd, ci) {
      var row = null;
      cd.classified.booleans.forEach(function(r) { if (r.Name === name) row = r; });
      var pct = row ? (row.Pct || 0) : 0;
      var n = row ? (row.N || 0) : 0;
      var barY = y0 + ci * (barH + barGap);
      var color = COLORS[cd.ci % COLORS.length];

      el('rect', { x: padL, y: barY, width: Math.max(0, (pct / 100) * barW), height: barH, fill: color, rx: 2 }, svg);
      var labelX = padL + Math.max((pct / 100) * barW, 0) + 6;
      txt(Math.round(pct * 10) / 10 + '% (N=' + n + ')', { x: labelX, y: barY + barH / 2 + 4, 'font-size': 10, fill: '#666' }, svg);
    });
  });
}

/* ── Categorical grouped bar charts ──────────────────────────────────── */
function renderCategoricalCharts(cohortData) {
  var allPhenos = [], phenoSet = {}, allCats = {};
  cohortData.forEach(function(cd) {
    cd.classified.catOrder.forEach(function(ph) {
      if (!phenoSet[ph]) { phenoSet[ph] = true; allPhenos.push(ph); allCats[ph] = []; }
    });
    Object.keys(cd.classified.categoricals).forEach(function(ph) {
      cd.classified.categoricals[ph].forEach(function(item) {
        if (allCats[ph] && allCats[ph].indexOf(item.category) === -1) allCats[ph].push(item.category);
      });
    });
  });

  allPhenos.forEach(function(phenoName) {
    var categories = allCats[phenoName] || [];
    if (!categories.length) return;
    renderCategoricalChart(phenoName, categories, cohortData);
  });
}

function renderCategoricalChart(phenoName, categories, cohortData) {
  var section = document.createElement('div');
  section.className = 'chart-section';
  chartsDiv.appendChild(section);
  var h = document.createElement('h2');
  h.textContent = phenoName;
  section.appendChild(h);

  var nc = cohortData.length;
  var catGap = 20, groupW = nc * 18 + (nc - 1) * 2;
  var padL = 50, padR = 20, padT = 20, padB = 60;
  var plotH = 200;
  var plotW = categories.length * (groupW + catGap) - catGap;
  var W = padL + plotW + padR;
  var H = padT + plotH + padB;

  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', Math.max(W, 200)); svg.setAttribute('height', H);
  svg.style.display = 'block';
  section.appendChild(svg);

  /* y-axis */
  var maxPct = 0;
  cohortData.forEach(function(cd) {
    var cats = cd.classified.categoricals[phenoName] || [];
    cats.forEach(function(c) { if (c.Pct > maxPct) maxPct = c.Pct; });
  });
  maxPct = Math.max(maxPct, 1);
  var yMax = Math.ceil(maxPct / 10) * 10;
  if (yMax < maxPct) yMax = maxPct + 5;
  function sy(v) { return padT + plotH - (v / yMax) * plotH; }

  /* grid lines */
  var nTicks = 4;
  for (var ti = 0; ti <= nTicks; ti++) {
    var v = (yMax / nTicks) * ti;
    var y = sy(v);
    el('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, stroke: '#eee' }, svg);
    txt(Math.round(v) + '%', { x: padL - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#999' }, svg);
  }

  categories.forEach(function(cat, cati) {
    var gx = padL + cati * (groupW + catGap);
    cohortData.forEach(function(cd, ci) {
      var cats = cd.classified.categoricals[phenoName] || [];
      var item = null;
      cats.forEach(function(c) { if (c.category === cat) item = c; });
      var pct = item ? item.Pct : 0;
      var color = COLORS[cd.ci % COLORS.length];
      var bw = 18, bx = gx + ci * (bw + 2);
      var bh = Math.max(0, (pct / yMax) * plotH);
      el('rect', { x: bx, y: padT + plotH - bh, width: bw, height: bh, fill: color, rx: 1 }, svg);
    });
    /* category label */
    var labelX = gx + groupW / 2;
    var lbl = txt(cat, { x: labelX, y: padT + plotH + 14, 'text-anchor': 'middle', 'font-size': 10, fill: '#333' }, svg);
    if (cat.length > 12) {
      lbl.setAttribute('transform', 'rotate(30,' + labelX + ',' + (padT + plotH + 14) + ')');
      lbl.setAttribute('text-anchor', 'start');
    }
  });
}

/* ── Numeric histograms ──────────────────────────────────────────────── */
function renderNumericHistograms(cohortData) {
  var allNames = [], nameSet = {};
  cohortData.forEach(function(cd) {
    cd.classified.numerics.forEach(function(row) {
      if (!nameSet[row.Name]) { nameSet[row.Name] = true; allNames.push(row.Name); }
    });
  });

  allNames.forEach(function(name) {
    renderHistogram(name, cohortData);
  });
}

function computeBins(values, numBins) {
  if (!values || !values.length) return [];
  var mn = Infinity, mx = -Infinity;
  values.forEach(function(v) { if (v < mn) mn = v; if (v > mx) mx = v; });
  if (mn === mx) { mn -= 0.5; mx += 0.5; }
  var bw = (mx - mn) / numBins;
  var bins = [];
  for (var i = 0; i < numBins; i++) bins.push({ x0: mn + i * bw, x1: mn + (i + 1) * bw, count: 0 });
  var total = values.length;
  values.forEach(function(v) {
    var idx = Math.min(Math.floor((v - mn) / bw), numBins - 1);
    bins[idx].count++;
  });
  bins.forEach(function(b) { b.pct = total > 0 ? (b.count / total) * 100 : 0; });
  return bins;
}

function renderHistogram(phenoName, cohortData) {
  /* collect value arrays */
  var series = [];
  cohortData.forEach(function(cd) {
    var vals = (cd.data.value_distributions || {})[phenoName];
    if (vals && vals.length) series.push({ name: cd.name, ci: cd.ci, values: vals });
  });

  if (!series.length) {
    /* no patient-level data; show summary stats instead */
    renderSummaryStats(phenoName, cohortData);
    return;
  }

  var section = document.createElement('div');
  section.className = 'chart-section';
  chartsDiv.appendChild(section);
  var h = document.createElement('h2');
  h.textContent = phenoName + ' (distribution)';
  section.appendChild(h);

  var numBins = 20;
  /* compute shared x range */
  var gMin = Infinity, gMax = -Infinity;
  series.forEach(function(s) {
    s.values.forEach(function(v) { if (v < gMin) gMin = v; if (v > gMax) gMax = v; });
  });
  if (gMin === gMax) { gMin -= 0.5; gMax += 0.5; }
  var bw = (gMax - gMin) / numBins;

  /* bin each series with shared range */
  var allBinned = [];
  var maxPct = 0;
  series.forEach(function(s) {
    var bins = [];
    for (var i = 0; i < numBins; i++) bins.push({ x0: gMin + i * bw, x1: gMin + (i + 1) * bw, count: 0 });
    s.values.forEach(function(v) {
      var idx = Math.min(Math.floor((v - gMin) / bw), numBins - 1);
      bins[idx].count++;
    });
    var total = s.values.length;
    bins.forEach(function(b) { b.pct = total > 0 ? (b.count / total) * 100 : 0; if (b.pct > maxPct) maxPct = b.pct; });
    allBinned.push({ name: s.name, ci: s.ci, bins: bins });
  });

  var padL = 50, padR = 20, padT = 20, padB = 40;
  var plotH = 180, plotW = 500;
  var W = padL + plotW + padR;
  var H = padT + plotH + padB;

  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.display = 'block';
  section.appendChild(svg);

  var yMax = Math.ceil(maxPct / 5) * 5;
  if (yMax < 1) yMax = 1;
  function sx(v) { return padL + ((v - gMin) / (gMax - gMin)) * plotW; }
  function sy(v) { return padT + plotH - (v / yMax) * plotH; }

  /* y gridlines */
  for (var ti = 0; ti <= 4; ti++) {
    var v = (yMax / 4) * ti;
    el('line', { x1: padL, y1: sy(v), x2: padL + plotW, y2: sy(v), stroke: '#eee' }, svg);
    txt(Math.round(v) + '%', { x: padL - 6, y: sy(v) + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#999' }, svg);
  }

  /* bars – overlaid with transparency */
  var barW = plotW / numBins;
  allBinned.forEach(function(s) {
    var color = COLORS[s.ci % COLORS.length];
    s.bins.forEach(function(b, bi) {
      var bh = Math.max(0, (b.pct / yMax) * plotH);
      el('rect', {
        x: padL + bi * barW + 1, y: padT + plotH - bh,
        width: Math.max(barW - 2, 1), height: bh,
        fill: color, 'fill-opacity': 0.5, stroke: color, 'stroke-width': 0.5
      }, svg);
    });
  });

  /* x-axis labels */
  var nLabels = 5;
  for (var i = 0; i <= nLabels; i++) {
    var v = gMin + (gMax - gMin) / nLabels * i;
    var label = v % 1 === 0 ? v.toString() : v.toFixed(1);
    txt(label, { x: sx(v), y: padT + plotH + 16, 'text-anchor': 'middle', 'font-size': 10, fill: '#666' }, svg);
  }
}

/* ── Summary stats fallback (when no patient-level data) ─────────────── */
function renderSummaryStats(phenoName, cohortData) {
  var rows = [];
  cohortData.forEach(function(cd) {
    cd.classified.numerics.forEach(function(r) {
      if (r.Name === phenoName) rows.push({ name: cd.name, ci: cd.ci, row: r });
    });
  });
  if (!rows.length) return;

  var section = document.createElement('div');
  section.className = 'chart-section';
  chartsDiv.appendChild(section);
  var h = document.createElement('h2');
  h.textContent = phenoName + ' (summary)';
  section.appendChild(h);

  var stats = ['N', 'Mean', 'STD', 'Min', 'P25', 'Median', 'P75', 'Max'];
  var tbl = document.createElement('table');
  tbl.className = 'summary-table';
  section.appendChild(tbl);

  /* header */
  var thead = document.createElement('tr');
  tbl.appendChild(thead);
  var th0 = document.createElement('th'); th0.textContent = ''; thead.appendChild(th0);
  stats.forEach(function(s) { var th = document.createElement('th'); th.textContent = s; thead.appendChild(th); });

  rows.forEach(function(r) {
    var tr = document.createElement('tr');
    tbl.appendChild(tr);
    var td0 = document.createElement('td');
    td0.textContent = r.name;
    td0.style.color = COLORS[r.ci % COLORS.length];
    td0.style.fontWeight = 'bold';
    tr.appendChild(td0);
    stats.forEach(function(s) {
      var td = document.createElement('td');
      var v = r.row[s];
      td.textContent = (v != null && !isNaN(v)) ? (typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : v) : '';
      tr.appendChild(td);
    });
  });
}

/* ── Main render ─────────────────────────────────────────────────────── */
function render() {
  chartsDiv.innerHTML = '';
  var sel = Array.from(selected);
  if (!sel.length) return;

  var cohortData = [];
  sel.forEach(function(name) {
    DATA.forEach(function(d) {
      if (d.cohort_name === name) {
        cohortData.push({
          name: name,
          ci: cohortNames.indexOf(name),
          classified: classifyRows(d.rows),
          data: d
        });
      }
    });
  });

  renderBooleanChart(cohortData);
  renderCategoricalCharts(cohortData);
  renderNumericHistograms(cohortData);
}
render();
"""
