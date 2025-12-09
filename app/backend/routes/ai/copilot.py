"""
AI-powered cohort modification endpoint using Pydantic AI.
Clean, simple, and reliable approach.
"""

from typing import Dict, List, Optional, Any, Union
from fastapi import APIRouter, HTTPException, Request, Body, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
import json
import logging
import asyncio
import random
import string
import os
import asyncio
from pathlib import Path

# Disable verbose SQLAlchemy logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.dialects").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.orm").setLevel(logging.WARNING)

# Load environment variables from .env file
try:
    from dotenv import load_dotenv

    # Look for .env file in the project root
    project_root = Path(__file__).parent.parent.parent
    env_path = project_root / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logging.info(f"✅ Loaded environment variables from {env_path}")
    else:
        logging.warning(f"⚠️  .env file not found at {env_path}")
except ImportError:
    logging.warning("⚠️  python-dotenv not installed, skipping .env file loading")

# Import your existing utilities
try:
    # Try relative imports first (for normal FastAPI operation)
    from ...database import DatabaseManager, db_manager
    from ...utils import CohortUtils
    from .rag import query_faiss_index
except ImportError:
    # Fallback for direct imports (for testing)
    import sys
    from pathlib import Path

    backend_path = Path(__file__).parent.parent.parent
    sys.path.insert(0, str(backend_path))

    from database import DatabaseManager, db_manager
    from utils import CohortUtils
    from routes.ai.rag import query_faiss_index

logger = logging.getLogger(__name__)


# Pydantic models for request/response
class SuggestChangesRequest(BaseModel):
    user_request: str
    conversation_history: Optional[List[Dict]] = []
    cohort_description: Optional[str] = None


class PhenotypeParams(BaseModel):
    name: str
    description: str
    domain: str

    # Allow additional fields for functional parameters
    class Config:
        extra = "allow"


class StreamingContext:
    """Context for streaming feedback during AI operations."""

    def __init__(self):
        self.messages = []
        self.callbacks = []

    def add_callback(self, callback):
        """Add a callback function to receive streaming messages."""
        self.callbacks.append(callback)

    def stream_message(self, message_type: str, message: str):
        """Send a streaming message to all registered callbacks."""
        message_data = {"type": message_type, "message": message}
        self.messages.append(message_data)
        for callback in self.callbacks:
            try:
                callback(message_data)
            except Exception as e:
                logger.error(f"Error in streaming callback: {e}")


# Global streaming context - will be set during request handling
_current_streaming_context: Optional[StreamingContext] = None

# Global lock to prevent concurrent saves
_save_lock: Optional[asyncio.Lock] = None

# Global lock to prevent concurrent context updates
_context_lock: Optional[asyncio.Lock] = None

# Track if we need to auto-inject cohort state
_auto_inject_state = False
_pending_state_check = False
_last_operation_was_state_check = False


def get_streaming_context() -> Optional[StreamingContext]:
    """Get the current streaming context."""
    return _current_streaming_context


def set_streaming_context(context: Optional[StreamingContext]):
    """Set the current streaming context."""
    global _current_streaming_context
    _current_streaming_context = context


def get_save_lock() -> asyncio.Lock:
    """Get the global save lock, creating it if necessary."""
    global _save_lock
    if _save_lock is None:
        _save_lock = asyncio.Lock()
    return _save_lock


def get_context_lock() -> asyncio.Lock:
    """Get the global context lock, creating it if necessary."""
    global _context_lock
    if _context_lock is None:
        _context_lock = asyncio.Lock()
    return _context_lock


class DeletePhenotypeCall(BaseModel):
    id: str
    explanation: str


# Context for the AI agent
class CohortContext(BaseModel):
    user_id: str
    cohort_id: str
    study_id: str
    current_cohort: Dict
    db_manager: Any = None

    class Config:
        arbitrary_types_allowed = True


# Configure Azure OpenAI client for Pydantic AI
from openai import AsyncAzureOpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

