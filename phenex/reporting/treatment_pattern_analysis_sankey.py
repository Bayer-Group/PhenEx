import json
import pandas as pd
from pathlib import Path

from phenex.reporting.reporter import Reporter
from phenex.reporting.treatment_pattern_analysis_mixin import (
    _TreatmentPatternAnalysisMixin,
)
from phenex.util import create_logger

logger = create_logger(__name__)

# ----------------------------------------------------------------------------
# Tableau-10 colour palette: one colour per unique regimen combination.
# The same display_name gets the same colour across all periods.
# ----------------------------------------------------------------------------
_COLORS = [
    "#4e79a7",
    "#f28e2b",
    "#e15759",
    "#76b7b2",
    "#59a14f",
    "#edc948",
    "#b07aa1",
    "#ff9da7",
    "#9c755f",
    "#bab0ac",
]


class SankeyGenerator:
    """
    Computes d3-sankey ``nodes`` and ``links`` for a single TreatmentPatternAnalysis
    group.

    Nodes represent patient regimens within a time period.  Links represent the
    count of patients who held one regimen in period *n* and another regimen in
    period *n + 1*.  Patients not in any node for a given period are excluded.

    Parameters
    ----------
    tpa_name :
        The TPA name prefix (e.g. ``"TP"``).
    periods :
        List of ``(period_num, period_label, phenotypes)`` tuples sorted ascending
        by *period_num*, as returned by
        :meth:`_TreatmentPatternAnalysisMixin._group_tpa_phenotypes`.
    """

    def __init__(self, tpa_name: str, periods: list):
        self.tpa_name = tpa_name
        self.periods = periods

    def build(self):
        """
        Execute the sankey computation from phenotype tables.

        Returns
        -------
        nodes : list[dict]
            Each dict has keys ``name``, ``display_name``, ``period``,
            ``period_label``, ``value``.
        links : list[dict]
            Each dict has keys ``source`` (int), ``target`` (int), ``value`` (int).

        Side-effects
        ------------
        Sets ``self.nodes``, ``self.links``, and ``self.df_links``.
        """
        nodes = []
        node_index = {}  # (period_num, phenotype.name) -> int index in nodes list

        for period_num, period_label, phenotypes in self.periods:
            for pt in phenotypes:
                idx = len(nodes)
                node_index[(period_num, pt.name)] = idx
                nodes.append(
                    {
                        "name": f"{pt.display_name} ({period_label})",
                        "display_name": pt.display_name,
                        "period": period_num,
                        "period_label": period_label,
                        "value": 0,
                    }
                )

        # ------------------------------------------------------------------
        # Collect patient ID sets from executed phenotype tables
        # ------------------------------------------------------------------
        patient_sets = {}
        for period_num, _, phenotypes in self.periods:
            for pt in phenotypes:
                if pt.table is None:
                    logger.warning(
                        "Phenotype %s has no executed table; treating as empty set.",
                        pt.name,
                    )
                    patient_sets[(period_num, pt.name)] = set()
                    continue
                ids = (
                    pt.table.select("PERSON_ID")
                    .distinct()
                    .execute()["PERSON_ID"]
                    .tolist()
                )
                ids_set = set(ids)
                patient_sets[(period_num, pt.name)] = ids_set
                nodes[node_index[(period_num, pt.name)]]["value"] = len(ids_set)

        # ------------------------------------------------------------------
        # Build links between consecutive periods via set intersection
        # ------------------------------------------------------------------
        links = []
        link_rows = []
        for i in range(len(self.periods) - 1):
            p_from_num, _, pts_from = self.periods[i]
            p_to_num, _, pts_to = self.periods[i + 1]
            for pt_from in pts_from:
                ids_from = patient_sets.get((p_from_num, pt_from.name), set())
                if not ids_from:
                    continue
                for pt_to in pts_to:
                    ids_to = patient_sets.get((p_to_num, pt_to.name), set())
                    flow = len(ids_from & ids_to)
                    if flow > 0:
                        links.append(
                            {
                                "source": node_index[(p_from_num, pt_from.name)],
                                "target": node_index[(p_to_num, pt_to.name)],
                                "value": flow,
                            }
                        )
                        link_rows.append(
                            {
                                "tpa_name": self.tpa_name,
                                "from_period": p_from_num,
                                "to_period": p_to_num,
                                "from_regimen": pt_from.display_name,
                                "to_regimen": pt_to.display_name,
                                "n_patients": flow,
                            }
                        )

        # ------------------------------------------------------------------
        # Post-hoc: derive "None" (untreated) nodes and flows.
        #
        # Conservation law:
        #   total_N = sum of all nodes in period 1 (constant across periods)
        #   none_count[p] = total_N - sum(node values in period p)
        #   flow(None_p → regimen_q) = regimen_q.value - inflow from existing links into q
        #   flow(None_p → None_{p+1}) = none_count[p] - sum(None_p → regimen flows)
        # ------------------------------------------------------------------
        first_period = self.periods[0][0]
        total_N = sum(n["value"] for n in nodes if n["period"] == first_period)

        none_count = {}
        for period_num, _, _ in self.periods:
            period_sum = sum(n["value"] for n in nodes if n["period"] == period_num)
            none_count[period_num] = total_N - period_sum

        none_node_index = {}
        for period_num, period_label, _ in self.periods:
            idx = len(nodes)
            none_node_index[period_num] = idx
            nodes.append(
                {
                    "name": f"None ({period_label})",
                    "display_name": "None",
                    "period": period_num,
                    "period_label": period_label,
                    "value": none_count[period_num],
                }
            )

        for i in range(len(self.periods) - 1):
            p_from_num, _, _ = self.periods[i]
            p_to_num, _, pts_to = self.periods[i + 1]

            none_from_idx = none_node_index[p_from_num]
            none_to_idx = none_node_index[p_to_num]
            none_to_regimen_total = 0

            for pt_to in pts_to:
                to_idx = node_index[(p_to_num, pt_to.name)]
                inflow_from_regimens = sum(
                    lk["value"] for lk in links if lk["target"] == to_idx
                )
                flow_val = nodes[to_idx]["value"] - inflow_from_regimens
                if flow_val > 0:
                    links.append(
                        {"source": none_from_idx, "target": to_idx, "value": flow_val}
                    )
                    link_rows.append(
                        {
                            "tpa_name": self.tpa_name,
                            "from_period": p_from_num,
                            "to_period": p_to_num,
                            "from_regimen": "None",
                            "to_regimen": pt_to.display_name,
                            "n_patients": flow_val,
                        }
                    )
                    none_to_regimen_total += flow_val

            none_to_none = none_count[p_from_num] - none_to_regimen_total
            if none_to_none > 0:
                links.append(
                    {
                        "source": none_from_idx,
                        "target": none_to_idx,
                        "value": none_to_none,
                    }
                )
                link_rows.append(
                    {
                        "tpa_name": self.tpa_name,
                        "from_period": p_from_num,
                        "to_period": p_to_num,
                        "from_regimen": "None",
                        "to_regimen": "None",
                        "n_patients": none_to_none,
                    }
                )

        self.nodes = nodes
        self.links = links
        self.df_links = (
            pd.DataFrame(link_rows)
            if link_rows
            else pd.DataFrame(
                columns=[
                    "tpa_name",
                    "from_period",
                    "to_period",
                    "from_regimen",
                    "to_regimen",
                    "n_patients",
                ]
            )
        )
        return nodes, links


