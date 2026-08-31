import re
import sys
import threading
import time
import traceback
from contextlib import contextmanager
from typing import Generator, List, Optional, TYPE_CHECKING

from rich.console import Console, Group, RenderableType
from rich.live import Live
from rich.markup import escape
from rich.text import Text

if TYPE_CHECKING:
    from phenex.node import NodeGroup

# At most this many running ● lines under the bar; the rest fold into one
# counted line, so the block fits in the window.
_MAX_ACTIVITY_LINES = 20

# How many recent warnings show live; the count line says when more wait
_MAX_WARNING_LINES = 3

# Console ownership

# Who is drawing on the screen right now, or None: one owner at a time
_owner = None


def active_display() -> "DisplayBase":
    """The current owner, or the do-nothing display when no one holds the screen."""
    return _owner if _owner is not None else _NULL


def console_owner() -> Optional["DisplayBase"]:
    """The current owner, or None when log lines should print the normal way."""
    return _owner


# Entry points


def resolve_display(verbosity: Optional[str] = None) -> "DisplayBase":
    """None means no display; "debug" gives the live progress display."""
    _validate_verbosity(verbosity)
    return _NULL if verbosity is None else RichDisplay()


@contextmanager
def study_console(
    verbosity: Optional[str] = None,
) -> Generator["DisplayBase", None, None]:
    """Hold the screen for one study run: routine messages go quiet,
    warnings are listed at the end."""
    # Holding the screen is what quiets the logging (see logging.py)
    global _owner
    _validate_verbosity(verbosity)
    if verbosity is None or _owner is not None:
        # No display asked for, or a run inside a run
        yield _owner if _owner is not None else _NULL
        return
    previous, _owner = _owner, _StudyConsole()
    console = _owner
    _console_taken()
    try:
        yield _owner
    finally:
        # after the study's last line: every warning the whole run collected
        console.reveal_held()
        _owner = previous
        _console_released()


def stage_node_total(stage_group: Optional["NodeGroup"]) -> Optional[int]:
    """How many pieces of work a stage bar counts: the group's steps plus one."""
    if stage_group is None:
        return None
    return len(stage_group.dependencies) + 1


# Loggers quieted while the display holds the screen; restored on release
_gated_loggers: List = []

# Python's own handler for errors raised during cleanup; put back on release
_prev_unraisable_hook = None


def _log_unraisable(args) -> None:
    """Turn an error raised during Python cleanup into a normal ERROR log line."""
    try:
        import logging

        err = getattr(args, "err_msg", None) or "Exception ignored in"
        obj = f" {args.object!r}" if args.object is not None else ""
        exc = "".join(
            traceback.format_exception(
                args.exc_type, args.exc_value, args.exc_traceback
            )
        ).strip()
        logging.getLogger("phenex").error(f"{err}:{obj}:\n{exc}")
    except Exception:
        pass  # never raise while Python is cleaning up


def _console_taken() -> None:
    """Take the screen: warnings are collected and other console logging
    pauses, so nothing writes over the block."""
    import logging

    from phenex.util.logging import _client_loggers, _console_handler

    logging.captureWarnings(True)
    warnings_logger = logging.getLogger("py.warnings")
    if (
        _console_handler is not None
        and _console_handler not in warnings_logger.handlers
    ):
        warnings_logger.addHandler(_console_handler)
    warnings_logger.propagate = False

    # analysis.log keeps recording: its file writer is attached to phenex itself
    for logger in [logging.getLogger("phenex")] + list(_client_loggers):
        if logger.propagate:
            logger.propagate = False
            _gated_loggers.append(logger)

    global _prev_unraisable_hook
    _prev_unraisable_hook = sys.unraisablehook
    sys.unraisablehook = _log_unraisable


def _console_released() -> None:
    """The last owner is done: put everything back exactly as it was."""
    import logging

    from phenex.util.logging import _console_handler

    logging.captureWarnings(False)
    warnings_logger = logging.getLogger("py.warnings")
    if _console_handler is not None:
        warnings_logger.removeHandler(_console_handler)
    warnings_logger.propagate = True

    while _gated_loggers:
        _gated_loggers.pop().propagate = True

    global _prev_unraisable_hook
    if _prev_unraisable_hook is not None:
        sys.unraisablehook = _prev_unraisable_hook
        _prev_unraisable_hook = None


