from typing import Dict
from fastapi import APIRouter, Body, HTTPException, Request
import logging
import os

# Create router for cohort endpoints
router = APIRouter()

# Setup logger
logger = logging.getLogger(__name__)

# Import database manager and authentication utilities
from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..utils.validation import validate_cohort_data_format


# Modify the get_all_cohorts endpoint to accept user_id
@router.get("/cohorts", tags=["cohort"])
async def get_all_cohorts_for_user(request: Request):
    """
    Retrieve a list of all cohorts for the authenticated user.

    Authentication:
    - Requires authenticated user. Only returns cohorts owned by the authenticated user.

    Returns:
    - list[dict]: Array of cohort summary objects, each containing:
        - id (str): Unique identifier for the cohort
        - name (str): Name of the cohort
        - study_id (str): ID of the parent study
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    [
        {
            "id": "cohort_123",
            "name": "Type 2 Diabetes Cohort",
            "study_id": "study_456",
            "created_at": "2025-12-09T10:00:00Z",
            "updated_at": "2025-12-11T15:30:00Z"
        },
        {
            "id": "cohort_789",
            "name": "Hypertension Cohort",
            "study_id": "study_456",
            "created_at": "2025-12-10T14:20:00Z",
            "updated_at": "2025-12-10T14:20:00Z"
        }
    ]
    ```

    Raises:
    - 401: If user is not authenticated
    - 500: If there's an error retrieving cohorts from the database
    """
    user_id = get_authenticated_user_id(request)
    try:
        return await db_manager.get_all_cohorts_for_user(user_id)
    except Exception as e:
        logger.error(f"Failed to retrieve cohorts for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cohorts.")


# Modify the get_cohort endpoint to require user_id
@router.get("/cohort", tags=["cohort"])
async def get_cohort_for_user(request: Request, cohort_id: str):
    """
    Retrieve a cohort by its ID for a specific user. Retrieves the latest version.

    Query Parameters:
    - cohort_id (str): The unique identifier of the cohort to retrieve

    Authentication:
    - Requires authenticated user. Only returns cohorts owned by the authenticated user.

    Returns:
    - dict: Complete cohort object containing:
        - id (str): Unique identifier for the cohort
        - name (str): Name of the cohort
        - study_id (str): ID of the parent study
        - phenotypes (list[dict]): Array of phenotype definitions. Each phenotype has:
            - id (str): Unique identifier
            - type (str): One of 'entry', 'inclusion', 'exclusion', 'baseline', 'outcome', 'component'
            - name (str): Phenotype name
            - class_name (str): Phenotype class (e.g., 'CodelistPhenotype', 'LogicPhenotype')
            - Additional fields specific to the phenotype class
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Data Format:
    - Cohorts use the phenotypes-only format where all phenotypes are in a single 'phenotypes' array
    - Each phenotype has a 'type' field indicating its role (entry, inclusion, exclusion, etc.)
    - Legacy format with separate entry_criterion, inclusions, exclusions keys is NOT returned

    Example Response:
    ```json
    {
        "id": "cohort_123",
        "name": "Type 2 Diabetes Cohort",
        "study_id": "study_456",
        "phenotypes": [
            {
                "id": "pheno_1",
                "type": "entry",
                "name": "T2DM Diagnosis",
                "class_name": "CodelistPhenotype",
                "codelist": {...}
            },
            {
                "id": "pheno_2",
                "type": "inclusion",
                "name": "Age >= 18",
                "class_name": "MeasurementPhenotype",
                ...
            }
        ],
        "created_at": "2025-12-09T10:00:00Z",
        "updated_at": "2025-12-11T15:30:00Z"
    }
    ```

    Raises:
    - 401: If user is not authenticated
    - 404: If cohort is not found or user doesn't have access
    - 500: If there's an error retrieving the cohort from the database
    """
    user_id = get_authenticated_user_id(request)
    try:
        cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
        if not cohort:
            raise HTTPException(
                status_code=404,
                detail=f"Cohort {cohort_id} not found for user {user_id}",
            )
        
        # Validate that returned cohort_data follows phenotypes-only format
        # Note: db_manager returns {cohort_data: {...}, version: ..., is_provisional: ...}
        try:
            validate_cohort_data_format(cohort["cohort_data"])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        
        return cohort
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving cohort {cohort_id} for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve cohort {cohort_id} for user {user_id}",
        )


