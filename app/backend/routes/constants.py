import logging
import hashlib
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================================
# Request/Response Models
# ============================================================================


class ConstantCreate(BaseModel):
    name: str
    description: str = ""
    type: str  # RelativeTimeRangeFilter, CategoricalFilter, DateFilter, array
    value: dict
    display_order: int = 0


class ConstantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    value: Optional[dict] = None
    display_order: Optional[int] = None


# ============================================================================
# Helper Functions
# ============================================================================


def generate_constant_id() -> str:
    """Generate a short constant ID."""
    import random

    random_str = str(random.random())
    hash_val = hashlib.md5(random_str.encode()).hexdigest()
    return hash_val[:8]


# ============================================================================
# API Endpoints
# ============================================================================


@router.get("/study/{study_id}/constants", tags=["constants"])
async def get_constants(request: Request, study_id: str):
    """
    Get all constants for a study.

    Returns:
    - List of constants ordered by type and display_order

    Raises:
    - 401: If user is not authenticated
    - 404: If study not found or user has no access
    """
    user_id = get_authenticated_user_id(request)

    # Verify user has access to study
    study = await db_manager.get_study_for_user(user_id, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    constants = await db_manager.get_constants_for_study(study_id, user_id)
    return constants


@router.get("/study/{study_id}/constants/{constant_id}", tags=["constants"])
async def get_constant(request: Request, study_id: str, constant_id: str):
    """
    Get a specific constant by ID.

    Raises:
    - 401: If user is not authenticated
    - 404: If constant not found or user has no access
    """
    user_id = get_authenticated_user_id(request)

    # Verify user has access to study
    study = await db_manager.get_study_for_user(user_id, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    constant = await db_manager.get_constant(constant_id, user_id)
    if not constant or constant["study_id"] != study_id:
        raise HTTPException(status_code=404, detail="Constant not found")

    return constant


@router.post("/study/{study_id}/constants", tags=["constants"])
async def create_constant(request: Request, study_id: str, data: ConstantCreate):
    """
    Create a new constant for a study.

    Request Body:
    - name: Unique name for the constant within the study
    - description: Optional description
    - type: Constant type (RelativeTimeRangeFilter, CategoricalFilter, DateFilter, array)
    - value: Type-specific value (JSONB)
    - display_order: Order for display (default: 0)

    Returns:
    - Created constant with generated ID

    Raises:
    - 401: If user is not authenticated
    - 404: If study not found
    - 409: If constant name already exists in study
    """
    user_id = get_authenticated_user_id(request)

    # Verify user has access to study
    study = await db_manager.get_study_for_user(user_id, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    # Validate constant type
    valid_types = [
        "RelativeTimeRangeFilter",
        "CategoricalFilter",
        "DateFilter",
        "array",
    ]
    if data.type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid constant type. Must be one of: {', '.join(valid_types)}",
        )

    # Generate constant ID
    constant_id = generate_constant_id()

    try:
        constant = await db_manager.create_constant(
            constant_id=constant_id,
            study_id=study_id,
            user_id=user_id,
            name=data.name,
            description=data.description,
            constant_type=data.type,
            value=data.value,
            display_order=data.display_order,
        )
        return constant
    except Exception as e:
        error_msg = str(e)
        if "unique constraint" in error_msg.lower():
            raise HTTPException(
                status_code=409,
                detail=f"Constant with name '{data.name}' already exists in this study",
            )
        logger.error(f"Failed to create constant: {e}")
        raise HTTPException(status_code=500, detail="Failed to create constant")


@router.put("/study/{study_id}/constants/{constant_id}", tags=["constants"])
async def update_constant(
    request: Request, study_id: str, constant_id: str, data: ConstantUpdate
):
    """
    Update an existing constant.

    Request Body:
    - name: New name (optional)
    - description: New description (optional)
    - value: New value (optional)
    - display_order: New display order (optional)

    Note: constant type cannot be changed

    Returns:
    - Updated constant

    Raises:
    - 401: If user is not authenticated
    - 404: If constant not found
    - 409: If new name conflicts with existing constant
    """
    user_id = get_authenticated_user_id(request)

    # Verify constant exists and belongs to study
    constant = await db_manager.get_constant(constant_id, user_id)
    if not constant or constant["study_id"] != study_id:
        raise HTTPException(status_code=404, detail="Constant not found")

    try:
        updated_constant = await db_manager.update_constant(
            constant_id=constant_id,
            user_id=user_id,
            name=data.name,
            description=data.description,
            value=data.value,
            display_order=data.display_order,
        )
        return updated_constant
    except Exception as e:
        error_msg = str(e)
        if "unique constraint" in error_msg.lower():
            raise HTTPException(
                status_code=409,
                detail=f"Constant with name '{data.name}' already exists in this study",
            )
        logger.error(f"Failed to update constant: {e}")
        raise HTTPException(status_code=500, detail="Failed to update constant")


@router.delete("/study/{study_id}/constants/{constant_id}", tags=["constants"])
async def delete_constant(request: Request, study_id: str, constant_id: str):
    """
    Delete a constant.

    Validates that the constant is not in use by any cohorts before deleting.

    Returns:
    - Success message

    Raises:
    - 401: If user is not authenticated
    - 404: If constant not found
    - 409: If constant is in use by cohorts
    """
    user_id = get_authenticated_user_id(request)

    # Verify constant exists and belongs to study
    constant = await db_manager.get_constant(constant_id, user_id)
    if not constant or constant["study_id"] != study_id:
        raise HTTPException(status_code=404, detail="Constant not found")

    # Check if constant is in use
    in_use = await db_manager.check_constant_in_use(study_id, constant["name"], user_id)
    if in_use:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete constant '{constant['name']}' because it is referenced by one or more cohorts",
        )

    success = await db_manager.delete_constant(constant_id, user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete constant")

    return {"message": "Constant deleted successfully", "constant_id": constant_id}
