from dotenv import load_dotenv
import logging
import asyncio

from .populate_sample_users import UserInitializer
from .populate_sample_cohorts import SampleCohortsInitializer

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db():
    """Initialize the database (sync entrypoint wrapping the async logic)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # should have been run already
        return None

    logger.info("Running database initialization (no active event loop found)...")
    asyncio.run(_init_db())
    return None


async def _init_db():
    """Initialize database schema, users, and sample data on startup."""
    try:

        # import asyncio
        # await asyncio.sleep(5)

        # Then, create test users

        logger.info("🚀 Starting user initialization on backend startup...")
        user_initializer = UserInitializer()
        user_success = await user_initializer.initialize()

        if user_success:
            logger.info("✅ User initialization completed successfully!")
        else:
            logger.warning(
                "⚠️ User initialization failed, but backend will continue to start"
            )

        # Finally, populate sample cohorts
        logger.info("🚀 Starting sample cohorts initialization on backend startup...")
        cohorts_initializer = SampleCohortsInitializer()
        cohorts_success = await cohorts_initializer.initialize()

        if cohorts_success:
            logger.info("✅ Sample cohorts initialization completed successfully!")
        else:
            logger.warning(
                "⚠️ Sample cohorts initialization failed, but backend will continue to start"
            )

        if user_success and cohorts_success:
            logger.info("🎉 Complete database initialization completed successfully!")
        else:
            logger.warning("⚠️ Some initialization steps failed, but backend is ready")

    except Exception as e:
        logger.warning(
            f"⚠️ Database initialization failed: {e}, but backend will continue to start"
        )