@router.put("/cohort", tags=["cohort"])
async def create_or_update_cohort(
    request: Request,
    cohort_id: str,
    cohort: Dict = Body(...),
    study_id: str = None,
    provisional: bool = False,
    new_version: bool = False,
):
    """
    Create or update a cohort for a specific user (idempotent operation).

    Query Parameters:
    - cohort_id (str): The unique identifier of the cohort to create/update
    - study_id (str, optional): The ID of the parent study (required for new cohorts)
    - provisional (bool, default=False): Whether to save as provisional version
    - new_version (bool, default=False): If True, increment version; if False, replace existing

    Request Body:
    - cohort (dict): Complete cohort specification in phenotypes-only format

    Authentication:
    - Requires authenticated user. Creates/updates cohort for the authenticated user only.

    Data Format Requirements:
    - Cohort MUST contain a 'phenotypes' array
    - Each phenotype must have a 'type' field (entry, inclusion, exclusion, baseline, outcome, component)
    - Legacy format with separate entry_criterion, inclusions, exclusions keys is NOT accepted
    - Request will be rejected with 422 if legacy format is detected

    Example Request Body:
    ```json
    {
        "id": "cohort_123",
        "name": "Type 2 Diabetes Cohort",
        "phenotypes": [
            {
                "id": "pheno_1",
                "type": "entry",
                "name": "T2DM Diagnosis",
                "class_name": "CodelistPhenotype",
                "codelist": {...}
            },
            {
                "id": "pheno_2",
                "type": "inclusion",
                "name": "Age >= 18",
                "class_name": "MeasurementPhenotype",
                ...
            }
        ]
    }
    ```

    Returns:
    - dict: Status and message indicating success
        ```json
        {
            "status": "success",
            "message": "Cohort created successfully." | "Cohort updated successfully."
        }
        ```

    Raises:
    - 400: If study_id is missing for new cohort creation
    - 401: If user is not authenticated
    - 422: If cohort data format is invalid (missing phenotypes array or contains legacy keys)
    - 500: If there's an error saving the cohort to the database
    """
    user_id = get_authenticated_user_id(request)
    
    # Validate cohort data format before processing
    try:
        validate_cohort_data_format(cohort)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Check if cohort already exists
    existing_cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)

    if existing_cohort:
        # Update existing cohort
        # Use study_id from existing record
        study_id = existing_cohort.get("study_id")
        if not study_id:
            raise HTTPException(
                status_code=500,
                detail=f"Existing cohort {cohort_id} has no study_id in database",
            )
        logger.info(f"Updating existing cohort {cohort_id} with study_id {study_id}")
    else:
        # Create new cohort
        # Get study_id from parameter or cohort data
        if not study_id:
            study_id = cohort.get("study_id")

        if not study_id:
            raise HTTPException(
                status_code=400, detail="study_id is required for cohort creation"
            )
        logger.info(f"Creating new cohort {cohort_id} with study_id {study_id}")

    try:
        await db_manager.update_cohort_for_user(
            user_id, cohort_id, cohort, study_id, provisional, new_version
        )
        message = (
            "Cohort updated successfully."
            if existing_cohort
            else "Cohort created successfully."
        )
        return {"status": "success", "message": message}
    except Exception as e:
        logger.error(f"Failed to create/update cohort for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create/update cohort.")


@router.delete("/cohort", tags=["cohort"])
async def delete_cohort_for_user(request: Request, cohort_id: str):
    """
    Delete a cohort and all its versions for the authenticated user.

    Query Parameters:
    - cohort_id (str): The unique identifier of the cohort to delete

    Authentication:
    - Requires authenticated user. Only deletes cohorts owned by the authenticated user.

    Behavior:
    - Deletes all versions of the specified cohort (both provisional and committed)
    - This operation is permanent and cannot be undone
    - If the cohort doesn't exist or user doesn't have access, returns 404

    Returns:
    - dict: Status and confirmation message
        ```json
        {
            "status": "success",
            "message": "Cohort {cohort_id} deleted successfully."
        }
        ```

    Raises:
    - 401: If user is not authenticated
    - 404: If cohort is not found or user doesn't have access
    - 500: If there's an error deleting the cohort from the database
    """
    user_id = get_authenticated_user_id(request)
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


@router.get("/cohorts/public", tags=["cohort"])
async def get_all_public_cohorts():
    """
    Retrieve a list of all public cohorts available to anonymous users.

    Authentication:
    - No authentication required. Returns cohorts for the public user account.

    Returns:
    - list[dict]: Array of cohort summary objects, each containing:
        - id (str): Unique identifier for the cohort
        - name (str): Name of the cohort
        - study_id (str): ID of the parent study
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    [
        {
            "id": "public_cohort_1",
            "name": "Example Diabetes Study",
            "study_id": "public_study_1",
            "created_at": "2025-12-01T10:00:00Z",
            "updated_at": "2025-12-01T10:00:00Z"
        }
    ]
    ```

    Raises:
    - 500: If PUBLIC_USER_ID environment variable is not set or database error occurs
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


@router.get("/cohort/public", tags=["cohort"])
async def get_public_cohort(cohort_id: str):
    """
    Retrieve a public cohort by its ID. Returns the latest version.

    Query Parameters:
    - cohort_id (str): The unique identifier of the cohort to retrieve

    Authentication:
    - No authentication required. Returns cohorts for the public user account.

    Returns:
    - dict: Complete cohort object with same structure as GET /cohort endpoint:
        - id (str): Unique identifier for the cohort
        - name (str): Name of the cohort
        - study_id (str): ID of the parent study
        - phenotypes (list[dict]): Array of phenotype definitions
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Data Format:
    - Returns cohorts in phenotypes-only format (see GET /cohort for details)

    Raises:
    - 404: If cohort is not found in public user account
    - 500: If PUBLIC_USER_ID environment variable is not set or database error occurs
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
