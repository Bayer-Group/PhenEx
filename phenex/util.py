import os, logging


def create_logger(name):
    # Create a logger
    logger = logging.getLogger(name)
    log_level = os.environ.get("PHENEX_LOG_LEVEL", "DEBUG").upper()
    logger.setLevel(log_level)

    # Create console handler and set level to debug
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)

    # Create formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)

    # Add console handler to logger
    logger.addHandler(console_handler)
    return logger