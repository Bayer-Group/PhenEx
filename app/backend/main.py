from fastapi import FastAPI, HTTPException, Request
from phenex.phenotypes import Cohort
from phenex.ibis_connect import SnowflakeConnector
from phenex.util.serialization import from_dict

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
    

