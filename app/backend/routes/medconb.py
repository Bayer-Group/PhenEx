import logging

from fastapi import APIRouter, HTTPException, Request
from msal import ConfidentialClientApplication
from medconb_client import Client as MedConBClient, Workspace

from ..config import config
from ..utils.auth import get_authenticated_user_id


# Setup logger
logger = logging.getLogger(__name__)


router = APIRouter(tags=["medconb", "codelist"])

# MedConB Azure AD configuration
# MedConB needs to be under the same tenant as PhenEx for OBO to work
MEDCONB_ENDPOINT = config["medconb"]["api_url"].get(str)
MEDCONB_CLIENT_ID = config["medconb"]["azure_client_id"].get(str)
PHENEX_TENANT = config["auth"]["ad"]["tenant"].get(str)
PHENEX_CLIENT_ID = config["auth"]["ad"]["aud"].get(str)
PHENEX_CLIENT_SECRET = config["auth"]["ad"]["client_secret"].get(str)


# @router.get("/codelist", tags=["codelist"], response_model=CodelistFile)
@router.get("/codelist", tags=["codelist"], response_model=dict)
async def get_codelist_by_id(request: Request, codelist_id: str):
    """
    Get a codelist from MedConB by its ID.

    Query Parameters:
    - codelist_id (str): The ID of the codelist to retrieve.

    Returns:
    TODO: maybe convert into a standard phenex format

    Example Response:
    TODO

    Raises:
    - 401: If the user is not authenticated or token exchange fails
    - 500: If there's an error retrieving codelists
    """

    medconb_token = must_get_medconb_token(request)
    medconb_client = MedConBClient(endpoint=MEDCONB_ENDPOINT, token=medconb_token)
    codelist = medconb_client.get_codelist(codelist_id)

    logger.debug(
        f"""
    Codelist ID: {codelist.id}
    Codelist Name: {codelist.name}
    Codelist Description: {codelist.description}

    It contains codes from the following ontologies:
    {", ".join([codeset.ontology for codeset in codelist.codesets])}
    """
    )

    codes_count = {
        codeset.ontology: len(codeset.codes) for codeset in codelist.codesets
    }

    # TODO: return it in a standard format of phenex
    return {
        "id": codelist.id,
        "name": codelist.name,
        "description": codelist.description,
        "counts": codes_count,
    }


@router.get("/workspace", tags=["codelist"], response_model=Workspace)
def get_medconb_workspace_info(request: Request):
    """
    Get MedConB workspace information.

    Returns:
    TODO: maybe convert into a standard phenex format

    Raises:
        HTTPException: If there's an error retrieving workspace info
    """

    medconb_token = must_get_medconb_token(request)
    medconb_client = MedConBClient(endpoint=MEDCONB_ENDPOINT, token=medconb_token)

    workspace_info = medconb_client.get_workspace()
    return workspace_info


def must_get_medconb_token(request: Request) -> str:
    assert_medconb_configured()
    phenex_token = must_extract_bearer_token(request)
    return get_medconb_token_on_behalf_of(phenex_token)


def assert_medconb_configured():
    if not all(
        [PHENEX_TENANT, PHENEX_CLIENT_ID, PHENEX_CLIENT_SECRET, MEDCONB_CLIENT_ID]
    ):
        raise HTTPException(
            status_code=500,
            detail="MedConB Azure AD configuration is incomplete",
        )


def must_extract_bearer_token(request: Request) -> str:
    # fail early if not authenticated
    get_authenticated_user_id(request)

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "")
    raise HTTPException(
        status_code=401, detail="Missing or invalid authorization token"
    )


def get_medconb_token_on_behalf_of(user_assertion: str) -> str:
    """
    Exchange the user's PhenEx token for a MedConB API token using Azure AD OBO flow.

    Args:
        user_assertion: The user's incoming Bearer token from PhenEx

    Returns:
        Access token for MedConB API

    Raises:
        HTTPException: If token exchange fails
    """
    if not all(
        [PHENEX_TENANT, PHENEX_CLIENT_ID, PHENEX_CLIENT_SECRET, MEDCONB_CLIENT_ID]
    ):
        raise HTTPException(
            status_code=500,
            detail="MedConB Azure AD configuration is incomplete",
        )

    authority = f"https://login.microsoftonline.com/{PHENEX_TENANT}"
    scope = f"{MEDCONB_CLIENT_ID}/API.Access"

    cca = ConfidentialClientApplication(
        client_id=PHENEX_CLIENT_ID,
        client_credential=PHENEX_CLIENT_SECRET,
        authority=authority,
    )

    result = cca.acquire_token_on_behalf_of(
        user_assertion=user_assertion,
        scopes=[scope],
    )

    if "access_token" in result:
        return result["access_token"]

    error_description = result.get("error_description", "Unknown error")
    raise HTTPException(
        status_code=401,
        detail=f"Failed to acquire MedConB token: {error_description}",
    )
