from typing import Dict
from fastapi import FastAPI, Body
from fastapi.responses import JSONResponse, StreamingResponse
import phenex
from phenex.ibis_connect import SnowflakeConnector
from phenex.util.serialization.from_dict import from_dict
from dotenv import load_dotenv
import os, json, glob
import logging
import ast

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
        if '/test' not in file_path:
            with open(file_path, "r") as f:
                context += f.read()
    # logger.info(f"{context[:100000]}")
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


@app.post("/plan_update_cohort")
async def plan_update_cohort(
    user_request: str = Body(
        "Generate a cohort of Atrial Fibrillation patients with no history of treatment with anti-coagulation therapies"
    ),
    current_cohort: Dict = None,
    model: str = "gpt-4o-mini",
):
    prompt = f"""
    Consider the following library code: 
        {context}

    Consider the currently defined cohort (which is possibly empty):

    {json.dumps(current_cohort, indent=4)}

    Modify the current Cohort according to the following instructions:
    {user_request}

    Respond with a VERY BRIEF (not more than 100 words) plain text (no code, no python, no json, just plain language) explanation of the changes to be made. In the explanation, indicate any points of ambiguity (if any) that require attention from the user as a bulleted list at the end (e.g. missing codelists, ambiguity about < versus <=, unspecified dependencies). Format your explanation using markdown (e.g. lists for items to review).
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
        from_dict(response["cohort"])
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
    print(cohort)
    print(database_config)
    response = {
        'cohort': cohort
    }

    from phenex.ibis_connect import SnowflakeConnector
    print(database_config)
    if database_config['mapper'] == 'OMOP':
        from phenex.mappers import OMOPDomains
        mapper = OMOPDomains

    elif database_config['mapper'] == 'Vera':
        from phenex.mappers import VeraDomains
        mapper = VeraDomains


    database = database_config['config']


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