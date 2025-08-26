from typing import Dict, Optional, Union
from fastapi import FastAPI, Body, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import ast
import phenex
import bcrypt
import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
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

# Required imports for authentication
import os
import sys
import traceback
import threading
import asyncio
from datetime import datetime, timedelta

# Constants and configuration
COHORTS_DIR = "/data/cohorts"
USERS_FILE = "/data/users/users.json"
SECRET_KEY = "your-secret-key-here"  # In production, use a proper secret key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Pydantic models for request/response
class UserCreate(BaseModel):
    username: str
    password: str
    email: str

class User(BaseModel):
    username: str
    email: str

class Token(BaseModel):
    access_token: str
    token_type: str

# OAuth2 scheme for JWT tokens
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# User management functions
def get_users():
    try:
        # Ensure the directory exists
        print("GETTING USERS")
        if os.path.exists(USERS_FILE):
            print("exists")
            with open(USERS_FILE, 'r') as f:
                return json.load(f)
        # If file doesn't exist, create it with an empty list
        print('doesnt exist')
        with open(USERS_FILE, 'w') as f:
            json.dump([], f)
        return []
    except Exception as e:
        logger.error(f"Error reading users file: {e}")
        raise HTTPException(status_code=500, detail=f"Error accessing user database: {str(e)}")

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        print("THIS is writing users")
        json.dump(users, f)
    print("RWOTE OK")

def get_user(username: str):
    users = get_users()
    return next((user for user in users if user['username'] == username), None)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user = get_user(username)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

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

@app.post("/register")
async def register(user: UserCreate):
    """
    Register a new user.
    
    Args:
        user: UserCreate object containing username, password, and email
        
    Returns:
        Dict with status message
        
    Raises:
        HTTPException: If registration fails due to validation or database errors
    """
    users = get_users()
    print(users)
    print('tat was users!!!')
    # Check if username already exists
    if any(u["username"] == user.username for u in users):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check if email already exists
    if any(u["email"] == user.email for u in users):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password strength
    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    
    print("got through")
    # Create new user with hashed password
    new_user = {
        "username": user.username,
        "password": get_password_hash(user.password),
        "email": user.email
    }
    print(new_user)
    
    users.append(new_user)
    save_users(users)
    
    return {"status": "success", "message": "User registered successfully"}

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticate a user and return a JWT token.
    
    Args:
        form_data: OAuth2PasswordRequestForm containing username and password
        
    Returns:
        Token object containing access token and token type
    """
    user = get_user(form_data.username)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    if not verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token({"sub": user["username"]})
    return Token(access_token=access_token, token_type="bearer")

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user information.
    
    Args:
        current_user: User object from the JWT token
        
    Returns:
        User object containing user information
    """
    return current_user

def get_cohort_path(cohort_id, provisional=False):
    if provisional:
        return os.path.join(COHORTS_DIR, f"cohort_{cohort_id}.provisional.json")
    else:
        return os.path.join(COHORTS_DIR, f"cohort_{cohort_id}.json")


# Add this helper function
def get_user_cohort_path(username: str, cohort_id: str, provisional: bool = False):
    """Get the path to a user's cohort file"""
    user_cohorts_dir = os.path.join(COHORTS_DIR, username)
    # Ensure user directory exists
    os.makedirs(user_cohorts_dir, exist_ok=True)
    if provisional:
        return os.path.join(user_cohorts_dir, f"cohort_{cohort_id}.provisional.json")
    return os.path.join(user_cohorts_dir, f"cohort_{cohort_id}.json")

# Modify the get_all_cohorts endpoint to accept username
@app.get("/cohorts")
async def get_all_cohorts_for_user(username: str):
    """
    Retrieve a list of all available cohorts for a specific user.

    Args:
        username (str): The username whose cohorts to retrieve.

    Returns:
        dict: A list of cohort IDs and names for that user.
    """
    print("GETTING COHORTS FOR USER", username)
    try:
        user_cohorts_dir = os.path.join(COHORTS_DIR, username)
        # Create directory if it doesn't exist
        os.makedirs(user_cohorts_dir, exist_ok=True)
        
        # Get only files from user's directory
        cohort_files = [
            f for f in os.listdir(user_cohorts_dir)
            if f.endswith(".json") and not f.endswith(".provisional.json")
        ]
        
        cohorts = []
        for cohort_file in cohort_files:
            with open(os.path.join(user_cohorts_dir, cohort_file), "r") as f:
                cohort = json.load(f)
                if "id" in cohort.keys():
                    cohort_id, cohort_name = cohort["id"], cohort["name"]
                    cohorts.append({"id": cohort_id, "name": cohort_name})
                else:
                    logger.info(f"No ID found in cohort {cohort["name"]}, {cohort}")
        return cohorts
    except Exception as e:
        logger.error(f"Failed to retrieve cohorts for user {username}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to retrieve cohorts for user {username}."
        )

