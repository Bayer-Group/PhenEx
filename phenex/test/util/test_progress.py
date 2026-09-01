import io
import os
import logging
import sys
import threading
from pathlib import Path
from typing import Any

import pytest
from rich.console import Console

from phenex.util import progress
from phenex.util.progress import (
    DisplayBase,
    RichDisplay,
    console_owner,
    resolve_display,
    stage_node_total,
    study_console,
    active_display,
    _NULL,
)


class RecordingDisplay(DisplayBase):
    """A fake display that writes every call into a list, so a test can
    check what a real run would have shown."""

    def __init__(self) -> None:
        self.events: list[tuple] = []
        self.collapsing: list[tuple[str, bool]] = []

    def _session_started(
        self, cohort_name: str, kind: str = "Cohort", collapse: bool = False
    ) -> None:
        self.events.append(("session_started", cohort_name, kind))
        self.collapsing.append((kind, collapse))

    def _session_finished(self) -> None:
        self.events.append(("session_finished",))

    def stage_started(self, label: str, total: int | None) -> None:
        self.events.append(("stage_started", label, total))

    def stage_completed(self) -> None:
        self.events.append(("stage_completed",))

    def task_started(self, label: str, total: int) -> None:
        self.events.append(("task_started", label, total))

    def task_item_started(self, name: str) -> None:
        self.events.append(("task_item_started", name))

    def task_advance(self) -> None:
        self.events.append(("task_advance",))

    def task_completed(self) -> None:
        self.events.append(("task_completed",))

    def node_started(self, node_name: str) -> None:
        self.events.append(("node_started", node_name))

    def node_finished(
        self, node_name: str, cached: bool, duration: float | None = None
    ) -> None:
        self.events.append(("node_finished", node_name, cached))

    def log_line(self, level: str, msg: str) -> None:
        self.events.append(("log_line", level, msg))

    def set_idle(self, text: str) -> None:
        self.events.append(("set_idle", text))


def _frame_text(display: RichDisplay) -> str:
    """Render one frame of the live block as plain text."""
    console = Console(width=100, file=io.StringIO())
    console.print(display._render())
    return console.file.getvalue()


def _warn_from_a_worker(
    display: RichDisplay, level: str = "WARNING", msg: str = "trouble in a worker"
) -> None:
    """Send one log line from a thread named like a real phenex worker."""
    thread = threading.Thread(
        target=lambda: display.log_line(level, msg),
        name="PhenexWorker-0",
    )
    thread.start()
    thread.join()


@pytest.fixture(scope="module")
def mock_db() -> "Database":
    """A mocked database with 200 patients, shared across the module."""
    from phenex.sim import DatabaseMocker

    return DatabaseMocker(n_patients=200).get_database()