# Configure the Pydantic AI agent with Azure OpenAI
try:
    # Create Azure OpenAI client
    azure_client = AsyncAzureOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_version=os.getenv("OPENAI_API_VERSION", "2024-07-01-preview"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    )

    # Create OpenAI model with Azure client
    azure_model = OpenAIChatModel(
        "gpt-4o-mini",
        provider=OpenAIProvider(openai_client=azure_client),
    )

    # Create agent with Azure model
    agent = Agent(
        azure_model,
        system_prompt="""
You are an expert medical researcher helping to build patient cohorts using the PhenEx framework.

Your job is to modify cohorts by adding, updating, or deleting phenotypes based on user requests. You may also advise the user on how to best use the Phenex library to implement a given study.

🧠 **UNDERSTANDING USER INTENT - READ THIS FIRST:**

⚠️ **CRITICAL: ALWAYS understand what the user wants BEFORE taking action!**

**🔍 TYPES OF USER REQUESTS:**

1. **INFORMATION ONLY** (No actions - just answer):
   - "What phenotypes are in this cohort?"
   - "Can you explain what [phenotype] does?"
   - "Why did that fail?"
   - "What's the difference between inclusion and exclusion?"
   - "How many patients will this capture?"
   → **RESPONSE: Provide information, explanations, or advice. DO NOT call any tools. DO NOT modify the cohort.**

2. **ACTION REQUESTS** (Execute changes):
   - "Add [phenotype]"
   - "Remove [phenotype]"
   - "Update [phenotype] to..."
   - "Change the age range to..."
   → **RESPONSE: Use tools to make the requested changes. Confirm what you did.**

3. **MIXED REQUESTS** (Answer question, then take action):
   - "Why didn't you use the file codelist? Please fix it."
   → **RESPONSE: First explain the reasoning, THEN fix the issue.**
   - "Can you explain what TimeRangePhenotype is? Then add one for 60 days of coverage."
   → **RESPONSE: First explain TimeRangePhenotype, THEN create it.**

4. **AMBIGUOUS REQUESTS** (Needs clarification):
   - "Do something with the diabetes phenotype"
   - "Fix the cohort"
   - "Update that thing we talked about"
   → **RESPONSE: Ask for clarification. DO NOT guess. DO NOT take action until you understand.**

**⚖️ GUIDING PRINCIPLES:**

✅ **DO THIS:**
- Read the user's request carefully to understand their intent
- If they want information → Give information (no tools)
- If they want action → Take action (use tools)
- If it's unclear → Ask for clarification first
- Do EXACTLY what they ask for - no more, no less
- Explain your reasoning when helpful

❌ **DO NOT DO THIS:**
- Don't start implementing things when user just wants information
- Don't ignore questions and just start working
- Don't do more than asked (e.g., user asks to add 1 phenotype, you add 3)
- Don't do less than asked (e.g., user asks for 3 exclusions, you only add 2)
- Don't guess what the user wants when it's ambiguous
- Don't assume - when in doubt, ask!

**📝 EXAMPLES:**

**Example 1: Information-only request**
User: "What's in this cohort right now?"
❌ WRONG: Start creating new phenotypes
✅ RIGHT: "Your cohort currently has 3 phenotypes: [list them with descriptions]. Would you like to modify any of these?"

**Example 2: Action request**
User: "Add hypertension as an exclusion"
❌ WRONG: Just explain what hypertension phenotypes are
✅ RIGHT: Create the phenotype, then confirm: "✅ I've added **Hypertension Exclusion** using ICD-10 codes..."

**Example 3: Ambiguous request**
User: "Do something about the age range"
❌ WRONG: Guess and change it to 18-65
✅ RIGHT: "What would you like me to do with the age range? Should I: 1) Change the minimum age? 2) Change the maximum age? 3) Remove it entirely?"

**Example 4: Mixed request**
User: "Why did that fail? And please fix it."
❌ WRONG: Just fix it without explaining
❌ WRONG: Just explain without fixing
✅ RIGHT: "It failed because [explanation]. I'll fix it now by [action]. ✅ Done - it's now configured correctly."

📢 **USER COMMUNICATION GUIDELINES:**

🗣️ **BE CONVERSATIONAL - ANSWER QUESTIONS FIRST:**
- **If the user asks a question, ANSWER IT** before doing any work
- **Engage in dialogue** - don't just narrate what you're doing
- **Examples of questions you should answer:**
  * "Why didn't you use the codelist from file?" → Explain your reasoning
  * "What's the difference between inclusion and exclusion?" → Provide explanation
  * "Can you explain what this phenotype does?" → Give clear explanation
  * "Why did that fail?" → Explain what went wrong and how to fix it
- **THEN execute any tasks** the user requested
- **Be helpful and explanatory** - don't just be a task-executing robot

💬 **PRESENTATION GUIDELINES:**
- **NEVER show IDs (phenotype / cohort / codelist or otherwise) to users** - IDs are for internal system use only
- **ALWAYS refer to phenotypes / cohorts / codelist by their NAME** (e.g., "Age >= 18", "Diabetes Diagnosis")
- **NEVER include "Configuration Details" sections with phenotype IDs** - users don't need to see IDs
- **NEVER copy/paste the "📊 CURRENT COHORT STATE" section into your response** - this is for YOUR reference only, not for the user
- **DO NOT include any "PHENOTYPE LIST" with IDs in your final response** - users don't need to see this technical information
- **NEVER show technical error messages directly** - collect them and summarize at the end
- **For missing codelists**: Don't show "❌ Error: No codelists found..." immediately
  - Instead, note the issue and continue with other tasks
  - At the END of your response, add a "Follow-up Questions" section summarizing any issues:
    * "I couldn't find a codelist for 'Hospitalization'. How should I implement this criterion?"
    * "I couldn't find a codelist for 'Haemorrhagic Shock'. Should I search with a different term?"
- **Focus on WHAT CHANGED** - Summarize what you added, modified, or deleted
- **Don't list the entire cohort state** - For large cohorts, this is overwhelming
- **Be concise** - Users can see the full cohort in the UI
- **Use friendly, professional language** - avoid technical jargon like "phenotype_id" in user messages
- **Tool calls show your work** - the frontend displays your tool operations as you work, so focus your text response on explaining what you accomplished

**GOOD RESPONSE EXAMPLE (focuses on changes):**
"✅ I've added the exclusion criterion **No Epinephrine**:
- Excludes patients with epinephrine exposure within 3 days before index
- Domain: DRUG_EXPOSURE
- Using the 'Epinephrin_source_codes' codelist from your files

Let me know if you need any adjustments!"

**ANOTHER GOOD EXAMPLE (multiple additions):**
"I've added 3 new exclusion criteria:
- **No Dobutamine** - within 14 days before index
- **No Milrinone** - within 14 days before index  
- **No Epinephrine** - within 3 days before index

All use drug codelists from your uploaded files.

**Follow-up Questions:**
I couldn't find a codelist for 'Vasopressin'. Should I search with a different term?"

**BAD RESPONSE EXAMPLE (Don't do this):**
"Configuration Details:
- Phenotype IDs for Reference:
  - Hospitalization Overlap: `B1BYK2NdcE`
  - ICU Stay Overlap: `oQvDYtnjAd`
  [... listing IDs that users don't need ...]"

🎯 TASK COMPLETION MANDATE:
- **ALWAYS complete the full user request before stopping**
- **Check that ALL parts of the request are satisfied**
- **If user asks for multiple things, do ALL of them**
- **Never stop after partial completion**

🔍 CRITICAL WORKFLOW RULES:
- **ALWAYS review the current cohort state** provided automatically before and after each operation
- **USE the injected cohort state information** to understand what phenotypes exist
- **NEVER assume what phenotypes exist** - rely on the automatically provided current state
- **NEVER EVER guess phenotype IDs** - the user message contains the EXACT IDs to use
- **COPY phenotype IDs exactly** from the provided list - do not modify, abbreviate, or guess variations
- **IF YOU GUESS AN ID, THE OPERATION WILL FAIL** - always use the exact IDs provided in the current state
- **VERIFY your changes worked** by reviewing the post-operation cohort state that is automatically shown
- **USE get_phenotype_info ONLY to understand phenotype CLASS capabilities, not to find specific phenotypes**

🚨 **CRITICAL: NEVER DEREFERENCE FILE-BASED CODELISTS**
When list_codelists finds matching codelists:
- ✅ CORRECT: atomic_update_codelist(phenotype_id="xyz", codelist_name="CABG_source_codes")
- ❌ WRONG: Fetching the codes and passing as manual_codelist parameter
- ❌ WRONG: Putting "CABG_source_codes" as a STRING in manual codelist format like {"ICD10": ["CABG_source_codes"]}
- File codelists are REFERENCES - they update automatically when the file changes
- Manual codelists are STATIC - they never update
- ALWAYS use codelist_name parameter when codelist exists in uploaded files

🎯 **CRITICAL: EXPLICIT CODES vs CODELIST FILES**

⚠️ **UNDERSTAND THE DIFFERENCE - This is critical for correct behavior!**

**When the user explicitly provides specific codes in their request:**
✅ **USE THOSE EXACT CODES** in a manual codelist structure
❌ **DO NOT search for or use codelist files/tables**

**When the user references a codelist by name or concept:**
✅ **Search with list_codelists() and use codelist_name parameter**
❌ **DO NOT create manual codes**

**EXAMPLES:**

**Example 1: User provides explicit codes**
User request: "Add a new exclusion criterion for hypertension using ICD-10 codes I10, I11, and I12"
✅ CORRECT approach:
   - The user gave you SPECIFIC codes: I10, I11, I12
   - Use manual_codelist with those EXACT codes:
     ```
     atomic_update_codelist(
       phenotype_id="xyz",
       manual_codelist={
         "codelist": {"ICD10": ["I10", "I11", "I12"]},
         "use_code_type": true,
         "remove_punctuation": false
       }
     )
     ```
❌ WRONG approach:
   - Calling list_codelists() to find "Hypertension" file
   - Using codelist_name="Hypertension" (ignores the user's explicit codes!)

**Example 2: User references a codelist table**
User request: "Add exclusion for hypertension using the Hypertension codelist table"
✅ CORRECT approach:
   - User referenced a codelist TABLE/FILE by name
   - Call list_codelists() to find it
   - Use codelist_name="Hypertension"
❌ WRONG approach:
   - Creating manual codes (ignores the user's request to use the file!)

**Example 3: User mentions condition without codes**
User request: "Add exclusion for hypertension"
✅ CORRECT approach:
   - User did NOT provide explicit codes
   - Call list_codelists() first to check if file exists
   - If found: use codelist_name
   - If not found: create reasonable manual codes or ask user for codes

**WHY THIS MATTERS:**
- Users who provide explicit codes want EXACTLY those codes, not a broader codelist file
- Codelist files may contain hundreds of codes (all hypertension subtypes)
- Explicit codes are intentionally limited for specific use cases
- Don't be "too helpful" by substituting file codelists when user gave explicit codes

🚨 **CRITICAL WORKFLOW FOR CodelistPhenotypes:**

⛔ ⛔ ⛔ **STOP! READ THIS BEFORE CREATING ANY CodelistPhenotypes!** ⛔ ⛔ ⛔

**YOU MUST CALL list_codelists() BEFORE EVERY BATCH OF CodelistPhenotypes!**
- If the user asks for 7 exclusions → Call list_codelists() ONCE at the start
- Then create all 7 phenotypes using the EXACT names from that list
- DO NOT create phenotypes and guess codelist names
- DO NOT skip list_codelists() - atomic_update_codelist will FAIL without exact names

⛔ **YOU CANNOT UPDATE A CODELIST WITHOUT CALLING list_codelists() FIRST!** ⛔

1. **First: create_phenotype(name="...", class_name="CodelistPhenotype", ...)** → Returns phenotype_id

2. **🔍 STOP! MANDATORY STEP - Call list_codelists() NOW!** 
   - ⛔ DO NOT SKIP THIS STEP - atomic_update_codelist will FAIL without it
   - ⛔ DO NOT GUESS codelist names - you will get them wrong
   - ⛔ DO NOT assume you know what codelists exist - you don't
   - This shows ALL available codelists with their EXACT names
   - You MUST use the EXACT name returned by list_codelists()
   - Example: list_codelists() returns "Epinephrin_source_codes" → use exactly that string (not "Epinephrine", not "Epinephrin", not "Epinephrine_codes")

3. **Match and inform user:**
   - If ONE relevant codelist found → Use it, tell user: "I used the '[codelist_name]' codelist from your files"
   - If MULTIPLE relevant found → Pick best match, tell user: "I used '[chosen_name]' (also found: [other options])"
   - If NONE relevant found → Create manual codes, tell user: "No matching codelist found, so I created custom codes with [code system]"
4. **Call atomic_update_codelist:**
   - If file codelist: atomic_update_codelist(phenotype_id="xyz", codelist_name="EXACT_NAME_FROM_LIST_CODELISTS")
   - If manual codes: atomic_update_codelist(phenotype_id="xyz", manual_codelist={...})
5. **Set other required fields:** atomic_update_domain (REQUIRED), optionally atomic_update_relative_time_range

**Example: User asks "No Epinephrine within 3 days before index"**
```
# Step 1: Create phenotype
result = create_phenotype(name="No Epinephrine", class_name="CodelistPhenotype", type="exclusion", description="...")
# Returns: phenotype_id = "abc123"

# Step 2: ⛔ MANDATORY - Call list_codelists() FIRST! ⛔
# DO NOT proceed to atomic_update_codelist without calling this!
codelists = list_codelists()
# Returns something like: "Epinephrin_source_codes (examples: 3992, 1490057, 66887)"
# Note: The exact name is "Epinephrin_source_codes" - NOT "Epinephrine", NOT "Epinephrine_codes"

# Step 3: Use file codelist with EXACT name from step 2
# Copy the EXACT string from list_codelists output!
atomic_update_codelist(phenotype_id="abc123", codelist_name="Epinephrin_source_codes")  # ← EXACT name!

# Step 4: Set domain
atomic_update_domain(phenotype_id="abc123", domain="DRUG_EXPOSURE")

# Step 5: Add time filter
atomic_update_relative_time_range(phenotype_id="abc123", relative_time_range=[{"class_name": "RelativeTimeRangeFilter", "when": "before", "max_days": {"class_name": "Value", "value": 3, "operator": "<="}}])
```

**What happens if you skip list_codelists():**
❌ You call: atomic_update_codelist(phenotype_id="abc123", codelist_name="Epinephrine")
❌ Result: ERROR - Codelist 'Epinephrine' not found (because the actual name is 'Epinephrin_source_codes')
✅ Correct: Call list_codelists() first, see the exact name, then use it

⏰ RECOGNIZING TEMPORAL REQUIREMENTS - READ THIS CAREFULLY:
When a user specifies TIME-BASED requirements, you MUST add relative_time_range filters. Look for these phrases:

**BEFORE index phrases** (use when="before", NO anchor_phenotype_id):
- "within X days before index" → max_days = X
- "X days prior to index" → max_days = X  
- "no history of [condition] X days before" → max_days = X (exclusion criterion)
- "lookback period of X days" → min_days = X (for continuous coverage)

**AFTER index phrases** (use when="after", NO anchor_phenotype_id):
- "within X days after index" → max_days = X
- "X days following index" → max_days = X
- "post-index X days" → max_days = X

**RELATIVE TO ANOTHER PHENOTYPE** (use anchor_phenotype_id="phenotype_id"):
- "within 30 days after [specific diagnosis name]" → Include anchor_phenotype_id
- "between first and second MI" → Include anchor_phenotype_id for first MI
- Only use anchor_phenotype_id when user EXPLICITLY names a different phenotype as anchor

🚨 **ANCHOR_PHENOTYPE_ID RULES:**
- ❌ DO NOT include anchor_phenotype_id for "after index", "before index", "after entry", "after cohort entry"
- ✅ ONLY include anchor_phenotype_id when user explicitly mentions another phenotype by name
- Why? Index date automatically tracks the entry criterion. Hard-coding breaks when entry changes.

**EXAMPLES of user requests that REQUIRE relative_time_range:**
- "No Dobutamine within 14 days before index" → when="before", max_days=14, NO anchor_phenotype_id
- "History of dialysis 30 days before" → when="before", max_days=30, NO anchor_phenotype_id
- "Mortality within 90 days after index" → when="after", max_days=90, NO anchor_phenotype_id
- "At least 60 days of lookback" → when="before", min_days=60, NO anchor_phenotype_id
- "Second MI within 30 days after first MI" → when="after", max_days=30, anchor_phenotype_id="first_mi_id"

🚨 **CRITICAL**: If the user mentions ANY time constraint (days, weeks, months, years), you MUST call atomic_update_relative_time_range!
DO NOT create phenotypes without time filters when the user explicitly specifies timing!

🎯 **ATOMIC OPERATION PRINCIPLE - ALWAYS FOLLOW THIS:**
All phenotype creation and modification MUST use small, atomic steps:

**REQUIRED WORKFLOW FOR ALL PHENOTYPES:**
1. **create_phenotype**(name, class_name, type, description) → returns phenotype_id
2. **atomic_update_*** functions to configure each field separately:
   - atomic_update_codelist (for CodelistPhenotype, MeasurementPhenotype)
   - atomic_update_value_filter (for AgePhenotype, MeasurementPhenotype)
   - atomic_update_domain (REQUIRED for ALL phenotypes)
   - atomic_update_return_date (for phenotypes that need it)
   - atomic_update_relative_time_range (for time-based filtering)
   - atomic_update_categorical_filter (for SexPhenotype)
   - atomic_update_nested_phenotype (for EventCountPhenotype)
3. **Verify all required fields are set** before considering the task complete

**Why atomic operations are mandatory:**
- ✅ Each step is logged separately (easier debugging)
- ✅ Validation happens at each step (catches errors immediately)
- ✅ AI reasoning is transparent (you can see each decision)
- ✅ Cannot bypass parameter validation
- ✅ Makes rollback easier if something fails
- ✅ Enforces correct workflow patterns

🚨 **IMPORTANT TOOL USAGE RULES:**
- **ONLY use create_phenotype + atomic_update_* workflow** - this is the ONLY supported pattern
- **NO ALL-IN-ONE TOOLS** - there is no "create complete phenotype" tool
- **Complete user requests fully** - if user asks for multiple changes, do them all
- **Only call tools that are DIRECTLY needed** for the user's request

🔧 AVAILABLE TOOLS:
**State inspection:**
- get_phenotype_info: Get detailed info about a PHENOTYPE CLASS (AgePhenotype, CodelistPhenotype, etc.)
- **Note: Current cohort state is automatically provided before and after each operation**

🔑 **UNDERSTANDING PHENOTYPES - Values and Dates:**
Every phenotype in PhenEx captures data that has two key components:
- **VALUE**: The measurement, code, or attribute (e.g., age=45, ICD10=E11, HbA1c=7.2)
- **DATE**: When this value was observed/recorded (e.g., diagnosis date, measurement date)

Both value and date can be NULL for some phenotypes. The filters you configure help define which values and dates are associated with a given phenotype:
- **Value filters** (value_filter): Define which VALUES qualify (e.g., age ≥18, HbA1c >6.5, event count ≥2)
- **Date filters** (relative_time_range, date_range): Define which DATES qualify (e.g., within 30 days before index, between 2015-2020)
- **Return date** (return_date): Which date to use when multiple qualify (first, last, nearest, all)

📋 AVAILABLE PHENOTYPE CLASSES:

**Phenotype Class Catalog:**
- **AgePhenotype**: Age range filtering (18-75 years, 65+, etc.)
- **CodelistPhenotype**: Medical code filtering (ICD-10, CPT, SNOMED, etc.)
- **MeasurementPhenotype**: Lab values with thresholds (HbA1c > 6.5, BMI < 30, etc.)
- **SexPhenotype**: Gender filtering (Male/Female)
- **DeathPhenotype**: Death-related criteria (typically type: "outcome")
- **TimeRangePhenotype**: Continuous coverage requirements (domain: OBSERVATION_PERIOD) - format automatically handled by atomic_update_relative_time_range
- **EventCountPhenotype**: Composite phenotype requiring a base phenotype, value_filter for event count, relative_time_range for days between events

📌 PHENOTYPE TYPES - Choose the appropriate type for each phenotype:
- **entry**: 🚨 SPECIAL - Defines the INDEX DATE that anchors the entire cohort. There can be ONLY ONE entry criterion. This is the primary condition or event that determines when the patient enters the cohort.
- **inclusion**: Patient must have this to be included in the cohort
- **exclusion**: Patient cannot have this to be in the cohort  
- **characteristic**: Describes patient attributes (demographics, measurements) but doesn't include/exclude
- **outcome**: Events/conditions we're measuring after index (mortality, readmissions, etc.)
- **component**: 🔧 INTERNAL - Not of direct interest to researchers, but used as a building block in computing another phenotype (e.g., the nested phenotype inside EventCountPhenotype)

**🚨 CRITICAL TYPE RULES:**
1. **ONLY ONE entry criterion allowed** - This phenotype defines the index date (time zero) for all other phenotypes
2. If a cohort already has an entry criterion, do NOT create another one - ask the user for clarification
3. The entry criterion is typically the primary diagnosis or condition (e.g., "First diabetes diagnosis", "Heart failure diagnosis")
4. All time-based filters (before/after) are relative to the entry criterion's date
5. **ALWAYS set type="component" for nested phenotypes** inside EventCountPhenotype - these are building blocks, not standalone criteria

**Type Selection Guidelines:**
- Use "entry" ONLY for the primary condition that sets the index date (e.g., first diabetes diagnosis)
  - ⚠️  If entry already exists and user asks for another, STOP and ask: "There's already an entry criterion (%existing_name%). Should I replace it or did you mean this as an inclusion criterion?"
- Use "inclusion" for required criteria (e.g., age range, continuous coverage, must have condition)
- Use "exclusion" for disqualifying conditions (e.g., pregnancy, cancer history, must NOT have condition)
- Use "characteristic" for descriptive data that doesn't filter (e.g., HbA1c measurements, BMI)
- Use "outcome" for follow-up events we're measuring (e.g., death within 1 year, hospitalizations after index)
- Use "component" for nested phenotypes that are part of another phenotype's computation (e.g., inside EventCountPhenotype)

**High-level operations:**
- create_phenotype: Create basic phenotype structure (name, class_name, type, description) - returns phenotype_id
- delete_phenotype: Remove phenotypes

**Atomic operations (PREFER THESE for targeted updates):**
- atomic_update_value_filter: Update numeric/range filters (age ranges, lab thresholds) **ONLY when user explicitly requests it** - requires complete value_filter object
- atomic_update_relative_time_range: Update time-based filters
- atomic_update_codelist: Add/update medical code lists for CodelistPhenotype **Use codelist_name parameter for file references, NOT manual codes**
  - 🎯 **CRITICAL**: ALWAYS use list_codelists first, then pass codelist_name parameter (creates REFERENCE)
  - ❌ **NEVER** dereference file codelists - pass manual_codelist ONLY if list_codelists shows no match
- list_codelists: List ALL uploaded codelist files with sample codes - **CALL THIS FIRST when user mentions medical conditions**
- atomic_update_nested_phenotype: Update nested phenotype for EventCountPhenotype **USE THIS instead of atomic_update_codelist for EventCountPhenotype**
- atomic_update_name: Update phenotype names
- atomic_update_description: Update descriptions
- atomic_update_domain: Update data domains
- atomic_update_type: Update phenotype type (inclusion/exclusion/etc)
- atomic_update_return_date: Update date return settings
- atomic_update_categorical_filter: Update categorical filters

⚠️ CRITICAL RULES - DO NOT MODIFY UNLESS EXPLICITLY REQUESTED:
**DO NOT modify existing codelists unless the user explicitly asks you to change the codes.**
- ✅ USE atomic_update_codelist: When user says "add diabetes codes", "change the codes to...", "use codelist X"
- ✅ USE atomic_update_codelist: When creating a CodelistPhenotype that needs codes (ALWAYS use codelist_name after list_codelists)
- ❌ DO NOT USE atomic_update_codelist: When user asks to add time filters, value filters, or other non-code modifications
- ❌ DO NOT USE atomic_update_codelist with manual_codelist: When list_codelists shows a matching codelist

**DO NOT modify existing value filters unless the user explicitly asks you to change them.**
- ✅ USE atomic_update_value_filter: When user says "change age to 25-70", "update HbA1c threshold to > 7.0", "set BMI range..."
- ✅ USE atomic_update_value_filter: When first creating an AgePhenotype or MeasurementPhenotype that needs initial filter
- ❌ DO NOT USE atomic_update_value_filter: When user asks to add time filters, codelists, or other non-value modifications

**Utility tools:**
- lookup_documentation: Search for parameter examples and guidance

🕐 **CRITICAL: RECOGNIZING TIME-BASED REQUIREMENTS:**
When the user's request includes ANY of these phrases, you MUST add a relative_time_range:
- "within X days before/after index" → relative_time_range required
- "X days before/after baseline" → relative_time_range required  
- "prior to index" → relative_time_range required
- "following index" → relative_time_range required
- "history of [condition]" → usually means "before index", add relative_time_range
- "no [condition] within X days" → exclusion criterion WITH relative_time_range

**Examples that REQUIRE relative_time_range:**
- "No Dobutamine within 14 days before index" → MUST add: relative_time_range with before, 0-14 days
- "Dialysis within 30 days after index" → MUST add: relative_time_range with after, 0-30 days
- "History of diabetes" → MUST add: relative_time_range with before (entire history)
- "At least 60 days of lookback" → TimeRangePhenotype with relative_time_range, 60+ days before

**If the user does NOT specify time constraints:**
- Only then can you omit relative_time_range (will match ANY time)
- But this is RARE - most clinical criteria have time boundaries

🚨 **CRITICAL MISTAKE TO AVOID:**
❌ WRONG: Creating CodelistPhenotype without relative_time_range when user says "within X days"
✅ CORRECT: ALWAYS add relative_time_range when time constraint is mentioned

🎯 STRATEGY:
1. **READ the current cohort state** - note the EXACT phenotype IDs provided
2. **COPY the exact phenotype ID** when you need to reference/modify/delete a phenotype
3. **Analyze the request carefully** - understand exactly what the user wants
4. **Use create_phenotype first** for new phenotypes - it creates a basic structure with ID
5. **READ THE create_phenotype RETURN VALUE** - it explicitly tells you the new phenotype's ID
6. **AFTER create_phenotype, read the AUTOMATIC STATE VERIFICATION** - confirms the new ID
7. **Use atomic_update_* functions** to configure each required field separately using the EXACT ID from steps 5 & 6
8. **Review the automatically provided post-operation state** - verify each change worked
9. **Complete the request** - ensure all required fields are configured
10. **Follow the configuration checklist** - see below for what each phenotype type needs

⚠️ CRITICAL ID RULE - READ THIS CAREFULLY:
**NEVER guess or invent phenotype IDs. ALWAYS use the exact ID from the tool return value or context.**

**WORKFLOW EXAMPLE - Creating and Configuring a New Phenotype:**
1. Call create_phenotype(name="One Year Mortality", class_name="DeathPhenotype", ...)
2. READ the return value: "✅ Created phenotype 'One Year Mortality' with ID 'abc123xyz'. 🚨 USE THIS EXACT ID: 'abc123xyz'"
3. READ the automatic state verification that follows, which lists: 'abc123xyz' (One Year Mortality)
4. Use the exact ID in next calls: atomic_update_relative_time_range(phenotype_id='abc123xyz', ...)

**COMMON MISTAKES TO AVOID:**
- ❌ WRONG: Using "one_year_mortality" (guessed from the name)
- ❌ WRONG: Using "mortality_001" (guessed pattern)
- ❌ WRONG: Using "diabetes" (using the name instead of ID)
- ✅ CORRECT: Using 'abc123xyz' (the exact ID from the return value)
- ✅ CORRECT: Copying ID from automatic state verification list
- The system provides updated context after EVERY operation - READ IT!

📋 PHENOTYPE CONFIGURATION CHECKLIST:

🚨 IMPORTANT: For optional fields, if you don't want to set them, OMIT them entirely from your JSON.
   DO NOT set optional fields to None/null - this will cause validation errors.
   If a field is not needed, simply don't include it in your phenotype structure.

🚨 CRITICAL: **domain is REQUIRED for ALL phenotype types** - Always set the appropriate domain using atomic_update_domain
   - Use exact domain names in UPPERCASE (e.g., "PERSON", "CONDITION_OCCURRENCE", "MEASUREMENT")
   - Each phenotype type has specific allowed domains (see below)

**For CodelistPhenotype (medical diagnosis, procedure or drug codes):**
✅ Required: codelist, domain, return_date
   - codelist: Specific medical codes (ICD-10, CPT, LOINC, etc.) - NOT "missing" - NOT code ranges
   - domain: REQUIRED - One of CONDITION_OCCURRENCE, PROCEDURE_OCCURRENCE, DRUG_EXPOSURE, VISIT_OCCURRENCE, MEASUREMENT depending on code type
   - return_date: REQUIRED - "first" (most common, earliest occurrence), "last" (most recent), "nearest" (closest to index), or "all" (all occurrences)
   - 🚨 DO NOT omit domain or return_date - they are BOTH REQUIRED for CodelistPhenotype
✅ Optional: relative_time_range
✅ Example flow: create_phenotype → atomic_update_codelist → atomic_update_domain → atomic_update_return_date → (optional) atomic_update_relative_time_range

**For AgePhenotype (age filters):**  
✅ Required: value_filter (min/max age ranges), domain
   - value_filter: Age range with min/max values
   - domain: REQUIRED - must be "PERSON" (note: uppercase)
✅ Example flow: create_phenotype → atomic_update_domain → atomic_update_value_filter

**For MeasurementPhenotype (lab values):**
✅ Required: codelist, domain, value_filter, return_date
   - codelist: LOINC codes for the lab test
   - domain: REQUIRED - must be "MEASUREMENT" (note: uppercase)
   - value_filter: Numeric thresholds (e.g., HbA1c > 6.5)
   - return_date: REQUIRED - "first", "last", "nearest", or "all"
✅ Optional: relative_time_range
✅ Example flow: create_phenotype → atomic_update_codelist → atomic_update_domain → atomic_update_value_filter → atomic_update_return_date

**For SexPhenotype (gender):**
✅ Required: categorical_filter, domain
   - categorical_filter: Gender values (Male/Female)
   - domain: REQUIRED - must be "PERSON" (note: uppercase)
✅ Example flow: create_phenotype → atomic_update_domain → atomic_update_categorical_filter

**For TimeRangePhenotype (continuous coverage requirements):**
✅ Required: relative_time_range, domain
   - relative_time_range: Time coverage requirements (e.g., 365 days before index)
   - domain: REQUIRED - must be "OBSERVATION_PERIOD" (note: uppercase)
✅ Note: You can pass relative_time_range as either a single object or array - atomic_update_relative_time_range automatically handles the format
✅ Example flow: create_phenotype → atomic_update_domain → atomic_update_relative_time_range

**For DeathPhenotype (mortality outcomes):**
✅ Required: domain
   - domain: REQUIRED - typically "DEATH" or "PERSON" (note: uppercase)
✅ Typically used as type="outcome" to track mortality after an event
✅ STRONGLY RECOMMENDED: relative_time_range to specify the follow-up window (e.g., 1 year mortality)
✅ Example flow: create_phenotype → atomic_update_domain → atomic_update_relative_time_range (to specify mortality window)
🚨 WARNING: Without relative_time_range, DeathPhenotype tracks ALL deaths regardless of timing, which is usually not what you want!

**For EventCountPhenotype (recurrent events within time window):**
✅ EventCountPhenotype counts events defined by a nested phenotype
✅ Required fields: 
   - phenotype (nested CodelistPhenotype with return_date="all", **type="component"**)
   - value_filter (event count threshold)
   - relative_time_range (days between events)
   - component_date_select (which event date to use as index: "first", "second", or "last")
✅ 🚨 CRITICAL: Use atomic_update_nested_phenotype to set the nested phenotype - NOT atomic_update_codelist!
✅ The nested `phenotype` field must be a complete CodelistPhenotype object with codelist, domain, return_date="all", **type="component"**
✅ 🚨 CRITICAL: Set component_date_select to choose which event date becomes the index:
   - "first": Use the date of the first event as index date
   - "second": Use the date of the second event as index date (recommended for "at least 2 events" scenarios)
   - "last": Use the date of the last event as index date
✅ Example flow: create_phenotype → atomic_update_nested_phenotype (with type="component") → atomic_update_value_filter → atomic_update_relative_time_range → atomic_update_component_date_select


🚨 **CRITICAL**: Use EXACT domain names as shown above (uppercase with underscores). The user message will provide the complete list of available domains from the database.

🏗️ PARAMETER STRUCTURES - USE THESE EXACT FORMATS:

**Value Filter Examples:**
- Greater than or equal to 30: `{"class_name": "ValueFilter", "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 30}}`
- Age range [21, 64]: `{"class_name": "ValueFilter", "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 21}, "max_value": {"class_name": "LessThanOrEqualTo", "value": 64}}`
- Lab value > 7.0: `{"class_name": "ValueFilter", "min_value": {"class_name": "GreaterThan", "value": 7.0}}`

**Codelist Examples:**
- ✅ FROM FILE (PREFERRED): atomic_update_codelist(phenotype_id="xyz", codelist_name="Heart_Failure") → Creates REFERENCE to uploaded codelist
- ✅ FROM FILE: atomic_update_codelist(phenotype_id="xyz", codelist_name="Type_2_Diabetes") → No codes needed, just the name!
- ✍️ MANUAL ICD codes (only if not in files): atomic_update_codelist(phenotype_id="xyz", manual_codelist={"codelist": {"ICD10": ["I50", "I50.9", "I11.0"]}, "use_code_type": true, "remove_punctuation": false})
- ✍️ MANUAL LOINC codes (only if not in files): atomic_update_codelist(phenotype_id="xyz", manual_codelist={"codelist": {"LOINC": ["2093-3"]}, "use_code_type": true, "remove_punctuation": false})

**Time Range Examples:**

🚨 CRITICAL: WHEN TO USE anchor_phenotype_id:
- ❌ DO NOT specify anchor_phenotype_id when referencing "index date" or "cohort entry" - this is the DEFAULT
- ✅ ONLY specify anchor_phenotype_id when user explicitly mentions ANOTHER phenotype as the anchor
- Why? If you don't specify it, changes to the entry criterion automatically flow through. If you hard-code it, the filter breaks when entry changes.

EXAMPLES (relative to INDEX DATE - NO anchor_phenotype_id):
- Last 60 days before index: `[{"class_name": "RelativeTimeRangeFilter", "when": "before", "min_days": {"class_name": "Value", "value": 0, "operator": ">="}, "max_days": {"class_name": "Value", "value": 60, "operator": "<="}}]`
- Within 365 days after index: `[{"class_name": "RelativeTimeRangeFilter", "when": "after", "min_days": {"class_name": "Value", "value": 0, "operator": ">="}, "max_days": {"class_name": "Value", "value": 365, "operator": "<="}}]`
- 365 days coverage before index: `{"class_name": "RelativeTimeRangeFilter", "when": "before", "min_days": {"class_name": "Value", "value": 365, "operator": ">="}}`

EXAMPLES (relative to SPECIFIC PHENOTYPE - WITH anchor_phenotype_id):
- User says "within 30 days after diabetes diagnosis": `[{"class_name": "RelativeTimeRangeFilter", "when": "after", "anchor_phenotype_id": "diabetes_001", "max_days": {"class_name": "Value", "value": 30, "operator": "<="}}]`
- User says "between first and second MI": `[{"class_name": "RelativeTimeRangeFilter", "when": "after", "anchor_phenotype_id": "first_mi_id", ...}]`


📋 CODELIST REQUIREMENT FOR CodelistPhenotypes:
- When creating a CodelistPhenotype, you MUST provide a codelist reference OR manual codes
- PREFERRED: Use codelist_name parameter to reference file-based codelists (NEVER dereference codes)
- FALLBACK: Use manual_codelist parameter ONLY when no file codelist exists
- NEVER use "missing" or placeholder values
- The codelist is added AFTER creating the phenotype using atomic_update_codelist

�🚨 CRITICAL CODELIST FORMAT (when specifying codes manually): The codelist field must be a SINGLE OBJECT (NOT an array) with this exact structure:
```
"codelist": {
    "codelist": {"ICD10": ["N18", "N18.1", "N18.2"]},
    "class_name": "Codelist", 
    "codelist_type": "manual",
    "use_code_type": true,
    "remove_punctuation": false
}
```
NEVER use array format like: "codelist": [{"codelist": ...}] ❌
NEVER use flat format like: "codelist": {"ICD10": ["N18"]} ❌

**When specifying codes manually, use standard medical coding systems:**
- ICD-10 for conditions (e.g., I50 for heart failure, E11 for type 2 diabetes)
- CPT for procedures
- LOINC for lab tests (e.g., 4548-4 for HbA1c)
- ALWAYS provide explicit lists of individual codes (e.g., E11, E11.0, E11.1, E11.2 for diabetes subtypes)
- NEVER use code ranges like "C00-C97" or "O00-O99" - always list codes explicitly

📝 CORRECT PHENOTYPE CREATION EXAMPLES:

**AgePhenotype with age range:**
```
# Step 1: Create phenotype
create_phenotype(
  name="Adult",
  class_name="AgePhenotype",
  type="inclusion",
  description="Adults aged 18-65"
)
# 🚨 READ THE RETURN VALUE! It will say: "✅ Created phenotype 'Adult' with ID 'def456ghi'"
# The ID in this example is: def456ghi

# Step 2: Set domain (REQUIRED)
atomic_update_domain(phenotype_id="def456ghi", domain="PERSON")

# Step 3: Set age range
atomic_update_value_filter(
  phenotype_id="def456ghi",
  value_filter={
    "class_name": "ValueFilter",
    "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 18},
    "max_value": {"class_name": "LessThanOrEqualTo", "value": 65}
  }
)
```

**CodelistPhenotype with file-based codelist (PREFERRED):**
```
# Step 1: List all available codelists
list_codelists()

# Step 2: Create phenotype
create_phenotype(
  name="Type 2 Diabetes",
  class_name="CodelistPhenotype",
  type="inclusion",
  description="Type 2 diabetes diagnosis"
)
# 🚨 READ THE RETURN VALUE! It will say: "✅ Created phenotype 'Type 2 Diabetes' with ID 'abc123xyz'"
# The ID in this example is: abc123xyz

# Step 3: Add codelist reference (using EXACT name from list AND actual ID from step 2)
atomic_update_codelist(
  phenotype_id="abc123xyz",  # 🚨 USE THE ACTUAL ID FROM STEP 2, NOT A PLACEHOLDER!
  codelist_name="Type_2_Diabetes"  # Exact name from list_codelists
)

# Step 4: Set required fields
atomic_update_domain(phenotype_id="abc123xyz", domain="CONDITION_OCCURRENCE")  # 🚨 SAME ID!
# (return_date already auto-initialized to "first")
```

**CodelistPhenotype with manual codes (ONLY if list_codelists shows no match):**
```
# Step 1: List codelists first
list_codelists()  # Check if any match exists

# Step 2: Create phenotype
create_phenotype(
  name="Rare Condition",
  class_name="CodelistPhenotype",
  type="inclusion",
  description="Rare condition codes"
)
# 🚨 READ THE RETURN VALUE! It will say: "✅ Created phenotype 'Rare Condition' with ID 'xyz789abc'"
# The ID in this example is: xyz789abc

# Step 3: Add manual codes (ONLY because search found nothing)
atomic_update_codelist(
  phenotype_id="xyz789abc",  # 🚨 USE THE ACTUAL ID FROM STEP 2, NOT A PLACEHOLDER!
  manual_codelist={
    "codelist": {"ICD10": ["E11", "E11.0", "E11.1"]},
    "use_code_type": true,
    "remove_punctuation": false
  }
)

# Step 4: Set required fields
atomic_update_domain(phenotype_id="xyz789abc", domain="CONDITION_OCCURRENCE")  # 🚨 SAME ID!
```

📝 CORRECT ATOMIC UPDATE EXAMPLES:

**Update Codelist** (use codelist parameter with correct nested structure):
```
# Set ICD codes
atomic_update_codelist(
  phenotype_id="<phenotype_id>",
  codelist={
    "codelist": {
      "ICD10": ["<code1>", "<code2>", "<code3>"]
    },
    "class_name": "Codelist",
    "codelist_type": "manual",
    "use_code_type": true,
    "remove_punctuation": false
  }
)

# Remove all codelists
atomic_update_codelist(
  phenotype_id="<phenotype_id>",
  codelist=None
)
```

**Update Nested Phenotype** (for EventCountPhenotype - use atomic_update_nested_phenotype, NOT atomic_update_codelist):
```
# Set nested phenotype for EventCountPhenotype
atomic_update_nested_phenotype(
  phenotype_id="<event_count_phenotype_id>",
  nested_phenotype={
    "name": "<Event Type Name>",
    "class_name": "CodelistPhenotype",
    "domain": "CONDITION_OCCURRENCE",
    "return_date": "all",  # REQUIRED for EventCountPhenotype
    "codelist": {
      "codelist": {"ICD10": ["<code1>", "<code2>"]},
      "class_name": "Codelist",
      "codelist_type": "manual",
      "use_code_type": true,
      "remove_punctuation": false
    }
  }
)
```

**Update Value Filter** (use value_filter parameter):
```
# Set value range
atomic_update_value_filter(
  phenotype_id="<phenotype_id>", 
  value_filter={
    "class_name": "ValueFilter",
    "min_value": {"class_name": "GreaterThanOrEqualTo", "value": <min_value>},
    "max_value": {"class_name": "LessThanOrEqualTo", "value": <max_value>}
  }
)

# Set minimum only (no upper limit)
atomic_update_value_filter(
  phenotype_id="<phenotype_id>", 
  value_filter={
    "class_name": "ValueFilter",
    "min_value": {"class_name": "GreaterThanOrEqualTo", "value": <min_value>},
    "max_value": None
  }
)

# Remove value filter completely
atomic_update_value_filter(
  phenotype_id="<phenotype_id>", 
  value_filter=None
)
```

**Update Time Range Filters**:
```
# Set time range filter
atomic_update_relative_time_range(
  phenotype_id="hospitalization_001", 
  relative_time_range=[{
    "class_name": "RelativeTimeRangeFilter",
    "when": "after",
    "min_days": {"class_name": "Value", "value": 0, "operator": ">="},
    "max_days": {"class_name": "Value", "value": 180, "operator": "<="}
  }]
)

# Remove all time range filters
atomic_update_relative_time_range(
  phenotype_id="hospitalization_001", 
  relative_time_range=None
)
```

📝 RESPONSE FORMATTING:
- **Always format your responses using proper Markdown syntax**
- **🚨 CRITICAL: Use SINGLE newline (`\n`) between list items, NOT double (`\n\n`)**
- Use **bullet points with dashes (-)** for lists
- Separate SECTIONS with blank lines, but keep list items together with single newlines
- Use **bold text with `**`** for field names and important information
- **FOCUS ON CHANGES MADE** - Summarize what was added, modified, or deleted
- **DON'T LIST THE ENTIRE COHORT** - For large cohorts (5+ phenotypes), only describe what changed
- **NEVER mention phenotype IDs in user responses** - only use phenotype names
- **Keep responses focused on phenotype names and functionality, not technical IDs**
- 🚨 **DO NOT copy the auto-injected "📊 CURRENT COHORT STATE" section into your response** - that's for your internal use only
- 🚨 **DO NOT show cohort ID or phenotype IDs to users** - they only see this in the UI, not in your text
- 🚨 **WHEN USER ASKS TO LIST PHENOTYPES**: List them BY NAME with their details (type, description), NOT with IDs
- Keep responses concise and focused on what was accomplished

💬 **COMMUNICATION WITH USER:**
- **ALWAYS communicate decisions you made** - If you chose a default value or made an assumption, tell the user
- **ASK for clarification when needed** - If the request is ambiguous, ask before proceeding
- **EXPLAIN why you need information** - Help the user understand what's missing
- **REPORT conflicts or issues** - If something doesn't work or conflicts (e.g., trying to add a second entry criterion), explain the problem clearly

**Examples of good communication:**
- "I've set the return_date to 'first' (earliest occurrence). Let me know if you'd prefer 'last' or 'nearest' instead."
- "I noticed you asked to add an entry criterion, but there's already one called 'Diabetes Diagnosis'. Should I replace it, or did you mean this as an inclusion criterion?"
- "I need to know which domain to use for this codelist. Is this for conditions (CONDITION_OCCURRENCE), procedures (PROCEDURE_OCCURRENCE), or medications (DRUG_EXPOSURE)?"
- "I couldn't find specific ICD codes for [condition]. Can you provide the codes, or should I search the uploaded codelist files?"

Example of GOOD response (concise with helpful context):
```
✅ Successfully added **Heart Failure Exclusion** criterion.

This excludes patients with heart failure diagnoses (ICD-10 codes I50.0, I50.1, I50.9) within 180 days after baseline.

Configuration details:
- Domain: CONDITION_OCCURRENCE
- Return date: "first" (earliest diagnosis)
- Time range: Within 180 days after index

Let me know if you need any adjustments!
```

Example of GOOD response (asking for clarification):
```
⚠️  I need some clarification before proceeding:

You asked to add an "Atrial Fibrillation Diagnosis" as an entry criterion, but there's already an entry criterion called **"Type 2 Diabetes Diagnosis"** which defines the index date.

A cohort can only have ONE entry criterion (it sets time zero for all other phenotypes). Would you like to:
1. Replace the diabetes entry with atrial fibrillation?
2. Add atrial fibrillation as an **inclusion** criterion instead?

Let me know how you'd like to proceed!
```

Example of BAD response (showing IDs and copying state info):
```
❌ DON'T DO THIS:

The cohort has been successfully updated.

📊 CURRENT COHORT STATE:
ID: abc123
Name: My Cohort
Total Phenotypes: 5

📋 PHENOTYPE LIST:
   1. ID: xyz789
      Name: Heart Failure Exclusion
      Type: exclusion
      ...
   
(❌ NEVER copy/paste the "CURRENT COHORT STATE" section - it's for YOUR reference only!)
(❌ NEVER show IDs to users - they don't need them!)
(❌ Users see the cohort in the UI - don't duplicate it in text!)
(❌ This doesn't explain what decisions you made or why!)
```

⚡ WORKFLOW:
1. Understand the user's request
2. Review the automatically provided current cohort state to see what phenotypes exist
3. **CHECK for entry criterion conflicts** - If user wants to add type="entry" and one exists, ask for clarification
4. **For CodelistPhenotypes:** Follow the CRITICAL WORKFLOW (create phenotype → list_codelists → match & inform → atomic_update_codelist → set other fields)
5. Use get_phenotype_info(class_name="SomePheno") ONLY if you need to understand what fields a phenotype class supports
6. Choose appropriate atomic function(s)
7. Use proper parameter structures
8. **Communicate decisions and ask questions** - Tell user what defaults you chose, ask for missing information
9. Provide clear explanations of what was accomplished

🚨 IMPORTANT: DO NOT guess phenotype IDs! The current cohort state shows you the exact IDs and names.
""",
        deps_type=CohortContext,
        retries=2,
    )
    logger.info("✅ Pydantic AI agent configured successfully with Azure OpenAI")

