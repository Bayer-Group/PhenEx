"""
Generate a dummy study Excel report via OutputConcatenator without running any cohort.

Creates 5 cohort directories under a temporary study execution path, writes
realistic (million-scale) JSON report files into each, then calls
OutputConcatenator to produce:

    phenex/test/artifacts/test_study_excel.xlsx
"""

import json
import math
import os
import random
from pathlib import Path

from phenex.util.output_concatenator import OutputConcatenator

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HERE = Path(__file__).parent
ARTIFACTS_DIR = _HERE / "artifacts"
STUDY_EXEC_DIR = ARTIFACTS_DIR / "dummy_study_exec"

COHORT_NAMES = [
    "cohort_a",
    "cohort_a__female",
    "cohort_a__male",
    "cohort_b",
    "cohort_b__female",
    "cohort_b__male",
    "cohort_c",
    "cohort_d",
    "cohort_d__age_lt_50",
    "cohort_d__age_gte_50",
    "cohort_d__diabetic",
    "cohort_e",
]

# ---------------------------------------------------------------------------
# Dummy data helpers
# ---------------------------------------------------------------------------

_N_DB = 6_200_000

# Each cohort/subcohort gets a slightly different entry / final size
_COHORT_PARAMS = {
    "cohort_a": dict(n_entry=2_300_000, n_final=840_000, entry_pct=37.1),
    "cohort_a__female": dict(n_entry=1_150_000, n_final=430_000, entry_pct=18.7),
    "cohort_a__male": dict(n_entry=1_150_000, n_final=410_000, entry_pct=18.4),
    "cohort_b": dict(n_entry=2_150_000, n_final=790_000, entry_pct=34.7),
    "cohort_b__female": dict(n_entry=1_080_000, n_final=400_000, entry_pct=17.4),
    "cohort_b__male": dict(n_entry=1_070_000, n_final=390_000, entry_pct=17.3),
    "cohort_c": dict(n_entry=2_420_000, n_final=910_000, entry_pct=39.0),
    "cohort_d": dict(n_entry=1_980_000, n_final=720_000, entry_pct=31.9),
    "cohort_d__age_lt_50": dict(n_entry=980_000, n_final=350_000, entry_pct=15.8),
    "cohort_d__age_gte_50": dict(n_entry=1_000_000, n_final=370_000, entry_pct=16.1),
    "cohort_d__diabetic": dict(n_entry=240_000, n_final=86_000, entry_pct=3.8),
    "cohort_e": dict(n_entry=2_560_000, n_final=960_000, entry_pct=41.3),
}


def _waterfall(p: dict) -> dict:
    n_entry = p["n_entry"]
    n_final = p["n_final"]
    n1 = n_entry
    n2 = round(n_entry * 0.99)
    n3 = round(n_entry * 0.82)
    n4 = round(n_entry * 0.43)
    return {
        "reporter_type": "Waterfall",
        "rows": [
            {
                "Type": "info",
                "Index": "",
                "Name": "N persons in database",
                "N": _N_DB,
                "Pct_N": None,
                "Remaining": None,
                "Pct_Remaining": None,
                "Delta": None,
                "Pct_Source_Database": None,
            },
            {
                "Type": "entry",
                "Index": "1",
                "Name": "Entry criterion",
                "N": n1,
                "Pct_N": 100.0,
                "Remaining": n1,
                "Pct_Remaining": 100.0,
                "Delta": None,
                "Pct_Source_Database": round(n1 / _N_DB * 100, 1),
            },
            {
                "Type": "inclusion",
                "Index": "2",
                "Name": "Inclusion A",
                "N": n2,
                "Pct_N": round(n2 / n1 * 100, 1),
                "Remaining": n2,
                "Pct_Remaining": round(n2 / n1 * 100, 1),
                "Delta": n2 - n1,
                "Pct_Source_Database": None,
            },
            {
                "Type": "inclusion",
                "Index": "3",
                "Name": "Inclusion B",
                "N": n3,
                "Pct_N": round(n3 / n1 * 100, 1),
                "Remaining": n3,
                "Pct_Remaining": round(n3 / n1 * 100, 1),
                "Delta": n3 - n2,
                "Pct_Source_Database": None,
            },
            {
                "Type": "exclusion",
                "Index": "4",
                "Name": "Exclusion A",
                "N": n4,
                "Pct_N": round(n4 / n1 * 100, 1),
                "Remaining": n4,
                "Pct_Remaining": round(n4 / n1 * 100, 1),
                "Delta": None,
                "Pct_Source_Database": None,
            },
            {
                "Type": "info",
                "Index": "",
                "Name": "Final Cohort Size",
                "N": None,
                "Pct_N": None,
                "Remaining": n_final,
                "Pct_Remaining": round(n_final / n1 * 100, 1),
                "Delta": None,
                "Pct_Source_Database": round(n_final / _N_DB * 100, 1),
            },
        ],
    }


