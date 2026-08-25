"""Excel review table for a study: one cohort per worksheet tab."""

from typing import Any, Dict, List, Optional, Union

from openpyxl import Workbook

from .cohort_review_table import CohortReviewTable


class StudyReviewTable:
    """Builds a multi-cohort review workbook, one CohortReviewTable per tab.

    Accepts either a list of cohort dicts (the app's cohort JSON) or a study
    dict containing a ``cohorts`` list.
    """

    def __init__(
        self,
        cohorts: Union[List[Dict[str, Any]], Dict[str, Any]],
        name: Optional[str] = None,
    ):
        if isinstance(cohorts, dict):
            self.name = name or cohorts.get("name") or "Study"
            cohort_list = cohorts.get("cohorts", []) or []
        else:
            self.name = name or "Study"
            cohort_list = list(cohorts)
        self._tables = [CohortReviewTable(cohort) for cohort in cohort_list]

    def to_excel(self, path: str) -> None:
        """Write every cohort to a separate tab in a new .xlsx file at ``path``."""
        workbook = Workbook()
        if not self._tables:
            workbook.save(path)
            return
        self._tables[0].write_sheet(workbook, replace_active=True)
        for table in self._tables[1:]:
            table.write_sheet(workbook)
        workbook.save(path)
