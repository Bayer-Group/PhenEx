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
sys.path = ['/app'] + sys.path
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

from .rag import router as rag_router, query_faiss_index

load_dotenv()


from openai import OpenAI

# Constants and configuration
COHORTS_DIR = os.environ.get('COHORTS_DIR', '/data/cohorts')

# Initialize database manager
sessionmaker = get_sm(config["database"])
db_manager = DatabaseManager()

# Configure OpenAI client for Azure OpenAI
from openai import AzureOpenAI

openai_client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("OPENAI_API_VERSION", "2025-01-01-preview")
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Disable verbose SQLAlchemy logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.ERROR)
logging.getLogger('sqlalchemy.dialects').setLevel(logging.ERROR)
logging.getLogger('sqlalchemy.pool').setLevel(logging.ERROR)
logging.getLogger('sqlalchemy.orm').setLevel(logging.ERROR)
logging.getLogger('sqlalchemy').setLevel(logging.ERROR)

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


@app.get("/health", tags=["health"])
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
        if db_status.get("status") != "connected" or not db_status.get("all_tables_exist", False):
            raise HTTPException(
                status_code=503,
                detail={
                    "status": "unhealthy",
                    "service": "phenex-backend",
                    "database": db_status,
                    "error": "Database not ready or missing required tables",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
        
        return {
            "status": "healthy", 
            "service": "phenex-backend",
            "database": db_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=503, 
            detail={
                "status": "unhealthy",
                "service": "phenex-backend", 
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )


def _get_authenticated_user(request: Request) -> User:
    """Helper to extract the authenticated user or raise 401."""
    user: User | None = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _get_authenticated_user_id(request: Request) -> str:
    """Helper to extract the authenticated user's id or raise 401."""
    user = _get_authenticated_user(request)
    return str(user.id)


# Modify the get_all_cohorts endpoint to accept user_id
@app.get("/cohorts", tags=["cohort"])
async def get_all_cohorts_for_user(request: Request):
    """
    Retrieve a list of all available cohorts for the authenticated user.

    Returns:
        dict: A list of cohort IDs and names for that user.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        return await db_manager.get_all_cohorts_for_user(user_id)
    except Exception as e:
        logger.error(f"Failed to retrieve cohorts for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cohorts.")


# Modify the get_cohort endpoint to require user_id
@app.get("/cohort", tags=["cohort"])
async def get_cohort_for_user(request: Request, cohort_id: str):
    """
    Retrieve a cohort by its ID for a specific user. Retrieves the latest version.

    Args:
        cohort_id (str): The ID of the cohort to retrieve for the authenticated user.

    Returns:
        dict: The cohort data.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
        if not cohort:
            raise HTTPException(
                status_code=404,
                detail=f"Cohort {cohort_id} not found for user {user_id}",
            )
        return cohort
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving cohort {cohort_id} for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve cohort {cohort_id} for user {user_id}",
        )


@app.post("/cohort", tags=["cohort"])
async def create_cohort_for_user(
    request: Request,
    cohort_id: str,
    cohort: Dict = Body(...),
    study_id: str = None,
    provisional: bool = False,
):
    """
    Create a new cohort for a specific user.

    Args:
        cohort_id (str): The ID of the cohort to create for the authenticated user.
        cohort (Dict): The complete JSON specification of the cohort.
        study_id (str): The ID of the study this cohort belongs to (required).
        provisional (bool): Whether to save the cohort as provisional.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = _get_authenticated_user_id(request)
    
    # Check if cohort already exists
    existing_cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
    if existing_cohort:
        raise HTTPException(
            status_code=409,
            detail=f"Cohort {cohort_id} already exists. Use PATCH to update existing cohorts."
        )
    
    # Get study_id from parameter or cohort data
    if not study_id:
        study_id = cohort.get("study_id")
    
    if not study_id:
        raise HTTPException(
            status_code=400, 
            detail="study_id is required for cohort creation"
        )
    
    logger.info(f"Creating new cohort {cohort_id} with study_id {study_id}")
    
    try:
        await db_manager.update_cohort_for_user(
            user_id, cohort_id, cohort, study_id, provisional, new_version=False
        )
        return {"status": "success", "message": "Cohort created successfully."}
    except Exception as e:
        logger.error(f"Failed to create cohort for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create cohort.")


@app.patch("/cohort", tags=["cohort"])
async def update_cohort_for_user(
    request: Request,
    cohort_id: str,
    cohort: Dict = Body(...),
    provisional: bool = False,
    new_version: bool = False,
):
    """
    Update an existing cohort for a specific user.

    Args:
        cohort_id (str): The ID of the cohort to update for the authenticated user.
        cohort (Dict): The complete JSON specification of the cohort.
        provisional (bool): Whether to save the cohort as provisional.
        new_version (bool): If True, increment version. If False, replace existing version.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = _get_authenticated_user_id(request)
    
    # Check if cohort exists
    existing_cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
    if not existing_cohort:
        raise HTTPException(
            status_code=404,
            detail=f"Cohort {cohort_id} not found. Use POST to create new cohorts."
        )
    
    # Use study_id from existing record
    study_id = existing_cohort.get("study_id")
    if not study_id:
        raise HTTPException(
            status_code=500,
            detail=f"Existing cohort {cohort_id} has no study_id in database"
        )
    
    logger.info(f"Updating existing cohort {cohort_id} with study_id {study_id}")
    
    try:
        await db_manager.update_cohort_for_user(
            user_id, cohort_id, cohort, study_id, provisional, new_version
        )
        return {"status": "success", "message": "Cohort updated successfully."}
    except Exception as e:
        logger.error(f"Failed to update cohort for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update cohort.")


@app.delete("/cohort", tags=["cohort"])
async def delete_cohort_for_user(request: Request, cohort_id: str):
    """
    Delete a cohort by its ID.

    Args:
        cohort_id (str): The ID of the cohort to delete for the authenticated user.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        success = await db_manager.delete_cohort_for_user(user_id, cohort_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Failed to find cohort {cohort_id} for user {user_id}.",
            )

        return {
            "status": "success",
            "message": f"Cohort {cohort_id} deleted successfully.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete cohort {cohort_id} for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete cohort {cohort_id} for user {user_id}",
        )
    except Exception as e:
        logger.error(f"Failed to update display order for cohort {cohort_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update cohort display order.")


@app.get("/cohorts/public", tags=["cohort"])
async def get_all_public_cohorts():
    """
    Retrieve a list of all cohorts for the public user (latest versions only).

    Returns:
        dict: A list of cohort IDs and names for the public user.
    """
    try:
        public_user_id = os.getenv("PUBLIC_USER_ID")
        if not public_user_id:
            raise HTTPException(
                status_code=500, detail="PUBLIC_USER_ID environment variable not set."
            )

        cohorts = await db_manager.get_all_cohorts_for_user(public_user_id)
        return cohorts
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve public cohorts: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve public cohorts."
        )


@app.get("/cohort/public", tags=["cohort"])
async def get_public_cohort(cohort_id: str):
    """
    Retrieve a cohort by its ID for the public user. Retrieves the latest version.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.

    Returns:
        dict: The cohort data.
    """
    try:
        public_user_id = os.getenv("PUBLIC_USER_ID")
        if not public_user_id:
            raise HTTPException(
                status_code=500, detail="PUBLIC_USER_ID environment variable not set."
            )

        cohort = await db_manager.get_cohort_for_user(public_user_id, cohort_id)
        if not cohort:
            raise HTTPException(
                status_code=404, detail="Cohort not found for public user"
            )
        return cohort
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving cohort for public user: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve cohort for public user"
        )


# ========== STUDY MANAGEMENT ENDPOINTS ==========

@app.get("/studies", tags=["study"])
async def get_all_studies_for_user(request: Request):
    """
    Retrieve a list of all available studies for the authenticated user.

    Returns:
        list: A list of study objects with id, name, and metadata.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        return await db_manager.get_all_studies_for_user(user_id)
    except Exception as e:
        logger.error(f"Failed to retrieve studies for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve studies.")


@app.get("/studies/public", tags=["study"])
async def get_all_public_studies():
    """
    Retrieve a list of all public studies (studies with is_public=True).

    Returns:
        list: A list of public study objects.
    """
    try:
        # Get all studies where is_public=True, regardless of owner
        studies = await db_manager.get_all_public_studies()
        return studies
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve public studies: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve public studies.")


@app.get("/study", tags=["study"])
async def get_study_for_user(request: Request, study_id: str):
    """
    Retrieve a study by its ID for the authenticated user.

    Args:
        study_id (str): The ID of the study to retrieve.

    Returns:
        dict: The study data.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        study = await db_manager.get_study_for_user(user_id, study_id)
        if not study:
            raise HTTPException(
                status_code=404,
                detail=f"Study {study_id} not found or access denied for user {user_id}",
            )
        return study
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving study {study_id} for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve study {study_id} for user {user_id}",
        )


@app.get("/study/public", tags=["study"])
async def get_public_study(study_id: str):
    """
    Retrieve a public study by its ID.

    Args:
        study_id (str): The ID of the study to retrieve.

    Returns:
        dict: The study data.
    """
    try:
        public_user_id = os.getenv("PUBLIC_USER_ID")
        if not public_user_id:
            raise HTTPException(
                status_code=500, detail="PUBLIC_USER_ID environment variable not set."
            )

        study = await db_manager.get_study_for_user(public_user_id, study_id)
        if not study or not study.get("is_public", False):
            raise HTTPException(
                status_code=404, detail="Public study not found"
            )
        return study
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving public study {study_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve public study"
        )


@app.post("/study", tags=["study"])
async def update_study_for_user(
    request: Request,
    study_id: str,
    study: Dict = Body(...),
):
    """
    Update or create a study for the authenticated user.

    Args:
        study_id (str): The ID of the study to update.
        study (Dict): The complete JSON specification of the study.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        success = await db_manager.update_study_for_user(
            user_id=user_id,
            study_id=study_id,
            name=study.get("name", "Untitled Study"),
            description=study.get("description"),
            baseline_characteristics=study.get("baseline_characteristics"),
            outcomes=study.get("outcomes"),
            analysis=study.get("analysis"),
            visible_by=study.get("visible_by", []),
            is_public=study.get("is_public", False)
        )
        
        if success:
            return {"status": "success", "message": "Study updated successfully."}
        else:
            raise HTTPException(status_code=500, detail="Failed to update study.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update study {study_id} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update study.")


@app.post("/study/new", tags=["study"])
async def create_new_study(
    request: Request,
    study: Dict = Body(...),
):
    """
    Create a new study for the authenticated user.

    Args:
        study (Dict): The study data including name, description, etc.

    Returns:
        dict: The created study data.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        success = await db_manager.update_study_for_user(
            user_id=user_id,
            study_id=study.get("id"),
            name=study.get("name", "New Study"),
            description=study.get("description", ""),
            baseline_characteristics=study.get("baseline_characteristics", {}),
            outcomes=study.get("outcomes", {}),
            analysis=study.get("analysis", {}),
            visible_by=study.get("visible_by", []),
            is_public=study.get("is_public", False)
        )
        
        if success:
            return study
        else:
            raise HTTPException(status_code=500, detail="Failed to create study.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create new study for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create study.")


@app.delete("/study", tags=["study"])
async def delete_study_for_user(request: Request, study_id: str):
    """
    Delete a study and all associated cohorts for the authenticated user.

    Args:
        study_id (str): The ID of the study to delete.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        success = await db_manager.delete_study_for_user(user_id, study_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Study {study_id} not found or access denied for user {user_id}.",
            )

        return {
            "status": "success",
            "message": f"Study {study_id} and all associated cohorts deleted successfully.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete study {study_id} for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete study {study_id} for user {user_id}",
        )


@app.patch("/study/display_order", tags=["study"])
async def update_study_display_order(
    request: Request,
    study_id: str,
    display_order: int
):
    """
    Update the display order of a study for the authenticated user.

    Args:
        study_id (str): The ID of the study to update.
        display_order (int): The new display order value.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        success = await db_manager.update_study_display_order(
            user_id=user_id,
            study_id=study_id,
            display_order=display_order
        )
        
        if success:
            return {"status": "success", "message": "Study display order updated successfully."}
        else:
            raise HTTPException(status_code=404, detail="Study not found or access denied.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update display order for study {study_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update study display order.")


@app.get("/study/cohorts", tags=["study"])
async def get_cohorts_for_study(request: Request, study_id: str):
    """
    Retrieve all cohorts associated with a specific study.

    Args:
        study_id (str): The ID of the study.

    Returns:
        list: A list of cohort objects associated with the study.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        cohorts = await db_manager.get_cohorts_for_study(study_id, user_id)
        return cohorts
    except Exception as e:
        logger.error(f"Failed to retrieve cohorts for study {study_id}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to retrieve cohorts for study {study_id}"
        )


# Include the router from rag.py
# app.include_router(rag_router, prefix="/rag")

# Include the new AI router
from .routes.ai import router as ai_router
app.include_router(ai_router, prefix="/cohort")


@app.post("/cohort/suggest_changes_old", tags=["AI"])
async def suggest_changes(
    request: Request,
    cohort_id: str,
    model: Optional[str] = "gpt-4o-mini",
    return_updated_cohort: bool = False,
):
    """
    Generate or modify a cohort based on user instructions with conversation history.

    Args:
        request (Request): The FastAPI request object containing the request body.
        cohort_id (str): The ID of the cohort to modify for the authenticated user.
        model (str): The model to use for processing the request.
        return_updated_cohort (bool): Whether to return the updated cohort.

    Body:
        JSON object with:
        - user_request (str): Instructions for modifying the cohort.
        - conversation_history (list): List of conversation entries in chronological order.

    Returns:
        StreamingResponse: A stream of the response text.
    """
    # Read and parse the request body
    body = await request.body()
    try:
        if body:
            # Try to parse as JSON first (new format with conversation history)
            request_data = json.loads(body.decode("utf-8"))
            user_request = request_data.get("user_request", "")
            conversation_history = request_data.get("conversation_history", [])
        else:
            # Fallback for empty body
            user_request = "Generate a cohort of Atrial Fibrillation patients with no history of treatment with anti-coagulation therapies"
            conversation_history = []
    except json.JSONDecodeError:
        # Fallback to plain text format (backward compatibility)
        user_request = body.decode("utf-8") if body else "Generate a cohort of Atrial Fibrillation patients with no history of treatment with anti-coagulation therapies"
        conversation_history = []
    
    logger.info(f"User request: {user_request}")
    logger.info(f"Conversation history length: {len(conversation_history)}")

    user_id = _get_authenticated_user_id(request)
    current_cohort_record = await db_manager.get_cohort_for_user(user_id, cohort_id)
    if not current_cohort_record:
        raise HTTPException(
            status_code=404, detail=f"Cohort {cohort_id} not found for user {user_id}"
        )
    current_cohort = current_cohort_record["cohort_data"]
    study_id = current_cohort_record["study_id"]

    if not study_id:
        raise HTTPException(
            status_code=400, 
            detail=f"study_id is required for cohort updates but not found in cohort data: {current_cohort}"
        )
    try:
        # these are duplicated i think, there is a phenotype key with everything
        del current_cohort["entry_criterion"]
        del current_cohort["inclusions"]
        del current_cohort["exclusions"]
        del current_cohort["characteristics"]
        del current_cohort["outcomes"]
    except KeyError:
        pass

    system_prompt = f"""
    Your task is to create or modify a cohort according to the user instructions. A cohort consists of multiple phenotypes. You have access to functions that allow you modify individual phenotypes.

    **YOUR SUCCESS DEPENDS ON ACCURATE PARAMETERS**: The PhenEx framework is highly structured with specific parameter requirements. You will be provided with relevant documentation automatically based on your request.

    **YOUR JOB**: Complete the user's request by making the necessary phenotype changes:
    - Add the requested phenotype(s) 
    - Update existing phenotype(s)
    - Delete phenotype(s)
    - Or ask the user for clarification if the request is unclear

    **USE THE PROVIDED DOCUMENTATION**: All relevant documentation has been automatically gathered and provided in your context. Use it to construct accurate parameters!

    IMPORTANT GUIDELINES:
    - Use the add_phenotype, update_phenotype, and delete_phenotype functions to make changes - THIS IS YOUR REAL JOB
    - Available phenotypes: CodelistPhenotype, MeasurementPhenotype, CategoricalPhenotype, TimeRangePhenotype, AgePhenotype, SexPhenotype, DeathPhenotype, LogicPhenotype, ScorePhenotype, ArithmeticPhenotype, EventCountPhenotype, MeasurementChange, BinPhenotype
    - You can call these functions multiple times if needed to make incremental changes
    - NEVER STOP until the user query is satisfied or you decide you need clarifying input from the user.
    - Always provide clear, concise explanations of what changes you're making
    - When adding new phenotypes, always include good descriptions and names
    - Format your explanations using markdown for better readability
    - Indicate any ambiguities or decisions that may need user review
    - Choose appropriate domains for phenotypes based on the data source
    - All phenotypes must have a 'type' key: 'entry', 'inclusion', 'exclusion', 'characteristics', or 'outcome'
    
    🚨 CRITICAL FUNCTION CALLING RULES 🚨
    
    FOR ANY FUNCTIONAL CHANGE TO A PHENOTYPE, YOU **MUST** INCLUDE THE COMPLETE phenotype_params OBJECT!
    
    ✅ EXAMPLE - To implement an age filter on an existing AgePhenotype with id xyz:
    update_phenotype(id="xyz", explanation="Adding age filter", 
        phenotype_params={{
            "name": "Age Filter",
            "description": "Patients older than 45 years",  
            "domain": "PERSON",
            "value_filter": {{
                "class_name": "ValueFilter",
                "min_value": {{
                    "class_name": "GreaterThan", 
                    "value": 45
                }}
            }}
        }})
    
    **WORKFLOW GUIDANCE**:
    
    When you need to create or modify phenotypes with specific functional parameters (filters, codelists, etc.), consider using lookup_documentation first to get the exact parameter structures. This dramatically increases your success rate and reduces parameter errors.
    
    **THINK STRATEGICALLY**: 
    - Complex new phenotypes → lookup_documentation is very helpful
    - Simple updates (name/description only) → probably not needed
    - Multiple similar phenotypes → one lookup may cover all of them
    - Unfamiliar parameter structures → lookup_documentation is essential
    
    REMEMBER: phenotype_params must include ALL initialization parameters:
    - name (human-readable name)
    - description (human-readable description) 
    - domain (OMOP domain like "PERSON", "CONDITION_OCCURRENCE")
    - PLUS the functional parameters (value_filter, codelist, categorical_filter, etc.)
    
    The phenotype_params object represents the COMPLETE reconstruction of the phenotype via from_dict().
    
    The phenotype_params will be passed to the phenotype constructor via from_dict(), so use proper PhenEx serialization format with class_name fields. Lookup documentation for from_dict() as needed.
    
    CONCRETE EXAMPLES OF VALID from_dict() INPUT:
    
    📋 VALUE FILTER EXAMPLES:
    
    Age > 45 years:
    "phenotype_params": {{
        "name": "Age Filter",
        "description": "Patients older than 45 years",
        "domain": "PERSON",
        "value_filter": {{
            "class_name": "ValueFilter",
            "min_value": {{
                "class_name": "GreaterThan", 
                "value": 45
            }}
        }}
    }}
    
    Age 18-65 years:
    "phenotype_params": {{
        "name": "Adult Age Range",
        "description": "Patients aged 18 to 65 years",
        "domain": "PERSON", 
        "value_filter": {{
            "class_name": "ValueFilter",
            "min_value": {{
                "class_name": "GreaterThanOrEqualTo",
                "value": 18
            }},
            "max_value": {{
                "class_name": "LessThanOrEqualTo", 
                "value": 65
            }}
        }}
    }}
    
    📋 CODELIST FILTER EXAMPLES:
    
    ICD-10 codes for Atrial Fibrillation:
    "phenotype_params": {{
        "name": "Atrial Fibrillation",
        "description": "Diagnosis of atrial fibrillation",
        "domain": "CONDITION_OCCURRENCE",
        "codelist": {{
            "class_name": "Codelist",
            "codes": ["I48", "I48.0", "I48.1", "I48.9"],
            "name": "atrial_fibrillation_icd10"
        }},
        "return_date": "first"
    }}
    
    📋 CATEGORICAL FILTER EXAMPLES:
    
    Male patients only:
    "phenotype_params": {{
        "name": "Male Sex",
        "description": "Male patients only",
        "domain": "PERSON",
        "categorical_filter": {{
            "class_name": "CategoricalFilter", 
            "column_name": "SEX",
            "allowed_values": ["M"]
        }}
    }}
    
    📋 TIME RANGE FILTER EXAMPLES:
    
    Hospitalization on index date (0 days before/after):
    "phenotype_params": {{
        "name": "Hospitalization on Index Date",
        "description": "Hospitalization that occurs on the index date",
        "domain": "VISIT_OCCURRENCE",
        "relative_time_range": [{{
            "class_name": "RelativeTimeRangeFilter",
            "when": "before",
            "anchor_phenotype": null,
            "useIndexDate": true,
            "useConstant": false,
            "min_days": {{
                "class_name": "Value",
                "value": 0,
                "operator": ">="
            }},
            "max_days": {{
                "class_name": "Value", 
                "value": 0,
                "operator": "<="
            }}
        }}]
    }}
    
    365 days before index date:
    "phenotype_params": {{
        "name": "Prior Year Coverage",
        "description": "365 days of coverage before index date",
        "domain": "OBSERVATION_PERIOD",
        "relative_time_range": [{{
            "class_name": "RelativeTimeRangeFilter",
            "when": "before",
            "anchor_phenotype": null,
            "useIndexDate": true, 
            "useConstant": false,
            "min_days": {{
                "class_name": "Value",
                "value": 365,
                "operator": ">="
            }},
            "max_days": null
        }}]
    }}
    
    30 days after index date:
    "phenotype_params": {{
        "name": "Follow-up Period",
        "description": "30 days after index date",
        "domain": "CONDITION_OCCURRENCE",
        "relative_time_range": [{{
            "class_name": "RelativeTimeRangeFilter", 
            "when": "after",
            "anchor_phenotype": null,
            "useIndexDate": true,
            "useConstant": false,
            "min_days": null,
            "max_days": {{
                "class_name": "Value",
                "value": 30,
                "operator": "<="
            }}
        }}]
    }}

    SAFETY GUARDRAILS:
    - The functions include safety checks to prevent accidental deletions
    - You cannot remove existing phenotypes unless explicitly requested by the user
    - The functions will validate all changes before applying them
    """

    user_prompt = f"""     
    Consider the currently defined cohort (which is possibly empty):

    <JSON>
        {{
            "id": "{current_cohort['id']}",
            "name": "{current_cohort['name']}",
            "class_name": "{current_cohort['class_name']}",
            "phenotypes": {json.dumps(current_cohort["phenotypes"], indent=4)}
        }}
    </JSON>

    Modify the current Cohort according to the following instructions:

    {user_request}
    
    🚨 REMEMBER: Use the provided documentation to construct accurate parameters and complete the requested changes!
    """
    
    # Build messages array with conversation history
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history
    for entry in conversation_history:
        if "user" in entry:
            messages.append({"role": "user", "content": entry["user"]})
        elif "system" in entry:
            messages.append({"role": "assistant", "content": entry["system"]})
        elif "user_action" in entry:
            # Represent user actions as user messages with special formatting
            action_text = f"[User performed action: {entry['user_action']}]"
            messages.append({"role": "user", "content": action_text})
    
    # Add the current user prompt
    messages.append({"role": "user", "content": user_prompt})

    # Define the function tools for the AI - simpler phenotype-level operations
    tools = [
        {
            "type": "function",
            "function": {
                "name": "add_phenotype",
                "description": "Add a new phenotype to the cohort. For best results with complex parameters, consider using lookup_documentation first to get exact parameter structures and examples.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "Suggested identifier (will be replaced with auto-generated unique ID)"},
                        "name": {"type": "string", "description": "Short, descriptive name for the phenotype"},
                        "class_name": {"type": "string", "description": "PhenEx class name (e.g., 'AgePhenotype', 'CodelistPhenotype')"},
                        "type": {"type": "string", "enum": ["entry", "inclusion", "exclusion", "characteristics", "outcome"], "description": "Type of phenotype"},
                        "description": {"type": "string", "description": "Human-readable description"},
                        "explanation": {"type": "string", "description": "Brief explanation of why adding this phenotype"},
                        "phenotype_params": {
                            "type": "object", 
                            "description": "REQUIRED! Complete initialization parameters including name, description, domain, and functional parameters (value_filter, codelist, categorical_filter, etc.)"
                        }
                    },
                    "required": ["id", "name", "class_name", "type", "description", "explanation", "phenotype_params"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update_phenotype",
                "description": "Update an existing phenotype in the cohort. For functional changes (filters, codelists, etc.), provide complete phenotype_params with all initialization parameters. Consider using lookup_documentation first for complex parameter structures.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "ID of the phenotype to update"},
                        "explanation": {"type": "string", "description": "Brief explanation of what is being changed"},
                        "phenotype_params": {
                            "type": "object", 
                            "description": "REQUIRED for functional changes! Complete set of parameters that define the phenotype behavior. This includes ALL constructor parameters like domain, value_filter, codelist, categorical_filter, etc. For AgePhenotype with age>45, MUST include: {'value_filter': {'class_name': 'ValueFilter', 'min_value': {'class_name': 'GreaterThan', 'value': 45}}, 'domain': 'PERSON', 'name': 'Updated Name', 'description': 'New description'}. NEVER omit this for functional changes!"
                        }
                    },
                    "required": ["id", "explanation", "phenotype_params"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "delete_phenotype",
                "description": "Remove a phenotype from the cohort",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "ID of the phenotype to delete"},
                        "explanation": {"type": "string", "description": "Brief explanation of why removing this phenotype"}
                    },
                    "required": ["id", "explanation"]
                }
            }
        }
    ]



    completion = openai_client.chat.completions.create(
        model=model, 
        stream=True, 
        messages=messages,
        tools=tools,
        tool_choice="auto"
    )

    def validate_phenotype_fields(phenotype_data: dict, operation: str) -> None:
        """Validate phenotype fields for different operations using from_dict validation"""
        if operation in ["add", "update"]:
            # Validate class_name format if provided
            class_name = phenotype_data.get("class_name")
            if class_name:
                if not isinstance(class_name, str) or not class_name.strip():
                    raise ValueError("class_name must be a non-empty string")
            
            # Validate phenotype type if provided
            phenotype_type = phenotype_data.get("type")
            if phenotype_type:
                valid_types = ["entry", "inclusion", "exclusion", "characteristics", "outcome"]
                if phenotype_type not in valid_types:
                    raise ValueError(f"Invalid type '{phenotype_type}'. Must be one of: {valid_types}")
            
            # Validate phenotype_params using from_dict if class_name and params are provided
            phenotype_params = phenotype_data.get("phenotype_params", {})
            if class_name and phenotype_params and operation == "add":
                try:
                    # Create test phenotype dict for validation
                    test_phenotype_dict = {
                        "class_name": class_name,
                        **phenotype_params
                    }
                    
                    # Try to deserialize using from_dict to validate structure
                    from phenex.util.serialization.from_dict import from_dict
                    test_phenotype = from_dict(test_phenotype_dict)
                    logger.info(f"✓ Validated {class_name} parameters successfully")
                    
                except Exception as e:
                    logger.error(f"✗ Invalid parameters for {class_name}: {e}")
                    raise ValueError(f"Invalid parameters for {class_name}: {str(e)}")
            
            # Log parameter validation for debugging
            logger.info(f"Validating {operation} for {class_name}: phenotype_params = {phenotype_params}")

    async def process_add_phenotype_call(arguments_json: str):
        """Process an add_phenotype function call"""
        try:
            logger.info(f"=== ADD PHENOTYPE CALL ===")
            logger.info(f"Raw arguments received: {arguments_json}")
            
            # Documentation is now loaded proactively, so no need to check
            logger.info("ℹ️ Adding phenotype with proactively loaded documentation")
            
            # Handle case where multiple JSON objects are concatenated
            if arguments_json.count('{"id"') > 1:
                logger.warning(f"⚠️ Multiple JSON objects detected in single call - taking first one")
                # Find the end of the first JSON object
                brace_count = 0
                for i, char in enumerate(arguments_json):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            arguments_json = arguments_json[:i+1]
                            break
                logger.info(f"Cleaned arguments: {arguments_json}")
            
            args = json.loads(arguments_json)
            
            ai_provided_id = args["id"]
            phenotype_name = args["name"]
            class_name = args["class_name"]
            phenotype_type = args["type"]
            description = args["description"]
            explanation = args["explanation"]
            
            logger.info(f"Adding phenotype: {ai_provided_id} ({class_name})")
            logger.info(f"📋 FULL ADD ARGS: {json.dumps(args, indent=2)}")
            
            yield f"data: {json.dumps({'type': 'function_explanation', 'message': f'**➕ Adding {phenotype_name}:** {explanation}'})}\n\n"
            
            # Validate fields
            validate_phenotype_fields(args, "add")
            
            # Get latest cohort state before checking
            latest_cohort_record = await db_manager.get_cohort_for_user(user_id, cohort_id)
            if not latest_cohort_record:
                raise ValueError("Cohort not found")
            latest_cohort = latest_cohort_record["cohort_data"]
            
            # Generate a unique computer-friendly ID (regardless of what AI provided)
            import random
            import string
            def generate_unique_id(existing_ids):
                while True:
                    # Generate 10-character alphanumeric ID
                    unique_id = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
                    if unique_id not in existing_ids:
                        return unique_id
            
            existing_phenotypes = latest_cohort.get("phenotypes", [])
            existing_ids = {p.get("id") for p in existing_phenotypes}
            phenotype_id = generate_unique_id(existing_ids)
            
            logger.info(f"🔄 Generated unique ID: {ai_provided_id} → {phenotype_id}")
            
            # Create new phenotype with generated unique ID
            new_phenotype = {
                "id": phenotype_id,
                "name": phenotype_name,
                "class_name": class_name,
                "type": phenotype_type,
                "description": description
            }
            
            # STRICT VALIDATION: phenotype_params is now required for add_phenotype too
            phenotype_params = args.get("phenotype_params", {})
            logger.info(f"📋 PHENOTYPE_PARAMS PROVIDED: {json.dumps(phenotype_params, indent=2)}")
            
            if not phenotype_params:
                error_msg = f"❌ CRITICAL ERROR: phenotype_params is REQUIRED for add_phenotype! You must provide complete initialization parameters including name, description, domain, and functional parameters. This call will be REJECTED."
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # Validate that phenotype_params has required fields
            required_fields = ["name", "description", "domain"]
            missing_fields = [f for f in required_fields if f not in phenotype_params]
            if missing_fields:
                error_msg = f"❌ CRITICAL ERROR: phenotype_params is missing required fields: {missing_fields}. You must provide name, description, domain, plus functional parameters. This call will be REJECTED."
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            logger.info(f"✅ Validation passed! Applying complete phenotype_params to new phenotype")
            
            # Create new phenotype with generated unique ID and complete parameters
            new_phenotype = {
                "id": phenotype_id,  # Use the auto-generated unique ID
                "class_name": class_name,
                "type": phenotype_type,
                **phenotype_params  # Apply all the initialization parameters
            }
            
            logger.info(f"📋 NEW PHENOTYPE: {json.dumps(new_phenotype, indent=2)}")
            
            # Add to current cohort
            updated_phenotypes = existing_phenotypes + [new_phenotype]
            await save_updated_cohort(updated_phenotypes, f"Added phenotype: {phenotype_id}", latest_cohort)
            
            yield f"data: {json.dumps({'type': 'function_success', 'message': f'Added {phenotype_name} successfully'})}\n\n"
            
        except Exception as e:
            logger.error(f"Error in add_phenotype: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    async def process_update_phenotype_call(arguments_json: str, documentation_tracker: dict):
        """Process an update_phenotype function call"""
        try:
            logger.info(f"=== UPDATE PHENOTYPE CALL ===")
            
            # Documentation is now loaded proactively, so no need to check
            logger.info("ℹ️ Updating phenotype with proactively loaded documentation")
            
            args = json.loads(arguments_json)
            
            phenotype_id = args["id"]
            explanation = args["explanation"]
            
            logger.info(f"Updating phenotype: {phenotype_id}")
            logger.info(f"📋 FULL UPDATE ARGS: {json.dumps(args, indent=2)}")
            
            # Get latest cohort state before updating
            latest_cohort_record = await db_manager.get_cohort_for_user(user_id, cohort_id)
            if not latest_cohort_record:
                raise ValueError("Cohort not found")
            latest_cohort = latest_cohort_record["cohort_data"]
            
            # Find existing phenotype
            existing_phenotypes = latest_cohort.get("phenotypes", [])
            phenotype_index = None
            existing_phenotype = None
            for i, p in enumerate(existing_phenotypes):
                if p.get("id") == phenotype_id:
                    phenotype_index = i
                    existing_phenotype = p
                    break
            
            if phenotype_index is None:
                raise ValueError(f"Phenotype with ID '{phenotype_id}' not found. Use add_phenotype to create new phenotypes.")
            
            logger.info(f"📋 EXISTING PHENOTYPE: {json.dumps(existing_phenotype, indent=2)}")
            
            phenotype_name = existing_phenotype.get("name", existing_phenotype.get("description", phenotype_id))
            yield f"data: {json.dumps({'type': 'function_explanation', 'message': f'**✏️ Updating {phenotype_name}:** {explanation}'})}\n\n"
            
            # Validate fields
            validate_phenotype_fields(args, "update")
            
            # Update phenotype with provided fields
            updated_phenotype = existing_phenotypes[phenotype_index].copy()
            for field in ["name", "class_name", "type", "description"]:
                if field in args:
                    logger.info(f"🔄 Updating field '{field}': {args[field]}")
                    updated_phenotype[field] = args[field]
            
            # STRICT VALIDATION: phenotype_params is now required
            phenotype_params = args.get("phenotype_params", {})
            logger.info(f"📋 PHENOTYPE_PARAMS PROVIDED: {json.dumps(phenotype_params, indent=2)}")
            
            # Validate that phenotype_params has required fields
            required_fields = ["name", "description", "domain"]
            missing_fields = [f for f in required_fields if f not in phenotype_params]
            if missing_fields:
                error_msg = f"❌ CRITICAL ERROR: phenotype_params is missing required fields: {missing_fields}. You must provide name, description, domain, plus functional parameters. This call will be REJECTED."
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            logger.info(f"✅ Validation passed! Applying complete phenotype_params to phenotype")
            
            # Replace the entire phenotype with new parameters (this is a complete reconstruction)
            updated_phenotype = {
                "id": phenotype_id,  # Keep the same ID
                "class_name": existing_phenotype.get("class_name"),  # Keep the same class
                "type": existing_phenotype.get("type"),  # Keep the same type
                **phenotype_params  # Apply all the new parameters
            }
            
            logger.info(f"📋 UPDATED PHENOTYPE (complete reconstruction): {json.dumps(updated_phenotype, indent=2)}")
            
            # Replace in list
            updated_phenotypes = existing_phenotypes.copy()
            updated_phenotypes[phenotype_index] = updated_phenotype
            
            await save_updated_cohort(updated_phenotypes, f"Updated phenotype: {phenotype_id}", latest_cohort)
            
            # Use updated name for success message
            updated_name = updated_phenotype.get("name", updated_phenotype.get("description", phenotype_id))
            yield f"data: {json.dumps({'type': 'function_success', 'message': f'Updated {updated_name} successfully'})}\n\n"
            
        except Exception as e:
            logger.error(f"Error in update_phenotype: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    async def process_delete_phenotype_call(arguments_json: str):
        """Process a delete_phenotype function call"""
        try:
            logger.info(f"=== DELETE PHENOTYPE CALL ===")
            args = json.loads(arguments_json)
            
            phenotype_id = args["id"]
            explanation = args["explanation"]
            
            logger.info(f"Deleting phenotype: {phenotype_id}")
            
            # Get latest cohort state before deleting
            latest_cohort_record = await db_manager.get_cohort_for_user(user_id, cohort_id)
            if not latest_cohort_record:
                raise ValueError("Cohort not found")
            latest_cohort = latest_cohort_record["cohort_data"]
            
            # Find phenotype to get its name before deleting
            existing_phenotypes = latest_cohort.get("phenotypes", [])
            logger.info(f"📋 EXISTING PHENOTYPES BEFORE DELETE: {json.dumps([p.get('id') for p in existing_phenotypes])}")
            
            phenotype_to_delete = None
            for p in existing_phenotypes:
                if p.get("id") == phenotype_id:
                    phenotype_to_delete = p
                    break
            
            if not phenotype_to_delete:
                raise ValueError(f"Phenotype with ID '{phenotype_id}' not found")
            
            logger.info(f"📋 PHENOTYPE TO DELETE: {json.dumps(phenotype_to_delete, indent=2)}")
            
            phenotype_name = phenotype_to_delete.get("name", phenotype_to_delete.get("description", phenotype_id))
            yield f"data: {json.dumps({'type': 'function_explanation', 'message': f'**🗑️ Removing {phenotype_name}:** {explanation}'})}\n\n"
            
            # Remove phenotype
            updated_phenotypes = [p for p in existing_phenotypes if p.get("id") != phenotype_id]
            logger.info(f"📋 UPDATED PHENOTYPES AFTER DELETE: {json.dumps([p.get('id') for p in updated_phenotypes])}")
            logger.info(f"📊 PHENOTYPE COUNT: Before={len(existing_phenotypes)}, After={len(updated_phenotypes)}")
            
            await save_updated_cohort(updated_phenotypes, f"Deleted phenotype: {phenotype_id}", latest_cohort)
            
            yield f"data: {json.dumps({'type': 'function_success', 'message': f'Removed {phenotype_name} successfully'})}\n\n"
            
        except Exception as e:
            logger.error(f"Error in delete_phenotype: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"



    async def save_updated_cohort(updated_phenotypes: list, change_description: str, base_cohort: dict):
        """Helper to save updated cohort with new phenotype list"""
        try:
            logger.info(f"💾 SAVING UPDATED COHORT: {change_description}")
            logger.info(f"📋 INPUT PHENOTYPES: {json.dumps([p.get('id') for p in updated_phenotypes])}")
            
            # Create updated cohort data
            new_phenotypes_data = {
                "id": base_cohort['id'],
                "name": base_cohort['name'],
                "class_name": base_cohort['class_name'],
                "phenotypes": updated_phenotypes
            }
            
            logger.info(f"📋 NEW PHENOTYPES DATA: {json.dumps(new_phenotypes_data, indent=2)}")
            
            # Process through CohortUtils - but skip update_cohort for deletions since it adds back missing phenotypes
            c = CohortUtils()
            
            # For deletions, directly use the new phenotypes data instead of merging with old cohort
            # This prevents CohortUtils.update_cohort from adding back deleted phenotypes
            logger.info(f"🔄 Using direct phenotype replacement to avoid restoring deleted phenotypes")
            updated_cohort_data = new_phenotypes_data.copy()
            logger.info(f"📋 UPDATED COHORT DATA (direct replacement): {json.dumps(updated_cohort_data.get('phenotypes', []), indent=2)}")
            
            new_cohort = c.convert_phenotypes_to_structure(updated_cohort_data)
            logger.info(f"📋 FINAL COHORT STRUCTURE: phenotypes count = {len(new_cohort.get('phenotypes', []))}")
            logger.info(f"📋 FINAL PHENOTYPE IDs: {[p.get('id') for p in new_cohort.get('phenotypes', [])]}")
            
            # Validate structure
            if not isinstance(new_cohort, dict):
                raise ValueError("Generated cohort is not a valid dictionary")
            
            required_fields = ["id", "name", "class_name"]
            for field in required_fields:
                if field not in new_cohort:
                    raise ValueError(f"Generated cohort missing required field: {field}")
            
            # Save as provisional
            await db_manager.update_cohort_for_user(
                user_id,
                cohort_id,
                new_cohort,
                study_id,
                provisional=True,
                new_version=False,
            )
            
            logger.info(f"Successfully saved cohort: {change_description}")
            
        except Exception as e:
            logger.error(f"Error saving cohort: {e}")
            raise ValueError(f"Failed to save cohort changes: {e}")

    async def stream_response():
        function_call_buffer = {}
        accumulated_content = ""
        # Documentation is now loaded proactively, no need for tracking
        
        try:
            for chunk in completion:
                if len(chunk.choices):
                    delta = chunk.choices[0].delta
                    
                    # Handle regular content
                    if delta.content is not None:
                        logger.debug(f"📝 Content token: '{delta.content}'")
                        accumulated_content += delta.content
                        yield f"data: {json.dumps({'type': 'content', 'message': delta.content})}\n\n"
                    
                    # Handle function calls
                    if delta.tool_calls:
                        for tool_call in delta.tool_calls:
                            call_id = tool_call.id if tool_call.id else "unknown"
                            
                            # Get function info safely
                            function_name = ""
                            function_args = ""
                            if tool_call.function:
                                function_name = tool_call.function.name or ""
                                function_args = tool_call.function.arguments or ""
                            
                            # Initialize buffer for this call if not exists
                            if call_id not in function_call_buffer:
                                function_call_buffer[call_id] = {
                                    "name": "",
                                    "arguments": "",
                                    "complete": False
                                }
                            
                            # Update function name if provided (and merge with existing if needed)
                            if function_name:
                                if not function_call_buffer[call_id]["name"]:
                                    function_call_buffer[call_id]["name"] = function_name
                                elif function_call_buffer[call_id]["name"] != function_name:
                                    logger.warning(f"Function name mismatch for {call_id}: existing='{function_call_buffer[call_id]['name']}', new='{function_name}'")
                            
                            # Accumulate arguments
                            if function_args:
                                function_call_buffer[call_id]["arguments"] += function_args

            # After processing all chunks, handle any complete function calls
            logger.info(f"=== FUNCTION CALL SUMMARY ===")
            logger.info(f"Found {len(function_call_buffer)} function call(s)")
            
            # Find all executable function calls
            executable_calls = []
            valid_function_names = ["add_phenotype", "update_phenotype", "delete_phenotype"]
            
            for call_id, call_data in function_call_buffer.items():
                if call_data["name"] in valid_function_names and call_data["arguments"]:
                    executable_calls.append((call_id, call_data))
                elif call_data["arguments"] and not call_data["name"]:
                    # Handle case where arguments are present but function name might be missing
                    logger.info(f"Found call {call_id} with arguments but no name - checking function type")
                    
                    # Try to merge with named calls that have no arguments
                    for other_call_id, other_call_data in function_call_buffer.items():
                        if other_call_data["name"] in valid_function_names and not other_call_data["arguments"]:
                            logger.info(f"Merging arguments from {call_id} into {other_call_id}")
                            other_call_data["arguments"] = call_data["arguments"]
                            executable_calls.append((other_call_id, other_call_data))
                            break
                    else:
                        # Try to infer function type from arguments structure
                        if call_data["arguments"].strip().startswith('{'):
                            try:
                                args = json.loads(call_data["arguments"])
                                # Simple heuristic: if it has class_name and type, it's likely add_phenotype
                                if "class_name" in args and "type" in args:
                                    logger.info(f"Inferring {call_id} as add_phenotype based on arguments")
                                    call_data["name"] = "add_phenotype"
                                    executable_calls.append((call_id, call_data))
                            except json.JSONDecodeError:
                                logger.warning(f"Could not parse arguments for {call_id}")
            
            logger.info(f"Found {len(executable_calls)} executable function calls")
            
            # Execute the calls
            for call_id, call_data in executable_calls:
                if not call_data["complete"]:
                    function_name = call_data["name"]
                    logger.info(f"=== EXECUTING {function_name.upper()} CALL {call_id} ===")
                    logger.info(f"Arguments: {call_data['arguments']}")
                    
                    # Route to appropriate handler
                    try:
                        if function_name == "add_phenotype":
                            async for message in process_add_phenotype_call(call_data["arguments"]):
                                yield message
                        elif function_name == "update_phenotype":
                            async for message in process_update_phenotype_call(call_data["arguments"]):
                                yield message
                        elif function_name == "delete_phenotype":
                            async for message in process_delete_phenotype_call(call_data["arguments"]):
                                yield message
                        elif function_name == "lookup_documentation":
                            logger.warning(f"⚠️ lookup_documentation called but this function is now handled proactively")
                            yield f"data: {json.dumps({'type': 'info', 'message': 'Documentation is now loaded automatically - no need for manual lookup'})}\n\n"
                        else:
                            logger.error(f"Unknown function name: {function_name}")
                            yield f"data: {json.dumps({'type': 'error', 'message': f'Unknown function: {function_name}'})}\n\n"
                    except Exception as e:
                        logger.error(f"Error executing {function_name}: {e}")
                        yield f"data: {json.dumps({'type': 'error', 'message': f'Error in {function_name}: {str(e)}'})}\n\n"
                    
                    call_data["complete"] = True
                    logger.info(f"=== COMPLETED {function_name.upper()} CALL {call_id} ===")
            
            logger.info(f"=== END FUNCTION CALL PROCESSING ===")
            logger.info(f"📊 EXECUTION SUMMARY: Total executable calls: {len(executable_calls)}")
            logger.info(f"📊 Documentation loaded proactively")
            
            # Show what content was generated
            logger.info(f"📝 Content generated: {len(accumulated_content)} characters")
            if accumulated_content:
                logger.info(f"Content preview: {accumulated_content[:200]}...")
            
            # If no executable calls were found but we have accumulated content, send it to user
            if not executable_calls and accumulated_content:
                logger.info(f"No function calls executed. AI responded with text only.")
                yield f"data: {json.dumps({'type': 'ai_response', 'message': accumulated_content})}\n\n"
            elif not executable_calls and not accumulated_content:
                logger.warning("No function calls executed AND no content received from AI!")
                yield f"data: {json.dumps({'type': 'ai_response', 'message': 'No response received from AI.'})}\n\n"
            elif not executable_calls:
                logger.warning("No executable function calls found despite having function call data")
            
            # If we had both content and function calls, show a completion message
            if executable_calls and accumulated_content:
                yield f"data: {json.dumps({'type': 'ai_response', 'message': accumulated_content})}\n\n"
            elif executable_calls and not accumulated_content:
                yield f"data: {json.dumps({'type': 'ai_response', 'message': f'✅ Completed {len(executable_calls)} operation(s) successfully.'})}\n\n"
            
            # Catch incomplete workflow: if only lookup_documentation was called
            if len(executable_calls) == 1 and executable_calls[0][1]["name"] == "lookup_documentation":
                logger.warning("🚨 INCOMPLETE: AI only performed documentation lookup but didn't complete the actual task!")
                yield f"data: {json.dumps({'type': 'error', 'message': '⚠️ The AI looked up documentation but failed to complete your request. This appears to be an AI reasoning error. Please try rephrasing your request or be more specific about what changes you want made.'})}\n\n"

            # Final processing complete
            if return_updated_cohort:
                updated_cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
                if updated_cohort:
                    yield f"data: {json.dumps({'type': 'result', 'data': updated_cohort['cohort_data']})}\n\n"

        except Exception as e:
            logger.error(f"Error in stream_response: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Streaming failed: {str(e)}'})}\n\n"
        
        # Send completion signal
        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

    async def buffered_stream():
        async for chunk in stream_response():
            yield chunk
            # Force immediate delivery by yielding an empty chunk
            await asyncio.sleep(0)

    return StreamingResponse(
        buffered_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Transfer-Encoding": "chunked",
        },
    )


@app.get("/cohort/accept_changes", tags=["AI"])
async def accept_changes(request: Request, cohort_id: str):
    """
    Accept changes made to a provisional cohort by setting is_provisional to False.

    Args:
        cohort_id (str): The ID of the cohort to finalize for the authenticated user.

    Returns:
        dict: The finalized cohort data.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        success = await db_manager.accept_changes(user_id, cohort_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"No provisional changes found for cohort {cohort_id}",
            )
        cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
        return cohort
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to accept changes for cohort {cohort_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to accept changes for cohort {cohort_id}"
        )


@app.get("/cohort/reject_changes", tags=["AI"])
async def reject_changes(request: Request, cohort_id: str):
    """
    Reject changes made to a provisional cohort by deleting provisional versions.

    Args:
        cohort_id (str): The ID of the cohort to discard provisional changes for authenticated user.

    Returns:
        dict: The non-provisional cohort data.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        logger.info(f"Rejecting changes for user {user_id}, cohort {cohort_id}")
        await db_manager.reject_changes(user_id, cohort_id)

        # Return the non-provisional cohort
        logger.info(f"Fetching non-provisional cohort after rejection")
        cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
        if not cohort:
            raise HTTPException(
                status_code=404,
                detail=f"Cohort {cohort_id} not found after rejecting changes",
            )
        return cohort
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reject changes for cohort {cohort_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to reject changes for cohort {cohort_id}"
        )


@app.get("/cohort/get_changes", tags=["AI"])
async def get_changes(request: Request, cohort_id: str):
    """
    Get differences between the provisional and non-provisional versions of a cohort.
    Returns empty dict if there is no provisional cohort.

    Args:
        cohort_id (str): The ID of the cohort to compare for the authenticated user.

    Returns:
        dict: Dictionary of changes between provisional and non-provisional versions.
    """
    user_id = _get_authenticated_user_id(request)
    try:
        changes = await db_manager.get_changes_for_user(user_id, cohort_id)
        return changes
    except Exception as e:
        logger.error(
            f"Failed to get changes for cohort {cohort_id} for user {user_id}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get changes for cohort {cohort_id} for user {user_id}",
        )


@app.post("/execute_study")
async def execute_study(
    request: Request,
    cohort: Dict = None,
    database_config: Dict = None,
):
    """
    Execute a study using the provided cohort and database configuration with streaming output.

    Args:
        request (Request): The request object for authentication.
        cohort (Dict): The cohort definition.
        database_config (Dict): The database configuration for the study.

    Returns:
        StreamingResponse: A stream of execution logs followed by the final results.
    """
    # Get authenticated user_id and add it to cohort
    user_id = _get_authenticated_user_id(request)
    if cohort:
        cohort["user_id"] = user_id
    import sys
    import asyncio
    from queue import Queue
    import threading
    import json

    async def stream_execution():
        # Create a queue to capture output
        output_queue = Queue()
        final_result = {}

        def capture_output():
            # Capture stdout and stderr
            old_stdout = sys.stdout
            old_stderr = sys.stderr

            # Capture logging output
            import logging

            class StreamCapture:
                def __init__(self, queue, prefix=""):
                    self.queue = queue
                    self.prefix = prefix

                def write(self, text):
                    if text.strip():  # Only send non-empty lines
                        self.queue.put(f"{self.prefix}{text}")
                    return len(text)

                def flush(self):
                    pass

            # Custom logging handler to capture log messages
            class QueueHandler(logging.Handler):
                def __init__(self, queue):
                    super().__init__()
                    self.queue = queue

                def emit(self, record):
                    try:
                        log_message = self.format(record)
                        level_name = record.levelname
                        self.queue.put(f"[{level_name}] {log_message}")
                    except Exception:
                        self.handleError(record)

            # Set up logging capture
            queue_handler = QueueHandler(output_queue)
            queue_handler.setFormatter(logging.Formatter("%(name)s - %(message)s"))

            # Get the root logger and add our handler
            root_logger = logging.getLogger()
            original_level = root_logger.level
            original_handlers = root_logger.handlers.copy()

            # Also specifically capture phenex logger messages
            phenex_logger = logging.getLogger("phenex")
            phenex_original_level = phenex_logger.level
            phenex_original_handlers = phenex_logger.handlers.copy()
            
            # Also capture the main app logger specifically
            app_logger = logging.getLogger(__name__)
            app_original_level = app_logger.level
            app_original_handlers = app_logger.handlers.copy()

            # Clear existing handlers and add our queue handler
            root_logger.handlers.clear()
            root_logger.addHandler(queue_handler)
            root_logger.setLevel(logging.INFO)  # Capture all log levels

            # Ensure phenex logger also uses our handler
            phenex_logger.handlers.clear()
            phenex_logger.addHandler(queue_handler)
            phenex_logger.setLevel(logging.INFO)
            phenex_logger.propagate = True  # Ensure messages propagate to root logger
            
            # Ensure app logger also uses our handler
            app_logger.handlers.clear()
            app_logger.addHandler(queue_handler)
            app_logger.setLevel(logging.INFO)
            app_logger.propagate = True  # Ensure messages propagate to root logger

            sys.stdout = StreamCapture(output_queue, "[STDOUT] ")
            sys.stderr = StreamCapture(output_queue, "[STDERR] ")

            try:
                print(f"Starting execution for cohort: {cohort.get('name', 'Unknown')}")
                logger.info(
                    f"Starting execution for cohort: {cohort.get('name', 'Unknown')}"
                )
                print(f"Database config: {database_config}")
                logger.info(f"Database configuration: {database_config}")

                if database_config["mapper"] == "OMOP":
                    from phenex.mappers import OMOPDomains

                    mapper = OMOPDomains
                    print("Using OMOP mapper")
                    logger.info("Using OMOP mapper")

                database = database_config["config"]
                print("Creating database connection...")
                logger.info("Creating Snowflake database connection...")

                con = SnowflakeConnector(
                    SNOWFLAKE_SOURCE_DATABASE=database["source_database"],
                    SNOWFLAKE_DEST_DATABASE=database["destination_database"],
                )
                print("Database connection established")
                logger.info("Database connection established successfully")

                print("Getting mapped tables...")
                logger.info("Retrieving mapped tables from database...")
                mapped_tables = mapper.get_mapped_tables(con)
                print(f"Found {len(mapped_tables)} mapped tables")
                logger.info(
                    f"Successfully retrieved {len(mapped_tables)} mapped tables"
                )

                del cohort["phenotypes"]
                print("Preparing cohort for phenex...")
                logger.info("Converting cohort data structure for phenex processing...")
                
                # Extract user_id from cohort before processing
                user_id = cohort.get("user_id")
                if not user_id:
                    logger.warning("No user_id found in cohort, some operations may fail")
                
                print("🏥 PREPARING COHORT FOR PHENEX...")
                logger.info("🏥 PREPARING COHORT FOR PHENEX...")
                processed_cohort = prepare_cohort_for_phenex(cohort, user_id)
                print("🏥 COHORT PREPARATION COMPLETED!")
                logger.info("🏥 COHORT PREPARATION COMPLETED!")

                print("Saving processed cohort...")
                logger.info("Saving processed cohort to processed_cohort.json")
                with open("./processed_cohort.json", "w") as f:
                    json.dump(processed_cohort, f, indent=4)

                print("Creating phenex cohort object...")
                logger.info(f"Creating phenex cohort object from processed data... AND MODIFIED {sys.path}")
                px_cohort = from_dict(processed_cohort)

                logger.info("Saving cohort object to cohort.json")
                with open("./cohort.json", "w") as f:
                    json.dump(px_cohort.to_dict(), f, indent=4)

                print("Executing cohort...")
                logger.info("Starting cohort execution against mapped tables...")
                px_cohort.execute(tables=mapped_tables)#, con = con, n_threads=6, overwrite=True, lazy_execution=True)
                print("Appending counts...")
                logger.info("Appending patient counts to cohort results...")
                px_cohort.append_counts()

                print("Generating table1...")
                logger.info("Generating Table 1 (baseline characteristics)...")

                print("Generating waterfall report...")
                logger.info("Generating waterfall/attrition report...")
                from phenex.reporting import Waterfall

                r = Waterfall(pretty_display=False,decimal_places=2)
                df_waterfall = r.execute(px_cohort)

                print("Finalizing results...")
                logger.info("Finalizing and formatting results for return...")
                append_count_to_cohort(px_cohort, cohort)

                from json import loads

                cohort["table1"] = loads(px_cohort.table1.to_json(orient="split"))
                cohort["waterfall"] = loads(df_waterfall.to_json(orient="split"))

                final_result["cohort"] = cohort

                print("Execution completed successfully!")
                logger.info("Cohort execution completed successfully!")

            except Exception as e:
                print(f"ERROR: {str(e)}")
                import traceback

                print(f"TRACEBACK: {traceback.format_exc()}")
                final_result["error"] = str(e)
            finally:
                # Restore original stdout/stderr
                sys.stdout = old_stdout
                sys.stderr = old_stderr

                # Restore original logging configuration
                root_logger.handlers.clear()
                for handler in original_handlers:
                    root_logger.addHandler(handler)
                root_logger.setLevel(original_level)

                # Restore phenex logger configuration
                phenex_logger.handlers.clear()
                for handler in phenex_original_handlers:
                    phenex_logger.addHandler(handler)
                phenex_logger.setLevel(phenex_original_level)
                
                # Restore app logger configuration
                app_logger.handlers.clear()
                for handler in app_original_handlers:
                    app_logger.addHandler(handler)
                app_logger.setLevel(app_original_level)

                output_queue.put("__EXECUTION_COMPLETE__")

        # Start execution in a separate thread
        execution_thread = threading.Thread(target=capture_output)
        execution_thread.start()

        # Stream output as it comes
        while True:
            try:
                # Check for output with a timeout
                if not output_queue.empty():
                    output = output_queue.get_nowait()
                    if output == "__EXECUTION_COMPLETE__":
                        break
                    yield f"data: {json.dumps({'type': 'log', 'message': output})}\n\n"
                else:
                    await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
            except Exception:
                await asyncio.sleep(0.1)

        # Wait for thread to complete
        execution_thread.join()

        # Send final result
        if "error" in final_result:
            yield f"data: {json.dumps({'type': 'error', 'message': final_result['error']})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'result', 'data': final_result})}\n\n"

        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

    return StreamingResponse(
        stream_execution(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        },
    )


def append_count_to_cohort(phenex_cohort, cohort_dict):
    cohort_dict["entry_criterion"]["count"] = append_count_to_phenotype(phenex_cohort.entry_criterion, cohort_dict["entry_criterion"])
    if isinstance(phenex_cohort.inclusions, list) and len(phenex_cohort.inclusions) > 0:
        append_count_to_phenotypes(phenex_cohort.inclusions, cohort_dict["inclusions"])
    if isinstance(phenex_cohort.exclusions, list) and len(phenex_cohort.exclusions) > 0:
        append_count_to_phenotypes(phenex_cohort.exclusions, cohort_dict["exclusions"])
    if (
        isinstance(phenex_cohort.characteristics, list)
        and len(phenex_cohort.characteristics) > 0
    ):
        append_count_to_phenotypes(
            phenex_cohort.characteristics, cohort_dict["characteristics"]
        )
    if isinstance(phenex_cohort.outcomes, list) and len(phenex_cohort.outcomes) > 0:
        append_count_to_phenotypes(phenex_cohort.outcomes, cohort_dict["outcomes"])


def append_count_to_phenotype(phenex_phenotype, phenotype_dict):
    """
    Recursively appends count to a phenotype and all its nested child phenotypes.
    
    For LogicPhenotypes with ComputationGraph expressions, this function traverses
    the entire tree structure and appends counts to all embedded component phenotypes.
    
    Args:
        phenex_phenotype: The executed PhenEx phenotype object with count information
        phenotype_dict: The dictionary representation of the phenotype to update
    """
    # Append count to the current phenotype
    if hasattr(phenex_phenotype, 'count'):
        phenotype_dict["count"] = phenex_phenotype.count
    
    # If this is a LogicPhenotype with a ComputationGraph expression, recursively process nested phenotypes
    if hasattr(phenex_phenotype, 'expression') and phenex_phenotype.expression is not None:
        phenex_expression = phenex_phenotype.expression
        
        # The phenotype_dict should also have an expression field (ComputationGraph)
        if "expression" in phenotype_dict and phenotype_dict["expression"] is not None:
            dict_expression = phenotype_dict["expression"]
            _append_count_to_computation_graph(phenex_expression, dict_expression)


def _append_count_to_computation_graph(phenex_node, dict_node):
    """
    Helper function to recursively traverse a ComputationGraph and append counts to all nodes.
    
    Args:
        phenex_node: The executed PhenEx ComputationGraph node or phenotype
        dict_node: The dictionary representation of the node to update
    """
    # Check if this is a ComputationGraph node (has left and right children)
    if hasattr(phenex_node, 'left') and hasattr(phenex_node, 'right'):
        # Recursively process left and right branches
        if "left" in dict_node:
            _append_count_to_computation_graph(phenex_node.left, dict_node["left"])
        if "right" in dict_node:
            _append_count_to_computation_graph(phenex_node.right, dict_node["right"])
    else:
        # This is a leaf node (actual phenotype) - append its count
        if hasattr(phenex_node, 'count'):
            dict_node["count"] = phenex_node.count
        
        # If this leaf phenotype is itself a LogicPhenotype, recursively process its expression
        if hasattr(phenex_node, 'expression') and phenex_node.expression is not None:
            if "expression" in dict_node and dict_node["expression"] is not None:
                _append_count_to_computation_graph(phenex_node.expression, dict_node["expression"])


def append_count_to_phenotypes(phenex_phenotypes, list_of_phenotype_dicts):
    """
    Appends counts to a list of phenotypes and all their nested child phenotypes.
    
    Args:
        phenex_phenotypes: List of executed PhenEx phenotype objects
        list_of_phenotype_dicts: List of phenotype dictionaries to update
    """
    for phenex_phenotype, phenotype_dict in zip(
        phenex_phenotypes, list_of_phenotype_dicts
    ):
        append_count_to_phenotype(phenex_phenotype, phenotype_dict)


# -- CODELIST FILE MANAGEMENT ENDPOINTS
@app.get("/codelist_filesnames_for_cohort", tags=["codelist"])
async def codelist_filesnames_for_cohort(cohort_id: str):
    """
    Get a list of codelist filenames for a given cohort ID.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.

    Returns:
        list: list of filenames
    """
    # Add await here - this is critical!
    return await get_codelist_filenames_for_cohort(db_manager, cohort_id)

@app.get("/codelist_file_for_cohort", tags=["codelist"])
async def codelist_file_for_cohort(request: Request, cohort_id: str, file_id: str):
    """
    Get the contents of a codelist file for a given cohort ID and file ID.

    Args:
        request (Request): The request object for authentication.
        cohort_id (str): The ID of the cohort to retrieve.
        file_id (str): The ID of the file to retrieve.

    Returns:
        dict: codelist file contents
    """
    user_id = _get_authenticated_user_id(request)
    result = await get_codelist_file_for_cohort(db_manager, cohort_id, file_id, user_id)
    
    if result is None:
        raise HTTPException(status_code=404, detail=f"Codelist file {file_id} not found for cohort {cohort_id}")
    
    return result


@app.post("/upload_codelist_file_to_cohort", tags=["codelist"])
async def upload_codelist_file_to_cohort(request: Request, file: dict, cohort_id: str = None):
    """
    Upload a codelist file to a cohort.

    Args:
        request (Request): The request object for authentication.
        file (dict): The file to upload.
        cohort_id (str): The ID of the cohort to retrieve (from query parameter).

    Returns:
        dict: The cohort data.
    """
    user_id = _get_authenticated_user_id(request)
    
    # Get cohort_id from query parameters if not provided as function parameter
    if cohort_id is None:
        cohort_id = request.query_params.get("cohort_id")
    
    if not cohort_id:
        raise HTTPException(status_code=400, detail="cohort_id is required")
    
    await save_codelist_file_for_cohort(db_manager, cohort_id, file["id"], file, user_id)
    return {
        "status": "success",
        "message": f"Uploaded {cohort_id} {file['id']} successfully.",
    }


@app.delete("/codelist_file", tags=["codelist"])
async def delete_codelist_file(cohort_id: str, file_id: str):
    """
    Delete a codelist file and it's contents.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.
        file_id (str): The ID of the file to retrieve.
    """
    delete_codelist_file_for_cohort(db_manager, cohort_id, file_id)

    return {
        "status": "success",
        "message": f"Codelist file {file_id} deleted successfully.",
    }


@app.patch("/codelist_file_column_mapping", tags=["codelist"])
async def update_codelist_file_column_mapping(request: Request, file_id: str, column_mapping: dict):
    """
    Update only the column mapping for a codelist file.
    Also updates the codelists array cache based on the codelist_column.

    Args:
        request (Request): The request object for authentication.
        file_id (str): The ID of the file to update.
        column_mapping (dict): Dictionary with code_column, code_type_column, codelist_column.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = _get_authenticated_user_id(request)
    
    # Validate column_mapping structure
    required_keys = {"code_column", "code_type_column", "codelist_column"}
    if not all(key in column_mapping for key in required_keys):
        raise HTTPException(
            status_code=400, 
            detail=f"column_mapping must contain all keys: {required_keys}"
        )
    
    try:
        # First get the codelist data to extract unique codelist names
        codelist = await db_manager.get_codelist(user_id, file_id)
        if not codelist:
            raise HTTPException(
                status_code=404,
                detail=f"Codelist file {file_id} not found for user {user_id}"
            )
        
        # Parse codelist_data if needed
        codelist_data = codelist.get("codelist_data", {})
        if isinstance(codelist_data, str):
            import json
            codelist_data = json.loads(codelist_data)
        
        # Extract unique codelist names from the specified column
        codelist_column = column_mapping["codelist_column"]
        contents = codelist_data.get("contents", {})
        data = contents.get("data", {})
        
        codelists_array = []
        if codelist_column in data:
            # Get unique codelist names
            codelists_array = list(set(data[codelist_column]))
        
        # Update both column mapping and codelists array
        success = await db_manager.update_codelist(
            user_id, file_id, column_mapping=column_mapping, codelists=codelists_array
        )
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Failed to update codelist file {file_id}"
            )
        
        logger.info(f"Updated column mapping and codelists array for codelist {file_id} for user {user_id}")
        return {
            "status": "success",
            "message": f"Column mapping updated for codelist file {file_id}",
            "codelists": codelists_array
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update column mapping for codelist {file_id}: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to update column mapping"
        )


# -- CODELIST FILE MANAGEMENT --
async def get_codelist_filenames_for_cohort(db_manager, cohort_id: str) -> list:
    """
    Get a list of codelist filenames for a given cohort ID using database.
    Includes cached codelists array and column mapping to avoid loading full data.
    
    Args:
        db_manager: DatabaseManager instance for database interactions
        cohort_id (str): The ID of the cohort.
        
    Returns:
        list: A list of codelist metadata including id, filename, codelists array, and column mapping.
    """
    try:
        codelists = await db_manager.get_codelists_for_cohort(cohort_id)
        return [{
            "id": cl["id"], 
            "filename": cl["filename"],
            "codelists": cl.get("codelists", []),
            "code_column": cl.get("code_column"),
            "code_type_column": cl.get("code_type_column"),
            "codelist_column": cl.get("codelist_column")
        } for cl in codelists]
    except Exception as e:
        logger.error(f"Failed to retrieve codelist filenames for cohort {cohort_id}: {e}")
        return []


async def get_codelist_file_for_cohort(db_manager, cohort_id: str, file_id: str, user_id: str) -> Optional[dict]:
    """
    Get a codelist file for a given cohort ID and file ID from database.
    
    Args:
        db_manager: DatabaseManager instance for database interactions
        cohort_id (str): The ID of the cohort.
        file_id (str): The ID of the codelist file.
        user_id (str): The ID of the authenticated user.
        
    Returns:
        dict: The codelist file or None if not found.
    """
    try:
        # Get codelist using the user_id and file_id
        codelist = await db_manager.get_codelist(user_id, file_id)
        
        if not codelist:
            return None        
        # Parse JSON strings if they are strings (database returns JSONB as strings sometimes)
        codelist_data = codelist.get("codelist_data", {})
        if isinstance(codelist_data, str):
            import json
            codelist_data = json.loads(codelist_data)
            
        column_mapping = codelist.get("column_mapping", {})
        if isinstance(column_mapping, str):
            import json
            column_mapping = json.loads(column_mapping)
        
        # Create the reconstructed file structure
        reconstructed_file = {
            "id": file_id,
            "filename": codelist_data.get("filename", ""),
            "code_column": column_mapping.get("code_column", ""),
            "code_type_column": column_mapping.get("code_type_column", ""),
            "codelist_column": column_mapping.get("codelist_column", ""),
            "contents": codelist_data.get("contents", {}),
            "codelists": codelist.get("codelists", []),
            "version": codelist.get("version"),
            "created_at": codelist.get("created_at"),
            "updated_at": codelist.get("updated_at")
        }
        
        return reconstructed_file
        
    except Exception as e:
        logger.error(f"Failed to retrieve codelist file {file_id} for cohort {cohort_id}: {e}")
        return None


async def save_codelist_file_for_cohort(db_manager, cohort_id: str, file_id: str, codelist_file: dict, user_id: str) -> bool:
    """
    Save a codelist file for a given cohort ID and file ID to database.
    Also calculates and stores the codelists array based on codelist_column.
    
    Args:
        db_manager: DatabaseManager instance for database interactions
        cohort_id (str): The ID of the cohort.
        file_id (str): The ID of the codelist file.
        codelist_file (dict): The codelist file data.
        user_id (str): The ID of the authenticated user.
        
    Returns:
        bool: True if successful, False otherwise.
    """

    try:
        # Extract needed data
        column_mapping = codelist_file.get("column_mapping", {})
        codelist_data = codelist_file.get("codelist_data", codelist_file)
        
        # Extract filename from the codelist data
        file_name = codelist_data.get("filename") or codelist_data.get("name") or file_id
        
        # Calculate codelists array from the data
        codelists_array = []
        codelist_column = column_mapping.get("codelist_column")
        if codelist_column:
            contents = codelist_data.get("contents", {})
            data = contents.get("data", {})
            if codelist_column in data:
                # Get unique codelist names
                codelists_array = list(set(data[codelist_column]))
        
        logger.info(f"save_codelist_file_for_cohort: calculated {len(codelists_array)} unique codelists for file {file_name}")
        
        # Save codelist to database with filename
        return await db_manager.save_codelist(
            user_id, file_id, codelist_data, column_mapping, codelists_array, cohort_id, file_name
        )
    except Exception as e:
        logger.error(f"Failed to save codelist file {file_id} for cohort {cohort_id}: {e}")
        return False


async def delete_codelist_file_for_cohort(db_manager, cohort_id: str, file_id: str) -> bool:
    """
    Delete a codelist file for a given cohort ID and file ID from database.
    
    Args:
        db_manager: DatabaseManager instance for database interactions
        cohort_id (str): The ID of the cohort.
        file_id (str): The ID of the codelist file.
        
    Returns:
        bool: True if successful, False otherwise.
    """
    try:
        # Get cohort to determine user_id
        cohort = await db_manager.get_cohort_for_user(None, cohort_id)
        if not cohort or not cohort.get("cohort_data", {}).get("user_id"):
            logger.error(f"Could not find user_id for cohort {cohort_id}")
            return False
        
        user_id = cohort["cohort_data"]["user_id"]
        
        # Delete codelist from database
        return await db_manager.delete_codelist(user_id, file_id)
    except Exception as e:
        logger.error(f"Failed to delete codelist file {file_id} for cohort {cohort_id}: {e}")
        return False

# -- EXECUTION CODELIST MANAGEMENT --
# TODO import to codelist_file_management.py


def resolve_phenexui_codelist_file(phenexui_codelist, user_id):
    """
    Resolves a phenexui codelist file to a codelist object dict representation. PhenEx UI codelists of file type do not contain actual codes, rather only the name of the codelist file, a mapping of codelist columns, and the name of codelist to extract.
    Args:
        phenexui_codelist: The phenexui codelist representation.
        user_id (str): The authenticated user ID.
    Returns:
        dict: The resolved PhenEx Codelist object dict representation with codes and code_type.
    """
    # For execution time, create a sync wrapper around the async function
    import asyncio
    
    # Handle both old format (top-level keys) and new format (nested in codelist object)
    # New format: {"class_name": "Codelist", "codelist": {"file_id": "...", "file_name": "...", "codelist_name": "..."}, "codelist_type": "from file"}
    # Old format: {"file_id": "...", "codelist_name": "...", "codelist_type": "from_file", ...}
    codelist_obj = phenexui_codelist.get("codelist", {})
    file_id = codelist_obj.get("file_id") or phenexui_codelist.get("codelist_id") or phenexui_codelist.get("file_id", "Unknown")
    cohort_id = phenexui_codelist.get("cohort_id", "Unknown")
    codelist_name = codelist_obj.get("codelist_name") or phenexui_codelist.get("codelist_name", "Unknown")
    
    print(f"📄 INSIDE resolve_phenexui_codelist_file - Resolving codelist file '{file_id}' for codelist '{codelist_name}' in cohort '{cohort_id}' for user {user_id}")
    logger.info(f"📄 Resolving codelist file '{file_id}' for codelist '{codelist_name}' in cohort '{cohort_id}'")
    
    async def _resolve_codelist_file():
        if not user_id:
            raise ValueError(f"user_id is required for codelist resolution")
        
        print(f"📄 INSIDE _resolve_codelist_file - Fetching codelist file '{file_id}' for user '{user_id}'")
        logger.info(f"📄 Fetching codelist file '{file_id}' for user '{user_id}'")
        # Get the codelist file (handle both old and new formats)
        codelist_obj = phenexui_codelist.get("codelist", {})
        actual_file_id = codelist_obj.get("file_id") or phenexui_codelist.get("codelist_id") or phenexui_codelist.get("file_id")
        actual_cohort_id = phenexui_codelist.get("cohort_id")
        if not actual_file_id or not actual_cohort_id:
            raise ValueError(f"Missing required file_id or cohort_id in codelist: {phenexui_codelist}")
        codelist_file = await get_codelist_file_for_cohort(
            db_manager, actual_cohort_id, actual_file_id, user_id
        )
        
        if codelist_file:
            print(f"📄 INSIDE _resolve_codelist_file - Successfully retrieved codelist file '{file_id}': {codelist_file.get('filename', 'No filename')}")
            logger.info(f"📄 Successfully retrieved codelist file '{file_id}': {codelist_file.get('filename', 'No filename')}")
        else:
            print(f"📄 INSIDE _resolve_codelist_file - Failed to retrieve codelist file '{file_id}'")
            logger.error(f"📄 Failed to retrieve codelist file '{file_id}'")
            
        return codelist_file
    
    try:
        # Try to get the current event loop, if it doesn't exist create a new one
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            # No event loop in current thread, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        codelist_file = loop.run_until_complete(_resolve_codelist_file())
        
        if not codelist_file:
            raise ValueError(f"Codelist file {phenexui_codelist['file_id']} not found")
            
    except Exception as e:
        logger.error(f"Failed to resolve codelist file during execution: {e}")
        raise ValueError(f"Could not resolve codelist file {phenexui_codelist['file_id']} for execution")

    # variables phenexui codelist components (for ease of reading...)
    # Handle both old format (top-level) and new format (nested in codelist object)
    codelist_obj = phenexui_codelist.get("codelist", {})
    code_column = codelist_obj.get("code_column") or phenexui_codelist.get("code_column", "code")
    code_type_column = codelist_obj.get("code_type_column") or phenexui_codelist.get("code_type_column", "code_type")
    codelist_column = codelist_obj.get("codelist_column") or phenexui_codelist.get("codelist_column", "codelist")
    data = codelist_file["contents"]["data"]
    
    print(f"📄 INSIDE resolve_phenexui_codelist_file - File data structure - columns: {list(data.keys())}")
    print(f"📄 INSIDE resolve_phenexui_codelist_file - Looking for codes in column '{code_column}', code_types in '{code_type_column}', codelist names in '{codelist_column}'")
    print(f"📄 INSIDE resolve_phenexui_codelist_file - Total rows in file: {len(data.get(code_column, []))}")
    print(f"📄 INSIDE resolve_phenexui_codelist_file - Target codelist name: '{codelist_name}'")
    logger.info(f"📄 File data structure - columns: {list(data.keys())}")
    logger.info(f"📄 Looking for codes in column '{code_column}', code_types in '{code_type_column}', codelist names in '{codelist_column}'")
    logger.info(f"📄 Total rows in file: {len(data.get(code_column, []))}")
    logger.info(f"📄 Target codelist name: '{codelist_name}'")
    
    # Check if the required columns exist
    if code_column not in data:
        logger.error(f"📄 Code column '{code_column}' not found in file data")
        raise ValueError(f"Code column '{code_column}' not found in file")
    if code_type_column not in data:
        logger.error(f"📄 Code type column '{code_type_column}' not found in file data")
        raise ValueError(f"Code type column '{code_type_column}' not found in file")
    if codelist_column not in data:
        logger.error(f"📄 Codelist column '{codelist_column}' not found in file data")
        raise ValueError(f"Codelist column '{codelist_column}' not found in file")
    
    # Check what codelist names are available
    unique_codelists = set(data[codelist_column])
    print(f"📄 INSIDE resolve_phenexui_codelist_file - Available codelist names in file: {sorted(unique_codelists)}")
    logger.info(f"📄 Available codelist names in file: {sorted(unique_codelists)}")
    
    if codelist_name not in unique_codelists:
        print(f"📄 INSIDE resolve_phenexui_codelist_file - WARNING: Target codelist '{codelist_name}' not found in available codelists: {sorted(unique_codelists)}")
        logger.warning(f"📄 Target codelist '{codelist_name}' not found in available codelists: {sorted(unique_codelists)}")
    else:
        print(f"📄 INSIDE resolve_phenexui_codelist_file - Target codelist '{codelist_name}' found in file")
        logger.info(f"📄 Target codelist '{codelist_name}' found in file")

    # data are three parallel lists of code, code_type, codelist_name
    # get all codes/code_type for codelist_name
    codes_and_code_type = [
        [code, code_type]
        for code, code_type, codelist in zip(
            data[code_column], data[code_type_column], data[codelist_column]
        )
        if codelist == phenexui_codelist["codelist_name"]
    ]
    
    print(f"📄 INSIDE resolve_phenexui_codelist_file - Found {len(codes_and_code_type)} matching codes for codelist '{codelist_name}'")
    logger.info(f"📄 Found {len(codes_and_code_type)} matching codes for codelist '{codelist_name}'")

    # convert into phenex codelist representation {code_type:[codes...]}
    phenex_codelist = {}
    for [code, code_type] in codes_and_code_type:
        if code_type not in phenex_codelist.keys():
            phenex_codelist[code_type] = []
        phenex_codelist[code_type].append(code)
    
    # Log summary of code types and counts (but don't print the actual codes)
    for code_type, codes in phenex_codelist.items():
        print(f"📄 INSIDE resolve_phenexui_codelist_file - Code type '{code_type}': {len(codes)} codes")
        logger.info(f"📄 Code type '{code_type}': {len(codes)} codes")

    print(f"📄 INSIDE resolve_phenexui_codelist_file - Successfully resolved codelist '{codelist_name}' with {sum(len(codes) for codes in phenex_codelist.values())} total codes across {len(phenex_codelist)} code types")
    logger.info(f"📄 Successfully resolved codelist '{codelist_name}' with {sum(len(codes) for codes in phenex_codelist.values())} total codes across {len(phenex_codelist)} code types")

    # return phenex Codelist representation
    return {
        "class_name": "Codelist",
        "name": phenexui_codelist["codelist_name"],
        "codelist": phenex_codelist,
        "use_code_type": False,
    }


def resolve_medconb_codelist(phenexui_codelist):
    """
    Get Codelists from MedConB codelist files
    """
    return phenexui_codelist


def prepare_codelist_for_phenex(phenexui_codelist, user_id):
    """
    Prepares a single codelist from PhenEx UI for PhenEx execution by resolving codelists if necessary.
    Args:
        phenexui_codelist: A dictionary representing a codelist in the PhenEx UI.
        user_id (str): The authenticated user ID.
    Returns:
        A dictionary representing PhenEx codelist with codes resolved
    """
    codelist_type = phenexui_codelist.get("codelist_type")
    codelist_name = phenexui_codelist.get("name", "Unknown")
    print(f"📋 INSIDE prepare_codelist_for_phenex - Preparing codelist '{codelist_name}' of type: {codelist_type} for user {user_id}")
    logger.info(f"📋 Preparing codelist '{codelist_name}' of type: {codelist_type}")
    
    if codelist_type is None:
        print(f"📋 INSIDE prepare_codelist_for_phenex - Codelist '{codelist_name}' has no type, returning as-is")
        logger.info(f"📋 Codelist '{codelist_name}' has no type, returning as-is")
        return phenexui_codelist
    if codelist_type == "manual":
        codes_count = len(phenexui_codelist.get("codelist", {}).get("codes", []))
        print(f"📋 INSIDE prepare_codelist_for_phenex - Manual codelist '{codelist_name}' has {codes_count} codes")
        logger.info(f"📋 Manual codelist '{codelist_name}' has {codes_count} codes")
        return phenexui_codelist
    elif codelist_type == "from file" or codelist_type == "from_file":
        print(f"📋 INSIDE prepare_codelist_for_phenex - Resolving file-based codelist '{codelist_name}' for user {user_id}")
        logger.info(f"📋 Resolving file-based codelist '{codelist_name}' for user {user_id}")
        resolved = resolve_phenexui_codelist_file(phenexui_codelist, user_id)
        codes_count = sum(len(codes) for codes in resolved.get("codelist", {}).values())
        print(f"📋 INSIDE prepare_codelist_for_phenex - File-based codelist '{codelist_name}' resolved with {codes_count} codes")
        logger.info(f"📋 File-based codelist '{codelist_name}' resolved with {codes_count} codes")
        logger.info(f"📋 File-based codelist '{codelist_name}' resolved with {codes_count} total codes")
        return resolved
    elif codelist_type == "from medconb":
        print(f"📋 INSIDE prepare_codelist_for_phenex - Using MedConB codelist '{codelist_name}'")
        logger.info(f"📋 Using MedConB codelist '{codelist_name}'")
        return resolve_medconb_codelist(phenexui_codelist)
    
    print(f"📋 INSIDE prepare_codelist_for_phenex - ERROR: Unknown codelist class: {phenexui_codelist['class_name']}")
    raise ValueError(f"Unknown codelist class: {phenexui_codelist['class_name']}")


def prepare_phenotypes_for_phenex(phenotypes: list[dict], user_id):
    """
    Iterates over a list of phenotypes and prepares the codelist of each one for phenex.

    Args:
        phenotypes : List of phenotypes from PhenEx UI with codelists of various types
        user_id (str): The authenticated user ID.
    Returns:
        List of phenotypes with codelists prepared for phenex
    """
    print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Preparing {len(phenotypes)} phenotypes for user {user_id}")
    logger.info(f"🧬 Preparing {len(phenotypes)} phenotypes for user {user_id}")
    
    # iterate over each phenotype
    for i, phenotype in enumerate(phenotypes):
        phenotype_name = phenotype.get("name", f"Phenotype_{i}")
        phenotype_class = phenotype.get("class_name", "Unknown")
        print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Processing phenotype '{phenotype_name}' ({phenotype_class})")
        logger.info(f"🧬 Processing phenotype '{phenotype_name}' ({phenotype_class})")
        
        # if it contains a codelist, prepare it for phenex
        if phenotype["class_name"] in ["CodelistPhenotype", "MeasurementPhenotype"]:
            print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' has codelist, preparing...")
            phenotype = prepare_codelists_for_phenotype(phenotype, user_id)
            print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' codelist preparation completed")
        elif phenotype["class_name"] == "TimeRangePhenotype":
            print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' is TimeRangePhenotype, preparing...")
            phenotype = prepare_time_range_phenotype(phenotype)
            print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' TimeRange preparation completed")
        elif phenotype["class_name"] == "LogicPhenotype":
            print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' is LogicPhenotype, preparing expression...")
            phenotype = prepare_logic_phenotype_expression(phenotype, user_id)
            print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' LogicPhenotype preparation completed")
        else:
            print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' requires no preparation")
            
    print(f"🧬 INSIDE prepare_phenotypes_for_phenex - Completed preparing {len(phenotypes)} phenotypes")
    logger.info(f"🧬 Completed preparing {len(phenotypes)} phenotypes")
    return phenotypes


def prepare_codelists_for_phenotype(phenotype: dict, user_id):
    """
    Iterates over a list of phenotypes and prepares the codelist of each one for phenex.

    Args:
        phenotype: A phenotype from PhenEx UI with codelists of various types
        user_id (str): The authenticated user ID.
    Returns:
        Phenotype with codelists prepared for phenex
    """
    phenotype_name = phenotype.get("name", "Unknown")
    print(f"📋 INSIDE prepare_codelists_for_phenotype - Preparing codelists for phenotype '{phenotype_name}' with user {user_id}")
    logger.info(f"Preparing codelists for phenotype '{phenotype_name}'")
    # if it is a list, create a composite codelist
    if isinstance(phenotype["codelist"], list):
        print(f"🧬 INSIDE prepare_codelists_for_phenotype - Phenotype '{phenotype_name}' has {len(phenotype['codelist'])} codelists to prepare")
        logger.info(f"🧬 Phenotype '{phenotype_name}' has {len(phenotype['codelist'])} codelists to prepare")
        codelist = [prepare_codelist_for_phenex(x, user_id) for x in phenotype["codelist"]]
        composite_codelist = {
            "class_name": "CompositeCodelist",
            "codelists": codelist,
        }
        phenotype["codelist"] = composite_codelist
        print(f"🧬 INSIDE prepare_codelists_for_phenotype - Created CompositeCodelist for phenotype '{phenotype_name}'")
        logger.info(f"🧬 Created CompositeCodelist for phenotype '{phenotype_name}'")
    else:
        print(f"🧬 INSIDE prepare_codelists_for_phenotype - Phenotype '{phenotype_name}' has single codelist to prepare")
        logger.info(f"🧬 Phenotype '{phenotype_name}' has single codelist to prepare")
        phenotype["codelist"] = prepare_codelist_for_phenex(phenotype["codelist"], user_id)
        print(f"🧬 INSIDE prepare_codelists_for_phenotype - Single codelist prepared for phenotype '{phenotype_name}'")
    
    print(f"🧬 INSIDE prepare_codelists_for_phenotype - COMPLETED phenotype '{phenotype_name}' codelist preparation")
    return phenotype


def prepare_time_range_phenotype(phenotype: dict):
    if (
        "relative_time_range" in phenotype.keys()
        and phenotype["relative_time_range"] is not None
    ):
        if isinstance(phenotype["relative_time_range"], list):
            phenotype["relative_time_range"] = phenotype["relative_time_range"][0]
    return phenotype


def prepare_logic_phenotype_expression(phenotype: dict, user_id: str):
    """
    Prepares a LogicPhenotype by recursively processing its ComputationGraph expression.
    The frontend already sends the correct ComputationGraph structure, so we just need
    to recursively prepare any nested phenotypes (codelists, etc.).
    
    Args:
        phenotype: The LogicPhenotype dictionary with ComputationGraph expression
        user_id: The authenticated user ID
        
    Returns:
        The phenotype with all nested phenotypes prepared
    """
    if phenotype.get("class_name") != "LogicPhenotype":
        return phenotype
    
    expression = phenotype.get("expression")
    if not expression:
        logger.warning(f"LogicPhenotype '{phenotype.get('name')}' missing expression")
        return phenotype
    
    print(f"🧬 Recursively preparing ComputationGraph expression for '{phenotype.get('name')}'")
    logger.info(f"🧬 Recursively preparing ComputationGraph expression for '{phenotype.get('name')}'")
    
    # Recursively prepare the expression tree
    phenotype["expression"] = prepare_computation_graph_node(expression, user_id)
    
    return phenotype


def prepare_computation_graph_node(node: dict, user_id: str):
    """
    Recursively processes a ComputationGraph node and prepares nested phenotypes.
    
    Args:
        node: A node in the ComputationGraph (either a ComputationGraph or a phenotype)
        user_id: The authenticated user ID
        
    Returns:
        The prepared node
    """
    if node.get("class_name") == "ComputationGraph":
        # This is a binary operator node - recursively process left and right
        print(f"🧬 Processing ComputationGraph node with operator '{node.get('operator')}'")
        
        node["left"] = prepare_computation_graph_node(node["left"], user_id)
        node["right"] = prepare_computation_graph_node(node["right"], user_id)
        
        return node
    else:
        # This is a leaf node (an actual phenotype) - prepare it
        phenotype_class = node.get("class_name", "Unknown")
        phenotype_name = node.get("name", "Unknown")
        
        print(f"🧬 Preparing leaf phenotype '{phenotype_name}' ({phenotype_class})")
        
        if phenotype_class in ["CodelistPhenotype", "MeasurementPhenotype"]:
            node = prepare_codelists_for_phenotype(node, user_id)
        elif phenotype_class == "TimeRangePhenotype":
            node = prepare_time_range_phenotype(node)
        elif phenotype_class == "LogicPhenotype":
            # Nested LogicPhenotype - recursively prepare it
            node = prepare_logic_phenotype_expression(node, user_id)
        
        return node


def prepare_cohort_for_phenex(phenexui_cohort: dict, user_id):
    """
    Codelists in the UI are of three types : manual, from file, from medconb. Additionally, a single phenotype can receive a list of codelists, each of various types (manual, file, medconb). Prior to PhenEx execution, we resolve each codelist individually i.e. getting codes from the csv file or pulling them from medconb. Then, if a list of codelists is passed, we combine them into a single codelist and store original references in a CompositeCodelist class.

    Args:
        phenexui_cohort : The cohort dictionary representation generated by PhenExUI.
        user_id (str): The authenticated user ID.
    Returns:
        phenex_cohort : The cohort dictionary representation with codelists ready for PhenEx execution
    """
    import copy

    cohort_name = phenexui_cohort.get("name", "Unknown")
    print(f"🏥 INSIDE prepare_cohort_for_phenex - Starting cohort preparation for '{cohort_name}' (user: {user_id})")
    logger.info(f"🏥 Starting cohort preparation for '{cohort_name}' (user: {user_id})")

    phenex_cohort = copy.deepcopy(phenexui_cohort)
    
    logger.info(f"🏥 Preparing entry criterion for cohort '{cohort_name}'")
    phenex_cohort["entry_criterion"] = prepare_phenotypes_for_phenex(
        [phenex_cohort["entry_criterion"]], user_id
    )[0]
    
    if "inclusions" in phenex_cohort.keys():
        logger.info(f"🏥 Preparing {len(phenex_cohort['inclusions'])} inclusions for cohort '{cohort_name}'")
        phenex_cohort["inclusions"] = prepare_phenotypes_for_phenex(
            phenex_cohort["inclusions"], user_id
        )
    if "exclusions" in phenex_cohort.keys():
        logger.info(f"🏥 Preparing {len(phenex_cohort['exclusions'])} exclusions for cohort '{cohort_name}'")
        phenex_cohort["exclusions"] = prepare_phenotypes_for_phenex(
            phenex_cohort["exclusions"], user_id
        )
    if "characteristics" in phenex_cohort.keys():
        logger.info(f"🏥 Preparing {len(phenex_cohort['characteristics'])} characteristics for cohort '{cohort_name}'")
        phenex_cohort["characteristics"] = prepare_phenotypes_for_phenex(
            phenex_cohort["characteristics"], user_id
        )
    if "outcomes" in phenex_cohort.keys():
        logger.info(f"🏥 Preparing {len(phenex_cohort['outcomes'])} outcomes for cohort '{cohort_name}'")
        phenex_cohort["outcomes"] = prepare_phenotypes_for_phenex(
            phenex_cohort["outcomes"], user_id
        )
    if "phenotypes" in phenex_cohort.keys():
        logger.info(f"🏥 Preparing {len(phenex_cohort['phenotypes'])} phenotypes for cohort '{cohort_name}'")
        phenex_cohort["phenotypes"] = prepare_phenotypes_for_phenex(
            phenex_cohort["phenotypes"], user_id
        )
    
    logger.info(f"🏥 Completed cohort preparation for '{cohort_name}'")
    return phenex_cohort


class LoginData(BaseModel):
    email: str
    password: str
    username: str | None


@app.post("/register")
async def register(request: Request, user_data: LoginData):
    """
    Registers a new User.
    """

    if not config["auth"]["password"].exists():
        raise ValueError("Registration is deactivated")
    if not (
        config["auth"]["password"]["secret"].exists()
        and config["auth"]["password"]["secret"].get(str)
    ):
        raise ValueError("Registration is deactivated")

    if not user_data.email or not user_data.password:
        return {"error": "Email and password are required."}, 400

    session: "Session" = request["db_session"]

    if (
        not user_data.email
        or db.get_user_by_email(session, user_data.email) is not None
    ):
        raise ValueError("Registration failed.")

    ph = PasswordHasher()
    hashed_pw = ph.hash(user_data.password)

    user = User(
        id=new_userid(),
        email=user_data.email,
        password_hash=hashed_pw,
        external_id="password",
        name=user_data.username,
    )

    session.add(user)
    session.commit()

    return {
        "status": "success",
        "message": f"User {user.id} registered successfully.",
    }


class LoginData(BaseModel):
    email: str
    password: str


@app.post("/login")
async def login(request: Request, login_data: LoginData):
    """
    Verifies the log in credentials and returns a new auth token.
    """

    if not config["auth"]["password"].exists():
        raise ValueError("Password based Login is deactivated.")
    if not (
        config["auth"]["password"]["secret"].exists()
        and config["auth"]["password"]["secret"].get(str)
    ):
        raise ValueError("Password based Login is deactivated")

    session: "Session" = request["db_session"]

    user = db.get_user_by_email(session, login_data.email)
    if not (user and user.password_hash):
        raise ValueError("Login failed.")

    ph = PasswordHasher()
    print(ph.hash("12345678"))
    try:
        ph.verify(user.password_hash, login_data.password)
    except Exception:
        raise ValueError("Login failed.")

    if ph.check_needs_rehash(user.password_hash):
        user.password_hash = ph.hash(login_data.password)

    secret = config["auth"]["password"]["secret"].get(str)
    payload = {
        "sub": str(user.id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "name": user.name,
        "email": user.email,
    }
    token = jwt.encode(payload, secret, algorithm="HS256")

    return {"auth_token": token}
