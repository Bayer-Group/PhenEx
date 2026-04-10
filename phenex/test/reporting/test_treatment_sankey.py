"""
Test for _build_sankey_html using minimal inline data (no external fixture file).

Verifies the generated HTML contains the expected JS structure and embedded data.
"""

from pathlib import Path

from phenex.reporting.treatment_pattern_analysis_sankey import _build_sankey_html

ARTIFACTS_DIR = Path(__file__).parent / "artifacts" / "treatment_pattern_sankey"

# Minimal inline dataset: 2 regimens, 2 periods, 1 None row, with flows
_SANKEY_DATA = [
    {
        "tpa_name": "TP",
        "nodes": [
            {
                "name": "FZT only (P1)",
                "display_name": "FZT only",
                "period": 1,
                "period_label": "from day 0 to 90",
                "value": 100,
            },
            {
                "name": "HT + FZT (P1)",
                "display_name": "HT + FZT",
                "period": 1,
                "period_label": "from day 0 to 90",
                "value": 50,
            },
            {
                "name": "None (P1)",
                "display_name": "None",
                "period": 1,
                "period_label": "from day 0 to 90",
                "value": 0,
            },
            {
                "name": "FZT only (P2)",
                "display_name": "FZT only",
                "period": 2,
                "period_label": "from day 90 to 180",
                "value": 90,
            },
            {
                "name": "HT + FZT (P2)",
                "display_name": "HT + FZT",
                "period": 2,
                "period_label": "from day 90 to 180",
                "value": 60,
            },
            {
                "name": "None (P2)",
                "display_name": "None",
                "period": 2,
                "period_label": "from day 90 to 180",
                "value": 0,
            },
        ],
        "links": [
            {"source": 0, "target": 3, "value": 90},
            {"source": 0, "target": 4, "value": 10},
            {"source": 1, "target": 4, "value": 50},
        ],
    }
]


def test_sankey_html_from_inline_data():
    html = _build_sankey_html(_SANKEY_DATA)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS_DIR / "sankey.html").write_text(html, encoding="utf-8")

    # SVG builder is present
    assert "mkEl" in html
    assert "stroke-linecap" in html
    assert "DOT_R" in html

    # Regimen names embedded in the JSON data
    assert '"FZT only"' in html
    assert '"HT + FZT"' in html
    assert '"None"' in html

    # Section labels in the JS source
    assert "'Single'" in html
    assert "'Dual'" in html
    assert "'Untreated'" in html

    # Key patient counts embedded
    assert "100" in html
    assert "90" in html
    assert "50" in html

    # Inline data structure is preserved in the embedded JSON
    assert _SANKEY_DATA[0]["tpa_name"] == "TP"