class TreatmentPatternAnalysisSankeyReporter(_TreatmentPatternAnalysisMixin, Reporter):
    """
    Reporter that produces a d3-sankey diagram showing patient flow between
    treatment regimen combinations across consecutive time periods.

    The reporter automatically discovers every TreatmentPatternAnalysis group
    present in ``cohort.characteristics`` and ``cohort.outcomes`` by reading the
    ``_tpa_name`` / ``_tpa_period_num`` / ``_tpa_period_label`` attributes set by
    :class:`~phenex.phenotypes.factory.TreatmentPatternAnalysis`, with a regex
    fallback for manually named phenotypes.

    One :class:`SankeyGenerator` is created per group.  Each generator fetches
    patient IDs from the already-executed phenotype tables and computes cross-period
    flows by set intersection.

    Outputs
    -------
    ``self.df``
        DataFrame with columns ``[tpa_name, from_period, to_period,
        from_regimen, to_regimen, n_patients]``.
    ``to_html(filename)``
        Self-contained HTML page with one d3-sankey SVG per TPA group.
    ``to_png(filename)``
        PNG screenshot of that HTML (requires ``playwright``).
    """

    @property
    def name(self):
        return self._name or "TreatmentPatternSankey"

    def execute(self, cohort):
        self.cohort = cohort

        all_phenotypes = list(getattr(cohort, "characteristics", None) or []) + list(
            getattr(cohort, "outcomes", None) or []
        )

        tpa_groups = self._group_tpa_phenotypes(all_phenotypes)

        if not tpa_groups:
            logger.warning("No TreatmentPatternAnalysis phenotypes found in cohort.")
            self.sankey_generators = {}
            self.df = pd.DataFrame(
                columns=[
                    "tpa_name",
                    "from_period",
                    "to_period",
                    "from_regimen",
                    "to_regimen",
                    "n_patients",
                ]
            )
            return self.df

        self.sankey_generators = {}
        all_dfs = []
        for tpa_name, periods in tpa_groups.items():
            gen = SankeyGenerator(tpa_name=tpa_name, periods=periods)
            gen.build()
            self.sankey_generators[tpa_name] = gen
            all_dfs.append(gen.df_links)

        self.df = (
            pd.concat(all_dfs, ignore_index=True)
            if all_dfs
            else pd.DataFrame(
                columns=[
                    "tpa_name",
                    "from_period",
                    "to_period",
                    "from_regimen",
                    "to_regimen",
                    "n_patients",
                ]
            )
        )
        return self.df

    def to_json(self, filename: str) -> str:
        """Export to JSON, including the full sankey graph (nodes + links) needed for HTML generation."""
        if not hasattr(self, "sankey_generators"):
            raise AttributeError("Call execute() first.")

        filepath = Path(filename)
        if filepath.suffix != ".json":
            filepath = filepath.with_suffix(".json")
        filepath.parent.mkdir(parents=True, exist_ok=True)

        sankey_data_list = [
            {"tpa_name": name, "nodes": gen.nodes, "links": gen.links}
            for name, gen in self.sankey_generators.items()
        ]
        payload = {
            "reporter_type": self.__class__.__name__,
            "sankey_data": sankey_data_list,
            "rows": self.df.to_dict(orient="records"),
        }

        with filepath.open("w") as f:
            json.dump(payload, f, indent=2, default=str)

        return str(filepath.absolute())

    def to_html(self, filename: str) -> str:
        """Export as a self-contained HTML page with d3-sankey diagram(s)."""
        if not hasattr(self, "sankey_generators"):
            raise AttributeError("Call execute() first.")

        filepath = Path(filename)
        if filepath.suffix != ".html":
            filepath = filepath.with_suffix(".html")
        filepath.parent.mkdir(parents=True, exist_ok=True)

        sankey_data_list = [
            {"tpa_name": name, "nodes": gen.nodes, "links": gen.links}
            for name, gen in self.sankey_generators.items()
        ]
        filepath.write_text(_build_sankey_html(sankey_data_list), encoding="utf-8")
        return str(filepath.absolute())

    def to_png(self, filename: str) -> str:
        """Export as PNG via playwright screenshot of the HTML output."""
        import tempfile

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise ImportError(
                "playwright is required for PNG export. "
                "Install with: pip install playwright && playwright install chromium"
            )

        filepath = Path(filename)
        if filepath.suffix != ".png":
            filepath = filepath.with_suffix(".png")
        filepath.parent.mkdir(parents=True, exist_ok=True)

        with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            self.to_html(tmp_path)
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                page.goto(f"file://{tmp_path}")
                page.wait_for_timeout(1500)
                page.screenshot(path=str(filepath), full_page=True)
                browser.close()
        finally:
            Path(tmp_path).unlink(missing_ok=True)

        return str(filepath.absolute())


