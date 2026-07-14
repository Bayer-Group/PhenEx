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
from ..utils.validation import validate_cohort_data_format


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
            logger.info(
                f"Creating new study with frontend-provided ID: {actual_study_id}"
            )
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


@router.patch(
    "/study/{study_id}/display_order", tags=["study"], response_model=StatusResponse
)
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
    if database and database.get("connector", "").lower() == "snowflake":
        dest_db = os.environ.get("SNOWFLAKE_DEST_DATABASE")
        if dest_db:
            safe_id = study_id.replace("-", "_")
            study_version = 1 # TODO implement study versions
            config = database.setdefault("config", {})
            config["destination_database"] = f"{dest_db}.PHENEX_{safe_id}_V{study_version:04d}"
    try:
        success = await db_manager.update_study_database(user_id, study_id, database)
        if not success:
            raise HTTPException(status_code=404, detail=f"Study {study_id} not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update database for study {study_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update database.")


# Study sub-resources
@router.get("/study/{study_id}/cohorts", tags=["cohort"])
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


@router.get("/study/{study_id}/issues", tags=["study"])
async def get_study_issues(request: Request, study_id: str):
    """
    Validate a study and return all issues that prevent execution.

    Path Parameters:
    - study_id (str): The unique identifier of the study to validate

    Authentication:
    - Requires authenticated user. Only validates studies owned by the authenticated user.

    Returns:
    - dict: Validation result containing:
        - valid (bool): True if study is ready for execution, False otherwise
        - errors (list[dict]): List of error objects, each containing:
            - message (str): Error description
            - cohort_id (str, optional): ID of cohort with the error
            - cohort_name (str, optional): Name of cohort with the error
            - phenotype_id (str, optional): ID of phenotype with the error
            - phenotype_name (str, optional): Name of phenotype with the error
        - warnings (list[dict]): List of warning objects (same structure as errors)

    Example Response:
    ```json
    {
        "valid": false,
        "errors": [
            {
                "message": "Database configuration is required",
                "severity": "error"
            },
            {
                "message": "Codelist file not found",
                "cohort_id": "cohort_123",
                "cohort_name": "Main Cohort",
                "phenotype_id": "pheno_456",
                "phenotype_name": "Diabetes codes",
                "severity": "error"
            }
        ],
        "warnings": [
            {
                "message": "Has 2 entry phenotypes (only first will be used)",
                "cohort_id": "cohort_123",
                "cohort_name": "Main Cohort",
                "severity": "warning"
            }
        ]
    }
    ```

    Raises:
    - 401: If user is not authenticated
    - 404: If study is not found or user doesn't have access
    - 500: If there's an error during validation
    """
    user_id = get_authenticated_user_id(request)

    errors = []
    warnings = []

    try:
        # 1. Check study exists and is accessible
        study = await db_manager.get_study_for_user(user_id, study_id)
        if not study:
            raise HTTPException(
                status_code=404, detail=f"Study {study_id} not found or access denied"
            )

        # 2. Validate database configuration
        database_config = study.get("database")
        if not database_config:
            errors.append(
                {"message": "Database configuration is required", "severity": "error"}
            )
        else:
            if not database_config.get("mapper"):
                errors.append(
                    {"message": "Database mapper is required", "severity": "error"}
                )
            if not database_config.get("connector"):
                errors.append(
                    {"message": "Database connector is required", "severity": "error"}
                )

            connector = database_config.get("connector")
            if connector == "snowflake":
                config = database_config.get("config", {})
                if not config.get("source_database"):
                    errors.append(
                        {
                            "message": "Snowflake source_database is required",
                            "severity": "error",
                        }
                    )

        # 3. Validate cohorts exist
        cohorts = await db_manager.get_cohorts_for_study(study_id, user_id)
        if not cohorts:
            errors.append(
                {"message": "Study must have at least one cohort", "severity": "error"}
            )
            return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}

        # 4. Validate each cohort
        for cohort in cohorts:
            cohort_id = cohort["id"]
            cohort_name = cohort.get("name", "Unnamed Cohort")

            try:
                cohort_data = await db_manager.get_cohort_for_user(user_id, cohort_id)
                if not cohort_data or "cohort_data" not in cohort_data:
                    errors.append(
                        {
                            "message": "Cohort data not found",
                            "cohort_id": cohort_id,
                            "cohort_name": cohort_name,
                            "severity": "error",
                        }
                    )
                    continue

                # 4a. Format validation
                try:
                    validate_cohort_data_format(cohort_data["cohort_data"])
                except ValueError as e:
                    errors.append(
                        {
                            "message": str(e),
                            "cohort_id": cohort_id,
                            "cohort_name": cohort_name,
                            "severity": "error",
                        }
                    )
                    continue

                phenotypes = cohort_data["cohort_data"].get("phenotypes", [])

                # Validate phenotypes is actually a list
                if not isinstance(phenotypes, list):
                    logger.error(
                        f"Cohort {cohort_id} phenotypes is not a list: {type(phenotypes).__name__}"
                    )
                    errors.append(
                        {
                            "message": "Cohort data is corrupted - please try re-creating the cohort",
                            "cohort_id": cohort_id,
                            "cohort_name": cohort_name,
                            "severity": "error",
                        }
                    )
                    continue

                # 4b. Entry criterion check
                entry_phenotypes = []
                for p in phenotypes:
                    if isinstance(p, dict) and p.get("type") == "entry":
                        entry_phenotypes.append(p)

                if not entry_phenotypes:
                    errors.append(
                        {
                            "message": "Must have at least one entry phenotype",
                            "cohort_id": cohort_id,
                            "cohort_name": cohort_name,
                            "severity": "error",
                        }
                    )
                elif len(entry_phenotypes) > 1:
                    warnings.append(
                        {
                            "message": f"Has {len(entry_phenotypes)} entry phenotypes (only first will be used)",
                            "cohort_id": cohort_id,
                            "cohort_name": cohort_name,
                            "severity": "warning",
                        }
                    )

                # 4c. Phenotype validation
                for idx, pheno in enumerate(phenotypes):
                    # Check if phenotype is a dict
                    if not isinstance(pheno, dict):
                        logger.error(
                            f"Phenotype at index {idx} in cohort {cohort_id} is not a dict: {type(pheno).__name__}"
                        )
                        errors.append(
                            {
                                "message": f"Phenotype at position {idx + 1} is corrupted - please delete and re-create it",
                                "cohort_id": cohort_id,
                                "cohort_name": cohort_name,
                                "severity": "error",
                            }
                        )
                        continue

                    pheno_id = pheno.get("id", f"index_{idx}")
                    pheno_name = pheno.get("name", f"Phenotype {idx + 1}")

                    # Validate required fields
                    if not pheno.get("class_name"):
                        errors.append(
                            {
                                "message": "Missing class_name field",
                                "cohort_id": cohort_id,
                                "cohort_name": cohort_name,
                                "phenotype_id": pheno_id,
                                "phenotype_name": pheno_name,
                                "severity": "error",
                            }
                        )

                    if not pheno.get("type"):
                        errors.append(
                            {
                                "message": "Missing type field (should be: entry, inclusion, exclusion, baseline, or outcome)",
                                "cohort_id": cohort_id,
                                "cohort_name": cohort_name,
                                "phenotype_id": pheno_id,
                                "phenotype_name": pheno_name,
                                "severity": "error",
                            }
                        )

                    if not pheno.get("domain"):
                        errors.append(
                            {
                                "message": "Missing domain field",
                                "cohort_id": cohort_id,
                                "cohort_name": cohort_name,
                                "phenotype_id": pheno_id,
                                "phenotype_name": pheno_name,
                                "severity": "error",
                            }
                        )

                    # 4d. Codelist validation
                    if pheno.get("class_name") == "CodelistPhenotype":
                        codelist = pheno.get("codelist")

                        if not codelist:
                            errors.append(
                                {
                                    "message": "Codelist is not defined - please select or create a codelist",
                                    "cohort_id": cohort_id,
                                    "cohort_name": cohort_name,
                                    "phenotype_id": pheno_id,
                                    "phenotype_name": pheno_name,
                                    "severity": "error",
                                }
                            )
                            continue

                        if not isinstance(codelist, dict):
                            # User can't control this - log but skip
                            logger.warning(
                                f"Codelist for phenotype {pheno_id} is not a dict: {type(codelist).__name__}"
                            )
                            errors.append(
                                {
                                    "message": "Codelist data is corrupted - please re-select the codelist",
                                    "cohort_id": cohort_id,
                                    "cohort_name": cohort_name,
                                    "phenotype_id": pheno_id,
                                    "phenotype_name": pheno_name,
                                    "severity": "error",
                                }
                            )
                            continue

                        codelist_type = codelist.get("codelist_type")

                        if not codelist_type:
                            errors.append(
                                {
                                    "message": "Codelist type is not specified - please select a codelist",
                                    "cohort_id": cohort_id,
                                    "cohort_name": cohort_name,
                                    "phenotype_id": pheno_id,
                                    "phenotype_name": pheno_name,
                                    "severity": "error",
                                }
                            )
                        elif codelist_type == "from_file":
                            file_id = codelist.get("file_id")
                            if not file_id:
                                errors.append(
                                    {
                                        "message": "No codelist file selected - please choose a codelist file",
                                        "cohort_id": cohort_id,
                                        "cohort_name": cohort_name,
                                        "phenotype_id": pheno_id,
                                        "phenotype_name": pheno_name,
                                        "severity": "error",
                                    }
                                )
                            else:
                                # Check if file exists
                                try:
                                    file_exists = await db_manager.get_codelist(
                                        user_id, file_id, study_id
                                    )
                                    if not file_exists:
                                        errors.append(
                                            {
                                                "message": f"Codelist file not found - the file may have been deleted",
                                                "cohort_id": cohort_id,
                                                "cohort_name": cohort_name,
                                                "phenotype_id": pheno_id,
                                                "phenotype_name": pheno_name,
                                                "severity": "error",
                                            }
                                        )
                                except Exception as e:
                                    logger.error(
                                        f"Error checking codelist file {file_id}: {e}"
                                    )
                                    errors.append(
                                        {
                                            "message": "Unable to verify codelist file - please re-select it",
                                            "cohort_id": cohort_id,
                                            "cohort_name": cohort_name,
                                            "phenotype_id": pheno_id,
                                            "phenotype_name": pheno_name,
                                            "severity": "error",
                                        }
                                    )
                        elif codelist_type == "manual":
                            # Check if codes are provided
                            # Handle both formats:
                            # 1. New format: {"codes": [code1, code2, ...]}
                            # 2. PhenEx library format: {"codelist": {"null": [codes]} or {"ICD10": [codes]}}
                            codes = codelist.get("codes")
                            codelist_dict = codelist.get("codelist")

                            has_codes = False
                            if codes and (isinstance(codes, list) and len(codes) > 0):
                                has_codes = True
                            elif codelist_dict and isinstance(codelist_dict, dict):
                                # Check if any code type has codes
                                for code_type, code_list in codelist_dict.items():
                                    if (
                                        isinstance(code_list, list)
                                        and len(code_list) > 0
                                    ):
                                        has_codes = True
                                        break

                            if not has_codes:
                                errors.append(
                                    {
                                        "message": "Manual codelist has no codes - please add codes",
                                        "cohort_id": cohort_id,
                                        "cohort_name": cohort_name,
                                        "phenotype_id": pheno_id,
                                        "phenotype_name": pheno_name,
                                        "severity": "error",
                                    }
                                )

                    # No class-specific validation - removed AgePhenotype/SexPhenotype checks
                    # Those fields are optional or have defaults

            except ValueError as e:
                # Specific error for format validation issues
                errors.append(
                    {
                        "message": f"Cohort format error: {str(e)}",
                        "cohort_id": cohort_id,
                        "cohort_name": cohort_name,
                        "severity": "error",
                    }
                )
            except KeyError as e:
                # Specific error for missing required keys
                errors.append(
                    {
                        "message": f"Missing required field in cohort data: {str(e)}",
                        "cohort_id": cohort_id,
                        "cohort_name": cohort_name,
                        "severity": "error",
                    }
                )
            except Exception as e:
                # Last resort - but include more context
                logger.error(
                    f"Unexpected error validating cohort {cohort_id}: {type(e).__name__}: {e}",
                    exc_info=True,
                )
                errors.append(
                    {
                        "message": f"Unexpected error during validation: {type(e).__name__}: {str(e)}",
                        "cohort_id": cohort_id,
                        "cohort_name": cohort_name,
                        "severity": "error",
                    }
                )

        # 5. Validate constants (check for undefined references)
        try:
            constants = await db_manager.get_constants_for_study(study_id, user_id)
            constant_names = {c["name"] for c in constants}

            for cohort in cohorts:
                cohort_id = cohort["id"]
                cohort_name = cohort.get("name", "Unnamed Cohort")

                try:
                    cohort_data = await db_manager.get_cohort_for_user(
                        user_id, cohort_id
                    )
                    if not cohort_data or "cohort_data" not in cohort_data:
                        continue

                    phenotypes = cohort_data["cohort_data"].get("phenotypes", [])

                    if not isinstance(phenotypes, list):
                        continue

                    for idx, pheno in enumerate(phenotypes):
                        if not isinstance(pheno, dict):
                            continue

                        pheno_id = pheno.get("id", f"index_{idx}")
                        pheno_name = pheno.get("name", f"Phenotype {idx + 1}")

                        # Check various fields that might reference constants
                        fields_to_check = [
                            ("relative_time_range", "relative time range"),
                            ("value_filter", "value filter"),
                            ("categorical_filter", "categorical filter"),
                        ]

                        for field_name, field_label in fields_to_check:
                            field_value = pheno.get(field_name)
                            if isinstance(field_value, dict) and field_value.get(
                                "useConstant"
                            ):
                                const_name = field_value.get("constant")
                                if const_name and const_name not in constant_names:
                                    errors.append(
                                        {
                                            "message": f"Referenced constant '{const_name}' not found in {field_label}",
                                            "cohort_id": cohort_id,
                                            "cohort_name": cohort_name,
                                            "phenotype_id": pheno_id,
                                            "phenotype_name": pheno_name,
                                            "severity": "error",
                                        }
                                    )

                except Exception as e:
                    logger.error(
                        f"Error checking constants in cohort {cohort_id}: {e}",
                        exc_info=True,
                    )

        except Exception as e:
            logger.error(f"Error validating constants: {e}")

        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating study {study_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to validate study: {str(e)}"
        )