except Exception as e:
    logger.error(f"❌ Failed to configure AI agent: {e}")
    # Create a fallback that will show configuration errors
    agent = None

# Import atomic functions
try:
    # Try relative imports first (for normal FastAPI operation)
    from .atomic_functions import (
        update_value_filter,
        update_relative_time_range,
        update_codelist,
        update_name,
        update_description,
        update_domain,
        update_type,
        update_return_date,
        update_categorical_filter,
        update_nested_phenotype,
        update_component_date_select,
        get_phenotype_capabilities,
        PhenotypeValidationError,
    )
except ImportError:
    # Fallback for direct imports (for testing)
    from routes.ai.atomic_functions import (
        update_value_filter,
        update_relative_time_range,
        update_codelist,
        update_name,
        update_description,
        update_domain,
        update_type,
        update_return_date,
        update_categorical_filter,
        update_nested_phenotype,
        update_component_date_select,
        get_phenotype_capabilities,
        PhenotypeValidationError,
    )


# Pydantic model for simple phenotype creation
class CreatePhenotypeCall(BaseModel):
    name: str
    description: str
    class_name: str  # AgePhenotype, CodelistPhenotype, etc.
    type: str = "inclusion"  # inclusion, exclusion, characteristics


@agent.tool
async def create_phenotype(
    ctx: RunContext[CohortContext], call: CreatePhenotypeCall
) -> str:
    """Create a basic phenotype with just name, description, class_name, and type. Returns the phenotype_id for further configuration."""
    try:
        logger.info(f"Creating basic phenotype: {call.name} ({call.class_name})")

        # Log detailed tool call with parameters
        logger.info(
            f"🔧 TOOL CALL: create_phenotype(name='{call.name}', class_name='{call.class_name}', type='{call.type}', description='{call.description}')"
        )

        streaming_ctx = get_streaming_context()
        if streaming_ctx:
            streaming_ctx.stream_message(
                "tool_call", f"➕ Creating phenotype: {call.name}"
            )

        # Generate unique ID
        existing_phenotypes = await get_context_phenotypes(ctx.deps)
        existing_ids = {p.get("id") for p in existing_phenotypes}

        # 🚨 CRITICAL CHECK: Prevent multiple entry criteria
        if call.type == "entry":
            existing_entry = [
                p for p in existing_phenotypes if p.get("type") == "entry"
            ]
            if existing_entry:
                existing_entry_name = existing_entry[0].get("name", "Unknown")
                error_msg = f"❌ CONFLICT: Cannot create entry criterion '{call.name}' because an entry criterion already exists: '{existing_entry_name}'.\n\n💡 There can only be ONE entry criterion (it defines the index date). Did you mean to:\n1. Replace '{existing_entry_name}' with '{call.name}'?\n2. Create '{call.name}' as an inclusion criterion instead?\n\nPlease clarify what you'd like to do."
                logger.warning(error_msg)
                if streaming_ctx:
                    streaming_ctx.stream_message("tool_error", error_msg)
                return error_msg

        def generate_unique_id():
            while True:
                unique_id = "".join(
                    random.choices(string.ascii_letters + string.digits, k=10)
                )
                if unique_id not in existing_ids:
                    return unique_id

        phenotype_id = generate_unique_id()

        # Create minimal phenotype
        new_phenotype = {
            "id": phenotype_id,
            "name": call.name,
            "description": call.description,
            "class_name": call.class_name,
            "type": call.type,
            "params": {"name": call.name, "description": call.description},
        }

        # 🚨 CRITICAL: Auto-initialize return_date for phenotypes that require it
        # CodelistPhenotype and MeasurementPhenotype REQUIRE return_date to be set
        if call.class_name in ["CodelistPhenotype", "MeasurementPhenotype"]:
            new_phenotype["return_date"] = "first"
            logger.info(
                f"🔧 AUTO-INITIALIZED return_date='first' for {call.class_name}"
            )

        # 🚨 CRITICAL: Auto-initialize component_date_select and return_date for EventCountPhenotype
        # EventCountPhenotype REQUIRES component_date_select to be "first" or "second"
        if call.class_name == "EventCountPhenotype":
            new_phenotype["component_date_select"] = "second"  # Recommended default
            new_phenotype["return_date"] = "last"  # Default for EventCountPhenotype
            logger.info(
                f"🔧 AUTO-INITIALIZED component_date_select='second' and return_date='last' for EventCountPhenotype"
            )

        # Add to cohort and update context
        updated_phenotypes = existing_phenotypes + [new_phenotype]
        await update_context_only(ctx.deps, updated_phenotypes, f"Created {call.name}")

        if streaming_ctx:
            streaming_ctx.stream_message("tool_result", f"✅ Created {call.name}")

        # Automatically inject cohort state verification
        state_check = await auto_inject_cohort_state(ctx, f"creating {call.name}")

        # Add note about auto-initialized fields AND required next steps
        init_note = ""
        next_steps = ""

        if call.class_name in ["CodelistPhenotype", "MeasurementPhenotype"]:
            init_note = f" (return_date auto-initialized to 'first')"
            next_steps = (
                f"\n\n🚨 CRITICAL NEXT STEPS for {call.class_name}:\n"
                f"   1. ⛔ STOP! Call list_codelists() FIRST to see all available codelists\n"
                f"   2. atomic_update_codelist(phenotype_id='{phenotype_id}', codelist_name='EXACT_NAME_FROM_LIST') - ADD MEDICAL CODES\n"
                f"   3. atomic_update_domain(phenotype_id='{phenotype_id}', domain='...') - SET DOMAIN (e.g., 'CONDITION_OCCURRENCE', 'DRUG_EXPOSURE')\n"
                f"   4. (Optional) atomic_update_relative_time_range(phenotype_id='{phenotype_id}', ...) - ADD TIME FILTERS\n"
                f"   ⚠️  This phenotype is NOT usable until codelist AND domain are set!"
            )
        elif call.class_name == "EventCountPhenotype":
            init_note = f" (component_date_select auto-initialized to 'second', return_date to 'last')"
            next_steps = (
                f"\n\n🚨 CRITICAL NEXT STEPS for EventCountPhenotype:\n"
                f"   1. atomic_update_nested_phenotype(phenotype_id='{phenotype_id}', nested_phenotype={{...}}) - ADD NESTED PHENOTYPE (with type='component', return_date='all')\n"
                f"   2. atomic_update_value_filter(phenotype_id='{phenotype_id}', ...) - SET EVENT COUNT THRESHOLD (e.g., ≥2 events)\n"
                f"   3. atomic_update_relative_time_range(phenotype_id='{phenotype_id}', ...) - SET DAYS BETWEEN EVENTS\n"
                f"   4. 🔧 atomic_update_component_date_select(phenotype_id='{phenotype_id}', component_date_select='second') - CHOOSE WHICH EVENT DATE TO USE AS INDEX\n"
                f"      • 'first': Use date of first event as index\n"
                f"      • 'second': Use date of second event as index (RECOMMENDED for 'at least 2 events')\n"
                f"      • 'last': Use date of last event as index\n"
                f"   ⚠️  This phenotype is NOT complete until all 4 steps are done!"
            )
        elif call.class_name == "DeathPhenotype" and call.type == "outcome":
            next_steps = f"\n\n⚠️  RECOMMENDATION: Consider adding a relative_time_range to specify the mortality tracking window (e.g., 1 year after index). Use atomic_update_relative_time_range."
        elif call.class_name == "AgePhenotype":
            next_steps = f"\n\n⚠️  INCOMPLETE: This AgePhenotype needs a value_filter. Use atomic_update_value_filter to set age range."

        return f"✅ Created phenotype '{call.name}' with ID '{phenotype_id}'{init_note}. 🚨 USE THIS EXACT ID: '{phenotype_id}' for all future operations on this phenotype.{next_steps}{state_check}"

    except Exception as e:
        logger.error(f"Error creating phenotype: {e}")
        if streaming_ctx:
            streaming_ctx.stream_message(
                "tool_error", f"❌ Error creating {call.name}: {str(e)}"
            )
        return f"❌ Error creating {call.name}: {str(e)}"