def _waterfall_detailed(p: dict) -> dict:
    """Waterfall with component phenotype rows."""
    base = _waterfall(p)
    n_entry = p["n_entry"]
    # Insert component rows after the entry row
    entry_row = base["rows"][1]
    comp1 = {
        "Type": "component",
        "Index": "1.1",
        "Name": "Component 1",
        "N": round(n_entry * 0.95),
        "Pct_N": 95.0,
        "Remaining": None,
        "Pct_Remaining": None,
        "Delta": None,
        "Pct_Source_Database": None,
    }
    comp2 = {
        "Type": "component",
        "Index": "1.2",
        "Name": "Component 2",
        "N": round(n_entry * 0.60),
        "Pct_N": 60.0,
        "Remaining": None,
        "Pct_Remaining": None,
        "Delta": None,
        "Pct_Source_Database": None,
    }
    rows = [base["rows"][0], entry_row, comp1, comp2] + base["rows"][2:]
    return {"reporter_type": "Waterfall", "rows": rows}


def _null_stats() -> dict:
    return {
        k: None
        for k in ("Mean", "STD", "Min", "P10", "P25", "Median", "P75", "P90", "Max")
    }


def _dummy_values(mean: float, std: float, n: int = 500, seed: int = 42) -> list:
    """Generate *n* normally-distributed dummy values for histogram visualization."""
    rng = random.Random(seed)
    return [round(rng.gauss(mean, std), 2) for _ in range(n)]


def _table1(p: dict) -> dict:
    n = p["n_final"]

    def row(name, count, mean=None, std=None, median=None, level=0):
        r = {
            "Name": name,
            "N": count,
            "Pct": round(count / n * 100, 2),
            "_level": level,
            **_null_stats(),
        }
        if mean is not None:
            r.update({"Mean": mean, "STD": std, "Median": median})
        return r

    rows = [
        {"Name": "Cohort", "N": n, "Pct": 100.0, "_level": 0, **_null_stats()},
        row("Age", n, mean=52.3, std=7.1, median=52.0),
        row("Binned age=[40-45)", round(n * 0.178)),
        row("Binned age=[45-50)", round(n * 0.200)),
        row("Binned age=[50-55)", round(n * 0.232)),
        row("Binned age=[55-60)", round(n * 0.218)),
        row("Binned age=[60-65)", round(n * 0.172)),
        row("Age group=[18-30)", round(n * 0.08)),
        row("Age group=[30-40)", round(n * 0.14)),
        row("Age group=[40-50)", round(n * 0.26)),
        row("Age group=[50-60)", round(n * 0.31)),
        row("Age group=[60-70)", round(n * 0.15)),
        row("Age group=[70-80)", round(n * 0.05)),
        row("Age group=[80+)", round(n * 0.01)),
        row("Race=White", round(n * 0.62)),
        row("Race=Asian", round(n * 0.11)),
        row("Race=Black or African American", round(n * 0.14)),
        row("Race=Hispanic or Latino", round(n * 0.08)),
        row("Race=Other", round(n * 0.05)),
        row("BMI", n, mean=28.4, std=5.9, median=27.5),
        row("Hypertension", round(n * 0.35)),
        row("Diabetes", round(n * 0.12)),
        row("Depression", round(n * 0.18)),
        row("Anxiety", round(n * 0.15)),
        row("Osteoporosis", round(n * 0.08)),
        row("Coronary heart disease", round(n * 0.06)),
        row("Stroke", round(n * 0.014)),
    ]
    sections = {
        "Demographics": ["Age", "Binned age", "Age group", "Race"],
        "Observations": ["BMI"],
        "Comorbidities": [
            "Hypertension",
            "Diabetes",
            "Depression",
            "Anxiety",
            "Osteoporosis",
            "Coronary heart disease",
            "Stroke",
        ],
    }
    value_distributions = {
        "Age": _dummy_values(52.3, 7.1, seed=hash(p["n_final"]) % 2**31),
        "BMI": _dummy_values(28.4, 5.9, seed=hash(p["n_final"]) % 2**31 + 1),
    }
    return {
        "reporter_type": "Table1",
        "rows": rows,
        "sections": sections,
        "value_distributions": value_distributions,
    }


def _table1_detailed(p: dict) -> dict:
    """Table1 with _level > 0 rows for nested phenotypes."""
    base = _table1(p)
    n = p["n_final"]

    def row(name, count, level=1):
        return {
            "Name": name,
            "N": count,
            "Pct": round(count / n * 100, 2),
            "_level": level,
            **_null_stats(),
        }

    extras = [
        row("Hypertension=ICD code", round(n * 0.28), level=1),
        row("Hypertension=Rx", round(n * 0.21), level=1),
    ]
    # Insert after Hypertension row
    rows = []
    for r in base["rows"]:
        rows.append(r)
        if r["Name"] == "Hypertension":
            rows.extend(extras)
    return {"reporter_type": "Table1", "rows": rows, "sections": base["sections"]}


