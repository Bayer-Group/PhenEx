from typing import Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import BaseModel
import logging
import os
import json
import uuid

# Create router for study endpoints
router = APIRouter()

# Setup logger
logger = logging.getLogger(__name__)

# Import database manager and authentication utilities
from ..database import db_manager
from ..utils.auth import get_authenticated_user_id


# -- PYDANTIC MODELS --


class StudyMetadata(BaseModel):
    """Metadata for a study."""

    id: str
    name: str
    description: str = ""
    is_public: bool = False
    display_order: int = 0


class StatusResponse(BaseModel):
    """Standard status response."""

    status: str
    message: str


# -- STUDY API ENDPOINTS --


# Study resources
@router.get("/studies/private", tags=["study"])
async def get_all_studies_for_user(request: Request):
    """
    Get a list of all studies owned by the authenticated user.

    Authentication:
    - Requires authenticated user. Returns only studies owned by the authenticated user.

    Returns:
    - list[dict]: A list of study objects, each containing:
        - id (str): Unique identifier for the study
        - name (str): Name of the study
        - description (str): Description of the study
        - is_public (bool): Whether the study is publicly accessible
        - display_order (int): Display order for UI sorting
        - baseline_characteristics (dict): Baseline characteristics configuration
        - outcomes (dict): Outcomes configuration
        - analysis (dict): Analysis configuration
        - visible_by (list[str]): List of user IDs with access
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    [
        {
            "id": "study_123",
            "name": "Diabetes Study",
            "description": "A study of type 2 diabetes patients",
            "is_public": false,
            "display_order": 0,
            "baseline_characteristics": {},
            "outcomes": {},
            "analysis": {},
            "visible_by": [],
            "created_at": "2025-12-09T10:00:00Z",
            "updated_at": "2025-12-09T10:00:00Z"
        }
    ]
    ```

    Raises:
    - 401: If user is not authenticated
    - 500: If there's an error retrieving studies from the database
    """
    user_id = get_authenticated_user_id(request)
    try:
        return await db_manager.get_all_studies_for_user(user_id)
    except Exception as e:
        logger.error(f"Failed to retrieve studies for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve studies.")


@router.get("/studies/public", tags=["study"])
async def get_all_public_studies():
    """
    Get a list of all publicly accessible studies.

    Authentication:
    - No authentication required. Returns all studies with is_public=True.

    Returns:
    - list[dict]: A list of public study objects, each containing:
        - id (str): Unique identifier for the study
        - name (str): Name of the study
        - description (str): Description of the study
        - is_public (bool): Always true for this endpoint
        - display_order (int): Display order for UI sorting
        - baseline_characteristics (dict): Baseline characteristics configuration
        - outcomes (dict): Outcomes configuration
        - analysis (dict): Analysis configuration
        - visible_by (list[str]): List of user IDs with access
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    [
        {
            "id": "study_public_1",
            "name": "Public COVID-19 Study",
            "description": "Publicly accessible COVID-19 research study",
            "is_public": true,
            "display_order": 0,
            "baseline_characteristics": {},
            "outcomes": {},
            "analysis": {},
            "visible_by": [],
            "created_at": "2025-12-09T10:00:00Z",
            "updated_at": "2025-12-09T10:00:00Z"
        }
    ]
    ```

    Raises:
    - 500: If there's an error retrieving public studies from the database
    """
    try:
        # Get all studies where is_public=True, regardless of owner
        studies = await db_manager.get_all_public_studies()
        return studies
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve public studies: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve public studies."
        )