# Modify the get_cohort endpoint to require username
@app.get("/cohort")
async def get_cohort_for_user(username: str, cohort_id: str, provisional: bool = False):
    """
    Retrieve a cohort by its ID for a specific user.

    Args:
        username (str): The username whose cohort to retrieve.
        cohort_id (str): The ID of the cohort to retrieve.
        provisional (bool): Whether to retrieve the provisional version of the cohort.

    Returns:
        dict: The cohort data.
    """
    try:
        cohort_path = get_user_cohort_path(username, cohort_id, provisional)
        if not os.path.exists(cohort_path):
            raise HTTPException(
                status_code=404,
                detail=f"Cohort not found for user {username}"
            )
        with open(cohort_path, "r") as f:
            return json.load(f)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving cohort for user {username}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve cohort for user {username}"
        )

# Modify the update_cohort endpoint to require username
@app.post("/cohort")
async def update_cohort_for_user(
    username: str,
    cohort_id: str,
    cohort: Dict = Body(...),
    provisional: bool = False
):
    """
    Update or create a cohort for a specific user.

    Args:
        username (str): The username whose cohort to update.
        cohort_id (str): The ID of the cohort to update.
        cohort (Dict): The complete JSON specification of the cohort.
        provisional (bool): Whether to save the cohort as provisional.

    Returns:
        dict: Status and message of the operation.
    """
    try:
        cohort_path = get_user_cohort_path(username, cohort_id, provisional)
        with open(cohort_path, "w") as f:
            json.dump(cohort, f, indent=4)
        return {
            "status": "success",
            "message": f"Cohort updated successfully for user {username}."
        }
    except Exception as e:
        logger.error(f"Failed to update cohort for user {username}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update cohort for user {username}"
        )

@app.delete("/cohort")
async def delete_cohort_for_user(username: str, cohort_id: str):
    """
    Delete a cohort by its ID.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.
        provisional (bool): Whether to retrieve the provisional version of the cohort.

    Returns:
        dict: The cohort data.
    """
    cohort_path = get_user_cohort_path(username, cohort_id)
    print(cohort_path)
    if os.path.exists(cohort_path):
        print("PATH EXISTS")
        os.remove(cohort_path)
    else:
        logger.error(f"Failed to retrieve cohort {cohort_id}")
        raise HTTPException(
            status_code=404, detail=f"Failed to find cohort {cohort_id}."
        )

    return {"status": "success", "message": f"Cohort {cohort_id} deleted successfully."}


