from typing import Dict
from fastapi import APIRouter, Body, HTTPException, Request
import logging

router = APIRouter()

logger = logging.getLogger(__name__)

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..utils.validation import validate_cohort_data_format


@router.get("/study/{study_id}/cohort/{cohort_id}", tags=["study cohort"])
async def get_cohort(request: Request, study_id: str, cohort_id: str):
    """
    Retrieve a cohort by its ID within a specific study.

    Path Parameters:
    - study_id (str): The unique identifier of the parent study
    - cohort_id (str): The unique identifier of the cohort to retrieve

    Authentication:
    - Requires authenticated user. Only returns cohorts owned by the authenticated user.

    Returns:
    - dict: Complete cohort object containing cohort_data, version, is_provisional, and study_id.

    Raises:
    - 401: If user is not authenticated
    - 404: If cohort is not found or user doesn't have access
    - 422: If the stored cohort data format is invalid
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
            detail=f"Failed to retrieve cohort {cohort_id}",
        )


@router.put("/study/{study_id}/cohort/{cohort_id}", tags=["study cohort"])
async def create_or_update_cohort(
    request: Request,
    study_id: str,
    cohort_id: str,
    cohort: Dict = Body(...),
    provisional: bool = False,
    new_version: bool = False,
):
    """
    Create or update a cohort within a specific study (idempotent operation).

    Path Parameters:
    - study_id (str): The unique identifier of the parent study
    - cohort_id (str): The unique identifier of the cohort to create/update

    Query Parameters:
    - provisional (bool, default=False): Whether to save as provisional version
    - new_version (bool, default=False): If True, increment version; if False, replace existing

    Request Body:
    - cohort (dict): Complete cohort specification in phenotypes-only format

    Raises:
    - 401: If user is not authenticated
    - 422: If cohort data format is invalid
    - 500: If there's an error saving the cohort to the database
    """
    user_id = get_authenticated_user_id(request)

    try:
        validate_cohort_data_format(cohort)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    existing_cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)

    if existing_cohort:
        effective_study_id = existing_cohort.get("study_id", study_id)
        logger.info(
            f"Updating existing cohort {cohort_id} with study_id {effective_study_id}"
        )
    else:
        effective_study_id = study_id
        logger.info(
            f"Creating new cohort {cohort_id} with study_id {effective_study_id}"
        )

    try:
        await db_manager.update_cohort_for_user(
            user_id, cohort_id, cohort, effective_study_id, provisional, new_version
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


@router.patch("/study/{study_id}/cohort/{cohort_id}/database", tags=["study cohort"])
async def update_cohort_database(
    request: Request,
    study_id: str,
    cohort_id: str,
    body: Dict = Body(...),
):
    """
    Update the database configuration for a cohort.

    Path Parameters:
    - study_id (str): The unique identifier of the parent study
    - cohort_id (str): The unique identifier of the cohort

    Request Body:
    - database (dict | null): The database configuration object, or null to clear it.
    """
    user_id = get_authenticated_user_id(request)
    database = body.get("database")
    try:
        success = await db_manager.update_cohort_database(user_id, cohort_id, database)
        if not success:
            raise HTTPException(status_code=404, detail=f"Cohort {cohort_id} not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update database for cohort {cohort_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update database.")


@router.patch(
    "/study/{study_id}/cohort/{cohort_id}/display_order", tags=["study cohort"]
)
async def update_cohort_display_order(
    request: Request,
    study_id: str,
    cohort_id: str,
    display_order: int,
):
    """
    Update the display order of a cohort within its study.

    Path Parameters:
    - study_id (str): The unique identifier of the parent study
    - cohort_id (str): The unique identifier of the cohort

    Query Parameters:
    - display_order (int): The new display order value for UI sorting

    Behavior:
    - Updates only the display_order column, leaving the cohort's data and name unchanged.
    """
    user_id = get_authenticated_user_id(request)
    try:
        success = await db_manager.update_cohort_display_order(
            user_id, cohort_id, display_order
        )
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Cohort {cohort_id} not found or access denied.",
            )
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update display order for cohort {cohort_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to update cohort display order."
        )


@router.delete("/study/{study_id}/cohort/{cohort_id}", tags=["study cohort"])
async def delete_cohort(request: Request, study_id: str, cohort_id: str):
    """
    Delete a cohort and all its versions.

    Path Parameters:
    - study_id (str): The unique identifier of the parent study
    - cohort_id (str): The unique identifier of the cohort to delete

    Authentication:
    - Requires authenticated user. Only deletes cohorts owned by the authenticated user.

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
                detail=f"Cohort {cohort_id} not found for user {user_id}.",
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
            detail=f"Failed to delete cohort {cohort_id}",
        )
