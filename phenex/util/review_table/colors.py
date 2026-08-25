"""Section colours and hierarchical background shading for the review table.

Mirrors the colour logic of the app's CohortCardViewer: each phenotype row is
tinted by its section (``effective_type``) colour, with the tint getting lighter
the deeper a component sits in the hierarchy. "Not applicable" parameter cells
are filled with a slightly stronger tint of the same colour.
"""

from typing import Optional, Tuple

RGB = Tuple[int, int, int]

# Section colours, copied from app/ui/src/styles/variables.css (--color_<type>).
TYPE_COLORS: dict[str, RGB] = {
    "entry": (0x1B, 0x38, 0x4D),
    "inclusion": (0x1A, 0x42, 0x25),
    "exclusion": (0x4C, 0x00, 0x11),
    "baseline": (0x27, 0x60, 0x7C),
    "outcome": (0x41, 0x33, 0x46),
    "component": (0x80, 0x80, 0x80),
}

# Extra alpha layer applied on top of the row tint for "not applicable" cells,
# matching the NARenderer's fixed '1.1.1' depth alpha (0x10).
_NA_EXTRA_ALPHA = 0x10 / 255


def _alpha_for_index(hierarchical_index: Optional[str]) -> float:
    """Background alpha for a phenotype based on its hierarchical depth."""
    if not hierarchical_index:
        return 0x33 / 255
    depth = len(str(hierarchical_index).split("."))
    return {1: 0x25, 2: 0x15, 3: 0x10}.get(depth, 0x08) / 255


def _blend_over_white(rgb: RGB, alpha: float) -> RGB:
    """Composite a colour at the given alpha over a white background."""
    return tuple(round(c * alpha + 255 * (1 - alpha)) for c in rgb)  # type: ignore[return-value]


def _to_hex(rgb: RGB) -> str:
    return "{:02X}{:02X}{:02X}".format(*rgb)


def row_fill(effective_type: Optional[str], hierarchical_index: Optional[str]) -> Optional[str]:
    """ARGB-less hex fill for a normal row cell, or None when uncoloured."""
    rgb = TYPE_COLORS.get(effective_type or "")
    if not rgb:
        return None
    return _to_hex(_blend_over_white(rgb, _alpha_for_index(hierarchical_index)))


def na_fill(effective_type: Optional[str], hierarchical_index: Optional[str]) -> Optional[str]:
    """Hex fill for a "not applicable" parameter cell (stronger than the row tint)."""
    rgb = TYPE_COLORS.get(effective_type or "")
    if not rgb:
        return None
    base = _alpha_for_index(hierarchical_index)
    alpha = base + _NA_EXTRA_ALPHA - base * _NA_EXTRA_ALPHA
    return _to_hex(_blend_over_white(rgb, alpha))


def type_text_color(effective_type: Optional[str]) -> Optional[str]:
    """Full-strength section colour used for section titles and index text."""
    rgb = TYPE_COLORS.get(effective_type or "")
    return _to_hex(rgb) if rgb else None
