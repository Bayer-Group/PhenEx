from typing import Dict, Optional
from fastapi import FastAPI, Body, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import ast
import phenex
from phenex.ibis_connect import SnowflakeConnector
from phenex.util.serialization.from_dict import from_dict
from examples import EXAMPLES
from dotenv import load_dotenv
from utils import CohortUtils
import os, json, glob
import logging
from deepdiff import DeepDiff
from rag import router as rag_router, query_faiss_index  # Import the router from rag.py

load_dotenv()

from openai import AzureOpenAI, OpenAI

COHORTS_DIR = "/data/cohorts"

openai_client = AzureOpenAI()
if "AZURE_OPENAI_ENDPOINT" in os.environ:
    openai_client = AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ["OPENAI_API_VERSION"],
    )
else:
    openai_client = OpenAI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins. Replace with specific origins if needed.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router from rag.py
app.include_router(rag_router, prefix="/rag")


def get_cohort_path(cohort_id, provisional=False):
    if provisional:
        return os.path.join(COHORTS_DIR, f"cohort_{cohort_id}.provisional.json")
    else:
        return os.path.join(COHORTS_DIR, f"cohort_{cohort_id}.json")


@app.get("/cohorts")
async def get_all_cohorts():
    """
    Retrieve a list of all available cohorts.

    Returns:
        dict: A list of cohort IDs.
    """
    try:
        cohort_files = [
            f for f in os.listdir(COHORTS_DIR) if f.endswith(".json") and not f.endswith(".provisional.json")
        ]
        cohorts = []
        for cohort_file in cohort_files:
            with open(os.path.join(COHORTS_DIR, cohort_file), "r") as f:
                cohort = json.load(f)
                cohort_id, cohort_name = cohort["id"], cohort["name"]
                cohorts.append({"id": cohort_id, "name": cohort_name})
        return cohorts
    except Exception as e:
        logger.error(f"Failed to retrieve cohorts: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cohorts.")

@app.get("/cohort")
async def get_cohort(cohort_id: str, provisional: bool = False):
    """
    Retrieve a cohort by its ID.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.
        provisional (bool): Whether to retrieve the provisional version of the cohort.

    Returns:
        dict: The cohort data.
    """
    cohort_path = get_cohort_path(cohort_id, provisional)
    # handle provisional = True and doesn't exist
    with open(cohort_path, "r") as f:
        return json.load(f)


@app.post("/cohort")
async def update_cohort(cohort_id: str, cohort: Dict = Body(...), provisional: bool = False):
    """
    Update or create a cohort.

    Args:
        cohort_id (str): The ID of the cohort to update.
        cohort (Dict): The complete JSON specification of the cohort.
        provisional (bool): Whether to save the cohort as provisional.

    Returns:
        dict: Status and message of the operation.
    """
    cohort_path = get_cohort_path(cohort_id, provisional)
    try:
        with open(cohort_path, "w") as f:
            json.dump(cohort, f, indent=4)
        return {"status": "success", "message": "Cohort updated successfully."}
    except Exception as e:
        logger.error(f"Failed to update cohort: {e}")
        return {"status": "error", "message": "Failed to update cohort."}


@app.delete("/cohort")
async def delete_cohort(cohort_id: str):
    """
    Delete a cohort by its ID.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.
        provisional (bool): Whether to retrieve the provisional version of the cohort.

    Returns:
        dict: The cohort data.
    """
    cohort_path = get_cohort_path(cohort_id)
    if os.path.exists(cohort_path):
        os.remove(cohort_path)
    else:
        logger.error(f"Failed to retrieve cohort {cohort_id}")
        raise HTTPException(status_code=404, detail=f"Failed to find cohort {cohort_id}.")
    
    return {"status": "success", "message": f"Cohort {cohort_id} deleted successfully."}


@app.get("/cohort/accept_changes")
async def accept_changes(cohort_id: str):
    """
    Accept changes made to a provisional cohort.

    Args:
        cohort_id (str): The ID of the cohort to finalize.

    Returns:
        dict: Status and message of the operation.
    """
    provisional_path = get_cohort_path(cohort_id, provisional=True)
    final_path = get_cohort_path(cohort_id, provisional=False)
    if os.path.exists(provisional_path):
        os.replace(provisional_path, final_path)
        return await get_cohort(cohort_id, provisional=False)


@app.get("/cohort/reject_changes")
async def reject_changes(cohort_id: str):
    """
    Reject changes made to a provisional cohort.

    Args:
        cohort_id (str): The ID of the cohort to discard provisional changes.

    Returns:
        dict: Status and message of the operation.
    """
    provisional_path = get_cohort_path(cohort_id, provisional=True)
    if os.path.exists(provisional_path):
        os.remove(provisional_path)
        return await get_cohort(cohort_id, provisional=False)


