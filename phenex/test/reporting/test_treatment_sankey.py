"""
Test for TreatmentPatternAnalysisSankeyReporter HTML generation using
pre-computed fixture data from a real LUMINOUS analysis run.

The fixture (fixtures/treatment_pattern_sankey.json) contains the nodes and
links in the d3-sankey input format, with exact patient counts from
TreatmentPatternAnalysisSankeyReporter.json.

The test calls _build_sankey_html directly with the fixture data and writes the
resulting HTML to artifacts/treatment_pattern_sankey/sankey.html.
"""

import json
import os
from pathlib import Path

from phenex.reporting.treatment_pattern_analysis_sankey import _build_sankey_html

FIXTURES_DIR = Path(__file__).parent / "fixtures"
ARTIFACTS_DIR = Path(__file__).parent / "artifacts" / "treatment_pattern_sankey"


def test_sankey_html_from_fixture():
    with open(FIXTURES_DIR / "treatment_pattern_sankey.json", encoding="utf-8") as f:
        sankey_data = json.load(f)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    html = _build_sankey_html(sankey_data)

    html_path = ARTIFACTS_DIR / "sankey.html"
    html_path.write_text(html, encoding="utf-8")

    assert html_path.exists()

    # SVG elements are built at runtime via JS — verify the template and embedded
    # data are both present in the static file.
    assert "mkEl" in html           # SVG helper function is defined
    assert "stroke-linecap" in html  # flows use rounded-cap strokes
    assert "DOT_R" in html           # dot-radius constant is defined

    # Active regimen names must appear in the embedded JSON data
    assert '"FZT only"' in html
    assert '"HT + FZT"' in html
    assert '"EZT + FZT"' in html
    assert '"HT + EZT + FZT"' in html

    # Section labels appear in the JS sectionLabel() function definition
    assert "'Single'" in html
    assert "'Dual'" in html
    assert "'Triple'" in html
    assert "'Untreated'" in html   # None rows get their own Untreated section

    # "None" display name must appear in the embedded fixture data
    assert '"None"' in html

    # Key patient counts from the fixture must be embedded in the JSON
    assert "7688" in html   # FZT only, period 1 node value
    assert "7248" in html   # FZT only → FZT only, period 1→2 link
    assert "438" in html    # FZT only → HT+FZT link

    # Verify key patient counts from the fixture appear in the serialised data
    fixture_entry = sankey_data[0]
    assert fixture_entry["tpa_name"] == "TP"

    # Spot-check node values (from TreatmentPatternAnalysisSankeyReporter.json)
    node_values = {n["display_name"]: n["value"] for n in fixture_entry["nodes"] if n["period"] == 1}
    assert node_values["FZT only"] == 7688
    assert node_values["HT + FZT"] == 784
    assert node_values["EZT + FZT"] == 1

    # Spot-check link flows (period 1 → period 2)
    period1_links = [
        lk for lk in fixture_entry["links"] if lk["source"] in {2, 4, 5}
    ]
    fzt_to_fzt = next(lk for lk in period1_links if lk["source"] == 2 and lk["target"] == 9)
    assert fzt_to_fzt["value"] == 7248

    fzt_to_htfzt = next(lk for lk in period1_links if lk["source"] == 2 and lk["target"] == 11)
    assert fzt_to_htfzt["value"] == 438
