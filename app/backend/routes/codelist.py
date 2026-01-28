from typing import Optional
from fastapi import APIRouter, Request, HTTPException
import logging

try:
    from .medconb import router as medconb_router, MEDCONB_ENABLED
except Exception as e:
    medconb_router = None
    MEDCONB_ENABLED = False
    
from .models import (
    CodelistMetadata,
    CodelistFile,
    ColumnMapping,
    StatusResponse,
    ColumnMappingUpdateResponse,
)
from ..database import db_manager
from ..utils.auth import get_authenticated_user_id

# Create routers for codelist endpoints
# list_router: for /codelists endpoint (no prefix)
# router: for /codelist operations (with /codelist prefix)
list_router = APIRouter()
router = APIRouter()

# Only include medconb router if it's enabled and available
if MEDCONB_ENABLED and medconb_router is not None:
    router.include_router(medconb_router, prefix="/medconb")
    logging.getLogger(__name__).info("MedConB router registered at /codelist/medconb")
else:
    logging.getLogger(__name__).warning("MedConB router not registered - integration disabled")

# Setup logger
logger = logging.getLogger(__name__)


# -- CODELIST API ENDPOINTS --


@list_router.get("/codelists", tags=["codelist"], response_model=list[CodelistMetadata])
async def get_codelists_for_cohort(cohort_id: str):
    """
    Get a list of all codelists associated with a cohort.

    Query Parameters:
    - cohort_id (str): The ID of the cohort to retrieve codelists for.

    Returns:
    - list[CodelistMetadata]: A list of codelist metadata objects, each containing:
        - id (str): Unique identifier for the codelist file
        - filename (str): Original filename of the codelist
        - codelists (list[str]): Array of unique codelist names extracted from the file
        - code_column (str|null): Name of the column containing codes
        - code_type_column (str|null): Name of the column containing code types
        - codelist_column (str|null): Name of the column containing codelist names

    Example Response:
    ```json
    [
        {
            "id": "codelist_123",
            "filename": "icd10_codes.csv",
            "codelists": ["diabetes", "hypertension"],
            "code_column": "code",
            "code_type_column": "type",
            "codelist_column": "category"
        }
    ]
    ```

    Raises:
    - 500: If there's an error retrieving codelists from the database
    """
    return await get_codelist_filenames_for_cohort(db_manager, cohort_id)


@router.get("", tags=["codelist"], response_model=CodelistFile)
async def get_codelist(request: Request, cohort_id: str, file_id: str):
    """
    Get the complete contents of a specific codelist file.

    Query Parameters:
    - cohort_id (str): The ID of the cohort containing the codelist
    - file_id (str): The unique identifier of the codelist file

    Authentication:
    - Requires authenticated user. Only returns codelists owned by the authenticated user.

    Returns:
    - CodelistFile: Complete codelist file object containing:
        - id (str): Unique identifier for the codelist file
        - filename (str): Original filename of the codelist
        - code_column (str): Name of the column containing codes
        - code_type_column (str): Name of the column containing code types (e.g., ICD10, SNOMED)
        - codelist_column (str): Name of the column containing codelist category names
        - contents (CodelistContents): The parsed file contents with:
            - data (dict): Column-oriented data structure {column_name: [values]}
            - columns (list[str]): List of column names
        - codelists (list[str]): Array of unique codelist names
        - version (int): Version number of the codelist
        - created_at (str): ISO timestamp when created
        - updated_at (str): ISO timestamp of last update

    Example Response:
    ```json
    {
        "id": "codelist_123",
        "filename": "icd10_codes.csv",
        "code_column": "code",
        "code_type_column": "code_system",
        "codelist_column": "category",
        "contents": {
            "data": {
                "code": ["E11", "E10", "I10"],
                "code_system": ["ICD10", "ICD10", "ICD10"],
                "category": ["diabetes", "diabetes", "hypertension"],
                "description": ["Type 2 diabetes", "Type 1 diabetes", "Essential hypertension"]
            },
            "headers": ["code", "code_system", "category", "description"]
        },
        "codelists": ["diabetes", "hypertension"],
        "version": 1,
        "created_at": "2025-12-09T10:00:00Z",
        "updated_at": "2025-12-09T10:00:00Z"
    }
    ```

    Raises:
    - 401: If user is not authenticated
    - 404: If codelist file is not found for the given cohort and file_id
    - 500: If there's an error retrieving the codelist from the database
    """
    try:
        user_id = get_authenticated_user_id(request)
        logger.info(
            f"Getting codelist file_id={file_id} for cohort_id={cohort_id}, user_id={user_id}"
        )

        result = await get_codelist_file_for_cohort(
            db_manager, cohort_id, file_id, user_id
        )

        if result is None:
            logger.warning(f"Codelist file {file_id} not found for cohort {cohort_id}")
            raise HTTPException(
                status_code=404,
                detail=f"Codelist file {file_id} not found for cohort {cohort_id}",
            )

        # Log summary without overwhelming the logs
        num_codelists = len(result.get("codelists", []))
        logger.info(
            f"Successfully retrieved codelist {file_id} with {num_codelists} codelists"
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error retrieving codelist {file_id} for cohort {cohort_id}: {str(e)[:200]}"
        )
        raise HTTPException(
            status_code=500, detail=f"Error retrieving codelist: {str(e)[:100]}"
        )