@app.get("/cohort/get_changes")
async def get_changes(cohort_id: str):
    """
    Get differences between the provisional and final versions of a cohort.

    Args:
        cohort_id (str): The ID of the cohort to finalize.

    Returns:
        dict: Dictionary of fields of changed phenotypes.
    """
    provisional_path = get_cohort_path(cohort_id, provisional=True)
    final_path = get_cohort_path(cohort_id, provisional=False)
    logger.info(f"Provisional path: {provisional_path}")
    logger.info(f"Final path: {final_path}")
    if not os.path.exists(provisional_path):
        logger.info(f"No differences")
        return {}
    if not os.path.exists(final_path):
        raise HTTPException(status_code=404, detail="Final cohort not found.")

    with open(provisional_path, "r") as provisional_file:
        provisional_cohort = json.load(provisional_file)


    with open(final_path, "r") as final_file:
        final_cohort = json.load(final_file)
    logger.info(final_cohort)
    logger.info(provisional_cohort)
    diff = DeepDiff(provisional_cohort, final_cohort, ignore_order=True)
    logger.info(f"Calculated differences: {diff}")
    return diff


@app.post("/text_to_cohort")
async def text_to_cohort(
    cohort_id: Optional[str] = None,
    model: Optional[str] = "gpt-4o-mini",
    current_cohort: Dict = Body(None),
    user_request: str = Body(
        "Generate a cohort of Atrial Fibrillation patients with no history of treatment with anti-coagulation therapies"
    ),
    return_updated_cohort: bool = False
):
    """
    Generate or modify a cohort based on user instructions.

    Args:
        cohort_id (str): The ID of the cohort to modify. Optional, in case you want to read the cohort from the backend database.
        model (str): The model to use for processing the request.

    Body:
        current_cohort (Dict): The current cohort definition. In case frontend is managing cohort state.
        user_request (str): Instructions for modifying the cohort.

    Returns:
        StreamingResponse: A stream of the response text.
    """
    if cohort_id is not None:
        current_cohort = await get_cohort(cohort_id)
    else:
        cohort_id = current_cohort["id"]
        await update_cohort(cohort_id, current_cohort)

    try:
        del current_cohort["entry_criterion"]
        del current_cohort["inclusions"]
        del current_cohort["exclusions"]
        del current_cohort["characteristics"]
        del current_cohort["outcomes"]
    except KeyError:
        pass

    # Perform RAG search to get the context
    logger.info(f"Retrieving context for user request: {user_request}")
    query = user_request
    top_k = 10
    try:
        results = query_faiss_index(
            query=query,
            top_k=top_k
        )
        context = "\n\n".join(results)
    except Exception as e:
        logger.error(f"Error during RAG search: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve context for the request.")

    logger.info(f"Context retrieved: {len(context.split())} words")

    system_prompt = f"""
    Consider the following library code: 
        {context}

    Your task is to create or modify a cohort according to the user instructions given below. 
    
    In performing your task, you may use any tools at your disposal to complete the task as well as possible.
     
    Include in your response three types of output: 
        1) output intended for display to user, 
        2) thinking output used only by you, and 
        3) a final answer in valid JSON format
     
    1) Text displayed to the user must consist of VERY BRIEF, concise plain text (no code, no python, no json, just plain language) explanation of the changes you are making. In the explanation, indicate any points of ambiguity regarding the implementation choices you made (if any) that require attention from the user (e.g. missing codelists, ambiguity about < versus <=, unspecified dependencies). Format your explanation using markdown (e.g. lists for items to review) to make the response visually appealing. Do not refer to the output JSON as the user does not see this and will have no idea what you're talking about

    2) You must think in order to plan your response. Thinking is not displayed to the user and is only seen by you. Put your thoughts inside markdown comments labelled "THINKING", as below:
    
<!-- THINKING: (your thoughts here) -->

    THINKING will be removed before your answer is displayed to the user but will help you plan your tasks. For example, if you need to make a tool call, you may use <!-- THINKING: (your thoughts here) --> to plan that out. Or you may use <!-- THINKING: (your thoughts here) --> to explain what parameters you are going to fill in to the output JSON.

    3) At the end of your response, create a JSON with the phenotypes of the cohort that need to be updated. Write this json inside the tags <JSON> </JSON>. You only need to include the phenotypes that need updating. Phenotypes that are unchanged may be omitted. Thus, your response will conclude with the following structure:

    <JSON>
        {{
            "id": "{current_cohort['id']}",
            "name": "{current_cohort['name']}",
            "class_name": "{current_cohort['class_name']}",
            "phenotypes": [
                COMPLETE SPECIFICATION OF PHENOTYPES TO BE UPDATED
            ]
        }}
    </JSON>

    You may switch back and forth between (1) and (2) freely but (3) occurs only once and at the end of your response. Do not number or label these sections except as instructed. Do not refer to the JSON you are outputting, as the JSON will be stripped from the text before being displayed to the user. The user sees only the output of (1).

    Additional guidelines:

    - When adding a new phenotype to the cohort, ALWAYS give the phenotype a good description.
    - When modifying an existing phenotype in the cohort, UPDATE the phenotype description only if necessary.
    - Do NOT modify the description of existing phenotypes if you are not changing any thing else in the phenotype UNLESS explicitly asked to do so by the user.
    - Only include the phenotypes that need updating in your response
    - The text within the <JSON> </JSON> tags must be valid JSON; therefore comments are not allowed in this text. Any comments you wish to make to the user must be made with (1) type output
    - Do not refer to the output JSON as the user does not see this and will have no idea what you're talking about
    - Make sure to choose the appropriate domain for each phenotype for the given data source
    - all phenotypes must have a 'type' key, being either 'entry', 'inclusion', 'exclusion', 'characteristics' (for baseline characteristics) or 'outcome'. phenotypes without a 'type' key will not be displayed
    """

    user_prompt = f"""     
    Consider the currently defined cohort (which is possibly empty):

    <JSON>
        {{
            "id": "{current_cohort['id']}",
            "name": "{current_cohort['name']}",
            "class_name": "{current_cohort['class_name']}",
            "phenotypes": {json.dumps(current_cohort["phenotypes"], indent=4)}
        }}
    </JSON>

    Modify the current Cohort according to the following instructions:

    {user_request}
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    completion = openai_client.chat.completions.create(
        model=model,
        stream=True,
        messages=messages
    )

    async def stream_response():
        inside_json = False
        trailing_buffer = ""  # To handle split tags
        json_buffer = ""
        for chunk in completion:
            if len(chunk.choices):
                current_response = chunk.choices[0].delta.content
                if current_response is not None:
                    # Prepend trailing buffer to handle split tags
                    if not inside_json:
                        current_response = trailing_buffer + current_response
                        trailing_buffer = current_response[-10:]  # Keep last 10 characters for next iteration

                    if "<JSON>" in current_response:
                        inside_json = True
                        json_buffer = current_response.split("<JSON>", 1)[1]
                        final_chunk = current_response.split("<JSON>", 1)[0]
                        yield final_chunk
                    elif inside_json:
                        json_buffer += current_response
                    elif not inside_json:
                        yield current_response[:-10]  # Yield response excluding trailing buffer

        parsed_json = json_buffer.replace("</JSON>", "")
        logger.info(f'Parsed JSON: {parsed_json}')
        new_phenotypes = json.loads(json_buffer.replace("</JSON>", ""))
        logger.info(f'Suggested cohort revision: {json.dumps(new_phenotypes, indent=4)}')

        c = CohortUtils()
        new_cohort = c.convert_phenotypes_to_structure(c.update_cohort(current_cohort, new_phenotypes))
        await update_cohort(cohort_id, new_cohort, provisional=True)
        if return_updated_cohort:
            yield json.dumps(new_cohort, indent=4)
        logger.info(f'Updated cohort: {json.dumps(new_cohort, indent=4)}')

    return StreamingResponse(stream_response(), media_type="text/plain")


@app.post("/execute_study")
async def execute_study(
    cohort: Dict = None,
    database_config: Dict = None,
):
    """
    Execute a study using the provided cohort and database configuration.

    Args:
        cohort (Dict): The cohort definition.
        database_config (Dict): The database configuration for the study.

    Returns:
        JSONResponse: The results of the study execution.
    """
    logger.info("Received request!!!!")
    # print(cohort)
    # print(database_config)
    response = {
        'cohort': cohort
    }

    print(database_config)
    if database_config['mapper'] == 'OMOP':
        from phenex.mappers import OMOPDomains
        mapper = OMOPDomains

    database = database_config['config']
    logger.info('ENVIRON')
    logger.info(os.environ)

    con = SnowflakeConnector(
        SNOWFLAKE_SOURCE_DATABASE = database['source_database'],
        SNOWFLAKE_DEST_DATABASE = database['destination_database'],
    )
    

    mapped_tables = mapper.get_mapped_tables(con)
    print("GOT MAPPED TABLES!")
    px_cohort = from_dict(cohort)
    px_cohort.execute(mapped_tables)
    # px_cohort.append_results()

    px_cohort.append_counts()
    response = {'cohort':px_cohort.to_dict()}

    return JSONResponse(content=response)

