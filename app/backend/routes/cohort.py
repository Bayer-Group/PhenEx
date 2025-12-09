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


# Modify the get_all_cohorts endpoint to accept user_id
@router.get("/cohorts", tags=["cohort"])
async def get_all_cohorts_for_user(request: Request):
    """
    Retrieve a list of all available cohorts for the authenticated user.

    Returns:
        dict: A list of cohort IDs and names for that user.
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

    Args:
        cohort_id (str): The ID of the cohort to retrieve for the authenticated user.

    Returns:
        dict: The cohort data.
    """
    user_id = get_authenticated_user_id(request)
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

    Args:
        cohort_id (str): The ID of the cohort to create/update for the authenticated user.
        cohort (Dict): The complete JSON specification of the cohort.
        study_id (str): The ID of the study this cohort belongs to (required for new cohorts).
        provisional (bool): Whether to save the cohort as provisional.
        new_version (bool): If True, increment version. If False, replace existing version.

    Returns:
        dict: Status and message of the operation.
    """
    user_id = get_authenticated_user_id(request)

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
    Delete a cohort by its ID.

    Args:
        cohort_id (str): The ID of the cohort to delete for the authenticated user.

    Returns:
        dict: Status and message of the operation.
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
    except Exception as e:
        logger.error(f"Failed to update display order for cohort {cohort_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to update cohort display order."
        )


@router.get("/cohorts/public", tags=["cohort"])
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


@router.get("/cohort/public", tags=["cohort"])
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