@agent.tool
async def delete_phenotype(
    ctx: RunContext[CohortContext], call: DeletePhenotypeCall
) -> str:
    """Delete a phenotype from the cohort."""
    try:
        print(f"\n🗑️ DELETE_PHENOTYPE: Starting deletion of phenotype ID: {call.id}")
        logger.info(f"Deleting phenotype: {call.id}")

        # Log detailed tool call with parameters
        logger.info(
            f"🔧 TOOL CALL: delete_phenotype(id='{call.id}', explanation='{call.explanation}')"
        )

        # Send streaming feedback
        streaming_ctx = get_streaming_context()
        if streaming_ctx:
            streaming_ctx.stream_message("tool_call", f"🗑️ Deleting phenotype")

        # Get phenotypes from all categories (both flat and grouped structures)
        existing_phenotypes = await get_context_phenotypes(ctx.deps)

        # If no flat phenotypes, collect from grouped structure
        if not existing_phenotypes:
            for category in [
                "entry_criterion",
                "inclusions",
                "exclusions",
                "characteristics",
                "outcomes",
            ]:
                category_phenotypes = ctx.deps.current_cohort.get(category, [])
                if isinstance(category_phenotypes, list):
                    existing_phenotypes.extend(category_phenotypes)

        # Find phenotype to delete
        phenotype_to_delete = None
        for p in existing_phenotypes:
            if p.get("id") == call.id:
                phenotype_to_delete = p
                break

        if not phenotype_to_delete:
            print(f"🗑️ DELETE_PHENOTYPE: ❌ Phenotype ID {call.id} NOT FOUND in cohort")
            if streaming_ctx:
                streaming_ctx.stream_message("tool_error", f"Phenotype not found")
            return f"❌ Phenotype not found"

        # Remove phenotype from the list
        updated_phenotypes = [p for p in existing_phenotypes if p.get("id") != call.id]

        await update_context_only(ctx.deps, updated_phenotypes, f"Deleted {call.id}")

        phenotype_name = phenotype_to_delete.get("name", call.id)
        if streaming_ctx:
            streaming_ctx.stream_message(
                "tool_result", f"✅ Successfully deleted {phenotype_name}"
            )

        print(f"🗑️ DELETE_PHENOTYPE: ✅ COMPLETED deletion of {phenotype_name}")

        # Automatically inject cohort state verification
        state_check = await auto_inject_cohort_state(ctx, f"deleting {phenotype_name}")

        return f"✅ Successfully removed {phenotype_name}{state_check}"

    except Exception as e:
        logger.error(f"Error deleting phenotype: {e}")
        streaming_ctx = get_streaming_context()
        if streaming_ctx:
            streaming_ctx.stream_message(
                "tool_error", f"Error deleting {call.id}: {str(e)}"
            )
        return f"❌ Error deleting {call.id}: {str(e)}"


# ================== ATOMIC UPDATE TOOLS ==================


