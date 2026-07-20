import json
import logging
import uuid

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from phenex.util.serialization.from_dict import from_dict

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..utils.validation import validate_cohort_data_format
from ..routes.execute import prepare_cohort_for_phenex, convert_structured_to_phenotypes

router = APIRouter()
logger = logging.getLogger(__name__)

# Keys that identify a cohort exported in the PhenEx library's structured format.
_STRUCTURED_KEYS = (
    "entry_criterion",
    "inclusions",
    "exclusions",
    "characteristics",
    "outcomes",
)


def _prettify_name(name):
    """Turn a phenotype name like ``HF_DIAGNOSIS_PRIOR`` into ``Hf diagnosis prior``."""
    if not isinstance(name, str):
        return name
    return name.replace("_", " ").strip().capitalize()


def _normalize_phenotype_names(value):
    """
    Recursively walk any nested structure and prettify every phenotype ``name``
    (replace underscores with spaces, lowercase, capitalize the first letter).
    """
    if isinstance(value, list):
        for item in value:
            _normalize_phenotype_names(item)
    elif isinstance(value, dict):
        class_name = value.get("class_name")
        if (
            isinstance(class_name, str)
            and class_name.endswith("Phenotype")
            and isinstance(value.get("name"), str)
        ):
            value["name"] = _prettify_name(value["name"])
        for sub_value in value.values():
            _normalize_phenotype_names(sub_value)


@router.post("/study/{study_id}/cohort/import", tags=["study cohort"])
async def import_cohort(request: Request, study_id: str, file: UploadFile = File(...)):
    """
    Import a cohort from an uploaded JSON file into a study.

    The uploaded file must contain a cohort definition. Both formats are
    accepted: the UI's phenotypes-only format (a top-level ``phenotypes``
    array) and the PhenEx library's structured format (separate
    ``entry_criterion``, ``inclusions``, ``exclusions``, ``characteristics``
    and ``outcomes`` keys). Structured files are converted to the flat
    phenotypes format before saving.

    The cohort is validated by building a PhenEx object via ``from_dict``;
    only if that succeeds is the cohort saved to the target study under a
    freshly generated cohort ID.

    Path Parameters:
    - study_id (str): The study the cohort is imported into.

    Request Body (multipart/form-data):
    - file (UploadFile): A ``.json`` file containing the cohort definition.

    Returns:
    - dict: The created cohort identifier and name.

    Raises:
    - 400: If the file is not valid JSON or is not a .json file.
    - 401: If the user is not authenticated.
    - 404: If the study does not exist or the user has no access.
    - 422: If the cohort data format is invalid or cannot be built by PhenEx.
    - 500: If saving the cohort fails.
    """
    user_id = get_authenticated_user_id(request)

    if not (file.filename or "").lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="A .json file is required")

    study = await db_manager.get_study_for_user(user_id, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    raw = await file.read()
    try:
        cohort_data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")

    if not isinstance(cohort_data, dict):
        raise HTTPException(
            status_code=422, detail="Cohort file must contain a JSON object"
        )

    # Cohorts exported from the PhenEx library use the structured format; convert
    # them to the flat phenotypes-only format the UI and storage layer expect.
    if any(key in cohort_data for key in _STRUCTURED_KEYS):
        # Prettify every phenotype name (incl. nested children) before flattening
        # so display names and logical_expression references stay in sync.
        _normalize_phenotype_names(cohort_data)
        cohort_data = convert_structured_to_phenotypes(
            cohort_data, extract_components=True
        )

    # Validate the UI cohort format (phenotypes-only) before doing anything else.
    try:
        validate_cohort_data_format(cohort_data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Assign a fresh identity and bind the cohort to the target study so an
    # imported file never overwrites an existing cohort.
    cohort_id = str(uuid.uuid4())
    cohort_data = dict(cohort_data)
    cohort_data["id"] = cohort_id
    cohort_data["study_id"] = study_id
    cohort_name = cohort_data.get("name") or f"Cohort {cohort_id}"
    cohort_data["name"] = cohort_name

    # Verify the cohort actually builds a PhenEx object before persisting.
    try:
        processed = prepare_cohort_for_phenex(cohort_data, user_id)
        from_dict(processed)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Failed to build PhenEx cohort from import: {e}")
        raise HTTPException(
            status_code=422, detail=f"Cohort could not be loaded by PhenEx: {e}"
        )

    existing_cohorts = await db_manager.get_cohorts_for_study(study_id, user_id)
    display_order = len(existing_cohorts)
    cohort_data["display_order"] = display_order

    try:
        await db_manager.update_cohort_for_user(
            user_id=user_id,
            cohort_id=cohort_id,
            cohort_data=cohort_data,
            study_id=study_id,
        )
    except Exception as e:
        logger.error(f"Failed to save imported cohort for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save imported cohort")

    logger.info(
        f"Imported cohort {cohort_id} ('{cohort_name}') into study {study_id} "
        f"for user {user_id}"
    )

    return {
        "status": "success",
        "cohort_id": cohort_id,
        "study_id": study_id,
        "name": cohort_name,
        "display_order": display_order,
    }