def test_a_warning_is_muted_to_a_count_from_any_thread(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A warning never interrupts a run, from any thread: it becomes a count
    plus the newest few lines, printed in full only at the close."""
    for is_jupyter in (True, False):
        display = RichDisplay()
        printed = []
        monkeypatch.setattr(display.console, "is_jupyter", is_jupyter)
        monkeypatch.setattr(
            display.console,
            "print",
            lambda markup, **kw: printed.append(str(markup)),
        )

        _warn_from_a_worker(display)
        display.log_line("WARNING", "from the main thread")

        assert printed == [], "nothing prints mid-session (jupyter=%s)" % is_jupyter
        assert display._ink == [], "warnings are not ink; they cluster at close"
        frame = _frame_text(display)
        assert "from the main thread" in frame, f"the newest warning shows: {frame}"
        assert "trouble in a worker" in frame, "and so does the one before it"
        assert "2 warnings so far" in frame
        assert "newest" not in frame, "nothing held back yet, so no marker"

        # warnings sit at the top of the block; the bar keeps the bottom
        display.stage_started("Entry stage", 3)
        frame = _frame_text(display)
        assert frame.index("warnings so far") < frame.index(
            "Entry stage"
        ), f"warnings above, progress bottom-most: {frame}"

        # past the preview cap the oldest lines drop out of view, and the
        # count line says so
        for i in range(2):
            display.log_line("WARNING", f"another warning {i}")
        frame = _frame_text(display)
        assert "4 warnings so far" in frame
        assert (
            f"newest {progress._MAX_WARNING_LINES} above" in frame
        ), f"the preview says it is a preview: {frame}"
        assert "trouble in a worker" not in frame, "the oldest drops out of view"
        assert "another warning 1" in frame, "the newest is always shown"


def test_an_error_pins_to_the_zone_immediately(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An error prints in full the moment it happens and stays pinned at the
    top of the block; the close only adds a ×N note for repeats."""
    display = RichDisplay()
    printed = []
    monkeypatch.setattr(
        display.console, "print", lambda markup, **kw: printed.append(str(markup))
    )
    with display.cohort_session("errors_pin_test"):
        display.stage_started("Entry stage", 2)
        display.log_line("WARNING", "arrived first")  # before any error
        _warn_from_a_worker(display, level="ERROR", msg="node blew up in a worker")
        _warn_from_a_worker(display, level="ERROR", msg="node blew up in a worker")

        flat = _frame_text(display).replace("\n", "")
        assert "node blew up in a worker" in flat, "pinned the moment it happened"
        assert "ERROR" in flat
        assert flat.index("blew up") < flat.index(
            "Entry stage"
        ), f"errors sit above the bar: {flat}"

        display.log_line("WARNING", "later, grouped")
        flat = _frame_text(display).replace("\n", "")
        assert "blew up" in flat, "the error line stays pinned"
        assert flat.index("blew up") < flat.index(
            "later, grouped"
        ), "errors above the warning lines"
        assert (
            sum("blew up" in p for p in printed) == 1
        ), "printed in full the moment it happened, repeats not re-printed"

        # every error stays pinned, in every environment: errors outrank the bars
        for i in range(4):
            display.log_line("ERROR", f"later failure {i}")
        flat = _frame_text(display).replace("\n", "")
        assert "blew up" in flat, "the oldest error stays pinned too"
        assert all(
            f"later failure {i}" in flat for i in range(4)
        ), f"every error pinned: {flat}"
        assert "more error" not in flat, f"nothing held back: {flat}"
        display.stage_completed()

    # the error printed when it happened; the close adds the ×N note,
    # then the warnings
    i_stage = next(i for i, p in enumerate(printed) if "Entry stage" in p)
    i_close = next(i for i, p in enumerate(printed) if "completed in" in p)
    i_err = next(i for i, p in enumerate(printed) if "blew up" in p)
    i_note = next(i for i, p in enumerate(printed) if "×2" in p)
    i_first = next(i for i, p in enumerate(printed) if "arrived first" in p)
    i_warn = next(i for i, p in enumerate(printed) if "later, grouped" in p)
    assert i_err < i_stage < i_close, f"error printed the moment it happened: {printed}"
    assert (
        i_close < i_note < i_first < i_warn
    ), f"repeat note before warnings: {printed}"
    assert sum("blew up" in p for p in printed) == 2, "arrival print + repeat note"
    assert "shown in full above" in printed[i_note], "the note points at the print"


def test_a_terminal_prints_each_line_as_it_happens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A terminal prints each line right away; only notebooks hold lines
    back for the block."""
    monkeypatch.setattr(
        progress, "Console", lambda: Console(force_terminal=True, width=90)
    )
    display = RichDisplay()
    printed = []
    monkeypatch.setattr(
        display.console, "print", lambda markup, **kw: printed.append(str(markup))
    )

    display._print("[green]✓[/] Entry stage")

    assert printed == ["[green]✓[/] Entry stage"], "printed straight away"
    assert display._ink == [], "and nothing is held back for later"


def test_warnings_print_once_as_a_cluster_after_the_closing_line(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Warnings print once, together, after the closing line; repeats fold
    into a ×N count."""
    display = RichDisplay()
    printed = []
    monkeypatch.setattr(
        display.console, "print", lambda markup, **kw: printed.append(str(markup))
    )

    with display.cohort_session("dedupe_test"):
        display.stage_started("Entry stage", 1)
        display.node_finished("N1", cached=False, duration=1.0)
        for _ in range(3):
            display.log_line("WARNING", "domain 'DEATH' not found")
        display.log_line("WARNING", "something else")
        display.stage_completed()

    i_stage = next(i for i, p in enumerate(printed) if "Entry stage" in p)
    i_close = next(i for i, p in enumerate(printed) if "completed in" in p)
    i_death = next(i for i, p in enumerate(printed) if "DEATH" in p)
    i_other = next(i for i, p in enumerate(printed) if "something else" in p)
    assert (
        i_stage < i_close < min(i_death, i_other)
    ), f"✓ lines together, warnings after the close: {printed}"
    death_lines = [p for p in printed if "DEATH" in p]
    assert len(death_lines) == 1, f"repeats must not reprint: {printed}"
    assert "×3" in death_lines[0], f"repeats fold into a count: {death_lines}"
    assert not any("repeated warnings" in p for p in printed), "subsumed by ×N"


def test_a_study_lists_its_warnings_once_after_the_final_line(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """In a study, every warning waits until the study's last line, then the
    whole list prints once, repeats folded into ×N."""
    printed = []

    with study_console("debug") as pxconsole:
        monkeypatch.setattr(
            pxconsole.console, "print", lambda m, **kw: printed.append(str(m))
        )
        for name in ("COHORT_1", "COHORT_2"):
            display = RichDisplay()
            monkeypatch.setattr(
                display.console, "print", lambda m, **kw: printed.append(str(m))
            )
            with display.cohort_session(name):
                display.stage_started("Entry stage", 1)
                display.log_line("WARNING", "domain 'DEATH' not found")
                display.stage_completed()
            assert not any(
                "DEATH" in p for p in printed
            ), f"nothing at the cohort's close: {printed}"
            assert any(name in p for p in printed), "the cohort still closes"
        # a warning between cohorts is held the same way, so it cannot
        # split the record either
        pxconsole.log_line("WARNING", "between the cohorts")
        assert not any("between the cohorts" in p for p in printed)
        pxconsole.note("Study 'S' done · full text log: analysis.log")

    i_banner = next(i for i, p in enumerate(printed) if "full text log" in p)
    i_warn = next(i for i, p in enumerate(printed) if "DEATH" in p)
    assert i_banner < i_warn, f"the list follows the study's last line: {printed}"
    assert sum("DEATH" in p for p in printed) == 1, "listed exactly once"
    assert "×2" in printed[i_warn], "one line per cohort folds into a count"
    assert any("between the cohorts" in p for p in printed), "held one too"
    assert any("3 warnings during this run" in p for p in printed)


def test_an_unraisable_exception_pins_to_the_zone_as_an_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Errors Python would normally swallow ('Exception ignored in ...') are
    caught and treated like any other error: printed and pinned in full."""
    import weakref

    display = RichDisplay()
    printed = []
    monkeypatch.setattr(
        display.console, "print", lambda markup, **kw: printed.append(str(markup))
    )

    hook_before = sys.unraisablehook
    with display.cohort_session("unraisable_test"):
        assert sys.unraisablehook is not hook_before, "the session owns the hook"

        class Victim:
            pass

        def exploding_finalizer() -> None:
            raise KeyError("boom from a finalizer")

        victim = Victim()
        weakref.finalize(victim, exploding_finalizer)
        del victim  # this runs the finalizer, whose raise Python would swallow

        flat = _frame_text(display).replace("\n", "")
        assert "boom from a finalizer" in flat, f"pinned immediately: {flat}"
        assert "ERROR" in flat and "Exception ignored" in flat
        # the pin is the whole report: errors are never shortened
        assert "Traceback" in flat, f"the pin carries the traceback: {flat}"
        reports = [p for p in printed if "boom from a finalizer" in p]
        assert len(reports) == 1, f"printed in full the moment it happened: {printed}"
        assert "Traceback" in reports[0], "the arrival print carries the traceback"

    assert sys.unraisablehook is hook_before, "the previous hook is restored"
    reports = [p for p in printed if "boom from a finalizer" in p]
    assert len(reports) == 1, f"printed exactly once, no close repeat: {printed}"


def test_an_error_carries_its_traceback() -> None:
    """An error logged with its traceback reaches the display whole: the
    message and the full traceback together."""
    from phenex.util import create_logger

    log = create_logger("phenex.traceback_probe")
    routed = []

    with study_console("debug"):
        owner = console_owner()
        owner.log_line = lambda level, msg: routed.append((level, msg))
        try:
            raise KeyError("the cache entry is gone")
        except KeyError:
            log.error("node blew up", exc_info=True)

    assert len(routed) == 1
    level, msg = routed[0]
    assert level == "ERROR"
    assert "node blew up" in msg
    assert "Traceback (most recent call last):" in msg
    assert "KeyError: 'the cache entry is gone'" in msg


def test_the_notebook_block_is_one_output_updated_in_place(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A notebook gets one output per run, redrawn in place; errors show in
    full at the top and stay there; no frame is ever empty."""
    published = []

    def payload(obj: Any) -> str:  # frames are IPython HTML; rich prints its own type
        return getattr(obj, "data", None) or getattr(obj, "html", "")

    class FakeHandle:
        def update(self, obj: Any) -> None:
            published.append(("update", payload(obj)))

    def fake_display(obj: Any, display_id: bool = False, **kw: Any) -> Any:
        # only the block asks for a display_id; rich's own prints do not
        published.append(("display" if display_id else "print", payload(obj)))
        return FakeHandle() if display_id else None

    import IPython.display as ipd

    monkeypatch.setattr(ipd, "display", fake_display)

    display = RichDisplay()
    display.console.is_jupyter = True
    boom = "node blew up\nTraceback (most recent call last):\n  KeyError: 'boom'"
    with display.cohort_session("NOTEBOOK"):
        display.stage_started("Index stage", 2)
        display.live.refresh()
        display.node_started("NOTEBOOK__A")
        display.live.refresh()
        display.stage_completed()  # leaves its ✓ line in the block
        _warn_from_a_worker(display, level="ERROR", msg=boom)
        display.stage_started("Report stage", 1)
        display.live.refresh()

        # the error is whole, at the top, never wedged between the stages
        frame = published[-1][1]
        assert frame.count("blew up") == 1, f"shown once: {frame!r}"
        assert "KeyError: 'boom'" in frame, "in full, traceback included"
        assert (
            frame.index("blew up")
            < frame.index("NOTEBOOK")
            < frame.index("Index stage")
            < frame.index("Report stage")
        ), f"at the top of the block: {frame!r}"

        # every error pins whole: more errors never push one out
        for i in range(4):
            display.log_line("ERROR", f"later failure {i}")
        display.live.refresh()
        frame = published[-1][1]
        assert "blew up" in frame, "the oldest error stays pinned too"
        assert all(
            f"later failure {i}" in frame for i in range(4)
        ), f"every error pinned: {frame!r}"
        assert "more error" not in frame, f"nothing held back: {frame!r}"

    block = [(k, v) for k, v in published if k in ("display", "update")]
    kinds = [k for k, _ in block]
    assert kinds.count("display") == 1, f"one output per session: {kinds}"
    assert kinds[0] == "display" and "NOTEBOOK" in block[0][1]
    assert all(k == "update" for k in kinds[1:]), "later frames replace it"
    last = block[-1][1]
    assert "completed in" in last, f"the last frame is the record: {last!r}"
    # the record leads with every error in full, then the header, the ✓
    # lines and the closing line
    assert last.count("blew up") == 1 and "KeyError: 'boom'" in last, last
    assert all(f"later failure {i}" in last for i in range(4))
    assert (
        last.index("blew up")
        < last.index("NOTEBOOK")
        < last.index("Index stage")
        < last.index("completed in")
    ), f"errors at the top of the record: {last!r}"
    assert all(v.strip() for _, v in block), "no frame is ever empty"


def test_a_closing_block_never_leaves_an_empty_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The block's spot on the page is never left empty: blank repaints are
    skipped, and a close with nothing to say takes no space."""
    published = []

    def payload(obj: Any) -> str:
        return getattr(obj, "data", None) or getattr(obj, "html", "")

    class FakeHandle:
        def update(self, obj: Any) -> None:
            published.append(payload(obj))

    def fake_display(obj: Any, display_id: bool = False, **kw: Any) -> Any:
        return FakeHandle() if display_id else None

    import IPython.display as ipd

    monkeypatch.setattr(ipd, "display", fake_display)

    display = RichDisplay()
    display.console.is_jupyter = True
    display.set_idle("something to show")
    display.live.start(refresh=True)

    # a frame with nothing to show is never published; the previous
    # paint stays on screen
    before = len(published)
    with display._lock:
        display._idle_text = None
        display._bar = None
    display.live.refresh()
    assert len(published) == before, "an empty repaint must be skipped"

    display.live.stop()  # a close with no record: the guard, not a normal path

    assert len(published) == before + 1, published
    assert published[-1].strip(), "the closing update must never be empty"
    assert "display:none" in published[-1], f"and it takes no height: {published[-1]!r}"


def test_a_notebook_session_leaves_the_streams_alone(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
) -> None:
    """In a notebook the display leaves normal printing alone: a stray print
    goes where it always went."""
    published = []

    def fake_display(obj: Any, display_id: bool = False, **kw: Any) -> Any:
        published.append("display" if display_id else "print")
        return type("Handle", (), {"update": lambda self, obj: None})()

    import IPython.display as ipd

    monkeypatch.setattr(ipd, "display", fake_display)
    monkeypatch.setattr(
        progress, "Console", lambda: Console(force_jupyter=True, width=100)
    )

    display = RichDisplay()
    stdout_before, stderr_before = sys.stdout, sys.stderr
    with display.cohort_session("STRAY"):
        display.stage_started("Sampler stage", 2)
        assert sys.stdout is stdout_before and sys.stderr is stderr_before
        print()  # a blank line, the kind that painted as a band
        print("hello from a library")
        sys.stderr.write("\n")

    assert published == ["display"], f"only the block's own output: {published}"
    assert "hello from a library" in capsys.readouterr().out, "printed as always"


def test_phenex_duckdb_connections_switch_duckdb_own_progress_bar_off() -> None:
    """DuckDB draws a progress bar of its own inside notebooks; phenex turns
    it off when it connects."""
    import pathlib
    import subprocess

    import phenex

    code = """
import IPython
class FakeShell:  # makes DuckDB think it runs inside a notebook
    config = {"IPKernelApp": {}}
IPython.get_ipython = lambda: FakeShell()
try:
    import ipywidgets
    widgets = True
except ImportError:
    widgets = False  # then DuckDB has no bar to draw at all
import ibis
from phenex.ibis_connect import DuckDBConnector
setting = "SELECT current_setting('enable_progress_bar')"
plain = ibis.duckdb.connect(":memory:").raw_sql(setting).fetchone()[0]
con = DuckDBConnector(DUCKDB_DEST_DATABASE=":memory:").connect_dest()
print(widgets, plain, con.raw_sql(setting).fetchone()[0])
"""
    # a fresh interpreter: DuckDB checks its environment only once
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=True,
        cwd=str(pathlib.Path(phenex.__file__).resolve().parents[1]),
    )
    widgets, plain, ours = result.stdout.split()
    if widgets == "True":
        assert (
            plain == "True"
        ), f"DuckDB would draw its bar on a plain connection: {result.stdout}"
    assert ours == "False", f"phenex's connection must have it off: {result.stdout}"


def test_the_block_appears_the_moment_a_session_starts_and_is_never_empty() -> None:
    """The block appears the moment a run starts, and its first frame always
    has something in it."""

    class RecordingLive:
        def __init__(self, display: RichDisplay) -> None:
            self.calls: list[tuple] = []
            self.display = display
            self.first_frame: str | None = None

        def start(self, refresh: bool = False) -> None:
            self.calls.append(("start", refresh))
            if refresh:  # what a synchronous first publish would render
                self.first_frame = _frame_text(self.display)

        def stop(self, final: Any = None) -> None:
            self.calls.append(("stop",))

    display = RichDisplay()
    display.live = RecordingLive(display)
    with display.cohort_session("INSTANT"):
        pass
    assert display.live.calls[0] == ("start", True), display.live.calls
    assert display.live.calls[-1] == ("stop",)
    frame = display.live.first_frame
    assert frame.strip(), "the first frame must never be empty"
    assert "Getting ready" in frame, f"it carries the idle line: {frame!r}"

    # a notebook puts the header inside the block, so the frame has it
    display = RichDisplay()
    display.console.is_jupyter = True
    display.live = RecordingLive(display)
    with display.cohort_session("INSTANT"):
        pass
    frame = display.live.first_frame
    assert "INSTANT" in frame and "Getting ready" in frame, frame

    # a collapsing block has no header; the idle line fills the frame
    display = RichDisplay()
    display.live = RecordingLive(display)
    with display.cohort_session("SAVING", kind="Saving reports", collapse=True):
        pass
    assert display.live.first_frame.strip(), "collapsing sessions too"