@agent.tool
async def atomic_update_value_filter(
    ctx: RunContext[CohortContext], phenotype_id: str, value_filter: Optional[Dict]
) -> str:
    """Update value filter for numeric/range filtering (ages, lab values, etc.).

    REQUIRED PARAMETERS:
    - phenotype_id: The exact ID of the phenotype to update
    - value_filter: ValueFilter configuration or None to remove filter entirely

    VALUE FILTER OPTIONS:
    - None: Remove value filter completely from phenotype
    - {"class_name": "ValueFilter", "min_value": {...}, "max_value": {...}}: Set specific ranges
    - min_value/max_value can be None to remove that bound

    EXAMPLES:
    - Remove filter: value_filter=None
    - Age >=25: value_filter={"class_name": "ValueFilter", "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 25}, "max_value": None}
    - Age 18-65: value_filter={"class_name": "ValueFilter", "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 18}, "max_value": {"class_name": "LessThanOrEqualTo", "value": 65}}
    - HbA1c > 6.5: value_filter={"class_name": "ValueFilter", "min_value": {"class_name": "GreaterThan", "value": 6.5}, "max_value": None}
    - No max limit: value_filter={"class_name": "ValueFilter", "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 25}, "max_value": None}
    """
    # 🚨 LOG PARAMETERS IMMEDIATELY - BEFORE ANY VALIDATION OR PROCESSING
    import json

    print(f"\n{'='*80}")
    print(f"🔧 ATOMIC_UPDATE_VALUE_FILTER CALLED")
    print(f"{'='*80}")
    print(f"phenotype_id: {phenotype_id}")
    print(f"value_filter type: {type(value_filter)}")
    print(f"value_filter value:")
    print(json.dumps(value_filter, indent=2) if value_filter else "None")
    print(f"{'='*80}\n")
    logger.info(
        f"🔧 ATOMIC_UPDATE_VALUE_FILTER: phenotype_id='{phenotype_id}', value_filter_type={type(value_filter)}, value_filter={value_filter}"
    )

    # Get phenotype name for user-friendly messages
    existing_phenotypes = await get_context_phenotypes(ctx.deps)
    phenotype_name = "Unknown"
    for p in existing_phenotypes:
        if p.get("id") == phenotype_id:
            phenotype_name = p.get("name", "Unnamed")
            break

    # Log detailed tool call with parameters
    logger.info(
        f"🔧 TOOL CALL: atomic_update_value_filter(phenotype_id='{phenotype_id}', value_filter={value_filter})"
    )

    # Send streaming feedback
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_call", f"🔢 Updating value filter for {phenotype_name}"
        )

    # Handle removal case
    if value_filter is None:
        # Remove value filter entirely
        logger.info(
            f"🔧 REMOVING value filter for phenotype {phenotype_id} ({phenotype_name})"
        )
        result = await update_value_filter(ctx, phenotype_id, None)
    else:
        # Validate structure for non-None case
        if (
            not isinstance(value_filter, dict)
            or value_filter.get("class_name") != "ValueFilter"
        ):
            return "❌ ERROR: value_filter must be None (to remove) or a dictionary with 'class_name': 'ValueFilter'. See examples in tool description."

        # Clean up None values - remove keys with None values to match expected structure
        cleaned_params = {"class_name": "ValueFilter"}
        if value_filter.get("min_value") is not None:
            cleaned_params["min_value"] = value_filter["min_value"]
        if value_filter.get("max_value") is not None:
            cleaned_params["max_value"] = value_filter["max_value"]

        # Require at least one bound
        if "min_value" not in cleaned_params and "max_value" not in cleaned_params:
            return "❌ ERROR: Must provide at least min_value or max_value (both can't be None). Use value_filter=None to remove filter entirely."

        logger.info(
            f"🔧 SETTING value filter for phenotype {phenotype_id} ({phenotype_name}) with cleaned params: {cleaned_params}"
        )
        result = await update_value_filter(ctx, phenotype_id, cleaned_params)

    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_result", f"✅ Successfully updated value filter for {phenotype_name}"
        )

    # Automatically inject cohort state verification
    state_check = await auto_inject_cohort_state(
        ctx, f"updating value filter for {phenotype_id}"
    )

    return result + state_check


@agent.tool
async def atomic_update_relative_time_range(
    ctx: RunContext[CohortContext],
    phenotype_id: str,
    relative_time_range: Optional[Union[Dict, List[Dict]]],
) -> str:
    """Update time range filters for a phenotype with type validation.

    REQUIRED PARAMETERS:
    - phenotype_id: The exact ID of the phenotype to update
    - relative_time_range: Time range configuration or None to remove filters entirely

    TIME RANGE OPTIONS:
    - None: Remove all time range filters from phenotype
    - [...]: Array of RelativeTimeRangeFilter objects (for CodelistPhenotype, MeasurementPhenotype, etc.)
    - {...}: Single RelativeTimeRangeFilter object (for TimeRangePhenotype ONLY - automatically detected)

    NOTE: This function automatically detects TimeRangePhenotype and handles format conversion.
    You can pass either a single object or array - the function will convert as needed.

    EXAMPLES:
    - Remove filters: relative_time_range=None
    - Time filter (any phenotype): relative_time_range=[{"class_name": "RelativeTimeRangeFilter", "when": "before", "min_days": {"class_name": "Value", "value": 0, "operator": ">="}, "max_days": {"class_name": "Value", "value": 30, "operator": "<="}}]
    - Coverage (TimeRangePhenotype): relative_time_range={"class_name": "RelativeTimeRangeFilter", "when": "before", "min_days": {"class_name": "Value", "value": 365, "operator": ">="}}
    """
    # Get phenotype to check its class_name
    existing_phenotypes = await get_context_phenotypes(ctx.deps)
    phenotype = None
    phenotype_name = "Unknown"
    for p in existing_phenotypes:
        if p.get("id") == phenotype_id:
            phenotype = p
            phenotype_name = p.get("name", "Unnamed")
            break

    if phenotype is None:
        return f"❌ ERROR: Phenotype with ID '{phenotype_id}' not found"

    phenotype_class = phenotype.get("class_name", "")

    # Log detailed tool call with parameters
    logger.info(
        f"🔧 TOOL CALL: atomic_update_relative_time_range(phenotype_id='{phenotype_id}', phenotype_class='{phenotype_class}', relative_time_range={relative_time_range})"
    )

    # Handle format conversion based on phenotype class
    if relative_time_range is not None:
        # TimeRangePhenotype needs a SINGLE object (not array)
        if phenotype_class in ["TimeRangePhenotype", "DeathPhenotype"]:
            # If AI passed an array, extract the single object
            if isinstance(relative_time_range, list):
                if len(relative_time_range) == 1:
                    relative_time_range = relative_time_range[0]
                else:
                    return f"❌ ERROR:  {phenotype_class} requires exactly one RelativeTimeRangeFilter, got {len(relative_time_range)}"
            elif not isinstance(relative_time_range, dict):
                return f"❌ ERROR:  {phenotype_class} requires a single RelativeTimeRangeFilter object"
        else:
            # All other phenotypes need an ARRAY
            if isinstance(relative_time_range, dict):
                # If AI passed a single object, wrap it in an array
                relative_time_range = [relative_time_range]
                logger.info(
                    f"🔄 CONVERTED single object to array for {phenotype_class}: {relative_time_range}"
                )
            elif not isinstance(relative_time_range, list):
                return f"❌ ERROR: {phenotype_class} requires an array of RelativeTimeRangeFilter objects"

    # Send streaming feedback
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_call", f"📅 Updating time range for {phenotype_name}"
        )

    result = await update_relative_time_range(ctx, phenotype_id, relative_time_range)

    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_result", f"✅ Successfully updated time range for {phenotype_name}"
        )

    # Automatically inject cohort state verification
    state_check = await auto_inject_cohort_state(
        ctx, f"updating time range for {phenotype_id}"
    )

    return result + state_check


@agent.tool
async def atomic_update_codelist(
    ctx: RunContext[CohortContext],
    phenotype_id: str,
    codelist_name: Optional[str] = None,
    codelist_id: Optional[str] = None,
    manual_codelist: Optional[Dict[str, Any]] = None,
) -> str:
    """Update codelist for a phenotype. Use EITHER codelist_name OR manual_codelist, not both.

    REQUIRED PARAMETERS:
    - phenotype_id: The exact ID of the phenotype to update

    CODELIST OPTIONS (choose ONE):

    1. 📂 FROM FILE (PREFERRED - use this when codelists exist in uploaded files):
       - codelist_name: Name of codelist found via list_codelists (e.g., "CABG_source_codes")
       - codelist_id: (Optional) Specific file ID if known
       - This creates a REFERENCE to the file codelist - codes are NOT copied
       - Changes to the codelist file will automatically affect the phenotype
       - ⚠️ ALWAYS use list_codelists FIRST to see available codelists
       - ⚠️ If list_codelists shows the codelist, you MUST use this mode

    2. ✍️ MANUAL CODES (ONLY when codelist NOT in database):
       - manual_codelist: Dict with structure {"codelist": {"ICD10": ["E11", "E11.0"]}, "use_code_type": true}
       - ⚠️ ONLY use this if list_codelists shows NO matching codelist
       - ⚠️ DO NOT use this if the codelist exists in uploaded files
       - Manual codes are static - changes to files won't update the phenotype

    3. 🗑️ REMOVE CODELIST:
       - Provide nothing (all params None except phenotype_id)

    🚨 CRITICAL WORKFLOW:
    1. ALWAYS call codelist_search first to check if codelist exists
    2. If codelist_search returns results → use codelist_name parameter
    3. If codelist_search returns empty → use manual_codelist parameter
    4. NEVER create manual codes when file codelist exists

    EXAMPLES:
    ✅ From file: codelist_name="CABG_source_codes"
    ✅ Manual (ONLY if not in files): manual_codelist={"codelist": {"ICD10": ["E11"]}, "use_code_type": true}
    ❌ WRONG: Creating manual codes when "CABG_source_codes" exists in codelist_search results
    """
    # 🚨 LOG PARAMETERS IMMEDIATELY - BEFORE ANY VALIDATION OR PROCESSING
    import json

    print(f"\n{'='*80}")
    print(f"🔧 ATOMIC_UPDATE_CODELIST CALLED")
    print(f"{'='*80}")
    print(f"phenotype_id: {phenotype_id}")
    print(f"codelist_name: {codelist_name}")
    print(f"codelist_id: {codelist_id}")
    print(
        f"manual_codelist: {json.dumps(manual_codelist, indent=2) if manual_codelist else None}"
    )
    print(f"{'='*80}\n")

    # Validate parameters - only ONE mode should be provided
    modes_provided = sum([codelist_name is not None, manual_codelist is not None])

    if modes_provided > 1:
        return "❌ ERROR: Provide EITHER codelist_name OR manual_codelist, not both!"

    # CASE 1: Remove codelist (all params None)
    if codelist_name is None and manual_codelist is None:
        logger.info(f"🗑️  Removing codelist from phenotype '{phenotype_id}'")
        codelist_to_set = None

    # CASE 2: From file reference
    elif codelist_name is not None:
        logger.info(f"🔍 Looking up codelist by name: '{codelist_name}'")
        try:
            user_id = ctx.deps.user_id
            cohort_id = ctx.deps.cohort_id
            db = ctx.deps.db_manager
            conn = await db.get_connection()

            try:
                # If codelist_id provided, search only that file
                if codelist_id:
                    sql_query = """
                        SELECT file_id, file_name, codelist_data, codelists, column_mapping 
                        FROM codelistfile 
                        WHERE user_id = $1 AND cohort_id = $2 AND file_id = $3
                    """
                    all_files = await conn.fetch(
                        sql_query, user_id, cohort_id, codelist_id
                    )
                else:
                    # Search all files in cohort
                    sql_query = """
                        SELECT file_id, file_name, codelist_data, codelists, column_mapping 
                        FROM codelistfile 
                        WHERE user_id = $1 AND cohort_id = $2
                    """
                    all_files = await conn.fetch(sql_query, user_id, cohort_id)
            finally:
                await conn.close()

            if not all_files:
                return f"❌ ERROR: No codelist files found in this cohort."

            print(f"🔍 SEARCHING FOR CODELIST: '{codelist_name}'")
            print(f"📁 Found {len(all_files)} codelist files to search")

            # Search for the codelist name in the actual data
            result = None
            found_codelist_name = None

            for file_row in all_files:
                file_data = file_row["codelist_data"]

                # Parse if string
                if isinstance(file_data, str):
                    import json

                    try:
                        file_data = json.loads(file_data)
                    except:
                        continue

                if not file_data:
                    continue

                # Search in the data structure
                contents = file_data.get("contents", {})
                data = contents.get("data", {})

                if not data:
                    continue

                # Find codelist column
                codelist_col = None
                for col in data.keys():
                    if "codelist" in col.lower():
                        codelist_col = col
                        break

                if not codelist_col:
                    print(
                        f"  ⚠️  File {file_row['file_id']}: No codelist column found in columns: {list(data.keys())}"
                    )
                    continue

                print(
                    f"  ✓ File {file_row['file_id']}: Using codelist column '{codelist_col}'"
                )

                # Get unique codelist names
                codelist_values = data.get(codelist_col, [])
                unique_codelists = set(codelist_values)
                # Show ALL codelists for debugging - critical for matching
                print(
                    f"  📊 Found {len(unique_codelists)} unique codelists: {sorted(list(unique_codelists))}"
                )

                # Try exact match first
                if codelist_name in unique_codelists:
                    print(f"  ✅ EXACT MATCH FOUND: '{codelist_name}'")
                    result = file_row
                    found_codelist_name = codelist_name
                    break

                # Try case-insensitive match
                codelist_name_lower = codelist_name.lower()
                for cl_name in unique_codelists:
                    if cl_name.lower() == codelist_name_lower:
                        print(
                            f"  ✅ CASE-INSENSITIVE MATCH: '{codelist_name}' → '{cl_name}'"
                        )
                        result = file_row
                        found_codelist_name = cl_name
                        break

                if result:
                    break

                # Try fuzzy match (replace spaces with underscores and vice versa)
                codelist_name_alt = codelist_name.replace(" ", "_")
                print(
                    f"  🔄 Trying fuzzy match (space→underscore): '{codelist_name}' → '{codelist_name_alt}'"
                )
                for cl_name in unique_codelists:
                    if cl_name.lower() == codelist_name_alt.lower():
                        print(
                            f"  ✅ FUZZY MATCH (space→_): '{codelist_name}' → '{cl_name}'"
                        )
                        result = file_row
                        found_codelist_name = cl_name
                        break

                if result:
                    break

                codelist_name_alt2 = codelist_name.replace("_", " ")
                print(
                    f"  🔄 Trying fuzzy match (_→space): '{codelist_name}' → '{codelist_name_alt2}'"
                )
                for cl_name in unique_codelists:
                    if cl_name.lower() == codelist_name_alt2.lower():
                        print(
                            f"  ✅ FUZZY MATCH (_→space): '{codelist_name}' → '{cl_name}'"
                        )
                        result = file_row
                        found_codelist_name = cl_name
                        break

                if result:
                    break

            if not result or not found_codelist_name:
                print(
                    f"❌ LOOKUP FAILED: Codelist '{codelist_name}' not found in any file"
                )
                return f"❌ ERROR: Codelist '{codelist_name}' not found. Use list_codelists() to see all available codelists and their exact names."

            # Get file_id
            file_id_found = result["file_id"]

            # 🚨 CRITICAL: Validate that we actually got a file ID
            if not file_id_found:
                print(
                    f"❌ INVALID FILE ID: Codelist '{codelist_name}' was found but has no file ID"
                )
                return f"❌ ERROR: Codelist '{codelist_name}' was found but has an invalid file ID (None). This indicates a database corruption issue."

            # Parse column_mapping if it's a JSON string
            column_mapping = result.get("column_mapping", {})
            if isinstance(column_mapping, str):
                import json

                column_mapping = json.loads(column_mapping)

            # Create a REFERENCE in the new format (file metadata goes inside codelist object)
            # This allows the codes to be updated in the file without updating the phenotype
            codelist_to_set = {
                "class_name": "Codelist",
                "codelist": {
                    "file_id": file_id_found,
                    "file_name": result.get(
                        "codelists", "unknown_file"
                    ),  # Get filename from database
                    "codelist_name": found_codelist_name,  # Specific codelist name within the file
                    "code_column": column_mapping.get("code_column", "code"),
                    "code_type_column": column_mapping.get(
                        "code_type_column", "code_type"
                    ),
                    "codelist_column": column_mapping.get(
                        "codelist_column", "codelist"
                    ),
                },
                "codelist_type": "from file",  # Note: space, not underscore
                "use_code_type": True,
                "remove_punctuation": False,
            }
            print(f"✅ CREATED CODELIST REFERENCE:")
            print(f"   file_id: {file_id_found}")
            print(f"   file_name: {result.get('codelists', 'unknown_file')}")
            print(f"   codelist_name: {found_codelist_name}")
            print(f"   code_column: {column_mapping.get('code_column', 'code')}")
            print(
                f"   code_type_column: {column_mapping.get('code_type_column', 'code_type')}"
            )
            print(
                f"   codelist_column: {column_mapping.get('codelist_column', 'codelist')}"
            )
            print(f"   codelist_type: from file")
            logger.info(
                f"✅ Created reference to codelist '{found_codelist_name}' (user requested: '{codelist_name}') from file '{file_id_found}'"
            )

        except Exception as e:
            return f"❌ ERROR: Failed to lookup codelist '{codelist_name}': {str(e)}"

    # CASE 3: Manual codelist
    elif manual_codelist is not None:
        logger.info(f"📝 Using manual codelist for phenotype '{phenotype_id}'")

        # Validate manual codelist format
        if not isinstance(manual_codelist, dict):
            return "❌ ERROR: manual_codelist must be a dict with structure: {'codelist': {'ICD10': ['codes']}, 'use_code_type': true, 'remove_punctuation': false}"

        if "codelist" not in manual_codelist:
            return "❌ ERROR: manual_codelist must have 'codelist' key with code mappings. Example: {'codelist': {'ICD10': ['E11']}}"

        if not isinstance(manual_codelist.get("codelist"), dict):
            return "❌ ERROR: manual_codelist['codelist'] must be a dict mapping code types to arrays. Example: {'ICD10': ['E11', 'E11.0']}"

        # Create manual codelist with proper structure
        codelist_to_set = {
            "codelist": manual_codelist["codelist"],
            "codelist_type": "manual",
            "class_name": "Codelist",
            "use_code_type": manual_codelist.get("use_code_type", True),
            "remove_punctuation": manual_codelist.get("remove_punctuation", False),
        }
        logger.info(
            f"✅ Created manual codelist with {sum(len(v) for v in manual_codelist['codelist'].values())} codes"
        )

    # Get phenotype name for user-friendly messages
    existing_phenotypes = await get_context_phenotypes(ctx.deps)
    phenotype_name = None
    for p in existing_phenotypes:
        if p.get("id") == phenotype_id:
            phenotype_name = p.get("name", "Unnamed")
            break

    # Log detailed tool call with parameters
    logger.info(
        f"🔧 TOOL CALL: atomic_update_codelist(phenotype_id='{phenotype_id}', codelist_name={codelist_name}, codelist_id={codelist_id}, manual_codelist={bool(manual_codelist)})"
    )

    # Send streaming feedback
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        if phenotype_name:
            streaming_ctx.stream_message(
                "tool_call", f"📋 Updating codelist for {phenotype_name}"
            )
        else:
            # Phenotype ID not found - show available phenotype NAMES (not IDs) to user
            valid_names = [p.get("name", "Unnamed") for p in existing_phenotypes]
            streaming_ctx.stream_message(
                "tool_error",
                f"❌ Could not find phenotype. Available phenotypes: {', '.join(valid_names)}",
            )

    if codelist_to_set is None:
        logger.info(
            f"🔧 REMOVING codelists for phenotype {phenotype_id} ({phenotype_name})"
        )
    else:
        logger.info(
            f"🔧 SETTING codelists for phenotype {phenotype_id} ({phenotype_name}) with params: {codelist_to_set}"
        )

    print(f"\n🔧 CALLING update_codelist:")
    print(f"   phenotype_id: {phenotype_id}")
    print(f"   codelist_to_set: {codelist_to_set}")
    print(f"   About to call update_codelist...")

    result = await update_codelist(ctx, phenotype_id, codelist_to_set)

    print(f"✅ update_codelist returned: {result}")

    # 🚨 CRITICAL: Auto-set return_date if missing for CodelistPhenotype/MeasurementPhenotype
    # These phenotypes REQUIRE return_date to be set, but AI might forget
    if result.startswith("✅") and codelist_to_set is not None:
        phenotype = None
        for p in existing_phenotypes:
            if p.get("id") == phenotype_id:
                phenotype = p
                break

        if phenotype:
            phenotype_class = phenotype.get("class_name", "")
            if phenotype_class in ["CodelistPhenotype", "MeasurementPhenotype"]:
                # Check if return_date is missing or None
                current_return_date = phenotype.get("return_date")
                if current_return_date is None:
                    logger.info(
                        f"🔧 AUTO-SETTING return_date='first' for {phenotype_class} (was None)"
                    )
                    await update_return_date(ctx, phenotype_id, "first")
                    result += f"\n🔧 Automatically set return_date='first' (required for {phenotype_class})"

    if streaming_ctx:
        if result.startswith("✅"):
            streaming_ctx.stream_message(
                "tool_result", f"✅ Successfully updated codelist for {phenotype_name}"
            )
        else:
            streaming_ctx.stream_message(
                "tool_error", f"Failed to update codelist for {phenotype_name}"
            )

    # Automatically inject cohort state verification (only if successful)
    if result.startswith("✅"):
        state_check = await auto_inject_cohort_state(
            ctx, f"updating codelist for {phenotype_id}"
        )
        return result + state_check
    else:
        return result


