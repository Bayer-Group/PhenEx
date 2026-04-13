import re
from collections import defaultdict

_TPA_PHENOTYPE_RE = re.compile(r"^(.+?)(\d+)_(STACK\d+.*|ALL)$", re.IGNORECASE)


def _parse_tpa_phenotype_name(name: str):
    """Return (tpa_name, period_num, stack_info) for a TPA phenotype name, or None."""
    m = _TPA_PHENOTYPE_RE.match(name)
    if m:
        return m.group(1), int(m.group(2)), m.group(3)
    return None


class _TreatmentPatternAnalysisMixin:
    """
    Mixin that identifies and groups TreatmentPatternAnalysis phenotypes within a
    flat list of cohort phenotypes.

    Phenotypes are recognized first by the ``_tpa_name`` attribute set automatically
    by TreatmentPatternAnalysis, and fall back to regex matching the naming pattern
    ``{tpa_name}{period_num}_(STACK\\d+.*|ALL)`` for phenotypes created without the
    factory.
    """

    def _group_tpa_phenotypes(self, phenotypes):
        """
        Group TPA phenotypes by TPA name and time period.

        Returns
        -------
        dict
            ``{tpa_name: [(period_num, period_label, [phenotypes]), ...]}``
            with periods sorted ascending by *period_num*.
        """
        # {tpa_name: {period_num: {"label": str, "pts": list}}}
        raw = defaultdict(dict)

        for pt in phenotypes:
            tpa_name = getattr(pt, "_tpa_name", None)
            period_num = getattr(pt, "_tpa_period_num", None)
            period_label = getattr(pt, "_tpa_period_label", None)

            if tpa_name is None:
                parsed = _parse_tpa_phenotype_name(pt.name)
                if parsed is None:
                    continue
                tpa_name, period_num, _ = parsed
                period_label = f"period {period_num}"

            if period_num not in raw[tpa_name]:
                raw[tpa_name][period_num] = {"label": period_label, "pts": []}
            raw[tpa_name][period_num]["pts"].append(pt)

        return {
            tpa_name: [
                (pnum, info["label"], info["pts"])
                for pnum, info in sorted(period_dict.items())
            ]
            for tpa_name, period_dict in raw.items()
        }
