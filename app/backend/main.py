from typing import Dict
from fastapi import FastAPI, HTTPException, Request, Body
import phenex
from phenex.ibis_connect import SnowflakeConnector
from phenex.util.serialization import from_dict
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
        with open(file_path, "r") as f:
            context += f"\n\n{file_path}:\n" + f.read() + "\n"
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


@app.post("/text_to_cohort")
async def text_to_cohort(
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

    Return a JSON with the following fields:
    
    {{
        "explaination" : (str) A concise plain text explanation of the changes made. In the explanation, indicate any points of ambiguity (if any) that require attention from the user as a bulleted list at the end (e.g. missing codelists, ambiguity about < versus <=, unspecified dependencies). Format your explanation using markdown (e.g. lists for items to review).
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
    return response



@app.post("/execute_study")
async def execute_study(request: Request):
    logger.info("Received request!!!!")
    #
    # {
    #   'mappers': str (OMOPDomains / OptumEHRDomains / ...)
    #   'connection': {
    #        'SOURCE_DATABASE': ...
    #        'DEST_DATABASE': ...
    #        'connector_type': 'snowflake'
    #        'user': ...
    #   }
    #   'cohort': {
    #       'name': ...
    #       'description': ...
    #       ...
    #    }

    try:
        input_json = await request.json()
        logger.info(input_json)
        # mappers = PHENEX_MAPPERS[input_json['mappers']]
        # con = SnowflakeConnector(**input_json['connection'])
        # mapped_tables = mappers.get_mapped_tables(con)
        # cohort_config = input_json['cohort']
        # c = from_dict(cohort_config)
        # c.execute(mapped_tables, n_threads=6, con=con)
        logger.info(input_json)
        return {"status": 200}
    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))