# ---------------------------------------------------------------------------
# HTML / d3-sankey template builders
# ---------------------------------------------------------------------------


def _build_sankey_html(sankey_data_list: list) -> str:
    """Grid bump-chart: rows = regimen combos grouped by stack size (Single / Dual / Triple…),
    columns = time periods.  A dot (diameter = MAX_THICK) marks every (regimen, period) cell
    that has patients; cubic-bezier flows whose stroke-width scales with patient count connect
    dots across consecutive time periods.  Rounded stroke-linecap gives the flows a pill shape.
    """
    data_json = json.dumps(sankey_data_list, default=str)
    colors_json = json.dumps(_COLORS)

    head = """\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<title>Treatment Pattern Flow</title>
<style>
  body { font-family: Arial, sans-serif; background: #fff; margin: 0; padding: 20px; }
  .diagram-section { margin-bottom: 60px; }
  .diagram-title { font-size: 15px; font-weight: bold; color: #333; margin: 0 0 8px 0; }
</style>
</head>
<body>
<div id="charts"></div>
<script>
const allData = """

    middle = """;
const COLORS = """

    tail = """;

/* ── layout constants ───────────────────────────────────────────────────── */
var MIN_THICK = .5, MAX_THICK = 25;
var DOT_R     = MAX_THICK / 2;
var ROW_H     = 50, SEC_HDR_H = 26, SEC_GAP = 14;
var PERIOD_SPC = 170, LEFT = 360, TOP = 58, RIGHT = 50;
var NS = 'http://www.w3.org/2000/svg';

/* ── tiny SVG helpers ───────────────────────────────────────────────────── */
function mkEl(tag, attrs, parent) {
  var e = document.createElementNS(NS, tag);
  if (attrs) Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
  if (parent) parent.appendChild(e);
  return e;
}
function mkTip(text, parent) {
  var t = document.createElementNS(NS, 'title');
  t.textContent = text;
  parent.appendChild(t);
}
function mkTxt(text, attrs, parent) {
  var e = mkEl('text', attrs, parent);
  e.textContent = text;
  return e;
}

/* ── domain helpers ─────────────────────────────────────────────────────── */
function stackSize(name) {
  if (name === 'None') return 99;
  return (name.match(/\\+/g) || []).length + 1;
}
function shortPeriodLabel(label, num) {
  var m = label.match(/from day (\\d+) to (\\d+)/i);
  return m ? 'D' + m[1] + '\u2013' + m[2] : 'P' + num;
}
function sectionLabel(n) {
  if (n === 99) return 'Untreated';
  return (['', 'Single', 'Dual', 'Triple', 'Quadruple'])[n] || (n + '-Drug');
}

/* ── main render loop ───────────────────────────────────────────────────── */
allData.forEach(function(groupData) {
  var container = document.getElementById('charts');
  var section   = document.createElement('div');
  section.className = 'diagram-section';
  container.appendChild(section);

  var titleEl = document.createElement('p');
  titleEl.className = 'diagram-title';
  titleEl.textContent = 'Treatment Pattern Flow: ' + groupData.tpa_name;
  section.appendChild(titleEl);

  /* toggle checkbox ─────────────────────────────────────────────────────── */
  var cbWrap = document.createElement('label');
  cbWrap.style.cssText = 'font-size:12px;color:#666;cursor:pointer;user-select:none;' +
                         'display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;';
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cbWrap.appendChild(cb);
  cbWrap.appendChild(document.createTextNode('Hide empty rows'));
  section.appendChild(cbWrap);

  var nodes = groupData.nodes || [];
  var links = groupData.links || [];
  if (nodes.length === 0) return;

  var nodeByIdx = nodes.slice();

  /* names with any patients or referenced by a link */
  var seen = {};
  nodes.forEach(function(n) { if (n.value > 0) seen[n.display_name] = true; });
  links.forEach(function(lk) {
    var s = nodeByIdx[lk.source], t = nodeByIdx[lk.target];
    if (s) seen[s.display_name] = true;
    if (t) seen[t.display_name] = true;
  });

  /* all unique names (stable colour assignment) */
  var allUniq = Array.from(new Set(nodes.map(function(n) { return n.display_name; }))).sort();
  var colorMap = {};
  allUniq.forEach(function(nm, i) { colorMap[nm] = COLORS[i % COLORS.length]; });

  var active  = Object.keys(seen).sort();            /* has data */
  var zeroSet = new Set(allUniq.filter(function(nm) { return !seen[nm]; }));

  /* group ALL names by stack-size — zero rows included */
  var groups = {};
  allUniq.forEach(function(nm) {
    var s = stackSize(nm);
    if (!groups[s]) groups[s] = [];
    groups[s].push(nm);
  });
  var sizes = Object.keys(groups).map(Number).sort(function(a, b) { return a - b; });

  /* ── Y layout (all names) ─────────────────────────────────────────────── */
  var rowY = {}, secInfo = [], curY = 0;
  sizes.forEach(function(s) {
    secInfo.push({ s: s, y: curY, names: groups[s] });
    curY += SEC_HDR_H;
    groups[s].forEach(function(nm) {
      rowY[nm] = curY + ROW_H / 2;
      curY += ROW_H;
    });
    curY += SEC_GAP;
  });
  var totalH = curY;

  /* ── X layout ─────────────────────────────────────────────────────────── */
  var periods = Array.from(new Set(nodes.map(function(n) { return n.period; })));
  periods.sort(function(a, b) { return a - b; });
  var periodX = {}, periodLabel = {};
  periods.forEach(function(p, i) { periodX[p] = LEFT + i * PERIOD_SPC; });
  nodes.forEach(function(n) {
    if (!periodLabel[n.period]) periodLabel[n.period] = shortPeriodLabel(n.period_label, n.period);
  });

  /* ── scale functions ──────────────────────────────────────────────────── */
  var maxV     = links.reduce(function(m, lk) { return Math.max(m, lk.value); }, 1);
  var maxNodeV = nodes.reduce(function(m, n)  { return Math.max(m, n.value);  }, 1);
  var DOT_MAX_R = (MAX_THICK - 8) / 2, DOT_MIN_R = (MIN_THICK + 4) / 2;
  function strokeW(v) { return MIN_THICK + (v / maxV)      * (MAX_THICK - MIN_THICK); }
  function dotR(v)    { return DOT_MIN_R  + (v / maxNodeV) * (DOT_MAX_R - DOT_MIN_R); }

  /* ── build SVG ────────────────────────────────────────────────────────── */
  var svgW = LEFT + (periods.length - 1) * PERIOD_SPC + MAX_THICK / 2 + RIGHT;
  var svgH = TOP + totalH + 20;
  var svg  = mkEl('svg', { width: svgW, height: svgH });
  section.appendChild(svg);

  var g = mkEl('g', { transform: 'translate(0,' + TOP + ')' }, svg);

  /* section background bands */
  secInfo.forEach(function(sec) {
    var bandH = SEC_HDR_H + sec.names.length * ROW_H;
    mkEl('rect', { x: 0, y: sec.y, width: svgW, height: bandH,
                   fill: '#f5f5f5', opacity: 0.6, rx: 20, ry: 20 }, g);
    mkTxt(sectionLabel(sec.s),
          { x: 20, y: sec.y + SEC_HDR_H, 'font-size': '12px',
            'font-weight': 'bold', fill: '#777' }, g);
  });

  /* period grid lines */
  periods.forEach(function(p) {
    mkEl('line', { x1: periodX[p], y1: 0, x2: periodX[p], y2: totalH,
                   stroke: '#e0e0e0', 'stroke-width': 0,
                   'stroke-dasharray': '4,4' }, g);
  });

  /* period column labels */
  periods.forEach(function(p) {
    mkTxt(periodLabel[p],
          { x: periodX[p], y: TOP - 10, 'text-anchor': 'middle',
            'font-size': '11px', 'font-weight': 'bold', fill: '#444' }, svg);
  });

  /* row labels — all names; zero rows styled lighter */
  allUniq.forEach(function(nm) {
    if (rowY[nm] === undefined) return;
    var isZero = zeroSet.has(nm);
    mkTxt(nm, { x: LEFT - 35, y: rowY[nm] + 4, 'text-anchor': 'end',
                'font-size': '12px', 'font-weight': isZero ? 'normal' : 'bold',
                fill: isZero ? '#bbb' : (colorMap[nm] || '#333'),
                'data-row-label': nm }, g);
  });

  /* flows */
  links.forEach(function(lk) {
    var srcN = nodeByIdx[lk.source], tgtN = nodeByIdx[lk.target];
    if (!srcN || !tgtN) return;
    var x1 = periodX[srcN.period], y1 = rowY[srcN.display_name];
    var x2 = periodX[tgtN.period], y2 = rowY[tgtN.display_name];
    if (x1 === undefined || y1 === undefined ||
        x2 === undefined || y2 === undefined) return;
    var mx = (x1 + x2) / 2;
    var pathEl = mkEl('path', {
      d: 'M ' + x1 + ',' + y1 +
         ' C ' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2,
      fill: 'none',
      stroke: colorMap[srcN.display_name] || '#888',
      'stroke-width': strokeW(lk.value),
      'stroke-opacity': 0.45, 'stroke-linecap': 'round',
      'data-regimen': srcN.display_name, 'data-to': tgtN.display_name
    }, g);
    mkTip(srcN.display_name + ' \u2192 ' + tgtN.display_name +
          '\\n' + lk.value + ' patients', pathEl);
  });

  /* period-1 total for % labels */
  var period1Total = nodes.reduce(function(s, n) {
    return n.period === periods[0] ? s + n.value : s;
  }, 0);

  /* dots + labels */
  nodes.forEach(function(n) {
    if (n.value === 0) return;
    var cx = periodX[n.period], cy = rowY[n.display_name];
    if (cx === undefined || cy === undefined) return;
    var r   = dotR(n.value);
    var col = colorMap[n.display_name] || '#888';
    var c = mkEl('circle', {
      cx: cx, cy: cy, r: r,
      fill: '#fff', 'fill-opacity': 0.55,
      stroke: col, 'stroke-width': 2.5,
      'paint-order': 'stroke fill', 'data-regimen': n.display_name
    }, g);
    mkTip(n.display_name + ' (' + periodLabel[n.period] + ')\\n' + n.value + ' patients', c);
    var pctVal = period1Total > 0 ? (n.value / period1Total * 100).toFixed(1) : '';
    mkTxt(pctVal, {
      x: cx, y: cy - r - 20, 'text-anchor': 'middle',
      'font-size': '14px', 'font-weight': 'bold', fill: col, 'fill-opacity': 0.9,
      'data-regimen': n.display_name
    }, g);
    mkTxt(n.value.toLocaleString('en-US'), {
      x: cx, y: cy - r - 8, 'text-anchor': 'middle',
      'font-size': '12px', fill: col, 'fill-opacity': 0.5,
      'data-regimen': n.display_name
    }, g);
  });

  /* ── checkbox filter ──────────────────────────────────────────────────── */
  function applyFilter() {
    var hide = cb.checked;
    g.querySelectorAll('[data-row-label]').forEach(function(el) {
      el.style.display = hide && zeroSet.has(el.getAttribute('data-row-label')) ? 'none' : '';
    });
    g.querySelectorAll('rect[data-row-strip]').forEach(function(el) {
      el.style.display = hide && zeroSet.has(el.getAttribute('data-row-strip')) ? 'none' : '';
    });
    g.querySelectorAll('circle[data-regimen]').forEach(function(el) {
      el.style.display = hide && zeroSet.has(el.getAttribute('data-regimen')) ? 'none' : '';
    });
    g.querySelectorAll('text[data-regimen]').forEach(function(el) {
      el.style.display = hide && zeroSet.has(el.getAttribute('data-regimen')) ? 'none' : '';
    });
    g.querySelectorAll('path[data-regimen]').forEach(function(el) {
      var from = el.getAttribute('data-regimen'), to = el.getAttribute('data-to');
      el.style.display = hide && (zeroSet.has(from) || zeroSet.has(to)) ? 'none' : '';
    });
  }
  cb.addEventListener('change', applyFilter);

  /* ── hover strips (active rows only) ─────────────────────────────────── */
  var allPaths     = g.querySelectorAll('path[data-regimen]');
  var allCircles   = g.querySelectorAll('circle[data-regimen]');
  var allLabels    = g.querySelectorAll('text[data-regimen]');
  var allRowLabels = g.querySelectorAll('text[data-row-label]');
  active.forEach(function(nm) {
    if (rowY[nm] === undefined) return;
    var strip = mkEl('rect', {
      x: 0, y: rowY[nm] - ROW_H / 2,
      width: svgW, height: ROW_H,
      fill: 'transparent', cursor: 'default',
      'data-row-strip': nm
    }, g);
    strip.addEventListener('mouseover', function() {
      var targets = new Set([nm]);
      allPaths.forEach(function(p) {
        if (p.getAttribute('data-regimen') === nm) targets.add(p.getAttribute('data-to'));
      });
      allPaths.forEach(function(p) {
        p.setAttribute('stroke-opacity',
          p.getAttribute('data-regimen') === nm ? 0.80 : 0.06);
      });
      allCircles.forEach(function(c) {
        c.setAttribute('fill-opacity',
          targets.has(c.getAttribute('data-regimen')) ? 0.75 : 0.10);
        c.setAttribute('stroke-opacity',
          targets.has(c.getAttribute('data-regimen')) ? 1.0  : 0.20);
      });
      allLabels.forEach(function(t) {
        t.setAttribute('opacity',
          targets.has(t.getAttribute('data-regimen')) ? 1.0 : 0.15);
      });
      allRowLabels.forEach(function(t) {
        t.setAttribute('opacity',
          targets.has(t.getAttribute('data-row-label')) ? 1.0 : 0.15);
      });
    });
    strip.addEventListener('mouseout', function() {
      allPaths.forEach(function(p)   { p.setAttribute('stroke-opacity', 0.45); });
      allCircles.forEach(function(c) {
        c.setAttribute('fill-opacity',   0.55);
        c.setAttribute('stroke-opacity', 1.0);
      });
      allLabels.forEach(function(t)    { t.setAttribute('opacity', 1.0); });
      allRowLabels.forEach(function(t) { t.setAttribute('opacity', 1.0); });
    });
  });
});
</script>
</body>
</html>"""

    return head + data_json + middle + colors_json + tail


