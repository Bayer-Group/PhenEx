from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, TYPE_CHECKING
from fastapi import FastAPI, Body, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from starlette.middleware.authentication import AuthenticationMiddleware
import asyncio
import sys

# Add /app to the Python path for phenex import during development
# This replaces the PYTHONPATH=/app setting in the /backend/.env file
sys.path = ["/app"] + sys.path
import phenex
from phenex.ibis_connect import SnowflakeConnector
from phenex.util.serialization.from_dict import from_dict

from dotenv import load_dotenv
import os
import json
import logging
import jwt

from argon2 import PasswordHasher

from .utils import CohortUtils
from .domain.user import User, new_userid
from .config import config
from .middleware import AuthBackend, DBSessionMiddleware
from .database import DatabaseManager, get_sm
from . import database as db
from .init.main import init_db

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


load_dotenv()


from openai import OpenAI

# Constants and configuration
COHORTS_DIR = os.environ.get("COHORTS_DIR", "/data/cohorts")

# Initialize database manager
sessionmaker = get_sm(config["database"])
db_manager = DatabaseManager()

# Configure OpenAI client for Azure OpenAI
from openai import AzureOpenAI

openai_client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("OPENAI_API_VERSION", "2025-01-01-preview"),
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Disable verbose SQLAlchemy logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)
logging.getLogger("sqlalchemy.dialects").setLevel(logging.ERROR)
logging.getLogger("sqlalchemy.pool").setLevel(logging.ERROR)
logging.getLogger("sqlalchemy.orm").setLevel(logging.ERROR)
logging.getLogger("sqlalchemy").setLevel(logging.ERROR)

from fastapi.middleware.cors import CORSMiddleware

init_db()

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
]


def on_auth_error(request: Request, exc: Exception):
    return JSONResponse({"error": str(exc)}, status_code=401)


app.add_middleware(
    AuthenticationMiddleware,
    backend=AuthBackend(config["auth"], sessionmaker),
    on_error=on_auth_error,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins. Replace with specific origins if needed.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(DBSessionMiddleware, sessionmaker=sessionmaker)


@app.get("/health")
async def health_check():
    """
    Health check endpoint for Docker health checks and service readiness.
    Includes database connectivity test to ensure full system readiness.

    Returns:
        dict: Health status with database connectivity check
    """
    try:
        # Test database connectivity by checking if we can connect and query
        db_status = await db_manager.health_check()

        # Check if database health check passed and all required tables exist
        if db_status.get("status") != "connected" or not db_status.get(
            "all_tables_exist", False
        ):
            raise HTTPException(
                status_code=503,
                detail={
                    "status": "unhealthy",
                    "service": "phenex-backend",
                    "database": db_status,
                    "error": "Database not ready or missing required tables",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

        return {
            "status": "healthy",
            "service": "phenex-backend",
            "database": db_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "service": "phenex-backend",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


# Import authentication utilities
from .utils.auth import get_authenticated_user_id

# Include the router from rag.py
# app.include_router(rag_router, prefix="/rag")

# Include the cohort router
from .routes.cohort import router as cohort_router

app.include_router(cohort_router)

# Include the cohort execution router
from .routes.execute import router as execute_router

app.include_router(execute_router, prefix="/cohort")

# Include the new AI router
from .routes.ai import router as ai_router

app.include_router(ai_router, prefix="/cohort")

# Include the study router
from .routes.study import router as study_router

app.include_router(study_router)

# Include the codelist routers
from .routes.codelist import (
    router as codelist_router,
    list_router as codelist_list_router,
    get_codelist_file_for_cohort,
)

app.include_router(codelist_list_router)  # /codelists endpoint (no prefix)
app.include_router(codelist_router, prefix="/codelist")  # /codelist operations

# Include the auth router
from .routes.auth import router as auth_router

app.include_router(auth_router, prefix="/auth")
