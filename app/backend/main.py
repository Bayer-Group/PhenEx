from fastapi import FastAPI, HTTPException, Request
from phenex.phenotypes import Cohort
from phenex.ibis_connect import SnowflakeConnector

from phenex import PHENEX_MAPPERS
from phenex_projects.mappers import PHENEX_PROJECTS_MAPPERS
PHENEX_MAPPERS.update(PHENEX_PROJECTS_MAPPERS)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/execute_study")
async def execute_study(request: Request):
    try:
        input_json = await request.json()
        mappers = PHENEX_MAPPERS[input_json['mappers']]
        con = SnowflakeConnector(**input_json['connection'])
        mapped_tables = mappers.get_mapped_tables(con)
        cohort_config = input_json['cohort']
        c = Cohort.from_json(cohort_config)
        c.execute(mapped_tables, n_threads=6, con=con)
        return {"status": 200}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

