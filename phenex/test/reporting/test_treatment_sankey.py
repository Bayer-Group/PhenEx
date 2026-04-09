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
    assert "d3-sankey" in html

    # Verify all expected regimen labels appear in the output
    expected_labels = [
        "FZT only",
        "HT + FZT",
        "EZT + FZT",
        "HT + EZT + FZT",
    ]
    for label in expected_labels:
        assert label in html, f"Expected label '{label}' not found in HTML"

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
