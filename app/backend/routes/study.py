from typing import Dict
from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import BaseModel
import logging
import os

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


@router.get("/study", tags=["study"])
async def get_study_for_user(request: Request, study_id: str):
    """
    Get a specific study by ID for the authenticated user.

    Query Parameters:
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


@router.get("/study/public", tags=["study"])
async def get_public_study(study_id: str):
    """
    Get a specific public study by ID.

    Query Parameters:
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


@router.put("/study", tags=["study"], response_model=Dict)
async def create_or_update_study(
    request: Request,
    study: Dict = Body(...),
):
    """
    Create a new study or update an existing study (idempotent operation).

    Authentication:
    - Requires authenticated user. Creates/updates studies for the authenticated user.

    Request Body:
    - study (dict): The complete study data containing:
        - id (str, optional): Unique identifier. If provided, updates existing study. If omitted, creates new study.
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
        "id": "study_123",
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
    study_id = study.get("id")

    try:
        success = await db_manager.update_study_for_user(
            user_id=user_id,
            study_id=study_id,
            name=study.get("name", "New Study" if not study_id else "Untitled Study"),
            description=study.get("description", ""),
            baseline_characteristics=study.get("baseline_characteristics", {}),
            outcomes=study.get("outcomes", {}),
            analysis=study.get("analysis", {}),
            visible_by=study.get("visible_by", []),
            is_public=study.get("is_public", False),
        )

        if success:
            return study
        else:
            raise HTTPException(
                status_code=500, detail="Failed to create/update study."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create/update study for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create/update study.")


@router.delete("/study", tags=["study"], response_model=StatusResponse)
async def delete_study_for_user(request: Request, study_id: str):
    """
    Delete a study and all associated cohorts.

    Query Parameters:
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


@router.patch("/study/display_order", tags=["study"], response_model=StatusResponse)
async def update_study_display_order(
    request: Request, study_id: str, display_order: int
):
    """
    Update the display order of a study.

    Query Parameters:
    - study_id (str): The unique identifier of the study to update
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


@router.get("/study/cohorts", tags=["study"])
async def get_cohorts_for_study(request: Request, study_id: str):
    """
    Get all cohorts associated with a specific study.

    Query Parameters:
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