@app.get("/publiccohorts")
async def get_public_cohorts():
    """
    Retrieve a list of all available cohorts.

    Returns:
        dict: A list of cohort IDs.
    """
    try:
        cohort_files = [
            f
            for f in os.listdir(COHORTS_DIR)
            if f.endswith(".json") and not f.endswith(".provisional.json")
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


@app.get("/publiccohort")
async def get_public_cohort(cohort_id: str, provisional: bool = False):
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
    return_updated_cohort: bool = False,
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
        results = query_faiss_index(query=query, top_k=top_k)
        context = "\n\n".join(results)
    except Exception as e:
        logger.error(f"Error during RAG search: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve context for the request."
        )

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
        model=model, stream=True, messages=messages
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
                        trailing_buffer = current_response[
                            -10:
                        ]  # Keep last 10 characters for next iteration

                    if "<JSON>" in current_response:
                        inside_json = True
                        json_buffer = current_response.split("<JSON>", 1)[1]
                        final_chunk = current_response.split("<JSON>", 1)[0]
                        yield final_chunk
                    elif inside_json:
                        json_buffer += current_response
                    elif not inside_json:
                        yield current_response[
                            :-10
                        ]  # Yield response excluding trailing buffer

        parsed_json = json_buffer.replace("</JSON>", "")
        logger.info(f"Parsed JSON: {parsed_json}")
        new_phenotypes = json.loads(json_buffer.replace("</JSON>", ""))
        logger.info(
            f"Suggested cohort revision: {json.dumps(new_phenotypes, indent=4)}"
        )

        c = CohortUtils()
        new_cohort = c.convert_phenotypes_to_structure(
            c.update_cohort(current_cohort, new_phenotypes)
        )
        await update_cohort(cohort_id, new_cohort, provisional=True)
        if return_updated_cohort:
            yield json.dumps(new_cohort, indent=4)
        logger.info(f"Updated cohort: {json.dumps(new_cohort, indent=4)}")

    return StreamingResponse(stream_response(), media_type="text/plain")


@app.post("/execute_study")
async def execute_study(
    cohort: Dict = None,
    database_config: Dict = None,
):
    """
    Execute a study using the provided cohort and database configuration with streaming output.

    Args:
        cohort (Dict): The cohort definition.
        database_config (Dict): The database configuration for the study.

    Returns:
        StreamingResponse: A stream of execution logs followed by the final results.
    """
    import sys
    import io
    import contextlib
    import asyncio
    from queue import Queue
    import threading
    import json
    
    async def stream_execution():
        # Create a queue to capture output
        output_queue = Queue()
        final_result = {}
        
        def capture_output():
            # Capture stdout and stderr
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            
            # Capture logging output
            import logging
            
            class StreamCapture:
                def __init__(self, queue, prefix=""):
                    self.queue = queue
                    self.prefix = prefix
                    
                def write(self, text):
                    if text.strip():  # Only send non-empty lines
                        self.queue.put(f"{self.prefix}{text}")
                    return len(text)
                    
                def flush(self):
                    pass
            
            # Custom logging handler to capture log messages
            class QueueHandler(logging.Handler):
                def __init__(self, queue):
                    super().__init__()
                    self.queue = queue
                    
                def emit(self, record):
                    try:
                        log_message = self.format(record)
                        level_name = record.levelname
                        self.queue.put(f"[{level_name}] {log_message}")
                    except Exception:
                        self.handleError(record)
            
            # Set up logging capture
            queue_handler = QueueHandler(output_queue)
            queue_handler.setFormatter(logging.Formatter('%(name)s - %(message)s'))
            
            # Get the root logger and add our handler
            root_logger = logging.getLogger()
            original_level = root_logger.level
            original_handlers = root_logger.handlers.copy()
            
            # Also specifically capture phenex logger messages
            phenex_logger = logging.getLogger('phenex')
            phenex_original_level = phenex_logger.level
            phenex_original_handlers = phenex_logger.handlers.copy()
            
            # Clear existing handlers and add our queue handler
            root_logger.handlers.clear()
            root_logger.addHandler(queue_handler)
            root_logger.setLevel(logging.INFO)  # Capture all log levels
            
            # Ensure phenex logger also uses our handler
            phenex_logger.handlers.clear()
            phenex_logger.addHandler(queue_handler)
            phenex_logger.setLevel(logging.INFO)
            phenex_logger.propagate = True  # Ensure messages propagate to root logger
            
            sys.stdout = StreamCapture(output_queue, "[STDOUT] ")
            sys.stderr = StreamCapture(output_queue, "[STDERR] ")
            
            try:
                print(f"Starting execution for cohort: {cohort.get('name', 'Unknown')}")
                logger.info(f"Starting execution for cohort: {cohort.get('name', 'Unknown')}")
                print(f"Database config: {database_config}")
                logger.info(f"Database configuration: {database_config}")
                
                if database_config["mapper"] == "OMOP":
                    from phenex.mappers import OMOPDomains
                    mapper = OMOPDomains
                    print("Using OMOP mapper")
                    logger.info("Using OMOP mapper")

                database = database_config["config"]
                print("Creating database connection...")
                logger.info("Creating Snowflake database connection...")
                
                con = SnowflakeConnector(
                    SNOWFLAKE_SOURCE_DATABASE=database["source_database"],
                    SNOWFLAKE_DEST_DATABASE=database["destination_database"],
                )
                print("Database connection established")
                logger.info("Database connection established successfully")

                print("Getting mapped tables...")
                logger.info("Retrieving mapped tables from database...")
                mapped_tables = mapper.get_mapped_tables(con)
                print(f"Found {len(mapped_tables)} mapped tables")
                logger.info(f"Successfully retrieved {len(mapped_tables)} mapped tables")
                
                del cohort["phenotypes"]
                print("Preparing cohort for phenex...")
                logger.info("Converting cohort data structure for phenex processing...")
                processed_cohort = prepare_cohort_for_phenex(cohort)

                print("Saving processed cohort...")
                logger.debug("Saving processed cohort to processed_cohort.json")
                with open("./processed_cohort.json", "w") as f:
                    json.dump(processed_cohort, f, indent=4)
                    
                print("Creating phenex cohort object...")
                logger.info("Creating phenex cohort object from processed data...")
                px_cohort = from_dict(processed_cohort)
                
                logger.debug("Saving cohort object to cohort.json")
                with open("./cohort.json", "w") as f:
                    json.dump(px_cohort.to_dict(), f, indent=4)

                print("Executing cohort...")
                logger.info("Starting cohort execution against mapped tables...")
                px_cohort.execute(mapped_tables)
                print("Appending counts...")
                logger.info("Appending patient counts to cohort results...")
                px_cohort.append_counts()

                path_cohort = get_path_cohort_files(cohort["id"])
                print(f"Saving results to: {path_cohort}")
                logger.info(f"Saving results to directory: {path_cohort}")

                print("Generating table1...")
                logger.info("Generating Table 1 (baseline characteristics)...")
                px_cohort.table1.to_csv(os.path.join(path_cohort, "table1.csv"))

                print("Generating waterfall report...")
                logger.info("Generating waterfall/attrition report...")
                from phenex.reporting import Waterfall
                r = Waterfall()
                df_waterfall = r.execute(px_cohort)
                df_waterfall.to_csv(os.path.join(path_cohort, "waterfall.csv"), index=False)

                print("Finalizing results...")
                logger.info("Finalizing and formatting results for return...")
                append_count_to_cohort(px_cohort, cohort)

                from json import loads, dumps
                cohort["table1"] = loads(px_cohort.table1.to_json(orient="split"))
                cohort["waterfall"] = loads(df_waterfall.to_json(orient="split"))

                final_result["cohort"] = cohort
                
                print("Saving final results...")
                logger.debug("Saving executed cohort to executed_cohort.json")
                with open("./executed_cohort.json", "w") as f:
                    json.dump(px_cohort.to_dict(), f, indent=4)

                logger.debug("Saving returned cohort to returned_cohort.json")
                with open("./returned_cohort.json", "w") as f:
                    json.dump(cohort, f, indent=4)
                    
                print("Execution completed successfully!")
                logger.info("Cohort execution completed successfully!")
                
            except Exception as e:
                print(f"ERROR: {str(e)}")
                import traceback
                print(f"TRACEBACK: {traceback.format_exc()}")
                final_result["error"] = str(e)
            finally:
                # Restore original stdout/stderr
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                
                # Restore original logging configuration
                root_logger.handlers.clear()
                for handler in original_handlers:
                    root_logger.addHandler(handler)
                root_logger.setLevel(original_level)
                
                # Restore phenex logger configuration
                phenex_logger.handlers.clear()
                for handler in phenex_original_handlers:
                    phenex_logger.addHandler(handler)
                phenex_logger.setLevel(phenex_original_level)
                
                output_queue.put("__EXECUTION_COMPLETE__")
        
        # Start execution in a separate thread
        execution_thread = threading.Thread(target=capture_output)
        execution_thread.start()
        
        # Stream output as it comes
        while True:
            try:
                # Check for output with a timeout
                if not output_queue.empty():
                    output = output_queue.get_nowait()
                    if output == "__EXECUTION_COMPLETE__":
                        break
                    yield f"data: {json.dumps({'type': 'log', 'message': output})}\n\n"
                else:
                    await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
            except:
                await asyncio.sleep(0.1)
        
        # Wait for thread to complete
        execution_thread.join()
        
        # Send final result
        if "error" in final_result:
            yield f"data: {json.dumps({'type': 'error', 'message': final_result['error']})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'result', 'data': final_result})}\n\n"
        
        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

    return StreamingResponse(
        stream_execution(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )


def append_count_to_cohort(phenex_cohort, cohort_dict):
    cohort_dict["entry_criterion"]["count"] = phenex_cohort.entry_criterion.count
    if isinstance(phenex_cohort.inclusions, list) and len(phenex_cohort.inclusions) > 0:
        append_count_to_phenotypes(phenex_cohort.inclusions, cohort_dict["inclusions"])
    if isinstance(phenex_cohort.exclusions, list) and len(phenex_cohort.exclusions) > 0:
        append_count_to_phenotypes(phenex_cohort.exclusions, cohort_dict["exclusions"])
    if (
        isinstance(phenex_cohort.characteristics, list)
        and len(phenex_cohort.characteristics) > 0
    ):
        append_count_to_phenotypes(
            phenex_cohort.characteristics, cohort_dict["characteristics"]
        )
    if isinstance(phenex_cohort.outcomes, list) and len(phenex_cohort.outcomes) > 0:
        append_count_to_phenotypes(phenex_cohort.outcomes, cohort_dict["outcomes"])


def append_count_to_phenotypes(phenex_phenotypes, list_of_phenotype_dicts):
    for phenex_phenotype, phenotype_dict in zip(
        phenex_phenotypes, list_of_phenotype_dicts
    ):
        phenotype_dict["count"] = phenex_phenotype.count


# -- CODELIST FILE MANAGEMENT ENDPOINTS
@app.get("/codelist_filesnames_for_cohort")
async def codelist_filesnames_for_cohort(cohort_id: str):
    """
    Get a list of codelist filenames for a given cohort ID.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.

    Returns:
        list: list of filenames
    """
    return get_codelist_filenames_for_cohort(cohort_id)


@app.get("/codelist_file_for_cohort")
async def codelist_file_for_cohort(cohort_id: str, file_id: str):
    """
    Get the contents of a codelist file for a given cohort ID and file ID.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.
        file_id (str): The ID of the file to retrieve.

    Returns:
        dict: codelist file contents
    """
    return get_codelist_file_for_cohort(cohort_id, file_id)


@app.post("/upload_codelist_file_to_cohort")
async def upload_codelist_file_to_cohort(cohort_id: str, file: dict):
    """
    Delete a cohort by its ID.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.
        file (dict): The file to upload.

    Returns:
        dict: The cohort data.
    """
    save_codelist_file_for_cohort(cohort_id, file["id"], file)
    return {
        "status": "success",
        "message": f"Uploaded {cohort_id} {file["id"]} successfully.",
    }


@app.delete("/codelist_file")
async def delete_codelist_file(cohort_id: str, file_id: str):
    """
    Delete a codelist file and it's contents.

    Args:
        cohort_id (str): The ID of the cohort to retrieve.
        file_id (str): The ID of the file to retrieve.
    """
    delete_codelist_file_for_cohort(cohort_id, file_id)

    return {
        "status": "success",
        "message": f"Codelist file {file_id} deleted successfully.",
    }


# -- CODELIST FILE MANAGEMENT --
# TODO import to codelist_file_management.py
def get_path_cohort_files(cohort_id):
    path_cohort_files = os.path.join(COHORTS_DIR, f"cohort_{cohort_id}")
    if not os.path.exists(path_cohort_files):
        os.makedirs(path_cohort_files)
    return path_cohort_files


def get_path_codelist(cohort_id, file_id):
    return os.path.join(get_path_cohort_files(cohort_id), f"codelist_{file_id}.json")


def get_path_cohort_index_file(cohort_id):
    """
    The cohort index file is located in the cohort directory. It contains a listing of files related to a cohort, for example, a list of all codelist files that have been uploaded by a user. # TODO : track cohort checkpoints in index file as well
    """
    return os.path.join(get_path_cohort_files(cohort_id), f"index.json")


def get_codelist_filenames_for_cohort(cohort_id):
    """
    Get a list of codelist filenames for a given cohort ID.
    Args:
        cohort_id (str): The ID of the cohort.
    Returns:
        list: A list of codelist filenames.
    """
    index_file_path = get_path_cohort_index_file(cohort_id)
    if not os.path.exists(index_file_path):
        return []
    with open(index_file_path, "r") as f:
        index = json.load(f)
    return index["uploaded_codelist_files"]


def get_codelist_file_for_cohort(cohort_id, file_id):
    """
    Get a codelist file for a given cohort ID and file ID.
    Args:
        cohort_id (str): The ID of the cohort.
        file_id (str): The ID of the codelist file.
    Returns:
        dict: The codelist file.
    """
    codelist_file_path = get_path_codelist(cohort_id, file_id)
    if not os.path.exists(codelist_file_path):
        return None
    with open(codelist_file_path, "r") as f:
        codelist_file = json.load(f)
    return codelist_file


def save_codelist_file_for_cohort(cohort_id, file_id, codelist_file):
    """
    Save a codelist file for a given cohort ID and file ID.
    Args:
        cohort_id (str): The ID of the cohort.
        file_id (str): The ID of the codelist file.
        codelist_file (dict): The codelist file.
    """
    codelist_file_path = get_path_codelist(cohort_id, file_id)
    with open(codelist_file_path, "w") as f:
        json.dump(codelist_file, f)
    index_file_path = get_path_cohort_index_file(cohort_id)
    if not os.path.exists(index_file_path):
        index = {"uploaded_codelist_files": []}
    else:
        with open(index_file_path, "r") as f:
            index = json.load(f)
    if file_id not in [x["id"] for x in index["uploaded_codelist_files"]]:
        index["uploaded_codelist_files"].append(
            {"id": file_id, "filename": codelist_file["filename"]}
        )
    with open(index_file_path, "w") as f:
        json.dump(index, f)


def delete_codelist_file_for_cohort(cohort_id, file_id):
    """
    Delete a codelist file for a given cohort ID and file ID.
    Args:
        cohort_id (str): The ID of the cohort.
        file_id (str): The ID of the codelist file.
    """
    codelist_file_path = get_path_codelist(cohort_id, file_id)
    if os.path.exists(codelist_file_path):
        os.remove(codelist_file_path)
    index_file_path = get_path_cohort_index_file(cohort_id)
    if os.path.exists(index_file_path):
        with open(index_file_path, "r") as f:
            index = json.load(f)
        if file_id in index["uploaded_codelist_files"]:
            index["uploaded_codelist_files"].remove(file_id)
        with open(index_file_path, "w") as f:
            json.dump(index, f)


# -- EXECUTION CODELIST MANAGEMENT --
# TODO import to codelist_file_management.py


def resolve_phenexui_codelist_file(phenexui_codelist):
    """
    Resolves a phenexui codelist file to a codelist object dict representation. PhenEx UI codelists of file type do not contain actual codes, rather only the name of the codelist file, a mapping of codelist columns, and the name of codelist to extract.
    Args:
        phenexui_codelist: The phenexui codelist representation.
    Returns:
        dict: The resolved PhenEx Codelist object dict representation with codes and code_type.
    """
    codelist_file = get_codelist_file_for_cohort(
        phenexui_codelist["cohort_id"], phenexui_codelist["file_id"]
    )

    # variables phenexui codelist components (for ease of reading...)
    code_column = phenexui_codelist["code_column"]
    code_type_column = phenexui_codelist["code_type_column"]
    codelist_column = phenexui_codelist["codelist_column"]
    data = codelist_file["contents"]["data"]

    # data are three parallel lists of code, code_type, codelist_name
    # get all codes/code_type for codelist_name
    codes_and_code_type = [
        [code, code_type]
        for code, code_type, codelist in zip(
            data[code_column], data[code_type_column], data[codelist_column]
        )
        if codelist == phenexui_codelist["codelist_name"]
    ]

    # convert into phenex codelist representation {code_type:[codes...]}
    phenex_codelist = {}
    for [code, code_type] in codes_and_code_type:
        if code_type not in phenex_codelist.keys():
            phenex_codelist[code_type] = []
        phenex_codelist[code_type].append(code)

    # return phenex Codelist representation
    return {
        "class_name": "Codelist",
        "name": phenexui_codelist["codelist_name"],
        "codelist": phenex_codelist,
        "use_code_type":False
    }


def resolve_medconb_codelist(phenexui_codelist):
    """
    Get Codelists from MedConB codelist files
    """
    return phenexui_codelist


def prepare_codelist_for_phenex(phenexui_codelist):
    """
    Prepares a single codelist from PhenEx UI for PhenEx execution by resolving codelists if necessary.
    Args:
        phenexui_codelist: A dictionary representing a codelist in the PhenEx UI.
    Returns:
        A dictionary representing PhenEx codelist with codes resolved
    """
    codelist_type = phenexui_codelist.get("codelist_type")
    if codelist_type is None:
        return phenexui_codelist
    if codelist_type == "manual":
        return phenexui_codelist
    elif codelist_type == "from file":
        return resolve_phenexui_codelist_file(phenexui_codelist)
    elif codelist_type == "from medconb":
        return resolve_medconb_codelist(phenexui_codelist)
    raise ValueError(f"Unknown codelist class: {phenexui_codelist['class_name']}")


def prepare_phenotypes_for_phenex(phenotypes: list[dict]):
    """
    Iterates over a list of phenotypes and prepares the codelist of each one for phenex.

    Args:
        phenotypes : List of phenotypes from PhenEx UI with codelists of various types
    Returns:
        List of phenotypes with codelists prepared for phenex
    """
    new_phenotypes = []
    # iterate over each phenotype
    for phenotype in phenotypes:
        # if it contains a codelist, prepare it for phenex
        if phenotype["class_name"] in ["CodelistPhenotype", "MeasurementPhenotype"]:
            phenotype = prepare_codelists_for_phenotype(phenotype)
        elif phenotype["class_name"] == "TimeRangePhenotype":
            phenotype = prepare_time_range_phenotype(phenotype)
    return phenotypes


def prepare_codelists_for_phenotype(
    phenotype: Union["CodelistPhenotype", "MeasurementPhenotype"]
):
    """
    Iterates over a list of phenotypes and prepares the codelist of each one for phenex.

    Args:
        phenotypes : List of phenotypes from PhenEx UI with codelists of various types
    Returns:
        List of phenotypes with codelists prepared for phenex
    """
    # iterate over each phenotype
    # if it is a list, create a composite codelist
    if isinstance(phenotype["codelist"], list):
        codelist = [prepare_codelist_for_phenex(x) for x in phenotype["codelist"]]
        composite_codelist = {
            "class_name": "CompositeCodelist",
            "codelists": codelist,
        }
        phenotype["codelist"] = composite_codelist
    else:
        phenotype["codelist"] = prepare_codelist_for_phenex(phenotype["codelist"])
    return phenotype


def prepare_time_range_phenotype(phenotype: "TimeRangePhenotype"):
    if (
        "relative_time_range" in phenotype.keys()
        and phenotype["relative_time_range"] != None
    ):
        if isinstance(phenotype["relative_time_range"], list):
            phenotype["relative_time_range"] = phenotype["relative_time_range"][0]
    return phenotype


def prepare_cohort_for_phenex(phenexui_cohort: dict):
    """
    Codelists in the UI are of three types : manual, from file, from medconb. Additionally, a single phenotype can receive a list of codelists, each of various types (manual, file, medconb). Prior to PhenEx execution, we resolve each codelist individually i.e. getting codes from the csv file or pulling them from medconb. Then, if a list of codelists is passed, we combine them into a single codelist and store original references in a CompositeCodelist class.

    Args:
        phenexui_cohort : The cohort dictionary representation generated by PhenExUI.
    Returns:
        phenex_cohort : The cohort dictionary representation with codelists ready for PhenEx execution
    """
    import copy

    phenex_cohort = copy.deepcopy(phenexui_cohort)
    phenex_cohort["entry_criterion"] = prepare_phenotypes_for_phenex(
        [phenex_cohort["entry_criterion"]]
    )[0]
    if "inclusions" in phenex_cohort.keys():
        phenex_cohort["inclusions"] = prepare_phenotypes_for_phenex(
            phenex_cohort["inclusions"]
        )
    if "exclusions" in phenex_cohort.keys():
        phenex_cohort["exclusions"] = prepare_phenotypes_for_phenex(
            phenex_cohort["exclusions"]
        )
    if "characteristics" in phenex_cohort.keys():
        phenex_cohort["characteristics"] = prepare_phenotypes_for_phenex(
            phenex_cohort["characteristics"]
        )
    if "outcomes" in phenex_cohort.keys():
        phenex_cohort["outcomes"] = prepare_phenotypes_for_phenex(
            phenex_cohort["outcomes"]
        )
    if "phenotypes" in phenex_cohort.keys():
        phenex_cohort["phenotypes"] = prepare_phenotypes_for_phenex(
            phenex_cohort["phenotypes"]
        )
    return phenex_cohort
