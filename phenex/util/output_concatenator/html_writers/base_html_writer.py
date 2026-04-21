import base64
from abc import ABC, abstractmethod
from html import escape
from pathlib import Path
from typing import List, Optional

from phenex.util import create_logger

logger = create_logger(__name__)


class _BaseHtmlWriter(ABC):
    """Base class for writers that produce standalone HTML report files."""

    @abstractmethod
    def write(
        self,
        report_type: str,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        output_file: Path,
        version: str = "unknown",
    ) -> None:
        """Generate an HTML file from per-cohort JSON report files."""

    @staticmethod
    def _read_phenex_version(study_path: Path) -> str:
        info_file = study_path / "info.txt"
        if info_file.exists():
            for line in info_file.read_text().splitlines():
                if line.startswith("PhenEx Version:"):
                    return line.split(":", 1)[1].strip()
        return "unknown"

    @staticmethod
    def _get_icon_data_uri() -> str:
        icon_path = (
            Path(__file__).resolve().parent.parent.parent.parent
            / "docs"
            / "assets"
            / "bird_icon.png"
        )
        if icon_path.exists():
            icon_b64 = base64.b64encode(icon_path.read_bytes()).decode("ascii")
            return f"data:image/png;base64,{icon_b64}"
        return ""

    @staticmethod
    def _build_footer_html(version: str, icon_data_uri: str = "") -> str:
        version_escaped = escape(version)
        if icon_data_uri:
            return (
                f'<div class="phenex-footer">'
                f'<img src="{icon_data_uri}" alt="PhenEx">'
                f"<span>Generated with PhenEx v{version_escaped}</span></div>"
            )
        return (
            f'<div class="phenex-footer">'
            f"<span>Generated with PhenEx v{version_escaped}</span></div>"
        )