@router.get("/study/{study_id}", tags=["study"])
async def get_study_for_user(request: Request, study_id: str):
    """
    Get a specific study by ID for the authenticated user.

    Path Parameters:
    - study_id (str): The unique identifier of the study to retrieve

    Authentication:
    - Requires authenticated user. Only returns studies owned by the authenticated user.

    Returns:
    - dict: Complete study object containing:
        - id (str): Unique identifier for the study
        - name (str): Name of the study
        - description (str): Description of the study
        - is_public (bool): Whether the study is publicly accessible
        - display_order (int): Display order for UI sorting
        - baseline_characteristics (dict): Baseline characteristics configuration
        - outcomes (dict): Outcomes configuration
        - analysis (dict): Analysis configuration
        - visible_by (list[str]): List of user IDs with access
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    {
        "id": "study_123",
        "name": "Diabetes Study",
        "description": "A study of type 2 diabetes patients",
        "is_public": false,
        "display_order": 0,
        "baseline_characteristics": {
            "age": {"type": "continuous"},
            "gender": {"type": "categorical"}
        },
        "outcomes": {
            "mortality": {"type": "time_to_event"}
        },
        "analysis": {
            "method": "cox_regression"
        },
        "visible_by": [],
        "created_at": "2025-12-09T10:00:00Z",
        "updated_at": "2025-12-09T10:00:00Z"
    }
    ```

    Raises:
    - 401: If user is not authenticated
    - 404: If study is not found or user doesn't have access
    - 500: If there's an error retrieving the study from the database
    """
    user_id = get_authenticated_user_id(request)
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