def _build_sankey_html_standard(sankey_data_list: list) -> str:
    """Return a self-contained HTML string rendering one sankey per TPA group."""
    data_json = json.dumps(sankey_data_list, default=str)
    colors_json = json.dumps(_COLORS)

    # Split template at the data injection point to avoid f-string / % issues
    # with the JavaScript curly braces.
    head = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Treatment Pattern Sankey</title>
<script src="https://unpkg.com/d3@7/dist/d3.min.js"></script>
<script src="https://unpkg.com/d3-sankey@0.12.3/dist/d3-sankey.min.js"></script>
<style>
  body { font-family: Arial, sans-serif; background: #fff; margin: 0; padding: 20px; }
  .diagram-section { margin-bottom: 60px; }
  .diagram-title { font-size: 15px; font-weight: bold; color: #333; margin: 0 0 8px 0; }
  .node rect { shape-rendering: crispEdges; stroke: #444; stroke-width: 0.5px; }
  .node text { font-size: 11px; fill: #222; pointer-events: none; }
  .link { fill: none; }
  .link:hover { stroke-opacity: 0.65 !important; }
  .period-label { font-size: 12px; fill: #555; font-weight: bold; }
</style>
</head>
<body>
<div id="charts"></div>
<script>
const allData = """

    middle = """;
const COLORS = """

    tail = """;

allData.forEach(function(d) {
  var container = document.getElementById("charts");
  var section = document.createElement("div");
  section.className = "diagram-section";
  container.appendChild(section);

  var titleEl = document.createElement("p");
  titleEl.className = "diagram-title";
  titleEl.textContent = "Treatment Pattern Analysis: " + d.tpa_name;
  section.appendChild(titleEl);

  // Layout dimensions
  var margin = {top: 110, right: 250, bottom: 10, left: 10};
  var width  = 960 - margin.left - margin.right;
  var height = 520 - margin.top  - margin.bottom;

  var svg = d3.select(section)
    .append("svg")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Empty-state message
  if (!d.links || d.links.length === 0) {
    svg.append("text")
      .attr("x", width / 2).attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#999")
      .text("No patient flows to display.");
    return;
  }

  // Consistent colour per unique regimen display_name
  var uniqueNames = Array.from(new Set(d.nodes.map(function(n) { return n.display_name; })));
  var colorMap = {};
  uniqueNames.forEach(function(nm, i) { colorMap[nm] = COLORS[i % COLORS.length]; });

  // Deep-copy nodes/links — d3-sankey mutates its input.
  // Drop nodes with value === 0 and any links that reference them.
  var allNodes = d.nodes.map(function(n, i) {
    return Object.assign({}, n, {origIndex: i});
  });
  var keepSet = new Set(allNodes.filter(function(n) { return n.value > 0; }).map(function(n) { return n.origIndex; }));
  var nodes = allNodes.filter(function(n) { return keepSet.has(n.origIndex); });
  // Build a remapping from original index → new index
  var origToNew = {};
  nodes.forEach(function(n, i) { origToNew[n.origIndex] = i; n.index = i; });
  var links = d.links
    .filter(function(l) { return keepSet.has(l.source) && keepSet.has(l.target); })
    .map(function(l) {
      return { source: origToNew[l.source], target: origToNew[l.target], value: l.value };
    });

  var sankeyLayout = d3.sankey()
    .nodeId(function(n) { return n.index; })
    .nodeWidth(22)
    .nodePadding(14)
    .extent([[0, 0], [width, height]]);

  var graph = sankeyLayout({nodes: nodes, links: links});

  // ---- Period labels across the top ----
  var periods = Array.from(new Set(graph.nodes.map(function(n) { return n.period; })));
  periods.sort(function(a, b) { return a - b; });

  var periodX = {};
  periods.forEach(function(p) {
    var pNodes = graph.nodes.filter(function(n) { return n.period === p; });
    periodX[p] = d3.mean(pNodes, function(n) { return (n.x0 + n.x1) / 2; });
  });

  // Use period_label from first node of each period
  var periodLabel = {};
  periods.forEach(function(p) {
    var pNode = graph.nodes.find(function(n) { return n.period === p; });
    periodLabel[p] = pNode ? pNode.period_label : ("Period " + p);
  });

  svg.append("g")
    .selectAll("text.period-label")
    .data(periods)
    .join("text")
    .attr("class", "period-label")
    .attr("text-anchor", "start")
    .attr("transform", function(p) {
      return "translate(" + periodX[p] + ",-10) rotate(-10)";
    })
    .text(function(p) { return periodLabel[p]; });

  // ---- Links ----
  svg.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(graph.links)
    .join("path")
    .attr("class", "link")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", function(l) { return colorMap[l.source.display_name]; })
    .attr("stroke-width", function(l) { return Math.max(1, l.width); })
    .attr("stroke-opacity", 0.38)
    .append("title")
    .text(function(l) {
      return l.source.display_name + " \u2192 " + l.target.display_name
           + "\\n" + l.value + " patients";
    });

  // ---- Nodes ----
  var nodeG = svg.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(graph.nodes)
    .join("g")
    .attr("class", "node");

  nodeG.append("rect")
    .attr("x",      function(n) { return n.x0; })
    .attr("y",      function(n) { return n.y0; })
    .attr("width",  function(n) { return n.x1 - n.x0; })
    .attr("height", function(n) { return Math.max(1, n.y1 - n.y0); })
    .attr("fill",         function(n) { return colorMap[n.display_name]; })
    .attr("fill-opacity", 0.88)
    .append("title")
    .text(function(n) { return n.display_name + ": " + (n.value || 0) + " patients"; });

  // Labels always to the right of each node rectangle
  nodeG.append("text")
    .attr("x",           function(n) { return n.x1 + 6; })
    .attr("y",           function(n) { return (n.y0 + n.y1) / 2; })
    .attr("dy",          "0.35em")
    .attr("text-anchor", "start")
    .text(function(n) { return n.display_name + " (" + (n.value || 0) + ")"; });
});
</script>
</body>
</html>"""

    return head + data_json + middle + colors_json + tail