@router.put("", tags=["codelist"], response_model=StatusResponse)
async def create_or_update_codelist(
    request: Request, file: dict, cohort_id: str = None
):
    """
    Create or update a codelist file for a cohort (idempotent operation).

    Query Parameters:
    - cohort_id (str): The ID of the cohort to associate the codelist with

    Request Body:
    - file (dict): The codelist file data containing:
        - id (str): Unique identifier for the codelist file
        - filename (str): Original filename of the codelist
        - column_mapping (dict): Mapping of logical roles to column names:
            - code_column (str): Column containing medical codes
            - code_type_column (str): Column containing code system names
            - codelist_column (str): Column containing category/codelist names
        - codelist_data (dict): The parsed file contents with:
            - contents (dict): Column-oriented data structure
                - data (dict): {column_name: [values]}
                - columns (list[str]): List of column names

    Example Request Body:
    ```json
    {
        "id": "codelist_123",
        "filename": "icd10_codes.csv",
        "column_mapping": {
            "code_column": "code",
            "code_type_column": "code_system",
            "codelist_column": "category"
        },
        "codelist_data": {
            "filename": "icd10_codes.csv",
            "contents": {
                "data": {
                    "code": ["E11", "E10"],
                    "code_system": ["ICD10", "ICD10"],
                    "category": ["diabetes", "diabetes"]
                },
                "headers": ["code", "code_system", "category"]
            }
        }
    }
    ```

    Authentication:
    - Requires authenticated user. Codelist will be associated with the authenticated user.

    Returns:
    - StatusResponse: Status response containing:
        - status (str): "success" if operation completed
        - message (str): Human-readable success message

    Example Response:
    ```json
    {
        "status": "success",
        "message": "Codelist codelist_123 saved successfully."
    }
    ```

    Raises:
    - 400: If cohort_id is missing
    - 401: If user is not authenticated
    - 500: If there's an error saving the codelist to the database

    Notes:
    - Automatically extracts unique codelist names from codelist_column for caching
    - Stores both raw data and column mapping for efficient retrieval
    - Operation is idempotent - can be called multiple times with same data
    """
    user_id = get_authenticated_user_id(request)

    # Get cohort_id from query parameters if not provided as function parameter
    if cohort_id is None:
        cohort_id = request.query_params.get("cohort_id")

    if not cohort_id:
        raise HTTPException(status_code=400, detail="cohort_id is required")

    await save_codelist_file_for_cohort(
        db_manager, cohort_id, file["id"], file, user_id
    )
    return {
        "status": "success",
        "message": f"Codelist {file['id']} saved successfully.",
    }


