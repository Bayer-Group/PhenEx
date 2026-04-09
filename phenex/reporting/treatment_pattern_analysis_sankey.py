import json
import pandas as pd
from pathlib import Path

from phenex.reporting.reporter import Reporter
from phenex.reporting.treatment_pattern_analysis_mixin import _TreatmentPatternAnalysisMixin
from phenex.util import create_logger

logger = create_logger(__name__)

# ----------------------------------------------------------------------------
# Tableau-10 colour palette: one colour per unique regimen combination.
# The same display_name gets the same colour across all periods.
# ----------------------------------------------------------------------------
_COLORS = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac",
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
                nodes.append({
                    "name": f"{pt.display_name} ({period_label})",
                    "display_name": pt.display_name,
                    "period": period_num,
                    "period_label": period_label,
                    "value": 0,
                })

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
                    pt.table
                    .select("PERSON_ID")
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
                        links.append({
                            "source": node_index[(p_from_num, pt_from.name)],
                            "target": node_index[(p_to_num, pt_to.name)],
                            "value": flow,
                        })
                        link_rows.append({
                            "tpa_name": self.tpa_name,
                            "from_period": p_from_num,
                            "to_period": p_to_num,
                            "from_regimen": pt_from.display_name,
                            "to_regimen": pt_to.display_name,
                            "n_patients": flow,
                        })

        self.nodes = nodes
        self.links = links
        self.df_links = (
            pd.DataFrame(link_rows)
            if link_rows
            else pd.DataFrame(
                columns=[
                    "tpa_name", "from_period", "to_period",
                    "from_regimen", "to_regimen", "n_patients",
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

    def execute(self, cohort):
        self.cohort = cohort

        all_phenotypes = (
            list(getattr(cohort, "characteristics", None) or [])
            + list(getattr(cohort, "outcomes", None) or [])
        )

        tpa_groups = self._group_tpa_phenotypes(all_phenotypes)

        if not tpa_groups:
            logger.warning("No TreatmentPatternAnalysis phenotypes found in cohort.")
            self.sankey_generators = {}
            self.df = pd.DataFrame(
                columns=[
                    "tpa_name", "from_period", "to_period",
                    "from_regimen", "to_regimen", "n_patients",
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
                    "tpa_name", "from_period", "to_period",
                    "from_regimen", "to_regimen", "n_patients",
                ]
            )
        )
        return self.df

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
# HTML / d3-sankey template builder
# ---------------------------------------------------------------------------

def _build_sankey_html(sankey_data_list: list) -> str:
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
