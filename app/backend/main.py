from typing import Dict
from fastapi import FastAPI, Body
from fastapi.responses import JSONResponse, StreamingResponse
import phenex
from phenex.ibis_connect import SnowflakeConnector
from phenex.util.serialization.from_dict import from_dict
from dotenv import load_dotenv
import os, json, glob
import logging

load_dotenv()

from openai import AzureOpenAI, OpenAI

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


def get_phenex_context():
    # get context for LLM layer
    base_dir = os.path.dirname(phenex.__file__)
    python_files = list(
        set(glob.glob(os.path.join(base_dir, "**/**/*.py"), recursive=True))
    )
    context = ""
    for file_path in python_files:
        exclude_paths = ['/aggregators', '/filters', '/test/', '/reporting/', 'ibis_connect.py', 'sim.py', 'tables.py', 'logging.py', '__init__.py']
        if not any([x in file_path for x in exclude_paths]):
            with open(file_path, "r") as f:
                new_context = context  + f"\n\n### File {file_path}:\n" + f.read()
                logger.info(f'{file_path}: {len(new_context.split('\n')) - len(context.split('\n'))}')
                context = new_context

    # logger.info(f"{context[:100000]}")
    logger.info(context)
    logger.info(f"LLM context files found: {len(python_files)}")
    logger.info(f"LLM context length (words): {len(context.split())}")
    return context



context = get_phenex_context()
# from phenex import PHENEX_MAPPERS
# from phenex_projects.mappers import PHENEX_PROJECTS_MAPPERS
# PHENEX_MAPPERS.update(PHENEX_PROJECTS_MAPPERS)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def home():
    logger.info("hello there")


def get_cohort_path(cohort_id, provisional=False):
    if provisional:
        return f"cohort_{cohort_id}.provisional.json"
    else:
        return f"cohort_{cohort_id}.json"

@app.get("/cohort")
async def get_cohort(cohort_id: str, provisional: bool = False):
    cohort_path = get_cohort_path(cohort_id, provisional)
    with open(cohort_path, "r") as f:
        return json.load(f)

@app.post("/cohort")
async def update_cohort(cohort_id: str, cohort: Dict = Body(...), provisional: bool = False):
    cohort_path = get_cohort_path(cohort_id, provisional)
    try:
        with open(cohort_path, "w") as f:
            json.dump(cohort, f, indent=4)
        return {"status": "success", "message": "Cohort updated successfully."}
    except Exception as e:
        logger.error(f"Failed to update cohort: {e}")
        return {"status": "error", "message": "Failed to update cohort."}

@app.post("/cohort/accept_changes")
async def accept_changes(cohort_id: str):
    provisional_path = get_cohort_path(cohort_id, provisional=True)
    final_path = get_cohort_path(cohort_id, provisional=False)
    if os.path.exists(provisional_path):
        os.replace(provisional_path, final_path)
        return {"status": "success", "message": "Provisional changes accepted."}
    else:
        return {"status": "error", "message": "Provisional cohort not found."}

@app.post("/cohort/reject_changes")
async def reject_changes(cohort_id: str):
    provisional_path = get_cohort_path(cohort_id, provisional=True)
    if os.path.exists(provisional_path):
        os.remove(provisional_path)
        return {"status": "success", "message": "Provisional changes rejected."}
    else:
        return {"status": "error", "message": "Provisional cohort not found."}


@app.post("/text_to_cohort")
async def text_to_cohort(
    cohort_id: str,
    user_request: str = Body(
        "Generate a cohort of Atrial Fibrillation patients with no history of treatment with anti-coagulation therapies"
    ),
    model: str = "gpt-4o-mini",
):
    current_cohort = get_cohort(cohort_id)

    system_prompt = f"""
    Consider the following library code: 
        {context}

    Your task is to create or modify a cohort according to the user instructions given below. 
    
    In performing your task, you may use any tools at your disposal to give as complete an accurate an answer as possible.
     
    Include in your response VERY BRIEF plain text (no code, no python, no json, just plain language) explanation of the changes you are making. In the explanation, indicate any points of ambiguity (if any) that require attention from the user (e.g. missing codelists, ambiguity about < versus <=, unspecified dependencies). Format your explanation using markdown (e.g. lists for items to review) to make the response visually appealing.

    You may think. Thinking is not displayed to the user and is only seen by you. Put your thoughts inside <thinking> </thinking> tags. The content inside these tags will be removed before your answer is displayed to the user but may help you plan your tasks.     

    Consider the currently defined cohort (which is possibly empty):

    {json.dumps(current_cohort, indent=4)}

    Modify the current Cohort according to the following instructions:
    {user_request}


    """
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": prompt},
    ]

    completion = openai_client.chat.completions.create(
        model=model,
        stream=True,
        messages=messages
    )

    def stream_response():
        for chunk in completion:
            if len(chunk.choices):
                current_response = chunk.choices[0].delta.content
                if current_response is not None:
                    # yield 'chunk '
                    yield current_response

    return StreamingResponse(stream_response(), media_type="text/plain")


    #
    # user_id, cohort_id, phenotype_id, definition, status
    # xyz, abc, 123, {..}, not_executed

    # validate_cohort(modified_cohort)
    # update_cohort(cohort_id, modified_cohort)
    # return

@app.post("/text_to_cohort")
async def text_to_cohort(
    user_request: str = Body(
        "Generate a cohort of Atrial Fibrillation patients with no history of treatment with anti-coagulation therapies"
    ),
    plan: str = Body(None),
    current_cohort: Dict = None,
    model: str = "gpt-4o-mini",
):
    prompt = f"""
    Consider the following library code: 
        {context}

    Consider the currently defined cohort (which is possibly empty):

    {json.dumps(current_cohort, indent=4)}

    The user has requested you to modify the current Cohort according to the following instructions:
    {user_request}
    """

    if plan:
        prompt += """
    You have determined the following changes must be made in order to complete the user's instructions:
    {plan}
    """

    prompt += """
    Return a JSON with the following fields:
    
    {{
        "cohort": (Dict) The complete dictionary definition of the resulting updated cohort compatible with phenex.util.serialization.from_dict.

    }}
    
    Where codelists are unknown, leave them as simply placeholders with a snake_case name and set the codelist as "codelist": ["PLACEHOLDER"].
    """
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": prompt},
    ]
    logger.info(prompt)
    response = json.loads(
        openai_client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        .choices[0]
        .message.content
    )

    response['cohort']['id'] = current_cohort['id']
    try: 
        # from_dict(response["cohort"])
        return {
            "status": "update_succeeded",
            "cohort": response["cohort"]
        }
    except:
        return  {
            "status": "update_failed",
            "cohort": current_cohort
        }


@app.post("/execute_study")
async def execute_study(
    cohort: Dict = None,
    database_config: Dict = None,
):
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

    # from phenex.reporting import InExCounts
    # r = InExCounts()
    # counts = r.execute(px_cohort)
    # print(counts)


    # return JSONResponse(content=response)