@agent.tool
async def atomic_update_name(
    ctx: RunContext[CohortContext], phenotype_id: str, name: str
) -> str:
    """Update name of a phenotype."""
    # Log detailed tool call with parameters
    logger.info(
        f"🔧 TOOL CALL: atomic_update_name(phenotype_id='{phenotype_id}', name='{name}')"
    )

    # Send streaming feedback
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_call", f"🏷️ Updating phenotype name to '{name}'"
        )

    result = await update_name(ctx, phenotype_id, name)

    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_result", f"✅ Successfully updated phenotype name"
        )

    return result


@agent.tool
async def atomic_update_description(
    ctx: RunContext[CohortContext], phenotype_id: str, description: str
) -> str:
    """Update description of a phenotype."""
    # Log detailed tool call with parameters
    logger.info(
        f"🔧 TOOL CALL: atomic_update_description(phenotype_id='{phenotype_id}', description='{description}')"
    )
    return await update_description(ctx, phenotype_id, description)


@agent.tool
async def atomic_update_domain(
    ctx: RunContext[CohortContext], phenotype_id: str, domain: str
) -> str:
    """Update domain of a phenotype with validation for allowed domains."""
    return await update_domain(ctx, phenotype_id, domain)


@agent.tool
async def atomic_update_type(
    ctx: RunContext[CohortContext], phenotype_id: str, phenotype_type: str
) -> str:
    """Update type (inclusion/exclusion/etc) of a phenotype."""
    return await update_type(ctx, phenotype_id, phenotype_type)


@agent.tool
async def atomic_update_return_date(
    ctx: RunContext[CohortContext], phenotype_id: str, return_date: str
) -> str:
    """Update return_date setting for a phenotype.

    REQUIRED PARAMETERS:
    - phenotype_id: The exact ID of the phenotype to update
    - return_date: One of "first" (earliest occurrence), "last" (most recent), "nearest" (closest to index), or "all" (all occurrences)

    🚨 CRITICAL: return_date must be a STRING, not a boolean!

    EXAMPLES:
    - First occurrence: return_date="first"
    - Most recent: return_date="last"
    - Closest to index: return_date="nearest"
    - All occurrences: return_date="all"
    """
    # Log detailed tool call with parameters
    logger.info(
        f"🔧 TOOL CALL: atomic_update_return_date(phenotype_id='{phenotype_id}', return_date='{return_date}')"
    )

    # Validate return_date value
    valid_values = ["first", "last", "nearest", "all"]
    if return_date not in valid_values:
        return (
            f"❌ ERROR: return_date must be one of {valid_values}, got: {return_date}"
        )

    return await update_return_date(ctx, phenotype_id, return_date)


@agent.tool
async def atomic_update_categorical_filter(
    ctx: RunContext[CohortContext],
    phenotype_id: str,
    categorical_filter: Optional[Dict],
) -> str:
    """Update categorical filter for a phenotype with type validation.

    REQUIRED PARAMETERS:
    - phenotype_id: The exact ID of the phenotype to update
    - categorical_filter: Categorical filter configuration or None to remove filter entirely

    CATEGORICAL OPTIONS:
    - None: Remove categorical filter from phenotype
    - {...}: Categorical filter object

    EXAMPLES:
    - Remove filter: categorical_filter=None
    - Male only: categorical_filter={"class_name": "CategoricalFilter", "values": ["Male"]}
    - Female only: categorical_filter={"class_name": "CategoricalFilter", "values": ["Female"]}
    """
    # Log detailed tool call with parameters
    logger.info(
        f"🔧 TOOL CALL: atomic_update_categorical_filter(phenotype_id='{phenotype_id}', categorical_filter={categorical_filter})"
    )
    return await update_categorical_filter(ctx, phenotype_id, categorical_filter)


@agent.tool
async def atomic_update_nested_phenotype(
    ctx: RunContext[CohortContext], phenotype_id: str, nested_phenotype: Dict
) -> str:
    """Update the nested phenotype field for composite phenotypes like EventCountPhenotype.

    🚨 USE THIS TOOL FOR EventCountPhenotype - NOT atomic_update_codelist!

    REQUIRED PARAMETERS:
    - phenotype_id: The exact ID of the EventCountPhenotype to update
    - nested_phenotype: Complete nested phenotype object (typically a CodelistPhenotype)

    CRITICAL: EventCountPhenotype requires:
    - A nested 'phenotype' field containing a complete CodelistPhenotype
    - The nested phenotype MUST have return_date="all" (not "first" or "last")
    - The nested phenotype should have codelist with medical codes

    EXAMPLE for EventCountPhenotype with AF codes:
    ```
    atomic_update_nested_phenotype(
      phenotype_id="event_count_123",
      nested_phenotype={
        "name": "AF Diagnosis Events",
        "class_name": "CodelistPhenotype",
        "domain": "CONDITION_OCCURRENCE",
        "return_date": "all",
        "codelist": {
          "codelist": {"ICD10": ["I48", "I48.0", "I48.1", "I48.2"]},
          "class_name": "Codelist",
          "codelist_type": "manual",
          "use_code_type": true,
          "remove_punctuation": false
        }
      }
    )
    ```
    """
    # Log detailed tool call
    logger.info(
        f"🔧 TOOL CALL: atomic_update_nested_phenotype(phenotype_id='{phenotype_id}', nested_phenotype={nested_phenotype})"
    )

    # Validate that nested phenotype has return_date="all" for EventCountPhenotype
    if nested_phenotype.get("return_date") != "all":
        logger.warning(
            f"⚠️  Nested phenotype should have return_date='all' for EventCountPhenotype, got: {nested_phenotype.get('return_date')}"
        )
        nested_phenotype["return_date"] = "all"
        logger.info(
            f"🔧 AUTO-CORRECTED return_date to 'all' for EventCountPhenotype compatibility"
        )

    # Get phenotype name for user-friendly messages
    existing_phenotypes = await get_context_phenotypes(ctx.deps)
    phenotype_name = "Unknown"
    for p in existing_phenotypes:
        if p.get("id") == phenotype_id:
            phenotype_name = p.get("name", "Unnamed")
            break

    # Send streaming feedback
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_call", f"🔗 Updating nested phenotype for {phenotype_name}"
        )

    result = await update_nested_phenotype(ctx, phenotype_id, nested_phenotype)

    if streaming_ctx:
        if result.startswith("✅"):
            streaming_ctx.stream_message(
                "tool_result",
                f"✅ Successfully updated nested phenotype for {phenotype_name}",
            )
        else:
            streaming_ctx.stream_message(
                "tool_error", f"Failed to update nested phenotype for {phenotype_name}"
            )

    # Automatically inject cohort state verification (only if successful)
    if result.startswith("✅"):
        state_check = await auto_inject_cohort_state(
            ctx, f"updating nested phenotype for {phenotype_id}"
        )
        return result + state_check
    else:
        return result


@agent.tool
async def atomic_update_component_date_select(
    ctx: RunContext[CohortContext], phenotype_id: str, component_date_select: str
) -> str:
    """Update the component_date_select field for EventCountPhenotype.

    🎯 **USE THIS ONLY FOR EventCountPhenotype**

    This field determines which event date becomes the index date for the patient.

    REQUIRED PARAMETERS:
    - phenotype_id: The exact ID of the EventCountPhenotype to update
    - component_date_select: Which event to use as index date

    VALID VALUES:
    - "first": Use the date of the FIRST qualifying event as index date
    - "second": Use the date of the SECOND qualifying event as index date
      💡 RECOMMENDED for "at least 2 events within X days" scenarios
    - "last": Use the date of the LAST qualifying event as index date

    EXAMPLE USAGE:
    For "at least 2 AF diagnoses within 90 days":
    ```
    atomic_update_component_date_select(
      phenotype_id="event_count_123",
      component_date_select="second"  # Use 2nd AF diagnosis as index date
    )
    ```

    WHY THIS MATTERS:
    - The index date determines when time windows are measured from
    - For "at least 2 events", using "second" ensures both events exist
    - For "at least 3 events", you might use "last" or "second" depending on requirements
    """
    # Log detailed tool call
    logger.info(
        f"🔧 TOOL CALL: atomic_update_component_date_select(phenotype_id='{phenotype_id}', component_date_select='{component_date_select}')"
    )

    # Get phenotype name for user-friendly messages
    existing_phenotypes = await get_context_phenotypes(ctx.deps)
    phenotype_name = "Unknown"
    for p in existing_phenotypes:
        if p.get("id") == phenotype_id:
            phenotype_name = p.get("name", "Unnamed")
            break

    # Send streaming feedback
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_call",
            f"📅 Setting component_date_select={component_date_select} for {phenotype_name}",
        )

    result = await update_component_date_select(
        ctx, phenotype_id, component_date_select
    )

    if streaming_ctx:
        if result.startswith("✅"):
            streaming_ctx.stream_message(
                "tool_result",
                f"✅ Successfully set component_date_select for {phenotype_name}",
            )
        else:
            streaming_ctx.stream_message(
                "tool_error",
                f"Failed to set component_date_select for {phenotype_name}",
            )

    # Automatically inject cohort state verification (only if successful)
    if result.startswith("✅"):
        state_check = await auto_inject_cohort_state(
            ctx, f"updating component_date_select for {phenotype_id}"
        )
        return result + state_check
    else:
        return result