def _validate_verbosity(verbosity: Optional[str]) -> None:
    """Accept None (no display) or "debug" (show it)."""
    if verbosity is not None and verbosity != "debug":
        raise ValueError(
            f'verbosity must be None (no display) or "debug", got {verbosity!r}'
        )


# Helpers


def _log_markup(level: str, msg: str) -> str:
    """The one place a WARNING or ERROR line gets its color."""
    style = "yellow" if level == "WARNING" else "red"
    return f"[{style}]{level}[/] {msg}"


def _headline(msg: str) -> str:
    """A multi-line message as one line: its first and last lines."""
    parts = [line for line in msg.splitlines() if line.strip()]
    if len(parts) > 1:
        return f"{parts[0]} ... {parts[-1]}"
    return msg


def _fmt_duration(seconds: float) -> str:
    """Format a duration: '12.3s' or '2m 05s'."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    return f"{int(seconds // 60)}m {int(seconds % 60):02d}s"


class _JupyterHandleLive(Live):
    """Draws the moving block in a notebook by repainting one output in
    place. Terminals use rich's normal drawing."""

    def __init__(self, *args, **kwargs) -> None:
        """Remembers the notebook output the block draws into."""
        super().__init__(*args, **kwargs)
        self._handle = None

    def _to_html(self, renderable: RenderableType) -> str:
        """One frame as HTML. Not `export_html`: its full-page format
        paints a black background."""
        from rich.jupyter import _render_segments

        segments = list(self.console.render(renderable, self.console.options))
        if not self.console._render_buffer(segments).strip():
            return ""  # nothing visible; the caller decides what that means
        return _render_segments(segments)

    def refresh(self) -> None:
        """Paint the block: the first paint claims a spot on the page,
        every later one redraws it."""
        if not self.console.is_jupyter:
            return super().refresh()
        with self._lock:
            self._live_render.set_renderable(self.renderable)
            try:
                from IPython.display import HTML, display
            except ImportError:
                return
            html = self._to_html(self.renderable)
            if not html:
                # never publish a frame with nothing visible; the previous
                # paint stays until there is content
                return
            if self._handle is None:
                self._handle = display(HTML(html), display_id=True)
            else:
                self._handle.update(HTML(html))

    def stop(self, final: Optional[RenderableType] = None) -> None:
        """Close the block; its spot on the page shows `final`, the
        finished record, never nothing."""
        if not self.console.is_jupyter:
            return super().stop()
        with self._lock:
            if not self._started:
                return
            self.console.clear_live()
            self._started = False
            if self.auto_refresh and self._refresh_thread is not None:
                self._refresh_thread.stop()
                self._refresh_thread = None
            self._disable_redirect_io()
            self.console.pop_render_hook()
            handle, self._handle = self._handle, None
        if handle is not None:
            self._publish_final(handle, final)

    def _publish_final(self, handle, final: Optional[RenderableType]) -> None:
        """The very last repaint: the record, or an invisible element."""
        try:
            from IPython.display import HTML

            html = self._to_html(final) if final is not None else ""
            # an invisible element, never an empty one
            handle.update(HTML(html or "<div style='display:none'></div>"))
        except Exception:
            pass


# The display API and the Null display


