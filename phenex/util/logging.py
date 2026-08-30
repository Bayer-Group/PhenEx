import os, logging, traceback


class PhenexConsoleHandler(logging.StreamHandler):
    """The one console handler for all of phenex: it prints the plain
    formatted line, unless a display owns the screen."""

    def emit(self, record: logging.LogRecord) -> None:
        """While a display owns the screen, INFO/DEBUG do not print (analysis.log
        still gets them) and WARNING and up render through the display."""
        try:
            from phenex.util import progress

            owner = progress.console_owner()
            if owner is not None:
                if record.levelno >= logging.WARNING:
                    msg = record.getMessage()
                    if record.name == "py.warnings":
                        msg = msg.splitlines()[0].strip()
                    elif record.levelno >= logging.ERROR and record.exc_info:
                        exc = "".join(traceback.format_exception(*record.exc_info))
                        msg = f"{msg}\n{exc.rstrip()}"
                    owner.log_line(record.levelname, msg)
                return
        except Exception:
            pass
        super().emit(record)


# one instance for the whole process
_console_handler = None

_client_loggers = []


def create_logger(name: str) -> logging.Logger:
    """Create a logger."""
    global _console_handler
    logger = logging.getLogger(name)
    env_level = os.environ.get("PHENEX_LOG_LEVEL")
    logger.setLevel((env_level or "DEBUG").upper())

    if _console_handler is None:
        _console_handler = PhenexConsoleHandler()
        _console_handler.setLevel((env_level or "INFO").upper())
        _console_handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
    handler = _console_handler
    package_logger = logging.getLogger("phenex")
    if handler not in package_logger.handlers:
        package_logger.addHandler(handler)

    if not name.startswith("phenex"):
        if handler not in logger.handlers:
            logger.addHandler(handler)
        if logger not in _client_loggers:
            _client_loggers.append(logger)

    return logger