def _table1_outcomes(p: dict) -> dict:
    n = p["n_final"]

    def row(name, count, mean=None, std=None, median=None):
        r = {
            "Name": name,
            "N": count,
            "Pct": round(count / n * 100, 2),
            "_level": 0,
            **_null_stats(),
        }
        if mean is not None:
            r.update({"Mean": mean, "STD": std, "Median": median})
        return r

    rows = [
        {"Name": "Cohort", "N": n, "Pct": 100.0, "_level": 0, **_null_stats()},
        row("Time to first MI", n, mean=4.2, std=2.8, median=3.7),
        row("Time to first stroke", n, mean=5.1, std=3.2, median=4.5),
        row("All-cause mortality", round(n * 0.08)),
        row("CV mortality", round(n * 0.04)),
        row("MI", round(n * 0.12)),
        row("Stroke", round(n * 0.07)),
        row("Heart failure", round(n * 0.09)),
        row("Hospitalisation", round(n * 0.22)),
    ]
    sections = {
        "Time-to-event": ["Time to first MI", "Time to first stroke"],
        "Events": [
            "All-cause mortality",
            "CV mortality",
            "MI",
            "Stroke",
            "Heart failure",
            "Hospitalisation",
        ],
    }
    value_distributions = {
        "Time to first MI": _dummy_values(4.2, 2.8, seed=hash(p["n_final"]) % 2**31 + 2),
        "Time to first stroke": _dummy_values(5.1, 3.2, seed=hash(p["n_final"]) % 2**31 + 3),
    }
    return {
        "reporter_type": "Table1",
        "rows": rows,
        "sections": sections,
        "value_distributions": value_distributions,
    }


def _table1_outcomes_detailed(p: dict) -> dict:
    base = _table1_outcomes(p)
    n = p["n_final"]

    def row(name, count, level=1):
        return {
            "Name": name,
            "N": count,
            "Pct": round(count / n * 100, 2),
            "_level": level,
            **_null_stats(),
        }

    extras = [
        row("MI=ICD code", round(n * 0.08), level=1),
        row("MI=adjudicated", round(n * 0.06), level=1),
    ]
    rows = []
    for r in base["rows"]:
        rows.append(r)
        if r["Name"] == "MI":
            rows.extend(extras)
    return {"reporter_type": "Table1", "rows": rows, "sections": base["sections"]}


def _write_json(path: Path, data: dict) -> None:
    """Write dict to JSON, converting NaN to null."""
    path.parent.mkdir(parents=True, exist_ok=True)

    def default(obj):
        if isinstance(obj, float) and math.isnan(obj):
            return None
        raise TypeError(f"Not serializable: {obj!r}")

    with path.open("w") as f:
        json.dump(data, f, indent=2, default=default)


def _write_info(study_dir: Path) -> None:
    info = study_dir / "info.txt"
    info.write_text(
        "Software Environment Information\n"
        "==================================================\n\n"
        "Study Execution Date: 2026-04-01 12:00:00\n\n"
        "Python Version: 3.12.0\n\n"
        "PhenEx Version: 0.1.0\n"
    )


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------


def build_dummy_study() -> Path:
    """Create dummy study directory tree and return the study exec path."""
    study_dir = STUDY_EXEC_DIR
    study_dir.mkdir(parents=True, exist_ok=True)
    _write_info(study_dir)

    for name in COHORT_NAMES:
        params = _COHORT_PARAMS[name]
        cohort_dir = study_dir / name
        cohort_dir.mkdir(exist_ok=True)
        _write_json(cohort_dir / "waterfall.json", _waterfall(params))
        _write_json(cohort_dir / "waterfall_detailed.json", _waterfall_detailed(params))
        _write_json(cohort_dir / "table1.json", _table1(params))
        _write_json(cohort_dir / "table1_detailed.json", _table1_detailed(params))
        _write_json(cohort_dir / "table1_outcomes.json", _table1_outcomes(params))
        _write_json(
            cohort_dir / "table1_outcomes_detailed.json",
            _table1_outcomes_detailed(params),
        )

    return study_dir


def generate_excel() -> Path:
    study_dir = build_dummy_study()
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    concatenator = OutputConcatenator(
        study_execution_path=str(study_dir),
        study_name="test_study",
        cohort_names=COHORT_NAMES,
        description=(
            "# Test Study Report\n"
            "## Purpose\n"
            "Dummy data for design and layout testing of the OutputConcatenator.\n\n"
            "- 5 synthetic cohorts\n"
            "- Million-scale counts\n"
            "- Waterfall, WaterfallDetailed, Table1, Table1Detailed sheets\n"
        ),
    )
    concatenator.output_file = ARTIFACTS_DIR / "test_study_excel.xlsx"
    concatenator.concatenate_all_reports()
    return concatenator.output_file


if __name__ == "__main__":
    out = generate_excel()
    print(f"Created: {out}")
