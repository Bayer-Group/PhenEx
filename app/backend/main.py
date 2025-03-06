from typing import Dict
from fastapi import FastAPI, HTTPException, Request
import phenex
from phenex.ibis_connect import SnowflakeConnector
from phenex.util.serialization import from_dict
from dotenv import load_dotenv
import os, json, glob

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
    print(f"files found: {len(python_files)}")
    print(f"context length (words): {len(context.split())}")
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
    print("hello there")


@app.post("/text_to_cohort")
async def text_to_cohort(
    cohort_definition: str = "Generate a cohort of Atrial Fibrillation patients with no history of treatment with anti-coagulation therapies",
    current_cohort: Dict = None,
    model: str = "gpt-4o-mini",
):
    prompt = f"""
    Consider the following library code: 
        {context}

    Consider the currently defined cohort (which is possibly empty):

    {json.dumps(current_cohort, indent=4)}

    Modify the current Cohort according to the following instructions:
    {cohort_definition}

    Return a JSON compatible with phenex.util.serialization.from_dict.
    
    Where codelists are unknown, leave them as simply placeholders with a name and an empty codelist.
    """
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": prompt},
    ]
    return json.loads(
        openai_client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        .choices[0]
        .message.content
    )


@app.post("/execute_study")
async def execute_study(request: Request):
    print("Received request!!!!", request)
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
        print(input_json)
        # mappers = PHENEX_MAPPERS[input_json['mappers']]
        # con = SnowflakeConnector(**input_json['connection'])
        # mapped_tables = mappers.get_mapped_tables(con)
        # cohort_config = input_json['cohort']
        # c = from_dict(cohort_config)
        # c.execute(mapped_tables, n_threads=6, con=con)
        print(input_json)
        return {"status": 200}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