@agent.tool
async def list_codelists(ctx: RunContext[CohortContext]) -> str:
    """List ALL available codelists in the study with example codes.

    🎯 **CALL THIS TOOL FIRST when user mentions medical conditions!**

    This tool lists ALL uploaded codelist files with their names and sample codes.
    Studies typically have 50-200 codelists, so we just show them all - no search needed.

    🔍 **WHEN TO USE:**
    - User mentions ANY medical condition (diabetes, heart failure, sepsis, etc.)
    - User asks to implement inclusion/exclusion criteria
    - Beginning of ANY request that might need medical codes
    - User says "use the codelist file" or "look up codes"
    - ALWAYS use this FIRST to see what codelists are available

    **Example user phrases that should trigger this tool:**
    - "Add diabetes exclusion" → Call list_codelists() to see available codelists
    - "Implement these inclusion criteria" → Call list_codelists() to see what's available
    - "Add heart failure diagnosis" → Call list_codelists() first
    - "what codelists are available?" → Call list_codelists()

    RETURNS:
    A complete list of ALL codelist names with 3 example codes from each.
    Format: "Diabetes Type 2 (examples: E11, E11.0, E11.1)"

    💡 **SMART MATCHING:** You can then fuzzy match user requirements to available codelists:
    - User says "sepsis" → Match to "Sepsis and Septic Shock (adult)"
    - User says "heart failure" → Match to "Heart Failure" or "HF_diagnosis"
    - User says "dialysis" → Match to "Dialysis_procedure_source_codes"

    ⚠️ **Important:** After calling this tool, you must reference codelists by their EXACT names
    when calling atomic_update_codelist(). Don't guess - use the exact string returned.

    WORKFLOW EXAMPLE:
    ```
    # User says: "Implement these 17 inclusion/exclusion criteria"

    # Step 1: Get ALL available codelists
    codelists = await list_codelists(ctx)
    # Returns: Complete list of all codelist names with examples

    # Step 2: Match user requirements to available codelists
    # User wants "sepsis" → You see "Sepsis and Septic Shock (adult)" in the list

    # Step 3: Create phenotype and reference by EXACT name from list
    await create_phenotype(ctx, name="sepsis_diagnosis", class_name="CodelistPhenotype", ...)
    await atomic_update_codelist(ctx, phenotype_id="xyz", codelist_name="Sepsis and Septic Shock (adult)")
    # ↑ Use the EXACT name from list_codelists() output!
    ```
    """
    logger.info(f"🔍 TOOL CALL: list_codelists()")

    # Send streaming feedback
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_call", "� Listing all available codelists..."
        )

    try:
        # Get user_id and cohort_id from context
        user_id = ctx.deps.user_id
        cohort_id = ctx.deps.cohort_id
        study_id = ctx.deps.study_id

        print(f"\n� LIST_CODELISTS DEBUG:")
        print(f"   user_id={user_id}")
        print(f"   cohort_id={cohort_id}")
        print(f"   study_id={study_id}")

        # Query codelists table in database
        db = ctx.deps.db_manager
        conn = await db.get_connection()

        try:
            # Fetch ALL codelist files for this cohort (no filtering)
            sql_query = """
                SELECT file_id, file_name, codelist_data, column_mapping, codelists 
                FROM codelistfile 
                WHERE user_id = $1 AND cohort_id = $2
                ORDER BY file_id
            """
            print(f"   Executing query with user_id={user_id}, cohort_id={cohort_id}")
            all_codelists = await conn.fetch(sql_query, user_id, cohort_id)
            print(f"   Found {len(all_codelists)} total codelist files")
        finally:
            await conn.close()

        print(f"   Found {len(all_codelists)} codelist files\n")

        if not all_codelists or len(all_codelists) == 0:
            msg = "NO_CODELISTS_UPLOADED: No codelist files have been uploaded to this study yet."
            logger.info(f"📋 list_codelists: {msg}")
            if streaming_ctx:
                streaming_ctx.stream_message("tool_result", msg)
            return msg

        # Format results - Extract all unique codelist names with sample codes
        results = []
        for row in all_codelists:
            codelist_data = row["codelist_data"]

            # Parse codelist_data if it's a JSON string
            if isinstance(codelist_data, str):
                import json

                try:
                    codelist_data = json.loads(codelist_data)
                except:
                    codelist_data = None

            if not codelist_data:
                continue  # Skip files with no data

            # Extract from contents.data structure
            contents = codelist_data.get("contents", {})
            data = contents.get("data", {})

            if not data:
                continue  # Skip files with no data columns

            columns = list(data.keys())
            print(f"   📊 File has columns: {columns}")

            # Find the codelist name column
            codelist_col = None
            for col in columns:
                if col.lower() == "codelist":
                    codelist_col = col
                    break
            if not codelist_col:
                for col in columns:
                    if "codelist" in col.lower():
                        codelist_col = col
                        break
            if not codelist_col:
                for col in columns:
                    if col.lower() in ["list", "condition", "phenotype"]:
                        codelist_col = col
                        break

            if not codelist_col:
                print(f"   ⚠️ No codelist column found in file")
                continue

            # Find the code column (typically 'code' or 'name')
            code_col = None
            for col in columns:
                if col.lower() in ["code", "codes"]:
                    code_col = col
                    break
            if not code_col:
                for col in columns:
                    if col.lower() in ["name", "value", "id"]:
                        code_col = col
                        break

            if not code_col:
                print(f"   ⚠️ No code column found in file")
                continue

            # Extract unique codelist names and their codes
            codelist_values = data.get(codelist_col, [])
            code_values = data.get(code_col, [])

            if not codelist_values or not code_values:
                continue

            # Group codes by codelist name
            codelist_to_codes = {}
            for i, codelist_name in enumerate(codelist_values):
                if i < len(code_values):
                    code = code_values[i]
                    if codelist_name not in codelist_to_codes:
                        codelist_to_codes[codelist_name] = []
                    codelist_to_codes[codelist_name].append(code)

            # Format each codelist with 3 sample codes
            for codelist_name, codes in sorted(codelist_to_codes.items()):
                sample_codes = ", ".join(str(c) for c in codes[:3])
                if len(codes) > 3:
                    sample_codes += f", ... ({len(codes)} total)"
                results.append(f"  • {codelist_name} (examples: {sample_codes})")

        result_msg = (
            f"✅ Found {len(results)} codelists across {len(all_codelists)} file(s):\n\n"
            + "\n".join(results)
        )

        logger.info(f"� list_codelists: Returning {len(results)} codelists")

        if streaming_ctx:
            streaming_ctx.stream_message("tool_result", result_msg)

        return result_msg

    except Exception as e:
        error_msg = f"❌ Error listing codelists: {str(e)}"
        logger.error(error_msg)
        if streaming_ctx:
            streaming_ctx.stream_message("tool_error", error_msg)
        return error_msg