class DisplayBase:
    """Everything a display can be told; each hook here does nothing.
    Doubles as the do-nothing display."""

    # True only on a display that draws; stops two blocks nesting
    draws = False

    # Who held the screen before this session, if anyone (see cohort_session)
    _outer = None

    @contextmanager
    def cohort_session(
        self, cohort_name: str, kind: str = "Cohort", collapse: bool = False
    ) -> Generator["DisplayBase", None, None]:
        """Hold the screen for one piece of work and always hand it back.
        With `collapse` the session leaves one line behind."""
        global _owner
        if self is _NULL or (_owner is not None and _owner.draws):
            # No display asked for, or someone is already drawing
            yield self
            return
        previous, _owner = _owner, self
        self._outer = previous  # the study keeps this session's warnings for the end
        if previous is None:  # first owner (a cohort run outside a study)
            _console_taken()
        started = False
        try:
            self._session_started(cohort_name, kind, collapse)
            started = True
            yield self
        finally:
            # a crash while opening or closing must not keep the screen
            # held: the hand-back runs no matter what happens above
            try:
                if started:
                    self._session_finished()
            finally:
                _owner = previous
                if previous is None:
                    _console_released()

    # Hooks; a real display overrides these
    def _session_started(
        self, cohort_name: str, kind: str = "Cohort", collapse: bool = False
    ) -> None:
        """A unit of work begins."""

    def _session_finished(self) -> None:
        """It ended, successfully or not."""

    def stage_started(self, label: str, total: Optional[int]) -> None:
        """A stage begins, with `total` nodes to run."""

    def stage_completed(self) -> None:
        """The current stage is done."""

    def set_idle(self, text: str) -> None:
        """No bar right now; say what is being prepared."""

    def task_started(self, label: str, total: Optional[int]) -> None:
        """Other work begins, with a known number of items."""

    def task_item_started(self, name: str) -> None:
        """The next task item has a name worth showing."""

    def task_advance(self) -> None:
        """One item of the current task is done."""

    @contextmanager
    def task_item(self, name: str) -> Generator[None, None, None]:
        """Name one task item, run the body, advance the bar on success."""
        self.task_item_started(name)
        yield
        self.task_advance()

    def task_completed(self) -> None:
        """The current task is done."""

    def node_started(self, node_name: str) -> None:
        """A node starts computing. Safe to call from worker threads."""

    def node_finished(
        self, node_name: str, cached: bool, duration: Optional[float] = None
    ) -> None:
        """A node finished, from the cache or not."""

    def log_line(self, level: str, msg: str) -> None:
        """A warning or error arrived while this display holds the screen."""

    def note(self, msg: str, strong: bool = False, style: Optional[str] = None) -> None:
        """One status line; `style` sets its look, strong=True makes it bold."""


# The shared do-nothing display
_NULL = DisplayBase()


# The study console


class _StudyConsole(DisplayBase):
    """Holds the screen for a study run: warnings wait for the end,
    `note` prints a line. Draws nothing."""

    def __init__(self) -> None:
        self.console = Console()
        # each distinct warning and how often it fired, across the whole run
        self.held_logs = {}

    def note(self, msg: str, strong: bool = False, style: Optional[str] = None) -> None:
        """One status line; strong=True makes it bold, `style` wins if given."""
        line_style = style if style is not None else ("bold" if strong else None)
        self.console.print(msg, markup=False, highlight=False, style=line_style)

    def log_line(self, level: str, msg: str) -> None:
        """Errors print at once; warnings join the end-of-run list."""
        if level == "WARNING":
            key = (level, msg)
            self.held_logs[key] = self.held_logs.get(key, 0) + 1
            return
        self.console.print(_log_markup(level, escape(msg)))

    def hold_logs(self, seen) -> None:
        """Take a finished session's warnings, to list when the run ends."""
        for key, count in seen.items():
            self.held_logs[key] = self.held_logs.get(key, 0) + count

    def reveal_held(self) -> None:
        """Print the run's warnings: each once, repeats as ×N."""
        if not self.held_logs:
            return
        total = sum(self.held_logs.values())
        self.console.print(
            f"[bold dark_orange]⚠ {total} warning{'s' if total > 1 else ''} "
            f"during this run[/] · each listed once below, repeats as ×N · "
            f"analysis.log has every occurrence"
        )
        for (level, msg), count in self.held_logs.items():
            self.console.print(
                _log_markup(level, escape(msg))
                + (f" [dim](×{count})[/]" if count > 1 else "")
            )
        self.held_logs = {}


# The renderer


class _Bar:
    """The one bar on screen: label, size, progress. `_render` paints it."""

    def __init__(self, kind: str, label: str, total: Optional[int]) -> None:
        self.kind = kind  # "stage" or "task"
        self.label = label
        self.total = total
        self.t0 = time.monotonic()
        self.done = 0
        self.cached = 0  # stages only: how many finished straight from the cache
        # tasks only: the named item running right now
        self.item_entry: Optional["_Activity"] = None


class _Activity:
    """One `● label  running Ns` line, shown only until it finishes."""

    __slots__ = ("key", "label", "t0")

    def __init__(self, key: Optional[str], label: str) -> None:
        self.key = key  # the node's full name, to find this line when it finishes
        self.label = label
        self.t0 = time.monotonic()