@router.get("/study/{study_id}/public", tags=["study"])
async def get_public_study(study_id: str):
    """
    Get a specific public study by ID.

    Path Parameters:
    - study_id (str): The unique identifier of the public study to retrieve

    Authentication:
    - No authentication required. Only returns studies with is_public=True.

    Returns:
    - dict: Complete public study object containing:
        - id (str): Unique identifier for the study
        - name (str): Name of the study
        - description (str): Description of the study
        - is_public (bool): Always true for this endpoint
        - display_order (int): Display order for UI sorting
        - baseline_characteristics (dict): Baseline characteristics configuration
        - outcomes (dict): Outcomes configuration
        - analysis (dict): Analysis configuration
        - visible_by (list[str]): List of user IDs with access
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    {
        "id": "study_public_1",
        "name": "Public COVID-19 Study",
        "description": "Publicly accessible COVID-19 research study",
        "is_public": true,
        "display_order": 0,
        "baseline_characteristics": {},
        "outcomes": {},
        "analysis": {},
        "visible_by": [],
        "created_at": "2025-12-09T10:00:00Z",
        "updated_at": "2025-12-09T10:00:00Z"
    }
    ```

    Raises:
    - 404: If public study is not found or study is not marked as public
    - 500: If PUBLIC_USER_ID environment variable is not set or database error occurs
    """
    try:
        public_user_id = os.getenv("PUBLIC_USER_ID")
        if not public_user_id:
            raise HTTPException(
                status_code=500, detail="PUBLIC_USER_ID environment variable not set."
            )

        study = await db_manager.get_study_for_user(public_user_id, study_id)
        if not study or not study.get("is_public", False):
            raise HTTPException(status_code=404, detail="Public study not found")
        return study
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving public study {study_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve public study")


@router.put("/study/{study_id}", tags=["study"], response_model=Dict)
async def create_or_update_study(
    request: Request,
    study_id: str,
    study: Dict = Body(...),
):
    """
    Create a new study or update an existing study (idempotent operation).

    Path Parameters:
    - study_id (str): The unique identifier of the study. Use "new" to create a new study.

    Authentication:
    - Requires authenticated user. Creates/updates studies for the authenticated user.

    Request Body:
    - study (dict): The complete study data containing:
        - name (str): Name of the study (required for new studies, defaults to "New Study")
        - description (str, optional): Description of the study
        - is_public (bool, optional): Whether the study should be publicly accessible (default: false)
        - display_order (int, optional): Display order for UI sorting (default: 0)
        - baseline_characteristics (dict, optional): Configuration for baseline characteristics
        - outcomes (dict, optional): Configuration for outcomes
        - analysis (dict, optional): Configuration for analysis methods
        - visible_by (list[str], optional): List of user IDs with access

    Example Request Body (Create):
    ```json
    {
        "name": "New Diabetes Study",
        "description": "Study of type 2 diabetes treatment outcomes",
        "is_public": false,
        "baseline_characteristics": {
            "age": {"type": "continuous"},
            "gender": {"type": "categorical"}
        },
        "outcomes": {
            "mortality": {"type": "time_to_event"}
        },
        "analysis": {
            "method": "cox_regression"
        }
    }
    ```

    Example Request Body (Update):
    ```json
    {
        "name": "Updated Study Name",
        "description": "Updated description",
        "is_public": true
    }
    ```

    Returns:
    - dict: The created/updated study object with all fields

    Raises:
    - 401: If user is not authenticated
    - 500: If there's an error creating or updating the study in the database
    """
    user_id = get_authenticated_user_id(request)
    
    # If study_id is "new", use the ID from the request body or generate one
    if study_id == "new":
        # Check if the frontend provided an ID in the body
        actual_study_id = study.get("id")
        if actual_study_id:
            logger.info(f"Creating new study with frontend-provided ID: {actual_study_id}")
        else:
            # Fallback: generate a UUID if no ID provided
            actual_study_id = str(uuid.uuid4())
            logger.info(f"Creating new study with generated UUID: {actual_study_id}")
    else:
        actual_study_id = study_id

    try:
        success = await db_manager.update_study_for_user(
            user_id=user_id,
            study_id=actual_study_id,
            name=study.get("name", "New Study"),
            description=study.get("description", ""),
            baseline_characteristics=study.get("baseline_characteristics", {}),
            outcomes=study.get("outcomes", {}),
            database=study.get("database"),
            visible_by=study.get("visible_by", []),
            is_public=study.get("is_public", False),
        )

        if success:
            # Return the study data with the correct ID
            result = dict(study)
            result["id"] = actual_study_id
            return result
        else:
            raise HTTPException(
                status_code=500, detail="Failed to create/update study."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create/update study for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create/update study.")


@router.delete("/study/{study_id}", tags=["study"], response_model=StatusResponse)
async def delete_study_for_user(request: Request, study_id: str):
    """
    Delete a study and all associated cohorts.

    Path Parameters:
    - study_id (str): The unique identifier of the study to delete

    Authentication:
    - Requires authenticated user. Only allows deletion of studies owned by the authenticated user.

    Behavior:
    - Deletes the study with the specified ID
    - Cascades deletion to all cohorts associated with the study
    - This operation is permanent and cannot be undone

    Returns:
    - StatusResponse: Status object containing:
        - status (str): "success" if deletion completed
        - message (str): Confirmation message with study ID

    Example Response:
    ```json
    {
        "status": "success",
        "message": "Study study_123 and all associated cohorts deleted successfully."
    }
    ```

    Raises:
    - 401: If user is not authenticated
    - 404: If study is not found or user doesn't have access to delete it
    - 500: If there's an error deleting the study from the database
    """
    user_id = get_authenticated_user_id(request)
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


@router.patch("/study/{study_id}/display_order", tags=["study"], response_model=StatusResponse)
async def update_study_display_order(
    request: Request, study_id: str, display_order: int
):
    """
    Update the display order of a study.

    Path Parameters:
    - study_id (str): The unique identifier of the study to update
    
    Query Parameters:
    - display_order (int): The new display order value for UI sorting

    Authentication:
    - Requires authenticated user. Only allows updating studies owned by the authenticated user.

    Behavior:
    - Updates only the display_order field, leaving all other study fields unchanged
    - Display order is typically used for custom sorting in the UI
    - Lower values typically appear first in sorted lists

    Returns:
    - StatusResponse: Status object containing:
        - status (str): "success" if update completed
        - message (str): Confirmation message

    Example Response:
    ```json
    {
        "status": "success",
        "message": "Study display order updated successfully."
    }
    ```

    Raises:
    - 401: If user is not authenticated
    - 404: If study is not found or user doesn't have access to update it
    - 500: If there's an error updating the study in the database
    """
    user_id = get_authenticated_user_id(request)
    try:
        success = await db_manager.update_study_display_order(
            user_id=user_id, study_id=study_id, display_order=display_order
        )

        if success:
            return {
                "status": "success",
                "message": "Study display order updated successfully.",
            }
        else:
            raise HTTPException(
                status_code=404, detail="Study not found or access denied."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update display order for study {study_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to update study display order."
        )


@router.patch("/study/{study_id}/database", tags=["study"])
async def update_study_database(
    request: Request,
    study_id: str,
    body: Dict = Body(...),
):
    """
    Update the database column for a study.

    Path Parameters:
    - study_id (str): The unique identifier of the study.

    Request Body:
    - database (dict | null): The database configuration object, or null to clear it.
    """
    user_id = get_authenticated_user_id(request)
    database = body.get("database")
    try:
        success = await db_manager.update_study_database(
            user_id, study_id, database
        )
        if not success:
            raise HTTPException(status_code=404, detail=f"Study {study_id} not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update database for study {study_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update database.")


# Study sub-resources
@router.get("/study/{study_id}/cohorts", tags=["study"])
async def get_cohorts_for_study(request: Request, study_id: str):
    """
    Get all cohorts associated with a specific study.

    Path Parameters:
    - study_id (str): The unique identifier of the study

    Authentication:
    - Requires authenticated user. Only returns cohorts from studies owned by the authenticated user.

    Returns:
    - list[dict]: A list of cohort objects, each containing:
        - id (str): Unique identifier for the cohort
        - name (str): Name of the cohort
        - description (dict): Rich text description (Quill Delta format)
        - study_id (str): ID of the parent study
        - phenotypes (list): List of phenotype definitions
        - entry_criterion (dict): Entry criterion definition
        - inclusion_criteria (list): List of inclusion criteria
        - exclusion_criteria (list): List of exclusion criteria
        - display_order (int): Display order for UI sorting
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    [
        {
            "id": "cohort_456",
            "name": "T2DM Cohort",
            "description": {"ops": [{"insert": "Type 2 diabetes patients"}]},
            "study_id": "study_123",
            "phenotypes": [],
            "entry_criterion": {},
            "inclusion_criteria": [],
            "exclusion_criteria": [],
            "display_order": 0,
            "created_at": "2025-12-09T10:00:00Z",
            "updated_at": "2025-12-09T10:00:00Z"
        }
    ]
    ```

    Raises:
    - 401: If user is not authenticated
    - 500: If there's an error retrieving cohorts from the database
    """
    user_id = get_authenticated_user_id(request)
    try:
        cohorts = await db_manager.get_cohorts_for_study(study_id, user_id)
        return cohorts
    except Exception as e:
        logger.error(f"Failed to retrieve cohorts for study {study_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve cohorts for study {study_id}"
        )


# -- STUDY INTAKE PARSING --


class CohortIntake(BaseModel):
    name: str
    description: str = ""
    entry_criterion: str = ""
    inclusions: List[str] = []
    exclusions: List[str] = []


class StudyConceptParseRequest(BaseModel):
    text: str


class StudyConceptParseResponse(BaseModel):
    study_name: str = ""
    study_type: str = "cohort"
    cohorts: List[CohortIntake] = []
    raw_description: str = ""
    codelist_notes: str = ""


# Other operations
@router.post("/study/parse_concept", tags=["study"])
async def parse_study_concept(
    request: Request,
    body: StudyConceptParseRequest,
):
    """
    Parse a free-text study concept document into structured intake data using AI.

    Request Body:
    - text (str): The raw text content of the study concept document

    Returns:
    - StudyConceptParseResponse: Structured intake data extracted from the document
    """
    get_authenticated_user_id(request)

    # Build OpenAI client from env vars
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("OPENAI_API_VERSION", "2025-01-01-preview")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

    if not azure_endpoint or not azure_api_key:
        raise HTTPException(status_code=500, detail="Azure OpenAI not configured")

    try:
        import httpx
        from openai import AsyncAzureOpenAI

        http_client = httpx.AsyncClient(verify=False)
        client = AsyncAzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=azure_api_key,
            api_version=api_version,
            http_client=http_client,
        )

        system_prompt = """You are a medical research study analyst. Extract structured information from the study concept document provided.

Return a JSON object with this exact structure:
{
  "study_name": "string - a concise name for the study",
  "study_type": "one of: cohort, case_control, cross_sectional, case_series, registry, ecological, other",
  "raw_description": "string - a 2-3 sentence summary of the study",
  "codelist_notes": "string - bullet list of medical codes/codelists needed (diagnoses, drugs, procedures, labs), one per line starting with '-'",
  "cohorts": [
    {
      "name": "string - cohort name (e.g. 'Treatment Arm', 'Control Group')",
      "description": "string - brief cohort description",
      "entry_criterion": "string - the clinical event defining the index date (e.g. 'First prescription of empagliflozin')",
      "inclusions": ["string - inclusion criterion 1", "string - inclusion criterion 2"],
      "exclusions": ["string - exclusion criterion 1", "string - exclusion criterion 2"]
    }
  ]
}

Rules:
- Extract all distinct patient groups as separate cohorts
- entry_criterion is required for each cohort — it defines WHEN a patient enters the study (index date)
- Each inclusion/exclusion criterion should be a single concise statement
- codelist_notes should enumerate every diagnosis, drug, procedure or lab code domain mentioned
- Each inclusion/exclusion criterion should be a single concise statement (max 15 words)
- entry_criterion should be one short phrase (max 10 words)
- raw_description max 2 sentences
- codelist_notes: one bullet per code domain, no explanations
- Return ONLY valid JSON, no markdown fences"""

        response = await client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": body.text},
            ],
            temperature=0.2,
        )
        await http_client.aclose()

        raw = (response.choices[0].message.content or "{}").strip()
        logger.info(f"parse_concept raw response (first 600 chars): {raw[:600]}")

        # Strategy 1: strip markdown fences
        if "```" in raw:
            # grab content between first ``` and last ```
            start = raw.find("```")
            end = raw.rfind("```")
            if start != end:
                raw = raw[start:end]
            raw = raw.strip()
            # remove language tag on first line (e.g. ```json)
            lines = raw.split("\n")
            if lines and lines[0].strip().startswith("`"):
                lines = lines[1:]
            raw = "\n".join(lines).strip()

        # Strategy 2: if it still doesn't start with {, find the first { ... }
        if not raw.startswith("{"):
            brace_start = raw.find("{")
            brace_end = raw.rfind("}")
            if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
                raw = raw[brace_start:brace_end + 1]
            else:
                logger.error(f"No JSON object found in response. Full response: {raw}")
                raise HTTPException(status_code=500, detail="AI returned malformed response")

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            # Strategy 3: try to fix common issues — trailing commas, single quotes
            import re
            fixed = re.sub(r',\s*([}\]])', r'\1', raw)   # trailing commas
            fixed = re.sub(r"(?<![\\])'", '"', fixed)     # single → double quotes
            try:
                parsed = json.loads(fixed)
            except json.JSONDecodeError as e2:
                logger.error(f"JSON parse failed after cleanup. Error: {e2}. Raw: {raw[:400]}")
                raise HTTPException(status_code=500, detail="AI returned malformed response")

        cohorts = [
            CohortIntake(
                name=c.get("name", "Cohort"),
                description=c.get("description", ""),
                entry_criterion=c.get("entry_criterion", ""),
                inclusions=c.get("inclusions", []),
                exclusions=c.get("exclusions", []),
            )
            for c in parsed.get("cohorts", [])
        ]

        return StudyConceptParseResponse(
            study_name=parsed.get("study_name", ""),
            study_type=parsed.get("study_type", "cohort"),
            raw_description=parsed.get("raw_description", ""),
            codelist_notes=parsed.get("codelist_notes", ""),
            cohorts=cohorts,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to parse study concept: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse study concept: {str(e)}")