async def get_current_cohort_from_context(context: CohortContext) -> str:
    """Get the current state of the entire cohort with all phenotypes. Helper for initial state display."""
    try:
        import traceback

        cohort = context.current_cohort
        cohort_id = cohort.get("id", "Unknown")
        cohort_name = cohort.get("name", "Unknown")

        # Get phenotypes from context
        phenotypes = await get_context_phenotypes(context)

        info = f"""📊 CURRENT COHORT STATE:
ID: {cohort_id}
Name: {cohort_name}
Total Phenotypes: {len(phenotypes)}

📋 PHENOTYPE LIST:
"""

        if not phenotypes:
            info += "   (No phenotypes in cohort)\n"
        else:
            for i, p in enumerate(phenotypes, 1):
                phenotype_id = p.get("id", "Unknown")
                name = p.get("name", "Unnamed")
                ptype = p.get("type", "Unknown")
                class_name = p.get("class_name", "Unknown")
                description = p.get("description", "No description")

                info += f"""   {i}. ID: {phenotype_id}
      Name: {name}
      Type: {ptype}
      Class: {class_name}
      Description: {description}
      
"""

        info += f"\n🔍 Use this information to understand the current state before making changes."
        return info

    except Exception as e:
        import traceback

        logger.error(f"Error getting current cohort from context: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return f"❌ Error retrieving current cohort state: {str(e)}"


async def get_current_cohort(ctx: RunContext[CohortContext]) -> str:
    """Get the current state of the entire cohort with all phenotypes. Used internally by auto-injection system."""
    try:
        cohort = ctx.deps.current_cohort
        cohort_id = cohort.get("id", "Unknown")
        cohort_name = cohort.get("name", "Unknown")

        # Get phenotypes from context
        phenotypes = await get_context_phenotypes(ctx.deps)

        info = f"""📊 CURRENT COHORT STATE:
ID: {cohort_id}
Name: {cohort_name}
Total Phenotypes: {len(phenotypes)}

📋 PHENOTYPE LIST:
"""

        if not phenotypes:
            info += "   (No phenotypes in cohort)\n"
        else:
            for i, p in enumerate(phenotypes, 1):
                phenotype_id = p.get("id", "Unknown")
                name = p.get("name", "Unnamed")
                ptype = p.get("type", "Unknown")
                class_name = p.get("class_name", "Unknown")
                description = p.get("description", "No description")

                info += f"""   {i}. ID: {phenotype_id}
      Name: {name}
      Type: {ptype}
      Class: {class_name}
      Description: {description}
      
"""

        info += f"\n🔍 Use this information to understand the current state before making changes."
        return info

    except Exception as e:
        logger.error(f"Error getting current cohort: {e}")
        return f"❌ Error retrieving current cohort state: {str(e)}"


async def auto_inject_cohort_state(
    ctx: RunContext[CohortContext], operation_description: str
) -> str:
    """Automatically inject current cohort state after a modification operation."""
    global _pending_state_check, _last_operation_was_state_check

    # Avoid duplicate consecutive state checks
    if _last_operation_was_state_check:
        _last_operation_was_state_check = False  # Reset for next operation
        return ""  # Skip this state check to avoid duplication

    _pending_state_check = True

    # Get current cohort state using the same logic as the tool
    cohort_state = await get_current_cohort(ctx)

    # Send to streaming context for visibility
    streaming_ctx = get_streaming_context()
    if streaming_ctx:
        streaming_ctx.stream_message(
            "tool_call", f"🔍 Auto-checking cohort state after {operation_description}"
        )
        streaming_ctx.stream_message("tool_result", f"📊 Current cohort state verified")
    else:
        print(f"🔍 AUTO_INJECT DEBUG: No streaming context available")

    _pending_state_check = False
    _last_operation_was_state_check = True  # Mark that we just did a state check

    # Extract phenotype IDs for explicit reminder
    phenotypes = await get_context_phenotypes(ctx.deps)
    phenotype_id_reminder = [f"'{p.get('id')}' ({p.get('name')})" for p in phenotypes]

    injection_text = f"\n\n🔍 **AUTOMATIC STATE VERIFICATION AFTER {operation_description.upper()}:**\n{cohort_state}\n\n🚨🚨🚨 **CRITICAL - THESE ARE THE ONLY VALID PHENOTYPE IDs - DO NOT GUESS OR INVENT IDs:**\n{chr(10).join([f'  - {pid}' for pid in phenotype_id_reminder]) if phenotype_id_reminder else '  (No phenotypes)'}'\n\n**If you need to modify any phenotype, copy the exact ID from the list above. DO NOT use phenotype names as IDs.**"

    return injection_text


@agent.tool
async def get_phenotype_info(ctx: RunContext[CohortContext], class_name: str) -> str:
    """Get detailed information about a phenotype class and its capabilities. Use this to understand what fields and parameters a phenotype class supports."""
    try:
        # Import phenotype classes dynamically to get docstrings
        class_map = {
            "AgePhenotype": "phenex.phenotypes.phenotype",
            "CodelistPhenotype": "phenex.phenotypes.codelist_phenotype",
            "MeasurementPhenotype": "phenex.phenotypes.measurement_phenotype",
            "SexPhenotype": "phenex.phenotypes.sex_phenotype",
            "DeathPhenotype": "phenex.phenotypes.death_phenotype",
            "TimeRangePhenotype": "phenex.phenotypes.time_range_phenotype",
            "EventCountPhenotype": "phenex.phenotypes.event_count_phenotype",
        }

        if class_name not in class_map:
            available = ", ".join(class_map.keys())
            return f"❌ Unknown phenotype class '{class_name}'. Available classes: {available}"

        # Import the class and get its docstring
        module_name = class_map[class_name]
        module = __import__(module_name, fromlist=[class_name])
        phenotype_class = getattr(module, class_name)

        docstring = phenotype_class.__doc__ or "No documentation available"

        # Get capabilities for structured info
        capabilities = get_phenotype_capabilities(class_name)

        info = f"""📋 Phenotype Class: {class_name}

🔧 Capabilities:
Supported fields: {', '.join(capabilities.get('supported_fields', []))}
Required fields: {', '.join(capabilities.get('requires', []))}
Allowed domains: {', '.join(capabilities.get('domain_restrictions', ['any']))}

📝 Documentation:
{docstring}
"""

        return info

    except Exception as e:
        logger.error(f"Error getting phenotype class info: {e}")
        return f"❌ Error retrieving phenotype class information: {str(e)}"


@agent.tool
async def lookup_documentation(ctx: RunContext[CohortContext], query: str) -> str:
    """Look up PhenEx documentation for parameter guidance."""
    try:
        logger.info(f"Looking up documentation: {query}")
        results = query_faiss_index(query=query, top_k=5)
        documentation = "\n\n".join(results)
        return f"📚 Documentation for '{query}':\n\n{documentation}"
    except Exception as e:
        logger.error(f"Error looking up documentation: {e}")
        return f"❌ Error retrieving documentation: {str(e)}"


async def get_context_phenotypes(context: CohortContext) -> List[Dict]:
    """Get phenotypes from context with lock protection."""
    async with get_context_lock():
        phenotypes = context.current_cohort.get("phenotypes", [])
        print(f"🔍 CONTEXT_READ: Phenotype IDs: {[p.get('id') for p in phenotypes]}")
        return phenotypes


async def update_context_only(
    context: CohortContext, updated_phenotypes: List[Dict], change_description: str
):
    """Helper to update context without saving to database. Uses lock to prevent concurrent modifications."""
    async with get_context_lock():

        # Update the context's phenotypes list directly
        if "phenotypes" in context.current_cohort:
            context.current_cohort["phenotypes"] = updated_phenotypes
            print(
                f"🔄 UPDATE_CONTEXT: ✅ Updated context phenotypes to phenotype IDs: {[p.get('id') for p in updated_phenotypes]}"
            )
        else:
            print(
                f"🔄 UPDATE_CONTEXT: Warning - no 'phenotypes' key in context.current_cohort"
            )


async def save_final_cohort(context: CohortContext, change_description: str):
    """Save the final cohort state after all AI operations are complete."""
    current_phenotypes = context.current_cohort.get("phenotypes", [])
    print(f"\n💾 FINAL_SAVE: Starting final save: {change_description}")
    print(f"💾 FINAL_SAVE: Final phenotype count: {len(current_phenotypes)}")

    # Use the full save_updated_cohort function for the final save
    await save_updated_cohort(context, current_phenotypes, change_description)


async def save_updated_cohort(
    context: CohortContext, updated_phenotypes: List[Dict], change_description: str
):
    """Helper to save updated cohort with concurrency protection."""
    # Use a lock to prevent concurrent saves that cause constraint violations
    async with get_save_lock():
        try:
            print(f"\n💾 SAVE_COHORT: Starting save operation: {change_description}")
            print(f"💾 SAVE_COHORT: Input phenotypes count: {len(updated_phenotypes)}")
            print(f"💾 SAVE_COHORT: Context object ID: {id(context)}")
            print(
                f"💾 SAVE_COHORT: Current_cohort object ID: {id(context.current_cohort)}"
            )
            logger.info(f"Saving updated cohort: {change_description}")

            # Create updated cohort data
            new_cohort_data = {
                "id": context.current_cohort["id"],
                "name": context.current_cohort["name"],
                "class_name": context.current_cohort["class_name"],
                "phenotypes": updated_phenotypes,
            }

            # Process through CohortUtils
            print(f"💾 SAVE_COHORT: Processing through CohortUtils...")
            cohort_utils = CohortUtils()
            new_cohort = cohort_utils.convert_phenotypes_to_structure(new_cohort_data)

            # Check what CohortUtils produced
            print(f"💾 SAVE_COHORT: After CohortUtils processing:")
            for category in [
                "entry_criterion",
                "inclusions",
                "exclusions",
                "characteristics",
                "outcomes",
            ]:
                cat_data = new_cohort.get(category, [])
                if isinstance(cat_data, list):
                    print(f"💾 SAVE_COHORT:   {category}: {len(cat_data)} items")
                    for i, item in enumerate(cat_data):
                        print(
                            f"💾 SAVE_COHORT:     {i}: {item.get('name')} (ID: {item.get('id')})"
                        )

            # Save as provisional, replacing existing provisional version
            print(f"💾 SAVE_COHORT: Saving to database...")
            logger.info(
                f"Saving provisional changes: user_id={context.user_id}, cohort_id={context.cohort_id}, study_id={context.study_id}"
            )
            await context.db_manager.update_cohort_for_user(
                context.user_id,
                context.cohort_id,
                new_cohort,
                context.study_id,
                provisional=True,
                new_version=False,  # Replace existing provisional version
            )

            # CRITICAL: Update the context's current_cohort with the processed structure
            # This ensures subsequent operations see the actual saved structure
            print(f"💾 SAVE_COHORT: Updating context with processed structure...")
            context.current_cohort.clear()
            context.current_cohort.update(new_cohort)

            # Verify the update worked
            print(f"💾 SAVE_COHORT: Context update verification:")
            if "phenotypes" in context.current_cohort:
                print(
                    f"💾 SAVE_COHORT:   Context has 'phenotypes' field with {len(context.current_cohort['phenotypes'])} items"
                )
            for category in ["inclusions", "exclusions"]:
                cat_data = context.current_cohort.get(category, [])
                if isinstance(cat_data, list):
                    print(
                        f"💾 SAVE_COHORT:   Context {category}: {len(cat_data)} items"
                    )
                    for item in cat_data:
                        print(
                            f"💾 SAVE_COHORT:     - {item.get('name')} (ID: {item.get('id')})"
                        )

            print(f"💾 SAVE_COHORT: ✅ Successfully completed save operation")
            logger.info(f"Successfully saved cohort: {change_description}")

        except Exception as e:
            print(f"💾 SAVE_COHORT: ❌ Error during save: {e}")
            logger.error(f"Error saving cohort: {e}")
            raise


# Import authentication utilities
from ...utils.auth import get_authenticated_user_id

# FastAPI router
router = APIRouter(tags=["AI"])


@router.post("/suggest_changes")
async def suggest_changes_v2(
    request: Request,
    req_body: SuggestChangesRequest = Body(...),
    cohort_id: str = Query(...),
    model: Optional[str] = Query("gpt-4o-mini"),
    return_updated_cohort: bool = Query(False),
):
    """
    AI-powered cohort modification endpoint with streaming feedback.

    This version uses Pydantic AI with real-time streaming to show users
    what the AI is doing as it modifies their cohort.

    Args:
        request: FastAPI request object
        cohort_id: ID of the cohort to modify
        req_body: Request body with user_request and conversation_history
        database_config: Optional database configuration to get domain mappers from.
                        If not provided, defaults to OMOP domains.
        model: AI model to use (default: gpt-4o-mini)
    """
    # Check if AI agent is properly configured
    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="AI agent not configured. Check Azure OpenAI credentials and network connectivity.",
        )

    user_id = get_authenticated_user_id(request)

    # Get current cohort
    current_cohort_record = await db_manager.get_cohort_for_user(user_id, cohort_id)
    if not current_cohort_record:
        raise HTTPException(status_code=404, detail=f"Cohort {cohort_id} not found")

    current_cohort = current_cohort_record["cohort_data"]
    study_id = current_cohort_record["study_id"]

    if not study_id:
        raise HTTPException(status_code=400, detail="study_id is required")

    # Clean up duplicated fields
    try:
        for field in [
            "entry_criterion",
            "inclusions",
            "exclusions",
            "characteristics",
            "outcomes",
        ]:
            current_cohort.pop(field, None)
    except KeyError:
        pass

    # Prepare context and capture initial state for comparison
    initial_cohort_data = current_cohort.copy()
    context = CohortContext(
        user_id=user_id,
        cohort_id=cohort_id,
        study_id=study_id,
        current_cohort=current_cohort,
        db_manager=db_manager,
    )

    # Get initial cohort state for the AI
    global _last_operation_was_state_check
    initial_state = await get_current_cohort_from_context(context)
    _last_operation_was_state_check = True  # Mark that we just showed the state

    # Extract phenotype IDs for explicit instruction
    current_phenotypes = current_cohort.get("phenotypes", [])
    phenotype_id_list = [
        f"'{p.get('id')}' ({p.get('name')})" for p in current_phenotypes
    ]

    # Get available domains from the database configuration
    try:
        # Use OMOP domains by default
        from phenex.mappers import OMOPDomains

        mapper = OMOPDomains
        logger.info("Using default OMOP domains")

        available_domains = list(mapper.keys())
        domain_info = f"\n\n🗂️ **AVAILABLE DATABASE DOMAINS (use these exact names):**\n{', '.join(available_domains)}\n"
    except Exception as e:
        logger.warning(f"Could not load domain mappers: {e}")
        available_domains = []
        domain_info = ""

    # Build conversation history as a string to inject into the user message
    conversation_context = ""
    print(f"\n🔍 DEBUG: CONVERSATION HISTORY:")
    print(f"Received {len(req_body.conversation_history)} entries")

    if req_body.conversation_history:
        conversation_context = "\n📜 **CONVERSATION HISTORY:**\n"
        for i, entry in enumerate(req_body.conversation_history):
            print(f"  Entry {i}: {entry}")
            if "user" in entry and entry["user"]:
                conversation_context += f"User: {entry['user']}\n"
            elif "system" in entry and entry["system"]:
                conversation_context += f"Assistant: {entry['system']}\n"
            elif "user_action" in entry and entry["user_action"]:
                conversation_context += f"[USER ACTION: {entry['user_action']}]\n"
        conversation_context += "\n"

    # Build cohort description context
    description_context = ""
    if req_body.cohort_description:
        print(f"\n📝 DEBUG: COHORT DESCRIPTION PROVIDED")
        print(f"Description length: {len(req_body.cohort_description)} characters")
        description_context = f"\n📋 **COHORT DESCRIPTION (User's Study Definition):**\n{req_body.cohort_description}\n\n"

    # Build the current user message with conversation history and description injected
    user_message = f"""{conversation_context}{description_context}🔍 **CURRENT COHORT STATE:**
{initial_state}
{domain_info}
🚨🚨🚨 **MANDATORY: THESE ARE THE ONLY VALID PHENOTYPE IDs - DO NOT MODIFY OR GUESS ALTERNATIVES!** 🚨🚨🚨
{', '.join(phenotype_id_list) if phenotype_id_list else 'No phenotypes in cohort'}

🚨🚨🚨 **WARNING: IF YOU USE ANY ID NOT LISTED ABOVE, THE OPERATION WILL FAIL!** 🚨🚨🚨

User request: {req_body.user_request}

🚨 **CRITICAL RULES:**
- ONLY use the exact phenotype IDs listed above
- DO NOT modify, abbreviate, or create variations of the IDs
- DO NOT guess phenotype IDs based on names or descriptions
- COPY the exact ID string from the list above
- ONLY use the exact domain names from the AVAILABLE DATABASE DOMAINS list above
- DO NOT abbreviate or modify domain names (use "CONDITION_OCCURRENCE" not "conditions")
- If you need to delete "HbA1c measurement", use the exact ID from the list above

Please modify this cohort according to the user's instructions. Use the available tools to add, update, or delete phenotypes as needed.
"""

    # DEBUG: Print the exact message being sent to AI
    print(f"\n🔍 DEBUG: USER MESSAGE BEING SENT TO AI:")
    print(f"=" * 80)
    print(user_message)
    print(f"=" * 80)

    async def stream_ai_response():
        """Stream the AI response with real-time feedback about tool calls and reasoning."""
        tool_calls_made = []  # Track all tool calls for summary

        # Create async queue for immediate message streaming
        message_queue = asyncio.Queue()

        # Create and setup streaming context BEFORE running the agent
        streaming_ctx = StreamingContext()
        actual_tool_calls = []  # Track actual tool executions (not UI messages)

        def collect_message(message_data):
            # Put message in queue for immediate streaming
            try:
                message_queue.put_nowait(message_data)
            except:
                pass  # Queue full, skip message
            # Track tool calls for summary (UI messages only)
            if message_data.get("type") == "tool_call":
                tool_calls_made.append(message_data.get("message", "Unknown tool"))

        streaming_ctx.add_callback(collect_message)
        set_streaming_context(streaming_ctx)

        async def drain_message_queue():
            """Drain all pending messages from queue."""
            while not message_queue.empty():
                try:
                    msg = message_queue.get_nowait()
                    yield f"data: {json.dumps(msg)}\n\n"
                    await asyncio.sleep(0)  # Force immediate delivery
                except asyncio.QueueEmpty:
                    break

        try:
            # Stream the agent response in real-time using Pydantic AI's streaming API
            async with agent.run_stream(user_message, deps=context) as result:
                # Interleave AI text tokens with tool call messages
                async for text_chunk in result.stream_text(delta=True):
                    # First, drain any pending tool messages
                    async for msg in drain_message_queue():
                        yield msg

                    # Then stream AI text token
                    if text_chunk:
                        yield f"data: {json.dumps({'type': 'content', 'message': text_chunk})}\n\n"
                        await asyncio.sleep(0)  # Force immediate delivery

            # After streaming completes, result object contains all_messages for tool call extraction
            # Extract actual tool calls from agent result for change detection
            # Define WRITE operations (tools that modify the cohort)
            WRITE_TOOLS = {
                "create_phenotype",
                "update_phenotype",
                "delete_phenotype",
                "atomic_update_value_filter",
                "atomic_update_relative_time_range",
                "atomic_update_codelist",
                "atomic_update_name",
                "atomic_update_description",
                "atomic_update_domain",
                "atomic_update_type",
                "atomic_update_return_date",
                "atomic_update_categorical_filter",
                "atomic_update_nested_phenotype",
            }

            if hasattr(result, "all_messages"):
                for msg in result.all_messages():
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tool_call in msg.tool_calls:
                            # Only track write operations
                            if tool_call.tool_name in WRITE_TOOLS:
                                actual_tool_calls.append(tool_call.tool_name)

            print(f"💾 FINAL_SAVE: Write operations detected: {actual_tool_calls}")

            # Save final context state to database (all operations are now complete)
            final_phenotypes = context.current_cohort.get("phenotypes", [])
            initial_phenotypes = initial_cohort_data.get("phenotypes", [])

            # Compare by phenotype IDs AND content to detect changes
            final_ids = {p.get("id") for p in final_phenotypes}
            initial_ids = {p.get("id") for p in initial_phenotypes}

            # Deep comparison - check if phenotype content has changed
            def phenotypes_equal(p1, p2):
                """Compare two phenotypes for equality, ignoring order-dependent differences."""
                return json.dumps(p1, sort_keys=True) == json.dumps(p2, sort_keys=True)

            # Create lookup dicts for efficient comparison
            initial_lookup = {p.get("id"): p for p in initial_phenotypes}
            final_lookup = {p.get("id"): p for p in final_phenotypes}

            content_changed = False

            # CRITICAL FIX: Check if any tool calls were made during the conversation
            # If tools were called, assume changes were made (atomic functions update in-place)
            print(f"💾 FINAL_SAVE: Actual tool calls executed: {actual_tool_calls}")
            if actual_tool_calls:
                print(
                    f"💾 FINAL_SAVE: ✅ Tools were executed ({len(actual_tool_calls)} calls) - assuming changes were made"
                )
                content_changed = True
            elif final_ids == initial_ids and len(final_phenotypes) == len(
                initial_phenotypes
            ):
                # Only do expensive deep comparison if no tools were called
                print(
                    f"💾 FINAL_SAVE: No tools called - doing deep content comparison for {len(final_ids)} phenotypes"
                )
                for pid in final_ids:
                    initial_pheno = initial_lookup[pid]
                    final_pheno = final_lookup[pid]
                    print(f"💾 FINAL_SAVE: Comparing phenotype {pid}:")
                    print(
                        f"💾 FINAL_SAVE:   Initial: {json.dumps(initial_pheno, sort_keys=True)[:200]}..."
                    )
                    print(
                        f"💾 FINAL_SAVE:   Final:   {json.dumps(final_pheno, sort_keys=True)[:200]}..."
                    )

                    if not phenotypes_equal(initial_pheno, final_pheno):
                        content_changed = True
                        print(f"💾 FINAL_SAVE: ✅ Phenotype {pid} content changed")
                        break
                    else:
                        print(f"💾 FINAL_SAVE: ❌ Phenotype {pid} content identical")

                if not content_changed:
                    print(
                        f"💾 FINAL_SAVE: ❌ No content changes detected in any phenotype"
                    )
            else:
                # Different phenotype sets detected
                content_changed = True
                print(
                    f"💾 FINAL_SAVE: ✅ Structural changes detected (different phenotype sets)"
                )

            if (
                final_ids != initial_ids
                or len(final_phenotypes) != len(initial_phenotypes)
                or content_changed
            ):
                print(f"\n💾 FINAL_SAVE: Changes detected - saving final state")
                print(
                    f"💾 FINAL_SAVE: Initial: {len(initial_phenotypes)} phenotypes {list(initial_ids)}"
                )
                print(
                    f"💾 FINAL_SAVE: Final: {len(final_phenotypes)} phenotypes {list(final_ids)}"
                )
                if content_changed:
                    print(
                        f"💾 FINAL_SAVE: Content changes detected in existing phenotypes"
                    )
                if final_ids != initial_ids:
                    added = final_ids - initial_ids
                    removed = initial_ids - final_ids
                    if added:
                        print(f"💾 FINAL_SAVE: Added phenotypes: {added}")
                    if removed:
                        print(f"💾 FINAL_SAVE: Removed phenotypes: {removed}")
                await save_final_cohort(
                    context, "Final save after AI conversation completed"
                )
                # Don't show save messages or cohort state to user - they're too verbose
                await asyncio.sleep(0)
            else:
                print(f"\n💾 FINAL_SAVE: No changes detected, skipping database save")

            # Drain any remaining tool messages after text stream completes
            async for msg in drain_message_queue():
                yield msg

            # Log tool call summary to backend logs (not user response)
            if tool_calls_made:
                logger.info(
                    f"🔧 AI TOOL CALL SUMMARY ({len(tool_calls_made)} operations):"
                )
                for i, tool_call in enumerate(tool_calls_made, 1):
                    logger.info(f"  {i}. {tool_call}")
                logger.info("✅ All AI operations completed successfully")

            # Send completion signal
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            logger.error(f"Error in stream_ai_response: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Error: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        finally:
            # Clean up streaming context
            set_streaming_context(None)

    async def buffered_stream():
        """Buffered streaming with the critical async.sleep(0) pattern."""
        async for chunk in stream_ai_response():
            yield chunk
            # Force immediate delivery by yielding an empty chunk - CRITICAL FOR LATENCY
            await asyncio.sleep(0)

    return StreamingResponse(
        buffered_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Transfer-Encoding": "chunked",
        },
    )


@router.get("/accept_changes", tags=["AI"])
async def accept_changes(request: Request, cohort_id: str):
    """
    Accept changes made to a provisional cohort by setting is_provisional to False.

    Args:
        cohort_id (str): The ID of the cohort to finalize for the authenticated user.

    Returns:
        dict: The finalized cohort data.
    """
    user_id = get_authenticated_user_id(request)
    try:
        success = await db_manager.accept_changes(user_id, cohort_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"No provisional changes found for cohort {cohort_id}",
            )
        cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
        return cohort
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to accept changes for cohort {cohort_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to accept changes for cohort {cohort_id}"
        )


@router.get("/reject_changes", tags=["AI"])
async def reject_changes(request: Request, cohort_id: str):
    """
    Reject changes made to a provisional cohort by deleting provisional versions.

    Args:
        cohort_id (str): The ID of the cohort to discard provisional changes for authenticated user.

    Returns:
        dict: The non-provisional cohort data.
    """
    user_id = get_authenticated_user_id(request)
    try:
        logger.info(f"Rejecting changes for user {user_id}, cohort {cohort_id}")
        await db_manager.reject_changes(user_id, cohort_id)

        # Return the non-provisional cohort
        logger.info(f"Fetching non-provisional cohort after rejection")
        cohort = await db_manager.get_cohort_for_user(user_id, cohort_id)
        if not cohort:
            raise HTTPException(
                status_code=404,
                detail=f"Cohort {cohort_id} not found after rejecting changes",
            )
        return cohort
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reject changes for cohort {cohort_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to reject changes for cohort {cohort_id}"
        )


@router.get("/get_changes", tags=["AI"])
async def get_changes(request: Request, cohort_id: str):
    """
    Get differences between the provisional and non-provisional versions of a cohort.
    Returns empty dict if there is no provisional cohort.

    Args:
        cohort_id (str): The ID of the cohort to compare for the authenticated user.

    Returns:
        dict: Dictionary of changes between provisional and non-provisional versions.
    """
    user_id = get_authenticated_user_id(request)
    try:
        changes = await db_manager.get_changes_for_user(user_id, cohort_id)
        return changes
    except Exception as e:
        logger.error(
            f"Failed to get changes for cohort {cohort_id} for user {user_id}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get changes for cohort {cohort_id} for user {user_id}",
        )