class RichDisplay(DisplayBase):
    """The live display: the bar moves in place while work runs, then
    collapses to one permanent line when it ends."""

    draws = True  # this display draws (see cohort_session)

    def __init__(self) -> None:
        """All display state, grouped by how long it lives."""
        self._lock = threading.RLock()  # Worker threads call the node_* hooks

        # One session (a cohort or subcohort)
        self.cohort_name: Optional[str] = None
        self.kind = "Cohort"  # Or "Subcohort"; names the session on screen
        self.name_prefix = ""  # "MY_COHORT__", stripped from node names
        self.session_t0: Optional[float] = None
        self._node_count = 0  # Nodes finished this session
        self._cached_count = 0  # How many of those were cache hits
        # A collapsing session (report saving, combining) leaves ONE line
        self.collapse = False
        self._session_items = 0  # Items finished this session
        # Lines that stay: a terminal prints them now, a notebook saves them
        self._ink: List[str] = []

        # The one bar on screen (a stage or a task), or None; _render paints it
        self._bar: Optional[_Bar] = None
        # The ● lines under the current bar: running nodes and named items
        self._activity: List[_Activity] = []
        # (level, message) -> times seen, in arrival order
        self._seen_logs = {}
        self._idle_text: Optional[str] = None
        self._idle_since: Optional[float] = None

        self.console = Console()
        self.live = _JupyterHandleLive(
            get_renderable=self._render,
            console=self.console,
            refresh_per_second=4,
            transient=True,
            # A notebook's streams are left alone: rich's stand-ins would
            # publish a stray blank line as an empty output under the block
            redirect_stdout=not self.console.is_jupyter,
            redirect_stderr=not self.console.is_jupyter,
        )

    # Keeping the block at the bottom
    def _print(self, line: str) -> None:
        """Keep one line that stays on screen."""
        # a terminal prints now; a notebook saves it to show inside the block
        if not self.console.is_jupyter:
            self.console.print(line)
            return
        with self._lock:
            self._ink.append(line)

    def _take_ink(self) -> Optional[RenderableType]:
        """Notebooks only: the closing record, every error in full first,
        then the saved lines."""
        if not self.console.is_jupyter:
            return None
        with self._lock:
            errors = [
                _log_markup(level, escape(msg))
                for level, msg in self._seen_logs
                if level == "ERROR"
            ]
            lines, self._ink = errors + self._ink, []
        if not lines:
            return None
        return Group(*(Text.from_markup(l) for l in lines))

    # Session
    def _session_started(
        self, cohort_name: str, kind: str = "Cohort", collapse: bool = False
    ) -> None:
        """Open the session and put the block on screen."""
        self.cohort_name = cohort_name
        self.kind = kind
        self.collapse = collapse
        self.name_prefix = re.sub(r"\W+", "_", cohort_name).upper() + "__"
        self.session_t0 = time.monotonic()
        self._node_count = 0
        self._cached_count = 0
        self._session_items = 0
        self._seen_logs = {}
        self._ink = []
        self._activity = []
        # Content first, then start: the block paints immediately, and
        # painting it empty would leave a blank spot on the page.
        if not collapse:  # a collapsing session's header shows live only (see _render)
            self._print(f"[bold]{kind} '{cohort_name}'[/]")
        self.set_idle("Getting ready: connecting tables, counting persons ...")
        self.live.start(refresh=True)

    def _session_finished(self) -> None:
        """Close the block and leave the record: bar line, ✓ line, then
        the warnings; a notebook's record leads with the errors."""
        # In a study, warnings are held for the end of the run
        held_by = self._outer if isinstance(self._outer, _StudyConsole) else None
        with self._lock:
            last_line = self._close_bar()
            self._idle_text = None
            # every error already shows in full above, so only repeats
            # need a note here
            cluster = [
                _log_markup(level, escape(_headline(msg)))
                + f" [dim](×{count}, shown in full above)[/]"
                for (level, msg), count in self._seen_logs.items()
                if level == "ERROR" and count > 1
            ]
            if held_by is None:
                cluster += [
                    _log_markup(level, escape(msg))
                    + (f" [dim](×{count})[/]" if count > 1 else "")
                    for (level, msg), count in self._seen_logs.items()
                    if level == "WARNING"
                ]
            handover = {
                key: count
                for key, count in self._seen_logs.items()
                if key[0] == "WARNING"
            }
        if held_by is not None and handover:
            held_by.hold_logs(handover)
        if last_line is not None:
            self._print(last_line)
        self._print(self._closing_line())
        for line in cluster:
            self._print(line)
        # The last repaint IS the record: one spot on the page, never
        # emptied or abandoned
        self.live.stop(self._take_ink())

    def _closing_line(self) -> str:
        """The one line a finished session leaves behind."""
        elapsed = _fmt_duration(time.monotonic() - self.session_t0)
        if self.collapse:
            return (
                f"[green]✓[/] [bold]{self.kind} '{self.cohort_name}'[/] "
                f"[dim]{self._session_items} items ·[/] {elapsed}"
            )
        counts = ""
        if self._node_count:
            counts = (
                f" [dim]({self._node_count} node executions, "
                f"{self._cached_count} cached)[/]"
            )
        return (
            f"[green]✓ {self.kind} '{self.cohort_name}' completed in "
            f"{elapsed}[/]" + counts
        )

    # Stage and task bars
    def stage_started(self, label: str, total: Optional[int]) -> None:
        """Close whatever came before, then open a stage bar."""
        self._open_bar("stage", label, total)

    def stage_completed(self) -> None:
        """Collapse the stage to one line, then idle until the next one."""
        # print after unlocking: printing also takes rich's lock, and taking
        # the two locks in opposite orders can freeze the program
        with self._lock:
            line = self._close_bar("stage")
        if line is not None:
            self._print(line)
        self.set_idle("Working: preparing next stage ...")

    def task_started(self, label: str, total: Optional[int]) -> None:
        """Like a stage, but for other work with a known number of items."""
        self._open_bar("task", label, total)

    def task_item_started(self, name: str) -> None:
        """Name the item the task is on: `● name  running Ns` under the bar."""
        with self._lock:
            if self._bar is None or self._bar.kind != "task":
                return
            entry = _Activity(None, name)
            self._activity.append(entry)
            self._bar.item_entry = entry

    def task_advance(self) -> None:
        """One item done: the bar moves, the named ● line disappears."""
        with self._lock:
            if self._bar is None or self._bar.kind != "task":
                return
            self._bar.done += 1
            self._session_items += 1
            entry = self._bar.item_entry
            if entry is not None:
                if entry in self._activity:
                    self._activity.remove(entry)
                self._bar.item_entry = None

    def task_completed(self) -> None:
        """Collapse the task to its one line (unless the session collapses)."""
        with self._lock:
            line = self._close_bar("task")
        if line is not None and not self.collapse:
            self._print(line)

    def _open_bar(self, kind: str, label: str, total: Optional[int]) -> None:
        """Close what came before and set up a fresh bar."""
        with self._lock:
            line = self._close_bar("stage")
            self._idle_text = None
            self._bar = _Bar(kind, label, total)
            self._activity.clear()  # activity belongs to the current bar
        if line is not None:
            self._print(line)

    def _close_bar(self, kind: Optional[str] = None) -> Optional[str]:
        """Drop the bar and return its permanent line, or None. With `kind`,
        only that kind of bar is closed."""
        # returned, not printed: callers still hold the lock
        if self._bar is None or (kind is not None and self._bar.kind != kind):
            return None
        bar, self._bar = self._bar, None
        self._activity.clear()  # a done stage collapses everything under it
        elapsed = time.monotonic() - bar.t0
        if bar.kind == "stage":
            counts = f"{bar.done} nodes · {bar.cached} cached"
        else:
            counts = f"{bar.done} items"
        return (
            f"[green]✓[/] [bold]{bar.label:<18}[/] "
            f"[dim]{counts} ·[/] {_fmt_duration(elapsed)}"
        )

    def set_idle(self, text: str) -> None:
        """Show what is happening while no bar is up, with its own timer."""
        with self._lock:
            self._bar = None  # an idle line replaces whatever bar was up
            self._idle_text = text
            self._idle_since = time.monotonic()

    # Nodes
    def node_started(self, node_name: str) -> None:
        """The node joins the activity lines as `● name  running Ns`."""
        with self._lock:
            self._activity.append(_Activity(node_name, self._short(node_name)))

    def node_finished(
        self, node_name: str, cached: bool, duration: Optional[float] = None
    ) -> None:
        """Advance the stage bar and bump the counters."""
        # Nothing prints here, so worker threads are safe
        with self._lock:
            entry = next(
                (a for a in reversed(self._activity) if a.key == node_name),
                None,
            )
            if entry is not None:
                self._activity.remove(entry)
            if self._bar is not None and self._bar.kind == "stage":
                self._bar.done += 1
                if cached:
                    self._bar.cached += 1
            self._node_count += 1
            if cached:
                self._cached_count += 1

    def log_line(self, level: str, msg: str) -> None:
        """Count a warning; pin an error the moment it happens (a terminal
        also prints it above the block)."""
        with self._lock:
            key = (level, msg)
            seen = self._seen_logs.get(key, 0)
            self._seen_logs[key] = seen + 1
        # print after unlocking (same lock-order freeze as stage_completed);
        # a notebook has no "above the block": there the pin is the whole error
        if level == "ERROR" and seen == 0 and not self.console.is_jupyter:
            self.console.print(_log_markup(level, escape(msg)))

    # Drawing
    def _short(self, node_name: str) -> str:
        """'MY_COHORT__AGE_AT_INDEX' -> 'age_at_index'."""
        if self.name_prefix and node_name.startswith(self.name_prefix):
            node_name = node_name[len(self.name_prefix) :]
        return node_name.lower()

    def _render(self) -> RenderableType:
        """Build one frame: errors and warnings on top, then the saved
        lines, the bar and the running lines."""
        with self._lock:
            now = time.monotonic()
            head: List[RenderableType] = list(self._warning_zone())
            if self.console.is_jupyter:
                head += [Text.from_markup(line) for line in self._ink]
                if self.collapse and self.cohort_name is not None:
                    # its header is never saved as a line, so show it live
                    head.append(
                        Text.from_markup(f"[bold]{self.kind} '{self.cohort_name}'[/]")
                    )
            if self._bar is None:
                if self._idle_text:
                    elapsed = now - self._idle_since
                    head.append(
                        Text.from_markup(
                            f"[cyan]●[/] [dim]{self._idle_text}  "
                            f"{_fmt_duration(elapsed)}[/]"
                        )
                    )
                return Group(*head) if head else Text("")
            head.append(Text.from_markup(self._bar_line(now)))
            entries = self._activity  # oldest first
            for a in entries[:_MAX_ACTIVITY_LINES]:
                head.append(
                    Text.from_markup(
                        f"    [cyan]●[/] {a.label}  "
                        f"[dim]running {now - a.t0:.0f}s[/]"
                    )
                )
            over = entries[_MAX_ACTIVITY_LINES:]
            if over:
                head.append(
                    Text.from_markup(
                        f"    [dim]... and {len(over)} more running right now · "
                        f"the bar counts every one[/]"
                    )
                )
            return Group(*head)

    def _bar_line(self, now: float) -> str:
        """The bar as one styled line: ● label ━━━╺─── done/total elapsed.
        Call with the lock held and `self._bar` set."""
        bar = self._bar
        width = 28
        if bar.total:
            filled = min(width, int(width * bar.done / max(bar.total, 1)))
            count = f"{bar.done}/{bar.total}"
        else:
            filled = 0  # no total known; the count alone moves
            count = f"{bar.done}"
        track = f"[green]{'━' * filled}[/][dim]{'━' * (width - filled)}[/]"
        return (
            f"[cyan]●[/] [bold]{bar.label:<18}[/] {track} {count} "
            f"[dim]{_fmt_duration(now - bar.t0)}[/]"
        )

    def _warning_zone(self) -> List[RenderableType]:
        """The top of the block: every error, then the newest warnings and
        their count. Call with the lock held."""
        lines: List[RenderableType] = []
        # every error pins whole, everywhere: errors are urgent, nothing is
        # shortened or held back (a too-tall terminal block crops the bars)
        for level, msg in self._seen_logs:
            if level == "ERROR":
                lines.append(Text.from_markup(f"  {_log_markup(level, escape(msg))}"))
        warnings = {
            key: count for key, count in self._seen_logs.items() if key[0] == "WARNING"
        }
        if not warnings:
            return lines
        # only the message dims; the WARNING label keeps its color
        recent = list(warnings)[-_MAX_WARNING_LINES:]
        for level, msg in recent:
            lines.append(
                Text.from_markup(f"  {_log_markup(level, f'[dim]{escape(msg)}[/]')}")
            )
        held = len(warnings) - len(recent)
        total = sum(warnings.values())
        # bold dark_orange: distinct from the yellow timers, red errors, green ✓
        lines.append(
            Text.from_markup(
                f"  [bold dark_orange]⚠ {total} warning"
                f"{'s' if total > 1 else ''} so far[/]"
                + (f" · newest {len(recent)} above" if held else "")
                + f" · listed when this {self.kind.lower()} finishes · "
                f"analysis.log has each"
            )
        )
        return lines