@router.delete("", tags=["codelist"], response_model=StatusResponse)
async def delete_codelist(cohort_id: str, file_id: str):
    """
    Delete a codelist file and all its contents.

    Query Parameters:
    - cohort_id (str): The ID of the cohort containing the codelist
    - file_id (str): The unique identifier of the codelist file to delete

    Returns:
    - StatusResponse: Status response containing:
        - status (str): "success" if deletion completed
        - message (str): Human-readable success message

    Example Response:
    ```json
    {
        "status": "success",
        "message": "Codelist codelist_123 deleted successfully."
    }
    ```

    Raises:
    - 404: If codelist file is not found
    - 500: If there's an error deleting the codelist from the database

    Notes:
    - This operation permanently deletes the codelist and cannot be undone
    - All associated data including codes, mappings, and metadata will be removed
    """
    await delete_codelist_file_for_cohort(db_manager, cohort_id, file_id)

    return {
        "status": "success",
        "message": f"Codelist {file_id} deleted successfully.",
    }


@router.patch(
    "/column_mapping", tags=["codelist"], response_model=ColumnMappingUpdateResponse
)
async def update_codelist_column_mapping(
    request: Request, file_id: str, column_mapping: ColumnMapping
):
    """
    Update the column mapping configuration for an existing codelist file.

    This endpoint allows updating which columns in the codelist correspond to codes,
    code types, and codelist categories. It also automatically recalculates and caches
    the unique list of codelist names based on the new codelist_column.

    Query Parameters:
    - file_id (str): The unique identifier of the codelist file to update

    Request Body:
    - column_mapping (ColumnMapping): New column mapping configuration containing:
        - code_column (str): Name of column containing medical codes (e.g., "code", "icd10")
        - code_type_column (str): Name of column containing code system names (e.g., "code_system", "vocabulary")
        - codelist_column (str): Name of column containing category/codelist names (e.g., "category", "phenotype")

    Example Request Body:
    ```json
    {
        "code_column": "code",
        "code_type_column": "code_system",
        "codelist_column": "category"
    }
    ```

    Authentication:
    - Requires authenticated user. Only updates codelists owned by the authenticated user.

    Returns:
    - ColumnMappingUpdateResponse: Status response containing:
        - status (str): "success" if update completed
        - message (str): Human-readable success message
        - codelists (list[str]): Updated array of unique codelist names extracted from the new codelist_column

    Example Response:
    ```json
    {
        "status": "success",
        "message": "Column mapping updated for codelist file codelist_123",
        "codelists": ["diabetes", "hypertension", "heart_failure"]
    }
    ```

    Raises:
    - 400: If column_mapping is missing required keys (code_column, code_type_column, codelist_column)
    - 401: If user is not authenticated
    - 404: If codelist file is not found for the authenticated user
    - 500: If there's an error updating the column mapping in the database

    Notes:
    - This operation recalculates the codelists array cache based on unique values in codelist_column
    - Useful when the file structure is correct but column assignments need adjustment
    - Does not modify the actual data, only the metadata about column roles
    """
    user_id = get_authenticated_user_id(request)

    # Convert Pydantic model to dict for validation
    column_mapping_dict = column_mapping.model_dump()

    try:
        # First get the codelist data to extract unique codelist names
        codelist = await db_manager.get_codelist(user_id, file_id)
        if not codelist:
            raise HTTPException(
                status_code=404,
                detail=f"Codelist file {file_id} not found for user {user_id}",
            )

        # Parse codelist_data if needed
        codelist_data = codelist.get("codelist_data", {})
        if isinstance(codelist_data, str):
            import json

            codelist_data = json.loads(codelist_data)

        # Extract unique codelist names from the specified column
        codelist_column = column_mapping_dict["codelist_column"]
        contents = codelist_data.get("contents", {})
        data = contents.get("data", {})

        codelists_array = []
        if codelist_column in data:
            # Get unique codelist names
            codelists_array = list(set(data[codelist_column]))

        # Update both column mapping and codelists array
        success = await db_manager.update_codelist(
            user_id,
            file_id,
            column_mapping=column_mapping_dict,
            codelists=codelists_array,
        )

        if not success:
            raise HTTPException(
                status_code=404, detail=f"Failed to update codelist file {file_id}"
            )

        logger.info(
            f"Updated column mapping and codelists array for codelist {file_id} for user {user_id}"
        )
        return {
            "status": "success",
            "message": f"Column mapping updated for codelist file {file_id}",
            "codelists": codelists_array,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update column mapping for codelist {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update column mapping")


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
        return [
            {
                "id": cl["id"],
                "filename": cl["filename"],
                "codelists": cl.get("codelists", []),
                "code_column": cl.get("code_column"),
                "code_type_column": cl.get("code_type_column"),
                "codelist_column": cl.get("codelist_column"),
            }
            for cl in codelists
        ]
    except Exception as e:
        logger.error(
            f"Failed to retrieve codelist filenames for cohort {cohort_id}: {e}"
        )
        return []


async def get_codelist_file_for_cohort(
    db_manager, cohort_id: str, file_id: str, user_id: str
) -> Optional[dict]:
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

        # Get contents and ensure it has both data and headers
        contents = codelist_data.get("contents", {})
        if "headers" not in contents and "data" in contents:
            # If headers is missing, derive it from the data keys
            contents["headers"] = list(contents["data"].keys())

        # Create the reconstructed file structure
        reconstructed_file = {
            "id": file_id,
            "filename": codelist_data.get("filename", ""),
            "code_column": column_mapping.get("code_column", ""),
            "code_type_column": column_mapping.get("code_type_column", ""),
            "codelist_column": column_mapping.get("codelist_column", ""),
            "contents": contents,
            "codelists": codelist.get("codelists", []),
            "version": codelist.get("version"),
            "created_at": codelist.get("created_at"),
            "updated_at": codelist.get("updated_at"),
        }

        return reconstructed_file

    except Exception as e:
        # Truncate error message to prevent log flooding
        error_msg = str(e)[:500]
        logger.error(
            f"Failed to retrieve codelist file {file_id} for cohort {cohort_id}: {error_msg}"
        )
        return None


async def save_codelist_file_for_cohort(
    db_manager, cohort_id: str, file_id: str, codelist_file: dict, user_id: str
) -> bool:
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
        file_name = (
            codelist_data.get("filename") or codelist_data.get("name") or file_id
        )

        # Calculate codelists array from the data
        codelists_array = []
        codelist_column = column_mapping.get("codelist_column")
        if codelist_column:
            contents = codelist_data.get("contents", {})
            data = contents.get("data", {})
            if codelist_column in data:
                # Get unique codelist names
                codelists_array = list(set(data[codelist_column]))

        # Truncate codelists_array for logging to avoid overwhelming logs
        codelists_preview = (
            codelists_array[:10] if len(codelists_array) > 10 else codelists_array
        )
        logger.info(
            f"save_codelist_file_for_cohort: calculated {len(codelists_array)} unique codelists for file {file_name}. "
            f"First {len(codelists_preview)}: {codelists_preview}"
        )

        # Save codelist to database with filename
        return await db_manager.save_codelist(
            user_id,
            file_id,
            codelist_data,
            column_mapping,
            codelists_array,
            cohort_id,
            file_name,
        )
    except Exception as e:
        logger.error(
            f"Failed to save codelist file {file_id} for cohort {cohort_id}: {e}"
        )
        return False


async def delete_codelist_file_for_cohort(
    db_manager, cohort_id: str, file_id: str
) -> bool:
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
        logger.error(
            f"Failed to delete codelist file {file_id} for cohort {cohort_id}: {e}"
        )
        return False
