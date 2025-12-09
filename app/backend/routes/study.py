from typing import Dict
from fastapi import APIRouter, Body, HTTPException, Request
import logging
import os

# Create router for study endpoints
router = APIRouter()

# Setup logger
logger = logging.getLogger(__name__)

# Import database manager and authentication utilities
from ..database import db_manager
from ..utils.auth import get_authenticated_user_id


@router.get("/studies/private", tags=["study"])
async def get_all_studies_for_user(request: Request):
    """
    Retrieve a list of all available studies for the authenticated user.

    Returns:
        list: A list of study objects with id, name, and metadata.
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
        raise HTTPException(
            status_code=500, detail="Failed to retrieve public studies."
        )


@router.get("/study", tags=["study"])
async def get_study_for_user(request: Request, study_id: str):
    """
    Retrieve a study by its ID for the authenticated user.

    Args:
        study_id (str): The ID of the study to retrieve.

    Returns:
        dict: The study data.
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
            raise HTTPException(status_code=404, detail="Public study not found")
        return study
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving public study {study_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve public study")


@router.put("/study", tags=["study"])
async def create_or_update_study(
    request: Request,
    study: Dict = Body(...),
):
    """
    Create or update a study for the authenticated user.

    If study_id is provided in the body, updates the existing study.
    If no study_id is provided, creates a new study.

    Args:
        study (Dict): The complete JSON specification of the study.

    Returns:
        dict: The created/updated study data.
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


@router.delete("/study", tags=["study"])
async def delete_study_for_user(request: Request, study_id: str):
    """
    Delete a study and all associated cohorts for the authenticated user.

    Args:
        study_id (str): The ID of the study to delete.

    Returns:
        dict: Status and message of the operation.
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


@router.patch("/study/display_order", tags=["study"])
async def update_study_display_order(
    request: Request, study_id: str, display_order: int
):
    """
    Update the display order of a study for the authenticated user.

    Args:
        study_id (str): The ID of the study to update.
        display_order (int): The new display order value.

    Returns:
        dict: Status and message of the operation.
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
    Retrieve all cohorts associated with a specific study.

    Args:
        study_id (str): The ID of the study.

    Returns:
        list: A list of cohort objects associated with the study.
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
