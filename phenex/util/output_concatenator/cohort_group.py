from dataclasses import dataclass, field
from pathlib import Path
from typing import List


@dataclass
class CohortGroup:
    """A main cohort and its associated subcohorts."""

    name: str
    main_dir: Path
    subcohort_dirs: List[Path] = field(default_factory=list)

    @property
    def all_dirs(self) -> List[Path]:
        return [self.main_dir] + self.subcohort_dirs

    def display_name(self, cohort_dir: Path) -> str:
        if cohort_dir == self.main_dir:
            return self.name
        return cohort_dir.name.replace(f"{self.name}__", "")
